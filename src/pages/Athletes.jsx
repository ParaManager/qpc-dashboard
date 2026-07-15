
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { generateStatisticsReport } from '../lib/statisticsReport'
import { Avatar, MedalDisplay, Badge, avColor, initials, DashRow, SPORTS, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, SPORT_CATEGORY_NAMES_AR, SPORT_NAMES_AR, sportLabel, effectiveStatus } from '../lib/helpers'
import PhotoCropModal from '../components/PhotoCropModal'
import FormModal from '../components/FormModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import JSZip from 'jszip'
import { canEdit } from '../lib/useAuth'
import { isTrustedAdmin } from '../lib/permissions'
import { usePersonRoles, RoleBadges } from '../components/RoleBadges.jsx'
import SharedDocuments from '../components/SharedDocuments.jsx'
import { logAdminActivity } from '../lib/adminActivity'
import CareerHistory from '../components/CareerHistory.jsx'
import { useLang } from '../lib/LangContext.jsx'
import AthleteCardButton from '../components/AthleteCard'

const DOC_TYPES  = [
  'Photo',
  'Original Passport',
  'Mission Passport',
  'Qatar ID',
  'Medical Certificate',
  'QSS Registration',
  'Medical Report',
  'Birth Certificate',
  'QSRSN Membership',
  'Health Card',
  'MDF',
  'IPC Athlete Eligibility Agreement',
  'SDMS License',
  'Other',
]
// Required document types for completeness checks — same list the athlete
// Documents section itself tracks, minus the free-form 'Other' catch-all
// which isn't a specific required document.
const REQUIRED_DOC_TYPES = DOC_TYPES.filter(t => t !== 'Other')

// ── Single source of truth for athlete form field ↔ database column
// mapping. Previously handleSave's payload and the edit-record population
// each maintained their own incomplete, hand-written field list, and had
// drifted out of sync — sport_category, medical_status, career_profile,
// and statistics_disability were silently dropped from one or both,
// meaning they could never be saved via the modal and/or always showed
// blank when reopening an existing athlete for editing. Both directions
// now go through this one table instead of two separately-maintained lists.
//
// Every entry: [formFieldKey, dbColumnKey]. Only fields actually present in
// the athletes table's real schema are listed here — nothing invented.
const ATHLETE_FIELD_MAP = [
  ['name', 'name'],
  ['nameAr', 'name_ar'],
  ['dob', 'dob'],
  ['gender', 'gender'],
  ['nationality', 'nationality'],
  ['sportCategory', 'sport_category'],
  ['sport', 'sport'],
  ['classification', 'classification'],
  ['disability', 'disability'],
  ['statistics_disability', 'statistics_disability'],
  ['coachId', 'coach_id'],
  ['status', 'status'],
  ['statusStart', 'status_start'],
  ['statusEnd', 'status_end'],
  ['phone', 'phone'],
  ['email', 'email'],
  ['joinDate', 'join_date'],
  ['medicalStatus', 'medical_status'],
  ['careerProfile', 'career_profile'],
  ['club', 'club'],
  ['designation', 'designation'],
  ['residencyStatus', 'residency_status'],
  ['qssNumber', 'qss_number'],
  ['passportNumber', 'passport_number'],
  ['passportExpiry', 'passport_expiry'],
  ['idNumber', 'id_number'],
  ['idExpiry', 'id_expiry'],
]

// athlete DB record → form field object, for populating the edit modal.
// Derived directly from ATHLETE_FIELD_MAP above so the two directions can
// never drift out of sync with each other again.
function athleteToFormFields(a) {
  const out = { id: a.id }
  for (const [formKey, dbKey] of ATHLETE_FIELD_MAP) {
    out[formKey] = (formKey === 'statusStart' || formKey === 'statusEnd') ? (a[dbKey] || '') : a[dbKey]
  }
  return out
}
function athleteDocStatus(athleteId, documents) {
  const myDocs = (documents || []).filter(d => d.athlete_id === athleteId)
  if (myDocs.length === 0) return { key: 'none', missing: REQUIRED_DOC_TYPES.length, missingTypes: REQUIRED_DOC_TYPES }
  const present = new Set(myDocs.map(d => d.type))
  const missingTypes = REQUIRED_DOC_TYPES.filter(t => !present.has(t))
  if (missingTypes.length === 0) return { key: 'complete', missing: 0, missingTypes: [] }
  return { key: 'missing', missing: missingTypes.length, missingTypes }
}

// ── Import Documents (admin only) ──────────────────────────────────
// Filenames are used ONLY to extract the QID (the part before the first
// underscore) to match an athlete via athletes.id_number. The document type
// is always whatever the admin explicitly selected — never inferred from
// the filename.
function extractQidFromFilename(filename) {
  const base = filename.split('.').slice(0, -1).join('.') || filename
  const qid = base.split('_')[0].trim()
  return qid
}

