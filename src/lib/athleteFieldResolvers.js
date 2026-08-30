// Canonical, per-column VALUE resolvers for every athlete field exposed by
// the Athletes page's own column configuration (ALL_COLS, defined inline
// in Athletes.jsx). This is the single source of truth AthleteExportSelector
// consumes for Search-by and Edit-for-PDF, so the export selector can never
// offer a smaller/disconnected field list than what the Columns menu itself
// exposes — labels still come from ALL_COLS (already translated via the
// page's own tx()/lang context); this module only supplies each key's
// `type` (which input Edit-for-PDF renders) and how to read/search/
// override its value.
//
// ctx = { coaches, sportsList, ar }
// - getText(a, ctx): plain-text value used for searching
// - getDisplay(a, ctx): value shown as "current/original" in the UI
// - applyOverride(value, ctx): partial object merged into the temporary
//   export row for that field (never written to Supabase)
//
// Fields with `computed: true` are derived aggregates (documents status,
// medals tally) that need context this selector doesn't have (results,
// full documentEngine state) — explicitly marked rather than silently
// included with broken behavior; they're excluded from Search-by/Edit-for
// -PDF, though still listed here for completeness/traceability.

import { sportLabel, targetCategoryLabel, TARGET_CATEGORY_OPTIONS } from './helpers'
import { translateCountry } from './LangContext.jsx'

export const STATUS_OPTIONS = ['Active', 'On Leave', 'In Competition', 'In Training Camp', 'Inactive', 'Injured', 'Under Medical Review', 'Suspended', 'Retired']
export const GENDER_OPTIONS = ['Male', 'Female']

function plainText(key) {
  return {
    type: 'text', searchable: true, editableForExport: true,
    getText: a => (a[key] ?? '') + '',
    getDisplay: (a) => (a[key] ?? '') + '',
    applyOverride: v => ({ [key]: v }),
  }
}
function plainDate(key) {
  return {
    type: 'date', searchable: true, editableForExport: true,
    getText: a => (a[key] ?? '') + '',
    getDisplay: (a) => (a[key] ?? '') + '',
    applyOverride: v => ({ [key]: v }),
  }
}

export const ATHLETE_FIELD_RESOLVERS = {
  name: plainText('name'),
  name_ar: plainText('name_ar'),
  qss_number: plainText('qss_number'),
  id_number: plainText('id_number'),
  career_profile: plainText('career_profile'),

  sport_category: {
    type: 'text', searchable: true, editableForExport: true,
    getText: a => a.sport_category || '',
    getDisplay: a => a.sport_category || '',
    applyOverride: v => ({ sport_category: v }),
  },
  sport: {
    type: 'select-sport', searchable: true, editableForExport: true,
    getText: (a, ctx) => a.sport ? `${sportLabel(a.sport, a.sport_category, false)} ${sportLabel(a.sport, a.sport_category, true)}` : '',
    getDisplay: (a, ctx) => a.sport ? sportLabel(a.sport, a.sport_category, ctx.ar) : '',
    // PDF-only — merged row still carries the plain scalar sport/
    // sport_category fields the existing PDF already reads directly;
    // athlete_sports is never touched by this override.
    applyOverride: (sportId, ctx) => {
      const s = (ctx.sportsList || []).find(sp => sp.id === sportId)
      return s ? { sport: s.name, sport_category: s.category } : {}
    },
  },
  classification: plainText('classification'),
  disability: plainText('disability'),
  statistics_disability: plainText('statistics_disability'),

  nationality: {
    type: 'text', searchable: true, editableForExport: true,
    getText: a => `${translateCountry(a.nationality, 'en') || ''} ${translateCountry(a.nationality, 'ar') || ''} ${a.nationality || ''}`,
    getDisplay: (a, ctx) => translateCountry(a.nationality, ctx.ar ? 'ar' : 'en') || a.nationality || '',
    applyOverride: v => ({ nationality: v }),
  },
  gender: {
    type: 'select-gender', searchable: true, editableForExport: true,
    getText: a => a.gender || '',
    getDisplay: a => a.gender || '',
    applyOverride: v => ({ gender: v }),
  },
  dob: plainDate('dob'),
  age: plainText('age'),
  residency_status: plainText('residency_status'),

  target_category: {
    type: 'select-target', searchable: true, editableForExport: true,
    getText: a => a.target_category ? `${targetCategoryLabel(a.target_category, 'en')} ${targetCategoryLabel(a.target_category, 'ar')}` : '',
    getDisplay: (a, ctx) => a.target_category ? targetCategoryLabel(a.target_category, ctx.ar ? 'ar' : 'en') : '',
    applyOverride: v => ({ target_category: v || null }),
  },
  age_category: plainText('age_category'),
  sport_age_category: plainText('sport_age_category'),

  coach_id: {
    type: 'select-coach', searchable: true, editableForExport: true,
    getText: (a, ctx) => { const c = (ctx.coaches || []).find(c => c.id === a.coach_id); return c ? `${c.name || ''} ${c.name_ar || ''}` : '' },
    getDisplay: (a, ctx) => { const c = (ctx.coaches || []).find(c => c.id === a.coach_id); return c ? (ctx.ar && c.name_ar ? c.name_ar : c.name) : '' },
    applyOverride: coachId => ({ coach_id: coachId || null }),
  },
  status: {
    type: 'select-status', searchable: true, editableForExport: true,
    getText: a => a.status || '',
    getDisplay: a => a.status || '',
    applyOverride: v => ({ status: v }),
  },
  medical_status: plainText('medical_status'),
  phone: plainText('phone'),
  email: plainText('email'),
  join_date: plainDate('join_date'),
  passport_number: plainText('passport_number'),
  passport_expiry: plainDate('passport_expiry'),
  id_expiry: plainDate('id_expiry'),

  // Derived aggregates — need context (results, documentEngine state)
  // beyond what this selector has available, so explicitly excluded from
  // Search-by/Edit-for-PDF rather than silently offered with broken
  // values. Still declared here so their exclusion is traceable, not an
  // accidental omission.
  medals: { computed: true, searchable: false, editableForExport: false, reason: 'Derived from event results — not a simple athlete field.' },
  documents: { computed: true, searchable: false, editableForExport: false, reason: 'Derived document-completion status — needs full documentEngine context.' },
  missing_documents: { computed: true, searchable: false, editableForExport: false, reason: 'Derived document-completion status — needs full documentEngine context.' },
}

// Builds the field-definition array AthleteExportSelector actually
// renders: one entry per ALL_COLS column that has a resolver AND is
// search/edit-capable, carrying that column's already-translated label
// straight from ALL_COLS (no relabeling here).
export function buildAthleteFieldDefs(allCols, ctx) {
  return (allCols || [])
    .map(col => {
      const resolver = ATHLETE_FIELD_RESOLVERS[col.key]
      if (!resolver || resolver.computed) return null
      return { key: col.key, label: col.label, ...resolver }
    })
    .filter(Boolean)
}
