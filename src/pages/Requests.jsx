import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast, ConfirmModal } from '../components/Toast'
import { initials, BackButton, DocPreviewButton, SUPPORTED_DOC_FILE_TYPES } from '../lib/helpers'
import { isTrustedAdmin } from '../lib/permissions'
import { logAdminActivity } from '../lib/adminActivity'
import { printSubmission, downloadSubmissionPdf, previewSubmissionPdf } from '../lib/printTemplates'

const FIELD_TYPES = [
  { value:'text',     icon:'ti-forms',         label:'Short Text',     label_ar:'نص قصير' },
  { value:'textarea', icon:'ti-align-left',     label:'Long Text',      label_ar:'نص طويل' },
  { value:'number',   icon:'ti-number',         label:'Number',         label_ar:'رقم' },
  { value:'date',     icon:'ti-calendar',       label:'Date',           label_ar:'تاريخ' },
  { value:'email',    icon:'ti-mail',           label:'Email',          label_ar:'بريد إلكتروني' },
  { value:'phone',    icon:'ti-phone',          label:'Phone',          label_ar:'هاتف' },
  { value:'dropdown', icon:'ti-chevron-down',   label:'Dropdown',       label_ar:'قائمة منسدلة' },
  { value:'radio',    icon:'ti-circle-dot',     label:'Single Choice',  label_ar:'اختيار واحد' },
  { value:'checkbox', icon:'ti-checkbox',       label:'Multiple Choice',label_ar:'اختيار متعدد' },
  { value:'yes_no',   icon:'ti-toggle-left',    label:'Yes / No',       label_ar:'نعم / لا' },
  { value:'file',     icon:'ti-paperclip',      label:'File Upload',    label_ar:'رفع ملف' },
]

const ICON_OPTIONS = [
  'ti-clipboard-text','ti-first-aid-kit','ti-plane','ti-barbell','ti-shirt',
  'ti-bus','ti-home','ti-medal','ti-calendar-event','ti-file-text',
  'ti-tool','ti-user','ti-heart','ti-star','ti-trophy','ti-book',
  'ti-camera','ti-microphone','ti-headphones','ti-map-pin',
  'ti-briefcase','ti-credit-card','ti-gift','ti-lock','ti-shield',
]

const COLOR_OPTIONS = [
  '#EE334E','#0085C7','#009F6B','#c9a84c','#8b5cf6',
  '#f59e0b','#06b6d4','#ec4899','#14b8a6','#f97316',
  '#ef4444','#3b82f6','#10b981','#a855f7','#0ea5e9',
  '#d97706','#64748b','#dc2626','#7c3aed','#059669',
  '#1d4ed8','#be123c','#0d9488','#92400e','#1e293b',
]

