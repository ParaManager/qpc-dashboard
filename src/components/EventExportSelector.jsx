import { useState, useMemo } from 'react'
import { Avatar, sportLabel } from '../lib/helpers'

// ── Shared small helpers (deliberately lightweight) ─────────────────────
// A full reuse of AthleteExportSelector's field-resolver architecture was
// considered, but Event export operates over two structurally different
// datasets (registered athletes vs. employee-based event officials) with
// a much smaller, fixed field set already defined by the existing Event
// PDF's own columns (athleteColDefs/officialColDefs in Events.jsx) — so
// this component defines its own small, local field configs rather than
// forcing an awkward fit onto the Athletes-page-specific resolver module,
// while still following the same overall pattern (shared config drives
// both Search-by and Edit-for-PDF, overrides never touch Supabase).
function parseMultiValues(raw) {
  return raw.split(/[\n,;]+/).map(v => v.trim()).filter(Boolean)
}

function useExportSection({ items, getId, fieldDefs, initialSelectedIds }) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialSelectedIds || items.map(getId)))
  const [search, setSearch] = useState('')
  const [searchField, setSearchField] = useState('all')
  const [editField, setEditField] = useState('')
  const [overrides, setOverrides] = useState({}) // { [id]: { [key]: value } }

  const fieldByKey = useMemo(() => Object.fromEntries(fieldDefs.map(f => [f.key, f])), [fieldDefs])
  const searchFields = useMemo(() => [{ key: 'all', en: 'All fields', ar: 'كل الحقول' }, ...fieldDefs.filter(f => f.searchable !== false)], [fieldDefs])
  const editFields = useMemo(() => fieldDefs.filter(f => f.editable !== false), [fieldDefs])

  function allText(item) {
    return fieldDefs.filter(f => f.searchable !== false).map(f => f.getText(item)).join(' ').toLowerCase()
  }
  const filtered = useMemo(() => {
    const raw = search.trim()
    if (!raw) return items
    const values = parseMultiValues(raw)
    if (searchField !== 'all' && values.length > 1) {
      const def = fieldByKey[searchField]
      const valSet = new Set(values.map(v => v.toLowerCase()))
      return items.filter(item => valSet.has(def.getText(item).trim().toLowerCase()))
    }
    const q = raw.toLowerCase()
    if (searchField === 'all') return items.filter(item => allText(item).includes(q))
    const def = fieldByKey[searchField]
    if (!def) return items
    return items.filter(item => def.getText(item).toLowerCase().includes(q))
  }, [search, searchField, items, fieldByKey])

  const allFilteredSelected = filtered.length > 0 && filtered.every(item => selectedIds.has(getId(item)))
  const allSelectedTotal = selectedIds.size === items.length && items.length > 0

  function toggleOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function selectAllFiltered() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach(item => next.delete(getId(item)))
      else filtered.forEach(item => next.add(getId(item)))
      return next
    })
  }
  function selectAllComplete() { setSelectedIds(new Set(items.map(getId))) }
  function clearSelection() { setSelectedIds(new Set()) }

  function setOverrideValue(id, field, value) {
    setOverrides(prev => ({ ...prev, [id]: { ...prev[id], ...field.applyOverride(value) } }))
  }
  // Merges arbitrary extra keys straight into an item's override object —
  // used for satellite inputs that don't map to a single field's own
  // applyOverride (e.g. the free-text box that appears when "Custom..."
  // is picked for Role).
  function setRawOverride(id, partial) {
    setOverrides(prev => ({ ...prev, [id]: { ...prev[id], ...partial } }))
  }
  function resetOneValue(id, field) {
    setOverrides(prev => {
      const current = { ...(prev[id] || {}) }
      Object.keys(field.applyOverride('')).forEach(k => delete current[k])
      const next = { ...prev, [id]: current }
      if (Object.keys(current).length === 0) delete next[id]
      return next
    })
  }
  function resetItem(id) {
    setOverrides(prev => { const next = { ...prev }; delete next[id]; return next })
  }
  function resetAll() { setOverrides({}) }
  const overrideCount = id => Object.keys(overrides[id] || {}).length

  const selectedItems = useMemo(() => items.filter(item => selectedIds.has(getId(item))), [items, selectedIds, getId])

  return {
    selectedIds, search, setSearch, searchField, setSearchField, editField, setEditField,
    overrides, fieldByKey, searchFields, editFields, filtered, allFilteredSelected, allSelectedTotal,
    toggleOne, selectAllFiltered, selectAllComplete, clearSelection,
    setOverrideValue, setRawOverride, resetOneValue, resetItem, resetAll, overrideCount, selectedItems,
  }
}

