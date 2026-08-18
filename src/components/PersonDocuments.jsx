import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast } from './Toast'
import { canEdit } from '../lib/useAuth'
import JSZip from 'jszip'
import { SHARED_TYPES, getNonAthleteDocumentRules, mergeDocuments, computeCompletion, normalizeType } from '../lib/documentEngine'
import { DOC_TYPES, DOC_TYPES_AR, DOC_ICONS, DOC_COLORS } from '../lib/documentTypes'
import { DocPreviewButton } from '../lib/helpers'

// Re-exported so any existing import of these from this file keeps working
// without change — the canonical definitions now live in
// src/lib/documentTypes.js (a plain data module, not a UI component), so
// other files (e.g. Employees.jsx) should prefer importing from there
// directly instead of through this component.
export { DOC_TYPES, DOC_TYPES_AR }

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/(1024*1024)).toFixed(1)} MB`
}

async function downloadDoc(url, personName, docType, originalName) {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    const ext  = originalName.split('.').pop()
    const filename = `${personName.replace(/\s+/g,'_')}_${docType.replace(/\s+/g,'_')}.${ext}`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  } catch { window.open(url, '_blank') }
}

async function downloadAllDocuments(personName, myDocs, setDownloadingAll, ar) {
  if (!myDocs.length) return
  setDownloadingAll(true)
  try {
    const zip = new JSZip()
    const usedNames = {}
    for (const doc of myDocs) {
      try {
        const res = await fetch(doc.file_url)
        const blob = await res.blob()
        const ext = (doc.name.split('.').pop() || 'bin')
        const folder = (doc.type || 'Other').replace(/[\\/:*?"<>|]/g, '_')
        const base = `${personName.replace(/\s+/g,'_')}_${doc.type.replace(/\s+/g,'_')}`
        const key = `${folder}/${base}`
        usedNames[key] = (usedNames[key] || 0) + 1
        const suffix = usedNames[key] > 1 ? `_${usedNames[key]}` : ''
        zip.file(`${folder}/${base}${suffix}.${ext}`, blob)
      } catch {
        // skip this file, continue with the rest
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${personName.replace(/\s+/g,'_')}_Documents.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  } catch (e) {
    toast(ar ? 'فشل تنزيل الوثائق' : 'Failed to download documents', 'error')
  } finally {
    setDownloadingAll(false)
  }
}

// personId here is the role table's own numeric id (coach.id / employee.id)
// used for person_documents rows. `sharedPersonId` is the people.id (uuid)
// used for person_shared_documents — may be null if this role isn't linked
// to a person yet, in which case shared-type uploads are blocked with a
// clear message rather than silently going nowhere.
export default function PersonDocuments({ personId, personType, personName, docs, onRefresh, profile, sharedPersonId, designation }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'
  const [docType, setDocType]         = useState('')
  const [uploading, setUploading]     = useState(false)
  const [dropOpen, setDropOpen]       = useState(false)
  const [confirmDel, setConfirmDel]   = useState(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [sharedDocs, setSharedDocs]   = useState([])
  const [uploadChoice, setUploadChoice] = useState(null) // { file, type, existing: [...] } — pending Replace/Add/Cancel decision
  const docInput = useRef(null)

  useEffect(() => {
    if (!dropOpen) return
    const close = () => setDropOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [dropOpen])

  useEffect(() => {
    if (!sharedPersonId) { setSharedDocs([]); return }
    let cancelled = false
    supabase.from('person_shared_documents').select('*').eq('person_id', sharedPersonId)
      .then(({ data }) => { if (!cancelled) setSharedDocs(data || []) })
    return () => { cancelled = true }
  }, [sharedPersonId])

  const myOwnDocs = (docs || []).filter(d => String(d.person_id) === String(personId) && d.person_type === personType)
  // Merge shared (Photo/Original Passport/Qatar ID) with role-specific docs
  // — every type stays visible/uploadable, engine only used for completion.
  const myDocs = mergeDocuments(sharedDocs, myOwnDocs, DOC_TYPES)
  const docsByType = DOC_TYPES.reduce((acc, t) => {
    acc[t] = myDocs.filter(d => d.type === t)
    return acc
  }, {})
  const rules = getNonAthleteDocumentRules(designation)
  const completion = computeCompletion(myDocs, rules)

  async function handleUpload(file) {
    if (!file) return
    if (!docType) { toast(ar ? 'يرجى اختيار نوع المستند أولاً' : 'Select a document type first', 'error'); return }
    if (file.size > 20 * 1024 * 1024) { toast(ar ? 'يجب أن يكون حجم الملف أقل من 20 ميجابايت' : 'File must be under 20MB', 'error'); return }
    const isSharedType = SHARED_TYPES.includes(docType)
    if (isSharedType && !sharedPersonId) {
      toast(ar ? 'لا يوجد سجل شخصي مرتبط. يرجى ربط عضو الكادر هذا قبل رفع وثائق الهوية المشتركة.' : 'No linked person record. Please link this staff member before uploading shared identity documents.', 'error'); return
    }
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${personType}_${personId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('athlete-documents').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('athlete-documents').getPublicUrl(path)

      if (isSharedType) {
        // Multiple documents of the same type are allowed — the Replace/Add
        // Another prompt in requestUpload() is what decides whether an
        // existing one gets removed first, so this insert always adds a
        // new row rather than blocking on a same-name match.
        // .select().single() gets the real DB-assigned id back so the
        // local optimistic append has a genuine id immediately — without
        // it, this row's own Preview/Download/Delete actions and its React
        // key would be broken until the next full refetch.
        const { data: inserted, error: dbErr } = await supabase.from('person_shared_documents').insert({
          person_id: sharedPersonId, name: file.name, type: docType,
          file_url: data.publicUrl, file_path: path, file_size: file.size,
        }).select().single()
        if (dbErr) throw dbErr
        setSharedDocs(prev => [...prev, inserted])
      } else {
        const { error: dbErr } = await supabase.from('person_documents').insert({
          person_id: personId, person_type: personType,
          name: file.name, type: docType,
          file_url: data.publicUrl, file_path: path,
          file_size: file.size,
        })
        if (dbErr) throw dbErr
      }
      toast(`${docType} uploaded!`); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setUploading(false); setDocType(''); if (docInput.current) docInput.current.value = '' }
  }

  // Every currently-existing document (shared or role-specific) for this
  // person + type, used to decide whether the Replace/Add Another prompt
  // needs to appear at all.
  function existingDocsForType(type) {
    const normType = normalizeType(type)
    if (SHARED_TYPES.includes(normType)) {
      return sharedDocs.filter(d => normalizeType(d.type) === normType).map(d => ({ ...d, _source: 'shared' }))
    }
    return myOwnDocs.filter(d => normalizeType(d.type) === normType).map(d => ({ ...d, _source: 'role' }))
  }

  // Gate in front of handleUpload — if this type already has one or more
  // documents, ask Replace existing / Add another / Cancel instead of
  // uploading immediately.
  function requestUpload(file) {
    if (!file) return
    if (!docType) { toast(ar ? 'يرجى اختيار نوع المستند أولاً' : 'Select a document type first', 'error'); return }
    const existing = existingDocsForType(docType)
    if (existing.length > 0) {
      setUploadChoice({ file, type: docType, existing })
    } else {
      handleUpload(file)
    }
  }

  async function resolveUploadChoice(action) {
    const choice = uploadChoice
    setUploadChoice(null)
    if (!choice) return
    if (action === 'cancel') { if (docInput.current) docInput.current.value = ''; return }
    if (action === 'replace') {
      for (const doc of choice.existing) {
        if (doc._source === 'shared') {
          await supabase.from('person_shared_documents').delete().eq('id', doc.id)
        } else {
          await supabase.from('person_documents').delete().eq('id', doc.id)
        }
        if (doc.file_path) {
          const { error: storageErr } = await supabase.storage.from('athlete-documents').remove([doc.file_path])
          if (storageErr) console.error('Document row deleted, but removing the Storage file failed:', storageErr)
        }
      }
      const replacedIds = new Set(choice.existing.filter(d => d._source === 'shared').map(d => d.id))
      if (replacedIds.size) setSharedDocs(prev => prev.filter(d => !replacedIds.has(d.id)))
      if (choice.existing.some(d => d._source === 'role')) await onRefresh()
    }
    await handleUpload(choice.file)
  }

  async function handleDelete(doc) {
    // DB row first (source of truth) — abort before touching Storage if
    // the delete fails, so a failure never leaves a partial state.
    if (doc._source === 'shared') {
      // Deletes by primary key id — never by (person_id, type, name), which
      // would match every document of that type sharing the same filename
      // and silently remove more than the one clicked.
      const { error } = await supabase.from('person_shared_documents').delete().eq('id', doc.id)
      if (error) { toast(error.message, 'error'); return }
      setSharedDocs(prev => prev.filter(d => d.id !== doc.id))
    } else {
      const { error } = await supabase.from('person_documents').delete().eq('id', doc.id)
      if (error) { toast(error.message, 'error'); return }
    }
    if (doc.file_path) {
      const { error: storageErr } = await supabase.storage.from('athlete-documents').remove([doc.file_path])
      if (storageErr) console.error('Document row deleted, but removing the Storage file failed:', storageErr)
    }
    toast(lang === 'ar' ? 'تم حذف الملف' : 'Document deleted')
    setConfirmDel(null)
    await onRefresh()
  }

  return (
    <div className="info-card" style={{ marginTop:12 }}>
      {uploadChoice && (
        <div className="modal-overlay" onClick={() => resolveUploadChoice('cancel')}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">{ar ? 'المستند موجود بالفعل' : 'Document already uploaded'}</div>
            <div className="confirm-msg">
              {ar
                ? `${DOC_TYPES_AR[uploadChoice.type]||uploadChoice.type} مرفوع بالفعل. ماذا تريد أن تفعل؟`
                : `${uploadChoice.type} is already uploaded. What would you like to do?`}
            </div>
            <div className="confirm-btns" style={{ flexDirection:'column' }}>
              <button className="btn btn-blue" style={{ width:'100%' }} onClick={() => resolveUploadChoice('replace')}>
                {ar ? 'استبدال الموجود' : 'Replace existing'}
              </button>
              <button className="btn" style={{ width:'100%', background:'var(--surface2)', color:'var(--text)' }} onClick={() => resolveUploadChoice('add')}>
                {ar ? 'إضافة آخر' : 'Add another'}
              </button>
              <button className="btn-cancel" style={{ width:'100%' }} onClick={() => resolveUploadChoice('cancel')}>
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <div className="confirm-title">Delete document</div>
            <div className="confirm-msg">{tx('confirm.deleteDocument','Delete')} "{confirmDel.name}"?</div>
            <div className="confirm-btns">
              <button className="btn-cancel" onClick={() => setConfirmDel(null)}>{tx('actions.cancel','Cancel')}</button>
              <button className="btn" style={{ background:'#dc2626' }} onClick={() => handleDelete(confirmDel)}>{tx('actions.delete','Delete')}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div className="info-title" style={{ margin:0 }}>
          {lang==='ar'?'الوثائق':'Documents'}
          <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>
            {myDocs.length} {lang==='ar'?'ملف':`file${myDocs.length!==1?'s':''}`}
          </span>
        </div>
        <button onClick={() => downloadAllDocuments(personName, myDocs, setDownloadingAll, lang==='ar')}
          disabled={myDocs.length === 0 || downloadingAll}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:7, border:'1px solid var(--border)', background: myDocs.length===0 ? 'var(--surface2)' : 'var(--surface)', color: myDocs.length===0 ? 'var(--text3)' : 'var(--text2)', fontSize:11.5, cursor: myDocs.length===0||downloadingAll ? 'default' : 'pointer', opacity: downloadingAll ? .7 : 1 }}>
          {downloadingAll
            ? <><div style={{ width:11, height:11, border:'2px solid var(--text3)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .7s linear infinite' }} />{lang==='ar'?'جارٍ التحميل…':'Preparing…'}</>
            : <><i className="ti ti-download" style={{ fontSize:13 }} />{lang==='ar'?'تحميل الكل':'Download all'}</>}
        </button>
      </div>

      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom: completion.missingTypes.length > 0 ? 10 : 0 }}>
          <div style={{ fontSize:22, fontWeight:700, color: completion.percent === 100 ? '#009F6B' : completion.percent >= 50 ? '#f59e0b' : '#dc2626' }}>{completion.percent}%</div>
          <div style={{ flex:1 }}>
            <div style={{ height:8, borderRadius:6, background:'var(--surface2)', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${completion.percent}%`, background: completion.percent === 100 ? '#009F6B' : completion.percent >= 50 ? '#f59e0b' : '#dc2626', transition:'width .2s' }} />
            </div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
              {completion.uploaded}/{completion.total} {lang==='ar' ? 'مطلوب مرفوع' : 'required uploaded'}
            </div>
          </div>
        </div>
        {completion.missingTypes.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {completion.missingTypes.map(t => (
              <span key={t} className="badge" style={{ fontSize:10, background:'#fef2f2', color:'#dc2626' }}>
                {lang==='ar' ? (DOC_TYPES_AR[t]||t) : t}
              </span>
            ))}
          </div>
        )}
      </div>

      {canEdit(profile) && (
        <div style={{ display:'flex', gap:8, marginBottom:16, padding:'10px 12px', background:'var(--surface2)', borderRadius:10, alignItems:'center' }}>
          <button onClick={() => docInput.current.click()} disabled={uploading || !docType}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background: !docType ? 'var(--text3)' : '#0085C7', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor: (uploading || !docType) ? 'default' : 'pointer', flexShrink:0, fontFamily:'DM Sans, sans-serif', opacity: !docType ? .6 : 1 }}>
            {uploading
              ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />{lang==='ar'?'جارٍ الرفع…':'Uploading…'}</>
              : <><i className="ti ti-upload" style={{ fontSize:14 }} />{lang==='ar'?'رفع':'Upload'}</>
            }
          </button>
          <div style={{ flex:1, position:'relative' }}>
            <button onClick={() => setDropOpen(v=>!v)}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', fontSize:12, color: docType ? 'var(--text)' : 'var(--text3)', cursor:'pointer', fontFamily:'DM Sans, sans-serif', direction: lang==='ar'?'rtl':'ltr' }}>
              <span>{docType ? (lang==='ar'?(DOC_TYPES_AR[docType]||docType):docType) : (lang==='ar'?'اختر نوع الوثيقة':'Select document type...')}</span>
              <i className="ti ti-chevron-down" style={{ fontSize:12, color:'var(--text3)', marginLeft:4 }} />
            </button>
            {dropOpen && (
              <div onMouseDown={e => e.stopPropagation()} style={{ position:'fixed', zIndex:9999, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.15)', minWidth:200, maxHeight:280, overflowY:'auto', direction: lang==='ar'?'rtl':'ltr' }}
                ref={el => {
                  if (el) {
                    const btn = el.previousSibling
                    const rect = btn?.getBoundingClientRect()
                    if (rect) {
                      const spaceBelow = window.innerHeight - rect.bottom
                      const dropH = Math.min(280, DOC_TYPES.length * 38)
                      if (spaceBelow < dropH + 8) {
                        el.style.top = 'auto'
                        el.style.bottom = (window.innerHeight - rect.top + 4) + 'px'
                      } else {
                        el.style.top = (rect.bottom + 4) + 'px'
                        el.style.bottom = 'auto'
                      }
                      el.style.left = rect.left + 'px'
                      el.style.width = rect.width + 'px'
                    }
                  }
                }}>
                {DOC_TYPES.map(t => (
                  <div key={t} onClick={() => { setDocType(t); setDropOpen(false) }}
                    style={{ padding:'9px 14px', fontSize:12, cursor:'pointer', background: t===docType?'var(--surface2)':'transparent', fontWeight: t===docType?600:400, color: t===docType?'#0085C7':'var(--text)' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background=t===docType?'var(--surface2)':'transparent'}>
                    {lang==='ar'?(DOC_TYPES_AR[t]||t):t}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input ref={docInput} type="file" style={{ display:'none' }}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={e => { if(e.target.files[0]) requestUpload(e.target.files[0]) }} />
        </div>
      )}

      {myDocs.length === 0
        ? <div className="empty" style={{ padding:'8px 0', fontSize:12 }}>{lang==='ar'?'لم يتم رفع وثائق بعد.':'No documents uploaded yet.'}</div>
        : DOC_TYPES.map(type => {
            const typeDocs = docsByType[type]
            if (!typeDocs || typeDocs.length === 0) return null

            const color = DOC_COLORS[type]
            const icon  = DOC_ICONS[type]
            return (
              <div key={type} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <i className={`ti ${icon}`} style={{ fontSize:13, color }} />
                  <span style={{ fontSize:11, fontWeight:600, color }}>{lang==='ar'?(DOC_TYPES_AR[type]||type):type}</span>
                </div>
                {typeDocs.map(doc => (
                  <div key={`${doc._source}-${doc.id}`} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', background:'var(--surface2)', borderRadius:9, marginBottom:6, border:'1px solid var(--border)' }}>
                    <div style={{ width:34, height:34, borderRadius:8, background:color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <i className={`ti ${icon}`} style={{ fontSize:16, color }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.name}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{formatSize(doc.file_size)} · {doc.uploaded_at?.slice(0,10)}</div>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button
                        onClick={() => downloadDoc(doc.file_url, personName, doc.type, doc.name)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text2)', cursor:'pointer', fontSize:14 }}
                        title={lang==='ar'?'تحميل':'Download'}>
                        <i className="ti ti-download" />
                      </button>
                      <DocPreviewButton url={doc.file_url} name={doc.name} />
                      {canEdit(profile) && (
                        <button onClick={() => setConfirmDel(doc)}
                          style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626', cursor:'pointer' }}
                          title={lang==='ar'?'حذف':'Delete'}>
                          <i className="ti ti-trash" style={{ fontSize:14 }} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })
      }
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
