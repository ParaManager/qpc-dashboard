import { useState, useMemo } from 'react'
import { Avatar, sportLabel, targetCategoryLabel, TARGET_CATEGORY_OPTIONS } from '../lib/helpers'
import { translateCountry } from '../lib/LangContext.jsx'

// ── Canonical field configuration ───────────────────────────────────────
// One shared definition per athlete export field — Search-by and Edit-by
// both read from this single array instead of maintaining separate lists
// that could drift out of sync. Field keys match the page's own ALL_COLS
// column config (name, name_ar, id_number, sport, coach, nationality,
// status, target_category, medical_status, passport_expiry, id_expiry).
//
// `type` drives which input the Edit-by panel renders; `getText` builds
// the searchable text for that field; `getDisplay` builds what's shown as
// the "current value" in the Edit-by list; `applyOverride(value)` returns
// the partial object merged into the temporary export row for that field
// -- e.g. picking a coach stores { coach_id }, since the existing PDF
// generator resolves the coach name from coach_id + the real coaches
// list, so no PDF-side change is needed for the override to take effect.
const STATUS_OPTIONS = ['Active', 'On Leave', 'In Competition', 'In Training Camp', 'Inactive', 'Injured', 'Under Medical Review', 'Suspended', 'Retired']

function buildFieldDefs(coaches, sportsList) {
  return [
    {
      key: 'name', en: 'English Name', ar: 'الاسم بالإنجليزي', type: 'text', searchable: true, editableForExport: true,
      getText: a => a.name || '', getDisplay: (a, ar) => a.name || '',
      applyOverride: v => ({ name: v }),
    },
    {
      key: 'name_ar', en: 'Arabic Name', ar: 'الاسم بالعربي', type: 'text', searchable: true, editableForExport: true,
      getText: a => a.name_ar || '', getDisplay: (a, ar) => a.name_ar || '',
      applyOverride: v => ({ name_ar: v }),
    },
    {
      key: 'id_number', en: 'Qatar ID', ar: 'الرقم الشخصي', type: 'text', searchable: true, editableForExport: true,
      getText: a => a.id_number || '', getDisplay: (a, ar) => a.id_number || '',
      applyOverride: v => ({ id_number: v }),
    },
    {
      key: 'sport', en: 'Sport', ar: 'الرياضة', type: 'select-sport', searchable: true, editableForExport: true,
      getText: a => a.sport ? `${sportLabel(a.sport, a.sport_category, false)} ${sportLabel(a.sport, a.sport_category, true)}` : '',
      getDisplay: (a, ar) => a.sport ? sportLabel(a.sport, a.sport_category, ar) : '',
      // PDF-only -- the merged export row still just carries the scalar
      // sport/sport_category fields the existing PDF already reads;
      // athlete_sports is never touched by this override.
      applyOverride: sportId => {
        const s = sportsList.find(sp => sp.id === sportId)
        return s ? { sport: s.name, sport_category: s.category } : {}
      },
    },
    {
      key: 'coach', en: 'Coach', ar: 'المدرب', type: 'select-coach', searchable: true, editableForExport: true,
      getText: a => { const c = coaches.find(c => c.id === a.coach_id); return c ? `${c.name || ''} ${c.name_ar || ''}` : '' },
      getDisplay: (a, ar) => { const c = coaches.find(c => c.id === a.coach_id); return c ? (ar && c.name_ar ? c.name_ar : c.name) : '' },
      applyOverride: coachId => ({ coach_id: coachId || null }),
    },
    {
      key: 'nationality', en: 'Nationality', ar: 'الجنسية', type: 'text', searchable: true, editableForExport: true,
      getText: a => `${translateCountry(a.nationality, 'en') || ''} ${translateCountry(a.nationality, 'ar') || ''} ${a.nationality || ''}`,
      getDisplay: (a, ar) => translateCountry(a.nationality, ar ? 'ar' : 'en') || a.nationality || '',
      applyOverride: v => ({ nationality: v }),
    },
    {
      key: 'status', en: 'Status', ar: 'الحالة', type: 'select-status', searchable: true, editableForExport: true,
      getText: a => a.status || '', getDisplay: (a, ar) => a.status || '',
      applyOverride: v => ({ status: v }),
    },
    {
      key: 'target_category', en: 'Targeted Athletes', ar: 'الفئات المستهدفة', type: 'select-target', searchable: true, editableForExport: true,
      getText: a => a.target_category ? `${targetCategoryLabel(a.target_category, 'en')} ${targetCategoryLabel(a.target_category, 'ar')}` : '',
      getDisplay: (a, ar) => a.target_category ? targetCategoryLabel(a.target_category, ar ? 'ar' : 'en') : '',
      applyOverride: v => ({ target_category: v || null }),
    },
    {
      key: 'medical_status', en: 'Medical Status', ar: 'الحالة الطبية', type: 'text', searchable: true, editableForExport: true,
      getText: a => a.medical_status || '', getDisplay: (a, ar) => a.medical_status || '',
      applyOverride: v => ({ medical_status: v }),
    },
    {
      key: 'passport_expiry', en: 'Passport Expiry', ar: 'تاريخ انتهاء الجواز', type: 'date', searchable: true, editableForExport: true,
      getText: a => a.passport_expiry || '', getDisplay: (a, ar) => a.passport_expiry || '',
      applyOverride: v => ({ passport_expiry: v }),
    },
    {
      key: 'id_expiry', en: 'ID Expiry', ar: 'تاريخ انتهاء البطاقة', type: 'date', searchable: true, editableForExport: true,
      getText: a => a.id_expiry || '', getDisplay: (a, ar) => a.id_expiry || '',
      applyOverride: v => ({ id_expiry: v }),
    },
  ]
}