function SectionSearchBar({ section, ar, L }) {
  const placeholder = useMemo(() => {
    if (section.searchField === 'all') return L('Search…', 'بحث…')
    const f = section.fieldByKey[section.searchField]
    return f ? L(`Search by ${ar ? f.ar : f.en}…`, `ابحث حسب ${f.ar}…`) : L('Search…', 'بحث…')
  }, [section.searchField, section.fieldByKey, ar])

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input value={section.search} onChange={e => section.setSearch(e.target.value)} placeholder={placeholder}
        className="form-input" style={{ flex: '1 1 200px', minWidth: 0 }} />
      <select value={section.searchField} onChange={e => section.setSearchField(e.target.value)} className="form-input" style={{ flex: '0 0 170px' }}>
        {section.searchFields.map(f => <option key={f.key} value={f.key}>{L('Search by: ', 'البحث حسب: ') + (ar ? f.ar : f.en)}</option>)}
      </select>
    </div>
  )
}

function SectionToolbar({ section, ar, L, total }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>
        {L(`${section.selectedIds.size} selected`, `${section.selectedIds.size} محدد`)}
        {section.search.trim() && <span style={{ color: 'var(--text3)', fontWeight: 400 }}> · {L(`${section.filtered.length} matches`, `${section.filtered.length} نتيجة`)}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-cancel" style={{ padding: '4px 10px', fontSize: 12 }} onClick={section.selectAllFiltered} disabled={section.filtered.length === 0}>
          {section.allFilteredSelected ? L('Deselect matching', 'إلغاء تحديد النتائج') : L(section.search.trim() ? 'Select all matching' : 'Select All', section.search.trim() ? 'تحديد كل النتائج' : 'تحديد الكل')}
        </button>
        {section.search.trim() && !section.allSelectedTotal && (
          <button type="button" className="btn-cancel" style={{ padding: '4px 10px', fontSize: 12 }} onClick={section.selectAllComplete}>
            {L(`Select all ${total}`, `تحديد الكل (${total})`)}
          </button>
        )}
        <button type="button" className="btn-cancel" style={{ padding: '4px 10px', fontSize: 12 }} onClick={section.clearSelection} disabled={section.selectedIds.size === 0}>
          {L('Clear Selection', 'مسح التحديد')}
        </button>
      </div>
    </div>
  )
}

function SectionEditBar({ section, ar, L }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
      <select value={section.editField} onChange={e => section.setEditField(e.target.value)} className="form-input" style={{ flex: '0 0 200px' }}>
        <option value="">{L('Edit for PDF (optional)…', 'تعديل للتصدير (اختياري)…')}</option>
        {section.editFields.map(f => <option key={f.key} value={f.key}>{L('Edit by: ', 'تعديل حسب: ') + (ar ? f.ar : f.en)}</option>)}
      </select>
      {Object.keys(section.overrides).length > 0 && (
        <button type="button" className="btn-cancel" style={{ padding: '4px 10px', fontSize: 12, color: '#EE334E' }} onClick={section.resetAll}>
          {L('Reset all PDF edits', 'إعادة تعيين كل التعديلات')} ({Object.keys(section.overrides).length})
        </button>
      )}
    </div>
  )
}

