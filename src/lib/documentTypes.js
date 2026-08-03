// Shared employee/coach document type constants — single source of truth,
// used by PersonDocuments.jsx (the shared documents UI) and by the
// Employees.jsx bulk document importer. Extracted into its own module so
// neither file has to import data constants from a UI component, and so
// there is exactly one canonical list (no duplicated arrays/maps to drift
// out of sync).
//
// 'Original Passport' matches Athletes.jsx/documentEngine's canonical name
// (was 'Passport' here before — normalized so shared-document merging
// across roles works off one consistent vocabulary).
export const DOC_TYPES = [
  'Original Passport', 'Qatar ID', 'Residence Permit',
  'Contract', 'Certificate', 'Medical Report',
  'Photo', 'ADEL Certificate', 'Other'
]

export const DOC_TYPES_AR = {
  'Original Passport':'جواز السفر', 'Qatar ID':'الرقم الشخصي',
  'Residence Permit':'تصريح الإقامة', 'Contract':'العقد',
  'Certificate':'الشهادة', 'Medical Report':'التقرير الطبي',
  'Photo':'صورة', 'ADEL Certificate':'شهادة ADEL', 'Other':'أخرى',
}

export const DOC_ICONS = {
  'Original Passport':'ti-id',
  'Qatar ID':         'ti-id-badge',
  'Residence Permit': 'ti-home',
  'Contract':         'ti-file-text',
  'Certificate':      'ti-certificate',
  'Medical Report':   'ti-heart-rate-monitor',
  'Photo':            'ti-photo',
  'ADEL Certificate': 'ti-award',
  'Other':            'ti-file',
}

export const DOC_COLORS = {
  'Original Passport':'#0085C7',
  'Qatar ID':         '#009F6B',
  'Residence Permit': '#16a085',
  'Contract':         '#8b5cf6',
  'Certificate':      '#e67e22',
  'Medical Report':   '#EE334E',
  'Photo':            '#0085C7',
  'ADEL Certificate': '#009F6B',
  'Other':            '#9aa3b2',
}