const SEARCH_PLACEHOLDERS = {
  all:              { en: 'Search athletes…',                                   ar: 'ابحث عن الرياضيين…' },
  name:             { en: 'Search by English name…',                           ar: 'ابحث بالاسم بالإنجليزي…' },
  name_ar:          { en: 'Search by Arabic name…',                            ar: 'ابحث بالاسم بالعربي…' },
  id_number:        { en: 'Search by Qatar ID… (paste multiple IDs supported)', ar: 'ابحث بالرقم الشخصي… (يمكن لصق عدة أرقام)' },
  sport:            { en: 'Search by sport…',                                  ar: 'ابحث بالرياضة…' },
  coach:            { en: 'Search by coach…',                                  ar: 'ابحث بالمدرب…' },
  nationality:      { en: 'Search by nationality…',                           ar: 'ابحث بالجنسية…' },
  status:           { en: 'Search by status…',                                ar: 'ابحث بالحالة…' },
  target_category:  { en: 'Search by targeted athlete category…',            ar: 'ابحث بالفئة المستهدفة…' },
  medical_status:   { en: 'Search by medical status…',                       ar: 'ابحث بالحالة الطبية…' },
  passport_expiry:  { en: 'Search by passport expiry…',                      ar: 'ابحث بتاريخ انتهاء الجواز…' },
  id_expiry:        { en: 'Search by ID expiry…',                            ar: 'ابحث بتاريخ انتهاء البطاقة…' },
}

// Splits pasted multi-value input on newlines/commas/semicolons, trims,
// drops blanks. A single resulting value just falls through to normal
// substring search by the caller.
function parseMultiValues(raw) {
  return raw.split(/[\n,;]+/).map(v => v.trim()).filter(Boolean)
}

