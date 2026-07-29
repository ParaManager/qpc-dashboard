import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Shared Designation dropdown used by both the Employee and Coach forms.
// The option list is built dynamically — never hardcoded:
//   1. every distinct designation currently present on `employees`
//   2. any designation already saved in employee_designations (so a
//      designation added once stays available even before anyone uses it)
//   3. the record's own current designation, so editing never loses/hides
//      it even if it's an orphaned/rare value not present in 1 or 2
// De-duplicated case/whitespace-insensitively so spacing or case
// differences never produce duplicate options.
export default function DesignationField({ employees = [], customDesignations = [], onDesignationAdded, value, valueAr, onSelect, ar }) {
  const [showNewDesig, setShowNewDesig] = useState(false)
  const [newDesigEn, setNewDesigEn] = useState('')
  const [newDesigAr, setNewDesigAr] = useState('')
  const [newDesigErr, setNewDesigErr] = useState('')
  const [savingDesig, setSavingDesig] = useState(false)

  const allDesignations = (() => {
    const seen = new Map()
    function add(label, labelAr) {
      const clean = (label || '').trim()
      const key = clean.toLowerCase()
      if (!key) return
      const cleanAr = (labelAr || '').trim()
      const existing = seen.get(key)
      // Prefer whichever version actually has an Arabic label filled in,
      // so one blank-Arabic import row doesn't blank out the option for
      // everyone else who used the same English designation.
      if (!existing || (!existing.label_ar && cleanAr)) {
        seen.set(key, { label: clean, label_ar: cleanAr })
      }
    }
    employees.forEach(e => add(e.designation, e.designation_ar))
    customDesignations.forEach(d => add(d.label, d.label_ar))
    add(value, valueAr)
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label))
  })()

  async function handleAddDesignation() {
    const label = newDesigEn.trim()
    const labelAr = newDesigAr.trim()
    if (!label) { setNewDesigErr(ar ? 'الرجاء إدخال المسمى الوظيفي' : 'Please enter a designation'); return }
    const dupe = allDesignations.some(d => d.label.trim().toLowerCase() === label.toLowerCase())
    if (dupe) { setNewDesigErr(ar ? 'هذا المسمى موجود بالفعل' : 'This designation already exists'); return }
    setSavingDesig(true)
    setNewDesigErr('')
    const { data: inserted, error } = await supabase.from('employee_designations')
      .insert({ label, label_ar: labelAr || null })
      .select('label, label_ar')
      .single()
    setSavingDesig(false)
    if (error) {
      setNewDesigErr(ar ? 'تعذر حفظ المسمى الوظيفي (قد يكون مكررًا)' : 'Could not save designation (it may already exist)')
      return
    }
    onDesignationAdded?.(inserted)
    onSelect(inserted.label, inserted.label_ar || '')
    setShowNewDesig(false)
    setNewDesigEn(''); setNewDesigAr('')
  }

  const cleanValue = (value || '').trim()

  return (
    <>
      <select className="form-input" value={showNewDesig ? '__add_new__' : cleanValue} onChange={e => {
        if (e.target.value === '__add_new__') { setShowNewDesig(true); return }
        setShowNewDesig(false)
        const chosen = allDesignations.find(d => d.label === e.target.value)
        onSelect(e.target.value, chosen?.label_ar || '')
      }}>
        <option value="">{''}</option>
        {allDesignations.map(d => <option key={d.label} value={d.label}>{ar ? (d.label_ar || '—') : d.label}</option>)}
        <option value="__add_new__">{ar ? '+ إضافة مسمى وظيفي جديد' : '+ Add New Designation'}</option>
      </select>
      {showNewDesig && (
        <div style={{ marginTop: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface2)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input className="form-input" placeholder={ar?'المسمى الجديد (إنجليزي)':'New designation (English)'} value={newDesigEn} onChange={e => setNewDesigEn(e.target.value)} />
            <input className="form-input" placeholder={ar?'المسمى الجديد (عربي)':'New designation (Arabic)'} value={newDesigAr} onChange={e => setNewDesigAr(e.target.value)} dir="rtl" />
          </div>
          {newDesigErr && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{newDesigErr}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-cancel" onClick={() => { setShowNewDesig(false); setNewDesigEn(''); setNewDesigAr(''); setNewDesigErr('') }}>{ar?'إلغاء':'Cancel'}</button>
            <button type="button" className="btn" style={{ background:'#0085C7' }} disabled={savingDesig} onClick={handleAddDesignation}>{savingDesig ? (ar?'جارٍ الحفظ...':'Saving...') : (ar?'حفظ':'Save')}</button>
          </div>
        </div>
      )}
    </>
  )
}