function renderInput(field, value, onChange) {
  if (field.type === 'select' && field.options) {
    return (
      <select className="form-input" style={{ fontSize: 12.5 }} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— —</option>
        {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
  return <input type="text" className="form-input" style={{ fontSize: 12.5 }} value={value} onChange={e => onChange(e.target.value)} />
}

function EditPanel({ section, getId, getName, getSecondary, ar, L }) {
  const activeField = section.editField ? section.fieldByKey[section.editField] : null
  if (!activeField) return null
  return (
    <div style={{ overflowY: 'auto', flex: 1, padding: '10px 14px' }}>
      {section.selectedItems.length === 0 ? (
        <div className="empty" style={{ padding: '28px 0' }}>{L('Select items first to edit values for the PDF', 'حدد العناصر أولاً لتعديل القيم')}</div>
      ) : section.selectedItems.map(item => {
        const id = getId(item)
        const current = section.overrides[id]?.[activeField.key] ?? activeField.getValue(item)
        return (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: '1 1 140px', minWidth: 0, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getName(item)}
              <div style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 400 }}>{getSecondary(item)}</div>
            </div>
            <div style={{ flex: '0 0 120px', fontSize: 11.5, color: 'var(--text3)' }}>{L('Original: ', 'الأصلي: ')}{activeField.getText(item) || '—'}</div>
            <div style={{ flex: '0 0 190px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {renderInput(activeField, current, v => section.setOverrideValue(id, activeField, v))}
              {activeField.isCustomRoleField && current === '__custom__' && (
                <input type="text" className="form-input" style={{ fontSize: 12.5 }}
                  placeholder={L('Custom role…', 'دور مخصص…')}
                  value={section.overrides[id]?.customRole ?? ''}
                  onChange={e => section.setRawOverride(id, { customRole: e.target.value })} />
              )}
            </div>
            {section.overrideCount(id) > 0 && (
              <>
                <span title={L('Edited for PDF', 'مُعدَّل')} style={{ fontSize: 10, fontWeight: 700, color: '#0085C7', background: '#0085C715', padding: '2px 6px', borderRadius: 10 }}>{L('Edited', 'مُعدَّل')}</span>
                <button type="button" onClick={() => section.resetOneValue(id, activeField)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12 }}><i className="ti ti-rotate" /></button>
                <button type="button" onClick={() => section.resetItem(id)} style={{ background: 'none', border: 'none', color: '#EE334E', cursor: 'pointer', fontSize: 12 }}><i className="ti ti-x" /></button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Athletes tab ─────────────────────────────────────────────────────────
function buildAthleteFieldDefs(ar) {
  return [
    { key: 'name', en: 'Name', ar: 'الاسم', type: 'text', getText: a => `${a.name || ''} ${a.name_ar || ''}`, getValue: a => a.name || '', applyOverride: v => ({ name: v }) },
    { key: 'sport', en: 'Sport', ar: 'الرياضة', type: 'text', getText: a => a.sport ? `${sportLabel(a.sport, a.sport_category, false)} ${sportLabel(a.sport, a.sport_category, true)}` : '', getValue: a => a.sport || '', applyOverride: v => ({ sport: v }) },
    { key: 'classification', en: 'Classification', ar: 'التصنيف', type: 'text', getText: a => a.classification || '', getValue: a => a.classification || '', applyOverride: v => ({ classification: v }) },
    { key: 'gender', en: 'Gender', ar: 'الجنس', type: 'select', options: [{ value: 'Male', label: ar ? 'ذكر' : 'Male' }, { value: 'Female', label: ar ? 'أنثى' : 'Female' }], getText: a => a.gender || '', getValue: a => a.gender || '', applyOverride: v => ({ gender: v }) },
    { key: 'nationality', en: 'Nationality', ar: 'الجنسية', type: 'text', getText: a => a.nationality || '', getValue: a => a.nationality || '', applyOverride: v => ({ nationality: v }) },
  ]
}

// ── Officials tab ────────────────────────────────────────────────────────
function buildOfficialFieldDefs(roleTitles, ar) {
  return [
    { key: 'name', en: 'Name', ar: 'الاسم', type: 'text', getText: o => `${o.name || ''} ${o.name_ar || ''}`, getValue: o => o.name || '', applyOverride: v => ({ name: v }) },
    {
      key: 'role', en: 'Role', ar: 'الدور', type: 'select', isCustomRoleField: true,
      options: [...Object.entries(roleTitles).map(([k, label]) => ({ value: k, label })), { value: '__custom__', label: ar ? 'مخصص...' : 'Custom...' }],
      getText: o => o.roleLabel || '', getValue: o => o.role,
      // Selecting Custom starts a fresh (empty) customRole text — never
      // written to Supabase, PDF-only. Picking a canonical role clears
      // any leftover customRole so it can't reappear if the field is
      // switched back and forth.
      applyOverride: v => v === '__custom__' ? { role: '__custom__', customRole: '' } : { role: v, customRole: undefined },
    },
    { key: 'designation', en: 'Designation', ar: 'الوظيفة', type: 'text', getText: o => o.designation || '', getValue: o => o.designation || '', applyOverride: v => ({ designation: v }) },
  ]
}

// ── Root modal ───────────────────────────────────────────────────────────
export default function EventExportSelector({ ev, regAthletes, officialsByRole, roleTitles, employees, ar, onClose, onGeneratePreview, onExportFinal }) {
  const L = (en, arTx) => ar ? arTx : en
  const [tab, setTab] = useState('athletes')
  const [exporting, setExporting] = useState(false)
  const [inlinePreview, setInlinePreview] = useState(null) // { url, blob, filename } — small in-modal preview stage

  const flatOfficials = useMemo(() => {
    const rows = []
    for (const [role, list] of Object.entries(officialsByRole || {})) {
      for (const o of list) {
        const emp = employees.find(e => e.id === o.employee_id)
        if (!emp) continue
        rows.push({ rowId: o.id, employee_id: o.employee_id, role, roleLabel: roleTitles[role] || role, name: emp.name, name_ar: emp.name_ar, designation: emp.designation })
      }
    }
    return rows
  }, [officialsByRole, employees, roleTitles])

  // Sections are held via refs to their own hook state through render —
  // simplest correct approach here is to lift each tab's own `useExportSection`
  // up so Export can read both without remounting; done by rendering both
  // tabs' hooks unconditionally and hiding the inactive one with CSS,
  // rather than conditionally mounting (which would reset state on switch).
  const athleteFieldDefs = useMemo(() => buildAthleteFieldDefs(ar), [ar])
  const athleteSection = useExportSection({ items: regAthletes, getId: a => a.id, fieldDefs: athleteFieldDefs })
  const officialFieldDefs = useMemo(() => buildOfficialFieldDefs(roleTitles, ar), [roleTitles, ar])
  const officialSection = useExportSection({ items: flatOfficials, getId: o => o.rowId, fieldDefs: officialFieldDefs })

  // Revokes any small-preview blob before actually closing, so the modal
  // never leaks an object URL when the whole session ends.
  function handleCloseSelector() {
    if (inlinePreview?.url) URL.revokeObjectURL(inlinePreview.url)
    onClose()
  }

  function buildExportPayload() {
    const exportAthletes = regAthletes
      .filter(a => athleteSection.selectedIds.has(a.id))
      .map(a => ({ ...a, ...(athleteSection.overrides[a.id] || {}) }))

    // Officials: rebuild officialsByRole from only the SELECTED rows
    // (preserving role grouping/order). PDF-only overrides are attached
    // directly onto each assignment row (as _overrideName/_overrideNameAr/
    // _overrideDesignation) rather than collapsed by employee_id — the
    // same employee can hold two different roles in the same event
    // (e.g. Team Leader AND Guest), each its own event_officials row,
    // and editing one assignment's PDF display must never leak into the
    // other. event_officials.id (rowId) stays the unique identity for
    // every override the whole way into PDF generation.
    const selectedRowIds = officialSection.selectedIds
    const withOverrides = o => {
      const ov = officialSection.overrides[o.id]
      if (!ov) return o
      const row = { ...o }
      if ('name' in ov) { row._overrideName = ov.name; row._overrideNameAr = ov.name }
      if ('designation' in ov) row._overrideDesignation = ov.designation
      // Custom role is PDF-only display text, never a real group to
      // move the assignment into — it stays in its original role
      // group/position, only the Role column text changes.
      if (ov.role === '__custom__') row._overrideRoleText = ov.customRole || ''
      return row
    }

    const exportOfficialsByRole = {}
    for (const [role, list] of Object.entries(officialsByRole || {})) {
      exportOfficialsByRole[role] = list
        .filter(o => selectedRowIds.has(o.id))
        // A role override moves only THIS assignment row into a
        // different CANONICAL role group for the PDF — Custom never
        // moves groups (handled above), and other rows for the same
        // employee, or other rows in this same role, are untouched.
        .filter(o => !(officialSection.overrides[o.id]?.role && officialSection.overrides[o.id].role !== role && officialSection.overrides[o.id].role !== '__custom__'))
        .map(withOverrides)
    }
    for (const [role, list] of Object.entries(officialsByRole || {})) {
      for (const o of list) {
        const newRole = officialSection.overrides[o.id]?.role
        if (newRole && newRole !== '__custom__' && newRole !== role && selectedRowIds.has(o.id)) {
          exportOfficialsByRole[newRole] = [...(exportOfficialsByRole[newRole] || []), withOverrides(o)]
        }
      }
    }

    const includeOfficials = officialSection.selectedIds.size > 0
    return {
      athletes: exportAthletes,
      includeOfficials,
      officialsByRole: exportOfficialsByRole,
      // employees passed through UNCHANGED — real employee records are
      // never touched by PDF-only overrides; the PDF generator reads
      // each row's own _override* fields first when present.
      employees,
    }
  }

  // Stage 1: small in-modal preview, built fresh from whatever the
  // current temporary state is right now.
  async function handlePreviewClick() {
    setExporting(true)
    try {
      const preview = await onGeneratePreview(buildExportPayload())
      if (preview) {
        if (inlinePreview?.url) URL.revokeObjectURL(inlinePreview.url)
        setInlinePreview(preview)
      }
    } catch (err) {
      console.error('Event PDF export failed', err)
    } finally {
      setExporting(false)
    }
  }
  // Closes ONLY the small preview — every piece of selection/override/
  // search state in both tabs is completely untouched.
  function handleContinueEditing() {
    if (inlinePreview?.url) URL.revokeObjectURL(inlinePreview.url)
    setInlinePreview(null)
  }
  // Commits to the final stage: hands the SAME already-generated blob to
  // the parent's full-screen preview — never regenerated.
  function handleExportFinal() {
    if (!inlinePreview) return
    onExportFinal(inlinePreview)
    setInlinePreview(null)
  }

  // Stage 1 preview — rendered in place of the normal editing UI while
  // staying the SAME mounted component instance, so "Continue Editing"
  // never resets either tab's selection/overrides/search.
  if (inlinePreview) {
    return (
      <div className="modal-overlay" onClick={handleCloseSelector}>
        <div className="modal-box" style={{ width: 760, display: 'flex', flexDirection: 'column', maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{L('PDF Preview', 'معاينة PDF')}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              {L('Changes here affect this PDF only and are not saved to the database.', 'التعديلات هنا خاصة بملف PDF فقط ولن يتم حفظها في قاعدة البيانات.')}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: '14px 22px', display: 'flex', justifyContent: 'center' }}>
            <iframe src={inlinePreview.url} title="Event PDF inline preview"
              style={{ width: '100%', maxWidth: 640, height: '100%', border: '1px solid var(--border)', borderRadius: 8, background: '#525659' }} />
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
            <button className="btn-cancel" onClick={handleContinueEditing}>{L('Continue Editing', 'متابعة التعديل')}</button>
            <button className="btn btn-blue" onClick={handleExportFinal}>
              <i className="ti ti-file-export" /> {L('Export PDF', 'تصدير PDF')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={handleCloseSelector}>
      <div className="modal-box" style={{ width: 760, display: 'flex', flexDirection: 'column', maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 22px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{L('Select Event Data to Export', 'اختر بيانات الفعالية للتصدير')}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
            {L('Changes here affect this PDF only and are not saved to the database.', 'التعديلات هنا خاصة بملف PDF فقط ولن يتم حفظها في قاعدة البيانات.')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{ar ? ev.name_ar || ev.name : ev.name}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" onClick={() => setTab('athletes')}
              style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', borderBottom: tab === 'athletes' ? '2px solid #0085C7' : '2px solid transparent', color: tab === 'athletes' ? '#0085C7' : 'var(--text3)', cursor: 'pointer' }}>
              {L('Athletes', 'الرياضيون')} ({athleteSection.selectedIds.size})
            </button>
            <button type="button" onClick={() => setTab('officials')}
              style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', borderBottom: tab === 'officials' ? '2px solid #0085C7' : '2px solid transparent', color: tab === 'officials' ? '#0085C7' : 'var(--text3)', cursor: 'pointer' }}>
              {L('Officials', 'المسؤولون')} ({officialSection.selectedIds.size})
            </button>
          </div>
        </div>

        <div style={{ padding: '12px 22px 0', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: tab === 'athletes' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <SectionSearchBar section={athleteSection} ar={ar} L={L} />
            <SectionToolbar section={athleteSection} ar={ar} L={L} total={regAthletes.length} />
            <SectionEditBar section={athleteSection} ar={ar} L={L} />
            {athleteSection.editField ? (
              <EditPanel section={athleteSection} getId={a => a.id} getName={a => ar && a.name_ar ? a.name_ar : a.name}
                getSecondary={a => sportLabel(a.sport, a.sport_category, ar)} ar={ar} L={L} />
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
                {regAthletes.length === 0 ? (
                  <div className="empty" style={{ padding: '20px 0' }}>{L('No athletes registered', 'لا يوجد رياضيون مسجلون')}</div>
                ) : athleteSection.filtered.length === 0 ? (
                  <div className="empty" style={{ padding: '20px 0' }}>{L('No athletes match your search', 'لا يوجد نتائج مطابقة')}</div>
                ) : athleteSection.filtered.map(a => (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 4px', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={athleteSection.selectedIds.has(a.id)} onChange={() => athleteSection.toggleOne(a.id)} />
                    <Avatar name={a.name} photoUrl={a.photo_url} size={22} />
                    <span>{ar && a.name_ar ? a.name_ar : a.name}</span>
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>· {sportLabel(a.sport, a.sport_category, ar)}</span>
                    {athleteSection.overrideCount(a.id) > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#0085C7', background: '#0085C715', padding: '2px 6px', borderRadius: 10 }}>{L('Edited', 'مُعدَّل')}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: tab === 'officials' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <SectionSearchBar section={officialSection} ar={ar} L={L} />
            <SectionToolbar section={officialSection} ar={ar} L={L} total={flatOfficials.length} />
            <SectionEditBar section={officialSection} ar={ar} L={L} />
            {officialSection.editField ? (
              <EditPanel section={officialSection} getId={o => o.rowId} getName={o => ar && o.name_ar ? o.name_ar : o.name} getSecondary={o => o.roleLabel} ar={ar} L={L} />
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
                {flatOfficials.length === 0 ? (
                  <div className="empty" style={{ padding: '20px 0' }}>{L('No officials assigned', 'لا يوجد مسؤولون معينون')}</div>
                ) : officialSection.filtered.length === 0 ? (
                  <div className="empty" style={{ padding: '20px 0' }}>{L('No officials match your search', 'لا يوجد نتائج مطابقة')}</div>
                ) : officialSection.filtered.map(o => (
                  <label key={o.rowId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 4px', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={officialSection.selectedIds.has(o.rowId)} onChange={() => officialSection.toggleOne(o.rowId)} />
                    <Avatar name={o.name} id={o.employee_id} size={22} fs={10} />
                    <span>{ar && o.name_ar ? o.name_ar : o.name}</span>
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>· {o.roleLabel}{o.designation ? ` · ${o.designation}` : ''}</span>
                    {officialSection.overrideCount(o.rowId) > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#0085C7', background: '#0085C715', padding: '2px 6px', borderRadius: 10 }}>{L('Edited', 'مُعدَّل')}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn-cancel" onClick={handleCloseSelector}>{L('Cancel', 'إلغاء')}</button>
          <button className="btn btn-blue" disabled={exporting} onClick={handlePreviewClick}>
            <i className="ti ti-file-eye" /> {exporting ? L('Preparing preview…', 'جارٍ تجهيز المعاينة…') : L('Preview PDF', 'معاينة PDF')}
          </button>
        </div>
      </div>
    </div>
  )
}
