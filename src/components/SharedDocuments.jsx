import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast } from './Toast'
import { canEdit } from '../lib/useAuth'

const SHARED_DOC_TYPES = ['Passport', 'QID', 'Personal Photo', 'CV']
const SHARED_DOC_TYPES_AR = { 'Passport': 'جواز السفر', 'QID': 'الرقم الشخصي', 'Personal Photo': 'صورة شخصية', 'CV': 'السيرة الذاتية' }

// Shared identity documents live once per person_id in person_shared_documents
// and are visible from every linked role page plus My Profile. Deliberately
// separate from PersonDocuments (which stays role-specific).
export default function SharedDocuments({ personId, profile }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [docType, setDocType] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef(null)

  async function load() {
    if (!personId) { setDocs([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('person_shared_documents').select('*').eq('person_id', personId).order('uploaded_at', { ascending: false })
    setDocs(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [personId])

  async function handleUpload(file) {
    if (!file || !personId) return
    if (!docType) { toast(ar ? 'اختر نوع الوثيقة أولاً' : 'Select a document type first', 'error'); return }
    if (file.size > 20 * 1024 * 1024) { toast('File must be under 20MB', 'error'); return }
    // Prevent duplicates: same person + type + filename is rejected by the
    // DB's own unique index, but check first for a clean user-facing message.
    const dup = docs.find(d => d.type === docType && d.name === file.name)
    if (dup) { toast(ar ? 'هذا الملف موجود بالفعل' : 'This document already exists', 'error'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `shared/${personId}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`
      const { error: upErr } = await supabase.storage.from('athlete-documents').upload(path, file)
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('athlete-documents').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('person_shared_documents').insert({
        person_id: personId, name: file.name, type: docType,
        file_url: pub.publicUrl, file_path: path, file_size: file.size,
      })
      if (dbErr) throw dbErr
      toast(ar ? 'تم الرفع' : 'Uploaded')
      setDocType('')
      await load()
    } catch (err) {
      toast(err.message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function handleDelete(doc) {
    await supabase.storage.from('athlete-documents').remove([doc.file_path])
    const { error } = await supabase.from('person_shared_documents').delete().eq('id', doc.id)
    if (error) { toast(error.message, 'error'); return }
    toast(ar ? 'تم الحذف' : 'Deleted')
    await load()
  }

  if (!personId) return null

  return (
    <div className="info-card">
      <div className="info-title" style={{ marginBottom: 12 }}>
        {ar ? 'الوثائق المشتركة' : 'Shared Documents'}
        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--text3)', textTransform: 'none', letterSpacing: 0 }}>
          {docs.length} {ar ? 'ملف' : `file${docs.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {canEdit(profile) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, alignItems: 'center', direction: 'ltr' }}>
          <select value={docType} onChange={e => setDocType(e.target.value)}
            style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12, color: docType ? 'var(--text)' : 'var(--text3)' }}>
            <option value="">{ar ? 'اختر نوع الوثيقة...' : 'Select document type...'}</option>
            {SHARED_DOC_TYPES.map(t => <option key={t} value={t}>{ar ? SHARED_DOC_TYPES_AR[t] : t}</option>)}
          </select>
          <button onClick={() => fileInput.current.click()} disabled={uploading || !docType}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: !docType ? 'var(--text3)' : '#0085C7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: (uploading || !docType) ? 'default' : 'pointer', opacity: !docType ? .6 : 1 }}>
            {uploading ? (ar ? 'جارٍ الرفع…' : 'Uploading…') : <><i className="ti ti-upload" style={{ fontSize: 14 }} />{ar ? 'رفع' : 'Upload'}</>}
          </button>
          <input ref={fileInput} type="file" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0])} />
        </div>
      )}

      {loading ? (
        <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--text3)' }}>{ar ? 'جارٍ التحميل…' : 'Loading…'}</div>
      ) : docs.length === 0 ? (
        <div className="empty" style={{ padding: '8px 0', fontSize: 12 }}>{ar ? 'لا توجد وثائق مشتركة بعد.' : 'No shared documents yet.'}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <i className="ti ti-file-text" style={{ fontSize: 15, color: '#0085C7' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{ar ? (SHARED_DOC_TYPES_AR[doc.type] || doc.type) : doc.type}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text2)' }}>
                  <i className="ti ti-download" style={{ fontSize: 13 }} />
                </a>
                {canEdit(profile) && (
                  <button onClick={() => handleDelete(doc)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>
                    <i className="ti ti-trash" style={{ fontSize: 13 }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
