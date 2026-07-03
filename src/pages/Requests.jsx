import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast, ConfirmModal } from '../components/Toast'
import { canEdit } from '../lib/useAuth'

const FIELD_TYPES = [
  { value:'text',     icon:'ti-forms',         label:'Short Text',   label_ar:'نص قصير' },
  { value:'textarea', icon:'ti-align-left',     label:'Long Text',    label_ar:'نص طويل' },
  { value:'number',   icon:'ti-number',         label:'Number',       label_ar:'رقم' },
  { value:'date',     icon:'ti-calendar',       label:'Date',         label_ar:'تاريخ' },
  { value:'email',    icon:'ti-mail',           label:'Email',        label_ar:'البريد الإلكتروني' },
  { value:'phone',    icon:'ti-phone',          label:'Phone',        label_ar:'الهاتف' },
  { value:'dropdown', icon:'ti-chevron-down',   label:'Dropdown',     label_ar:'قائمة منسدلة' },
  { value:'radio',    icon:'ti-circle-dot',     label:'Single Choice',label_ar:'اختيار واحد' },
  { value:'checkbox', icon:'ti-checkbox',       label:'Multiple Choice',label_ar:'اختيار متعدد' },
  { value:'yes_no',   icon:'ti-toggle-left',    label:'Yes / No',     label_ar:'نعم / لا' },
  { value:'file',     icon:'ti-paperclip',      label:'File Upload',  label_ar:'رفع ملف' },
]

const STATUS_META = {
  pending:   { color:'#f59e0b', bg:'#fffbeb', label:'Pending',   label_ar:'قيد الانتظار' },
  in_review: { color:'#0085C7', bg:'#e8f4fd', label:'In Review', label_ar:'قيد المراجعة' },
  approved:  { color:'#009F6B', bg:'#e8f7f2', label:'Approved',  label_ar:'مقبول' },
  rejected:  { color:'#EE334E', bg:'#fef2f4', label:'Rejected',  label_ar:'مرفوض' },
}

const ROLES = ['admin','coach','athlete','employee']

const emptyForm = () => ({
  title:'', title_ar:'', description:'', description_ar:'',
  visible_to: [...ROLES], is_private: false, is_active: true,
})

const emptyField = () => ({
  label:'', label_ar:'', field_type:'text', is_required: false,
  options: [], sort_order: 0,
})

