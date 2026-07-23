import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from './Toast'
import { useLang } from '../lib/LangContext.jsx'

const PRESET_COLORS = [
  '#EE334E','#0085C7','#009F6B','#f59e0b',
  '#8b5cf6','#ec4899','#06b6d4','#64748b',
]
const PRESET_ICONS = [
  'ti-trophy','ti-calendar-event','ti-campfire','ti-run',
  'ti-swimming','ti-barbell','ti-users','ti-star',
  'ti-flag','ti-medal','ti-map-pin','ti-heart',
]

export default function EventCategoryModal({ categories, onClose, onRefresh }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const [editing, setEditing] = useState(null) // null | 'new' | id
  const [form, setForm] = useState({ name: '', name_ar: '', color: '#0085C7', icon: 'ti-calendar-event' })
  const [saving, setSaving] = useState(false)
  const [usageCounts, setUsageCounts] = useState({})

  useEffect(() => {
    supabase.from('events').select('category_id').then(({ data }) => {
      if (!data) return
      const counts = {}
      data.forEach(e => { if (e.category_id) counts[e.category_id] = (counts[e.category_id] || 0) + 1 })
      setUsageCounts(counts)
    })
  }, [categories])

  function startEdit(cat) {
    setEditing(cat.id)
    setForm({ name: cat.name, name_ar: cat.name_ar || '', color: cat.color, icon: cat.icon })
  }

  function startNew() {
    setEditing('new')
    setForm({ name: '', name_ar: '', color: '#0085C7', icon: 'ti-calendar-event' })
  }

  async function handleSave() {
    if (!form.name.trim()) { toast(ar ? 'الاسم مطلوب' : 'Name is required', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        name_ar: form.name_ar.trim() || null,
        color: form.color,
        icon: form.icon,
      }
      const { error } = editing === 'new'
        ? await supabase.from('event_categories').insert(payload)
        : await supabase.from('event_categories').update(payload).eq('id', editing)
      if (error) { toast(error.message, 'error'); return }
      toast(editing === 'new'
        ? (ar ? 'تم إضافة التصنيف' : 'Category created')
        : (ar ? 'تم تحديث التصنيف' : 'Category updated')
      )
      setEditing(null)
      await onRefresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(cat) {
    const inUse = usageCounts[cat.id] > 0
    if (cat.is_active && inUse) {
      // Category is in use — deactivate (hide from new event form) but don't block
    }
    const { error } = await supabase.from('event_categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    if (error) { toast(error.message, 'error'); return }
    toast(cat.is_active
      ? (ar ? 'تم تعطيل التصنيف' : 'Category deactivated')
      : (ar ? 'تم تفعيل التصنيف' : 'Category activated')
    )
    await onRefresh()
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title">{ar ? 'إدارة التصنيفات' : 'Manage Categories'}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div className="modal-body" style={{ paddingBottom: 8 }}>
          {/* Category list */}
          {categories.length === 0 && (
            <div className="empty" style={{ padding: 20 }}>{ar ? 'لا توجد تصنيفات بعد' : 'No categories yet'}</div>
          )}
          {categories.map(cat => (
            <div key={cat.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:14, height:14, borderRadius:'50%', background:cat.color, flexShrink:0 }} />
              <i className={`ti ${cat.icon}`} style={{ color:cat.color, fontSize:16, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, color: cat.is_active ? 'var(--text)' : 'var(--text3)' }}>{cat.name}</div>
                {cat.name_ar && <div style={{ fontSize:11, color:'var(--text3)' }}>{cat.name_ar}</div>}
                {usageCounts[cat.id] > 0 && (
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>
                    {usageCounts[cat.id]} {ar ? 'فعالية' : 'event(s)'}
                  </div>
                )}
              </div>
              {!cat.is_active && (
                <span style={{ fontSize:10, background:'var(--surface2)', color:'var(--text3)', borderRadius:4, padding:'2px 6px', flexShrink:0 }}>
                  {ar ? 'معطل' : 'Inactive'}
                </span>
              )}
              <button
                onClick={() => { if (editing === cat.id) setEditing(null); else startEdit(cat) }}
                style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer', color:'var(--text2)', flexShrink:0 }}>
                <i className={`ti ${editing === cat.id ? 'ti-x' : 'ti-pencil'}`} />
              </button>
              <button
                onClick={() => handleToggle(cat)}
                style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer', color: cat.is_active ? '#dc2626' : '#009F6B', flexShrink:0 }}>
                {cat.is_active ? (ar ? 'تعطيل' : 'Deactivate') : (ar ? 'تفعيل' : 'Activate')}
              </button>

              {/* Inline edit form for this category */}
              {editing === cat.id && (
                <div style={{ width:'100%', marginTop:4, padding:12, background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)' }}>
                  {/* reuse form UI below — rendered via the shared form block */}
                </div>
              )}
            </div>
          ))}

          {/* Shared create/edit form */}
          {editing !== null && (
            <div style={{ marginTop:16, padding:14, background:'var(--surface2)', borderRadius:10, border:'1px solid var(--border)' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:10, textTransform:'uppercase', letterSpacing:'.05em' }}>
                {editing === 'new' ? (ar ? 'تصنيف جديد' : 'New category') : (ar ? 'تعديل التصنيف' : 'Edit category')}
              </div>
              <div className="form-row" style={{ marginBottom:10 }}>
                <div className="form-group" style={{ flex:1 }}>
                  <label className="form-label">{ar ? 'الاسم (إنجليزي)' : 'Name (English)'}<span style={{ color:'#dc2626' }}> *</span></label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Competitions" />
                </div>
                <div className="form-group" style={{ flex:1 }}>
                  <label className="form-label">{ar ? 'الاسم (عربي)' : 'Name (Arabic)'}</label>
                  <input className="form-input" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} placeholder="مثال: المنافسات" dir="rtl" />
                </div>
              </div>
              <div style={{ marginBottom:12 }}>
                <label className="form-label" style={{ marginBottom:6, display:'block' }}>{ar ? 'اللون' : 'Color'}</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  {PRESET_COLORS.map(c => (
                    <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width:24, height:24, borderRadius:'50%', background:c, cursor:'pointer', border: form.color === c ? '3px solid var(--text)' : '2px solid transparent', boxSizing:'border-box', transition:'border .1s' }} />
                  ))}
                  <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ width:28, height:28, border:'1px solid var(--border)', borderRadius:4, cursor:'pointer', padding:1, background:'var(--surface)' }} title="Custom color" />
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label className="form-label" style={{ marginBottom:6, display:'block' }}>{ar ? 'الأيقونة' : 'Icon'}</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {PRESET_ICONS.map(ic => (
                    <div key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))} style={{ width:34, height:34, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background: form.icon === ic ? form.color + '25' : 'var(--surface)', border: form.icon === ic ? `2px solid ${form.color}` : '1px solid var(--border)', transition:'all .1s' }}>
                      <i className={`ti ${ic}`} style={{ fontSize:16, color: form.icon === ic ? form.color : 'var(--text2)' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setEditing(null)} style={{ flex:1, padding:'8px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', fontSize:13, color:'var(--text2)', fontFamily:'DM Sans, sans-serif' }}>
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
                <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:'8px', background:'#0085C7', color:'#fff', border:'none', borderRadius:8, cursor: saving ? 'default' : 'pointer', fontSize:13, fontFamily:'DM Sans, sans-serif', opacity: saving ? .7 : 1 }}>
                  {saving ? '…' : (ar ? 'حفظ' : 'Save')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {editing === null && (
            <button className="btn" style={{ background:'#0085C7' }} onClick={startNew}>
              <i className="ti ti-plus" /> {ar ? 'تصنيف جديد' : 'New category'}
            </button>
          )}
          <button className="btn-cancel" onClick={onClose}>{ar ? 'إغلاق' : 'Close'}</button>
        </div>
      </div>
    </div>
  )
}