export default function AthleteExportSelector({
  allAthletes, coaches = [], sportsList = [], initialSelectedIds, ar, tx,
  title, exportLabelPrefix, onExport, onClose,
}) {
  const fieldDefs = useMemo(() => buildFieldDefs(coaches, sportsList), [coaches, sportsList])
  const fieldByKey = useMemo(() => Object.fromEntries(fieldDefs.map(f => [f.key, f])), [fieldDefs])
  const searchFields = useMemo(() => [{ key: 'all', en: 'All fields', ar: 'كل الحقول' }, ...fieldDefs.filter(f => f.searchable)], [fieldDefs])
  const editFields = useMemo(() => fieldDefs.filter(f => f.editableForExport), [fieldDefs])

  const [selectedIds, setSelectedIds] = useState(() => new Set(initialSelectedIds || []))
  const [search, setSearch] = useState('')
  const [searchField, setSearchField] = useState('all')
  const [editField, setEditField] = useState('') // '' = Edit-by panel closed
  // { [athleteId]: { [fieldKey]: value } } -- PDF-only, never written to
  // Supabase, discarded entirely on close/cancel.
  const [exportOverrides, setExportOverrides] = useState({})
  const [exporting, setExporting] = useState(false)
  const L = (en, arTx) => ar ? arTx : en

  function allFieldsText(a) {
    return fieldDefs.filter(f => f.searchable).map(f => f.getText(a)).join(' ').toLowerCase()
  }

  const filtered = useMemo(() => {
    const raw = search.trim()
    if (!raw) return allAthletes
    const values = parseMultiValues(raw)

    // Qatar ID with multiple pasted values -> normalized EXACT match
    // against each value, never loose substring matching.
    if (searchField === 'id_number' && values.length > 1) {
      const idSet = new Set(values.map(v => v.toLowerCase()))
      return allAthletes.filter(a => a.id_number && idSet.has(String(a.id_number).trim().toLowerCase()))
    }

    const q = raw.toLowerCase()
    if (searchField === 'all') return allAthletes.filter(a => allFieldsText(a).includes(q))
    const def = fieldByKey[searchField]
    return allAthletes.filter(a => def.getText(a).toLowerCase().includes(q))
  }, [search, searchField, allAthletes, fieldByKey])

  const allSelectedTotal = selectedIds.size === allAthletes.length && allAthletes.length > 0
  const allFilteredSelected = filtered.length > 0 && filtered.every(a => selectedIds.has(a.id))

  function toggleOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function selectAllFiltered() {
    // Only ADDS the currently-matching athletes -- never drops an
    // already-selected athlete just because a search hides them.
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) { filtered.forEach(a => next.delete(a.id)) }
      else { filtered.forEach(a => next.add(a.id)) }
      return next
    })
  }
  function selectAllComplete() {
    setSelectedIds(new Set(allAthletes.map(a => a.id)))
  }
  function clearSelection() {
    setSelectedIds(new Set())
  }

  // ── PDF-only temporary edits ──────────────────────────────────────────
  // The Edit-by panel operates on every SELECTED athlete, not just the
  // currently-visible search results -- searching is only for finding who
  // to select/edit, never a scope restriction on what gets edited.
  const selectedAthletesForEdit = useMemo(() => allAthletes.filter(a => selectedIds.has(a.id)), [allAthletes, selectedIds])

  function setOverrideValue(athleteId, field, rawValue) {
    setExportOverrides(prev => ({
      ...prev,
      [athleteId]: { ...prev[athleteId], ...field.applyOverride(rawValue) },
    }))
  }
  function resetOneValue(athleteId, field) {
    setExportOverrides(prev => {
      const current = { ...(prev[athleteId] || {}) }
      // A field can expand into multiple stored keys (e.g. sport ->
      // sport/sport_category) -- clear all keys that field's applyOverride
      // could ever produce, using a neutral probe value.
      Object.keys(field.applyOverride(field.key === 'sport' ? null : '')).forEach(k => delete current[k])
      const next = { ...prev, [athleteId]: current }
      if (Object.keys(current).length === 0) delete next[athleteId]
      return next
    })
  }
  function resetAthlete(athleteId) {
    setExportOverrides(prev => {
      const next = { ...prev }
      delete next[athleteId]
      return next
    })
  }
  function resetAllOverrides() {
    setExportOverrides({})
  }
  const overrideCount = id => Object.keys(exportOverrides[id] || {}).length

  async function handleExport() {
    if (selectedIds.size === 0) return
    setExporting(true)
    try {
      // Temporary merge only -- original athlete objects (and Supabase)
      // are never touched. Only this derived copy is handed to the
      // existing, unmodified PDF generator.
      const exportRows = allAthletes
        .filter(a => selectedIds.has(a.id))
        .map(a => ({ ...a, ...(exportOverrides[a.id] || {}) }))
      await onExport(exportRows)
      onClose()
    } finally {
      setExporting(false)
    }
  }

  function renderEditInput(a, field) {
    const current = () => {
      switch (field.type) {
        case 'select-sport': {
          const s = sportsList.find(sp => sp.name === (exportOverrides[a.id]?.sport ?? a.sport) && sp.category === (exportOverrides[a.id]?.sport_category ?? a.sport_category))
          return s ? s.id : ''
        }
        case 'select-coach': return exportOverrides[a.id]?.coach_id ?? a.coach_id ?? ''
        default: return exportOverrides[a.id]?.[field.key] ?? a[field.key] ?? ''
      }
    }
    const value = current()

    if (field.type === 'select-sport') {
      return (
        <select className="form-input" style={{ fontSize: 12.5 }} value={value} onChange={e => setOverrideValue(a.id, field, e.target.value ? Number(e.target.value) : null)}>
          <option value="">{L('— None —', '— بدون —')}</option>
          {Array.from(new Set(sportsList.map(s => s.category))).map(cat => (
            <optgroup key={cat} label={cat}>
              {sportsList.filter(s => s.category === cat).map(s => <option key={s.id} value={s.id}>{sportLabel(s.name, s.category, ar)}</option>)}
            </optgroup>
          ))}
        </select>
      )
    }
    if (field.type === 'select-coach') {
      return (
        <select className="form-input" style={{ fontSize: 12.5 }} value={value} onChange={e => setOverrideValue(a.id, field, e.target.value ? Number(e.target.value) : null)}>
          <option value="">{L('— None —', '— بدون —')}</option>
          {coaches.map(c => <option key={c.id} value={c.id}>{ar && c.name_ar ? c.name_ar : c.name}</option>)}
        </select>
      )
    }
    if (field.type === 'select-status') {
      return (
        <select className="form-input" style={{ fontSize: 12.5 }} value={value} onChange={e => setOverrideValue(a.id, field, e.target.value)}>
          <option value="">{L('— None —', '— بدون —')}</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )
    }
    if (field.type === 'select-target') {
      return (
        <select className="form-input" style={{ fontSize: 12.5 }} value={value} onChange={e => setOverrideValue(a.id, field, e.target.value)}>
          <option value="">{L('— None —', '— بدون —')}</option>
          {TARGET_CATEGORY_OPTIONS.map(o => <option key={o} value={o}>{targetCategoryLabel(o, ar ? 'ar' : 'en')}</option>)}
        </select>
      )
    }
    if (field.type === 'date') {
      return <input type="date" className="form-input" style={{ fontSize: 12.5 }} value={value} onChange={e => setOverrideValue(a.id, field, e.target.value)} />
    }
    return <input type="text" className="form-input" style={{ fontSize: 12.5 }} value={value} onChange={e => setOverrideValue(a.id, field, e.target.value)} />
  }

  const activeEditField = editField ? fieldByKey[editField] : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: 720, display: 'flex', flexDirection: 'column', maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        {/* Sticky header + search -- stays visible while the list below scrolls, important with 190+ athletes. */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{title || L('Select Athletes to Export', 'اختر الرياضيين للتصدير')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={ar ? SEARCH_PLACEHOLDERS[searchField].ar : SEARCH_PLACEHOLDERS[searchField].en}
              className="form-input" style={{ flex: '1 1 220px', minWidth: 0 }}
            />
            <select value={searchField} onChange={e => setSearchField(e.target.value)} className="form-input" style={{ flex: '0 0 170px' }}>
              {searchFields.map(f => <option key={f.key} value={f.key}>{L('Search by: ', 'البحث حسب: ') + (ar ? f.ar : f.en)}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>
              {L(`${selectedIds.size} athlete${selectedIds.size === 1 ? '' : 's'} selected`, `${selectedIds.size} رياضي محدد`)}
              {search.trim() && <span style={{ color: 'var(--text3)', fontWeight: 400 }}> · {L(`${filtered.length} match${filtered.length === 1 ? '' : 'es'}`, `${filtered.length} نتيجة`)}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn-cancel" style={{ padding: '4px 10px', fontSize: 12 }} onClick={selectAllFiltered} disabled={filtered.length === 0}>
                {allFilteredSelected ? L('Deselect matching', 'إلغاء تحديد النتائج') : L(search.trim() ? 'Select all matching' : 'Select All', search.trim() ? 'تحديد كل النتائج' : 'تحديد الكل')}
              </button>
              {search.trim() && !allSelectedTotal && (
                <button type="button" className="btn-cancel" style={{ padding: '4px 10px', fontSize: 12 }} onClick={selectAllComplete}>
                  {L(`Select all ${allAthletes.length} athletes`, `تحديد كل الرياضيين (${allAthletes.length})`)}
                </button>
              )}
              <button type="button" className="btn-cancel" style={{ padding: '4px 10px', fontSize: 12 }} onClick={clearSelection} disabled={selectedIds.size === 0}>
                {L('Clear Selection', 'مسح التحديد')}
              </button>
            </div>
          </div>
          {/* Edit-by -- PDF-only temporary edits, never written to Supabase */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
            <select value={editField} onChange={e => setEditField(e.target.value)} className="form-input" style={{ flex: '0 0 210px' }}>
              <option value="">{L('Edit for PDF (optional)…', 'تعديل للتصدير (اختياري)…')}</option>
              {editFields.map(f => <option key={f.key} value={f.key}>{L('Edit by: ', 'تعديل حسب: ') + (ar ? f.ar : f.en)}</option>)}
            </select>
            {Object.keys(exportOverrides).length > 0 && (
              <button type="button" className="btn-cancel" style={{ padding: '4px 10px', fontSize: 12, color: '#EE334E' }} onClick={resetAllOverrides}>
                {L('Reset all PDF edits', 'إعادة تعيين كل تعديلات PDF')} ({Object.keys(exportOverrides).length})
              </button>
            )}
          </div>
        </div>

        {activeEditField ? (
          // ── Edit-by panel -- operates on SELECTED athletes regardless of
          // the current search text.
          <div style={{ overflowY: 'auto', flex: 1, padding: '10px 14px' }}>
            {selectedAthletesForEdit.length === 0 ? (
              <div className="empty" style={{ padding: '28px 0' }}>{L('Select athletes first to edit values for the PDF', 'حدد الرياضيين أولاً لتعديل القيم في الملف')}</div>
            ) : selectedAthletesForEdit.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>
                <Avatar name={a.name} id={a.id} size={24} fs={10} />
                <div style={{ flex: '1 1 140px', minWidth: 0, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ar && a.name_ar ? a.name_ar : a.name}
                </div>
                <div style={{ flex: '0 0 130px', fontSize: 11.5, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {L('Original: ', 'الأصلي: ')}{activeEditField.getDisplay(a, ar) || '—'}
                </div>
                <div style={{ flex: '0 0 190px' }}>{renderEditInput(a, activeEditField)}</div>
                {overrideCount(a.id) > 0 && (
                  <>
                    <span title={L('Edited for PDF', 'مُعدَّل للتصدير')} style={{ fontSize: 10, fontWeight: 700, color: '#0085C7', background: '#0085C715', padding: '2px 6px', borderRadius: 10, flexShrink: 0 }}>
                      {L('Edited', 'مُعدَّل')}
                    </span>
                    <button type="button" title={L('Reset this value', 'إعادة تعيين هذه القيمة')} onClick={() => resetOneValue(a.id, activeEditField)}
                      style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>
                      <i className="ti ti-rotate" />
                    </button>
                    <button type="button" title={L('Reset all edits for this athlete', 'إعادة تعيين كل تعديلات هذا الرياضي')} onClick={() => resetAthlete(a.id)}
                      style={{ background: 'none', border: 'none', color: '#EE334E', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>
                      <i className="ti ti-x" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Scrollable athlete list (selection mode) */
          <div style={{ overflowY: 'auto', flex: 1, padding: '6px 14px' }}>
            {allAthletes.length === 0 ? (
              <div className="empty" style={{ padding: '28px 0' }}>{L('No athletes available', 'لا يوجد رياضيون')}</div>
            ) : filtered.length === 0 ? (
              <div className="empty" style={{ padding: '28px 0' }}>{L('No athletes match your search', 'لا يوجد رياضيون مطابقون لبحثك')}</div>
            ) : (
              filtered.map(a => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', userSelect: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleOne(a.id)} />
                  <Avatar name={a.name} id={a.id} size={26} fs={10} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ar && a.name_ar ? a.name_ar : a.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {a.sport ? sportLabel(a.sport, a.sport_category, ar) : L('No sport', 'بدون رياضة')}
                      {a.id_number && <> · {a.id_number}</>}
                    </div>
                  </div>
                  {overrideCount(a.id) > 0 && (
                    <span title={L('Edited for PDF', 'مُعدَّل للتصدير')} style={{ fontSize: 10, fontWeight: 700, color: '#0085C7', background: '#0085C715', padding: '2px 6px', borderRadius: 10, flexShrink: 0 }}>
                      {L('Edited', 'مُعدَّل')}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
        )}

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn-cancel" onClick={onClose}>{L('Cancel', 'إلغاء')}</button>
          <button className="btn btn-blue" disabled={selectedIds.size === 0 || exporting} onClick={handleExport}>
            <i className="ti ti-file-export" /> {exporting ? L('Exporting…', 'جارٍ التصدير…') : `${exportLabelPrefix || L('Export', 'تصدير')} ${selectedIds.size} ${L('Athletes', 'رياضي')}`}
          </button>
        </div>
      </div>
    </div>
  )
}
