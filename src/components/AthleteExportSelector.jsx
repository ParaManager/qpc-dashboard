import { useState, useMemo } from 'react'
import { Avatar, sportLabel, targetCategoryLabel, TARGET_CATEGORY_OPTIONS } from '../lib/helpers'
import { buildAthleteFieldDefs, STATUS_OPTIONS, GENDER_OPTIONS } from '../lib/athleteFieldResolvers'

// Splits pasted multi-value input on newlines/commas/semicolons, trims,
// drops blanks. A single resulting value just falls through to normal
// substring search by the caller.
function parseMultiValues(raw) {
  return raw.split(/[\n,;]+/).map(v => v.trim()).filter(Boolean)
}

// allCols: the SAME ALL_COLS array the Athletes page's Columns menu uses
// (key + already-translated label) — this is the canonical column source;
// per-field value/search/edit behavior comes from athleteFieldResolvers,
// keyed to match ALL_COLS exactly, so Search-by/Edit-for-PDF can never
// offer a smaller or disconnected field list than the Columns menu does.
// visibleColKeys: the athlete page's CURRENT selected-column keys — used
// only to default which fields are offered by default; "Show all
// available fields" switches to every resolver-backed column regardless.
export default function AthleteExportSelector({
  allAthletes, allCols = [], visibleColKeys = [], coaches = [], sportsList = [], initialSelectedIds, ar, tx,
  title, exportLabelPrefix, onGeneratePreview, onExportFinal, onClose,
}) {
  const allFieldDefs = useMemo(() => buildAthleteFieldDefs(allCols, { coaches, sportsList, ar }), [allCols, coaches, sportsList, ar])
  const [showAllFields, setShowAllFields] = useState(false)
  const fieldDefs = useMemo(() => {
    if (showAllFields || !visibleColKeys?.length) return allFieldDefs
    const visibleSet = new Set(visibleColKeys)
    const scoped = allFieldDefs.filter(f => visibleSet.has(f.key))
    return scoped.length ? scoped : allFieldDefs
  }, [allFieldDefs, showAllFields, visibleColKeys])

  const fieldByKey = useMemo(() => Object.fromEntries(fieldDefs.map(f => [f.key, f])), [fieldDefs])
  const searchFields = useMemo(() => [{ key: 'all', label: ar ? 'كل الحقول' : 'All fields' }, ...fieldDefs.filter(f => f.searchable)], [fieldDefs, ar])
  const editFields = useMemo(() => fieldDefs.filter(f => f.editableForExport), [fieldDefs])
  const ctx = useMemo(() => ({ coaches, sportsList, ar }), [coaches, sportsList, ar])

  const [selectedIds, setSelectedIds] = useState(() => new Set(initialSelectedIds || []))
  const [search, setSearch] = useState('')
  const [searchField, setSearchField] = useState('all')
  const [editField, setEditField] = useState('') // '' = Edit-by panel closed
  // { [athleteId]: { [column]: value } } -- PDF-only, never written to
  // Supabase, discarded entirely on close/cancel.
  const [exportOverrides, setExportOverrides] = useState({})
  const [exporting, setExporting] = useState(false)
  const [inlinePreview, setInlinePreview] = useState(null) // { url, blob, filename } — small in-modal preview stage
  const L = (en, arTx) => ar ? arTx : en

  // Reset the active search/edit field if it's no longer offered after
  // switching the visible/all-fields scope.
  if (searchField !== 'all' && !fieldByKey[searchField]) { setSearchField('all') }
  if (editField && !fieldByKey[editField]) { setEditField('') }

  function allFieldsText(a) {
    return fieldDefs.filter(f => f.searchable).map(f => f.getText(a, ctx)).join(' ').toLowerCase()
  }

  const searchPlaceholder = useMemo(() => {
    if (searchField === 'all') return L('Search athletes…', 'ابحث عن الرياضيين…')
    if (searchField === 'id_number') return L('Search by Qatar ID… (paste multiple IDs supported)', 'ابحث بالرقم الشخصي… (يمكن لصق عدة أرقام)')
    const f = fieldByKey[searchField]
    return f ? L(`Search by ${f.label}…`, `ابحث حسب ${f.label}…`) : L('Search…', 'بحث…')
  }, [searchField, fieldByKey, ar])

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
    if (!def) return allAthletes
    return allAthletes.filter(a => def.getText(a, ctx).toLowerCase().includes(q))
  }, [search, searchField, allAthletes, fieldByKey, ctx])

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
  const selectedAthletesForEdit = useMemo(() => allAthletes.filter(a => selectedIds.has(a.id)), [allAthletes, selectedIds])

  function setOverrideValue(athleteId, field, rawValue) {
    setExportOverrides(prev => ({
      ...prev,
      [athleteId]: { ...prev[athleteId], ...field.applyOverride(rawValue, ctx) },
    }))
  }
  function resetOneValue(athleteId, field) {
    setExportOverrides(prev => {
      const current = { ...(prev[athleteId] || {}) }
      Object.keys(field.applyOverride(field.type === 'select-sport' ? null : '', ctx)).forEach(k => delete current[k])
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

  // Stage 1: small in-modal preview. Builds fresh from whatever the
  // current temporary state is right now; never touches Supabase.
  async function handlePreviewClick() {
    if (selectedIds.size === 0) return
    setExporting(true)
    try {
      const exportRows = allAthletes
        .filter(a => selectedIds.has(a.id))
        .map(a => ({ ...a, ...(exportOverrides[a.id] || {}) }))
      const preview = await onGeneratePreview(exportRows)
      if (preview) {
        // Revoke any previous small-preview blob before replacing it —
        // e.g. Preview -> Continue Editing -> change something -> Preview
        // again must not leak the earlier blob URL.
        if (inlinePreview?.url) URL.revokeObjectURL(inlinePreview.url)
        setInlinePreview(preview)
      }
    } finally {
      setExporting(false)
    }
  }
  // Closes ONLY the small preview — every piece of selection/override/
  // search state above is completely untouched, so the person returns to
  // exactly where they left off.
  function handleContinueEditing() {
    if (inlinePreview?.url) URL.revokeObjectURL(inlinePreview.url)
    setInlinePreview(null)
  }
  // Commits to the final stage: hands the SAME already-generated blob to
  // the parent's full-screen preview — never regenerated, so small
  // preview === final preview === downloaded PDF.
  function handleExportFinal() {
    if (!inlinePreview) return
    onExportFinal(inlinePreview)
    setInlinePreview(null)
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
    if (field.type === 'select-gender') {
      return (
        <select className="form-input" style={{ fontSize: 12.5 }} value={value} onChange={e => setOverrideValue(a.id, field, e.target.value)}>
          <option value="">{L('— None —', '— بدون —')}</option>
          {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
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

  // Revokes any small-preview blob before actually closing, so the
  // modal never leaks an object URL when the whole session ends.
  function handleCloseSelector() {
    if (inlinePreview?.url) URL.revokeObjectURL(inlinePreview.url)
    onClose()
  }

  // Stage 1 preview — rendered in place of the normal editing UI while
  // staying the SAME mounted component instance, so switching back via
  // "Continue Editing" never resets selection/overrides/search (that only
  // happens if the parent unmounts this component entirely, which it
  // doesn't do here).
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
            <iframe src={inlinePreview.url} title="Athletes PDF inline preview"
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
        {/* Sticky header + search -- stays visible while the list below scrolls, important with 190+ athletes. */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{title || L('Select Athletes to Export', 'اختر الرياضيين للتصدير')}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              {L('Changes here affect this PDF only and are not saved to the database.', 'التعديلات هنا خاصة بملف PDF فقط ولن يتم حفظها في قاعدة البيانات.')}
            </div>
            {visibleColKeys?.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text3)', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={showAllFields} onChange={e => setShowAllFields(e.target.checked)} />
                {L('Show all available fields (not just currently visible columns)', 'إظهار كل الحقول المتاحة (وليس فقط الأعمدة الظاهرة حالياً)')}
              </label>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="form-input" style={{ flex: '1 1 220px', minWidth: 0 }}
            />
            <select value={searchField} onChange={e => setSearchField(e.target.value)} className="form-input" style={{ flex: '0 0 190px' }}>
              {searchFields.map(f => <option key={f.key} value={f.key}>{L('Search by: ', 'البحث حسب: ') + f.label}</option>)}
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
            <select value={editField} onChange={e => setEditField(e.target.value)} className="form-input" style={{ flex: '0 0 220px' }}>
              <option value="">{L('Edit for PDF (optional)…', 'تعديل للتصدير (اختياري)…')}</option>
              {editFields.map(f => <option key={f.key} value={f.key}>{L('Edit by: ', 'تعديل حسب: ') + f.label}</option>)}
            </select>
            {Object.keys(exportOverrides).length > 0 && (
              <button type="button" className="btn-cancel" style={{ padding: '4px 10px', fontSize: 12, color: '#EE334E' }} onClick={resetAllOverrides}>
                {L('Reset all PDF edits', 'إعادة تعيين كل تعديلات PDF')} ({Object.keys(exportOverrides).length})
              </button>
            )}
          </div>
        </div>

        {activeEditField ? (
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
                  {L('Original: ', 'الأصلي: ')}{activeEditField.getDisplay(a, ctx) || '—'}
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
          <button className="btn-cancel" onClick={handleCloseSelector}>{L('Cancel', 'إلغاء')}</button>
          <button className="btn btn-blue" disabled={selectedIds.size === 0 || exporting} onClick={handlePreviewClick}>
            <i className="ti ti-file-eye" /> {exporting ? L('Preparing preview…', 'جارٍ تجهيز المعاينة…') : L('Preview PDF', 'معاينة PDF')}
          </button>
        </div>
      </div>
    </div>
  )
}
