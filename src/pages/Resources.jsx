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
const LINK_TYPE = { icon: 'ti-link', color: '#0085C7' }

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
  const [showUpload, setShowUpload] = useState(false)
  const [editingResource, setEditingResource] = useState(null) // null = adding new, otherwise the resource being edited
  const [confirmDel, setConfirmDel] = useState(null)
  const [uploading, setUploading]   = useState(false)

  const [form, setForm] = useState({ resourceType: 'file', title: '', titleAr: '', description: '', descriptionAr: '', linkUrl: '', isPrivate: false, visibleTo: ['admin','coach','athlete','employee'] })
  const fileInput = useRef(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('resources').select('*').order('created_at', { ascending: false })
    if (error) { toast(error.message, 'error'); setLoading(false); return }
    setResources(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const visible = resources.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.title.toLowerCase().includes(q) ||
      (r.title_ar||'').toLowerCase().includes(q) ||
      (r.description||'').toLowerCase().includes(q) ||
      (r.description_ar||'').toLowerCase().includes(q)
    )
  })

  function resetForm() {
    setForm({ resourceType: 'file', title: '', titleAr: '', description: '', descriptionAr: '', linkUrl: '', isPrivate: false, visibleTo: ['admin','coach','athlete','employee'] })
    setPendingFile(null)
    setDragOver(false)
    setEditingResource(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  function openEdit(resource) {
    setForm({
      resourceType: resource.resource_type,
      title: resource.title || '',
      titleAr: resource.title_ar || '',
      description: resource.description || '',
      descriptionAr: resource.description_ar || '',
      linkUrl: resource.resource_type === 'link' ? (resource.file_url || '') : '',
      isPrivate: resource.is_private,
      // visible_to is stored empty for private resources, so default back to
      // everyone if they later uncheck "Only Me" — otherwise the role pills
      // would all start unchecked with nothing to fall back to.
      visibleTo: resource.is_private || !resource.visible_to?.length
        ? ['admin','coach','athlete','employee']
        : resource.visible_to,
    })
    setEditingResource(resource)
    setShowUpload(true)
  }

  const ALLOWED_EXT = ['pdf','doc','docx','xls','xlsx','ppt','pptx','jpg','jpeg','png','zip']
  function pickFile(file) {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      toast(ar ? 'نوع الملف غير مدعوم' : 'That file type isn\u2019t supported', 'error')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      toast(ar ? 'يجب أن يكون الملف أقل من 25 ميجابايت' : 'File must be under 25MB', 'error')
      return
    }
    setPendingFile(file)
  }

  function normalizeUrl(url) {
    const trimmed = url.trim()
    if (!trimmed) return ''
    // People often paste a URL without the protocol — assume https rather
    // than rejecting it, since that's almost always what's meant.
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`
    return trimmed
  }

  async function handleSubmit() {
    if (!form.title.trim()) { toast(ar ? 'العنوان مطلوب' : 'Title is required', 'error'); return }
    const isEdit = !!editingResource

    const baseFields = {
      title: form.title.trim(),
      title_ar: form.titleAr.trim() || null,
      description: form.description.trim() || null,
      description_ar: form.descriptionAr.trim() || null,
      is_private: form.isPrivate,
      visible_to: form.isPrivate ? [] : form.visibleTo,
    }

    if (form.resourceType === 'link') {
      const url = normalizeUrl(form.linkUrl)
      if (!url) { toast(ar ? 'يرجى إدخال رابط' : 'Please enter a link', 'error'); return }
      try {
        new URL(url) // throws if genuinely malformed, regardless of the https:// fallback above
      } catch {
        toast(ar ? 'الرابط غير صالح' : 'That link doesn\u2019t look valid', 'error')
        return
      }

      setUploading(true)
      try {
        const payload = {
          ...baseFields,
          resource_type: 'link',
          file_url: url,
          file_name: null,
          file_size: null,
          file_type: null,
        }
        const { error: dbErr } = isEdit
          ? await supabase.from('resources').update(payload).eq('id', editingResource.id)
          : await supabase.from('resources').insert({ ...payload, uploaded_by: profile?.id || null })
        if (dbErr) throw dbErr

        toast(isEdit ? (ar ? 'تم حفظ التغييرات' : 'Changes saved') : (ar ? 'تمت إضافة الرابط بنجاح' : 'Link added'))
        setShowUpload(false)
        resetForm()
        await load()
      } catch (err) {
        toast(err.message || (ar ? 'فشلت العملية' : 'Something went wrong'), 'error')
      } finally {
        setUploading(false)
      }
      return
    }

    // Editing a file resource without picking a new file just updates the
    // metadata — the existing upload stays exactly as it is. A new file was
    // only required for creating one in the first place.
    if (!isEdit && !pendingFile) { toast(ar ? 'يرجى اختيار ملف' : 'Please choose a file', 'error'); return }
    if (pendingFile && pendingFile.size > 25 * 1024 * 1024) { toast(ar ? 'يجب أن يكون الملف أقل من 25 ميجابايت' : 'File must be under 25MB', 'error'); return }

    setUploading(true)
    try {
      let fileFields = {}
      if (pendingFile) {
        const ext  = pendingFile.name.split('.').pop()
        const path = `${Date.now()}_${pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('resources').upload(path, pendingFile)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('resources').getPublicUrl(path)
        fileFields = { file_url: urlData.publicUrl, file_name: pendingFile.name, file_size: pendingFile.size, file_type: ext }

        // Replacing the file on an existing resource — clean up the old
        // upload so it doesn't sit around in storage unused forever.
        if (isEdit && editingResource.file_url) {
          const marker = '/resources/'
          const idx = editingResource.file_url.indexOf(marker)
          if (idx !== -1) {
            const oldPath = editingResource.file_url.slice(idx + marker.length)
            await supabase.storage.from('resources').remove([oldPath]).catch(() => {})
          }
        }
      }

      const payload = { ...baseFields, resource_type: 'file', ...fileFields }
      const { error: dbErr } = isEdit
        ? await supabase.from('resources').update(payload).eq('id', editingResource.id)
        : await supabase.from('resources').insert({ ...payload, uploaded_by: profile?.id || null })
      if (dbErr) throw dbErr

      toast(isEdit ? (ar ? 'تم حفظ التغييرات' : 'Changes saved') : (ar ? 'تم رفع الملف بنجاح' : 'Resource uploaded'))
      setShowUpload(false)
      resetForm()
      await load()
    } catch (err) {
      toast(err.message || (isEdit ? (ar ? 'فشل الحفظ' : 'Failed to save changes') : (ar ? 'فشل الرفع' : 'Upload failed')), 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(resource) {
    try {
      // Storage path is the part of the public URL after the bucket name — best
      // effort cleanup, the DB row is what actually controls visibility either way.
      // Links never had a storage file to begin with, so skip this entirely for them.
      if (resource.resource_type !== 'link') {
        const marker = '/resources/'
        const idx = resource.file_url?.indexOf(marker)
        if (idx !== -1 && idx !== undefined) {
          const path = resource.file_url.slice(idx + marker.length)
          const { error: storageErr } = await supabase.storage.from('resources').remove([path])
          if (storageErr) console.warn('Storage delete error:', storageErr.message)
        }
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
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingResource ? (ar ? 'تعديل المورد' : 'Edit Resource') : (ar ? 'إضافة مورد' : 'Add Resource')}</div>
              <button className="modal-close" onClick={() => { setShowUpload(false); resetForm() }}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">

              {/* Type comes first — it decides whether the rest of the form
                  asks for a file or a URL, so the person picks this before
                  anything else is even relevant. */}
              <div className="form-group">
                <label>{ar ? 'النوع' : 'Type'}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['file', ar ? 'ملف' : 'File', 'ti-file'], ['link', ar ? 'رابط' : 'Link', 'ti-link']].map(([val, lbl, icon]) => {
                    const active = form.resourceType === val
                    return (
                      <button key={val} type="button"
                        onClick={() => setForm(f => ({ ...f, resourceType: val }))}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '9px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${active ? '#0085C7' : 'var(--border)'}`,
                          background: active ? '#0085C715' : 'var(--surface)',
                          color: active ? '#0085C7' : 'var(--text2)',
                        }}>
                        <i className={`ti ${icon}`} style={{ fontSize: 15 }} />
                        {lbl}
                      </button>
                    )
                  })}
                </div>
              </div>

              {form.resourceType === 'link' ? (
                <div className="form-group">
                  <label>{ar ? 'الرابط' : 'Link'} *</label>
                  <input className="form-input" value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
                    placeholder={ar ? 'مثال: https://example.com' : 'e.g. https://example.com'} dir="ltr" style={{ textAlign: ar ? 'right' : 'left' }} />
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    {ar ? 'يفتح في نافذة جديدة عند الضغط عليه.' : 'Opens in a new tab when clicked.'}
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label>{ar ? 'الملف' : 'File'} {!editingResource && '*'}</label>
                  {!pendingFile && editingResource ? (
                    (() => {
                      const meta = fileMeta(editingResource.file_name)
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)' }}>
                          <div style={{ width: 40, height: 40, borderRadius: 9, background: meta.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className={`ti ${meta.icon}`} style={{ fontSize: 19, color: meta.color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editingResource.file_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatSize(editingResource.file_size)} · {ar ? 'الملف الحالي' : 'Current file'}</div>
                          </div>
                          <button onClick={() => fileInput.current?.click()}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0, fontSize: 12, fontWeight: 600 }}>
                            <i className="ti ti-refresh" style={{ fontSize: 13 }} />
                            {ar ? 'استبدال' : 'Replace'}
                          </button>
                          <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
                            onChange={e => pickFile(e.target.files?.[0])} style={{ display: 'none' }} />
                        </div>
                      )
                    })()
                  ) : !pendingFile ? (
                    <div
                      onClick={() => fileInput.current?.click()}
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]) }}
                      style={{
                        border: `2px dashed ${dragOver ? '#0085C7' : 'var(--border2)'}`,
                        borderRadius: 12, padding: '28px 16px', textAlign: 'center', cursor: 'pointer',
                        background: dragOver ? '#0085C710' : 'var(--surface2)', transition: 'all .15s',
                      }}>
                      <i className="ti ti-cloud-upload" style={{ fontSize: 28, color: dragOver ? '#0085C7' : 'var(--text3)', display: 'block', marginBottom: 8 }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {ar ? 'اسحب الملف هنا أو اضغط للاختيار' : 'Drag a file here, or click to browse'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                        {ar ? 'PDF, Word, Excel, PowerPoint, صور — حتى 25 ميجابايت' : 'PDF, Word, Excel, PowerPoint, images — up to 25MB'}
                      </div>
                      <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
                        onChange={e => pickFile(e.target.files?.[0])} style={{ display: 'none' }} />
                    </div>
                  ) : (() => {
                    const meta = fileMeta(pendingFile.name)
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 9, background: meta.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className={`ti ${meta.icon}`} style={{ fontSize: 19, color: meta.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatSize(pendingFile.size)}</div>
                        </div>
                        <button onClick={() => { setPendingFile(null); if (fileInput.current) fileInput.current.value = '' }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', flexShrink: 0 }}
                          title={ar ? 'إزالة' : 'Remove'}>
                          <i className="ti ti-x" style={{ fontSize: 13 }} />
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>{ar ? 'العنوان' : 'Title'} *</label>
                  <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={ar ? 'مثال: نموذج طلب إجازة' : 'e.g. Leave Request Form'} />
                </div>
                <div className="form-group">
                  <label>{ar ? 'العنوان (عربي)' : 'Title (Arabic)'}</label>
                  <input className="form-input" value={form.titleAr} onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))} dir="rtl" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{ar ? 'الوصف' : 'Description'}</label>
                  <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>{ar ? 'الوصف (عربي)' : 'Description (Arabic)'}</label>
                  <input className="form-input" value={form.descriptionAr} onChange={e => setForm(f => ({ ...f, descriptionAr: e.target.value }))} dir="rtl" />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>{ar ? 'يمكن لمن رؤية هذا الملف' : 'Visible to'}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {Object.keys(ROLE_LABELS).map(role => {
                    const active = !form.isPrivate && form.visibleTo.includes(role)
                    return (
                      <button
                        key={role}
                        type="button"
                        disabled={form.isPrivate}
                        onClick={() => setForm(f => ({
                          ...f,
                          visibleTo: f.visibleTo.includes(role) ? f.visibleTo.filter(r => r !== role) : [...f.visibleTo, role]
                        }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 20,
                          border: `1px solid ${active ? '#0085C7' : 'var(--border)'}`,
                          background: active ? '#0085C715' : 'var(--surface)',
                          color: active ? '#0085C7' : 'var(--text2)',
                          fontSize: 12.5, fontWeight: 600, cursor: form.isPrivate ? 'default' : 'pointer', transition: 'all .12s',
                          opacity: form.isPrivate ? 0.45 : 1,
                        }}>
                        {active && <i className="ti ti-check" style={{ fontSize: 13 }} />}
                        {ROLE_LABELS[role]}
                      </button>
                    )
                  })}
                  {/* "Only Me" is a fundamentally different kind of visibility — not a
                      role at all, just the person who created it. Picking it clears
                      and disables the role pills above, since "only me" plus "also
                      visible to coaches" would be a contradiction. Some admin tools/
                      links genuinely aren't meant for other admins to see either, so
                      this is enforced at the database level too, not just hidden here. */}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isPrivate: !f.isPrivate }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 20,
                      border: `1px solid ${form.isPrivate ? '#EE334E' : 'var(--border)'}`,
                      background: form.isPrivate ? '#EE334E15' : 'var(--surface)',
                      color: form.isPrivate ? '#EE334E' : 'var(--text2)',
                      fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
                    }}>
                    {form.isPrivate ? <i className="ti ti-check" style={{ fontSize: 13 }} /> : <i className="ti ti-lock" style={{ fontSize: 13 }} />}
                    {ar ? 'فقط أنا' : 'Only Me'}
                  </button>
                </div>
                {form.isPrivate && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                    {ar ? 'لن يتمكن أي شخص آخر من رؤية هذا، بما في ذلك المسؤولون الآخرون.' : 'No one else will be able to see this, including other admins.'}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => { setShowUpload(false); resetForm() }}>{tx('actions.cancel','Cancel')}</button>
              <button className="btn btn-blue" onClick={handleSubmit} disabled={uploading} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {uploading && <i className="ti ti-loader-2" style={{ animation: 'spin 0.6s linear infinite' }} />}
                {uploading
                  ? (editingResource ? (ar ? 'جارٍ الحفظ...' : 'Saving…') : (ar ? 'جارٍ الرفع...' : 'Uploading…'))
                  : (editingResource ? (ar ? 'حفظ' : 'Save') : (ar ? 'رفع' : 'Upload'))}
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
            <i className="ti ti-upload" /> {ar ? 'إضافة مورد' : 'Add Resource'}
          </button>
        )}
      </div>

      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder={ar ? 'بحث في الملفات...' : 'Search resources…'} value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>

      {loading && <div className="empty" style={{ padding:24 }}>{ar ? 'جارٍ التحميل...' : 'Loading…'}</div>}

      {!loading && visible.length === 0 && (
        <div className="empty" style={{ padding:'40px 24px', textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:14, background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
            <i className="ti ti-folder" style={{ fontSize:26, color:'var(--text3)' }} />
          </div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:4 }}>
            {resources.length === 0
              ? (ar ? 'لا توجد ملفات بعد' : 'No resources yet')
              : (ar ? 'لا توجد ملفات مطابقة' : 'No resources match your search')}
          </div>
          <div style={{ fontSize:12.5, color:'var(--text3)' }}>
            {resources.length === 0
              ? (isAdmin ? (ar ? 'أضف أول ملف ليظهر هنا.' : 'Add the first resource and it\u2019ll show up here.') : (ar ? 'سيقوم المسؤول بإضافة الملفات هنا.' : 'Files added by an admin will appear here.'))
              : (ar ? 'جرّب كلمة بحث أخرى.' : 'Try a different search term.')}
          </div>
          {resources.length === 0 && isAdmin && (
            <button className="btn btn-blue" onClick={() => setShowUpload(true)} style={{ marginTop:16 }}>
              <i className="ti ti-upload" /> {ar ? 'إضافة مورد' : 'Add Resource'}
            </button>
          )}
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div style={{ display:'grid', gap:12 }}>
          {visible.map(r => {
            const isLink = r.resource_type === 'link'
            const meta = isLink ? LINK_TYPE : fileMeta(r.file_name)
            return (
              <div key={r.id} className="info-card" style={{ display:'flex', alignItems:'center', gap:14, padding:16, transition:'border-color .15s, box-shadow .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '' }}>
                <div style={{ width:44, height:44, borderRadius:10, background:meta.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <i className={`ti ${meta.icon}`} style={{ fontSize:22, color:meta.color }} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                    {ar && r.title_ar ? r.title_ar : r.title}
                    {r.is_private && (
                      <i className="ti ti-lock" style={{ fontSize:11, color:'var(--text3)' }} title={ar ? 'فقط أنا' : 'Only me'} />
                    )}
                  </div>
                  {(r.description || r.description_ar) && (
                    <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>{ar && r.description_ar ? r.description_ar : r.description}</div>
                  )}
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:4, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    {isLink ? (
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:280 }}>{r.file_url}</span>
                    ) : (
                      <>
                        <span>{r.file_name}</span>
                        {r.file_size && <span>· {formatSize(r.file_size)}</span>}
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button
                    onClick={() => isLink ? window.open(r.file_url, '_blank', 'noopener,noreferrer') : downloadResource(r.file_url, r.file_name)}
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text2)', cursor:'pointer', fontSize:14 }}
                    title={isLink ? (ar ? 'فتح' : 'Open') : (ar ? 'تحميل' : 'Download')}>
                    <i className={`ti ${isLink ? 'ti-external-link' : 'ti-download'}`} />
                  </button>
                  {isAdmin && (
                    <button onClick={() => openEdit(r)}
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text2)', cursor:'pointer' }}
                      title={ar ? 'تعديل' : 'Edit'}>
                      <i className="ti ti-pencil" style={{ fontSize:14 }} />
                    </button>
                  )}
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