export default function Requests({ profile, onNav }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'
  const isAdmin = profile?.role === 'admin'

  // ── data ──────────────────────────────────────────────────────────────────
  const [forms, setForms]             = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading]         = useState(true)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [view, setView]                   = useState('list')        // list | form-detail | submission-view | my-submissions
  const [selectedForm, setSelectedForm]   = useState(null)
  const [selectedSub, setSelectedSub]     = useState(null)
  const [formSubs, setFormSubs]           = useState([])

  // ── form builder ──────────────────────────────────────────────────────────
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingForm, setEditingForm]     = useState(null)
  const [formData, setFormData]           = useState(emptyForm())
  const [fields, setFields]               = useState([])           // form fields being built
  const [saving, setSaving]               = useState(false)

  // ── submission ────────────────────────────────────────────────────────────
  const [answers, setAnswers]           = useState({})
  const [submitting, setSubmitting]     = useState(false)
  const [confirmDel, setConfirmDel]     = useState(null)

  // ── review modal ──────────────────────────────────────────────────────────
  const [reviewSub, setReviewSub]       = useState(null)
  const [reviewNote, setReviewNote]     = useState('')
  const [reviewStatus, setReviewStatus] = useState('approved')

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchForms = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('request_forms').select('*, request_form_fields(*)').order('created_at', { ascending: false })
    if (data) {
      data.forEach(f => f.request_form_fields?.sort((a,b) => a.sort_order - b.sort_order))
      setForms(data)
    }
    setLoading(false)
  }, [])

  const fetchMySubs = useCallback(async () => {
    const { data } = await supabase.from('request_submissions')
      .select('*, request_forms(title, title_ar)')
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

  useEffect(() => { fetchForms(); fetchMySubs() }, [fetchForms, fetchMySubs])

  // ── form builder helpers ──────────────────────────────────────────────────
  function openCreateForm() {
    setEditingForm(null)
    setFormData(emptyForm())
    setFields([{ ...emptyField(), id: crypto.randomUUID() }])
    setShowFormModal(true)
  }

  function openEditForm(f) {
    setEditingForm(f)
    setFormData({ title: f.title, title_ar: f.title_ar||'', description: f.description||'', description_ar: f.description_ar||'', visible_to: f.visible_to||[...ROLES], is_private: f.is_private, is_active: f.is_active })
    setFields((f.request_form_fields||[]).map(ff => ({
      ...ff,
      options: ff.options || [],
    })))
    setShowFormModal(true)
  }

  function addField() {
    setFields(prev => [...prev, { ...emptyField(), id: crypto.randomUUID(), sort_order: prev.length }])
  }

  function removeField(id) {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  function updateField(id, key, val) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f))
  }

  function addOption(fieldId) {
    setFields(prev => prev.map(f => f.id === fieldId
      ? { ...f, options: [...(f.options||[]), { label:'', label_ar:'' }] }
      : f))
  }

  function updateOption(fieldId, idx, key, val) {
    setFields(prev => prev.map(f => f.id === fieldId
      ? { ...f, options: f.options.map((o,i) => i===idx ? {...o,[key]:val} : o) }
      : f))
  }

  function removeOption(fieldId, idx) {
    setFields(prev => prev.map(f => f.id === fieldId
      ? { ...f, options: f.options.filter((_,i) => i!==idx) }
      : f))
  }

  function moveField(id, dir) {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === id)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]]
      return next.map((f,i) => ({...f, sort_order: i}))
    })
  }

  // ── save form ─────────────────────────────────────────────────────────────
  async function saveForm() {
    if (!formData.title.trim()) return toast(ar ? 'العنوان مطلوب' : 'Title required', 'error')
    if (fields.length === 0) return toast(ar ? 'أضف حقلاً واحداً على الأقل' : 'Add at least one field', 'error')
    setSaving(true)
    try {
      let formId = editingForm?.id
      if (editingForm) {
        await supabase.from('request_forms').update({ ...formData }).eq('id', formId)
        await supabase.from('request_form_fields').delete().eq('form_id', formId)
      } else {
        const { data } = await supabase.from('request_forms').insert({ ...formData, created_by: profile.id }).select().single()
        formId = data.id
      }
      const fieldRows = fields.map((f, i) => ({
        form_id: formId, label: f.label, label_ar: f.label_ar||'',
        field_type: f.field_type, is_required: f.is_required,
        options: ['dropdown','radio','checkbox'].includes(f.field_type) ? f.options : null,
        sort_order: i,
      }))
      await supabase.from('request_form_fields').insert(fieldRows)
      toast(editingForm ? (ar?'تم تحديث النموذج':'Form updated') : (ar?'تم إنشاء النموذج':'Form created'), 'success')
      setShowFormModal(false)
      fetchForms()
    } catch(e) { toast(e.message, 'error') }
    setSaving(false)
  }

  // ── delete form ───────────────────────────────────────────────────────────
  async function deleteForm(f) {
    await supabase.from('request_forms').delete().eq('id', f.id)
    toast(ar ? 'تم حذف النموذج' : 'Form deleted', 'success')
    setConfirmDel(null)
    if (view === 'form-detail') setView('list')
    fetchForms()
  }

  // ── submit form ───────────────────────────────────────────────────────────
  async function submitForm() {
    if (!selectedForm) return
    // validate required
    const missing = (selectedForm.request_form_fields||[]).filter(f => f.is_required && !answers[f.id]?.toString().trim())
    if (missing.length) return toast(ar ? `الحقول المطلوبة: ${missing.map(f=>ar?(f.label_ar||f.label):f.label).join(', ')}` : `Required: ${missing.map(f=>f.label).join(', ')}`, 'error')
    setSubmitting(true)
    try {
      await supabase.from('request_submissions').insert({
        form_id: selectedForm.id, submitted_by: profile.id, answers,
      })
      // notify admins
      const { data: admins } = await supabase.from('profiles').select('id').eq('role','admin')
      if (admins?.length) {
        await supabase.from('notifications').insert(admins.map(a => ({
          user_id: a.id,
          title: `New request: ${selectedForm.title}`,
          body: `${profile.full_name} submitted a request form.`,
          type: 'request', link_page: 'requests',
        })))
      }
      toast(ar ? 'تم إرسال الطلب' : 'Request submitted!', 'success')
      setAnswers({})
      setView('my-submissions')
      fetchMySubs()
    } catch(e) { toast(e.message, 'error') }
    setSubmitting(false)
  }

  // ── review submission ─────────────────────────────────────────────────────
  async function saveReview() {
    if (!reviewSub) return
    await supabase.from('request_submissions').update({ status: reviewStatus, admin_notes: reviewNote, updated_at: new Date().toISOString() }).eq('id', reviewSub.id)
    // notify submitter
    const meta = STATUS_META[reviewStatus]
    await supabase.from('notifications').insert({
      user_id: reviewSub.submitted_by,
      title: ar ? `تحديث حالة الطلب` : `Request status updated`,
      body: `Your request "${reviewSub.request_forms?.title||''}" is now ${meta.label}.`,
      type: 'request', link_page: 'requests',
    })
    toast(ar ? 'تم التحديث' : 'Updated', 'success')
    setReviewSub(null)
    fetchFormSubs(reviewSub.form_id)
  }

  // ── open form to fill ─────────────────────────────────────────────────────
  function openForm(f) {
    setSelectedForm(f)
    setAnswers({})
    setView('fill-form')
  }

  function openFormDetail(f) {
    setSelectedForm(f)
    fetchFormSubs(f.id)
    setView('form-detail')
  }

  // ── render field input ────────────────────────────────────────────────────
  function renderFieldInput(field) {
    const val = answers[field.id] ?? ''
    const set = v => setAnswers(p => ({...p, [field.id]: v}))
    const lbl = ar ? (field.label_ar || field.label) : field.label
    switch(field.field_type) {
      case 'textarea': return <textarea className="form-input" rows={3} value={val} onChange={e=>set(e.target.value)} placeholder={lbl} style={{ resize:'vertical' }} />
      case 'number':   return <input type="number" className="form-input" value={val} onChange={e=>set(e.target.value)} />
      case 'date':     return <input type="date" className="form-input" value={val} onChange={e=>set(e.target.value)} />
      case 'email':    return <input type="email" className="form-input" value={val} onChange={e=>set(e.target.value)} />
      case 'phone':    return <input type="tel" className="form-input" value={val} onChange={e=>set(e.target.value)} />
      case 'yes_no':   return (
        <div style={{ display:'flex', gap:12 }}>
          {['Yes','No'].map(opt => (
            <label key={opt} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:14 }}>
              <input type="radio" name={field.id} value={opt} checked={val===opt} onChange={()=>set(opt)} />
              {ar ? (opt==='Yes'?'نعم':'لا') : opt}
            </label>
          ))}
        </div>
      )
      case 'dropdown': return (
        <select className="form-input" value={val} onChange={e=>set(e.target.value)}>
          <option value="">{ar?'— اختر —':'— Select —'}</option>
          {(field.options||[]).map((o,i) => <option key={i} value={o.label}>{ar?(o.label_ar||o.label):o.label}</option>)}
        </select>
      )
      case 'radio': return (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {(field.options||[]).map((o,i) => (
            <label key={i} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14 }}>
              <input type="radio" name={field.id} value={o.label} checked={val===o.label} onChange={()=>set(o.label)} />
              {ar?(o.label_ar||o.label):o.label}
            </label>
          ))}
        </div>
      )
      case 'checkbox': {
        const selected = Array.isArray(val) ? val : []
        const toggle = v => set(selected.includes(v) ? selected.filter(x=>x!==v) : [...selected, v])
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(field.options||[]).map((o,i) => (
              <label key={i} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14 }}>
                <input type="checkbox" checked={selected.includes(o.label)} onChange={()=>toggle(o.label)} />
                {ar?(o.label_ar||o.label):o.label}
              </label>
            ))}
          </div>
        )
      }
      case 'file': return <input type="file" className="form-input" onChange={e=>set(e.target.files[0]?.name||'')} />
      default:     return <input type="text" className="form-input" value={val} onChange={e=>set(e.target.value)} />
    }
  }

  // ── renders ────────────────────────────────────────────────────────────────
  const statusBadge = (s) => {
    const m = STATUS_META[s] || STATUS_META.pending
    return <span style={{ fontSize:11, fontWeight:600, color:m.color, background:m.bg, padding:'2px 8px', borderRadius:20 }}>{ar?m.label_ar:m.label}</span>
  }

  // ── VIEWS ──────────────────────────────────────────────────────────────────

  // My Submissions view
  if (view === 'my-submissions') return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn-ghost" onClick={() => setView('list')} style={{ marginBottom:8, fontSize:13 }}>
            <i className="ti ti-arrow-left" /> {ar?'رجوع':'Back'}
          </button>
          <div className="page-title">{ar?'طلباتي':'My Requests'}</div>
        </div>
      </div>
      {submissions.length === 0
        ? <div className="empty">{ar?'لا توجد طلبات بعد':'No requests submitted yet'}</div>
        : <div className="card" style={{ padding:0, overflow:'hidden' }}>
            {submissions.map((s,i) => {
              const m = STATUS_META[s.status] || STATUS_META.pending
              return (
                <div key={s.id} style={{ padding:'14px 20px', borderBottom: i<submissions.length-1 ? '1px solid var(--border)' : 'none', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{ar?(s.request_forms?.title_ar||s.request_forms?.title):s.request_forms?.title}</div>
                    <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{new Date(s.submitted_at).toLocaleDateString()}</div>
                    {s.admin_notes && <div style={{ fontSize:12, color:'var(--text2)', marginTop:4, fontStyle:'italic' }}>"{s.admin_notes}"</div>}
                  </div>
                  {statusBadge(s.status)}
                </div>
              )
            })}
          </div>
      }
    </div>
  )

  // Fill form view
  if (view === 'fill-form' && selectedForm) return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn-ghost" onClick={() => setView('list')} style={{ marginBottom:8, fontSize:13 }}>
            <i className="ti ti-arrow-left" /> {ar?'رجوع':'Back'}
          </button>
          <div className="page-title">{ar?(selectedForm.title_ar||selectedForm.title):selectedForm.title}</div>
          {selectedForm.description && <div className="page-sub">{ar?(selectedForm.description_ar||selectedForm.description):selectedForm.description}</div>}
        </div>
      </div>
      <div className="card" style={{ maxWidth:640 }}>
        {(selectedForm.request_form_fields||[]).map(field => (
          <div key={field.id} className="form-group" style={{ marginBottom:18 }}>
            <label className="form-label">
              {ar?(field.label_ar||field.label):field.label}
              {field.is_required && <span style={{ color:'#EE334E', marginLeft:4 }}>*</span>}
            </label>
            {renderFieldInput(field)}
          </div>
        ))}
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button className="btn-primary" onClick={submitForm} disabled={submitting}>
            {submitting ? (ar?'جارٍ الإرسال…':'Submitting…') : (ar?'إرسال الطلب':'Submit Request')}
          </button>
          <button className="btn-ghost" onClick={() => setView('list')}>{ar?'إلغاء':'Cancel'}</button>
        </div>
      </div>
    </div>
  )

  // Form detail + submissions (admin)
  if (view === 'form-detail' && selectedForm && isAdmin) return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn-ghost" onClick={() => setView('list')} style={{ marginBottom:8, fontSize:13 }}>
            <i className="ti ti-arrow-left" /> {ar?'رجوع':'Back'}
          </button>
          <div className="page-title">{ar?(selectedForm.title_ar||selectedForm.title):selectedForm.title}</div>
          <div className="page-sub">{formSubs.length} {ar?'طلب':'submission(s)'}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="action-btn" onClick={() => openEditForm(selectedForm)}><i className="ti ti-edit" /> {ar?'تعديل':'Edit'}</button>
          <button className="action-btn" style={{ color:'#EE334E', borderColor:'#EE334E' }} onClick={() => setConfirmDel(selectedForm)}><i className="ti ti-trash" /></button>
        </div>
      </div>

      {/* Submissions table */}
      {formSubs.length === 0
        ? <div className="empty">{ar?'لا توجد طلبات بعد':'No submissions yet'}</div>
        : <div className="card" style={{ padding:0, overflow:'hidden' }}>
            {formSubs.map((s,i) => (
              <div key={s.id} style={{ padding:'14px 20px', borderBottom: i<formSubs.length-1 ? '1px solid var(--border)' : 'none', display:'flex', alignItems:'center', gap:14, cursor:'pointer' }}
                onClick={() => { setSelectedSub(s); setView('submission-view') }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{s.profiles?.full_name}</div>
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{new Date(s.submitted_at).toLocaleDateString()} · {s.profiles?.role}</div>
                </div>
                {statusBadge(s.status)}
                <i className="ti ti-chevron-right" style={{ color:'var(--text3)', fontSize:16 }} />
              </div>
            ))}
          </div>
      }

      {confirmDel && <ConfirmModal title={ar?'حذف النموذج':'Delete form'} message={`${ar?'حذف':'Delete'} "${confirmDel.title}"?`} onConfirm={()=>deleteForm(confirmDel)} onCancel={()=>setConfirmDel(null)} />}
    </div>
  )

  // Submission detail view (admin reviews)
  if (view === 'submission-view' && selectedSub && isAdmin) {
    const form = forms.find(f => f.id === selectedSub.form_id)
    return (
      <div>
        <div className="page-header">
          <div>
            <button className="btn-ghost" onClick={() => setView('form-detail')} style={{ marginBottom:8, fontSize:13 }}>
              <i className="ti ti-arrow-left" /> {ar?'رجوع':'Back'}
            </button>
            <div className="page-title">{selectedSub.profiles?.full_name}</div>
            <div className="page-sub">{new Date(selectedSub.submitted_at).toLocaleString()}</div>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {statusBadge(selectedSub.status)}
            <button className="btn-primary" onClick={() => { setReviewSub(selectedSub); setReviewNote(selectedSub.admin_notes||''); setReviewStatus(selectedSub.status==='pending'?'approved':selectedSub.status) }}>
              <i className="ti ti-edit" /> {ar?'مراجعة':'Review'}
            </button>
          </div>
        </div>

        <div className="card" style={{ maxWidth:640 }}>
          {(form?.request_form_fields||[]).map(field => {
            const ans = selectedSub.answers[field.id]
            return (
              <div key={field.id} style={{ marginBottom:16, paddingBottom:16, borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, color:'var(--text3)', fontWeight:600, marginBottom:4 }}>{ar?(field.label_ar||field.label):field.label}</div>
                <div style={{ fontSize:14, color:'var(--text)', fontWeight:500 }}>
                  {Array.isArray(ans) ? ans.join(', ') : (ans || <span style={{ color:'var(--text3)' }}>—</span>)}
                </div>
              </div>
            )
          })}
          {selectedSub.admin_notes && (
            <div style={{ background:'var(--surface2)', borderRadius:8, padding:'10px 14px', marginTop:8 }}>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4, fontWeight:600 }}>{ar?'ملاحظات المسؤول':'Admin Notes'}</div>
              <div style={{ fontSize:13 }}>{selectedSub.admin_notes}</div>
            </div>
          )}
        </div>

        {/* Review modal */}
        {reviewSub && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
            onClick={() => setReviewSub(null)}>
            <div style={{ background:'var(--surface)', borderRadius:16, padding:24, width:420, boxShadow:'0 8px 32px rgba(0,0,0,.2)', border:'1px solid var(--border)' }}
              onClick={e=>e.stopPropagation()}>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>{ar?'مراجعة الطلب':'Review Request'}</div>
              <div className="form-group">
                <label className="form-label">{ar?'الحالة':'Status'}</label>
                <select className="form-input" value={reviewStatus} onChange={e=>setReviewStatus(e.target.value)}>
                  {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{ar?v.label_ar:v.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{ar?'ملاحظة (اختياري)':'Note (optional)'}</label>
                <textarea className="form-input" rows={3} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} style={{ resize:'vertical' }} />
              </div>
              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                <button className="btn-primary" onClick={saveReview}>{ar?'حفظ':'Save'}</button>
                <button className="btn-ghost" onClick={()=>setReviewSub(null)}>{ar?'إلغاء':'Cancel'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── MAIN LIST VIEW ─────────────────────────────────────────────────────────
  const visibleForms = isAdmin
    ? forms
    : forms.filter(f => f.is_active && !f.is_private && f.visible_to?.includes(profile?.role))

  return (
    <div>
      {confirmDel && <ConfirmModal title={ar?'حذف النموذج':'Delete form'} message={`${ar?'حذف':'Delete'} "${confirmDel.title}"?`} onConfirm={()=>deleteForm(confirmDel)} onCancel={()=>setConfirmDel(null)} />}

      <div className="page-header">
        <div>
          <div className="page-title">{ar?'الطلبات':'Requests'}</div>
          <div className="page-sub">{ar?'نماذج الطلبات الرسمية':'Official request forms'}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {!isAdmin && (
            <button className="action-btn" onClick={() => { setView('my-submissions'); fetchMySubs() }}>
              <i className="ti ti-history" /> {ar?'طلباتي':'My Requests'}
            </button>
          )}
          {isAdmin && (
            <button className="btn-primary" onClick={openCreateForm}>
              <i className="ti ti-plus" /> {ar?'نموذج جديد':'New Form'}
            </button>
          )}
        </div>
      </div>

      {loading
        ? <div className="empty"><i className="ti ti-loader ti-spin" /> {ar?'جارٍ التحميل…':'Loading…'}</div>
        : visibleForms.length === 0
          ? <div className="empty">{ar?'لا توجد نماذج متاحة':'No request forms available'}</div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
              {visibleForms.map(f => (
                <div key={f.id} className="card" style={{ cursor:'pointer', transition:'all .15s', padding:20 }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border2)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
                  onClick={() => isAdmin ? openFormDetail(f) : openForm(f)}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <div style={{ width:36, height:36, borderRadius:10, background:'rgba(0,133,199,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <i className="ti ti-clipboard-text" style={{ fontSize:18, color:'#0085C7' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{ar?(f.title_ar||f.title):f.title}</div>
                          {!f.is_active && <span style={{ fontSize:10, color:'#999', background:'#f0f0f0', padding:'1px 7px', borderRadius:10 }}>{ar?'معطّل':'Inactive'}</span>}
                        </div>
                      </div>
                      {(ar?(f.description_ar||f.description):f.description) && (
                        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:10, lineHeight:1.5 }}>
                          {ar?(f.description_ar||f.description):f.description}
                        </div>
                      )}
                      <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:12, color:'var(--text3)' }}>
                        <span><i className="ti ti-forms" style={{ fontSize:13 }} /> {(f.request_form_fields||[]).length} {ar?'حقل':'fields'}</span>
                        {isAdmin && <span><i className="ti ti-users" style={{ fontSize:13 }} /> {(f.visible_to||[]).join(', ')}</span>}
                      </div>
                    </div>
                    {isAdmin && (
                      <div style={{ display:'flex', gap:4, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                        <button className="icon-btn" onClick={()=>openEditForm(f)} title="Edit"><i className="ti ti-edit" /></button>
                        <button className="icon-btn" style={{ color:'#EE334E' }} onClick={()=>setConfirmDel(f)} title="Delete"><i className="ti ti-trash" /></button>
                      </div>
                    )}
                  </div>
                  {!isAdmin && (
                    <button className="btn-primary" style={{ width:'100%', marginTop:14 }} onClick={e=>{e.stopPropagation();openForm(f)}}>
                      <i className="ti ti-send" /> {ar?'تقديم طلب':'Submit Request'}
                    </button>
                  )}
                </div>
              ))}
            </div>
      }

      {/* ── Form Builder Modal ── */}
      {showFormModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:9999, display:'flex', alignItems:'flex-start', justifyContent:'center', overflowY:'auto', padding:'40px 20px' }}
          onClick={() => setShowFormModal(false)}>
          <div style={{ background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:680, boxShadow:'0 16px 48px rgba(0,0,0,.25)', border:'1px solid var(--border)' }}
            onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontWeight:700, fontSize:17 }}>{editingForm ? (ar?'تعديل النموذج':'Edit Form') : (ar?'نموذج جديد':'New Form')}</div>
              <button onClick={()=>setShowFormModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:20 }}><i className="ti ti-x" /></button>
            </div>

            <div style={{ padding:24, display:'flex', flexDirection:'column', gap:16 }}>

              {/* Form meta */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label className="form-label">{ar?'العنوان (EN)':'Title (EN)'} *</label>
                  <input className="form-input" value={formData.title} onChange={e=>setFormData(p=>({...p,title:e.target.value}))} placeholder="e.g. Equipment Request" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar?'العنوان (AR)':'Title (AR)'}</label>
                  <input className="form-input" value={formData.title_ar} onChange={e=>setFormData(p=>({...p,title_ar:e.target.value}))} placeholder="مثال: طلب معدات" dir="rtl" />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label className="form-label">{ar?'الوصف (EN)':'Description (EN)'}</label>
                  <textarea className="form-input" rows={2} value={formData.description} onChange={e=>setFormData(p=>({...p,description:e.target.value}))} style={{ resize:'vertical' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar?'الوصف (AR)':'Description (AR)'}</label>
                  <textarea className="form-input" rows={2} value={formData.description_ar} onChange={e=>setFormData(p=>({...p,description_ar:e.target.value}))} dir="rtl" style={{ resize:'vertical' }} />
                </div>
              </div>

              {/* Visibility */}
              <div className="form-group">
                <label className="form-label">{ar?'يظهر لـ':'Visible to'}</label>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {ROLES.map(r => (
                    <label key={r} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                      <input type="checkbox" checked={formData.visible_to.includes(r)}
                        onChange={e => setFormData(p => ({ ...p, visible_to: e.target.checked ? [...p.visible_to, r] : p.visible_to.filter(x=>x!==r) }))} />
                      {r}
                    </label>
                  ))}
                  <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                    <input type="checkbox" checked={formData.is_active} onChange={e=>setFormData(p=>({...p,is_active:e.target.checked}))} />
                    {ar?'نشط':'Active'}
                  </label>
                </div>
              </div>

              {/* Fields */}
              <div>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:12, color:'var(--text)' }}>{ar?'الحقول':'Form Fields'}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {fields.map((field, idx) => (
                    <div key={field.id} style={{ background:'var(--surface2)', borderRadius:10, padding:14, border:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center' }}>
                        {/* Move up/down */}
                        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                          <button onClick={()=>moveField(field.id,-1)} disabled={idx===0} style={{ background:'none', border:'none', cursor:idx===0?'default':'pointer', color:'var(--text3)', padding:'1px 4px', opacity:idx===0?.3:1 }}><i className="ti ti-chevron-up" style={{ fontSize:12 }} /></button>
                          <button onClick={()=>moveField(field.id,1)} disabled={idx===fields.length-1} style={{ background:'none', border:'none', cursor:idx===fields.length-1?'default':'pointer', color:'var(--text3)', padding:'1px 4px', opacity:idx===fields.length-1?.3:1 }}><i className="ti ti-chevron-down" style={{ fontSize:12 }} /></button>
                        </div>
                        {/* Field type */}
                        <select className="form-input" style={{ width:160, flexShrink:0 }} value={field.field_type} onChange={e=>updateField(field.id,'field_type',e.target.value)}>
                          {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{ar?t.label_ar:t.label}</option>)}
                        </select>
                        <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text2)', marginLeft:'auto', cursor:'pointer' }}>
                          <input type="checkbox" checked={field.is_required} onChange={e=>updateField(field.id,'is_required',e.target.checked)} />
                          {ar?'مطلوب':'Required'}
                        </label>
                        <button onClick={()=>removeField(field.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EE334E', fontSize:16, padding:'2px 4px' }}><i className="ti ti-trash" /></button>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:['dropdown','radio','checkbox'].includes(field.field_type)?10:0 }}>
                        <input className="form-input" placeholder="Label (EN)" value={field.label} onChange={e=>updateField(field.id,'label',e.target.value)} />
                        <input className="form-input" placeholder="التسمية (AR)" value={field.label_ar||''} onChange={e=>updateField(field.id,'label_ar',e.target.value)} dir="rtl" />
                      </div>
                      {/* Options for dropdown/radio/checkbox */}
                      {['dropdown','radio','checkbox'].includes(field.field_type) && (
                        <div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6, fontWeight:600 }}>{ar?'الخيارات':'Options'}</div>
                          {(field.options||[]).map((o,oi) => (
                            <div key={oi} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'center' }}>
                              <input className="form-input" style={{ flex:1 }} placeholder={`Option ${oi+1} (EN)`} value={o.label} onChange={e=>updateOption(field.id,oi,'label',e.target.value)} />
                              <input className="form-input" style={{ flex:1 }} placeholder={`الخيار ${oi+1} (AR)`} value={o.label_ar||''} onChange={e=>updateOption(field.id,oi,'label_ar',e.target.value)} dir="rtl" />
                              <button onClick={()=>removeOption(field.id,oi)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EE334E', padding:'2px 4px' }}><i className="ti ti-x" /></button>
                            </div>
                          ))}
                          <button onClick={()=>addOption(field.id)} className="btn-ghost" style={{ fontSize:12, padding:'4px 10px', marginTop:2 }}>
                            <i className="ti ti-plus" style={{ fontSize:12 }} /> {ar?'إضافة خيار':'Add option'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addField} className="action-btn" style={{ marginTop:12, width:'100%', justifyContent:'center' }}>
                  <i className="ti ti-plus" /> {ar?'إضافة حقل':'Add Field'}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn-ghost" onClick={()=>setShowFormModal(false)}>{ar?'إلغاء':'Cancel'}</button>
              <button className="btn-primary" onClick={saveForm} disabled={saving}>
                {saving ? (ar?'جارٍ الحفظ…':'Saving…') : (ar?'حفظ النموذج':'Save Form')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
