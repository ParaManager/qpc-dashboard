import { useState, useMemo } from 'react'
import { Avatar, sportLabel, targetCategoryLabel } from '../lib/helpers'
import { translateCountry } from '../lib/LangContext.jsx'

// Same underlying athlete fields already used by the page's own column
// configuration (ALL_COLS) — kept here as simple key/label pairs rather
// than importing ALL_COLS directly, since that array is built inline
// inside Athletes.jsx around live `tx()`/`lang` closures. The field KEYS
// match exactly (name, name_ar, id_number, sport, coach_id, nationality,
// status, target_category, medical_status, passport_expiry, id_expiry).
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

const SEARCH_FIELDS = [
  { key: 'all',              en: 'All fields',        ar: 'كل الحقول' },
  { key: 'name',             en: 'English Name',      ar: 'الاسم بالإنجليزي' },
  { key: 'name_ar',          en: 'Arabic Name',       ar: 'الاسم بالعربي' },
  { key: 'id_number',        en: 'Qatar ID',          ar: 'الرقم الشخصي' },
  { key: 'sport',            en: 'Sport',             ar: 'الرياضة' },
  { key: 'coach',            en: 'Coach',             ar: 'المدرب' },
  { key: 'nationality',      en: 'Nationality',       ar: 'الجنسية' },
  { key: 'status',           en: 'Status',            ar: 'الحالة' },
  { key: 'target_category',  en: 'Targeted Athletes', ar: 'الفئات المستهدفة' },
  { key: 'medical_status',   en: 'Medical Status',    ar: 'الحالة الطبية' },
  { key: 'passport_expiry',  en: 'Passport Expiry',   ar: 'تاريخ انتهاء الجواز' },
  { key: 'id_expiry',        en: 'ID Expiry',         ar: 'تاريخ انتهاء البطاقة' },
]

function fieldText(a, key, coaches) {
  switch (key) {
    case 'name': return a.name || ''
    case 'name_ar': return a.name_ar || ''
    case 'id_number': return a.id_number || ''
    case 'sport': return a.sport ? `${sportLabel(a.sport, a.sport_category, false)} ${sportLabel(a.sport, a.sport_category, true)}` : ''
    case 'coach': { const c = coaches.find(c => c.id === a.coach_id); return c ? `${c.name || ''} ${c.name_ar || ''}` : '' }
    case 'nationality': return `${translateCountry(a.nationality, 'en') || ''} ${translateCountry(a.nationality, 'ar') || ''} ${a.nationality || ''}`
    case 'status': return a.status || ''
    case 'target_category': return a.target_category ? `${targetCategoryLabel(a.target_category, 'en')} ${targetCategoryLabel(a.target_category, 'ar')}` : ''
    case 'medical_status': return a.medical_status || ''
    case 'passport_expiry': return a.passport_expiry || ''
    case 'id_expiry': return a.id_expiry || ''
    default: return ''
  }
}
function allFieldsText(a, coaches) {
  return SEARCH_FIELDS.filter(f => f.key !== 'all').map(f => fieldText(a, f.key, coaches)).join(' ').toLowerCase()
}

// Splits pasted multi-value input on newlines/commas/semicolons, trims,
// drops blanks. A single resulting value just falls through to normal
// substring search by the caller.
function parseMultiValues(raw) {
  return raw.split(/[\n,;]+/).map(v => v.trim()).filter(Boolean)
}

export default function AthleteExportSelector({
  allAthletes, coaches = [], initialSelectedIds, ar, tx,
  title, exportLabelPrefix, onExport, onClose,
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialSelectedIds || []))
  const [search, setSearch] = useState('')
  const [searchField, setSearchField] = useState('all')
  const [exporting, setExporting] = useState(false)
  const L = (en, arTx) => ar ? arTx : en

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
    if (searchField === 'all') {
      return allAthletes.filter(a => allFieldsText(a, coaches).includes(q))
    }
    return allAthletes.filter(a => fieldText(a, searchField, coaches).toLowerCase().includes(q))
  }, [search, searchField, allAthletes, coaches])

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
    // Only ADDS the currently-matching athletes — never drops an
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
  async function handleExport() {
    if (selectedIds.size === 0) return
    setExporting(true)
    try {
      const chosen = allAthletes.filter(a => selectedIds.has(a.id))
      await onExport(chosen)
      onClose()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: 640, display: 'flex', flexDirection: 'column', maxHeight: '86vh' }} onClick={e => e.stopPropagation()}>
        {/* Sticky header + search — stays visible while the list below scrolls, important with 190+ athletes. */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{title || L('Select Athletes to Export', 'اختر الرياضيين للتصدير')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={ar ? SEARCH_PLACEHOLDERS[searchField].ar : SEARCH_PLACEHOLDERS[searchField].en}
              className="form-input" style={{ flex: '1 1 220px', minWidth: 0 }}
            />
            <select value={searchField} onChange={e => setSearchField(e.target.value)} className="form-input" style={{ flex: '0 0 180px' }}>
              {SEARCH_FIELDS.map(f => <option key={f.key} value={f.key}>{L('Search by: ', 'البحث حسب: ') + (ar ? f.ar : f.en)}</option>)}
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
        </div>

        {/* Scrollable athlete list */}
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
              </label>
            ))
          )}
        </div>

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
