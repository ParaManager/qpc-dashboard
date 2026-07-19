import { useState, useRef, useEffect } from 'react'
import { useNationalities } from '../lib/useNationalities'

// Dropdown for the Nationality field on every create/edit form. Backed
// entirely by the shared nationalities table (useNationalities) — typing a
// value with no match offers "Add new nationality", which opens a small
// inline form for English + Arabic name, saves to the central table, and
// immediately selects it. No hardcoded country list anywhere in this file.
export default function NationalitySelect({ value, onChange, lang, placeholder }) {
  const ar = lang === 'ar'
  const { nationalities, addNationality } = useNationalities()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newEn, setNewEn] = useState('')
  const [newAr, setNewAr] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setAddingNew(false) } }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const filtered = search
    ? nationalities.filter(n =>
        n.name_en.toLowerCase().includes(search.toLowerCase()) ||
        (n.name_ar || '').includes(search))
    : nationalities

  const exactMatch = nationalities.some(n =>
    n.name_en.toLowerCase() === search.trim().toLowerCase() ||
    (n.name_ar && n.name_ar === search.trim()))

  const selectedLabel = value
    ? (nationalities.find(n => n.name_en.toLowerCase() === value.toLowerCase())
        ? (ar ? (nationalities.find(n => n.name_en.toLowerCase() === value.toLowerCase())?.name_ar || value) : value)
        : value)
    : ''

  function select(nameEn) {
    onChange(nameEn)
    setOpen(false)
    setSearch('')
  }

  async function handleAddNew() {
    if (!newEn.trim()) { setErr(ar ? 'الاسم بالإنجليزية مطلوب' : 'English name is required'); return }
    setSaving(true)
    setErr('')
    const res = await addNationality(newEn, newAr)
    setSaving(false)
    if (res.error) { setErr(res.error); return }
    select(res.data.name_en)
    setAddingNew(false)
    setNewEn(''); setNewAr('')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => { setOpen(v => !v); setSearch('') }}
        className="form-input"
        style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', color: value ? 'var(--text)' : 'var(--text3)' }}>
        <span>{selectedLabel || placeholder || (ar ? 'اختر الجنسية' : 'Select nationality')}</span>
        <i className="ti ti-chevron-down" style={{ fontSize: 13, color: 'var(--text3)' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 500, top: 'calc(100% + 4px)', left: 0, width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.15)', maxHeight: 320, display: 'flex', flexDirection: 'column' }}>
          {!addingNew ? (
            <>
              <div style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={ar ? 'ابحث...' : 'Search…'}
                  style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: 'var(--surface2)' }} />
              </div>
              <div style={{ overflowY: 'auto', padding: 4 }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text3)' }}>{ar ? 'لا توجد نتائج' : 'No matches'}</div>
                ) : filtered.map(n => (
                  <div key={n.id} onClick={() => select(n.name_en)}
                    style={{ padding: '7px 10px', fontSize: 13, cursor: 'pointer', borderRadius: 6 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    {ar && n.name_ar ? n.name_ar : n.name_en}
                  </div>
                ))}
              </div>
              {search.trim() && !exactMatch && (
                <div style={{ borderTop: '1px solid var(--border)', padding: 6 }}>
                  <button type="button" onClick={() => { setNewEn(search); setAddingNew(true) }}
                    style={{ width: '100%', fontSize: 12.5, padding: '7px 8px', borderRadius: 6, border: '1px dashed #0085C7', background: '#0085C710', color: '#0085C7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                    <i className="ti ti-plus" style={{ fontSize: 13 }} />
                    {ar ? `إضافة "${search}" كجنسية جديدة` : `Add "${search}" as new nationality`}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{ar ? 'إضافة جنسية جديدة' : 'Add new nationality'}</div>
              <input value={newEn} onChange={e => setNewEn(e.target.value)} placeholder={ar ? 'الاسم بالإنجليزية' : 'English name'}
                style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }} />
              <input value={newAr} onChange={e => setNewAr(e.target.value)} placeholder={ar ? 'الاسم بالعربية (اختياري)' : 'Arabic name (optional)'}
                style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }} />
              {err && <div style={{ fontSize: 11, color: '#dc2626' }}>{err}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => { setAddingNew(false); setErr('') }}
                  style={{ flex: 1, fontSize: 12, padding: '6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer' }}>
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="button" onClick={handleAddNew} disabled={saving}
                  style={{ flex: 1, fontSize: 12, padding: '6px', borderRadius: 6, border: 'none', background: '#0085C7', color: '#fff', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ' : 'Save')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
