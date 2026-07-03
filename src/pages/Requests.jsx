import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast, ConfirmModal } from '../components/Toast'
import { initials } from '../lib/helpers'

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
]

const STATUS_META = {
  pending:   { color:'#f59e0b', bg:'#fffbeb', label:'Pending',    label_ar:'قيد الانتظار' },
  in_review: { color:'#0085C7', bg:'#e8f4fd', label:'In Review',  label_ar:'قيد المراجعة' },
  approved:  { color:'#009F6B', bg:'#e8f7f2', label:'Approved',   label_ar:'مقبول' },
  rejected:  { color:'#EE334E', bg:'#fef2f4', label:'Rejected',   label_ar:'مرفوض' },
}

const ROLES = ['admin','coach','athlete','employee']

const ROLE_COLORS = { admin:'#EE334E', coach:'#0085C7', athlete:'#009F6B', employee:'#8b5cf6' }

const emptyForm = () => ({
  title:'', title_ar:'', description:'', description_ar:'',
  visible_to: [...ROLES], is_private: false, is_active: true,
  icon: 'ti-clipboard-text', color: '#0085C7',
})

const emptyField = () => ({
  id: crypto.randomUUID(),
  label:'', label_ar:'', field_type:'text', is_required: false,
  options: [], sort_order: 0,
})