// Signed URL for a file stored in the private request-attachments bucket —
// the bucket has no public access, so every read goes through a
// short-lived signed URL that Supabase only issues if the requester
// actually has SELECT permission on that object (enforced by storage RLS:
// Admin/Read-Only Admin, or the submission's own submitter).
async function getFileSignedUrl(path) {
  if (!path) return null
  const { data, error } = await supabase.storage.from('request-attachments').createSignedUrl(path, 3600)
  if (error) { console.error('Failed to sign attachment URL', error); return null }
  return data?.signedUrl || null
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Request-attachment specific limit (separate from the athlete-document
// upload limit elsewhere in the app, which uses a different value for a
// different feature).
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024

const STATUS_META = {
  submitted:        { color:'#f59e0b', bg:'#fffbeb', label:'Submitted',        label_ar:'تم الإرسال' },
  under_review:     { color:'#0085C7', bg:'#e8f4fd', label:'Under Review',     label_ar:'قيد المراجعة' },
  pending_approval: { color:'#8b5cf6', bg:'#f3f0ff', label:'Pending Approval', label_ar:'بانتظار الموافقة' },
  returned:         { color:'#d97706', bg:'#fff7ed', label:'Returned',        label_ar:'أعيد للتصحيح' },
  rejected:         { color:'#EE334E', bg:'#fef2f4', label:'Rejected',        label_ar:'مرفوض' },
  approved:         { color:'#009F6B', bg:'#e8f7f2', label:'Approved',        label_ar:'مقبول' },
  completed:        { color:'#0d9488', bg:'#e6fbf8', label:'Completed',       label_ar:'مكتمل' },
  cancelled:        { color:'#64748b', bg:'#f1f5f9', label:'Cancelled',       label_ar:'ملغى' },
}
const ACTIVE_STATUSES = ['submitted','under_review','pending_approval']
// Statuses a submitter can still cancel from — anything still in motion,
// not yet approved/rejected/completed, and not already cancelled.
const CANCELLABLE_STATUSES = ['submitted','under_review','pending_approval','returned']

const ROLES = ['admin','coach','athlete','employee','guest']
const ROLE_LABELS_AR = { admin: 'مدير', coach: 'مدرب', athlete: 'رياضي', employee: 'الكادر', referee: 'حكم', guest: 'ضيف' }
const ROLE_LABELS_EN = { admin: 'Admin', coach: 'Coach', athlete: 'Athlete', employee: 'Staff', referee: 'Referee', guest: 'Guest' }

const ROLE_COLORS = { admin:'#EE334E', coach:'#0085C7', athlete:'#009F6B', employee:'#8b5cf6', referee:'#f59e0b', guest:'#64748b' }

const emptyForm = () => ({
  title:'', title_ar:'', description:'', description_ar:'',
  visible_to: ROLES.filter(r=>r!=='guest'), is_private: false, is_active: true,
  icon: 'ti-clipboard-text', color: '#0085C7', print_template: 'default_qpc',
})

const emptyField = () => ({
  id: crypto.randomUUID(),
  label:'', label_ar:'', field_type:'text', is_required: false,
  options: [], sort_order: 0,
})

const emptyStep = () => ({
  id: crypto.randomUUID(),
  name:'', name_ar:'', approver_role:'admin', approver_user_id:null, is_required:true,
})

const WORKFLOW_APPROVER_ROLES = ['admin','coach','employee','referee']

export default function Requests({ profile, navState }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'
  const isAdmin = profile?.role === 'admin' || profile?.role === 'readonly_admin'
  // Write access (create/edit/delete forms, approve/reject/return workflow
  // steps, review submissions) — deliberately narrower than `isAdmin`
  // above, which only controls whether the admin views/pages render.
  // Real enforcement is server-side: every mutating call this page makes
  // (request_forms writes, act_on_request_submission, etc.) is already
  // independently denied by RLS/RPC checks for anything but role='admin'.
  const canEditData = profile?.role === 'admin'

  const [forms, setForms]             = useState([])
  const [submissions, setSubmissions] = useState([])
  const [subCounts, setSubCounts]     = useState({})
  const [loading, setLoading]         = useState(true)
  const [view, setView]               = useState('list')
  const [selectedForm, setSelectedForm] = useState(null)
  const [selectedSub, setSelectedSub]   = useState(null)
  const [formSubs, setFormSubs]         = useState([])
  const [subFilter, setSubFilter]       = useState('all')
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingForm, setEditingForm]   = useState(null)
  const [formData, setFormData]         = useState(emptyForm())
  const [fields, setFields]             = useState([emptyField()])
  const [steps, setSteps]               = useState([])
  const [staffProfiles, setStaffProfiles] = useState([])
  const [actionNote, setActionNote]     = useState('')
  const [subActions, setSubActions]     = useState([])
  const [subFiles, setSubFiles]         = useState([])
  const [acting, setActing]             = useState(false)
  const [saving, setSaving]             = useState(false)
  const [answers, setAnswers]           = useState({})
  const [draftId, setDraftId]           = useState(null) // storage folder for this fill-form session's file uploads, until the real submission_id exists
  const [pendingFiles, setPendingFiles] = useState({}) // { [fieldId]: { name, path, type, size } }
  const [fileUploading, setFileUploading] = useState({}) // { [fieldId]: true } while an upload is in flight
  const [submitting, setSubmitting]     = useState(false)
  const [confirmDel, setConfirmDel]     = useState(null)
  const [reviewSub, setReviewSub]       = useState(null)
  const [reviewNote, setReviewNote]     = useState('')
  const [reviewStatus, setReviewStatus] = useState('approved')
  const [cancelConfirm, setCancelConfirm] = useState(null) // submission pending cancel-confirmation
  const [pdfPreview, setPdfPreview] = useState(null) // { url, blob, filename, form, submission, returnView } — admin PDF preview page
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false)

  // Opens the dedicated in-app PDF preview view — uses the exact same
  // shared generator (previewSubmissionPdf → buildPrintHtml under the
  // hood) that Download PDF and Print both use, so all three actions
  // always show identical content. The generated blob is kept so the
  // preview's own Download button reuses it instead of regenerating.
  async function openSubmissionPdfPreview(form, submission, returnView) {
    setPdfPreviewLoading(true)
    try {
      const { url, blob, filename } = await previewSubmissionPdf(form, submission)
      setPdfPreview({ url, blob, filename, form, submission, returnView })
      setView('submission-pdf-preview')
    } catch (err) {
      toast(err.message || (ar?'تعذر إنشاء المعاينة':'Could not generate preview'), 'error')
    } finally {
      setPdfPreviewLoading(false)
    }
  }

  function closeSubmissionPdfPreview() {
    if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url)
    const returnView = pdfPreview?.returnView || 'my-submissions'
    setPdfPreview(null)
    setView(returnView)
  }
  const [cancelling, setCancelling]     = useState(false)

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchForms = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('request_forms')
      .select('*, request_form_fields(*), request_form_workflow_steps(*)')
      .order('created_at', { ascending: false })
    if (data) {
      data.forEach(f => {
        f.request_form_fields?.sort((a,b) => a.sort_order - b.sort_order)
        f.request_form_workflow_steps?.sort((a,b) => a.step_order - b.step_order)
      })
      setForms(data)
      if (isAdmin) {
        const { data: subs } = await supabase.from('request_submissions').select('form_id, status')
        if (subs) {
          const counts = {}
          subs.forEach(s => {
            if (!counts[s.form_id]) counts[s.form_id] = { total:0, pending:0 }
            counts[s.form_id].total++
            if (ACTIVE_STATUSES.includes(s.status)) counts[s.form_id].pending++
          })
          setSubCounts(counts)
        }
      }
    }
    setLoading(false)
  }, [isAdmin])

  const fetchMySubs = useCallback(async () => {
    const { data } = await supabase.from('request_submissions')
      .select('*, request_forms(title, title_ar, icon, color, print_template, custom_template_key, request_form_fields(*), request_form_workflow_steps(*))')
      .eq('submitted_by', profile.id)
      .order('submitted_at', { ascending: false })
    if (data) setSubmissions(data)
  }, [profile?.id])

  const fetchFormSubs = useCallback(async (formId) => {
    const { data } = await supabase.from('request_submissions')
      .select('*, profiles(full_name, role)')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false })
    if (data) setFormSubs(data)
  }, [])

  const fetchSubActions = useCallback(async (subId) => {
    const { data } = await supabase.from('request_submission_actions')
      .select('*, profiles(full_name)')
      .eq('submission_id', subId)
      .order('acted_at', { ascending: true })
    if (data) setSubActions(data)
  }, [])

  // Files uploaded through this specific submission's 'file' fields — kept
  // strictly scoped by submission_id (request_submission_files.submission_id),
  // so attachments never mix between different submissions, and remain
  // available regardless of the submission's current status (approved/
  // rejected/completed all still fetch the same way).
  const fetchSubFiles = useCallback(async (subId) => {
    const { data } = await supabase.from('request_submission_files')
      .select('*')
      .eq('submission_id', subId)
      .order('uploaded_at', { ascending: true })
    if (!data) { setSubFiles([]); return }
    // Sign each file's URL up front (batched) — createSignedUrl is itself
    // gated by storage RLS, so this silently yields no URL for a file the
    // current user isn't authorized to read rather than exposing anything.
    const withUrls = await Promise.all(data.map(async f => ({ ...f, signedUrl: await getFileSignedUrl(f.file_path) })))
    setSubFiles(withUrls)
  }, [])

  useEffect(() => { fetchForms(); fetchMySubs() }, [fetchForms, fetchMySubs])
  useEffect(() => { if (isAdmin) supabase.from('profiles').select('id, full_name, role').then(({data}) => data && setStaffProfiles(data)) }, [isAdmin])

  // Deep-link support: Dashboard's "Pending Requests" KPI card navigates here
  // with navState.statusFilter === 'pending'. Once forms/subCounts are loaded,
  // jump straight to the first form that has a pending submission, already
  // filtered to the Pending tab — reuses the existing per-form subCounts this
  // page already fetches for admins, no separate cross-form view needed.
  useEffect(() => {
    if (navState?.statusFilter !== 'pending' || !isAdmin || view !== 'list' || loading) return
    const target = forms.find(f => (subCounts[f.id]?.pending || 0) > 0)
    if (target) openFormDetail(target, 'all')
  }, [navState, isAdmin, loading, forms, subCounts])

  // ── form builder ──────────────────────────────────────────────────────────
  function openCreateForm() {
    setEditingForm(null); setFormData(emptyForm()); setFields([emptyField()]); setSteps([]); setShowFormModal(true)
  }
  function openEditForm(f) {
    setEditingForm(f)
    setFormData({ title:f.title, title_ar:f.title_ar||'', description:f.description||'', description_ar:f.description_ar||'', visible_to:f.visible_to||ROLES.filter(r=>r!=='guest'), is_private:f.is_private, is_active:f.is_active, icon:f.icon||'ti-clipboard-text', color:f.color||'#0085C7', print_template:f.print_template||'default_qpc' })
    setFields((f.request_form_fields||[]).map(ff => ({ ...ff, options:ff.options||[] })))
    setSteps((f.request_form_workflow_steps||[]).map(s => ({ ...s })))
    setShowFormModal(true)
  }
  const addStep    = ()      => setSteps(p => [...p, emptyStep()])
  const removeStep = id      => setSteps(p => p.filter(s => s.id !== id))
  const updateStep = (id,k,v)=> setSteps(p => p.map(s => s.id===id ? {...s,[k]:v} : s))
  function moveStep(id, dir) {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id===id), next=[...prev], swap=idx+dir
      if (swap<0||swap>=next.length) return prev
      ;[next[idx],next[swap]]=[next[swap],next[idx]]
      return next
    })
  }
  const addField    = ()      => setFields(p => [...p, { ...emptyField(), sort_order:p.length }])
  const removeField = id      => setFields(p => p.filter(f => f.id !== id))
  const updateField = (id,k,v)=> setFields(p => p.map(f => f.id===id ? {...f,[k]:v} : f))
  const addOption   = fid     => setFields(p => p.map(f => f.id===fid ? {...f,options:[...(f.options||[]),{label:'',label_ar:''}]} : f))
  const updateOption= (fid,i,k,v) => setFields(p => p.map(f => f.id===fid ? {...f,options:f.options.map((o,j)=>j===i?{...o,[k]:v}:o)} : f))
  const removeOption= (fid,i) => setFields(p => p.map(f => f.id===fid ? {...f,options:f.options.filter((_,j)=>j!==i)} : f))
  function moveField(id, dir) {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id===id), next=[...prev], swap=idx+dir
      if (swap<0||swap>=next.length) return prev
      ;[next[idx],next[swap]]=[next[swap],next[idx]]
      return next.map((f,i)=>({...f,sort_order:i}))
    })
  }

  async function saveForm() {
    if (!formData.title.trim()) return toast(ar?'العنوان مطلوب':'Title required','error')
    if (!fields.length) return toast(ar?'أضف حقلاً واحداً':'Add at least one field','error')
    setSaving(true)
    try {
      let formId = editingForm?.id
      if (editingForm) {
        await supabase.from('request_forms').update({...formData}).eq('id',formId)
        await supabase.from('request_form_fields').delete().eq('form_id',formId)
      } else {
        const { data } = await supabase.from('request_forms').insert({...formData, created_by:profile.id}).select().single()
        formId = data.id
      }
      await supabase.from('request_form_fields').insert(
        fields.map((f,i) => ({ form_id:formId, label:f.label, label_ar:f.label_ar||'', field_type:f.field_type, is_required:f.is_required, options:['dropdown','radio','checkbox'].includes(f.field_type)?f.options:null, sort_order:i, template_field_key:f.template_field_key||null }))
      )
      await supabase.from('request_form_workflow_steps').delete().eq('form_id',formId)
      if (steps.length) {
        await supabase.from('request_form_workflow_steps').insert(
          steps.map((s,i) => ({ form_id:formId, step_order:i, name:s.name, name_ar:s.name_ar||'', approver_role:s.approver_user_id?null:(s.approver_role||null), approver_user_id:s.approver_user_id||null, is_required:s.is_required!==false }))
        )
      }
      toast(editingForm?(ar?'تم التحديث':'Updated'):(ar?'تم الإنشاء':'Created'),'success')
      setShowFormModal(false); fetchForms()
    } catch(e) { toast(e.message,'error') }
    setSaving(false)
  }

  async function deleteForm(f) {
    await supabase.from('request_forms').delete().eq('id',f.id)
    toast(ar?'تم الحذف':'Deleted','success')
    setConfirmDel(null); if(view==='form-detail') setView('list'); fetchForms()
  }

  async function submitForm() {
    const missing = (selectedForm.request_form_fields||[]).filter(f=>f.is_required && !answers[f.id]?.toString().trim())
    if (missing.length) return toast((ar?'الحقول المطلوبة: ':'Required: ')+missing.map(f=>ar?(f.label_ar||f.label):f.label).join(', '),'error')
    if (Object.values(fileUploading).some(Boolean)) return toast(ar?'يرجى الانتظار حتى انتهاء رفع الملف':'Please wait for the file upload to finish','error')
    setSubmitting(true)
    try {
      // Insert result must be checked explicitly — the Supabase client
      // does NOT throw on an RLS rejection or constraint violation, it
      // just returns { error }. Reading .single() also fails loudly if
      // no row actually landed, instead of silently reporting success.
      const { data: insertedSub, error } = await supabase.from('request_submissions')
        .insert({ form_id:selectedForm.id, submitted_by:profile.id, answers })
        .select('id')
        .single()
      if (error || !insertedSub) throw new Error(error?.message || (ar?'فشل إرسال الطلب. لم يتم حفظ أي بيانات.':'Submission failed. Nothing was saved.'))

      // Link any files already uploaded (to the draftId storage folder)
      // during this fill session to the real submission row that now
      // exists — each row explicitly carries the real submission_id, so
      // files are never ambiguous about which submission they belong to.
      const pendingEntries = Object.entries(pendingFiles)
      if (pendingEntries.length) {
        const fileRows = pendingEntries.map(([fieldId, f]) => ({
          submission_id: insertedSub.id, field_id: fieldId,
          file_name: f.name, file_path: f.path, file_type: f.type, file_size: f.size,
        }))
        const { error: fileErr } = await supabase.from('request_submission_files').insert(fileRows)
        if (fileErr) console.error('Failed to link uploaded files to submission', fileErr)
      }

      const { data: admins } = await supabase.from('profiles').select('id').eq('role','admin')
      if (admins?.length) {
        await supabase.from('notifications').insert(admins.map(a => ({
          user_id:a.id,
          title: ar?`طلب جديد: ${selectedForm.title_ar||selectedForm.title}`:`New request: ${selectedForm.title}`,
          body: `${profile.full_name} ${ar?'أرسل طلباً':'submitted a request'}.`,
          type:'request', data:{ form_id:selectedForm.id, page:'requests' },
          category:'Requests', target_path:'requests', related_entity_type:'request_submission', related_entity_id: insertedSub.id,
          dedup_key: `request-submitted-${insertedSub.id}-${a.id}`,
        })))
      }
      toast(ar?'تم الإرسال!':'Submitted!','success')
      setAnswers({})
      setPendingFiles({})
      // Refetch immediately so "My Submissions" (and the admin Submissions
      // view, next time it's opened) reflect the new row without a manual
      // page refresh.
      await fetchMySubs()
      setView('my-submissions')
    } catch(e) {
      // Keep the form open with everything the user typed intact — no
      // silent close/reset on failure, and the real error is shown.
      toast(e.message,'error')
    }
    setSubmitting(false)
  }

  async function saveReview() {
    await supabase.from('request_submissions').update({ status:reviewStatus, admin_notes:reviewNote, updated_at:new Date().toISOString() }).eq('id',reviewSub.id)
    const meta = STATUS_META[reviewStatus]
    await supabase.from('notifications').insert({
      user_id:reviewSub.submitted_by,
      title: ar?'تحديث حالة الطلب':'Request status updated',
      body: `${ar?'طلبك':'Your request'} "${reviewSub.request_forms?.title||''}" ${ar?'أصبح':''} ${ar?meta.label_ar:meta.label}${ar?'':'.'}`,
      type:'request', data:{ page:'requests' },
      category:'Requests', target_path:'requests', related_entity_type:'request_submission', related_entity_id: reviewSub.id,
    })
    toast(ar?'تم التحديث':'Updated','success')
    if (isTrustedAdmin(profile)) {
      logAdminActivity({
        actor: profile, action: reviewStatus === 'approved' ? 'approved' : reviewStatus === 'rejected' ? 'rejected' : 'updated',
        entityType: 'request', entityId: reviewSub.id, entityLabel: reviewSub.request_forms?.title || 'request', module: 'requests',
      })
    }
    setReviewSub(null); fetchFormSubs(reviewSub.form_id)
    setFormSubs(p => p.map(s => s.id===reviewSub.id ? {...s, status:reviewStatus, admin_notes:reviewNote} : s))
    // Keep the Forms list's pending/total badges in sync immediately —
    // these only otherwise refresh via fetchForms(), which this function
    // never called, so the badge stayed stale until a manual page reload.
    setSubCounts(prev => {
      const prevStatus = reviewSub.status
      if (prevStatus === reviewStatus) return prev
      const current = prev[reviewSub.form_id] || { total: 0, pending: 0 }
      const wasPending = ACTIVE_STATUSES.includes(prevStatus)
      const isPending  = ACTIVE_STATUSES.includes(reviewStatus)
      return {
        ...prev,
        [reviewSub.form_id]: {
          total: current.total,
          pending: current.pending + (isPending ? 1 : 0) - (wasPending ? 1 : 0),
        },
      }
    })
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  const statusBadge = s => {
    const m = STATUS_META[s]||STATUS_META.submitted
    return <span style={{ fontSize:11, fontWeight:600, color:m.color, background:m.bg, padding:'3px 10px', borderRadius:20 }}>{ar?m.label_ar:m.label}</span>
  }

  // Submitter-side cancellation. Ownership and status are re-verified
  // server-side by the RPC (SECURITY DEFINER) — the button being hidden
  // for the wrong status/owner is a UX nicety, not the actual security
  // boundary.
  async function doCancel(sub) {
    setCancelling(true)
    const { data, error } = await supabase.rpc('cancel_request_submission', { p_submission_id: sub.id })
    setCancelling(false)
    setCancelConfirm(null)
    if (error || data?.status !== 'ok') {
      const msg = data?.status === 'not_cancellable' ? (ar?'لا يمكن إلغاء هذا الطلب بعد الآن':'This request can no longer be cancelled')
        : data?.status === 'not_permitted' ? (ar?'غير مسموح':'Not permitted')
        : (error?.message || (ar?'فشل الإلغاء':'Cancellation failed'))
      return toast(msg,'error')
    }
    toast(ar?'تم إلغاء الطلب':'Submission cancelled','success')
    setFormSubs(p => p.map(s => s.id===sub.id ? {...s, status:'cancelled'} : s))
    setSelectedSub(p => p && p.id===sub.id ? {...p, status:'cancelled'} : p)
    await fetchMySubs()
  }

  // Uploads immediately (while the person is still filling the form) into
  // request-attachments/{draftId}/{fieldId}/{filename} — draftId is a
  // fresh UUID generated when the form was opened, so different fill
  // sessions never collide. The real link to the eventual submission row
  // is created afterward in submitForm(), once the submission actually
  // exists and has a real id: this only tracks the upload result so that
  // linking step has something to attach.
  async function handleFieldFileUpload(field, file) {
    if (!file) return
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      return toast(ar?'حجم الملف يتجاوز الحد المسموح 25 ميجابايت':'File exceeds the 25 MB limit','error')
    }
    if (!SUPPORTED_DOC_FILE_TYPES.includes(file.type)) {
      return toast(ar?'نوع الملف غير مدعوم. الرجاء رفع PDF أو JPG أو PNG.':'Unsupported file type. Please upload a PDF, JPG, or PNG.','error')
    }
    setFileUploading(p => ({ ...p, [field.id]: true }))
    try {
      const ext = file.name.split('.').pop()
      const path = `${draftId}/${field.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('request-attachments').upload(path, file, { upsert: false })
      if (error) throw error
      setPendingFiles(p => ({ ...p, [field.id]: { name: file.name, path, type: file.type, size: file.size } }))
      setAnswers(p => ({ ...p, [field.id]: file.name }))
    } catch (err) {
      // Full detail stays in the console for debugging — the person only
      // ever sees a plain, non-technical message, never a raw DB/storage
      // error string.
      console.error('Attachment upload failed', err)
      toast(ar?'فشل الرفع. يرجى المحاولة مرة أخرى.':'Upload failed. Please try again.','error')
    } finally {
      setFileUploading(p => ({ ...p, [field.id]: false }))
    }
  }

  function renderFieldInput(field) {
    const val = answers[field.id]??'', set = v => setAnswers(p=>({...p,[field.id]:v}))
    switch(field.field_type) {
      case 'textarea': return <textarea className="form-input" rows={3} value={val} onChange={e=>set(e.target.value)} style={{resize:'vertical'}} />
      case 'number':   return <input type="number" className="form-input" value={val} onChange={e=>set(e.target.value)} />
      case 'date':     return <input type="date" className="form-input" value={val} onChange={e=>set(e.target.value)} />
      case 'email':    return <input type="email" className="form-input" value={val} onChange={e=>set(e.target.value)} />
      case 'phone':    return <input type="tel" className="form-input" value={val} onChange={e=>set(e.target.value)} />
      case 'yes_no':   return <div style={{display:'flex',gap:12}}>{['Yes','No'].map(o=><label key={o} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:14}}><input type="radio" name={field.id} value={o} checked={val===o} onChange={()=>set(o)} />{ar?(o==='Yes'?'نعم':'لا'):o}</label>)}</div>
      case 'dropdown': return <select className="form-input" value={val} onChange={e=>set(e.target.value)}><option value="">{ar?'— اختر —':'— Select —'}</option>{(field.options||[]).map((o,i)=><option key={i} value={o.label}>{ar?(o.label_ar||o.label):o.label}</option>)}</select>
      case 'radio':    return <div style={{display:'flex',flexDirection:'column',gap:8}}>{(field.options||[]).map((o,i)=><label key={i} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14}}><input type="radio" name={field.id} value={o.label} checked={val===o.label} onChange={()=>set(o.label)}/>{ar?(o.label_ar||o.label):o.label}</label>)}</div>
      case 'checkbox': {
        const sel=Array.isArray(val)?val:[], tog=v=>set(sel.includes(v)?sel.filter(x=>x!==v):[...sel,v])
        return <div style={{display:'flex',flexDirection:'column',gap:8}}>{(field.options||[]).map((o,i)=><label key={i} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14}}><input type="checkbox" checked={sel.includes(o.label)} onChange={()=>tog(o.label)}/>{ar?(o.label_ar||o.label):o.label}</label>)}</div>
      }
      case 'file': {
        const uploading = !!fileUploading[field.id]
        const pending = pendingFiles[field.id]
        return (
          <div>
            <input type="file" className="form-input" disabled={uploading}
              onChange={e=>handleFieldFileUpload(field, e.target.files[0])} />
            {uploading && <div style={{fontSize:12,color:'var(--text3)',marginTop:6}}><i className="ti ti-loader ti-spin"/> {ar?'جارٍ الرفع…':'Uploading…'}</div>}
            {!uploading && pending && (
              <div style={{fontSize:12,color:'#009F6B',marginTop:6}}><i className="ti ti-circle-check"/> {pending.name} · {formatFileSize(pending.size)}</div>
            )}
          </div>
        )
      }
      default:         return <input type="text" className="form-input" value={val} onChange={e=>set(e.target.value)} />
    }
  }

  const visibleForms = isAdmin ? forms : forms.filter(f=>f.is_active && !f.is_private && f.visible_to?.includes(profile?.role))
  const filteredSubs = subFilter==='all' ? formSubs : formSubs.filter(s=>s.status===subFilter)

  // ── Form Builder Modal — extracted so it can be rendered from every
  // early-return view below (form-detail, fill-form, submission-view,
  // my-submissions), not just the main list view. ──
  const formModalJsx = showFormModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'40px 20px'}}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowFormModal(false) }}>
          <div style={{background:'var(--surface)',borderRadius:16,width:'100%',maxWidth:700,boxShadow:'0 16px 48px rgba(0,0,0,.25)',border:'1px solid var(--border)'}}>

            {/* Modal header */}
            <div style={{padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontWeight:700,fontSize:16}}>{editingForm?(ar?'تعديل النموذج':'Edit Form'):(ar?'نموذج جديد':'New Form')}</div>
              <button onClick={()=>setShowFormModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:20}}><i className="ti ti-x"/></button>
            </div>

            <div style={{padding:24,display:'flex',flexDirection:'column',gap:16}}>
              {/* Title */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">{ar?'العنوان (EN)':'Title (EN)'} *</label>
                  <input className="form-input" value={formData.title} onChange={e=>setFormData(p=>({...p,title:e.target.value}))} placeholder="e.g. Equipment Request"/>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar?'العنوان (AR)':'Title (AR)'}</label>
                  <input className="form-input" value={formData.title_ar} onChange={e=>setFormData(p=>({...p,title_ar:e.target.value}))} placeholder="مثال: طلب معدات" dir="rtl"/>
                </div>
              </div>
              {/* Description */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">{ar?'الوصف (EN)':'Description (EN)'}</label>
                  <textarea className="form-input" rows={2} value={formData.description} onChange={e=>setFormData(p=>({...p,description:e.target.value}))} style={{resize:'vertical'}}/>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar?'الوصف (AR)':'Description (AR)'}</label>
                  <textarea className="form-input" rows={2} value={formData.description_ar} onChange={e=>setFormData(p=>({...p,description_ar:e.target.value}))} dir="rtl" style={{resize:'vertical'}}/>
                </div>
              </div>

              {/* Icon + Color picker */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">{ar?'الأيقونة':'Icon'}</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'10px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)',minHeight:200,alignContent:'flex-start'}}>
                    {ICON_OPTIONS.map(ico=>(
                      <button key={ico} onClick={()=>setFormData(p=>({...p,icon:ico}))}
                        style={{width:34,height:34,borderRadius:8,border:`2px solid ${formData.icon===ico?formData.color:'transparent'}`,background:formData.icon===ico?formData.color+'15':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}}>
                        <i className={`ti ${ico}`} style={{fontSize:16,color:formData.icon===ico?formData.color:'var(--text3)'}}/>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar?'اللون':'Color'}</label>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'10px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)',alignContent:'flex-start',minHeight:200}}>
                    {COLOR_OPTIONS.map(clr=>(
                      <button key={clr} onClick={()=>setFormData(p=>({...p,color:clr}))}
                        style={{width:30,height:30,borderRadius:'50%',background:clr,border:`3px solid ${formData.color===clr?'var(--text)':'transparent'}`,cursor:'pointer',transition:'all .12s',flexShrink:0,boxShadow:formData.color===clr?`0 0 0 2px ${clr}40`:'none'}}/>
                    ))}
                  </div>
                </div>
              </div>

              {/* Visible to */}
              <div className="form-group">
                <label className="form-label">{ar?'يظهر لـ':'Visible to'}</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {ROLES.map(r=>(
                    <button key={r} type="button"
                      onClick={()=>setFormData(p=>({...p,visible_to:p.visible_to.includes(r)?p.visible_to.filter(x=>x!==r):[...p.visible_to,r]}))}
                      style={{padding:'5px 16px',borderRadius:20,border:`1.5px solid ${formData.visible_to.includes(r)?'#0085C7':'var(--border)'}`,background:formData.visible_to.includes(r)?'#0085C7':'transparent',color:formData.visible_to.includes(r)?'white':'var(--text2)',fontSize:13,fontWeight:formData.visible_to.includes(r)?600:400,cursor:'pointer',transition:'all .15s'}}>
                      {ar ? (ROLE_LABELS_AR[r] || r) : (ROLE_LABELS_EN[r] || r)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <div className="form-group">
                <label className="form-label">{ar?'حالة النموذج':'Form Status'}</label>
                <div style={{display:'flex',gap:8}}>
                  <button type="button"
                    onClick={()=>setFormData(p=>({...p,is_active:true}))}
                    style={{padding:'6px 18px',borderRadius:20,border:`1.5px solid ${formData.is_active?'#009F6B':'var(--border)'}`,background:formData.is_active?'#009F6B':'transparent',color:formData.is_active?'white':'var(--text2)',fontSize:13,fontWeight:formData.is_active?600:400,cursor:'pointer',transition:'all .15s'}}>
                    {ar?'نشط':'Active'}
                  </button>
                  <button type="button"
                    onClick={()=>setFormData(p=>({...p,is_active:false}))}
                    style={{padding:'6px 18px',borderRadius:20,border:`1.5px solid ${!formData.is_active?'#9aa3b2':'var(--border)'}`,background:!formData.is_active?'#9aa3b2':'transparent',color:!formData.is_active?'white':'var(--text2)',fontSize:13,fontWeight:!formData.is_active?600:400,cursor:'pointer',transition:'all .15s'}}>
                    {ar?'معطّل':'Inactive'}
                  </button>
                </div>
              </div>

              {/* Print template */}
              <div className="form-group">
                <label className="form-label">{ar?'قالب الطباعة':'Print Template'}</label>
                <div style={{display:'flex',gap:8}}>
                  <button type="button"
                    onClick={()=>setFormData(p=>({...p,print_template:'default_qpc'}))}
                    style={{padding:'6px 18px',borderRadius:20,border:`1.5px solid ${formData.print_template==='default_qpc'?'#0085C7':'var(--border)'}`,background:formData.print_template==='default_qpc'?'#0085C7':'transparent',color:formData.print_template==='default_qpc'?'white':'var(--text2)',fontSize:13,fontWeight:formData.print_template==='default_qpc'?600:400,cursor:'pointer',transition:'all .15s'}}>
                    {ar?'قالب QPC الافتراضي':'Default QPC Template'}
                  </button>
                  <button type="button"
                    onClick={()=>setFormData(p=>({...p,print_template:'custom'}))}
                    style={{padding:'6px 18px',borderRadius:20,border:`1.5px solid ${formData.print_template==='custom'?'#0085C7':'var(--border)'}`,background:formData.print_template==='custom'?'#0085C7':'transparent',color:formData.print_template==='custom'?'white':'var(--text2)',fontSize:13,fontWeight:formData.print_template==='custom'?600:400,cursor:'pointer',transition:'all .15s'}}>
                    {ar?'قالب مخصص':'Custom Template'}
                  </button>
                </div>
                {formData.print_template==='custom' && (
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>
                    {ar?'القوالب المخصصة متاحة حالياً لاستمارة تسجيل لاعب جديد فقط. أضف "مفتاح الحقل" لكل حقل أدناه لربطه بخلايا القالب.':'Custom templates are currently implemented for the New Athlete Registration Form only. Set a "Template field key" on each field below to map it to the template.'}
                  </div>
                )}
              </div>

              {/* Fields */}
              <div>
                <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>{ar?'الحقول':'Form Fields'}</div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {fields.map((field,idx)=>(
                    <div key={field.id} style={{background:'var(--surface)',borderRadius:10,border:'1px solid var(--border)',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
                      <div style={{display:'flex',gap:8,alignItems:'center',padding:'9px 12px',background:'var(--surface2)',borderBottom:'1px solid var(--border)'}}>
                        <span style={{fontSize:11,fontWeight:700,color:'var(--text3)',minWidth:20,textAlign:'center'}}>#{idx+1}</span>
                        <div style={{display:'flex',flexDirection:'column',gap:1}}>
                          <button onClick={()=>moveField(field.id,-1)} disabled={idx===0} style={{background:'none',border:'none',cursor:idx===0?'default':'pointer',color:'var(--text3)',padding:'1px 4px',opacity:idx===0?.3:1}}><i className="ti ti-chevron-up" style={{fontSize:11}}/></button>
                          <button onClick={()=>moveField(field.id,1)} disabled={idx===fields.length-1} style={{background:'none',border:'none',cursor:idx===fields.length-1?'default':'pointer',color:'var(--text3)',padding:'1px 4px',opacity:idx===fields.length-1?.3:1}}><i className="ti ti-chevron-down" style={{fontSize:11}}/></button>
                        </div>
                        <select className="form-input" style={{width:168,flexShrink:0,fontSize:12}} value={field.field_type} onChange={e=>updateField(field.id,'field_type',e.target.value)}>
                          {FIELD_TYPES.map(t=><option key={t.value} value={t.value}>{ar?t.label_ar:t.label}</option>)}
                        </select>
                        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:12,marginLeft:'auto',cursor:'pointer',userSelect:'none'}}>
                          <input type="checkbox" checked={field.is_required} onChange={e=>updateField(field.id,'is_required',e.target.checked)}/>
                          <span style={{color:field.is_required?'#EE334E':'var(--text3)',fontWeight:field.is_required?600:400}}>{ar?'مطلوب *':'Required *'}</span>
                        </label>
                        <button onClick={()=>removeField(field.id)} className="action-btn action-btn-delete" style={{padding:'3px 8px',flexShrink:0}}><i className="ti ti-trash" style={{fontSize:13}}/></button>
                      </div>
                      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        <input className="form-input" placeholder={ar ? "التسمية (EN)" : "Label (EN)"} value={field.label} onChange={e=>updateField(field.id,'label',e.target.value)}/>
                        <input className="form-input" placeholder="التسمية (AR)" value={field.label_ar||''} onChange={e=>updateField(field.id,'label_ar',e.target.value)} dir="rtl"/>
                      </div>
                      {formData.print_template==='custom' && (
                        <input className="form-input" style={{fontSize:12}} placeholder={ar?'مفتاح حقل القالب (مثال: full_name)':'Template field key (e.g. full_name)'} value={field.template_field_key||''} onChange={e=>updateField(field.id,'template_field_key',e.target.value.trim())}/>
                      )}
                      {['dropdown','radio','checkbox'].includes(field.field_type) && (
                        <div style={{marginTop:8,padding:'10px 12px',background:'var(--surface2)',borderRadius:8,border:'1px solid var(--border)'}}>
                          <div style={{fontSize:11,color:'var(--text3)',marginBottom:8,fontWeight:700,letterSpacing:'.04em',textTransform:'uppercase'}}>{ar?'الخيارات':'Options'}</div>
                          {(field.options||[]).map((o,oi)=>(
                            <div key={oi} style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                              <span style={{fontSize:11,color:'var(--text3)',minWidth:18,textAlign:'center'}}>{oi+1}.</span>
                              <input className="form-input" style={{flex:1,fontSize:13}} placeholder={`Option ${oi+1} (EN)`} value={o.label} onChange={e=>updateOption(field.id,oi,'label',e.target.value)}/>
                              <input className="form-input" style={{flex:1,fontSize:13}} placeholder={`الخيار ${oi+1} (AR)`} value={o.label_ar||''} onChange={e=>updateOption(field.id,oi,'label_ar',e.target.value)} dir="rtl"/>
                              <button onClick={()=>removeOption(field.id,oi)} style={{background:'none',border:'none',cursor:'pointer',color:'#EE334E',padding:'3px 5px',borderRadius:5}} onMouseEnter={e=>e.currentTarget.style.background='rgba(238,51,78,.08)'} onMouseLeave={e=>e.currentTarget.style.background='none'}><i className="ti ti-x" style={{fontSize:13}}/></button>
                            </div>
                          ))}
                          <button onClick={()=>addOption(field.id)} className="btn btn-blue" style={{marginTop:6,fontSize:12,padding:'5px 14px'}}>
                            <i className="ti ti-plus"/> {ar?'إضافة خيار':'Add option'}
                          </button>
                        </div>
                      )}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addField} className="btn btn-blue" style={{marginTop:12,width:'100%',justifyContent:'center'}}>
                  <i className="ti ti-plus"/> {ar?'إضافة حقل':'Add Field'}
                </button>
              </div>

              {/* Approval workflow */}
              <div>
                <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{ar?'مسار الموافقة':'Approval Workflow'}</div>
                <div style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>{ar?'اختياري — اترك فارغاً لمراجعة إدارية مباشرة':'Optional — leave empty for direct admin review'}</div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {steps.map((step,idx)=>(
                    <div key={step.id} style={{background:'var(--surface)',borderRadius:10,border:'1px solid var(--border)',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
                      <div style={{display:'flex',gap:8,alignItems:'center',padding:'9px 12px',background:'var(--surface2)',borderBottom:'1px solid var(--border)'}}>
                        <span style={{fontSize:11,fontWeight:700,color:'var(--text3)',minWidth:16}}>{idx+1}.</span>
                        <button onClick={()=>moveStep(step.id,-1)} disabled={idx===0} style={{background:'none',border:'none',cursor:idx===0?'default':'pointer',opacity:idx===0?.3:1}}><i className="ti ti-chevron-up"/></button>
                        <button onClick={()=>moveStep(step.id,1)} disabled={idx===steps.length-1} style={{background:'none',border:'none',cursor:idx===steps.length-1?'default':'pointer',opacity:idx===steps.length-1?.3:1}}><i className="ti ti-chevron-down"/></button>
                        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:12,marginLeft:'auto',cursor:'pointer',userSelect:'none'}}>
                          <input type="checkbox" checked={step.is_required!==false} onChange={e=>updateStep(step.id,'is_required',e.target.checked)}/>
                          <span style={{color:step.is_required!==false?'#EE334E':'var(--text3)',fontWeight:600}}>{ar?'مطلوب':'Required'}</span>
                        </label>
                        <button onClick={()=>removeStep(step.id)} className="action-btn action-btn-delete" style={{padding:'3px 8px',flexShrink:0}}><i className="ti ti-trash" style={{fontSize:13}}/></button>
                      </div>
                      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                          <input className="form-input" placeholder={ar?'اسم الخطوة (EN)':'Step name (EN)'} value={step.name} onChange={e=>updateStep(step.id,'name',e.target.value)}/>
                          <input className="form-input" placeholder="اسم الخطوة (AR)" value={step.name_ar||''} onChange={e=>updateStep(step.id,'name_ar',e.target.value)} dir="rtl"/>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                          <select className="form-input" value={step.approver_user_id?'':(step.approver_role||'admin')}
                            onChange={e=>{updateStep(step.id,'approver_role',e.target.value); updateStep(step.id,'approver_user_id',null)}}>
                            {WORKFLOW_APPROVER_ROLES.map(r=><option key={r} value={r}>{ar?(ROLE_LABELS_AR[r]||r):(ROLE_LABELS_EN[r]||r)}</option>)}
                          </select>
                          <select className="form-input" value={step.approver_user_id||''}
                            onChange={e=>updateStep(step.id,'approver_user_id',e.target.value||null)}>
                            <option value="">{ar?'— أي مستخدم من الدور —':'— Any user with role —'}</option>
                            {staffProfiles.map(p=><option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addStep} className="btn btn-blue" style={{marginTop:12,width:'100%',justifyContent:'center'}}>
                  <i className="ti ti-plus"/> {ar?'إضافة خطوة':'Add Step'}
                </button>
              </div>
            </div>

            {/* Modal footer */}
            <div style={{padding:'16px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button className="btn-cancel" onClick={()=>setShowFormModal(false)}>{ar?'إلغاء':'Cancel'}</button>
              <button className="btn btn-red" onClick={saveForm} disabled={saving}>
                {saving?(ar?'جارٍ الحفظ…':'Saving…'):(ar?'حفظ النموذج':'Save Form')}
              </button>
            </div>
          </div>
        </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // MY SUBMISSIONS VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view==='my-submissions') return (
    <div>
      <div className="page-header" style={{marginBottom:20}}>
        <div>
          <BackButton onClick={()=>setView('list')} label={ar?'رجوع':'Back'} />
          <div className="page-title">{ar?'طلباتي المرسلة':'My Submissions'}</div>
        </div>
      </div>
      {submissions.length===0
        ? <div className="empty">{ar?'لا توجد طلبات مرسلة بعد':'No submissions yet'}</div>
        : <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {submissions.map(s=>{
              const f=s.request_forms, clr=f?.color||'#0085C7'
              const hasWf = (f?.request_form_workflow_steps||[]).length>0
              const stepDef = hasWf ? f.request_form_workflow_steps.find(st=>st.step_order===s.current_step_order) : null
              return (
                <div key={s.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 18px',display:'flex',alignItems:'center',gap:14,boxShadow:'var(--shadow)',cursor:'pointer'}}
                  onClick={()=>{setSelectedSub(s);setView('my-submission-view')}}>
                  <div style={{width:40,height:40,borderRadius:10,background:clr+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <i className={`ti ${f?.icon||'ti-clipboard-text'}`} style={{fontSize:18,color:clr}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{ar?(f?.title_ar||f?.title):f?.title}</div>
                    <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>
                      {new Date(s.submitted_at).toLocaleDateString()}
                      {s.reference_number && <> · {s.reference_number}</>}
                      {stepDef && <> · {ar?(stepDef.name_ar||stepDef.name):stepDef.name}</>}
                    </div>
                    {s.admin_notes && <div style={{fontSize:12,color:'var(--text2)',marginTop:4,fontStyle:'italic'}}>"{s.admin_notes}"</div>}
                  </div>
                  {statusBadge(s.status)}
                  <button className="action-btn action-btn-edit" title={ar?'طباعة':'Print'} onClick={e=>{e.stopPropagation();printSubmission(s.request_forms, s)}}>
                    <i className="ti ti-printer"/>
                  </button>
                  <button className="action-btn action-btn-edit" title={ar?'تنزيل PDF':'Download PDF'} onClick={e=>{e.stopPropagation();downloadSubmissionPdf(s.request_forms, s)}}>
                    <i className="ti ti-download"/>
                  </button>
                  {CANCELLABLE_STATUSES.includes(s.status) && !s.is_guest && (
                    <button className="action-btn action-btn-delete" title={ar?'إلغاء الطلب':'Cancel Submission'} onClick={e=>{e.stopPropagation();setCancelConfirm(s)}}>
                      <i className="ti ti-x"/>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
      }
      {cancelConfirm && (
        <ConfirmModal
          title={ar?'إلغاء الطلب':'Cancel Submission'}
          message={ar?'هل أنت متأكد من إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.':'Are you sure you want to cancel this submission? This cannot be undone.'}
          onConfirm={()=>doCancel(cancelConfirm)}
          onCancel={()=>setCancelConfirm(null)} />
      )}
      {formModalJsx}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // MY SUBMISSION — READ-ONLY VIEW (non-admin, their own submission)
  // ─────────────────────────────────────────────────────────────────────────
  if (view==='my-submission-view' && selectedSub) {
    const f = selectedSub.request_forms
    const hasWf = (f?.request_form_workflow_steps||[]).length>0
    return (
      <div>
        <div className="page-header" style={{marginBottom:20}}>
          <div>
            <BackButton onClick={()=>setView('my-submissions')} label={ar?'رجوع':'Back'} />
            <div className="page-title">{ar?(f?.title_ar||f?.title):f?.title}</div>
            <div className="page-sub">
              {new Date(selectedSub.submitted_at).toLocaleString()}
              {selectedSub.reference_number && <> · {selectedSub.reference_number}</>}
            </div>
          </div>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            {statusBadge(selectedSub.status)}
            <button className="action-btn action-btn-edit" onClick={()=>printSubmission(f, selectedSub)}>
              <i className="ti ti-printer"/> {ar?'طباعة':'Print'}
            </button>
            <button className="action-btn action-btn-edit" onClick={()=>downloadSubmissionPdf(f, selectedSub)}>
              <i className="ti ti-download"/> {ar?'تنزيل PDF':'Download PDF'}
            </button>
            {CANCELLABLE_STATUSES.includes(selectedSub.status) && !selectedSub.is_guest && (
              <button className="action-btn action-btn-delete" onClick={()=>setCancelConfirm(selectedSub)}>
                <i className="ti ti-x"/> {ar?'إلغاء الطلب':'Cancel Submission'}
              </button>
            )}
          </div>
        </div>

        {hasWf && (
          <div className="card" style={{maxWidth:640,marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>{ar?'مسار الموافقة':'Approval Workflow'}</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {f.request_form_workflow_steps.map(step=>{
                const done = ['approved','completed'].includes(selectedSub.status) || step.step_order < (selectedSub.current_step_order??Infinity)
                const isCurrent = ACTIVE_STATUSES.includes(selectedSub.status) && step.step_order===selectedSub.current_step_order
                return (
                  <div key={step.id} style={{display:'flex',alignItems:'center',gap:10,fontSize:13}}>
                    <i className={`ti ${done?'ti-circle-check-filled':isCurrent?'ti-circle-dot':'ti-circle'}`} style={{color:done?'#009F6B':isCurrent?'#8b5cf6':'var(--text3)',fontSize:16}}/>
                    <span style={{fontWeight:isCurrent?600:400}}>{ar?(step.name_ar||step.name):step.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="card" style={{maxWidth:640}}>
          {(f?.request_form_fields||[]).map(field=>{
            const ans = selectedSub.answers[field.id]
            return (
              <div key={field.id} style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--border)'}}>
                <div style={{fontSize:11,color:'var(--text3)',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>{ar?(field.label_ar||field.label):field.label}</div>
                <div style={{fontSize:14,color:'var(--text)',fontWeight:500}}>
                  {Array.isArray(ans)?ans.join(', '):(ans||<span style={{color:'var(--text3)'}}>—</span>)}
                </div>
              </div>
            )
          })}
          {selectedSub.admin_notes && (
            <div style={{background:'var(--surface2)',borderRadius:8,padding:'10px 14px',marginTop:4}}>
              <div style={{fontSize:11,color:'var(--text3)',marginBottom:4,fontWeight:600}}>{ar?'ملاحظات':'Admin Notes'}</div>
              <div style={{fontSize:13}}>{selectedSub.admin_notes}</div>
            </div>
          )}
        </div>
        {cancelConfirm && (
          <ConfirmModal
            title={ar?'إلغاء الطلب':'Cancel Submission'}
            message={ar?'هل أنت متأكد من إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.':'Are you sure you want to cancel this submission? This cannot be undone.'}
            onConfirm={()=>doCancel(cancelConfirm)}
            onCancel={()=>setCancelConfirm(null)} />
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FILL FORM VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view==='fill-form' && selectedForm) {
    const clr = selectedForm.color||'#0085C7'
    return (
      <div>
        <div className="page-header" style={{marginBottom:20}}>
          <div>
            <BackButton onClick={()=>setView('list')} label={ar?'رجوع':'Back'} />
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:44,height:44,borderRadius:12,background:clr+'18',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <i className={`ti ${selectedForm.icon||'ti-clipboard-text'}`} style={{fontSize:22,color:clr}}/>
              </div>
              <div>
                <div className="page-title">{ar?(selectedForm.title_ar||selectedForm.title):selectedForm.title}</div>
                {selectedForm.description && <div className="page-sub">{ar?(selectedForm.description_ar||selectedForm.description):selectedForm.description}</div>}
              </div>
            </div>
          </div>
        </div>
        <div className="card" style={{maxWidth:640}}>
          {(selectedForm.request_form_fields||[]).map(field=>(
            <div key={field.id} className="form-group" style={{marginBottom:18}}>
              <label className="form-label">
                {ar?(field.label_ar||field.label):field.label}
                {field.is_required && <span style={{color:'#EE334E',marginLeft:4}}>*</span>}
              </label>
              {renderFieldInput(field)}
            </div>
          ))}
          <div style={{display:'flex',gap:10,marginTop:8}}>
            <button className="btn btn-blue" onClick={submitForm} disabled={submitting}>
              <i className="ti ti-send"/> {submitting?(ar?'جارٍ الإرسال…':'Submitting…'):(ar?'إرسال':'Submit')}
            </button>
            <button className="btn-cancel" onClick={()=>setView('list')}>{ar?'إلغاء':'Cancel'}</button>
          </div>
        </div>
        {formModalJsx}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FORM DETAIL (admin — submissions list)
  // ─────────────────────────────────────────────────────────────────────────
  if (view==='form-detail' && selectedForm && isAdmin) {
    const clr = selectedForm.color||'#0085C7'
    const pendingCount = filteredSubs.filter(s=>ACTIVE_STATUSES.includes(s.status)).length
    return (
      <div>
        <div className="page-header" style={{marginBottom:20}}>
          <div>
            <BackButton onClick={()=>setView('list')} label={ar?'رجوع':'Back'} />
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:44,height:44,borderRadius:12,background:clr+'18',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <i className={`ti ${selectedForm.icon||'ti-clipboard-text'}`} style={{fontSize:22,color:clr}}/>
              </div>
              <div>
                <div className="page-title">{ar?(selectedForm.title_ar||selectedForm.title):selectedForm.title}</div>
                <div className="page-sub">{formSubs.length} {ar?'طلب':'submission(s)'}{pendingCount>0 && <span style={{color:'#EE334E',fontWeight:600}}> · {pendingCount} {ar?'قيد الانتظار':'pending'}</span>}</div>
              </div>
            </div>
          </div>
          {canEditData && (
          <div style={{display:'flex',gap:8}}>
            <button className="action-btn action-btn-edit" onClick={()=>openEditForm(selectedForm)}><i className="ti ti-edit"/> {ar?'تعديل':'Edit'}</button>
            <button className="action-btn action-btn-delete" onClick={()=>setConfirmDel(selectedForm)}><i className="ti ti-trash"/></button>
          </div>
          )}
        </div>

        {/* Status filter tabs */}
        <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
          {['all','submitted','under_review','pending_approval','returned','approved','rejected','completed'].map(s=>{
            const m = s==='all' ? null : STATUS_META[s]
            const active = subFilter===s
            return (
              <button key={s} onClick={()=>setSubFilter(s)}
                style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${active?(m?.color||'var(--blue)'):'var(--border)'}`,background:active?(m?.bg||'rgba(0,133,199,.08)'):'var(--surface)',color:active?(m?.color||'#0085C7'):'var(--text2)',fontSize:12,fontWeight:active?600:400,cursor:'pointer',transition:'all .15s'}}>
                {s==='all'?(ar?'الكل':'All'):(ar?STATUS_META[s].label_ar:STATUS_META[s].label)}
                {s!=='all' && formSubs.filter(x=>x.status===s).length>0 && <span style={{marginLeft:5,background:m?.color,color:'white',borderRadius:10,padding:'1px 5px',fontSize:10}}>{formSubs.filter(x=>x.status===s).length}</span>}
              </button>
            )
          })}
        </div>

        {filteredSubs.length===0
          ? <div className="empty">{ar?'لا توجد طلبات':'No submissions'}</div>
          : <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {filteredSubs.map(s=>{
                const initName = s.is_guest ? (s.guest_name||'Guest') : (s.profiles?.full_name||'?')
                const roleClr = s.is_guest ? ROLE_COLORS.guest : (ROLE_COLORS[s.profiles?.role]||'#999')
                return (
                  <div key={s.id}
                    style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 18px',display:'flex',alignItems:'center',gap:14,cursor:'pointer',transition:'all .15s',boxShadow:'var(--shadow)'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border2)'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
                    onClick={()=>{setSelectedSub(s);fetchSubActions(s.id);fetchSubFiles(s.id);setActionNote('');setView('submission-view')}}>
                    <div style={{width:36,height:36,borderRadius:'50%',background:roleClr,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white',flexShrink:0}}>
                      {initials(initName)}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:6}}>
                        {initName}
                        {s.is_guest && <span style={{fontSize:10,fontWeight:700,color:'#64748b',background:'#f1f5f9',padding:'2px 7px',borderRadius:10}}>{ar?'ضيف':'GUEST'}</span>}
                      </div>
                      <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>
                        {new Date(s.submitted_at).toLocaleDateString()}{!s.is_guest && <> · <span style={{color:roleClr,fontWeight:500}}>{s.profiles?.role}</span></>}
                        {s.reference_number && <> · {s.reference_number}</>}
                      </div>
                    </div>
                    {statusBadge(s.status)}
                    <i className="ti ti-chevron-right" style={{color:'var(--text3)',fontSize:16}}/>
                  </div>
                )
              })}
            </div>
        }
        {confirmDel && <ConfirmModal title={ar?'حذف النموذج':'Delete form'} message={`${ar?'حذف':'Delete'} "${confirmDel.title}"?`} onConfirm={()=>deleteForm(confirmDel)} onCancel={()=>setConfirmDel(null)}/>}
        {formModalJsx}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMISSION DETAIL VIEW (admin reviews)
  // ─────────────────────────────────────────────────────────────────────────
  if (view==='submission-view' && selectedSub && isAdmin) {
    const form = forms.find(f=>f.id===selectedSub.form_id)
    const clr = form?.color||'#0085C7'
    const hasWorkflow = (form?.request_form_workflow_steps||[]).length > 0
    const subName = selectedSub.is_guest ? (selectedSub.guest_name||'Guest') : (selectedSub.profiles?.full_name||'?')
    const subRoleClr = selectedSub.is_guest ? ROLE_COLORS.guest : (ROLE_COLORS[selectedSub.profiles?.role]||'#999')
    const canAct = !ACTIVE_STATUSES.includes(selectedSub.status) ? false :
      canEditData || (selectedSub.current_approver_id ? selectedSub.current_approver_id===profile.id
        : selectedSub.current_approver_role===profile.role)
    const currentStepDef = hasWorkflow ? form.request_form_workflow_steps.find(s=>s.step_order===selectedSub.current_step_order) : null

    async function doAction(action) {
      setActing(true)
      const { data, error } = await supabase.rpc('act_on_request_submission', { p_submission_id: selectedSub.id, p_action: action, p_comment: actionNote||null })
      setActing(false)
      if (error || data?.status!=='ok') return toast(data?.status==='not_permitted'?(ar?'غير مسموح':'Not permitted'):(error?.message||(ar?'فشل':'Failed')),'error')
      toast(ar?'تم التحديث':'Updated','success')
      if (isTrustedAdmin(profile)) {
        logAdminActivity({ actor: profile, action: action==='approve'?'approved':action==='reject'?'rejected':action, entityType:'request', entityId:selectedSub.id, entityLabel: form?.title||'request', module:'requests' })
      }
      setActionNote('')
      const newStatus = data?.new_status || selectedSub.status
      setSelectedSub(p=>({...p, status:newStatus}))
      fetchSubActions(selectedSub.id); fetchFormSubs(selectedSub.form_id); fetchForms()
    }
    async function doComplete() {
      const { data, error } = await supabase.rpc('mark_request_completed', { p_submission_id: selectedSub.id })
      if (error || data?.status!=='ok') return toast(ar?'فشل':'Failed','error')
      toast(ar?'تم الإكمال':'Marked completed','success')
      setSelectedSub(p=>({...p, status:'completed'}))
      fetchFormSubs(selectedSub.form_id); fetchForms()
    }

    return (
      <div className={ar ? 'submission-detail-rtl' : undefined} dir={ar ? 'rtl' : 'ltr'}>
        <div className="page-header" style={{marginBottom:20, flexWrap:'wrap', gap:12}}>
          <div>
            <BackButton onClick={()=>setView('form-detail')} label={ar?'رجوع':'Back'} />
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:subRoleClr,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white',flexShrink:0}}>
                {initials(subName)}
              </div>
              <div>
                <div className="page-title" style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  {subName}
                  {selectedSub.is_guest && <span style={{fontSize:10,fontWeight:700,color:'#64748b',background:'#f1f5f9',padding:'2px 7px',borderRadius:10}}>{ar?'ضيف':'GUEST'}</span>}
                </div>
                <div className="page-sub">
                  {new Date(selectedSub.submitted_at).toLocaleString()}
                  {selectedSub.reference_number && <> · {selectedSub.reference_number}</>}
                  {selectedSub.is_guest && selectedSub.guest_contact && <> · {selectedSub.guest_contact}</>}
                </div>
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
            {statusBadge(selectedSub.status)}
            <button className="action-btn action-btn-edit" onClick={()=>openSubmissionPdfPreview(form, selectedSub, 'submission-view')} disabled={pdfPreviewLoading}>
              <i className="ti ti-eye"/> {pdfPreviewLoading ? (ar?'جارٍ التحضير…':'Preparing…') : (ar?'معاينة':'Preview')}
            </button>
            <button className="action-btn action-btn-edit" onClick={()=>downloadSubmissionPdf(form, selectedSub)}>
              <i className="ti ti-download"/> {ar?'تنزيل PDF':'Download PDF'}
            </button>
            {!hasWorkflow && canEditData && (
              <button className="btn btn-blue"
                onClick={()=>{setReviewSub(selectedSub);setReviewNote(selectedSub.admin_notes||'');setReviewStatus(ACTIVE_STATUSES.includes(selectedSub.status)?'approved':selectedSub.status)}}>
                <i className="ti ti-edit"/> {ar?'مراجعة':'Review'}
              </button>
            )}
            {selectedSub.status==='approved' && canEditData && (
              <button className="btn btn-blue" onClick={doComplete}><i className="ti ti-check"/> {ar?'وضع علامة مكتمل':'Mark Completed'}</button>
            )}
          </div>
        </div>

        {hasWorkflow && (
          <div className="card" style={{maxWidth:640,marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>{ar?'مسار الموافقة':'Approval Workflow'}</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {form.request_form_workflow_steps.map(step=>{
                const done = ['approved','completed'].includes(selectedSub.status) || step.step_order < (selectedSub.current_step_order??Infinity)
                const isCurrent = ACTIVE_STATUSES.includes(selectedSub.status) && step.step_order===selectedSub.current_step_order
                return (
                  <div key={step.id} style={{display:'flex',alignItems:'center',gap:10,fontSize:13}}>
                    <i className={`ti ${done?'ti-circle-check-filled':isCurrent?'ti-circle-dot':'ti-circle'}`} style={{color:done?'#009F6B':isCurrent?'#8b5cf6':'var(--text3)',fontSize:16}}/>
                    <span style={{fontWeight:isCurrent?600:400}}>{ar?(step.name_ar||step.name):step.name}</span>
                    <span style={{color:'var(--text3)',fontSize:11}}>({ar?(ROLE_LABELS_AR[step.approver_role]||''):(ROLE_LABELS_EN[step.approver_role]||'')})</span>
                  </div>
                )
              })}
            </div>
            {canAct && (
              <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid var(--border)'}}>
                <textarea className="form-input" rows={2} placeholder={ar?'تعليق (اختياري)':'Comment (optional)'} value={actionNote} onChange={e=>setActionNote(e.target.value)} style={{resize:'vertical',marginBottom:10}}/>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  <button className="btn btn-blue" disabled={acting} onClick={()=>doAction('approve')}><i className="ti ti-check"/> {ar?'موافقة':'Approve'}</button>
                  <button className="btn btn-red" disabled={acting} onClick={()=>doAction('reject')}><i className="ti ti-x"/> {ar?'رفض':'Reject'}</button>
                  <button className="action-btn action-btn-edit" disabled={acting} onClick={()=>doAction('return')}><i className="ti ti-corner-up-left"/> {ar?'إعادة للتصحيح':'Return for Correction'}</button>
                  <button className="btn-cancel" disabled={acting || !actionNote.trim()} onClick={()=>doAction('comment')}><i className="ti ti-message"/> {ar?'تعليق فقط':'Comment Only'}</button>
                </div>
              </div>
            )}
            {!selectedSub.is_guest && subActions.length>0 && (
              <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid var(--border)'}}>
                <div style={{fontWeight:700,fontSize:12,marginBottom:8,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.04em'}}>{ar?'سجل الإجراءات':'Action History'}</div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {subActions.map(a=>(
                    <div key={a.id} style={{fontSize:12.5}}>
                      <span style={{fontWeight:600}}>{a.profiles?.full_name||'—'}</span>{' '}
                      <span style={{color:'var(--text3)'}}>{a.action} · {new Date(a.acted_at).toLocaleString()}</span>
                      {a.comment && <div style={{color:'var(--text2)',marginTop:2,fontStyle:'italic'}}>"{a.comment}"</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="card" style={{maxWidth:640}}>
          {(form?.request_form_fields||[]).map(field=>{
            const ans = selectedSub.answers[field.id]
            return (
              <div key={field.id} style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--border)', textAlign: ar ? 'right' : 'left'}}>
                <div style={{fontSize:11,color:'var(--text3)',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>{ar?(field.label_ar||field.label):field.label}</div>
                <div style={{fontSize:14,color:'var(--text)',fontWeight:500,wordBreak:'break-word'}} dir="auto">
                  {Array.isArray(ans)?ans.join(', '):(ans||<span style={{color:'var(--text3)'}}>—</span>)}
                </div>
              </div>
            )
          })}
          {selectedSub.admin_notes && (
            <div style={{background:'var(--surface2)',borderRadius:8,padding:'10px 14px',marginTop:4}}>
              <div style={{fontSize:11,color:'var(--text3)',marginBottom:4,fontWeight:600}}>{ar?'ملاحظات':'Admin Notes'}</div>
              <div style={{fontSize:13}}>{selectedSub.admin_notes}</div>
            </div>
          )}
        </div>

        {/* Attachments — files uploaded through this submission's 'file'
            fields, strictly linked via request_submission_files.submission_id.
            Stay visible regardless of status (approved/rejected/completed). */}
        {subFiles.length > 0 && (
          <div className="card" style={{maxWidth:640,marginTop:16}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>
              <i className="ti ti-paperclip" style={{marginRight:6}}/> {ar?'المرفقات':'Attachments'} ({subFiles.length})
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {subFiles.map(f=>{
                const field = (form?.request_form_fields||[]).find(fl=>fl.id===f.field_id)
                return (
                  <div key={f.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',border:'1px solid var(--border)',borderRadius:8}}>
                    <div style={{width:32,height:32,borderRadius:7,background:'var(--surface2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <i className="ti ti-file" style={{fontSize:15,color:'var(--text2)'}}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.file_name}</div>
                      <div style={{fontSize:11,color:'var(--text3)'}}>
                        {field ? (ar?(field.label_ar||field.label):field.label)+' · ' : ''}
                        {formatFileSize(f.file_size)}
                        {f.uploaded_at && <> · {new Date(f.uploaded_at).toLocaleDateString()}</>}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6,flexShrink:0}}>
                      {f.signedUrl ? (
                        <>
                          <a href={f.signedUrl} target="_blank" rel="noreferrer" download={f.file_name}
                            style={{display:'flex',alignItems:'center',justifyContent:'center',width:28,height:28,borderRadius:7,border:'1px solid var(--border)',color:'var(--text2)'}}
                            title={ar?'تنزيل':'Download'}>
                            <i className="ti ti-download" style={{fontSize:14}}/>
                          </a>
                          <DocPreviewButton url={f.signedUrl} name={f.file_name} />
                        </>
                      ) : (
                        <span style={{fontSize:11,color:'var(--text3)'}}>{ar?'غير مصرح':'Not authorized'}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Review modal (no-workflow forms only) */}
        {reviewSub && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}
            onMouseDown={e => { if (e.target === e.currentTarget) setReviewSub(null) }}>
            <div style={{background:'var(--surface)',borderRadius:16,padding:24,width:420,boxShadow:'0 8px 32px rgba(0,0,0,.2)',border:'1px solid var(--border)'}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:16}}>{ar?'مراجعة الطلب':'Review Request'}</div>
              <div className="form-group">
                <label className="form-label">{ar?'الحالة':'Status'}</label>
                <select className="form-input" value={reviewStatus} onChange={e=>setReviewStatus(e.target.value)}>
                  {Object.entries(STATUS_META).map(([k,v])=><option key={k} value={k}>{ar?v.label_ar:v.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{ar?'ملاحظة (اختياري)':'Note (optional)'}</label>
                <textarea className="form-input" rows={3} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} style={{resize:'vertical'}}/>
              </div>
              <div style={{display:'flex',gap:10,marginTop:8}}>
                <button className="btn btn-blue" onClick={saveReview}>{ar?'حفظ':'Save'}</button>
                <button className="btn-cancel" onClick={()=>setReviewSub(null)}>{ar?'إلغاء':'Cancel'}</button>
              </div>
            </div>
          </div>
        )}
        {formModalJsx}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN SUBMISSION PDF PREVIEW — dedicated in-app page, not a browser
  // print dialog. Shows the exact same generated PDF (via previewSubmissionPdf,
  // which shares buildPrintHtml with Print and Download) with its own
  // Back / Print / Download controls. Print here is the ONLY control that
  // triggers the browser print dialog; Download reuses the already-
  // generated blob instead of regenerating the PDF a second time.
  // ─────────────────────────────────────────────────────────────────────────
  if (view==='submission-pdf-preview' && pdfPreview && isAdmin) {
    return (
      <div className="pdf-preview-page">
        <div className="pdf-preview-toolbar">
          <button className="action-btn action-btn-edit pdf-preview-back" onClick={closeSubmissionPdfPreview}>
            <i className="ti ti-arrow-left"/> {ar?'رجوع':'Back'}
          </button>
          <div className="pdf-preview-title">{ar?(pdfPreview.form?.title_ar||pdfPreview.form?.title):pdfPreview.form?.title}</div>
          <div className="pdf-preview-actions">
            <button className="action-btn action-btn-edit" onClick={()=>printSubmission(pdfPreview.form, pdfPreview.submission)}>
              <i className="ti ti-printer"/> {ar?'طباعة':'Print'}
            </button>
            <button className="btn btn-blue" onClick={()=>{
              const a = document.createElement('a')
              a.href = pdfPreview.url
              a.download = pdfPreview.filename
              a.click()
            }}>
              <i className="ti ti-download"/> {ar?'تنزيل PDF':'Download PDF'}
            </button>
          </div>
        </div>
        <div className="pdf-preview-frame-wrap">
          <iframe src={pdfPreview.url} title="Submission PDF preview" className="pdf-preview-frame" />
        </div>
      </div>
    )
  }

  function openForm(f) { setSelectedForm(f); setAnswers({}); setPendingFiles({}); setDraftId(crypto.randomUUID()); setView('fill-form') }
  function openFormDetail(f, initialFilter = 'all') { setSelectedForm(f); fetchFormSubs(f.id); setSubFilter(initialFilter); setView('form-detail') }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {confirmDel && <ConfirmModal title={ar?'حذف النموذج':'Delete form'} message={`${ar?'حذف':'Delete'} "${confirmDel.title}"?`} onConfirm={()=>deleteForm(confirmDel)} onCancel={()=>setConfirmDel(null)}/>}

      <div className="page-header" style={{marginBottom:20}}>
        <div>
          <div className="page-title">{ar?'الطلبات':'Requests'}</div>
          <div className="page-sub">{ar?'نماذج الطلبات الرسمية':'Official request forms'}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {!isAdmin && (
            <button className="action-btn action-btn-edit" onClick={()=>{setView('my-submissions');fetchMySubs()}}>
              <i className="ti ti-history"/> {ar?'طلباتي المرسلة':'My Submissions'}
            </button>
          )}
          {canEditData && (
            <button className="btn btn-red" onClick={openCreateForm}>
              <i className="ti ti-plus"/> {ar?'نموذج جديد':'New Form'}
            </button>
          )}
        </div>
      </div>

      {loading
        ? <div className="empty"><i className="ti ti-loader ti-spin"/> {ar?'جارٍ التحميل…':'Loading…'}</div>
        : visibleForms.length===0
          ? <div className="empty">{ar?'لا توجد نماذج متاحة':'No request forms available'}</div>
          : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
              {visibleForms.map(f=>{
                const clr = f.color||'#0085C7'
                const cnt = subCounts[f.id]
                return (
                  <div key={f.id}
                    style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',cursor:'pointer',transition:'all .15s',boxShadow:'var(--shadow)',opacity:f.is_active?1:.7}}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,.09)'}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='var(--shadow)'}}
                    onClick={()=>isAdmin?openFormDetail(f):openForm(f)}>
                    {/* Color accent bar */}
                    <div style={{height:4,background:`linear-gradient(90deg,${clr},${clr}99)`}}/>
                    <div style={{padding:18}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
                        <div style={{width:42,height:42,borderRadius:11,background:clr+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <i className={`ti ${f.icon||'ti-clipboard-text'}`} style={{fontSize:20,color:clr}}/>
                        </div>
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          {isAdmin && cnt?.pending>0 && (
                            <span style={{background:'#EE334E',color:'white',fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20}}>
                              {cnt.pending} {ar?'جديد':'new'}
                            </span>
                          )}

                        </div>
                      </div>
                      <div style={{fontWeight:700,fontSize:15,color:'var(--text)',marginBottom:4}}>{ar?(f.title_ar||f.title):f.title}</div>
                      {(ar?(f.description_ar||f.description):f.description) && (
                        <div style={{fontSize:12,color:'var(--text2)',marginBottom:12,lineHeight:1.6}}>
                          {ar?(f.description_ar||f.description):f.description}
                        </div>
                      )}
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8}}>
                        <div style={{display:'flex',gap:12,fontSize:11,color:'var(--text3)'}}>
                          <span><i className="ti ti-forms" style={{fontSize:12}}/> {(f.request_form_fields||[]).length} {ar?'حقل':'fields'}</span>
                          {isAdmin && cnt?.total>0 && <span><i className="ti ti-send" style={{fontSize:12}}/> {cnt.total}</span>}
                        </div>
                        <span style={{fontSize:10,fontWeight:600,padding:'2px 9px',borderRadius:20,background:f.is_active?'rgba(0,159,107,.1)':'rgba(180,180,180,.12)',color:f.is_active?'#009F6B':'#999'}}>
                          {f.is_active?(ar?'نشط':'Active'):(ar?'معطّل':'Inactive')}
                        </span>
                      </div>
                      {!isAdmin && (
                        <button className="btn btn-blue" style={{width:'100%',marginTop:14,justifyContent:'center'}}
                          onClick={e=>{e.stopPropagation();openForm(f)}}>
                          <i className="ti ti-send"/> {ar?'تقديم طلب':'Submit Request'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
      }

      {formModalJsx}
    </div>
  )

}