function BulkImportDocsModal({ athletes, documents, lang, profile, onClose, onDone }) {
  const ar = lang === 'ar'
  const L = (en, arText) => ar ? arText : en

  const [docType, setDocType] = useState(DOC_TYPES[0])
  const [files, setFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState(null)
  const fileInputRef = useRef(null)
  // Per-duplicate chosen action, keyed by a stable index into the
  // duplicates list (rebuilt each render from `preview`, see below).
  const [dupeActions, setDupeActions] = useState({})

  function addFiles(fileList) {
    const arr = Array.from(fileList || [])
    if (arr.length) setFiles(prev => [...prev, ...arr])
  }

  // Build the preview classification: matched / unmatched / ambiguous /
  // duplicate, based on the currently selected document type. Files
  // identical in name+size to an earlier file already placed in this same
  // batch (matched or duplicate) are treated as extra copies: only the
  // first usable occurrence is kept, the rest are pushed to duplicates so
  // they're never silently imported twice from one batch.
  const preview = (() => {
    const matched = [], unmatched = [], ambiguous = [], duplicates = []
    const seenInBatch = new Set() // key: athleteId|name|size
    for (const file of files) {
      const qid = extractQidFromFilename(file.name)
      if (!qid) { unmatched.push({ file, qid }); continue }
      const matches = athletes.filter(a => a.id_number && a.id_number.trim() === qid)
      if (matches.length === 0) { unmatched.push({ file, qid }); continue }
      if (matches.length > 1) { ambiguous.push({ file, qid, matches }); continue }
      const athlete = matches[0]
      const batchKey = `${athlete.id}|${file.name}|${file.size}`
      const existingDoc = documents.find(d =>
        d.athlete_id === athlete.id &&
        d.type === docType &&
        d.name === file.name &&
        d.file_size === file.size
      )
      if (existingDoc) { duplicates.push({ file, qid, athlete, existingDoc }); continue }
      if (seenInBatch.has(batchKey)) { duplicates.push({ file, qid, athlete, existingDoc: null }); continue }
      seenInBatch.add(batchKey)
      matched.push({ file, qid, athlete })
    }
    return { matched, unmatched, ambiguous, duplicates }
  })()

  function dupeAction(i) { return dupeActions[i] || 'skip' }
  function setAllDupeActions(action) {
    const next = {}
    preview.duplicates.forEach((_, i) => { next[i] = action })
    setDupeActions(next)
  }

  async function handleImport() {
    const toReplace = preview.duplicates
      .map((d, i) => ({ d, i }))
      .filter(({ d, i }) => dupeAction(i) === 'replace' && d.existingDoc)
    if (preview.matched.length === 0 && toReplace.length === 0) return
    // One stable ID for this entire import run, generated once up front and
    // reused for the single final notification below — Date.now() alone was
    // not a real dedup key since it's always different on every call; this
    // ID is what actually identifies "this one import operation".
    const operationId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,10)}`
    setImporting(true)
    setProgress({ done: 0, total: preview.matched.length + toReplace.length })
    let imported = 0, replaced = 0, failed = 0

    for (const item of preview.matched) {
      try {
        const ext = item.file.name.split('.').pop()
        const path = `${item.athlete.id}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`
        const { error: upErr } = await supabase.storage.from('athlete-documents').upload(path, item.file)
        if (upErr) throw upErr
        const { data } = supabase.storage.from('athlete-documents').getPublicUrl(path)
        const { error: dbErr } = await supabase.from('athlete_documents').insert({
          athlete_id: item.athlete.id, name: item.file.name, type: docType,
          file_url: data.publicUrl, file_path: path, file_size: item.file.size,
        })
        if (dbErr) throw dbErr
        imported++
      } catch {
        failed++
      }
      setProgress(p => ({ ...p, done: p.done + 1 }))
    }

    // Replacements: upload new file first, then update the existing record,
    // and only delete the old storage file once both steps above succeeded.
    // Never delete the old file first, and clean up the newly uploaded file
    // if the database update fails, so nothing is ever orphaned and the old
    // document stays fully intact on any failure.
    for (const { d } of toReplace) {
      let newPath = null
      try {
        const ext = d.file.name.split('.').pop()
        newPath = `${d.athlete.id}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`
        const { error: upErr } = await supabase.storage.from('athlete-documents').upload(newPath, d.file)
        if (upErr) throw upErr
        const { data } = supabase.storage.from('athlete-documents').getPublicUrl(newPath)
        const { error: updErr } = await supabase.from('athlete_documents').update({
          name: d.file.name, file_url: data.publicUrl, file_path: newPath,
          file_size: d.file.size, uploaded_at: new Date().toISOString(),
        }).eq('id', d.existingDoc.id)
        if (updErr) {
          await supabase.storage.from('athlete-documents').remove([newPath])
          throw updErr
        }
        // DB update succeeded — now safe to remove the old file.
        if (d.existingDoc.file_path) {
          await supabase.storage.from('athlete-documents').remove([d.existingDoc.file_path])
        }
        replaced++
      } catch {
        failed++
      }
      setProgress(p => ({ ...p, done: p.done + 1 }))
    }

    setImporting(false)
    const skippedDuplicates = preview.duplicates.filter((_, i) => dupeAction(i) !== 'replace').length
    setSummary({
      imported, replaced, failed,
      skippedDuplicates,
      unmatched: preview.unmatched.length,
      ambiguous: preview.ambiguous.length,
    })
    // Exactly one notification per import operation, keyed on the stable
    // operationId generated at the start of this function — a retried or
    // duplicated call for the same run (which cannot happen from the UI
    // today, since the button is disabled while importing, but this is the
    // actual guarantee rather than relying on that alone) can never insert
    // a second notification for the same operation.
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
    if (admins?.length) {
      const nothingHappened = imported === 0 && replaced === 0 && failed === 0
      const succeeded = (imported + replaced) > 0 && failed === 0
      const partial = (imported + replaced) > 0 && failed > 0
      // All files were skipped as duplicates (or there was simply nothing
      // matched to act on) — this is a completed, successful run, not a
      // failure, even though zero files were actually written.
      const type = nothingHappened ? 'import_succeeded' : (succeeded || partial ? 'import_succeeded' : 'import_failed')
      const summaryText = nothingHappened
        ? (ar ? 'لم يتم استيراد أي وثائق جديدة لأن جميع الملفات المحددة تم تخطيها.' : 'No new documents were imported because all selected files were skipped.')
        : (ar
            ? `تم استيراد ${imported}، استبدال ${replaced}، تخطي ${skippedDuplicates}، غير مطابق ${preview.unmatched.length}، فشل ${failed}`
            : `Imported ${imported}, replaced ${replaced}, skipped ${skippedDuplicates}, unmatched ${preview.unmatched.length}, failed ${failed}`)
      const { error: notifErr } = await supabase.from('notifications').insert(admins.map(a => ({
        user_id: a.id,
        type,
        title: nothingHappened
          ? (ar ? 'اكتمل الاستيراد — لا جديد' : 'Import completed — nothing new')
          : succeeded
            ? (ar ? 'اكتمل استيراد الوثائق' : 'Document import completed')
            : partial
              ? (ar ? 'اكتمل استيراد الوثائق جزئياً' : 'Document import completed with errors')
              : (ar ? 'فشل استيراد الوثائق' : 'Document import failed'),
        body: summaryText,
        data: { page: 'athletes' },
        read: false,
        category: 'Documents', target_path: 'athletes', related_entity_type: 'import_batch', related_entity_id: operationId,
        dedup_key: `doc-import-${type === 'import_failed' ? 'failed' : 'succeeded'}-${operationId}-${a.id}`,
      })))
      if (notifErr) console.error('[notifications] failed to insert import result notification:', notifErr)
    }
    // Permanent audit trail row for this import operation — kept separate
    // from the richer, existing all-admins broadcast notification above
    // (which already reaches both trusted admins, since both have
    // role='admin') rather than sending a second, duplicate notification.
    await supabase.from('activity_log').insert({
      actor_id: profile?.id || null,
      actor_name: profile?.full_name || profile?.email || 'Someone',
      actor_email: (profile?.email || '').toLowerCase() || null,
      action: failed > 0 && (imported + replaced) === 0 ? 'import_failed' : 'import_succeeded',
      entity_type: 'import',
      entity_id: operationId,
      entity_label: `${imported} imported, ${replaced} replaced, ${failed} failed`,
      module: 'athletes',
      metadata: { imported, replaced, failed, skipped: skippedDuplicates, unmatched: preview.unmatched.length },
    })
    await onDone()
  }

  return (
    <div className="modal-overlay" onClick={() => !importing && onClose()}>
      <div className="modal-box" style={{ width: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{L('Import Documents', 'استيراد وثائق')}</div>
          <button className="modal-close" onClick={() => !importing && onClose()}><i className="ti ti-x" /></button>
        </div>

        <div className="modal-body">
          {summary ? (
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{L('Import complete', 'اكتمل الاستيراد')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <div className="badge badge-green" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Imported', 'تم الاستيراد')}: {summary.imported}</div>
                <div className="badge badge-blue" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Replaced', 'تم الاستبدال')}: {summary.replaced}</div>
                <div className="badge badge-gray" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Skipped duplicates', 'تم تخطي المكرر')}: {summary.skippedDuplicates}</div>
                <div className="badge badge-amber" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Unmatched', 'غير مطابق')}: {summary.unmatched}</div>
                <div className="badge badge-amber" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Ambiguous', 'غير مؤكد')}: {summary.ambiguous}</div>
                <div className="badge badge-red" style={{ padding: '10px 14px', fontSize: 13, justifyContent: 'flex-start' }}>{L('Failed', 'فشل')}: {summary.failed}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">{L('Document Type', 'نوع الوثيقة')}</label>
                <select className="form-input" value={docType} onChange={e => setDocType(e.target.value)} disabled={importing}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{ar ? (DOC_TYPES_AR[t] || t) : t}</option>)}
                </select>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                  {L('All imported files will be saved as this document type, regardless of filename.', 'سيتم حفظ جميع الملفات المستوردة بهذا النوع من الوثائق، بغض النظر عن اسم الملف.')}
                </div>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#0085C7' : 'var(--border)'}`,
                  borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(0,133,199,.05)' : 'var(--surface2)', marginBottom: 16, marginTop: 12,
                }}>
                <i className="ti ti-upload" style={{ fontSize: 26, color: 'var(--text3)' }} />
                <div style={{ fontSize: 13, marginTop: 8 }}>{L('Click or drag files here', 'انقر أو اسحب الملفات هنا')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{L('Filenames must start with the athlete QID, e.g. 123456789_id.pdf', 'يجب أن يبدأ اسم الملف بالرقم الشخصي للرياضي، مثال: 123456789_id.pdf')}</div>
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
              </div>

              {files.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                  {files.length} {L('file(s) selected', 'ملف تم اختياره')} — {preview.matched.length} {L('matched', 'مطابق')}, {preview.unmatched.length} {L('unmatched', 'غير مطابق')}, {preview.ambiguous.length} {L('ambiguous', 'غير مؤكد')}, {preview.duplicates.length} {L('duplicates', 'مكرر')}
                </div>
              )}

              {importing && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: '#0085C7', transition: 'width .2s' }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{progress.done} / {progress.total} {L('uploaded', 'تم الرفع')}</div>
                </div>
              )}

              {files.length > 0 && (
                <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {preview.matched.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#00875a', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{L('Matched', 'مطابق')} ({preview.matched.length})</div>
                      {preview.matched.map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.file.name}</span>
                          <span style={{ color: 'var(--text2)' }}>{ar && m.athlete.name_ar ? m.athlete.name_ar : m.athlete.name}</span>
                          <span style={{ color: 'var(--text3)', fontFamily: 'monospace' }}>{m.qid}</span>
                          <span className="badge badge-green" style={{ fontSize: 10 }}>{ar ? (DOC_TYPES_AR[docType] || docType) : docType}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {preview.unmatched.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{L('Unmatched', 'غير مطابق')} ({preview.unmatched.length})</div>
                      {preview.unmatched.map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.file.name}</span>
                          <span style={{ color: 'var(--text3)', fontFamily: 'monospace' }}>{m.qid || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {preview.ambiguous.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{L('Ambiguous matches', 'تطابقات غير مؤكدة')} ({preview.ambiguous.length})</div>
                      {preview.ambiguous.map((m, i) => (
                        <div key={i} style={{ padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.file.name}</span>
                            <span style={{ color: 'var(--text3)', fontFamily: 'monospace' }}>{m.qid}</span>
                          </div>
                          <div style={{ color: 'var(--text3)', marginTop: 2 }}>{m.matches.length} {L('athletes share this QID', 'رياضيون يشتركون في هذا الرقم')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {preview.duplicates.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{L('Duplicates', 'مكرر')} ({preview.duplicates.length})</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" onClick={() => setAllDupeActions('skip')} disabled={importing}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
                            {L('Skip All Duplicates', 'تخطي كل المكررات')}
                          </button>
                          <button type="button" onClick={() => setAllDupeActions('replace')} disabled={importing}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid #0085C7', background: 'rgba(0,133,199,.08)', color: '#0085C7', cursor: 'pointer' }}>
                            {L('Replace All Duplicates', 'استبدال كل المكررات')}
                          </button>
                        </div>
                      </div>
                      {preview.duplicates.map((m, i) => {
                        const action = dupeAction(i)
                        const canReplace = !!m.existingDoc
                        return (
                          <div key={i} style={{ padding: '10px 10px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: 500 }}>{m.file.name}</span>
                              <span style={{ color: 'var(--text2)' }}>{ar && m.athlete?.name_ar ? m.athlete.name_ar : m.athlete?.name}</span>
                              <span style={{ color: 'var(--text3)', fontFamily: 'monospace' }}>{m.qid}</span>
                              <span className="badge badge-blue" style={{ fontSize: 10 }}>{ar ? (DOC_TYPES_AR[docType] || docType) : docType}</span>
                            </div>
                            {m.existingDoc && (
                              <div style={{ color: 'var(--text3)', marginBottom: 6 }}>
                                {L('Existing', 'الحالي')}: {m.existingDoc.name} — {m.existingDoc.uploaded_at ? new Date(m.existingDoc.uploaded_at).toLocaleDateString() : '—'}
                              </div>
                            )}
                            {!canReplace && (
                              <div style={{ color: 'var(--text3)', marginBottom: 6 }}>
                                {L('Duplicate within this batch — only the first occurrence can be imported.', 'مكرر ضمن هذه الدفعة — يمكن استيراد النسخة الأولى فقط.')}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" disabled={importing} onClick={() => setDupeActions(prev => ({ ...prev, [i]: 'skip' }))}
                                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                                  border: `1px solid ${action === 'skip' ? 'var(--text3)' : 'var(--border)'}`,
                                  background: action === 'skip' ? 'var(--surface)' : 'transparent',
                                  color: action === 'skip' ? 'var(--text)' : 'var(--text3)', fontWeight: action === 'skip' ? 600 : 400 }}>
                                {L('Skip', 'تخطي')}
                              </button>
                              <button type="button" disabled={importing || !canReplace} onClick={() => canReplace && setDupeActions(prev => ({ ...prev, [i]: 'replace' }))}
                                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: canReplace ? 'pointer' : 'not-allowed',
                                  border: `1px solid ${action === 'replace' ? '#0085C7' : 'var(--border)'}`,
                                  background: action === 'replace' ? 'rgba(0,133,199,.1)' : 'transparent',
                                  color: action === 'replace' ? '#0085C7' : 'var(--text3)', fontWeight: action === 'replace' ? 600 : 400,
                                  opacity: canReplace ? 1 : .5 }}>
                                {L('Replace', 'استبدال')}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {summary ? (
            <button className="btn btn-blue" onClick={onClose}>{L('Close', 'إغلاق')}</button>
          ) : (
            <>
              <button className="btn-cancel" onClick={onClose} disabled={importing}>{L('Cancel', 'إلغاء')}</button>
              {(() => {
                const replaceCount = preview.duplicates.filter((_, i) => dupeAction(i) === 'replace' && preview.duplicates[i].existingDoc).length
                const totalActionable = preview.matched.length + replaceCount
                return (
                  <button className="btn btn-blue" disabled={importing || totalActionable === 0} onClick={handleImport}>
                    {importing ? L('Importing…', 'جارٍ الاستيراد...') : `${L('Import', 'استيراد')} (${totalActionable})`}
                  </button>
                )
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
const DOC_TYPES_AR = {
  'Photo':'صورة', 'Original Passport':'الجواز الأصلي', 'Mission Passport':'جواز المهمة',
  'Qatar ID':'الرقم الشخصي',
  'Medical Certificate':'شهادة طبية', 'QSS Registration':'تسجيل QSS',
  'Medical Report':'تقرير طبي',
  'Birth Certificate':'شهادة ميلاد', 'QSRSN Membership':'عضوية QSRSN',
  'Health Card':'بطاقة صحية', 'MDF':'MDF',
  'IPC Athlete Eligibility Agreement':'اتفاقية أهلية IPC',
  'SDMS License':'رخصة SDMS', 'Other':'أخرى',
}

// ── Export Documents (admin only) ──────────────────────────────────
function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'file'
}

function BulkExportDocsModal({ athletes, documents, lang, onClose }) {
  const ar = lang === 'ar'
  const L = (en, arText) => ar ? arText : en

  const [docType, setDocType] = useState(DOC_TYPES[0])
  const [multiMode, setMultiMode] = useState('latest') // 'latest' | 'all'
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [done, setDone] = useState(false)

  const rows = athletes.map(a => {
    const docs = documents
      .filter(d => d.athlete_id === a.id && d.type === docType)
      .sort((x, y) => new Date(y.uploaded_at || 0) - new Date(x.uploaded_at || 0))
    return { athlete: a, docs }
  })
  const withDoc = rows.filter(r => r.docs.length > 0)
  const missing = rows.filter(r => r.docs.length === 0)
  const withMultiple = rows.filter(r => r.docs.length > 1)

  const filesToInclude = multiMode === 'latest'
    ? withDoc.map(r => ({ athlete: r.athlete, docs: [r.docs[0]] }))
    : withDoc.map(r => ({ athlete: r.athlete, docs: r.docs }))
  const totalFiles = filesToInclude.reduce((sum, r) => sum + r.docs.length, 0)

  async function handleExport() {
    if (totalFiles === 0) return
    setExporting(true)
    setProgress({ done: 0, total: totalFiles })
    const zip = new JSZip()
    const usedNames = new Set()

    for (const { athlete, docs } of filesToInclude) {
      const baseName = sanitizeFilename(`${athlete.name}_${docType}`)
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i]
        try {
          const res = await fetch(doc.file_url)
          const blob = await res.blob()
          const ext = (doc.name && doc.name.includes('.')) ? doc.name.split('.').pop() : (doc.file_path?.split('.').pop() || 'bin')
          let filename = `${baseName}.${ext}`
          let n = 2
          while (usedNames.has(filename)) { filename = `${baseName}_${n}.${ext}`; n++ }
          usedNames.add(filename)
          zip.file(filename, blob)
        } catch {
          // skip this file on fetch failure; does not fail the whole export
        }
        setProgress(p => ({ ...p, done: p.done + 1 }))
      }
    }

    if (missing.length > 0) {
      const header = 'Athlete Name,Athlete QID,Missing Document Type\n'
      const lines = missing.map(r => `"${(r.athlete.name || '').replace(/"/g, '""')}","${r.athlete.id_number || ''}","${docType}"`).join('\n')
      zip.file('missing_documents_report.csv', header + lines)
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${sanitizeFilename(docType)}_export.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setExporting(false)
    setDone(true)
  }

  return (
    <div className="modal-overlay" onClick={() => !exporting && onClose()}>
      <div className="modal-box" style={{ width: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{L('Export Documents', 'تصدير وثائق')}</div>
          <button className="modal-close" onClick={() => !exporting && onClose()}><i className="ti ti-x" /></button>
        </div>

        <div className="modal-body">
          {done ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <i className="ti ti-circle-check" style={{ fontSize: 40, color: '#00875a' }} />
              <div style={{ fontWeight: 600, fontSize: 14, marginTop: 10 }}>{L('Export complete', 'اكتمل التصدير')}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                {totalFiles} {L('file(s) downloaded', 'ملف تم تنزيله')}{missing.length > 0 ? ` · ${missing.length} ${L('missing (see report in ZIP)', 'مفقود (راجع التقرير داخل الملف المضغوط)')}` : ''}
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>
                {athletes.length} {L('athlete(s) selected', 'رياضي تم اختياره')}
              </div>

              <div className="form-group">
                <label className="form-label">{L('Document Type', 'نوع الوثيقة')}</label>
                <select className="form-input" value={docType} onChange={e => setDocType(e.target.value)} disabled={exporting}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{ar ? (DOC_TYPES_AR[t] || t) : t}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '14px 0' }}>
                <div className="badge badge-green" style={{ padding: '8px 10px', fontSize: 12, justifyContent: 'flex-start' }}>{L('Has document', 'يمتلك الوثيقة')}: {withDoc.length}</div>
                <div className="badge badge-amber" style={{ padding: '8px 10px', fontSize: 12, justifyContent: 'flex-start' }}>{L('Missing', 'مفقود')}: {missing.length}</div>
                <div className="badge badge-blue" style={{ padding: '8px 10px', fontSize: 12, justifyContent: 'flex-start' }}>{L('Multiple files', 'ملفات متعددة')}: {withMultiple.length}</div>
              </div>

              {withMultiple.length > 0 && (
                <div className="form-group">
                  <label className="form-label">{L('For athletes with multiple files of this type', 'للرياضيين الذين لديهم عدة ملفات من هذا النوع')}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" disabled={exporting} onClick={() => setMultiMode('latest')}
                      style={{ fontSize: 12, padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                        border: `1px solid ${multiMode === 'latest' ? '#0085C7' : 'var(--border)'}`,
                        background: multiMode === 'latest' ? 'rgba(0,133,199,.1)' : 'transparent',
                        color: multiMode === 'latest' ? '#0085C7' : 'var(--text2)', fontWeight: multiMode === 'latest' ? 600 : 400 }}>
                      {L('Download latest only', 'تنزيل الأحدث فقط')}
                    </button>
                    <button type="button" disabled={exporting} onClick={() => setMultiMode('all')}
                      style={{ fontSize: 12, padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                        border: `1px solid ${multiMode === 'all' ? '#0085C7' : 'var(--border)'}`,
                        background: multiMode === 'all' ? 'rgba(0,133,199,.1)' : 'transparent',
                        color: multiMode === 'all' ? '#0085C7' : 'var(--text2)', fontWeight: multiMode === 'all' ? 600 : 400 }}>
                      {L('Download all', 'تنزيل الكل')}
                    </button>
                  </div>
                </div>
              )}

              {missing.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                    {L('Missing this document', 'مفقود هذه الوثيقة')} ({missing.length})
                  </div>
                  <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {missing.map(r => (
                      <div key={r.athlete.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8, fontSize: 12 }}>
                        <span>{ar && r.athlete.name_ar ? r.athlete.name_ar : r.athlete.name}</span>
                        <span style={{ color: 'var(--text3)', fontFamily: 'monospace' }}>{r.athlete.id_number || '—'}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                    {L('A report listing these will be included in the ZIP.', 'سيتم تضمين تقرير بهذه الحالات داخل الملف المضغوط.')}
                  </div>
                </div>
              )}

              {exporting && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: '#0085C7', transition: 'width .2s' }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{progress.done} / {progress.total} {L('processed', 'تمت معالجته')}</div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {done ? (
            <button className="btn btn-blue" onClick={onClose}>{L('Close', 'إغلاق')}</button>
          ) : (
            <>
              <button className="btn-cancel" onClick={onClose} disabled={exporting}>{L('Cancel', 'إلغاء')}</button>
              <button className="btn btn-blue" disabled={exporting || totalFiles === 0} onClick={handleExport}>
                {exporting ? L('Exporting…', 'جارٍ التصدير...') : `${L('Download ZIP', 'تنزيل الملف المضغوط')} (${totalFiles})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const DOC_ICONS  = {
  'Photo':                          'ti-photo',
  'Original Passport':              'ti-id',
  'Mission Passport':               'ti-id',
  'Qatar ID':                       'ti-id-badge',
  'Medical Certificate':            'ti-heart-rate-monitor',
  'QSS Registration':               'ti-clipboard-list',
  'Medical Report':                 'ti-stethoscope',
  'Birth Certificate':              'ti-certificate',
  'QSRSN Membership':               'ti-users',
  'Health Card':                    'ti-heart',
  'MDF':                            'ti-file-description',
  'IPC Athlete Eligibility Agreement': 'ti-file-check',
  'SDMS License':                   'ti-license',
  'Other':                          'ti-file',
}
const DOC_COLORS = {
  'Photo':                          '#0085C7',
  'Original Passport':              '#0085C7',
  'Mission Passport':               '#e67e22',
  'Qatar ID':                       '#009F6B',
  'Medical Certificate':            '#EE334E',
  'QSS Registration':               '#8b5cf6',
  'Medical Report':                 '#EE334E',
  'Birth Certificate':              '#e67e22',
  'QSRSN Membership':               '#8b5cf6',
  'Health Card':                    '#EE334E',
  'MDF':                            '#16a085',
  'IPC Athlete Eligibility Agreement': '#0085C7',
  'SDMS License':                   '#e67e22',
  'Other':                          '#9aa3b2',
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/(1024*1024)).toFixed(1)} MB`
}

function exportExcel(athletes, coaches, documents, visibleCols, allCols, lang) {
  const ar = lang === 'ar'
  const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Injured':'مصاب','Under Medical Review':'تحت المراجعة الطبية','Suspended':'موقوف','Retired':'متقاعد'}
  const DIS_MAP = {'visual impairment':'إعاقة بصرية','hearing impairment':'إعاقة سمعية','physical impairment':'إعاقة جسدية','intellectual disability':'إعاقة ذهنية','intellectual impairment':'إعاقة ذهنية','spinal cord injury':'إصابة الحبل الشوكي','cerebral palsy':'شلل دماغي','amputation':'بتر','down syndrome':'متلازمة داون',"down's syndrome":'متلازمة داون','downs syndrome':'متلازمة داون','down':'متلازمة داون','autism spectrum':'التوحد','autism':'التوحد','multiple disabilities':'إعاقات متعددة','limb deficiency':'نقص الأطراف','les autres':'أخرى'}
  const tDis = d => {
    if (!d || !ar) return d||''
    const key = d.toLowerCase().trim()
    if (DIS_MAP[key]) return DIS_MAP[key]
    for (const [k,v] of Object.entries(DIS_MAP)) {
      if (key.includes(k) || k.includes(key)) return v
    }
    return d
  }
  // Same map used for the Statistics Disability column/filter inside the
  // component — exportExcel is a standalone function outside that scope, so
  // it needs its own copy rather than referencing the component's tStatDis.
  const STATS_DIS_AR = {
    'Physical Disability':        'الإعاقات الجسدية / الحركية',
    'Intellectual Disability':    'الإعاقة الذهنية',
    'Visual Disability':          'الإعاقة البصرية',
    'Hearing Disability':         'الإعاقة السمعية',
    'Speech & Language Disorders':'اضطرابات النطق واللغة',
    'Psychosocial Disability':    'الإعاقة النفسية والاجتماعية',
    'Multiple Disability':        'الإعاقات المتعددة',
    'Developmental Disability':   'الإعاقات النمائية',
    'Down Syndrome':              'متلازمة داون',
    'Autism':                     'اضطراب التوحد',
  }
  const tStatDis = d => {
    if (!d) return ''
    return ar ? (STATS_DIS_AR[d] || d) : d
  }
  const COUNTRY_MAP = {'qatar':'قطر','egypt':'مصر','algeria':'الجزائر','morocco':'المغرب','jordan':'الأردن','saudi arabia':'المملكة العربية السعودية','uae':'الإمارات','kuwait':'الكويت','bahrain':'البحرين','oman':'عُمان','iraq':'العراق','syria':'سوريا','lebanon':'لبنان','palestine':'فلسطين','yemen':'اليمن','somalia':'الصومال','sudan':'السودان','libya':'ليبيا','tunisia':'تونس','pakistan':'باكستان','india':'الهند','iran':'إيران','turkey':'تركيا','ireland':'أيرلندا','france':'فرنسا','spain':'إسبانيا','germany':'ألمانيا','uk':'المملكة المتحدة','usa':'الولايات المتحدة','ksa':'المملكة العربية السعودية'}
  const tc = n => n ? (ar ? (COUNTRY_MAP[n.toLowerCase().trim()]||n) : n) : ''

  const L = (en, a) => ar ? a : en

  const colMap = {
    name:            a => ar && a.name_ar ? a.name_ar : a.name,
    name_ar:         a => a.name_ar || '',
    qss_number:      a => a.qss_number || '',
    id_number:       a => a.id_number || '',
    career_profile:  a => a.career_profile || '',
    sport_category:  a => a.sport_category ? (ar ? (SPORT_CATEGORY_NAMES_AR[a.sport_category]||a.sport_category) : a.sport_category) : '',
    sport:           a => a.sport ? sportLabel(a.sport, a.sport_category, ar) : '',
    classification:  a => a.classification || '',
    disability:             a => tDis(a.disability),
    statistics_disability:  a => tStatDis(a.statistics_disability),
    nationality:     a => tc(a.nationality),
    gender:          a => a.gender ? (ar ? (a.gender==='Male'?'ذكر':'أنثى') : a.gender) : '',
    dob:             a => a.dob || '',
    age_category:       a => a.age_category || '',
    sport_age_category: a => a.sport_age_category || '',
    coach_id:        a => { const c = coaches.find(c => c.id === a.coach_id); return c ? (ar && c.name_ar ? c.name_ar : c.name) : '' },
    status:          a => { const es=effectiveStatus(a); return ar ? (STATUS_AR[es]||es||'') : (es||'') },
    medical_status:  a => a.medical_status || '',
    phone:           a => a.phone || '',
    email:           a => a.email || '',
    join_date:       a => a.join_date || '',
    passport_number: a => a.passport_number || '',
    passport_expiry: a => a.passport_expiry || '',
    id_expiry:       a => a.id_expiry || '',
    medals:          a => (a.medals_gold||0) + (a.medals_silver||0) + (a.medals_bronze||0),
    documents:       a => { const ds = athleteDocStatus(a.id, documents); return ds.key==='complete' ? (ar?'مكتمل':'Complete') : ds.key==='missing' ? (ar?`${ds.missing} ناقص`:`${ds.missing} Missing`) : (ar?'لا يوجد وثائق':'No Documents') },
    missing_documents: a => { const ds = athleteDocStatus(a.id, documents); return ds.key==='complete' ? '' : ds.key==='none' ? (ar?'جميع الوثائق مفقودة':'All documents missing') : ds.missingTypes.map(t => ar ? (DOC_TYPES_AR[t]||t) : t).join(', ') },
  }

  // Preserve ALL_COLS' own order (identity → sport → personal → status →
  // documents → performance) rather than whatever order the caller's
  // visibleCols array happens to be in.
  const visibleDefs = allCols.filter(c => visibleCols.includes(c.key))
  const DATE_KEYS = new Set(['dob', 'join_date', 'passport_expiry', 'id_expiry'])
  const rows = athletes.map(a => {
    const row = {}
    visibleDefs.forEach(col => {
      const raw = colMap[col.key]?.(a)
      if (DATE_KEYS.has(col.key) && raw) {
        // Real Excel date value (not a text string) so spreadsheet users get
        // proper date sorting/filtering — falls back to blank cleanly when
        // the stored value isn't a valid date.
        const d = new Date(raw)
        row[col.label] = isNaN(d.getTime()) ? (raw || '') : d
      } else {
        row[col.label] = (raw === null || raw === undefined) ? '' : raw
      }
    })
    return row
  })
  const ws = XLSX.utils.json_to_sheet(rows, { cellDates: true })
  // Apply a readable date format to any column recognized as a date so
  // Excel doesn't show its own default numeric/date serial formatting.
  const dateColIdxs = visibleDefs.map((c, i) => DATE_KEYS.has(c.key) ? i : -1).filter(i => i >= 0)
  if (dateColIdxs.length) {
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      for (const C of dateColIdxs) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = ws[cellRef]
        if (cell && cell.t === 'd') cell.z = 'yyyy-mm-dd'
      }
    }
  }
  const wb = XLSX.utils.book_new()
  ws['!cols'] = visibleDefs.map(() => ({ wch: 20 }))
  XLSX.utils.book_append_sheet(wb, ws, ar ? 'الرياضيون' : 'Athletes')
  const date = new Date().toISOString().slice(0,10)
  XLSX.writeFile(wb, `QPC_${ar?'الرياضيون':'Athletes'}_${date}.xlsx`)
}

async function downloadAllDocuments(athleteName, myDocs, setDownloadingAll, ar, canSeeMissionPassport) {
  if (!myDocs.length) return
  setDownloadingAll(true)
  try {
    const zip = new JSZip()
    const usedNames = {}
    for (const doc of myDocs) {
      if (doc.type === 'Mission Passport' && !canSeeMissionPassport) continue
      try {
        const res = await fetch(doc.file_url)
        const blob = await res.blob()
        const ext = (doc.name.split('.').pop() || 'bin')
        const folder = (doc.type || 'Other').replace(/[\\/:*?"<>|]/g, '_')
        const base = `${athleteName.replace(/\s+/g,'_')}_${doc.type.replace(/\s+/g,'_')}`
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
    a.download = `${athleteName.replace(/\s+/g,'_')}_Documents.zip`
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

async function downloadDoc(url, athleteName, docType, originalName) {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    const ext  = originalName.split('.').pop()
    const filename = `${athleteName.replace(/\s+/g,'_')}_${docType.replace(/\s+/g,'_')}.${ext}`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  } catch (e) {
    window.open(url, '_blank')
  }
}

function formatFriendlyDate(dateStr, ar) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString(ar ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function calcAge(dob) {
  if (!dob) return null
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function calcYearsActive(joinDate) {
  if (!joinDate) return null
  const today = new Date()
  const joined = new Date(joinDate)
  const years = today.getFullYear() - joined.getFullYear()
  const months = today.getMonth() - joined.getMonth()
  const totalMonths = years * 12 + months
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y}y ${m}mo` : `${y} year${y !== 1 ? 's' : ''}`
}

function getPersonalBests(results) {
  const bests = {}
  results.forEach(r => {
    if (!r.discipline || !r.result) return
    if (!bests[r.discipline]) {
      bests[r.discipline] = r
    } else {
      // keep the one with better position, or gold over silver etc
      const medalRank = { gold: 1, silver: 2, bronze: 3, null: 4 }
      const cur = medalRank[bests[r.discipline].medal] || 4
      const next = medalRank[r.medal] || 4
      if (next < cur) bests[r.discipline] = r
    }
  })
  return Object.values(bests)
}


function AthleteCoachHistory({ athleteId, coaches, employees, lang }) {
  const [history, setHistory] = useState([])
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  useEffect(() => {
    if (!athleteId) return
    supabase.from('athlete_coach_history')
      .select('*')
      .eq('athlete_id', String(athleteId))
      .eq('is_current', false)
      .order('start_date', { ascending: false })
      .then(({ data }) => setHistory(data || []))
  }, [athleteId])

  if (!history.length) return null

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        {L('Previous coaches', 'المدربون السابقون')}
      </div>
      {history.map(h => {
        // Look in both coaches and employees
        const pc = [...(coaches||[]), ...(employees||[])].find(c => String(c.id) === String(h.coach_id))
        if (!pc) return null
        return (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
            <span style={{ fontWeight: 500 }}>{ar && pc.name_ar ? pc.name_ar : pc.name}</span>
            {(h.start_date || h.end_date) && (
              <span style={{ color: 'var(--text3)' }}>
                {h.start_date ? h.start_date.slice(0,7) : ''}{h.end_date ? ' → ' + h.end_date.slice(0,7) : ''}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Athletes({ athletes, coaches, employees, results, documents, events, registrations, onRefresh, onNav, initAthleteId, initStatusFilter, navState, profile }) {
  const { tx, lang, tc } = useLang()
  // Case-insensitive disability translation
  const DIS_MAP = {
    'visual impairment':'إعاقة بصرية', 'visual':'إعاقة بصرية',
    'hearing impairment':'إعاقة سمعية', 'hearing':'إعاقة سمعية',
    'physical impairment':'إعاقة جسدية', 'physical':'إعاقة جسدية',
    'intellectual disability':'إعاقة ذهنية', 'intellectual impairment':'إعاقة ذهنية',
    'intellectual':'إعاقة ذهنية',
    'spinal cord injury':'إصابة الحبل الشوكي', 'spinal cord':'إصابة الحبل الشوكي',
    'cerebral palsy':'شلل دماغي', 'cerebral':'شلل دماغي',
    'amputation':'بتر',
    'limb deficiency':'نقص الأطراف', 'limb':'نقص الأطراف',
    'les autres':'أخرى', 'other':'أخرى',
    'down syndrome':'متلازمة داون', "down's syndrome":'متلازمة داون',
    'downs syndrome':'متلازمة داون', 'down':'متلازمة داون',
    'autism spectrum disorder':'التوحد', 'autism spectrum':'التوحد', 'autism':'التوحد',
    'multiple disabilities':'إعاقات متعددة', 'multiple':'إعاقات متعددة',
  }
  const tDis = (d) => {
    if (!d || lang==='en') return d
    const key = d.toLowerCase().trim()
    if (DIS_MAP[key]) return DIS_MAP[key]
    // partial match
    for (const [k, v] of Object.entries(DIS_MAP)) {
      if (key.includes(k) || k.includes(key)) return v
    }
    return d
  }

  // ── Statistics Disability — 10-category ministry/IPC reporting classification ──
  const STATS_DIS_OPTIONS = [
    'Physical Disability',
    'Intellectual Disability',
    'Visual Disability',
    'Hearing Disability',
    'Speech & Language Disorders',
    'Psychosocial Disability',
    'Multiple Disability',
    'Developmental Disability',
    'Down Syndrome',
    'Autism',
  ]
  const STATS_DIS_AR = {
    'Physical Disability':        'الإعاقات الجسدية / الحركية',
    'Intellectual Disability':    'الإعاقة الذهنية',
    'Visual Disability':          'الإعاقة البصرية',
    'Hearing Disability':         'الإعاقة السمعية',
    'Speech & Language Disorders':'اضطرابات النطق واللغة',
    'Psychosocial Disability':    'الإعاقة النفسية والاجتماعية',
    'Multiple Disability':        'الإعاقات المتعددة',
    'Developmental Disability':   'الإعاقات النمائية',
    'Down Syndrome':              'متلازمة داون',
    'Autism':                     'اضطراب التوحد',
  }
  const tStatDis = (d) => {
    if (!d) return ''
    return lang === 'ar' ? (STATS_DIS_AR[d] || d) : d
  }

  const [search, setSearch]         = useState('')
  const [sport, setSport]           = useState('All sports')
  const [sportCategory, setSportCategory] = useState('All categories')
  const [status, setStatus]         = useState('All statuses')
  const [gender, setGender]         = useState('All genders')
  const [sort, setSort]             = useState('name-asc')
  const [selected, setSelected]     = useState(initAthleteId ?? null)
  const selectedAthleteForRoles = athletes.find(x => x.id === selected)
  const { roles: personRolesAthlete } = usePersonRoles(selectedAthleteForRoles?.person_id)
  const [scrollToDocs, setScrollToDocs] = useState(false)
  useEffect(() => {
    if (selected && scrollToDocs) {
      const el = document.getElementById('athlete-documents-section')
      if (el) { el.scrollIntoView({ behavior:'smooth', block:'start' }) }
      setScrollToDocs(false)
    }
  }, [selected, scrollToDocs])
  const [form, setForm]             = useState(null)
  const [confirm, setConfirm]       = useState(null)
  const [medalModal, setMedalModal] = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [docUploading, setDocUploading] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkExportOpen, setBulkExportOpen] = useState(false)
  const [exportSelectMode, setExportSelectMode] = useState(false)
  const [docType, setDocType]       = useState('')
  const [documentsExpanded, setDocumentsExpanded] = useState(true)
  const [competitionExpanded, setCompetitionExpanded] = useState(true)
  const [careerExpanded, setCareerExpanded] = useState(true)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [docDropOpen, setDocDropOpen] = useState(false)
  const [docConfirm, setDocConfirm] = useState(null)
  const [notes, setNotes]           = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSavedAt, setNotesSavedAt] = useState(null)
  const [notesChanged, setNotesChanged] = useState(false)
  const [editMode, setEditMode]     = useState(false)
  const [edits, setEdits]           = useState({})
  const [savingAll, setSavingAll]   = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  // Coaches only ever see their own athletes here (already filtered before this
  // page even receives them), so the Sport and Coach columns are pure repetition
  // of things they already know — default them out for coaches, but keep them
  // available for admin, who's looking across everyone. Shared between the
  // initial state below and the column picker's "Default" reset button, so the
  // two can't drift apart.
  const COACH_DEFAULT_COLS = ['name','classification','nationality','status','medals','documents']
  const DEFAULT_COLS_ADMIN = ['name','sport','coach_id','status','medical_status','passport_expiry','id_expiry']
  const COLS_STORAGE_KEY = 'qpc_athletes_visible_cols_v2'
  function loadStoredCols(fallback) {
    try {
      const raw = localStorage.getItem(COLS_STORAGE_KEY)
      if (!raw) return fallback
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length === 0) return fallback
      if (!parsed.every(k => typeof k === 'string')) return fallback
      return parsed.includes('name') ? parsed : ['name', ...parsed]
    } catch {
      return fallback
    }
  }
  const [visibleCols, setVisibleColsRaw] = useState(
    loadStoredCols(profile?.role === 'coach' ? COACH_DEFAULT_COLS : DEFAULT_COLS_ADMIN)
  )
  function setVisibleCols(next) {
    setVisibleColsRaw(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next
      try { localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(resolved)) } catch {}
      return resolved
    })
  }
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const colPickerRef = useRef(null)
  useEffect(() => {
    if (!colPickerOpen) return
    function onOutside(e) { if (colPickerRef.current && !colPickerRef.current.contains(e.target)) setColPickerOpen(false) }
    function onEscape(e) { if (e.key === 'Escape') setColPickerOpen(false) }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEscape)
    return () => { document.removeEventListener('mousedown', onOutside); document.removeEventListener('keydown', onEscape) }
  }, [colPickerOpen])
  const [colFilters, setColFilters] = useState({})
  const photoInput = useRef(null)
  const docInput   = useRef(null)
  const [cropFile, setCropFile] = useState(null) // { athleteId, file } pending crop
  useEffect(() => {
    if (initAthleteId != null) setSelected(initAthleteId)
    if (initStatusFilter)      setStatus(initStatusFilter)
  }, [initAthleteId, initStatusFilter])

  // Reset everything when nav clicked while already on athletes page — but
  // not when the caller also asked to open a specific athlete (initAthleteId),
  // e.g. this same page being reused for "My Profile": that explicit intent
  // must always win over the generic reset signal from sidebar navigation.
  useEffect(() => {
    if (navState?.reset && initAthleteId == null) {
      setSelected(null)
      setSearch('')
      setSport('All sports')
      setSportCategory('All categories')
      setStatus('All statuses')
      setGender('All genders')
      setSort('name-asc')
      setColFilters({})
    }
  }, [navState, initAthleteId])

  // Close doc dropdown on outside click
  useEffect(() => {
    if (!docDropOpen) return
    const close = () => setDocDropOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [docDropOpen])

  // sync notes when selected athlete changes
  useEffect(() => {
    if (selected) {
      const a = athletes.find(x => String(x.id) === String(selected))
      setNotes(a?.notes || '')
      setNotesChanged(false)
    }
  }, [selected, athletes])

  function resetFilters() {
    setSearch('')
    setSport('All sports')
    setSportCategory('All categories')
    setStatus('All statuses')
    setGender('All genders')
    setSort('name-asc')
    setColFilters({})
  }

  const hasActiveFilters = search || sport !== 'All sports' || sportCategory !== 'All categories' || status !== 'All statuses' || gender !== 'All genders' || sort !== 'name-asc' || Object.values(colFilters).some(v => v && v !== 'All')
  const activeFilterCount = [
    sport !== 'All sports', sportCategory !== 'All categories', status !== 'All statuses', gender !== 'All genders',
    ...Object.values(colFilters).map(v => v && v !== 'All'),
  ].filter(Boolean).length

  // Show every known sport (Paralympic + Special Olympics), not just ones currently
  // in use — so a sport with zero athletes today is still findable once someone new
  // is added under it.
  const sportsInData = new Set(athletes.map(a => a.sport).filter(Boolean))
  const sports = ['All sports', ...SPORTS, ...[...sportsInData].filter(s => !SPORTS.includes(s))]
  const sportCategories = ['All categories', ...SPORT_CATEGORIES]

  // ── Global search ── every field below is included, normalized (lowercased,
  // trimmed, safely stringified), and searched even when its column is hidden.
  // Memoized per-athlete so this isn't rebuilt on every keystroke — only when
  // the underlying data actually changes.
  const searchableValues = useMemo(() => {
    const map = new Map()
    const STATUS_LABELS = {'Active':'active','Inactive':'inactive','On Leave':'on leave','In Competition':'in competition','In Training Camp':'in training camp','Injured':'injured','Under Medical Review':'under medical review','Suspended':'suspended','Retired':'retired'}
    for (const a of athletes) {
      const coach = coaches.find(c => c.id === a.coach_id)
      const parts = [
        a.name, a.name_ar, a.qss_number, a.id_number, a.career_profile,
        a.sport_category, a.sport, a.classification, a.disability, a.statistics_disability,
        a.nationality, a.gender, coach?.name, coach?.name_ar,
        a.status, effectiveStatus(a), a.medical_status,
        a.phone, a.email, a.passport_number, a.passport_expiry, a.id_expiry,
        a.join_date, a.age_category, a.sport_age_category,
      ]
      const text = parts
        .map(v => {
          if (v === null || v === undefined) return ''
          if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10)
          return String(v)
        })
        .join(' ')
        .toLowerCase()
        .trim()
      map.set(a.id, text)
    }
    return map
  }, [athletes, coaches])

  const filteredList = useMemo(() => {
    const q = search.toLowerCase().trim()
    return athletes.filter(a =>
      (sport  === 'All sports'   || a.sport  === sport)  &&
      (sportCategory === 'All categories' || a.sport_category === sportCategory) &&
      (status === 'All statuses' || effectiveStatus(a) === status) &&
      (gender === 'All genders'  || a.gender === gender) &&
      a.name && // exclude blank names
      (!q || (searchableValues.get(a.id) || '').includes(q)) &&
      // column-level filters
      (!colFilters.sport_category || colFilters.sport_category === 'All' || a.sport_category === colFilters.sport_category) &&
      (!colFilters.sport        || colFilters.sport === 'All'        || a.sport === colFilters.sport) &&
      (!colFilters.status       || colFilters.status === 'All'       || effectiveStatus(a) === colFilters.status) &&
      (!colFilters.gender       || colFilters.gender === 'All'       || a.gender === colFilters.gender) &&
      (!colFilters.nationality  || colFilters.nationality === 'All'  || a.nationality === colFilters.nationality) &&
      (!colFilters.disability   || colFilters.disability === 'All'   || a.disability === colFilters.disability) &&
      (!colFilters.statistics_disability || colFilters.statistics_disability === 'All' || a.statistics_disability === colFilters.statistics_disability) &&
      (!colFilters.age_category || colFilters.age_category === 'All' || a.age_category === colFilters.age_category) &&
      (!colFilters.sport_age_category || colFilters.sport_age_category === 'All' || a.sport_age_category === colFilters.sport_age_category) &&
      (!colFilters.medical_status || colFilters.medical_status === 'All' || (colFilters.medical_status === 'None' ? !a.medical_status || a.medical_status === 'None' : a.medical_status === colFilters.medical_status)) &&
      (!colFilters.coachName    || colFilters.coachName === 'All'    || coaches.find(c => c.id === a.coach_id)?.name === colFilters.coachName) &&
      (!colFilters.documents    || colFilters.documents === 'All'    || (
        colFilters.documents === 'Complete' ? athleteDocStatus(a.id, documents).key === 'complete' :
        colFilters.documents === 'Missing'  ? athleteDocStatus(a.id, documents).key === 'missing'  :
        colFilters.documents === 'None'     ? athleteDocStatus(a.id, documents).key === 'none'     : true
      ))
    )
  }, [athletes, coaches, documents, search, sport, sportCategory, status, gender, colFilters, searchableValues])

  // Locale-aware, case-insensitive text compare; empty values always sort
  // last regardless of direction (per spec), by treating '' as "greater".
  function textCompare(av, bv, desc) {
    const a1 = (av ?? '').toString().trim()
    const b1 = (bv ?? '').toString().trim()
    if (!a1 && !b1) return 0
    if (!a1) return 1
    if (!b1) return -1
    return desc ? b1.localeCompare(a1, undefined, { sensitivity: 'base' }) : a1.localeCompare(b1, undefined, { sensitivity: 'base' })
  }
  function dateCompare(av, bv, desc) {
    const at = av ? new Date(av).getTime() : NaN
    const bt = bv ? new Date(bv).getTime() : NaN
    const aValid = !isNaN(at), bValid = !isNaN(bt)
    if (!aValid && !bValid) return 0
    if (!aValid) return 1
    if (!bValid) return -1
    return desc ? bt - at : at - bt
  }
  function numCompare(av, bv, desc) {
    const an = av === null || av === undefined || av === '' ? NaN : Number(av)
    const bn = bv === null || bv === undefined || bv === '' ? NaN : Number(bv)
    const aValid = !isNaN(an), bValid = !isNaN(bn)
    if (!aValid && !bValid) return 0
    if (!aValid) return 1
    if (!bValid) return -1
    return desc ? bn - an : an - bn
  }

  const sortedList = useMemo(() => {
    if (!sort) return filteredList
    const [key, dir] = sort.split(/-(asc|desc)$/).filter(Boolean)
    const desc = dir === 'desc'
    const coachName = a => { const c = coaches.find(co => co.id === a.coach_id); return c ? c.name : '' }
    const docsRank = a => { const ds = athleteDocStatus(a.id, documents); return ds.key === 'complete' ? 2 : ds.key === 'missing' ? 1 : 0 }
    const AGE_ORDER = ['Under 5','5 - 9','10 - 14','15 - 19','20 - 24','25 - 29','30 - 34','35 - 39','40 - 44','45 - 49','50 - 54','55 - 59','60 - 64','65+']
    const SPORT_AGE_ORDER = ['براعم (8-10)','أشبال (11-13)','شبلات (11-13)','ناشئين (14-17)','ناشئات (14-17)','شباب (17-20)','شابات (17-20)','رجال (20+)','سيدات (20+)']

    return [...filteredList].sort((a, b) => {
      switch (key) {
        case 'name':                   return textCompare(a.name, b.name, desc)
        case 'name_ar':                return textCompare(a.name_ar, b.name_ar, desc)
        case 'qss_number':             return textCompare(a.qss_number, b.qss_number, desc)
        case 'id_number':              return textCompare(a.id_number, b.id_number, desc)
        case 'career_profile':         return textCompare(a.career_profile, b.career_profile, desc)
        case 'sport_category':         return textCompare(a.sport_category, b.sport_category, desc)
        case 'sport':                  return textCompare(a.sport, b.sport, desc)
        case 'classification':         return textCompare(a.classification, b.classification, desc)
        case 'disability':             return textCompare(a.disability, b.disability, desc)
        case 'statistics_disability':  return textCompare(a.statistics_disability, b.statistics_disability, desc)
        case 'nationality':            return textCompare(a.nationality, b.nationality, desc)
        case 'gender':                 return textCompare(a.gender, b.gender, desc)
        case 'dob':                    return dateCompare(a.dob, b.dob, desc)
        case 'coach_id':                return textCompare(coachName(a), coachName(b), desc)
        // Status sort uses effectiveStatus(), matching display/filter logic.
        case 'status':                 return textCompare(effectiveStatus(a), effectiveStatus(b), desc)
        case 'medical_status':         return textCompare(a.medical_status, b.medical_status, desc)
        case 'phone':                  return textCompare(a.phone, b.phone, desc)
        case 'email':                  return textCompare(a.email, b.email, desc)
        case 'join_date':              return dateCompare(a.join_date, b.join_date, desc)
        case 'passport_number':        return textCompare(a.passport_number, b.passport_number, desc)
        case 'passport_expiry':        return dateCompare(a.passport_expiry, b.passport_expiry, desc)
        case 'id_expiry':              return dateCompare(a.id_expiry, b.id_expiry, desc)
        case 'medals':                 return numCompare((a.medals_gold||0)+(a.medals_silver||0)+(a.medals_bronze||0), (b.medals_gold||0)+(b.medals_silver||0)+(b.medals_bronze||0), desc)
        case 'documents':              return numCompare(docsRank(a), docsRank(b), desc)
        case 'missing_documents':      return numCompare(athleteDocStatus(a.id, documents).missing, athleteDocStatus(b.id, documents).missing, desc)
        case 'age_category': {
          const ai = AGE_ORDER.indexOf(a.age_category ?? ''), bi = AGE_ORDER.indexOf(b.age_category ?? '')
          if (ai === -1 && bi === -1) return 0
          if (ai === -1) return 1
          if (bi === -1) return -1
          return desc ? bi - ai : ai - bi
        }
        case 'sport_age_category': {
          const ai = SPORT_AGE_ORDER.indexOf(a.sport_age_category ?? ''), bi = SPORT_AGE_ORDER.indexOf(b.sport_age_category ?? '')
          if (ai === -1 && bi === -1) return 0
          if (ai === -1) return 1
          if (bi === -1) return -1
          return desc ? bi - ai : ai - bi
        }
        default: return 0
      }
    })
  }, [filteredList, sort, coaches, documents])

  const list = sortedList

  // Moved here from further down in the file, where they sat AFTER the
  // `if (selected) return (...)` detail-view early return — meaning the
  // list view executed these hooks but the detail view never did,
  // violating the Rules of Hooks (React error #300: hook count/order must
  // be identical on every render of the same component). All hooks must
  // be unconditional, top-level, and reached on every render.
  const [hoveredRowId, setHoveredRowId] = useState(null)
  const headerRowRef = useRef(null)
  const [headerRowHeight, setHeaderRowHeight] = useState(0)
  useLayoutEffect(() => {
    if (headerRowRef.current) setHeaderRowHeight(headerRowRef.current.offsetHeight)
  })

  async function handleSave(formData) {
    const isEdit = !!formData.id
    // Rule 4: temporary status dates only make sense alongside a dated
    // status (On Leave / In Competition / In Training Camp). If the person
    // was moved to any other status (most commonly back to Active), clear
    // status_start/status_end here regardless of whatever stale values the
    // form still happens to be holding — this is the one place status
    // actually gets written, so it's the authoritative guard against stale
    // dates lingering in the database.
    const DATE_STATUSES = ['On Leave', 'In Competition', 'In Training Camp']
    const isDatedStatus = DATE_STATUSES.includes(formData.status)
    const payload = {
      name: formData.name, name_ar: formData.nameAr, dob: formData.dob || null,
      gender: formData.gender, nationality: formData.nationality,
      sport_category: formData.sportCategory || null,
      sport: formData.sport, classification: formData.classification,
      disability: formData.disability, statistics_disability: formData.statistics_disability || null, coach_id: formData.coachId || null,
      status: formData.status,
      status_start: isDatedStatus ? (formData.statusStart||null) : null,
      status_end:   isDatedStatus ? (formData.statusEnd||null)   : null,
      phone: formData.phone, email: formData.email,
      join_date: formData.joinDate || null,
      medical_status: formData.medicalStatus || null,
      career_profile: formData.careerProfile || null,
      club: formData.club || null,
      designation: formData.designation || null,
      residency_status: formData.residencyStatus || null,
      qss_number: formData.qssNumber || null,
      passport_number: formData.passportNumber || null,
      passport_expiry: formData.passportExpiry || null,
      id_number: formData.idNumber || null,
      id_expiry: formData.idExpiry || null,
    }
    if (!payload.name) { toast('Name is required', 'error'); return }
    const priorRecord = isEdit ? athletes.find(a => a.id === formData.id) : null
    const { error } = isEdit
      ? await supabase.from('athletes').update(payload).eq('id', formData.id)
      : await supabase.from('athletes').insert(payload)
    if (error) { toast(error.message, 'error'); return }
    // Resolution rule: once an expiry date is actually changed (renewed or
    // corrected), any previously sent expiry reminders for that specific
    // document no longer reflect reality — clear them. The next reminder
    // check will naturally create a fresh one later if the new date is
    // itself approaching/past expiry.
    if (isEdit && priorRecord) {
      // dedup_key is always in a stable, language-independent format
      // ("document-warning-60/30-{id}-{docType}-{expiryDate}" or
      // "document-expired-{id}-{docType}-{cycle}-{expiryDate}"), unlike
      // title text which varies by language — matching on dedup_key
      // precisely targets only the relevant document's reminders, and also
      // clears any leftover key from the old pre-update reminder scheme.
      if (priorRecord.passport_expiry !== payload.passport_expiry) {
        await supabase.from('notifications').delete().eq('related_entity_type', 'athlete').eq('related_entity_id', String(formData.id))
          .or(`dedup_key.like.document-warning-60-${formData.id}-passport-%,dedup_key.like.document-warning-30-${formData.id}-passport-%,dedup_key.like.document-expired-${formData.id}-passport-%,dedup_key.like.passport-expiry-%`)
      }
      if (priorRecord.id_expiry !== payload.id_expiry) {
        await supabase.from('notifications').delete().eq('related_entity_type', 'athlete').eq('related_entity_id', String(formData.id))
          .or(`dedup_key.like.document-warning-60-${formData.id}-id-%,dedup_key.like.document-warning-30-${formData.id}-id-%,dedup_key.like.document-expired-${formData.id}-id-%,dedup_key.like.id-expiry-%`)
      }
    }
    toast(isEdit ? `${payload.name} updated` : `${payload.name} added`)
    if (isTrustedAdmin(profile)) {
      logAdminActivity({
        actor: profile, action: isEdit ? 'updated' : 'created',
        entityType: 'athlete', entityId: formData.id || null, entityLabel: payload.name,
        module: 'athletes',
      })
    }
    setForm(null); await onRefresh()
    if (isEdit) setSelected(formData.id)
  }

  async function handleDelete(id, name) {
    const { error } = await supabase.from('athletes').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} deleted`)
    if (isTrustedAdmin(profile)) {
      logAdminActivity({ actor: profile, action: 'deleted', entityType: 'athlete', entityId: id, entityLabel: name, module: 'athletes' })
    }
    setSelected(null); setConfirm(null); onRefresh()
  }

  async function handlePhotoUpload(athleteId, file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${athleteId}.${ext}`
      // Remove any existing photos first
      await supabase.storage.from('athlete-photos').remove([
        `${athleteId}.jpg`, `${athleteId}.jpeg`, `${athleteId}.png`, `${athleteId}.webp`
      ])
      const { error: upErr } = await supabase.storage.from('athlete-photos').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('athlete-photos').getPublicUrl(path)
      const photoUrl = data.publicUrl + '?t=' + Date.now()
      const { error: dbErr } = await supabase.from('athletes').update({ photo_url: photoUrl }).eq('id', athleteId)
      if (dbErr) throw dbErr
      toast('Photo updated!'); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setUploading(false) }
  }

  async function handlePhotoRemove(athleteId) {
    const { error } = await supabase.from('athletes').update({ photo_url: null }).eq('id', athleteId)
    if (error) { toast(error.message, 'error'); return }
    toast('Photo removed'); await onRefresh()
  }

  async function handleDocUpload(athleteId, file) {
    if (!file) return
    if (!docType) { toast('Select a document type first', 'error'); return }
    if (file.size > 20 * 1024 * 1024) { toast('File must be under 20MB', 'error'); return }
    setDocUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${athleteId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('athlete-documents').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('athlete-documents').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('athlete_documents').insert({
        athlete_id: athleteId, name: file.name, type: docType,
        file_url: data.publicUrl, file_path: path, file_size: file.size,
      })
      if (dbErr) throw dbErr
      toast(`${docType} uploaded!`)
      if (isTrustedAdmin(profile)) {
        const athleteName = athletes.find(a => a.id === athleteId)?.name || String(athleteId)
        logAdminActivity({ actor: profile, action: 'created', entityType: 'document', entityId: athleteId, entityLabel: `${docType} for ${athleteName}`, module: 'athletes' })
      }
      await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setDocUploading(false); setDocType(''); if (docInput.current) docInput.current.value = '' }
  }

  async function handleDocDelete(doc) {
    await supabase.storage.from('athlete-documents').remove([doc.file_path])
    const { error } = await supabase.from('athlete_documents').delete().eq('id', doc.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Document deleted')
    if (isTrustedAdmin(profile)) {
      const athleteName = athletes.find(a => a.id === doc.athlete_id)?.name || String(doc.athlete_id)
      logAdminActivity({ actor: profile, action: 'deleted', entityType: 'document', entityId: doc.athlete_id, entityLabel: `${doc.type || 'document'} for ${athleteName}`, module: 'athletes' })
    }
    setDocConfirm(null); await onRefresh()
  }

  async function saveNotes(athleteId) {
    setSavingNotes(true)
    const { error } = await supabase.from('athletes').update({ notes }).eq('id', athleteId)
    if (error) { toast(error.message, 'error') }
    else { toast('Notes saved'); setNotesChanged(false); setNotesSavedAt(Date.now()); await onRefresh() }
    setSavingNotes(false)
  }

  // ── PDF EXPORT ──
  function exportPDF(a, coach, myResults, myDocs, myEvents) {
    const age = calcAge(a.dob)
    const yearsActive = calcYearsActive(a.join_date)
    const bests = getPersonalBests(myResults)
    const isAr = lang === 'ar'
    const dir = isAr ? 'rtl' : 'ltr'

    const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Injured':'مصاب','Under Medical Review':'تحت المراجعة الطبية','Suspended':'موقوف','Retired':'متقاعد'}
    const DIS_AR = {'Visual Impairment':'إعاقة بصرية','Hearing Impairment':'إعاقة سمعية','Physical Impairment':'إعاقة جسدية','Intellectual Disability':'إعاقة ذهنية','Spinal Cord Injury':'إصابة الحبل الشوكي','Cerebral Palsy':'شلل دماغي','Amputation':'بتر','Down Syndrome':'متلازمة داون','Autism':'التوحد','Multiple Disabilities':'إعاقات متعددة'}
    const COUNTRY_AR = {'Qatar':'قطر','Egypt':'مصر','Algeria':'الجزائر','Morocco':'المغرب','Jordan':'الأردن','Saudi Arabia':'المملكة العربية السعودية','UAE':'الإمارات','Iraq':'العراق','Syria':'سوريا','Yemen':'اليمن','Somalia':'الصومال','Sudan':'السودان','Libya':'ليبيا','Tunisia':'تونس','Pakistan':'باكستان','India':'الهند','Iran':'إيران','Turkey':'تركيا','Azerbaijan':'أذربيجان','Ireland':'أيرلندا','France':'فرنسا','Spain':'إسبانيا','Germany':'ألمانيا','UK':'المملكة المتحدة','USA':'الولايات المتحدة'}
    const MEDAL_AR = {'gold':'ذهب','silver':'فضة','bronze':'برونز'}
    const DESIG_AR = {'Player':'لاعب','Female Player':'لاعبة','Coach':'مدرب','Female Coach':'مدربة','Referee':'حكم','Admin Staff':'جهاز إداري'}
    const RESID_AR = {'Qatari Male':'قطري','Qatari Female':'قطرية','Resident Male':'مقيم','Resident Female':'مقيمة','Professional Male':'محترف','Professional Female':'محترفة','Born in Qatar':'مواليد قطر','Qatari Mother':'أم قطرية'}

    const t = (en, arObj, val) => val ? (isAr ? (arObj[val] || (COUNTRY_AR[val]) || val) : val) : '—'
    const L = (en, ar) => isAr ? ar : en
    const field = (k, v) => {
      const clean = (v === null || v === undefined || v === 'null' || v === 'undefined' || v === '') ? null : v
      return clean ? `<div class="field"><span class="k">${k}</span><span class="v">${clean}</span></div>` : ''
    }
    const expiredLabel = isAr ? '⚠ منتهية' : '⚠ EXPIRED'

    const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr?'ar':'en'}"><head><meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #1a1d23; padding: 32px; font-size: 13px; direction: ${dir}; }
  .header { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 3px solid #0085C7; }
  .dot { width: 14px; height: 14px; border-radius: 50%; }
  .header-text h1 { font-size: 20px; font-weight: 700; color: #0a1628; }
  .header-text p { font-size: 12px; color: #9aa3b2; margin-top: 2px; }
  .profile-header { display: flex; gap: 20px; margin-bottom: 24px; }
  .photo { width: 80px; height: 80px; border-radius: 50%; background: #0085C7; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 28px; font-weight: 700; flex-shrink: 0; overflow: hidden; }
  .photo img { width: 100%; height: 100%; object-fit: cover; }
  .profile-info h2 { font-size: 22px; font-weight: 700; }
  .profile-info .sub { font-size: 13px; color: #5a6272; margin-top: 3px; }
  .badges { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-blue { background: #e8f3fb; color: #1565a0; }
  .badge-green { background: #e6f4ee; color: #0d6e42; }
  .badge-gray { background: #f0f1f3; color: #555e70; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: 700; color: #9aa3b2; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e5ea; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  .field { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f1f3; font-size: 12px; }
  .field .k { color: #5a6272; }
  .field .v { font-weight: 600; text-align: ${isAr?'left':'right'}; }
  .medal-row { display: flex; gap: 24px; }
  .medal-item { text-align: center; }
  .medal-num { font-size: 24px; font-weight: 700; }
  .result-row { display: flex; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f1f3; font-size: 12px; }
  .doc-row { padding: 6px 0; border-bottom: 1px solid #f0f1f3; font-size: 12px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e5ea; font-size: 10px; color: #9aa3b2; text-align: center; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="no-print" style="position:fixed;top:16px;left:16px;z-index:999">
  <button onclick="if(window.opener||window.history.length<=1){window.close()}else{history.back()}"
    style="display:flex;align-items:center;gap:6px;padding:9px 18px;background:#0a1628;color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer;font-family:Arial;box-shadow:0 2px 12px rgba(0,0,0,.3)">
    &#8592; Back
  </button>
</div>

<div class="header">
  <div class="header-logo" style="display:flex;gap:5px">
    <div class="dot" style="background:#EE334E"></div>
    <div class="dot" style="background:#0085C7"></div>
    <div class="dot" style="background:#009F6B"></div>
  </div>
  <div class="header-text">
    <h1>${isAr ? 'الاتحاد القطري لذوي الاحتياجات الخاصة' : 'Qatar Paralympic Committee'}</h1>
    <p>${isAr ? `ملف الرياضي الرسمي · تم الإنشاء ${new Date().toLocaleDateString('ar-QA')}` : `Official Athlete Profile · Generated ${new Date().toLocaleDateString()}`}</p>
  </div>
</div>

<div class="profile-header">
  <div class="photo">${a.photo_url ? `<img src="${a.photo_url}" />` : initials(a.name)}</div>
  <div class="profile-info">
    <h2>${isAr && a.name_ar ? a.name_ar : a.name}</h2>
    <p class="sub">${isAr && a.name_ar ? a.name : (a.name_ar || '')}</p>
    <div class="badges">
      ${a.sport ? `<span class="badge badge-blue">${sportLabel(a.sport, a.sport_category, isAr)}</span>` : `<span class="badge badge-gray">${L('No Sport Assigned','لم يتم تحديد الرياضة')}</span>`}
      ${a.classification ? `<span class="badge badge-blue">${a.classification}</span>` : ''}
      <span class="badge badge-${(()=>{const es=effectiveStatus(a);return es==='Active'?'green':es==='Inactive'?'gray':es==='Retired'||es==='Suspended'?'red':es==='Injured'||es==='Under Medical Review'?'red':'amber'})()}">"${isAr ? (STATUS_AR[effectiveStatus(a)]||effectiveStatus(a)||L('Unknown','غير محدد')) : (effectiveStatus(a)||'Unknown')}</span>
    </div>
    <p style="margin-top:8px;color:#9aa3b2;font-size:11px">
      ${age ? (isAr ? `${age} ${L('years old','سنة')}` : `Age ${age}`) : ''}
      ${age && yearsActive ? ' · ' : ''}
      ${yearsActive ? (isAr ? `${yearsActive} ${L('years with QPC','سنوات مع QPC')}` : `${yearsActive} years with QPC`) : ''}
    </p>
  </div>
</div>

<div class="section">
  <div class="section-title">${L('Personal Information','المعلومات الشخصية')}</div>
  <div class="grid-2">
    ${field(L('Date of birth','تاريخ الميلاد'), a.dob)}
    ${field(L('Gender','الجنس'), a.gender ? (isAr ? (a.gender==='Male'?'ذكر':'أنثى') : a.gender) : null)}
    ${field(L('Nationality','الجنسية'), isAr ? (COUNTRY_AR[a.nationality]||a.nationality) : a.nationality)}
    ${field(L('Phone','الهاتف'), a.phone)}
    ${field(L('Email','البريد الإلكتروني'), a.email)}
    ${field(L('Joined QPC','تاريخ الانضمام'), a.join_date)}
    ${field(L('Age category','الفئة العمرية'), a.age_category)}
    ${field(L('Sport age category','الفئة العمرية الرياضية'), a.sport_age_category)}
    ${field(L('QSS Number','رقم QSS'), a.qss_number)}
  </div>
</div>

<div class="section">
  <div class="section-title">${L('Sport & Classification','الرياضة والتصنيف')}</div>
  <div class="grid-2">
    ${field(L('Sport','الرياضة'), a.sport ? sportLabel(a.sport, a.sport_category, isAr) : '')}
    ${field(L('Classification','التصنيف'), a.classification)}
    ${field(L('Disability type','نوع الإعاقة'), isAr ? (DIS_AR[a.disability]||a.disability) : a.disability)}
    ${field(L('Head coach','المدرب الرئيسي'), coach ? (isAr && coach.name_ar ? coach.name_ar : coach.name) : L('Unassigned','غير معين'))}
    ${field(L('Medical status','الحالة الطبية'), a.medical_status)}
    ${field(L('Career profile #','رقم المسار'), a.career_profile)}
  </div>
</div>

<div class="section">
  <div class="section-title">${L('Club & Role','النادي والدور')}</div>
  <div class="grid-2">
    ${field(L('Club','النادي'), a.club)}
    ${field(L('Designation','الوظيفة'), isAr ? (DESIG_AR[a.designation]||a.designation) : a.designation)}
    ${field(L('Residency status','الصفة'), isAr ? (RESID_AR[a.residency_status]||a.residency_status) : a.residency_status)}
  </div>
</div>

${(a.passport_number || a.id_number || a.passport_expiry || a.id_expiry) ? `<div class="section">
  <div class="section-title">${L('Passport & ID','الجواز والهوية')}</div>
  <div class="grid-2">
    ${field(L('Passport number','رقم الجواز'), a.passport_number)}
    ${a.passport_expiry ? `<div class="field"><span class="k">${L('Passport expiry','انتهاء الجواز')}</span><span class="v" style="${new Date(a.passport_expiry)<new Date()?'color:#dc2626':''}">${a.passport_expiry}${new Date(a.passport_expiry)<new Date()?' '+expiredLabel:''}</span></div>` : ''}
    ${field(L('Qatar ID number','الرقم الشخصي'), a.id_number)}
    ${a.id_expiry ? `<div class="field"><span class="k">${L('ID expiry','انتهاء الهوية')}</span><span class="v" style="${new Date(a.id_expiry)<new Date()?'color:#dc2626':''}">${a.id_expiry}${new Date(a.id_expiry)<new Date()?' '+expiredLabel:''}</span></div>` : ''}
  </div>
</div>` : ''}





<div class="section">
  <div class="section-title">${L('Medals','الميداليات')}</div>
  <div class="medal-row">
    <div class="medal-item"><div class="medal-num" style="color:#f1c40f">${a.medals_gold||0}</div><div style="font-size:11px;color:#9aa3b2">${L('Gold','ذهب')}</div></div>
    <div class="medal-item"><div class="medal-num" style="color:#aaa">${a.medals_silver||0}</div><div style="font-size:11px;color:#9aa3b2">${L('Silver','فضة')}</div></div>
    <div class="medal-item"><div class="medal-num" style="color:#cd7f32">${a.medals_bronze||0}</div><div style="font-size:11px;color:#9aa3b2">${L('Bronze','برونز')}</div></div>
  </div>
</div>

${myResults.length > 0 ? `<div class="section">
  <div class="section-title">${L('Competition Results','سجل النتائج')}</div>
  ${myResults.map(r => `<div class="result-row">
    <span style="font-size:18px">${r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'}</span>
    <div style="flex:1"><div style="font-weight:500">${r.event_name}</div><div style="color:#9aa3b2">${r.discipline||''}</div></div>
    <span style="font-weight:600;color:#0085C7">${r.result||''}</span>
    <span style="color:#9aa3b2">${r.date||''}</span>
  </div>`).join('')}
</div>` : ''}

${myEvents.length > 0 ? `<div class="section">
  <div class="section-title">${L('Competition History','سجل المنافسات')}</div>
  ${myEvents.map(ev => `<div class="doc-row">
    <span style="font-weight:500">${ev.name}</span>
    <span style="color:#9aa3b2;margin-${isAr?'right':'left'}:10px">${ev.start_date||''}</span>
  </div>`).join('')}
</div>` : ''}

${myDocs.length > 0 ? `<div class="section">
  <div class="section-title">${L('Documents','الوثائق')}</div>
  ${myDocs.map(d => `<div class="doc-row"><span style="font-weight:500">${d.type}</span> — <span style="color:#9aa3b2">${d.name}</span></div>`).join('')}
</div>` : ''}

<div class="footer">${isAr ? 'الاتحاد القطري لذوي الاحتياجات الخاصة · سري · ' : 'Qatar Paralympic Committee · Confidential · '}${new Date().getFullYear()}</div>
</body></html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  // ── DETAIL VIEW ──
  if (selected) {
    const a = athletes.find(x => String(x.id) === String(selected))
    if (!a) { setSelected(null); return null }
    const coach      = coaches.find(c => c.id === a.coach_id)
    const myResults  = (results || []).filter(r => r.athlete_id === a.id)
    const myDocs     = (documents || []).filter(d => d.athlete_id === a.id)
    const myEventIds = (registrations || []).filter(r => r.athlete_id === a.id).map(r => r.event_id)
    const myEvents   = (events || []).filter(e => myEventIds.includes(e.id)).sort((a,b) => new Date(b.start_date) - new Date(a.start_date))
    const docsByType = DOC_TYPES.reduce((acc, t) => { acc[t] = myDocs.filter(d => d.type === t); return acc }, {})
    const bests      = getPersonalBests(myResults)
    const age        = calcAge(a.dob)
    const yearsActive = calcYearsActive(a.join_date)

    return (
      <div>
        {form && (
          <FormModal type="athlete"
            record={form==='edit' ? athleteToFormFields(a) : null}
            coaches={coaches} onSave={handleSave} onClose={() => setForm(null)} />
        )}
        {confirm && <ConfirmModal title="Delete athlete" message={`Delete ${a.name}? This cannot be undone.`} onConfirm={() => handleDelete(a.id, a.name)} onCancel={() => setConfirm(null)} />}
        {docConfirm && <ConfirmModal title="Delete document" message={`Delete "${docConfirm.name}"?`} onConfirm={() => handleDocDelete(docConfirm)} onCancel={() => setDocConfirm(null)} />}
        {medalModal && (
          <div className="modal-overlay" onClick={() => setMedalModal(null)}>
            <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">{medalModal.type==='gold'?'🥇':medalModal.type==='silver'?'🥈':'🥉'} {medalModal.label} Medals — {medalModal.athleteName}</div>
                <button className="modal-close" onClick={() => setMedalModal(null)}><i className="ti ti-x" /></button>
              </div>
              <div className="modal-body">
                {medalModal.results.length === 0
                  ? <div className="empty">No {medalModal.label.toLowerCase()} medals recorded yet.</div>
                  : medalModal.results.map(r => (
                    <div key={r.id} style={{ display:'flex', gap:14, alignItems:'flex-start', padding:'14px 0', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ width:44, height:44, borderRadius:'50%', background:medalModal.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                        {medalModal.type==='gold'?'🥇':medalModal.type==='silver'?'🥈':'🥉'}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>{r.discipline}</div>
                        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:8 }}>{r.event_name}</div>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                          <span className="badge badge-blue">{r.result}</span>
                          <span className="badge badge-gray"><i className="ti ti-calendar" style={{ fontSize:11, verticalAlign:-1, marginRight:3 }} />{r.date}</span>
                          <span className="badge" style={{ background:medalModal.color+'18', color:medalModal.color }}>Position #{r.position}</span>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> {tx('actions.back','Back')}</button>
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          {canEdit(profile) && <>
            <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> {tx('actions.edit','Edit')}</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> {tx('actions.delete','Delete')}</button>
          </>}
          <button className="action-btn action-btn-edit" onClick={() => exportPDF(a, coach, myResults, myDocs, myEvents)}
            style={{ borderColor:'#009F6B', color:'#009F6B' }}
            onMouseEnter={e => { e.currentTarget.style.background='#e6f4ee' }}
            onMouseLeave={e => { e.currentTarget.style.background='' }}>
            <i className="ti ti-printer" /> {tx('actions.exportPDF','Export PDF')}
          </button>
          <AthleteCardButton athlete={a} />
        </div>

        <div className="detail-grid">
          <div>
            {/* PROFILE CARD */}
            <div className="detail-profile">
              <div style={{ position:'relative', width:90, height:90, margin:'0 auto 14px' }}>
                {a.photo_url
                  ? <img src={a.photo_url} alt={a.name} style={{ width:90, height:90, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--border)' }} />
                  : <div style={{ width:90, height:90, borderRadius:'50%', background:avColor(a.id), display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:600, color:'#fff' }}>{initials(a.name)}</div>
                }
                {canEdit(profile) && (
                  <div style={{ position:'absolute', bottom:0, right:0, display:'flex', gap:3 }}>
                    <button onClick={() => photoInput.current.click()} disabled={uploading} title="Upload photo"
                      style={{ width:26, height:26, borderRadius:'50%', background:'#0085C7', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                      {uploading ? <div style={{ width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> : <i className="ti ti-camera" style={{ fontSize:12 }} />}
                    </button>
                    {a.photo_url && (
                      <button onClick={() => handlePhotoRemove(a.id)} title="Remove photo"
                        style={{ width:26, height:26, borderRadius:'50%', background:'#dc2626', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                        <i className="ti ti-x" style={{ fontSize:12 }} />
                      </button>
                    )}
                  </div>
                )}
                <input ref={photoInput} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { if(e.target.files[0]) { setCropFile({ athleteId: a.id, file: e.target.files[0] }); e.target.value = '' } }} />
              </div>
              {cropFile && cropFile.athleteId === a.id && (
                <PhotoCropModal file={cropFile.file}
                  onCancel={() => setCropFile(null)}
                  onSave={(blob) => { setCropFile(null); handlePhotoUpload(a.id, blob) }} />
              )}
              <div className="detail-name">{lang==='ar' && a.name_ar ? a.name_ar : a.name}</div>
              {(lang==='ar' && a.name_ar ? a.name : a.name_ar) && <div className="detail-sub">{lang==='ar' && a.name_ar ? a.name : a.name_ar}</div>}
              <div className="detail-badges">
                <Badge label={{'Active':lang==='ar'?'نشط':'Active','On Leave':lang==='ar'?'في إجازة':'On Leave','In Competition':lang==='ar'?'في منافسة':'In Competition','In Training Camp':lang==='ar'?'في معسكر تدريبي':'In Training Camp','Inactive':lang==='ar'?'غير نشط':'Inactive','Injured':lang==='ar'?'مصاب':'Injured','Under Medical Review':lang==='ar'?'تحت المراجعة الطبية':'Under Medical Review','Suspended':lang==='ar'?'موقوف':'Suspended','Retired':lang==='ar'?'متقاعد':'Retired'}[effectiveStatus(a)]||effectiveStatus(a)} />
                {/* Rule 5: once status_end has actually passed, the person
                    has effectively returned to Active and the old dates are
                    stale — don't show them (even though they may still sit
                    in the database until the record is next edited). A
                    future-scheduled leave/camp/competition whose start date
                    hasn't arrived yet is still shown here, since that's
                    useful context, not stale data. */}
                {(a.status_start || a.status_end) && !(a.status_end && new Date(a.status_end) < new Date(new Date().toDateString())) && (
                  <Badge label={[a.status_start, a.status_end].filter(Boolean).join(' → ')} />
                )}
                <span className="badge badge-blue">{a.sport ? sportLabel(a.sport, a.sport_category, lang==='ar') : ''}</span>
              </div>
              <RoleBadges roles={personRolesAthlete} lang={lang} excludeType="athlete" />

              {/* AGE & YEARS ACTIVE */}
              {(age || yearsActive) && (
                <div style={{ display:'flex', justifyContent:'center', gap:16, margin:'12px 0', padding:'10px', background:'var(--surface2)', borderRadius:10 }}>
                  {age && <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:600, color:'#0085C7' }}>{age}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{lang==='ar'?'سنة':'years old'}</div>
                  </div>}
                  {age && yearsActive && <div style={{ width:1, background:'var(--border)' }} />}
                  {yearsActive && <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:16, fontWeight:600, color:'#009F6B' }}>{yearsActive}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{lang==='ar'?'مع QPC':'with QPC'}</div>
                  </div>}
                </div>
              )}

              <div className="detail-fields">
                {[
                  [tx('profile.dateOfBirth','Date of birth'), formatFriendlyDate(a.dob, lang==='ar')],
                  [tx('profile.gender','Gender'), a.gender ? (lang==='ar' ? (a.gender==='Male'?'ذكر':'أنثى') : a.gender) : null],
                  [tx('profile.nationality','Nationality'), tc(a.nationality)],
                  [tx('profile.phone','Phone'), a.phone],
                  [tx('profile.email','Email'), a.email],
                ].filter(([, v]) => v).map(([k,v]) => (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
                ))}
              </div>
            </div>

            {/* MEDALS */}
            <div className="info-card" style={{ marginTop:12 }}>
              <div className="info-title">{lang==='ar'?'عدد الميداليات':'Medal count'} <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>({lang==='ar'?'انقر للتفاصيل':'click to see details'})</span></div>
              <div className="medal-row">
                {[['gold','#f1c40f',lang==='ar'?'ذهب':'Gold'],['silver','#aaa',lang==='ar'?'فضة':'Silver'],['bronze','#cd7f32',lang==='ar'?'برونز':'Bronze']].map(([type,color,label]) => {
                  const count   = a[`medals_${type}`] || 0
                  const typeRes = myResults.filter(r => r.medal === type)
                  return (
                    <div key={type} className="medal-item"
                      style={{ cursor:count>0?'pointer':'default', borderRadius:10, padding:'8px 4px', transition:'background .15s' }}
                      onMouseEnter={e => { if(count>0) e.currentTarget.style.background='#f4f6f9' }}
                      onMouseLeave={e => { e.currentTarget.style.background='' }}
                      onClick={() => { if(count>0) setMedalModal({ athleteName:a.name, type, color, label, results:typeRes }) }}>
                      <div className="medal-num" style={{ color }}>{count}</div>
                      <div className="medal-lbl">{label}</div>
                      {count>0 && <div style={{ fontSize:9, color, marginTop:2, opacity:.8 }}>{lang==='ar'?'عرض ↗':'view ↗'}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* DOCUMENT STATUS */}
            {(() => {
              const ds = athleteDocStatus(a.id, documents)
              const total = REQUIRED_DOC_TYPES.length
              const uploaded = total - ds.missing
              const pct = total > 0 ? Math.round((uploaded / total) * 100) : 100
              return (
                <div className="info-card">
                  <div className="info-title" style={{ marginBottom:10 }}>{lang==='ar'?'حالة الوثائق':'Document status'}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom: ds.missing > 0 ? 10 : 0 }}>
                    <div style={{ fontSize:22, fontWeight:700, color: pct === 100 ? '#009F6B' : pct >= 50 ? '#f59e0b' : '#dc2626' }}>{pct}%</div>
                    <div style={{ flex:1 }}>
                      <div style={{ height:8, borderRadius:6, background:'var(--surface2)', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background: pct === 100 ? '#009F6B' : pct >= 50 ? '#f59e0b' : '#dc2626', transition:'width .2s' }} />
                      </div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
                        {uploaded}/{total} {lang==='ar' ? 'مطلوب مرفوع' : 'required uploaded'}
                      </div>
                    </div>
                  </div>
                  {ds.missing > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {ds.missingTypes.map(t => (
                        <span key={t} className="badge" style={{ fontSize:10, background:'#fef2f2', color:'#dc2626' }}>
                          {lang==='ar' ? (DOC_TYPES_AR[t]||t) : t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* ATHLETE OVERVIEW */}
            {(() => {
              const DESIG_AR = {'Player':'لاعب','Female Player':'لاعبة','Coach':'مدرب','Female Coach':'مدربة','Referee':'حكم','Admin Staff':'جهاز إداري','Technical Staff':'جهاز فني','Medical Staff':'جهاز طبي'}
              const statusDates = (a.status_start || a.status_end) && !(a.status_end && new Date(a.status_end) < new Date(new Date().toDateString()))
                ? [a.status_start, a.status_end].filter(Boolean).join(' → ') : null
              const fields = [
                [lang==='ar'?'فئة الرياضة':'Sport category', a.sport_category ? (lang==='ar' ? (SPORT_CATEGORY_NAMES_AR[a.sport_category]||a.sport_category) : a.sport_category) : null],
                [tx('form.sport','Sport'), a.sport ? sportLabel(a.sport, a.sport_category, lang==='ar') : null],
                [tx('form.classification','Classification'), a.classification],
                [tx('form.disability','Disability type'), tDis(a.disability)],
                [lang==='ar'?'الإعاقة الإحصائية':'Statistics disability', tStatDis(a.statistics_disability)],
                [tx('athletes.medicalStatus','Medical Status'), a.medical_status],
                [tx('athletes.careerProfile','Career Profile #'), a.career_profile],
                [tx('form.club','Club'), a.club],
                [lang==='ar'?'الوظيفة':'Designation', a.designation ? (lang==='ar' ? (DESIG_AR[a.designation]||a.designation) : a.designation) : null],
                [tx('form.residencyStatus','Residency status'), a.residency_status],
                [tx('form.qssNumber','QSS number'), a.qss_number],
                [tx('athletes.joinedQPC','Joined QPC'), formatFriendlyDate(a.join_date, lang==='ar')],
                [lang==='ar'?'فترة الحالة المؤقتة':'Temporary status dates', statusDates],
              ].filter(([k, v]) => k && v)

              if (fields.length === 0) return null
              return (
                <div className="info-card">
                  <div className="info-title" style={{ marginBottom:10 }}>{lang==='ar'?'نظرة عامة على الرياضي':'Athlete overview'}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'4px 16px' }}>
                    {fields.map(([k,v]) => (
                      <div key={k} className="detail-row" style={{ minWidth:0 }}>
                        <span className="dk">{k}</span>
                        <span className="dv" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* COACH */}
            <div className="info-card">
              <div className="info-title">{lang==='ar'?'المدرب الرئيسي':'Head coach'} <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>— {lang==='ar'?'انقر للعرض':'click to view'}</span></div>
              {coach ? (
                <DashRow onClick={() => onNav('coaches', { coachId: coach.id })}>
                  <div className="av" style={{ width:28, height:28, fontSize:10, background:'#009F6B', flexShrink:0 }}>{initials(coach.name)}</div>
                  <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:500 }}>{lang==='ar'&&coach.name_ar?coach.name_ar:coach.name}</div><div style={{ fontSize:11, color:'#9aa3b2' }}>{coach.sport} · {coach.cert_level}</div></div>
                </DashRow>
              ) : <div style={{ padding:'8px 0', fontSize:13, color:'var(--text3)' }}>{lang==='ar'?'لم يتم تعيين مدرب':'No coach assigned'}</div>}
              <AthleteCoachHistory athleteId={String(a.id)} coaches={coaches} employees={employees} lang={lang} />
            </div>

            {/* PASSPORT & ID — gated to admin visibility; blank expiry rows
                are hidden entirely, but an expired date is always shown and
                clearly marked. */}
            {canEdit(profile) && (a.passport_number || a.id_number) && (
              <div className="info-card">
                <div className="info-title">{tx('profile.passportID','Passport & ID')}</div>
                {a.passport_number && (() => {
                  const expired = a.passport_expiry && new Date(a.passport_expiry) < new Date()
                  return (
                    <>
                      <div className="detail-row"><span className="dk">{tx('form.passportNumber','Passport number')}</span><span className="dv">{a.passport_number}</span></div>
                      {a.passport_expiry && (
                        <div className="detail-row">
                          <span className="dk">{tx('form.passportExpiry','Passport expiry')}</span>
                          <span className="dv" style={{ color: expired ? '#dc2626' : 'inherit' }}>
                            {formatFriendlyDate(a.passport_expiry, lang==='ar')}
                            {expired && <span style={{ marginLeft:6, fontSize:10, color:'#dc2626', fontWeight:600 }}>{lang==='ar'?'منتهية':'EXPIRED'}</span>}
                          </span>
                        </div>
                      )}
                    </>
                  )
                })()}
                {a.id_number && (() => {
                  const expired = a.id_expiry && new Date(a.id_expiry) < new Date()
                  return (
                    <>
                      <div className="detail-row"><span className="dk">{lang==='ar'?'الرقم الشخصي':'Qatar ID number'}</span><span className="dv">{a.id_number}</span></div>
                      {a.id_expiry && (
                        <div className="detail-row">
                          <span className="dk">{lang==='ar'?'انتهاء الهوية':'ID expiry'}</span>
                          <span className="dv" style={{ color: expired ? '#dc2626' : 'inherit' }}>
                            {formatFriendlyDate(a.id_expiry, lang==='ar')}
                            {expired && <span style={{ marginLeft:6, fontSize:10, color:'#dc2626', fontWeight:600 }}>{lang==='ar'?'منتهية':'EXPIRED'}</span>}
                          </span>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}

            {/* PERSONAL BESTS */}
            {bests.length > 0 && (
              <div className="info-card">
                <div className="info-title">{tx('profile.personalBests','Personal bests')}</div>
                {bests.map(r => (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':r.medal==='bronze'?'🥉':'📋'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{r.discipline}</div>
                      <div style={{ fontSize:11, color:'var(--text2)' }}>{r.event_name}</div>
                    </div>
                    <span style={{ fontSize:13, fontWeight:600, color:'#0085C7' }}>{r.result}</span>
                  </div>
                ))}
              </div>
            )}

            {/* COMPETITION HISTORY — collapses to a compact single line
                when empty instead of a large empty card. */}
            {myEvents.length === 0 ? (
              <div className="info-card" style={{ padding:'12px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text3)' }}>
                  <i className="ti ti-trophy" />
                  {lang==='ar'?'سجل المنافسات':'Competition history'}
                  <span style={{ fontStyle:'italic' }}>— {lang==='ar'?'لا يوجد تسجيل بعد':'not registered yet'}</span>
                </div>
              </div>
            ) : (
            <div className="info-card">
              <div className="info-title" style={{ marginBottom: competitionExpanded ? 14 : 0, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                onClick={() => setCompetitionExpanded(v => !v)}>
                <span>
                  {lang==='ar'?'سجل المنافسات':'Competition history'}
                  <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>{myEvents.length}</span>
                </span>
                <i className={`ti ti-chevron-${competitionExpanded ? 'up' : 'down'}`} style={{ fontSize:16, color:'var(--text3)' }} />
              </div>
              {competitionExpanded && (
                <div style={{ position:'relative' }}>
                    <div style={{ position:'absolute', left:15, top:6, bottom:6, width:2, background:'var(--border)', borderRadius:2 }} />
                    {myEvents.map(ev => {
                      const evResults = (results||[]).filter(r => r.athlete_id === a.id && r.event_name === ev.name)
                      const medals    = evResults.filter(r => r.medal)
                      const dotColor  = ev.status==='Completed' ? medals.length>0 ? '#f1c40f' : '#009F6B' : ev.status==='Upcoming' ? '#0085C7' : ev.status==='Registration Open' ? '#8b5cf6' : '#9aa3b2'
                      return (
                        <div key={ev.id} style={{ display:'flex', gap:14, marginBottom:16, position:'relative' }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background:dotColor+'20', border:`2px solid ${dotColor}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1 }}>
                            {ev.status==='Completed' && medals.length>0
                              ? <span style={{ fontSize:14 }}>{medals[0].medal==='gold'?'🥇':medals[0].medal==='silver'?'🥈':'🥉'}</span>
                              : <i className={`ti ${ev.status==='Completed'?'ti-check':'ti-calendar'}`} style={{ fontSize:13, color:dotColor }} />
                            }
                          </div>
                          <div style={{ flex:1, paddingTop:4 }}>
                            <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{ev.name}</div>
                            <div style={{ fontSize:11, color:'var(--text2)', marginBottom:4, display:'flex', gap:10, flexWrap:'wrap' }}>
                              <span><i className="ti ti-map-pin" style={{ fontSize:11, marginRight:3 }} />{ev.venue}</span>
                              <span><i className="ti ti-calendar" style={{ fontSize:11, marginRight:3 }} />{ev.start_date}</span>
                            </div>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                              <span className="badge badge-blue" style={{ fontSize:10 }}>{ev.sport}</span>
                              <span className="badge" style={{ fontSize:10, background:dotColor+'15', color:dotColor }}>{ev.status}</span>
                              {medals.map(r => <span key={r.id} style={{ fontSize:11 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'} {r.discipline} — {r.result}</span>)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
              )}
            </div>
            )}

            {/* NOTES */}
            <div className="info-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div className="info-title" style={{ margin:0 }}>
                  {lang==='ar'?'ملاحظات':'Notes'}
                  <span style={{ marginLeft:6, fontSize:10, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>— {lang==='ar'?'خاص، يظهر للمسؤولين فقط':'private, visible to admins only'}</span>
                </div>
                {canEdit(profile) && (
                  notesChanged ? (
                    <button onClick={() => saveNotes(a.id)} disabled={savingNotes}
                      style={{ padding:'4px 12px', background:'#0085C7', color:'#fff', border:'none', borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'DM Sans, sans-serif' }}>
                      {savingNotes ? (lang==='ar'?'جارٍ الحفظ…':'Saving…') : <><i className="ti ti-device-floppy" style={{ fontSize:13 }} /> {lang==='ar'?'حفظ':'Save'}</>}
                    </button>
                  ) : notesSavedAt ? (
                    <span style={{ fontSize:11, color:'#009F6B', display:'flex', alignItems:'center', gap:4 }}>
                      <i className="ti ti-circle-check" style={{ fontSize:13 }} /> {lang==='ar'?'تم الحفظ':'Saved'}
                    </span>
                  ) : null
                )}
              </div>
              {canEdit(profile)
                ? <textarea
                    value={notes}
                    onChange={e => { setNotes(e.target.value); setNotesChanged(true) }}
                    placeholder={lang==='ar'?'أضف ملاحظات عن هذا الرياضي…':'Add notes about this athlete…'}
                    style={{ width:'100%', minHeight:100, padding:'10px 12px', borderRadius:9, border:'1px solid var(--border)', background:'var(--surface)', fontSize:13, color:'var(--text)', outline:'none', resize:'vertical', fontFamily:'DM Sans, sans-serif', lineHeight:1.6, transition:'border .15s' }}
                    onFocus={e => e.target.style.borderColor='#0085C7'}
                    onBlur={e => e.target.style.borderColor='var(--border)'}
                  />
                : a.notes
                  ? <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{a.notes}</p>
                  : <div style={{ fontSize:13, color:'var(--text3)', fontStyle:'italic' }}>{lang==='ar'?'لا توجد ملاحظات بعد.':'No notes added yet.'}</div>
              }
            </div>

            {/* CAREER HISTORY */}
            <CareerHistory personId={a.id} personType="athlete" personName={lang==='ar'&&a.name_ar?a.name_ar:a.name} />

            {/* DOCUMENTS */}
            <SharedDocuments personId={a.person_id} profile={profile} />

            <div className="info-card" id="athlete-documents-section">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: documentsExpanded ? 14 : 0 }}>
                <div className="info-title" style={{ margin:0, cursor:'pointer' }} onClick={() => setDocumentsExpanded(v => !v)}>{lang==='ar'?'الوثائق':'Documents'} <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>{myDocs.length} {lang==='ar'?'ملف':`file${myDocs.length!==1?'s':''}`}</span></div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <button onClick={() => downloadAllDocuments(a.name, myDocs, setDownloadingAll, lang==='ar', canEdit(profile))}
                    disabled={myDocs.length === 0 || downloadingAll}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:7, border:'1px solid var(--border)', background: myDocs.length===0 ? 'var(--surface2)' : 'var(--surface)', color: myDocs.length===0 ? 'var(--text3)' : 'var(--text2)', fontSize:11.5, cursor: myDocs.length===0||downloadingAll ? 'default' : 'pointer', opacity: downloadingAll ? .7 : 1 }}>
                    {downloadingAll
                      ? <><div style={{ width:11, height:11, border:'2px solid var(--text3)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .7s linear infinite' }} />{lang==='ar'?'جارٍ التحميل…':'Preparing…'}</>
                      : <><i className="ti ti-download" style={{ fontSize:13 }} />{lang==='ar'?'تحميل الكل':'Download all'}</>}
                  </button>
                  <i className={`ti ti-chevron-${documentsExpanded ? 'up' : 'down'}`} style={{ fontSize:16, color:'var(--text3)', cursor:'pointer' }} onClick={() => setDocumentsExpanded(v => !v)} />
                </div>
              </div>
              {documentsExpanded && canEdit(profile) && (
                <div style={{ display:'flex', gap:8, marginBottom:16, padding:'10px 12px', background:'var(--surface2)', borderRadius:10, alignItems:'center', direction:'ltr' }}>
                  <div style={{ flex:1, position:'relative' }}>
                    <button onClick={() => setDocDropOpen(v=>!v)}
                      style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', fontSize:12, color: docType ? 'var(--text)' : 'var(--text3)', cursor:'pointer', fontFamily:'DM Sans, sans-serif', direction: lang==='ar'?'rtl':'ltr' }}>
                      <span>{docType ? (lang==='ar'?(DOC_TYPES_AR[docType]||docType):docType) : (lang==='ar'?'اختر نوع الوثيقة':'Select document type')}</span>
                      <i className="ti ti-chevron-down" style={{ fontSize:12, color:'var(--text3)' }} />
                    </button>
                    {docDropOpen && (
                      <div onMouseDown={e => e.stopPropagation()} style={{ position:'fixed', zIndex:9999, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.15)', minWidth:200, maxHeight:280, overflowY:'auto', direction: lang==='ar'?'rtl':'ltr' }}
                        ref={el => {
                          if (el) {
                            const btn = el.previousSibling
                            const rect = btn?.getBoundingClientRect()
                            if (rect) {
                              const spaceBelow = window.innerHeight - rect.bottom
                              const dropH = Math.min(280, DOC_TYPES.length * 38)
                              if (spaceBelow < dropH + 8) {
                                el.style.top = 'auto'; el.style.bottom = (window.innerHeight - rect.top + 4) + 'px'
                              } else {
                                el.style.top = (rect.bottom+4)+'px'; el.style.bottom = 'auto'
                              }
                              el.style.left=rect.left+'px'; el.style.width=rect.width+'px'
                            }
                          }
                        }}>
                        {DOC_TYPES.map(t => (
                          <div key={t} onClick={() => { setDocType(t); setDocDropOpen(false) }}
                            style={{ padding:'9px 14px', fontSize:12, cursor:'pointer', background: t===docType?'var(--surface2)':'transparent', fontWeight: t===docType?600:400, color: t===docType?'#0085C7':'var(--text)' }}
                            onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                            onMouseLeave={e => e.currentTarget.style.background=t===docType?'var(--surface2)':'transparent'}>
                            {lang==='ar'?(DOC_TYPES_AR[t]||t):t}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => docInput.current.click()} disabled={docUploading || !docType}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background: !docType ? 'var(--text3)' : '#0085C7', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor: (docUploading || !docType) ? 'default' : 'pointer', flexShrink:0, fontFamily:'DM Sans, sans-serif', opacity: !docType ? .6 : 1 }}>
                    {docUploading ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />{lang==='ar'?'جارٍ الرفع…':'Uploading…'}</> : <><i className="ti ti-upload" style={{ fontSize:14 }} />{lang==='ar'?'رفع':'Upload'}</>}
                  </button>
                  <input ref={docInput} type="file" style={{ display:'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => { if(e.target.files[0]) handleDocUpload(a.id, e.target.files[0]) }} />
                </div>
              )}
              {!documentsExpanded ? null : myDocs.length === 0
                ? <div className="empty" style={{ padding:'20px 0' }}>{lang==='ar'?'لم يتم رفع وثائق بعد.':'No documents uploaded yet.'}</div>
                : DOC_TYPES.map(type => {
                    const typeDocs = docsByType[type]
                    if (typeDocs.length === 0) return null
                    if (!canEdit(profile) && type === 'Mission Passport') return null
                    const color = DOC_COLORS[type]
                    const icon  = DOC_ICONS[type]
                    return (
                      <div key={type} style={{ marginBottom:14 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                          <i className={`ti ${icon}`} style={{ fontSize:13, color }} />
                          <span style={{ fontSize:11, fontWeight:600, color }}>{lang==='ar' ? (DOC_TYPES_AR[type]||type) : type}</span>
                        </div>
                        {typeDocs.map(doc => (
                          <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', background:'var(--surface2)', borderRadius:9, marginBottom:6, border:'1px solid var(--border)' }}>
                            <div style={{ width:34, height:34, borderRadius:8, background:color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <i className={`ti ${icon}`} style={{ fontSize:16, color }} />
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.name}</div>
                              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{formatFileSize(doc.file_size)} · {doc.uploaded_at?.slice(0,10)}</div>
                            </div>
                            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                              {(canEdit(profile) || doc.type !== 'Mission Passport') && (
                                <button
                                  onClick={() => downloadDoc(doc.file_url, a.name, doc.type, doc.name)}
                                  style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text2)', cursor:'pointer', fontSize:14 }} title={lang==='ar'?'تحميل':'Download'}>
                                  <i className="ti ti-download" />
                                </button>
                              )}
                              {canEdit(profile) && (
                                <button onClick={() => setDocConfirm(doc)}
                                  style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626', cursor:'pointer' }} title={lang==='ar'?'حذف':'Delete'}>
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
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── LIST VIEW ──
  function startEdit() { setEditMode(true); setEdits({}) }
  function cancelEdit() {
    const changedCount = Object.keys(edits).length
    if (changedCount > 0) {
      const ok = window.confirm(
        lang === 'ar'
          ? `لديك ${changedCount} تغييرات غير محفوظة. هل تريد تجاهلها؟`
          : `You have ${changedCount} unsaved change${changedCount > 1 ? 's' : ''}. Discard them?`
      )
      if (!ok) return
    }
    setEditMode(false); setEdits({})
  }
  function setEdit(id, field, value) {
    setEdits(prev => {
      const athlete = athletes.find(a => a.id === id)
      // Only actually record a change if the new value differs from what's
      // already stored — flipping a field back to its original value should
      // remove it from the changed set, not leave a no-op update queued.
      if (athlete && athlete[field] === value) {
        const nextForId = { ...prev[id] }
        delete nextForId[field]
        if (Object.keys(nextForId).length === 0) {
          const next = { ...prev }
          delete next[id]
          return next
        }
        return { ...prev, [id]: nextForId }
      }
      return { ...prev, [id]: { ...prev[id], [field]: value } }
    })
  }
  function getVal(a, field) {
    return edits[a.id]?.[field] !== undefined ? edits[a.id][field] : a[field]
  }

  async function saveAllEdits() {
    if (savingAll) return // prevent duplicate save clicks while a save is in flight
    const changed = Object.entries(edits)
    if (changed.length === 0) { setEditMode(false); return }
    setSavingAll(true)
    try {
      const results = await Promise.allSettled(changed.map(([id, fields]) =>
        supabase.from('athletes').update(fields).eq('id', parseInt(id))
      ))

      const succeededIds = []
      const failed = [] // { id, name, message }
      results.forEach((res, i) => {
        const [id] = changed[i]
        const athlete = athletes.find(a => a.id === parseInt(id))
        const name = athlete?.name || `#${id}`
        if (res.status === 'rejected') {
          failed.push({ id, name, message: res.reason?.message || 'Request failed' })
        } else if (res.value?.error) {
          failed.push({ id, name, message: res.value.error.message })
        } else {
          succeededIds.push(id)
        }
      })

      if (succeededIds.length > 0) {
        toast(
          failed.length === 0
            ? `${succeededIds.length} athlete${succeededIds.length > 1 ? 's' : ''} updated`
            : `${succeededIds.length} updated, ${failed.length} failed`,
          failed.length === 0 ? 'success' : 'error'
        )
      }
      if (failed.length > 0) {
        const names = failed.slice(0, 5).map(f => f.name).join(', ') + (failed.length > 5 ? `, +${failed.length - 5} more` : '')
        toast(`Failed to update: ${names}`, 'error')
      }

      // One activity_log entry + one trusted-admin notification for the
      // whole batch, not one per athlete — only for rows that actually
      // succeeded, since a failed update never happened.
      if (isTrustedAdmin(profile) && succeededIds.length > 0) {
        const succeededNames = succeededIds.map(id => athletes.find(a => a.id === parseInt(id))?.name || `#${id}`)
        const changedFieldsSet = new Set()
        succeededIds.forEach(id => Object.keys(edits[id] || {}).forEach(f => changedFieldsSet.add(f)))
        logAdminActivity({
          actor: profile,
          action: 'updated',
          entityType: 'athlete',
          entityId: succeededIds.length === 1 ? succeededIds[0] : null,
          entityLabel: succeededIds.length === 1
            ? succeededNames[0]
            : `${succeededIds.length} athlete records`,
          module: 'athletes',
          metadata: {
            via: 'edit_list',
            athlete_ids: succeededIds,
            athlete_names: succeededNames,
            fields_changed: [...changedFieldsSet],
          },
        })
      }

      // Only clear edits for rows that actually succeeded — failed rows stay
      // in the edit set (and edit mode stays on) so the user can retry
      // without losing anything, per spec.
      if (failed.length > 0) {
        setEdits(prev => {
          const next = { ...prev }
          succeededIds.forEach(id => delete next[id])
          return next
        })
      } else {
        setEditMode(false)
        setEdits({})
      }
      await onRefresh()
    } finally {
      setSavingAll(false)
    }
  }

  // ── COLUMN DEFINITIONS ──
  const ALL_COLS = [
    { key:'name',            label:tx('athletes.athlete','Athlete'),          default:true,  editable:true  },
    { key:'name_ar',         label:lang==='ar' ? tx('athletes.athlete','الاسم بالإنجليزي') : tx('athletes.arabicName','Arabic Name'),   default:false, editable:false },
    { key:'qss_number',      label:tx('athletes.qssNumber','QSS #'),          default:false, editable:false },
    { key:'id_number',       label:tx('athletes.qatarID','Qatar ID'),         default:false, editable:false },
    { key:'career_profile',  label:tx('athletes.careerProfile','Career Profile #'), default:false, editable:false },
    { key:'sport_category',  label:tx('athletes.sportCategory','Sport Category'), default:false,  editable:true  },
    { key:'sport',           label:tx('athletes.sport','Sport'),              default:true,  editable:true  },
    { key:'classification',  label:tx('athletes.classification','Classification'), default:false, editable:true },
    { key:'disability',            label:tx('athletes.disability','Disability'),                        default:false, editable:false },
    { key:'statistics_disability', label:lang==='ar' ? 'الإعاقة الإحصائية' : 'Statistics Disability', default:false,  editable:true  },
    { key:'nationality',     label:tx('athletes.nationality','Nationality'),  default:false,  editable:true  },
    { key:'gender',          label:tx('athletes.gender','Gender'),            default:false, editable:false },
    { key:'dob',             label:tx('athletes.dob','Date of Birth'),        default:false, editable:false },
    { key:'age_category',       label:tx('athletes.ageCategory','Age Category'),      default:false, editable:false },
    { key:'sport_age_category', label:tx('athletes.sportAgeCategory','Sport Age Cat.'), default:false, editable:false },
    { key:'coach_id',        label:tx('athletes.coach','Coach'),              default:true,  editable:true  },
    { key:'status',          label:tx('athletes.status','Status'),            default:true,  editable:true  },
    { key:'medical_status',  label:tx('athletes.medicalStatus','Medical Status'), default:true,  editable:false },
    { key:'phone',           label:tx('athletes.phone','Phone'),              default:false, editable:false },
    { key:'email',           label:tx('athletes.email','Email'),              default:false, editable:false },
    { key:'join_date',       label:tx('athletes.joinedQPC','Joined QPC'),     default:false, editable:false },
    { key:'passport_number', label:tx('athletes.passportNo','Passport No'),   default:false, editable:false },
    { key:'passport_expiry', label:tx('athletes.passportExpiry','Passport Expiry'), default:true, editable:false },
    { key:'id_expiry',       label:tx('athletes.idExpiry','ID Expiry'),       default:true,  editable:false },
    { key:'medals',          label:tx('athletes.medals','Medals'),            default:false, editable:false },
    { key:'documents',       label:tx('athletes.documents','Documents'),       default:false, editable:false },
    { key:'missing_documents', label: lang==='ar' ? 'الوثائق الناقصة' : 'Missing Documents', default:false, editable:false },
  ]

  function toggleCol(key) {
    if (key === 'name') return // always visible
    setVisibleCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  const isVisible = key => visibleCols.includes(key)

  const changedCount = Object.keys(edits).length
  const inlineInput  = { padding:'5px 8px', borderRadius:7, border:'1px solid var(--border)', fontSize:12, background:'var(--surface)', color:'var(--text)', outline:'none', width:'100%', fontFamily:'DM Sans, sans-serif' }
  const inlineSelect = { ...inlineInput, cursor:'pointer' }
  // Fixed width for the sticky Athlete column (header + every cell) so its
  // left:0 sticky offset never shifts based on content length, and matching
  // header/body widths keep the column edges perfectly aligned.
  const STICKY_NAME_COL_WIDTH = 220

  // Render a cell value in view mode
  function renderCell(a, key) {
    const expired = v => v && new Date(v) < new Date()
    switch(key) {
      case 'name': return (
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {a.photo_url ? <img src={a.photo_url} alt={a.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} /> : <Avatar name={a.name} id={a.id} />}
          <div>
            <div style={{ fontWeight:500 }}>{lang==='ar' && a.name_ar ? a.name_ar : a.name}</div>
            <div style={{ fontSize:11, color:'#9aa3b2' }}>{tc(a.nationality)}</div>
          </div>
        </div>
      )
      case 'name_ar':          return <span style={{ color:'var(--text2)', direction: lang==='ar'?'ltr':'rtl' }}>{lang==='ar' ? (a.name||'—') : (a.name_ar||'—')}</span>
      case 'qss_number':       return <span style={{ color:'var(--text2)', fontFamily:'monospace', fontSize:12 }}>{a.qss_number || '—'}</span>
      case 'career_profile':   return <span style={{ color:'var(--text2)', fontFamily:'monospace', fontSize:12 }}>{a.career_profile || '—'}</span>
      case 'sport_category':   return a.sport_category ? <Badge label={lang==='ar' ? (SPORT_CATEGORY_NAMES_AR[a.sport_category]||a.sport_category) : a.sport_category} /> : <span style={{ color:'var(--text3)' }}>—</span>
      case 'sport':            return <span style={{ color:'var(--text2)' }}>{a.sport ? sportLabel(a.sport, a.sport_category, lang==='ar') : '—'}</span>
      case 'classification':   return a.classification ? <span className="badge badge-blue">{a.classification}</span> : '—'
      case 'disability':            return <span style={{ color:'var(--text2)' }}>{tDis(a.disability) || '—'}</span>
      case 'statistics_disability': return <span style={{ color:'var(--text2)' }}>{tStatDis(a.statistics_disability) || '—'}</span>
      case 'nationality':      return <span style={{ color:'var(--text2)' }}>{tc(a.nationality) || '—'}</span>
      case 'gender':           return <span style={{ color:'var(--text2)' }}>{a.gender ? (lang==='ar' ? (a.gender==='Male'?'ذكر':'أنثى') : a.gender) : '—'}</span>
      case 'dob':              return <span style={{ color:'var(--text2)' }}>{a.dob || '—'}</span>
      case 'age_category':       return <span style={{ color:'var(--text2)' }}>{a.age_category || '—'}</span>
      case 'sport_age_category': return <span style={{ color:'var(--text2)' }}>{a.sport_age_category || '—'}</span>
      case 'coach_id': {
        const coach = coaches.find(co => co.id === a.coach_id)
        if (!coach) return <span style={{ color:'var(--text3)' }}>—</span>
        return <span style={{ color:'var(--text2)' }}>{lang==='ar' && coach.name_ar ? coach.name_ar : coach.name}</span>
      }
      case 'status': {
        const STATUS_AR = {'Active':tx('status.active','Active'),'Inactive':tx('status.inactive','Inactive'),'Suspended':tx('status.suspended','Suspended'),'Under Medical Review':tx('status.underMedicalReview','Under Medical Review'),'Injured':tx('status.injured','Injured'),'Retired':tx('status.retired','Retired')}
        const sc = {Active:'badge-green',Inactive:'badge-gray',Suspended:'badge-red','Under Medical Review':'badge-amber',Injured:'badge-amber',Retired:'badge-gray'}
        return a.status ? <span className={`badge ${sc[effectiveStatus(a)]||'badge-gray'}`}>{STATUS_AR[effectiveStatus(a)]||effectiveStatus(a)}</span> : <span style={{ color:'var(--text3)' }}>—</span>
      }
      case 'medical_status': {
        const ms = a.medical_status || 'None'
        const msColor = ms === 'None' ? '#EE334E' : ms === 'Screening' ? '#009F6B' : '#0085C7'
        const msLabel = lang==='ar' ? {'None':'لا يوجد','Screening':'فحص','Medical Certificate':'شهادة طبية'}[ms]||ms : ms
        return <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:msColor+'20', color:msColor }}>{msLabel}</span>
      }
      case 'phone':            return <span style={{ color:'var(--text2)' }}>{a.phone || '—'}</span>
      case 'email':            return <span style={{ color:'var(--text2)', fontSize:12, wordBreak:'break-all' }}>{a.email || '—'}</span>
      case 'join_date':        return <span style={{ color:'var(--text2)' }}>{a.join_date || '—'}</span>
      case 'passport_number':  return <span style={{ color:'var(--text2)', fontFamily:'monospace', fontSize:12 }}>{a.passport_number || '—'}</span>
      case 'passport_expiry':  return <span style={{ color: expired(a.passport_expiry) ? '#dc2626' : 'var(--text2)' }}>{a.passport_expiry || '—'}{expired(a.passport_expiry) && <span style={{ marginLeft:4, fontSize:10, color:'#dc2626' }}>⚠</span>}</span>
      case 'id_number':        return <span style={{ color:'var(--text2)', fontFamily:'monospace', fontSize:12 }}>{a.id_number || '—'}</span>
      case 'id_expiry':        return <span style={{ color: expired(a.id_expiry) ? '#dc2626' : 'var(--text2)' }}>{a.id_expiry || '—'}{expired(a.id_expiry) && <span style={{ marginLeft:4, fontSize:10, color:'#dc2626' }}>⚠</span>}</span>
      case 'medals':           return <MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} />
      case 'documents': {
        const ds = athleteDocStatus(a.id, documents)
        const cls = ds.key === 'complete' ? 'badge-green' : ds.key === 'missing' ? 'badge-amber' : 'badge-gray'
        const text = ds.key === 'complete'
          ? (lang==='ar' ? 'مكتمل' : 'Complete')
          : ds.key === 'missing'
            ? (lang==='ar' ? `${ds.missing} ناقص` : `${ds.missing} Missing`)
            : (lang==='ar' ? 'لا يوجد وثائق' : 'No Documents')
        return (
          <span className={`badge ${cls}`} style={{ cursor:'pointer' }}
            onClick={e => { e.stopPropagation(); setScrollToDocs(true); setSelected(a.id) }}>
            {text}
          </span>
        )
      }
      case 'missing_documents': {
        const ds = athleteDocStatus(a.id, documents)
        if (ds.key === 'complete') {
          return <span style={{ color:'var(--text3)' }}>—</span>
        }
        if (ds.key === 'none') {
          return (
            <span style={{ color:'#dc2626', fontSize:12, cursor:'pointer' }}
              onClick={e => { e.stopPropagation(); setScrollToDocs(true); setSelected(a.id) }}>
              {lang==='ar' ? 'جميع الوثائق مفقودة' : 'All documents are missing'}
            </span>
          )
        }
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:2, cursor:'pointer' }}
            onClick={e => { e.stopPropagation(); setScrollToDocs(true); setSelected(a.id) }}>
            {ds.missingTypes.map(t => (
              <span key={t} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text2)' }}>
                <i className="ti ti-x" style={{ color:'#dc2626', fontSize:13, flexShrink:0 }} />
                {lang==='ar' ? (DOC_TYPES_AR[t] || t) : t}
              </span>
            ))}
          </div>
        )
      }
      default: return '—'
    }
  }

  // Render editable cell in edit mode
  function renderEditCell(a, key) {
    switch(key) {
      case 'name':         return <input style={{ ...inlineInput, minWidth:140 }} value={getVal(a,'name')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'name',e.target.value)} />
      case 'name_ar':      return <input style={{ ...inlineInput, direction:'rtl' }} value={getVal(a,'name_ar')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'name_ar',e.target.value)} />
      case 'sport_category': return <select style={inlineSelect} value={getVal(a,'sport_category')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'sport_category',e.target.value)}>
          <option value="">{tx('athletes.selectCategory','Select category')}</option>
          {SPORT_CATEGORIES.map(c => <option key={c} value={c}>{lang==='ar' ? (SPORT_CATEGORY_NAMES_AR[c]||c) : c}</option>)}
        </select>
      case 'sport':        return <select style={inlineSelect} value={getVal(a,'sport')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'sport',e.target.value)}>
          <option value="">{tx('athletes.selectSport','Select sport')}</option>
          {(SPORTS_BY_CATEGORY[getVal(a,'sport_category')] || SPORTS).map(s=><option key={s} value={s}>{sportLabel(s, getVal(a,'sport_category'), lang==='ar')}</option>)}
        </select>
      case 'classification': return <input style={{ ...inlineInput, width:100 }} value={getVal(a,'classification')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'classification',e.target.value)} />
      case 'disability':            return <input style={inlineInput} value={getVal(a,'disability')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'disability',e.target.value)} />
      case 'statistics_disability': return (
        <select style={inlineInput} value={getVal(a,'statistics_disability')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'statistics_disability',e.target.value||null)}>
          <option value="">—</option>
          {STATS_DIS_OPTIONS.map(o => <option key={o} value={o}>{tStatDis(o)}</option>)}
        </select>
      )
      case 'nationality':  return <input style={{ ...inlineInput, width:100 }} value={getVal(a,'nationality')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'nationality',e.target.value)} />
      case 'gender':       return <select style={inlineSelect} value={getVal(a,'gender')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'gender',e.target.value)}>{['','Male','Female'].map(s=><option key={s} value={s}>{s||'—'}</option>)}</select>
      case 'dob':          return <input style={inlineInput} type="date" value={getVal(a,'dob')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'dob',e.target.value)} />
      case 'age_category': return renderCell(a, key) // read-only: auto-computed from dob by a DB trigger
      case 'sport_age_category': return renderCell(a, key) // read-only: auto-computed from dob + gender
      case 'coach_id':     return <select style={inlineSelect} value={getVal(a,'coach_id')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'coach_id',e.target.value?parseInt(e.target.value):null)}><option value="">Unassigned</option>{coaches.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      case 'status':       return <select style={inlineSelect} value={getVal(a,'status')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'status',e.target.value)}>{['','Active','On Leave','In Competition','In Training Camp','Inactive','Injured','Under Medical Review','Suspended','Retired'].map(s=><option key={s} value={s}>{s||'— None —'}</option>)}</select>
      case 'medical_status': return <input style={inlineInput} value={getVal(a,'medical_status')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'medical_status',e.target.value)} />
      case 'phone':        return <input style={inlineInput} value={getVal(a,'phone')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'phone',e.target.value)} />
      case 'email':        return <input style={inlineInput} type="email" value={getVal(a,'email')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'email',e.target.value)} />
      case 'join_date':    return <input style={inlineInput} type="date" value={getVal(a,'join_date')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'join_date',e.target.value)} />
      case 'passport_number': return <input style={inlineInput} value={getVal(a,'passport_number')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'passport_number',e.target.value)} />
      case 'passport_expiry': return <input style={inlineInput} type="date" value={getVal(a,'passport_expiry')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'passport_expiry',e.target.value)} />
      case 'id_number':    return <input style={inlineInput} value={getVal(a,'id_number')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'id_number',e.target.value)} />
      case 'id_expiry':    return <input style={inlineInput} type="date" value={getVal(a,'id_expiry')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'id_expiry',e.target.value)} />
      case 'qss_number':   return <input style={inlineInput} value={getVal(a,'qss_number')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'qss_number',e.target.value)} />
      case 'career_profile': return <input style={inlineInput} value={getVal(a,'career_profile')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'career_profile',e.target.value)} />
      // read-only in edit mode
      case 'medals': return renderCell(a, key)
      default:       return renderCell(a, key)
    }
  }

  return (
    <div>
      {form && <FormModal type="athlete" record={null} coaches={coaches} onSave={handleSave} onClose={() => setForm(null)} />}
      {bulkOpen && canEdit(profile) && (
        <BulkImportDocsModal
          athletes={athletes}
          documents={documents || []}
          lang={lang}
          profile={profile}
          onClose={() => setBulkOpen(false)}
          onDone={async () => { setBulkOpen(false); await onRefresh() }}
        />
      )}
      {bulkExportOpen && canEdit(profile) && (
        <BulkExportDocsModal
          athletes={athletes.filter(a => selectedIds.has(a.id))}
          documents={documents || []}
          lang={lang}
          onClose={() => { setBulkExportOpen(false); setExportSelectMode(false); setSelectedIds(new Set()) }}
        />
      )}

      <div className="page-header">
        <div><div className="page-title">{tx('pages.athletes','Athletes')}</div><div className="page-sub">{list.length} of {athletes.length} {tx('pages.athletes','athletes')}</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {!editMode && (
            <button className="btn" style={{ background:'#009F6B' }} onClick={() => exportExcel(list, coaches, documents||[], visibleCols, ALL_COLS, lang)}>
              <i className="ti ti-table-export" /> {tx('actions.exportExcel','Export Excel')}
            </button>
          )}
          {/* Ministry Statistics button removed from this page per spec — the
              generateStatisticsReport() logic (imported above) and the
              generatingReport state are left in place, dormant, for a future
              dedicated Reports & Statistics page to call directly. */}

          {/* COLUMN PICKER */}
          {!editMode && (
            <div style={{ position:'relative' }} ref={colPickerRef}>
              <button className="action-btn action-btn-edit" style={{ padding:'8px 14px', fontSize:13 }} onClick={() => setColPickerOpen(o => !o)}>
                <i className="ti ti-columns" /> {lang==='ar' ? 'أعمدة' : 'Columns'} {visibleCols.length !== ALL_COLS.length && `(${visibleCols.length})`}
              </button>
              {colPickerOpen && (() => {
                const COL_GROUPS = [
                  { label: lang==='ar' ? 'الهوية' : 'Identity', keys: ['name','name_ar','qss_number','id_number','career_profile'] },
                  { label: lang==='ar' ? 'الرياضة' : 'Sport', keys: ['sport_category','sport','classification','disability','statistics_disability','coach_id'] },
                  { label: lang==='ar' ? 'شخصي' : 'Personal', keys: ['nationality','gender','dob','age_category','sport_age_category','phone','email'] },
                  { label: lang==='ar' ? 'الحالة' : 'Status', keys: ['status','medical_status','join_date'] },
                  { label: lang==='ar' ? 'الوثائق' : 'Documents', keys: ['passport_number','passport_expiry','id_expiry','documents','missing_documents'] },
                  { label: lang==='ar' ? 'الأداء' : 'Performance', keys: ['medals'] },
                ]
                return (
                  <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 4px', zIndex:200, boxShadow:'0 8px 24px rgba(0,0,0,.12)', minWidth:220, maxHeight:420, overflowY:'auto' }}>
                    {COL_GROUPS.map(group => (
                      <div key={group.label}>
                        <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', padding:'8px 12px 4px' }}>{group.label}</div>
                        {group.keys.map(key => {
                          const col = ALL_COLS.find(c => c.key === key)
                          if (!col) return null
                          return (
                            <label key={col.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 12px', cursor:col.key==='name'?'not-allowed':'pointer', borderRadius:8 }}>
                              <input type="checkbox" checked={isVisible(col.key)} disabled={col.key==='name'} onChange={() => toggleCol(col.key)}
                                style={{ width:14, height:14, cursor:col.key==='name'?'not-allowed':'pointer', accentColor:'#0085C7' }} />
                              <span style={{ fontSize:13, color:col.key==='name'?'var(--text3)':'var(--text)' }}>{col.label}</span>
                              {col.key==='name' && <span style={{ fontSize:10, color:'var(--text3)', marginLeft:'auto' }}>{tx('filters.always','always')}</span>}
                            </label>
                          )
                        })}
                      </div>
                    ))}
                    <div style={{ padding:'8px 12px 0', borderTop:'1px solid var(--border)', marginTop:4, display:'flex', gap:6, flexWrap:'wrap' }}>
                      <button onClick={() => setVisibleCols(ALL_COLS.map(c=>c.key))} style={{ flex:1, padding:'5px', fontSize:11, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', color:'var(--text2)' }}>{tx('filters.all','All')}</button>
                      <button onClick={() => setVisibleCols(
                        profile?.role === 'coach'
                          ? COACH_DEFAULT_COLS
                          : ALL_COLS.filter(c=>c.default).map(c=>c.key)
                      )} style={{ flex:1, padding:'5px', fontSize:11, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', color:'var(--text2)' }}>{tx('filters.default','Default')}</button>
                      <button onClick={() => setVisibleCols(['name'])} style={{ flex:1, padding:'5px', fontSize:11, background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:7, cursor:'pointer', color:'#dc2626' }}>{tx('filters.none','None')}</button>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {canEdit(profile) && !editMode && (
            <button className="action-btn action-btn-edit" style={{ padding:'8px 14px', fontSize:13 }} onClick={startEdit}>
              <i className="ti ti-table-options" /> {tx('actions.editList','Edit list')}
            </button>
          )}
          {editMode && (
            <>
              <button className="btn-cancel" onClick={cancelEdit} style={{ padding:'8px 14px' }}>Cancel</button>
              <button className="btn btn-blue" onClick={saveAllEdits} disabled={savingAll || Object.keys(edits).length === 0}>
                {savingAll
                  ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> Saving…</>
                  : <><i className="ti ti-device-floppy" /> Save {changedCount > 0 ? `${changedCount} change${changedCount>1?'s':''}` : 'all'}</>
                }
              </button>
            </>
          )}
          {canEdit(profile) && !editMode && (
            <button className="action-btn action-btn-edit" style={{ padding:'8px 14px', fontSize:13 }} onClick={() => setBulkOpen(true)}>
              <i className="ti ti-file-upload" /> {lang==='ar' ? 'استيراد وثائق' : 'Import Documents'}
            </button>
          )}
          {/* Export Documents button removed from this page per spec. The
              BulkExportDocsModal component, selection checkboxes, and
              underlying export logic remain in this file, dormant (never
              triggered since exportSelectMode can no longer be set to true
              from here), for a future Reports & Statistics page to surface. */}
          {canEdit(profile) && !editMode && (
            <button className="btn btn-blue" onClick={() => setForm('new')}><i className="ti ti-plus" /> {tx('athletes.addAthlete','Add athlete')}</button>
          )}
        </div>
      </div>

      {editMode && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#e8f3fb', border:'1px solid #bdd8f0', borderRadius:10, marginBottom:14, fontSize:13 }}>
          <i className="ti ti-pencil" style={{ color:'#0085C7', fontSize:16 }} />
          <span style={{ color:'#1565a0' }}><strong>{tx('athletes.editMode','Edit mode on')}</strong> — {tx('athletes.editModeDesc','click any cell to edit.')}</span>
          {changedCount > 0 && <span style={{ marginLeft:'auto', background:'#0085C7', color:'#fff', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>{changedCount} unsaved change{changedCount>1?'s':''}</span>}
        </div>
      )}

      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder={tx('athletes.searchAthletes','Search athletes, IDs, sport, coach, nationality…')} value={search} onChange={e => setSearch(e.target.value)} /></div>
        {activeFilterCount > 0 && (
          <span style={{ fontSize:11, fontWeight:600, color:'#0085C7', background:'#0085C715', padding:'4px 10px', borderRadius:20, whiteSpace:'nowrap' }}>
            {activeFilterCount} {lang==='ar' ? 'فلتر نشط' : activeFilterCount === 1 ? 'active filter' : 'active filters'}
          </span>
        )}
        {hasActiveFilters && (
          <button onClick={resetFilters}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:9, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer', fontFamily:'DM Sans, sans-serif', whiteSpace:'nowrap' }}>
            <i className="ti ti-x" style={{ fontSize:13 }} /> {tx('actions.resetFilters','Reset filters')}
          </button>
        )}
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr ref={headerRowRef}>
              {canEdit(profile) && !editMode && exportSelectMode && (
                <th style={{ width:32, position:'sticky', top:0, zIndex:22, background:'var(--surface)' }}>
                  <input type="checkbox"
                    checked={list.length > 0 && list.every(a => selectedIds.has(a.id))}
                    onChange={e => {
                      setSelectedIds(prev => {
                        const next = new Set(prev)
                        if (e.target.checked) list.forEach(a => next.add(a.id))
                        else list.forEach(a => next.delete(a.id))
                        return next
                      })
                    }} />
                </th>
              )}
              {ALL_COLS.filter(c => isVisible(c.key)).map((c, i) => {
                const isSortable = ['name','name_ar','qss_number','id_number','career_profile','sport_category','sport','classification','disability','statistics_disability','nationality','gender','dob','age_category','sport_age_category','coach_id','status','medical_status','phone','email','join_date','passport_number','passport_expiry','id_expiry','medals','documents','missing_documents'].includes(c.key)
                const isAsc  = sort === `${c.key}-asc`
                const isDesc = sort === `${c.key}-desc`
                const active = isAsc || isDesc
                // The Athlete column (always first, always visible) stays
                // pinned during horizontal scroll too — sticky on both axes
                // at once, with its own solid background and a right-edge
                // separator so it doesn't visually merge into whatever
                // scrolls underneath it.
                const isFirstCol = i === 0 && c.key === 'name'
                return (
                  <th key={c.key}
                    onClick={() => isSortable && (isAsc ? setSort(`${c.key}-desc`) : setSort(`${c.key}-asc`))}
                    style={{
                      cursor: isSortable ? 'pointer' : 'default', userSelect:'none', whiteSpace:'nowrap',
                      position:'sticky', top:0, zIndex: isFirstCol ? 23 : 21, background:'var(--surface)',
                      ...(isFirstCol ? { left:0, minWidth:STICKY_NAME_COL_WIDTH, boxShadow:'2px 0 4px rgba(0,0,0,.06)' } : {}),
                    }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      {c.label}
                      {isSortable && (
                        <span style={{ fontSize:9, color: active ? '#0085C7' : '#ccc' }}>
                          {isAsc ? '▲' : isDesc ? '▼' : '▲▼'}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
              {!editMode && <th style={{ position:'sticky', top:0, zIndex:21, background:'var(--surface)' }} />}
              {editMode && <th style={{ color:'#0085C7', position:'sticky', top:0, zIndex:21, background:'var(--surface)' }}>Changed</th>}
            </tr>
            {/* INLINE FILTER ROW — sticks directly beneath the column-header
                row, at the row's actual measured height (headerRowHeight),
                so it can't overlap or gap depending on font/zoom. */}
            {!editMode && (
              <tr style={{ background:'#f8f9fb' }}>
                {canEdit(profile) && !editMode && exportSelectMode && <th style={{ position:'sticky', top:headerRowHeight, zIndex:22, background:'#f8f9fb' }} />}
                {ALL_COLS.filter(col => isVisible(col.key)).map(col => {
                  const activeCategory = colFilters.sport_category && colFilters.sport_category !== 'All' ? colFilters.sport_category : null
                  const sportsForFilter = activeCategory
                    ? (SPORTS_BY_CATEGORY[activeCategory] || sports.filter(s => s !== 'All sports'))
                    : sports.filter(s => s !== 'All sports')
                  const filterOpts = {
                    sport_category: ['All', ...SPORT_CATEGORIES],
                    sport:          sportsForFilter.length ? ['All', ...new Set(sportsForFilter)] : ['All'],
                    status:         ['All','Active','On Leave','In Competition','In Training Camp','Inactive','Injured','Under Medical Review','Suspended','Retired'],
                    gender:         ['All','Male','Female'],
                    nationality:    ['All', ...['Afghanistan', 'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Belarus', 'Belgium', 'Brazil', 'Cameroon', 'Canada', 'Chile', 'China', 'Colombia', 'Croatia', 'Czech Republic', 'Denmark', 'Egypt', 'Eritrea', 'Ethiopia', 'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Guinea', 'Hungary', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Kyrgyzstan', 'Lebanon', 'Libya', 'Malaysia', 'Mali', 'Mauritania', 'Mexico', 'Mongolia', 'Morocco', 'Myanmar', 'Nepal', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Palestine', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saudi Arabia', 'Scotland', 'Senegal', 'Serbia', 'Singapore', 'Slovakia', 'Somalia', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sudan', 'Sweden', 'Syria', 'Tajikistan', 'Tanzania', 'Thailand', 'Tunisia', 'Turkey', 'Turkmenistan', 'UAE', 'Uganda', 'UK', 'Ukraine', 'USA', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Wales', 'Yemen', 'Zambia', 'Zimbabwe']],
                    coach_id:       ['All', ...coaches.map(co => co.name)],
                    disability:            ['All', ...new Set(athletes.map(a => a.disability).filter(Boolean))],
                    statistics_disability: ['All', ...STATS_DIS_OPTIONS],
                    age_category:         ['All', 'Under 5', '5 - 9', '10 - 14', '15 - 19', '20 - 24', '25 - 29', '30 - 34', '35 - 39', '40 - 44', '45 - 49', '50 - 54', '55 - 59', '60 - 64', '65+'],
                    sport_age_category:   ['All', 'براعم (8-10)', 'أشبال (11-13)', 'شبلات (11-13)', 'ناشئين (14-17)', 'ناشئات (14-17)', 'شباب (17-20)', 'شابات (17-20)', 'رجال (20+)', 'سيدات (20+)'],
                    medical_status: ['All', 'None', 'Screening', 'Medical Certificate'],
                    documents: ['All', 'Complete', 'Missing', 'None'],
                  }
                  const opts = filterOpts[col.key]
                  if (!opts) return (
                    <th key={col.key}
                      style={{
                        position:'sticky', top:headerRowHeight, zIndex: col.key==='name' ? 22 : 20, background:'#f8f9fb',
                        ...(col.key==='name' ? { left:0, minWidth:STICKY_NAME_COL_WIDTH, boxShadow:'2px 0 4px rgba(0,0,0,.06)' } : {}),
                      }} />
                  )
                  const filterKey = col.key === 'coach_id' ? 'coachName' : col.key
                  const filterVal = col.key === 'coach_id'
                    ? (colFilters.coachName || 'All')
                    : (colFilters[col.key] || 'All')
                  return (
                    <th key={col.key} style={{ padding:'4px 8px', position:'sticky', top:headerRowHeight, zIndex:20, background:'#f8f9fb' }}>
                      <select
                        value={filterVal}
                        onChange={e => {
                          const val = e.target.value
                          if (col.key === 'coach_id') {
                            setColFilters(f => ({ ...f, coachName: val }))
                          } else if (col.key === 'sport_category') {
                            // Changing category can invalidate the current sport
                            // selection (e.g. "Goalball" doesn't exist under Special
                            // Olympics), so clear it rather than leave a stale filter.
                            setColFilters(f => ({ ...f, sport_category: val, sport: 'All' }))
                          } else {
                            setColFilters(f => ({ ...f, [col.key]: val }))
                          }
                        }}
                        style={{ fontSize:11, border:'1px solid var(--border)', borderRadius:6, padding:'3px 4px', background:'var(--surface)', color: filterVal !== 'All' ? '#0085C7' : 'var(--text3)', cursor:'pointer', outline:'none', fontWeight: filterVal !== 'All' ? 600 : 400, maxWidth:120 }}>
                        {opts.map(o => {
                          const allLabel = lang==='ar' ? 'الكل' : 'All'
                          const LABELS = {
                            sport:       { 'All':allLabel, ...Object.fromEntries(filterOpts.sport.filter(s=>s!=='All').map(s => [s, sportLabel(s, colFilters.sport_category, lang==='ar')])) },
                            status:      { 'All':allLabel, 'Active':tx('status.active','Active'), 'On Leave':lang==='ar'?'في إجازة':'On Leave', 'In Competition':lang==='ar'?'في منافسة':'In Competition', 'In Training Camp':lang==='ar'?'في معسكر تدريبي':'In Training Camp', 'Inactive':tx('status.inactive','Inactive'), 'Injured':lang==='ar'?'مصاب':'Injured', 'Under Medical Review':lang==='ar'?'تحت المراجعة الطبية':'Under Medical Review', 'Suspended':lang==='ar'?'موقوف':'Suspended', 'Retired':lang==='ar'?'متقاعد':'Retired' },
                            gender:      { 'All':allLabel, 'Male':tx('form.male','Male'), 'Female':tx('form.female','Female') },
                            nationality: { 'All':allLabel, ...Object.fromEntries(['Afghanistan','Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Brazil','Cameroon','Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt','Eritrea','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Guinea','Hungary','India','Indonesia','Iran','Iraq','Ireland','Italy','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Lebanon','Libya','Malaysia','Mali','Mauritania','Mexico','Mongolia','Morocco','Myanmar','Nepal','Netherlands','New Zealand','Nigeria','Norway','Oman','Pakistan','Palestine','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Scotland','Senegal','Serbia','Singapore','Slovakia','Somalia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden','Syria','Tajikistan','Tanzania','Thailand','Tunisia','Turkey','Turkmenistan','UAE','Uganda','UK','Ukraine','USA','Uzbekistan','Venezuela','Vietnam','Wales','Yemen','Zambia','Zimbabwe'].map(n => [n, tc(n)])) },
                            disability:            { 'All':allLabel, ...Object.fromEntries(athletes.map(a=>a.disability).filter(Boolean).map(d=>[d, lang==='ar' ? (tDis(d)||d) : d])) },
                            statistics_disability: { 'All':allLabel, ...Object.fromEntries(STATS_DIS_OPTIONS.map(o=>[o, tStatDis(o)])) },
                            coach_id:    { 'All':allLabel, ...Object.fromEntries(coaches.map(co => [co.name, lang==='ar' && co.name_ar ? co.name_ar : co.name])) },
                            sport_category: { 'All':allLabel, ...Object.fromEntries(SPORT_CATEGORIES.map(c => [c, lang==='ar' ? (SPORT_CATEGORY_NAMES_AR[c]||c) : c])) },
                            age_category:       { 'All':allLabel },
                            sport_age_category: { 'All':allLabel },
                            documents: { 'All':allLabel, 'Complete': lang==='ar'?'مكتمل':'Complete', 'Missing': lang==='ar'?'ناقص':'Missing Documents', 'None': lang==='ar'?'لا يوجد وثائق':'No Documents' },
                          }
                          return <option key={o} value={o}>{LABELS[col.key]?.[o] || o}</option>
                        })}
                      </select>
                    </th>
                  )
                })}
                <th style={{ position:'sticky', top:headerRowHeight, zIndex:20, background:'#f8f9fb' }} />
              </tr>
            )}
          </thead>
          <tbody>
            {list.map(a => {
              const isChanged = !!edits[a.id]
              const cols = ALL_COLS.filter(c => isVisible(c.key))
              return (
                <tr key={a.id} onClick={() => !editMode && setSelected(a.id)}
                  onMouseEnter={() => setHoveredRowId(a.id)}
                  onMouseLeave={() => setHoveredRowId(prev => prev === a.id ? null : prev)}
                  style={{ cursor:editMode?'default':'pointer', background:isChanged?'#f0f7ff':'' }}>
                  {canEdit(profile) && !editMode && exportSelectMode && (
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(a.id)}
                        onChange={e => {
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(a.id); else next.delete(a.id)
                            return next
                          })
                        }} />
                    </td>
                  )}
                  {cols.map((c, i) => {
                    const isFirstCol = i === 0 && c.key === 'name'
                    // Matches the row's own background exactly (changed >
                    // hovered > default), since this cell's inline
                    // background would otherwise ignore both the
                    // tr:hover CSS rule and the isChanged inline style above.
                    const stickyCellBg = isChanged ? '#f0f7ff' : hoveredRowId === a.id ? 'var(--surface2)' : 'var(--surface)'
                    return (
                      <td key={c.key}
                        style={isFirstCol ? {
                          position:'sticky', left:0, zIndex:10, minWidth:STICKY_NAME_COL_WIDTH,
                          background:stickyCellBg, boxShadow:'2px 0 4px rgba(0,0,0,.06)',
                        } : undefined}>
                        {editMode ? renderEditCell(a, c.key) : renderCell(a, c.key)}
                      </td>
                    )
                  })}
                  {!editMode && <td><i className="ti ti-chevron-right" style={{ color:'#ccc', fontSize:16 }} /></td>}
                  {editMode && (
                    <td>{isChanged
                      ? <span style={{ display:'flex', alignItems:'center', gap:4, color:'#0085C7', fontSize:12, fontWeight:500 }}><i className="ti ti-check" style={{ fontSize:14 }} />{tx('athletes.modified','Modified')}</span>
                      : <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>
                    }</td>
                  )}
                </tr>
              )
            })}
            {(() => {
              const cols = ALL_COLS.filter(c => isVisible(c.key))
              return list.length === 0 && <tr><td colSpan={cols.length + 1}><div className="empty">{tx('athletes.noAthletesMatch','No athletes match')}</div></td></tr>
            })()}
          </tbody>
        </table>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