export default function Requests({ profile }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'
  const isAdmin = profile?.role === 'admin'

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
  const [saving, setSaving]             = useState(false)
  const [answers, setAnswers]           = useState({})
  const [submitting, setSubmitting]     = useState(false)
  const [confirmDel, setConfirmDel]     = useState(null)
  const [reviewSub, setReviewSub]       = useState(null)
  const [reviewNote, setReviewNote]     = useState('')
  const [reviewStatus, setReviewStatus] = useState('approved')

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchForms = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('request_forms')
      .select('*, request_form_fields(*)')
      .order('created_at', { ascending: false })
    if (data) {
      data.forEach(f => f.request_form_fields?.sort((a,b) => a.sort_order - b.sort_order))
      setForms(data)
      if (isAdmin) {
        const { data: subs } = await supabase.from('request_submissions').select('form_id, status')
        if (subs) {
          const counts = {}
          subs.forEach(s => {
            if (!counts[s.form_id]) counts[s.form_id] = { total:0, pending:0 }
            counts[s.form_id].total++
            if (s.status === 'pending') counts[s.form_id].pending++
          })
          setSubCounts(counts)
        }
      }
    }
    setLoading(false)
  }, [isAdmin])

  const fetchMySubs = useCallback(async () => {
    const { data } = await supabase.from('request_submissions')
      .select('*, request_forms(title, title_ar, icon, color)')
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

  // ── form builder ──────────────────────────────────────────────────────────
  function openCreateForm() {
    setEditingForm(null); setFormData(emptyForm()); setFields([emptyField()]); setShowFormModal(true)
  }
  function openEditForm(f) {
    setEditingForm(f)
    setFormData({ title:f.title, title_ar:f.title_ar||'', description:f.description||'', description_ar:f.description_ar||'', visible_to:f.visible_to||[...ROLES], is_private:f.is_private, is_active:f.is_active, icon:f.icon||'ti-clipboard-text', color:f.color||'#0085C7' })
    setFields((f.request_form_fields||[]).map(ff => ({ ...ff, options:ff.options||[] })))
    setShowFormModal(true)
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
        fields.map((f,i) => ({ form_id:formId, label:f.label, label_ar:f.label_ar||'', field_type:f.field_type, is_required:f.is_required, options:['dropdown','radio','checkbox'].includes(f.field_type)?f.options:null, sort_order:i }))
      )
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
    setSubmitting(true)
    try {
      await supabase.from('request_submissions').insert({ form_id:selectedForm.id, submitted_by:profile.id, answers })
      const { data: admins } = await supabase.from('profiles').select('id').eq('role','admin')
      if (admins?.length) {
        await supabase.from('notifications').insert(admins.map(a => ({
          user_id:a.id,
          title: ar?`طلب جديد: ${selectedForm.title_ar||selectedForm.title}`:`New request: ${selectedForm.title}`,
          body: `${profile.full_name} ${ar?'أرسل طلباً':'submitted a request'}.`,
          type:'request', data:{ form_id:selectedForm.id, page:'requests' },
        })))
      }
      toast(ar?'تم الإرسال!':'Submitted!','success')
      setAnswers({}); setView('my-submissions'); fetchMySubs()
    } catch(e) { toast(e.message,'error') }
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
    })
    toast(ar?'تم التحديث':'Updated','success')
    setReviewSub(null); fetchFormSubs(reviewSub.form_id)
    setFormSubs(p => p.map(s => s.id===reviewSub.id ? {...s, status:reviewStatus, admin_notes:reviewNote} : s))
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  const statusBadge = s => {
    const m = STATUS_META[s]||STATUS_META.pending
    return <span style={{ fontSize:11, fontWeight:600, color:m.color, background:m.bg, padding:'3px 10px', borderRadius:20 }}>{ar?m.label_ar:m.label}</span>
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
      case 'file':     return <input type="file" className="form-input" onChange={e=>set(e.target.files[0]?.name||'')} />
      default:         return <input type="text" className="form-input" value={val} onChange={e=>set(e.target.value)} />
    }
  }

  const visibleForms = isAdmin ? forms : forms.filter(f=>f.is_active && !f.is_private && f.visible_to?.includes(profile?.role))
  const filteredSubs = subFilter==='all' ? formSubs : formSubs.filter(s=>s.status===subFilter)

  // ─────────────────────────────────────────────────────────────────────────
  // MY SUBMISSIONS VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view==='my-submissions') return (
    <div>
      <div className="page-header" style={{marginBottom:20}}>
        <div>
          <button className="action-btn" style={{marginBottom:8,fontSize:12}} onClick={()=>setView('list')}>
            <i className="ti ti-arrow-left"/> {ar?'رجوع':'Back'}
          </button>
          <div className="page-title">{ar?'طلباتي':'My Requests'}</div>
        </div>
      </div>
      {submissions.length===0
        ? <div className="empty">{ar?'لا توجد طلبات بعد':'No requests submitted yet'}</div>
        : <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {submissions.map(s=>{
              const f=s.request_forms, clr=f?.color||'#0085C7'
              return (
                <div key={s.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 18px',display:'flex',alignItems:'center',gap:14,boxShadow:'var(--shadow)'}}>
                  <div style={{width:40,height:40,borderRadius:10,background:clr+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <i className={`ti ${f?.icon||'ti-clipboard-text'}`} style={{fontSize:18,color:clr}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{ar?(f?.title_ar||f?.title):f?.title}</div>
                    <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>{new Date(s.submitted_at).toLocaleDateString()}</div>
                    {s.admin_notes && <div style={{fontSize:12,color:'var(--text2)',marginTop:4,fontStyle:'italic'}}>"{s.admin_notes}"</div>}
                  </div>
                  {statusBadge(s.status)}
                </div>
              )
            })}
          </div>
      }
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // FILL FORM VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view==='fill-form' && selectedForm) {
    const clr = selectedForm.color||'#0085C7'
    return (
      <div>
        <div className="page-header" style={{marginBottom:20}}>
          <div>
            <button className="action-btn" style={{marginBottom:8,fontSize:12}} onClick={()=>setView('list')}>
              <i className="ti ti-arrow-left"/> {ar?'رجوع':'Back'}
            </button>
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
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FORM DETAIL (admin — submissions list)
  // ─────────────────────────────────────────────────────────────────────────
  if (view==='form-detail' && selectedForm && isAdmin) {
    const clr = selectedForm.color||'#0085C7'
    const pendingCount = filteredSubs.filter(s=>s.status==='pending').length
    return (
      <div>
        <div className="page-header" style={{marginBottom:20}}>
          <div>
            <button className="action-btn" style={{marginBottom:8,fontSize:12}} onClick={()=>setView('list')}>
              <i className="ti ti-arrow-left"/> {ar?'رجوع':'Back'}
            </button>
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
          <div style={{display:'flex',gap:8}}>
            <button className="action-btn action-btn-edit" onClick={()=>openEditForm(selectedForm)}><i className="ti ti-edit"/> {ar?'تعديل':'Edit'}</button>
            <button className="action-btn" style={{color:'#EE334E',borderColor:'#EE334E'}} onClick={()=>setConfirmDel(selectedForm)}><i className="ti ti-trash"/></button>
          </div>
        </div>

        {/* Status filter tabs */}
        <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
          {['all','pending','in_review','approved','rejected'].map(s=>{
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
                const initName = s.profiles?.full_name||'?'
                const roleClr = ROLE_COLORS[s.profiles?.role]||'#999'
                return (
                  <div key={s.id}
                    style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 18px',display:'flex',alignItems:'center',gap:14,cursor:'pointer',transition:'all .15s',boxShadow:'var(--shadow)'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border2)'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
                    onClick={()=>{setSelectedSub(s);setView('submission-view')}}>
                    <div style={{width:36,height:36,borderRadius:'50%',background:roleClr,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white',flexShrink:0}}>
                      {initials(initName)}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:14}}>{initName}</div>
                      <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>
                        {new Date(s.submitted_at).toLocaleDateString()} · <span style={{color:roleClr,fontWeight:500}}>{s.profiles?.role}</span>
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
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMISSION DETAIL VIEW (admin reviews)
  // ─────────────────────────────────────────────────────────────────────────
  if (view==='submission-view' && selectedSub && isAdmin) {
    const form = forms.find(f=>f.id===selectedSub.form_id)
    const clr = form?.color||'#0085C7'
    return (
      <div>
        <div className="page-header" style={{marginBottom:20}}>
          <div>
            <button className="action-btn" style={{marginBottom:8,fontSize:12}} onClick={()=>setView('form-detail')}>
              <i className="ti ti-arrow-left"/> {ar?'رجوع':'Back'}
            </button>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:ROLE_COLORS[selectedSub.profiles?.role]||'#999',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'white'}}>
                {initials(selectedSub.profiles?.full_name||'?')}
              </div>
              <div>
                <div className="page-title">{selectedSub.profiles?.full_name}</div>
                <div className="page-sub">{new Date(selectedSub.submitted_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            {statusBadge(selectedSub.status)}
            <button className="btn btn-blue"
              onClick={()=>{setReviewSub(selectedSub);setReviewNote(selectedSub.admin_notes||'');setReviewStatus(selectedSub.status==='pending'?'approved':selectedSub.status)}}>
              <i className="ti ti-edit"/> {ar?'مراجعة':'Review'}
            </button>
          </div>
        </div>

        <div className="card" style={{maxWidth:640}}>
          {(form?.request_form_fields||[]).map(field=>{
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

        {/* Review modal */}
        {reviewSub && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}
            onClick={()=>setReviewSub(null)}>
            <div style={{background:'var(--surface)',borderRadius:16,padding:24,width:420,boxShadow:'0 8px 32px rgba(0,0,0,.2)',border:'1px solid var(--border)'}}
              onClick={e=>e.stopPropagation()}>
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
      </div>
    )
  }

  function openForm(f) { setSelectedForm(f); setAnswers({}); setView('fill-form') }
  function openFormDetail(f) { setSelectedForm(f); fetchFormSubs(f.id); setSubFilter('all'); setView('form-detail') }

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
              <i className="ti ti-history"/> {ar?'طلباتي':'My Requests'}
            </button>
          )}
          {isAdmin && (
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
                          {isAdmin && (
                            <div style={{display:'flex',gap:3}} onClick={e=>e.stopPropagation()}>
                              <button className="icon-btn" onClick={()=>openEditForm(f)} title="Edit"><i className="ti ti-edit"/></button>
                              <button className="icon-btn" style={{color:'#EE334E'}} onClick={()=>setConfirmDel(f)} title="Delete"><i className="ti ti-trash"/></button>
                            </div>
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

      {/* ── Form Builder Modal ── */}
      {showFormModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:9999,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'40px 20px'}}
          onClick={()=>setShowFormModal(false)}>
          <div style={{background:'var(--surface)',borderRadius:16,width:'100%',maxWidth:700,boxShadow:'0 16px 48px rgba(0,0,0,.25)',border:'1px solid var(--border)'}}
            onClick={e=>e.stopPropagation()}>

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
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'10px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)'}}>
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
                  <div style={{display:'flex',flexWrap:'wrap',gap:8,padding:'10px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)'}}>
                    {COLOR_OPTIONS.map(clr=>(
                      <button key={clr} onClick={()=>setFormData(p=>({...p,color:clr}))}
                        style={{width:30,height:30,borderRadius:'50%',background:clr,border:`3px solid ${formData.color===clr?'var(--text)':'transparent'}`,cursor:'pointer',transition:'all .12s',boxShadow:formData.color===clr?`0 0 0 2px ${clr}40`:'none'}}/>
                    ))}
                  </div>
                  {/* Preview */}
                  <div style={{marginTop:10,display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:formData.color+'10',borderRadius:9,border:`1px solid ${formData.color}30`}}>
                    <div style={{width:36,height:36,borderRadius:10,background:formData.color+'18',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <i className={`ti ${formData.icon}`} style={{fontSize:18,color:formData.color}}/>
                    </div>
                    <div>
                      <div style={{fontWeight:600,fontSize:13,color:'var(--text)'}}>{formData.title||'Preview'}</div>
                      <div style={{fontSize:11,color:formData.color,fontWeight:600}}>●&nbsp;{formData.is_active?(ar?'نشط':'Active'):(ar?'معطّل':'Inactive')}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visible to */}
              <div className="form-group">
                <label className="form-label">{ar?'يظهر لـ':'Visible to'}</label>
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  {ROLES.map(r=>(
                    <label key={r} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13,padding:'5px 12px',borderRadius:8,border:`1px solid ${formData.visible_to.includes(r)?ROLE_COLORS[r]:'var(--border)'}`,background:formData.visible_to.includes(r)?ROLE_COLORS[r]+'10':'transparent',transition:'all .12s'}}>
                      <input type="checkbox" style={{display:'none'}} checked={formData.visible_to.includes(r)}
                        onChange={e=>setFormData(p=>({...p,visible_to:e.target.checked?[...p.visible_to,r]:p.visible_to.filter(x=>x!==r)}))}/>
                      <i className="ti ti-check" style={{fontSize:12,color:ROLE_COLORS[r],opacity:formData.visible_to.includes(r)?1:0,transition:'opacity .12s'}}/>
                      <span style={{color:formData.visible_to.includes(r)?ROLE_COLORS[r]:'var(--text2)',fontWeight:formData.visible_to.includes(r)?600:400}}>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <div className="form-group">
                <label className="form-label">{ar?'حالة النموذج':'Form Status'}</label>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',width:'fit-content',padding:'8px 14px',borderRadius:8,border:`1px solid ${formData.is_active?'#009F6B':'var(--border)'}`,background:formData.is_active?'rgba(0,159,107,.08)':'transparent',transition:'all .15s'}}>
                  <input type="checkbox" checked={formData.is_active} onChange={e=>setFormData(p=>({...p,is_active:e.target.checked}))}/>
                  <span style={{fontWeight:600,fontSize:13,color:formData.is_active?'#009F6B':'var(--text3)'}}>
                    {formData.is_active?(ar?'نشط — يظهر للمستخدمين':'Active — visible to users'):(ar?'معطّل — مخفي':'Inactive — hidden')}
                  </span>
                </label>
              </div>

              {/* Fields */}
              <div>
                <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>{ar?'الحقول':'Form Fields'}</div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {fields.map((field,idx)=>(
                    <div key={field.id} style={{background:'var(--surface2)',borderRadius:10,padding:14,border:'1px solid var(--border)'}}>
                      <div style={{display:'flex',gap:8,marginBottom:10,alignItems:'center'}}>
                        <div style={{display:'flex',flexDirection:'column',gap:1}}>
                          <button onClick={()=>moveField(field.id,-1)} disabled={idx===0} style={{background:'none',border:'none',cursor:idx===0?'default':'pointer',color:'var(--text3)',padding:'2px 4px',opacity:idx===0?.3:1}}><i className="ti ti-chevron-up" style={{fontSize:11}}/></button>
                          <button onClick={()=>moveField(field.id,1)} disabled={idx===fields.length-1} style={{background:'none',border:'none',cursor:idx===fields.length-1?'default':'pointer',color:'var(--text3)',padding:'2px 4px',opacity:idx===fields.length-1?.3:1}}><i className="ti ti-chevron-down" style={{fontSize:11}}/></button>
                        </div>
                        <select className="form-input" style={{width:170,flexShrink:0}} value={field.field_type} onChange={e=>updateField(field.id,'field_type',e.target.value)}>
                          {FIELD_TYPES.map(t=><option key={t.value} value={t.value}>{ar?t.label_ar:t.label}</option>)}
                        </select>
                        <label style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--text2)',marginLeft:'auto',cursor:'pointer'}}>
                          <input type="checkbox" checked={field.is_required} onChange={e=>updateField(field.id,'is_required',e.target.checked)}/> {ar?'مطلوب':'Required'}
                        </label>
                        <button onClick={()=>removeField(field.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#EE334E',fontSize:16,padding:'2px 4px'}}><i className="ti ti-trash"/></button>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:['dropdown','radio','checkbox'].includes(field.field_type)?10:0}}>
                        <input className="form-input" placeholder="Label (EN)" value={field.label} onChange={e=>updateField(field.id,'label',e.target.value)}/>
                        <input className="form-input" placeholder="التسمية (AR)" value={field.label_ar||''} onChange={e=>updateField(field.id,'label_ar',e.target.value)} dir="rtl"/>
                      </div>
                      {['dropdown','radio','checkbox'].includes(field.field_type) && (
                        <div>
                          <div style={{fontSize:11,color:'var(--text3)',marginBottom:6,fontWeight:600}}>{ar?'الخيارات':'Options'}</div>
                          {(field.options||[]).map((o,oi)=>(
                            <div key={oi} style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                              <input className="form-input" style={{flex:1}} placeholder={`Option ${oi+1} (EN)`} value={o.label} onChange={e=>updateOption(field.id,oi,'label',e.target.value)}/>
                              <input className="form-input" style={{flex:1}} placeholder={`الخيار ${oi+1} (AR)`} value={o.label_ar||''} onChange={e=>updateOption(field.id,oi,'label_ar',e.target.value)} dir="rtl"/>
                              <button onClick={()=>removeOption(field.id,oi)} style={{background:'none',border:'none',cursor:'pointer',color:'#EE334E',padding:'2px 4px'}}><i className="ti ti-x"/></button>
                            </div>
                          ))}
                          <button onClick={()=>addOption(field.id)} className="action-btn" style={{fontSize:12,padding:'4px 10px',marginTop:2}}>
                            <i className="ti ti-plus" style={{fontSize:12}}/> {ar?'إضافة خيار':'Add option'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addField} className="action-btn" style={{marginTop:12,width:'100%',justifyContent:'center',padding:'9px'}}>
                  <i className="ti ti-plus"/> {ar?'إضافة حقل':'Add Field'}
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
      )}
    </div>
  )

}
