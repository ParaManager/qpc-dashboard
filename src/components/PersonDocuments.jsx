import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast } from './Toast'
import { canEdit } from '../lib/useAuth'

const DOC_TYPES_AR = {
  'Passport':'جواز السفر', 'Qatar ID':'الرقم الشخصي',
  'Residence Permit':'تصريح الإقامة', 'Contract':'العقد',
  'Certificate':'الشهادة', 'Medical Report':'التقرير الطبي',
  'Photo':'صورة', 'Other':'أخرى',
}

const DOC_TYPES = [
  'Passport', 'Qatar ID', 'Residence Permit',
  'Contract', 'Certificate', 'Medical Report',
  'Photo', 'Other'
]

const DOC_ICONS  = {
  'Passport':         'ti-id',
  'Qatar ID':         'ti-id-badge',
  'Residence Permit': 'ti-home',
  'Contract':         'ti-file-text',
  'Certificate':      'ti-certificate',
  'Medical Report':   'ti-heart-rate-monitor',
  'Photo':            'ti-photo',
  'Other':            'ti-file',
}

const DOC_COLORS = {
  'Passport':         '#0085C7',
  'Qatar ID':         '#009F6B',
  'Residence Permit': '#16a085',
  'Contract':         '#8b5cf6',
  'Certificate':      '#e67e22',
  'Medical Report':   '#EE334E',
  'Photo':            '#0085C7',
  'Other':            '#9aa3b2',
}

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

export default function PersonDocuments({ personId, personType, personName, docs, onRefresh, profile }) {
  const { tx, lang } = useLang()
  const [docType, setDocType]         = useState('Passport')
  const [uploading, setUploading]     = useState(false)
  const [confirmDel, setConfirmDel]   = useState(null)
  const docInput = useRef(null)

  const myDocs = (docs || []).filter(d => d.person_id === personId && d.person_type === personType)
  const docsByType = DOC_TYPES.reduce((acc, t) => {
    acc[t] = myDocs.filter(d => d.type === t)
    return acc
  }, {})

  async function handleUpload(file) {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { toast('File must be under 20MB', 'error'); return }
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${personType}_${personId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('athlete-documents').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('athlete-documents').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('person_documents').insert({
        person_id: personId, person_type: personType,
        name: file.name, type: docType,
        file_url: data.publicUrl, file_path: path,
        file_size: file.size,
      })
      if (dbErr) throw dbErr
      toast(`${docType} uploaded!`); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setUploading(false); if (docInput.current) docInput.current.value = '' }
  }

  async function handleDelete(doc) {
    await supabase.storage.from('athlete-documents').remove([doc.file_path])
    const { error } = await supabase.from('person_documents').delete().eq('id', doc.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Document deleted'); setConfirmDel(null); await onRefresh()
  }

  return (
    <div className="info-card" style={{ marginTop:12 }}>
      {/* Delete confirm */}
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
      </div>

      {/* Upload row — admins only */}
      {canEdit(profile) && (
        <div style={{ display:'flex', gap:8, marginBottom:16, padding:'10px 12px', background:'var(--surface2)', borderRadius:10, alignItems:'center', direction:'ltr' }}>
          <select value={docType} onChange={e => setDocType(e.target.value)}
            style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', fontSize:12, color:'var(--text)', outline:'none', direction: lang==='ar' ? 'rtl' : 'ltr' }}>
            {DOC_TYPES.map(t => <option key={t} value={t}>{lang==='ar'?(DOC_TYPES_AR[t]||t):t}</option>)}
          </select>
          <button onClick={() => docInput.current.click()} disabled={uploading}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'#0085C7', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', flexShrink:0, fontFamily:'DM Sans, sans-serif' }}>
            {uploading
              ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />{lang==='ar'?'جارٍ الرفع…':'Uploading…'}</>
              : <><i className="ti ti-upload" style={{ fontSize:14 }} />{lang==='ar'?'رفع':'Upload'}</>
            }
          </button>
          <input ref={docInput} type="file" style={{ display:'none' }}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={e => { if(e.target.files[0]) handleUpload(e.target.files[0]) }} />
        </div>
      )}

      {myDocs.length === 0
        ? <div className="empty" style={{ padding:'16px 0' }}>{lang==='ar'?'لم يتم رفع وثائق بعد.':'No documents uploaded yet.'}</div>
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
                  <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', background:'var(--surface2)', borderRadius:9, marginBottom:6, border:'1px solid var(--border)' }}>
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
                        title="Download">
                        <i className="ti ti-download" />
                      </button>
                      {canEdit(profile) && (
                        <button onClick={() => setConfirmDel(doc)}
                          style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626', cursor:'pointer' }}
                          title="Delete">
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
