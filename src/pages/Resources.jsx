import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast, ConfirmModal } from '../components/Toast'
import { canEdit } from '../lib/useAuth'

// Icon/color per file type, by extension — mirrors the pattern used for person
// documents elsewhere in the app, just keyed by file extension instead of a
// fixed document-type list, since resources can be any kind of file.
const TYPE_ICON = {
  pdf:  { icon: 'ti-file-text',      color: '#EE334E' },
  doc:  { icon: 'ti-file-text',      color: '#0085C7' },
  docx: { icon: 'ti-file-text',      color: '#0085C7' },
  xls:  { icon: 'ti-file-spreadsheet', color: '#009F6B' },
  xlsx: { icon: 'ti-file-spreadsheet', color: '#009F6B' },
  ppt:  { icon: 'ti-presentation',   color: '#e67e22' },
  pptx: { icon: 'ti-presentation',   color: '#e67e22' },
  jpg:  { icon: 'ti-photo',          color: '#8b5cf6' },
  jpeg: { icon: 'ti-photo',          color: '#8b5cf6' },
  png:  { icon: 'ti-photo',          color: '#8b5cf6' },
  zip:  { icon: 'ti-file-zip',       color: '#9aa3b2' },
}
const DEFAULT_TYPE = { icon: 'ti-file', color: '#9aa3b2' }

function fileMeta(name) {
  const ext = (name || '').split('.').pop().toLowerCase()
  return TYPE_ICON[ext] || DEFAULT_TYPE
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/(1024*1024)).toFixed(1)} MB`
}

async function downloadResource(url, fileName) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileName || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  } catch { window.open(url, '_blank') }
}

export default function Resources({ profile, onRefresh }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'
  const isAdmin = canEdit(profile)

  const [resources, setResources]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [showUpload, setShowUpload] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [uploading, setUploading]   = useState(false)

  const [form, setForm] = useState({ title: '', titleAr: '', description: '', descriptionAr: '', category: 'General', visibleTo: ['admin','coach','athlete','employee'] })
  const fileInput = useRef(null)
  const [pendingFile, setPendingFile] = useState(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('resources').select('*').order('created_at', { ascending: false })
    if (error) { toast(error.message, 'error'); setLoading(false); return }
    setResources(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const categories = ['All', ...new Set(resources.map(r => r.category).filter(Boolean))]

  const visible = resources.filter(r => {
    const matchesSearch = !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.title_ar||'').includes(search) ||
      (r.description||'').toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'All' || r.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  function resetForm() {
    setForm({ title: '', titleAr: '', description: '', descriptionAr: '', category: 'General', visibleTo: ['admin','coach','athlete','employee'] })
    setPendingFile(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function handleSubmit() {
    if (!form.title.trim()) { toast(ar ? 'العنوان مطلوب' : 'Title is required', 'error'); return }
    if (!pendingFile) { toast(ar ? 'يرجى اختيار ملف' : 'Please choose a file', 'error'); return }
    if (pendingFile.size > 25 * 1024 * 1024) { toast(ar ? 'يجب أن يكون الملف أقل من 25 ميجابايت' : 'File must be under 25MB', 'error'); return }

    setUploading(true)
    try {
      const ext  = pendingFile.name.split('.').pop()
      const path = `${Date.now()}_${pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('resources').upload(path, pendingFile)
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('resources').getPublicUrl(path)

      const { error: dbErr } = await supabase.from('resources').insert({
        title: form.title.trim(),
        title_ar: form.titleAr.trim() || null,
        description: form.description.trim() || null,
        description_ar: form.descriptionAr.trim() || null,
        category: form.category.trim() || 'General',
        resource_type: 'file',
        file_url: urlData.publicUrl,
        file_name: pendingFile.name,
        file_size: pendingFile.size,
        file_type: ext,
        visible_to: form.visibleTo,
        uploaded_by: profile?.id || null,
      })
      if (dbErr) throw dbErr

      toast(ar ? 'تم رفع الملف بنجاح' : 'Resource uploaded')
      setShowUpload(false)
      resetForm()
      await load()
    } catch (err) {
      toast(err.message || (ar ? 'فشل الرفع' : 'Upload failed'), 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(resource) {
    try {
      // Storage path is the part of the public URL after the bucket name — best
      // effort cleanup, the DB row is what actually controls visibility either way.
      const marker = '/resources/'
      const idx = resource.file_url?.indexOf(marker)
      if (idx !== -1 && idx !== undefined) {
        const path = resource.file_url.slice(idx + marker.length)
        const { error: storageErr } = await supabase.storage.from('resources').remove([path])
        if (storageErr) console.warn('Storage delete error:', storageErr.message)
      }
      const { error } = await supabase.from('resources').delete().eq('id', resource.id)
      if (error) throw error
      toast(ar ? 'تم حذف الملف' : 'Resource deleted')
      setConfirmDel(null)
      await load()
    } catch (err) {
      toast(err.message || (ar ? 'فشل الحذف' : 'Delete failed'), 'error')
    }
  }

  const ROLE_LABELS = {
    admin:    ar ? 'المسؤولون' : 'Admins',
    coach:    ar ? 'المدربون' : 'Coaches',
    athlete:  ar ? 'الرياضيون' : 'Athletes',
    employee: ar ? 'الموظفون' : 'Employees',
  }

  return (
    <div>
      {confirmDel && (
        <ConfirmModal
          title={ar ? 'حذف الملف' : 'Delete resource'}
          message={`${ar ? 'حذف' : 'Delete'} "${confirmDel.title}"?`}
          onConfirm={() => handleDelete(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}

      {showUpload && (
        <div className="modal-overlay" onClick={() => { setShowUpload(false); resetForm() }}>
          <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{ar ? 'إضافة ملف' : 'Add Resource'}</div>
              <button className="modal-close" onClick={() => { setShowUpload(false); resetForm() }}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{ar ? 'العنوان' : 'Title'} *</label>
                <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={ar ? 'مثال: نموذج طلب إجازة' : 'e.g. Leave Request Form'} />
              </div>
              <div className="form-group">
                <label>{ar ? 'العنوان (عربي)' : 'Title (Arabic)'}</label>
                <input className="form-input" value={form.titleAr} onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))} dir="rtl" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{ar ? 'الوصف' : 'Description'}</label>
                  <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{ar ? 'الفئة' : 'Category'}</label>
                  <input className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder={ar ? 'مثال: الموارد البشرية' : 'e.g. HR'} list="category-suggestions" />
                  <datalist id="category-suggestions">
                    {categories.filter(c => c !== 'All').map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>
              <div className="form-group">
                <label>{ar ? 'يمكن لمن رؤية هذا الملف' : 'Visible to'}</label>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {Object.keys(ROLE_LABELS).map(role => (
                    <label key={role} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.visibleTo.includes(role)}
                        onChange={e => setForm(f => ({
                          ...f,
                          visibleTo: e.target.checked ? [...f.visibleTo, role] : f.visibleTo.filter(r => r !== role)
                        }))}
                      />
                      {ROLE_LABELS[role]}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>{ar ? 'الملف' : 'File'} *</label>
                <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
                  onChange={e => setPendingFile(e.target.files?.[0] || null)} />
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{ar ? 'الحد الأقصى 25 ميجابايت' : 'Max 25MB'}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => { setShowUpload(false); resetForm() }}>{tx('actions.cancel','Cancel')}</button>
              <button className="btn btn-blue" onClick={handleSubmit} disabled={uploading}>
                {uploading ? (ar ? 'جارٍ الرفع...' : 'Uploading...') : (ar ? 'رفع' : 'Upload')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">{tx('nav.resources','Resources')}</div>
          <div className="page-sub">{ar ? 'النماذج والمستندات' : 'Forms and documents'}</div>
        </div>
        {isAdmin && (
          <button className="btn btn-blue" onClick={() => setShowUpload(true)}>
            <i className="ti ti-upload" /> {ar ? 'إضافة ملف' : 'Add Resource'}
          </button>
        )}
      </div>

      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder={ar ? 'بحث في الملفات...' : 'Search resources…'} value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="filter" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          {categories.map(c => <option key={c} value={c}>{c === 'All' ? (ar ? 'جميع الفئات' : 'All categories') : c}</option>)}
        </select>
      </div>

      {loading && <div className="empty" style={{ padding:24 }}>{ar ? 'جارٍ التحميل...' : 'Loading…'}</div>}

      {!loading && visible.length === 0 && (
        <div className="empty" style={{ padding:32, textAlign:'center' }}>
          <i className="ti ti-folder" style={{ fontSize:32, color:'var(--text3)', marginBottom:8, display:'block' }} />
          {resources.length === 0
            ? (ar ? 'لا توجد ملفات بعد' : 'No resources yet')
            : (ar ? 'لا توجد ملفات مطابقة' : 'No resources match your search')}
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div style={{ display:'grid', gap:12 }}>
          {visible.map(r => {
            const meta = fileMeta(r.file_name)
            return (
              <div key={r.id} className="info-card" style={{ display:'flex', alignItems:'center', gap:14, padding:16 }}>
                <div style={{ width:44, height:44, borderRadius:10, background:meta.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <i className={`ti ${meta.icon}`} style={{ fontSize:22, color:meta.color }} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>{ar && r.title_ar ? r.title_ar : r.title}</div>
                  {(r.description || r.description_ar) && (
                    <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>{ar && r.description_ar ? r.description_ar : r.description}</div>
                  )}
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:4, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    <span className="badge badge-gray">{r.category}</span>
                    <span>{r.file_name}</span>
                    {r.file_size && <span>· {formatSize(r.file_size)}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button
                    onClick={() => downloadResource(r.file_url, r.file_name)}
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text2)', cursor:'pointer', fontSize:14 }}
                    title={ar ? 'تحميل' : 'Download'}>
                    <i className="ti ti-download" />
                  </button>
                  {isAdmin && (
                    <button onClick={() => setConfirmDel(r)}
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626', cursor:'pointer' }}
                      title={ar ? 'حذف' : 'Delete'}>
                      <i className="ti ti-trash" style={{ fontSize:14 }} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
