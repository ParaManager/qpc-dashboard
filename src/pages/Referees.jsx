import { useState, useMemo, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { Avatar, avColor, initials } from '../lib/helpers'
import { toast, ConfirmModal } from '../components/Toast'
import { canEdit } from '../lib/useAuth'
import * as XLSX from 'xlsx'

const COUNTRIES_EN = ['Afghanistan','Algeria','Argentina','Armenia','Australia','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Brazil','Cameroon','Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt','Eritrea','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Guinea','Hungary','India','Indonesia','Iran','Iraq','Ireland','Italy','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Lebanon','Libya','Malaysia','Mali','Mauritania','Mexico','Mongolia','Morocco','Myanmar','Nepal','Netherlands','New Zealand','Nigeria','Norway','Oman','Pakistan','Palestine','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Scotland','Senegal','Serbia','Singapore','Slovakia','Somalia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden','Syria','Tajikistan','Tanzania','Thailand','Tunisia','Turkey','Turkmenistan','UAE','Uganda','UK','Ukraine','USA','Uzbekistan','Venezuela','Vietnam','Wales','Yemen','Zambia','Zimbabwe']

const COUNTRY_AR = {'Qatar':'قطر','Egypt':'مصر','Yemen':'اليمن','Algeria':'الجزائر','Morocco':'المغرب','Jordan':'الأردن','Saudi Arabia':'المملكة العربية السعودية','Somalia':'الصومال','Sudan':'السودان','Libya':'ليبيا','Tunisia':'تونس','Syria':'سوريا','Iraq':'العراق','Palestine':'فلسطين','UAE':'الإمارات','Kuwait':'الكويت','Bahrain':'البحرين','Oman':'عُمان','Iran':'إيران','Pakistan':'باكستان','India':'الهند','Turkey':'تركيا','France':'فرنسا','Germany':'ألمانيا','UK':'المملكة المتحدة','USA':'الولايات المتحدة','Tanzania':'تنزانيا','Morocco':'المغرب'}

function exportExcel(list, lang) {
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en
  const rows = list.map(r => ({
    [L('Full Name (English)','الاسم الكامل بالإنجليزي')]: r.name || '',
    [L('Full Name (Arabic)','الاسم الكامل بالعربي')]:     r.name_ar || '',
    [L('Nationality','الجنسية')]:    ar ? (COUNTRY_AR[r.nationality]||r.nationality||'') : (r.nationality||''),
    [L('Gender','الجنس')]:           r.gender ? (ar?(r.gender==='Male'?'ذكر':'أنثى'):r.gender) : '',
    [L('Date of Birth','تاريخ الميلاد')]: r.dob || '',
    [L('ID Number','الرقم الشخصي')]: r.id_number || '',
    [L('Joined QPC','تاريخ الانضمام')]: r.joined_qpc || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{wch:28},{wch:28},{wch:16},{wch:10},{wch:14},{wch:18},{wch:14}]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, ar?'الحكام':'Referees')
  XLSX.writeFile(wb, `QPC_${ar?'الحكام':'Referees'}_${new Date().toISOString().slice(0,10)}.xlsx`)
}

function RefereeDetail({ r, ar, L, tcNat, profile, onBack, onEdit, onDelete, onRefresh }) {
  const photoInput   = useRef(null)
  const docInput     = useRef(null)
  const [uploading, setUploading]     = useState(false)
  const [docUploading, setDocUploading] = useState(false)
  const [docType, setDocType]         = useState('Qatar ID')
  const [docs, setDocs]               = useState([])
  const [docConfirm, setDocConfirm]   = useState(null)

  const DOC_TYPES = ['Photo', 'Qatar ID']
  const DOC_TYPES_AR = { 'Photo':'صورة', 'Qatar ID':'الرقم الشخصي' }
  const DOC_COLORS = { 'Photo':'#0085C7', 'Qatar ID':'#009F6B' }
  const DOC_ICONS  = { 'Photo':'ti-photo', 'Qatar ID':'ti-id-badge' }

  useEffect(() => { loadDocs() }, [r.id])

  async function loadDocs() {
    const { data } = await supabase.from('referee_documents')
      .select('*').eq('referee_id', r.id).order('uploaded_at', { ascending: false })
    setDocs(data || [])
  }

  async function handlePhotoUpload(file) {
    if (!file.type.startsWith('image/')) { toast(L('Please select an image','اختر صورة'), 'error'); return }
    if (file.size > 5*1024*1024) { toast(L('Image must be under 5MB','الصورة يجب أن تكون أقل من 5MB'), 'error'); return }
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `referee_${r.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('athlete-photos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('athlete-photos').getPublicUrl(path)
      const photoUrl = data.publicUrl + '?t=' + Date.now()
      const { error: dbErr } = await supabase.from('referees').update({ photo_url: photoUrl }).eq('id', r.id)
      if (dbErr) throw dbErr
      toast(L('Photo updated!','تم تحديث الصورة!')); onRefresh()
    } catch(err) { toast(err.message, 'error') }
    finally { setUploading(false) }
  }

  async function handlePhotoRemove() {
    await supabase.from('referees').update({ photo_url: null }).eq('id', r.id)
    toast(L('Photo removed','تم حذف الصورة')); onRefresh()
  }

  async function handleDocUpload(file) {
    if (file.size > 20*1024*1024) { toast(L('File must be under 20MB','الملف يجب أن يكون أقل من 20MB'), 'error'); return }
    setDocUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `referee_${r.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('athlete-documents').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('athlete-documents').getPublicUrl(path)
      await supabase.from('referee_documents').insert({
        referee_id: r.id, name: file.name, type: docType,
        file_url: data.publicUrl, file_path: path, file_size: file.size,
      })
      toast(L(`${docType} uploaded!`,`تم رفع ${DOC_TYPES_AR[docType]}!`)); loadDocs()
    } catch(err) { toast(err.message, 'error') }
    finally { setDocUploading(false); if (docInput.current) docInput.current.value = '' }
  }

  async function handleDocDelete(doc) {
    await supabase.storage.from('athlete-documents').remove([doc.file_path])
    await supabase.from('referee_documents').delete().eq('id', doc.id)
    toast(L('Document deleted','تم حذف الوثيقة')); setDocConfirm(null); loadDocs()
  }

  function formatSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`
    return `${(bytes/(1024*1024)).toFixed(1)} MB`
  }

  return (
    <div>
      {docConfirm && <ConfirmModal title={L('Delete document','حذف وثيقة')} message={`${L('Delete','حذف')} "${docConfirm.name}"?`} onConfirm={() => handleDocDelete(docConfirm)} onCancel={() => setDocConfirm(null)} />}
      <button className="back-btn" onClick={onBack}>
        <i className="ti ti-arrow-left" /> {L('Back to referees','رجوع إلى الحكام')}
      </button>
      {canEdit(profile) && (
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <button className="action-btn action-btn-edit" onClick={onEdit}><i className="ti ti-pencil" /> {L('Edit','تعديل')}</button>
          <button className="action-btn action-btn-delete" onClick={onDelete}><i className="ti ti-trash" /> {L('Delete','حذف')}</button>
        </div>
      )}
      <div className="detail-grid">
        <div>
          <div className="detail-profile">
            {/* Photo */}
            <div style={{ position:'relative', width:90, height:90, margin:'0 auto 14px' }}>
              {r.photo_url
                ? <img src={r.photo_url} alt={r.name} style={{ width:90, height:90, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--border)' }} />
                : <div style={{ width:90, height:90, borderRadius:'50%', background:avColor(r.id), display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:600, color:'#fff' }}>{initials(r.name||r.name_ar||'?')}</div>
              }
              {canEdit(profile) && (
                <div style={{ position:'absolute', bottom:0, right:0, display:'flex', gap:3 }}>
                  <button onClick={() => photoInput.current.click()} disabled={uploading} title={L('Upload photo','رفع صورة')}
                    style={{ width:26, height:26, borderRadius:'50%', background:'#0085C7', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                    {uploading ? <div style={{ width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> : <i className="ti ti-camera" style={{ fontSize:12 }} />}
                  </button>
                  {r.photo_url && (
                    <button onClick={handlePhotoRemove} title={L('Remove photo','حذف الصورة')}
                      style={{ width:26, height:26, borderRadius:'50%', background:'#dc2626', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                      <i className="ti ti-x" style={{ fontSize:12 }} />
                    </button>
                  )}
                </div>
              )}
              <input ref={photoInput} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { if(e.target.files[0]) handlePhotoUpload(e.target.files[0]) }} />
            </div>

            <div className="detail-name">{ar && r.name_ar ? r.name_ar : (r.name || '—')}</div>
            {r.name_ar && r.name && <div className="detail-sub">{ar ? r.name : r.name_ar}</div>}
            <div className="detail-sub">{tcNat(r.nationality)}</div>

            <div className="detail-fields" style={{ marginTop:16 }}>
              {[
                [L('Full Name (English)','الاسم الكامل بالإنجليزي'), r.name],
                [L('Full Name (Arabic)','الاسم الكامل بالعربي'),    r.name_ar],
                [L('Gender','الجنس'),        r.gender?(ar?(r.gender==='Male'?'ذكر':'أنثى'):r.gender):null],
                [L('Nationality','الجنسية'),  tcNat(r.nationality)],
                [L('Date of Birth','تاريخ الميلاد'), r.dob],
                [L('ID Number','الرقم الشخصي'), r.id_number],
                [L('Joined QPC','تاريخ الانضمام'), r.joined_qpc],
              ].map(([k,v]) => v ? (
                <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
              ) : null)}
            </div>
          </div>
        </div>

        <div>
          {/* Documents */}
          <div className="info-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div className="info-title" style={{ margin:0 }}>
                {L('Documents','الوثائق')}
                <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>{docs.length} {L('file','ملف')}{docs.length !== 1 ? (ar?'':' files') : ''}</span>
              </div>
            </div>

            {canEdit(profile) && (
              <div style={{ display:'flex', gap:8, marginBottom:16, padding:'10px 12px', background:'var(--surface2)', borderRadius:10, alignItems:'center' }}>
                <div style={{ display:'flex', gap:6 }}>
                  {DOC_TYPES.map(t => (
                    <button key={t} onClick={() => setDocType(t)}
                      style={{ padding:'5px 12px', borderRadius:7, border:'1px solid var(--border)', fontSize:12, cursor:'pointer', fontFamily:'DM Sans, sans-serif',
                        background: t===docType ? '#0085C7' : 'var(--surface)',
                        color: t===docType ? '#fff' : 'var(--text2)', fontWeight: t===docType ? 600 : 400 }}>
                      {ar ? (DOC_TYPES_AR[t]||t) : t}
                    </button>
                  ))}
                </div>
                <button onClick={() => docInput.current.click()} disabled={docUploading}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'#0085C7', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', marginLeft:'auto', fontFamily:'DM Sans, sans-serif' }}>
                  {docUploading ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />{L('Uploading…','جارٍ الرفع…')}</> : <><i className="ti ti-upload" style={{ fontSize:14 }} />{L('Upload','رفع')}</>}
                </button>
                <input ref={docInput} type="file" style={{ display:'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => { if(e.target.files[0]) handleDocUpload(e.target.files[0]) }} />
              </div>
            )}

            {docs.length === 0
              ? <div className="empty" style={{ padding:'20px 0' }}>{L('No documents uploaded yet.','لم يتم رفع وثائق بعد.')}</div>
              : DOC_TYPES.map(type => {
                  const typeDocs = docs.filter(d => d.type === type)
                  if (typeDocs.length === 0) return null
                  const color = DOC_COLORS[type]
                  const icon  = DOC_ICONS[type]
                  return (
                    <div key={type} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <i className={`ti ${icon}`} style={{ fontSize:13, color }} />
                        <span style={{ fontSize:11, fontWeight:600, color }}>{ar?(DOC_TYPES_AR[type]||type):type}</span>
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
                            <a href={doc.file_url} target="_blank" rel="noreferrer"
                              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text2)', fontSize:14, textDecoration:'none' }}>
                              <i className="ti ti-download" />
                            </a>
                            {canEdit(profile) && (
                              <button onClick={() => setDocConfirm(doc)}
                                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626', cursor:'pointer' }}>
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

export default function Referees({ referees, onRefresh, profile }) {
  const { lang, tc } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [search, setSearch]     = useState('')
  const [natF, setNatF]         = useState('All')
  const [genderF, setGenderF]   = useState('All')
  const [sort, setSort]         = useState('name-asc')
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editData, setEditData] = useState(null)
  const [saving, setSaving]     = useState(false)

  const list = useMemo(() => {
    let d = [...(referees||[])]
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r =>
        (r.name||'').toLowerCase().includes(q) ||
        (r.name_ar||'').toLowerCase().includes(q) ||
        (r.id_number||'').includes(q) ||
        (r.nationality||'').toLowerCase().includes(q)
      )
    }
    if (natF !== 'All')    d = d.filter(r => r.nationality?.toLowerCase() === natF.toLowerCase())
    if (genderF !== 'All') d = d.filter(r => r.gender === genderF)
    d.sort((a,b) => {
      if (sort==='name-asc')  return (a.name||'').localeCompare(b.name||'')
      if (sort==='name-desc') return (b.name||'').localeCompare(a.name||'')
      if (sort==='name_ar-asc')  return (a.name_ar||'').localeCompare(b.name_ar||'')
      if (sort==='name_ar-desc') return (b.name_ar||'').localeCompare(a.name_ar||'')
      if (sort==='nationality-asc')  return (a.nationality||'').localeCompare(b.nationality||'')
      if (sort==='nationality-desc') return (b.nationality||'').localeCompare(a.nationality||'')
      if (sort==='dob-asc')  return new Date(a.dob||0) - new Date(b.dob||0)
      if (sort==='dob-desc') return new Date(b.dob||0) - new Date(a.dob||0)
      if (sort==='joined_qpc-asc')  return new Date(a.joined_qpc||0) - new Date(b.joined_qpc||0)
      if (sort==='joined_qpc-desc') return new Date(b.joined_qpc||0) - new Date(a.joined_qpc||0)
      return 0
    })
    return d
  }, [referees, search, natF, genderF, sort])

  async function handleSave(form) {
    setSaving(true)
    const payload = {
      name:        form.name || null,
      name_ar:     form.name_ar || null,
      nationality: form.nationality || null,
      gender:      form.gender || null,
      dob:         form.dob || null,
      id_number:   form.id_number || null,
      joined_qpc:  form.joined_qpc || null,
    }
    if (form.id) {
      const { error } = await supabase.from('referees').update(payload).eq('id', form.id)
      if (error) { toast(error.message,'error'); setSaving(false); return }
      toast(L('Updated','تم التحديث'))
    } else {
      const { error } = await supabase.from('referees').insert(payload)
      if (error) { toast(error.message,'error'); setSaving(false); return }
      toast(L('Referee added','تم إضافة الحكم'))
    }
    setSaving(false)
    setShowForm(false); setEditData(null)
    onRefresh()
  }

  async function handleDelete(id) {
    await supabase.from('referees').delete().eq('id', id)
    toast(L('Deleted','تم الحذف'))
    setSelected(null)
    onRefresh()
  }

  const sortBtn = (key, label) => (
    <span onClick={() => setSort(sort===`${key}-asc`?`${key}-desc`:`${key}-asc`)} style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>
      {label} <span style={{ fontSize:9, color: sort.startsWith(key)?'#0085C7':'#ccc' }}>{sort===`${key}-asc`?'▲':sort===`${key}-desc`?'▼':'▲▼'}</span>
    </span>
  )

  const tcNat = n => n ? (ar ? (COUNTRY_AR[n] || COUNTRY_AR[n?.toLowerCase()] || n) : n) : '—'

  // ── DETAIL VIEW ──
  if (selected) {
    const r = (referees||[]).find(x => x.id === selected)
    if (!r) { setSelected(null); return null }
    return <RefereeDetail
      r={r} ar={ar} L={L} tcNat={tcNat} profile={profile}
      onBack={() => setSelected(null)}
      onEdit={() => { setEditData(r); setShowForm(true); setSelected(null) }}
      onDelete={() => handleDelete(r.id)}
      onRefresh={onRefresh}
    />
  }

  // ── FORM MODAL ──
  const RefForm = () => {
    const [form, setForm] = useState(editData || {})
    const set = (k,v) => setForm(f=>({...f,[k]:v}))
    const genderOpts = [{value:'',label:''},{value:'Male',label:ar?'ذكر':'Male'},{value:'Female',label:ar?'أنثى':'Female'}]
    const natOpts = [{value:'',label:''},...COUNTRIES_EN.map(c=>({value:c,label:ar?(COUNTRY_AR[c]||c):c}))]
    const F = ({label,name,type='text',placeholder,options}) => (
      <div className="form-group">
        <label className="form-label">{label}</label>
        {options
          ? <select className="form-input" value={form[name]||''} onChange={e=>set(name,e.target.value)}>{options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}</select>
          : <input className="form-input" type={type} placeholder={placeholder} value={form[name]||''} onChange={e=>set(name,e.target.value)} />}
      </div>
    )
    return (
      <div className="modal-overlay" onClick={() => { setShowForm(false); setEditData(null) }}>
        <div className="modal-box" onClick={e=>e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{editData ? L('Edit Referee','تعديل حكم') : L('Add Referee','إضافة حكم')}</div>
            <button className="modal-close" onClick={() => { setShowForm(false); setEditData(null) }}><i className="ti ti-x"/></button>
          </div>
          <div className="modal-body">
            <div className="form-section">{L('Personal Information','المعلومات الشخصية')}</div>
            <F label={L('Full Name (English)','الاسم الكامل بالإنجليزي')} name="name" placeholder="e.g. Ahmed Mohammed" />
            <F label={L('Full Name (Arabic)','الاسم الكامل بالعربي')} name="name_ar" placeholder="مثال: أحمد محمد" />
            <div className="form-row">
              <F label={L('Gender','الجنس')} name="gender" options={genderOpts} />
              <F label={L('Nationality','الجنسية')} name="nationality" options={natOpts} />
            </div>
            <div className="form-row">
              <F label={L('Date of Birth','تاريخ الميلاد')} name="dob" type="date" />
              <F label={L('ID Number','الرقم الشخصي')} name="id_number" placeholder="e.g. 28688600328" />
            </div>
            <F label={L('Joined QPC','تاريخ الانضمام')} name="joined_qpc" type="date" />
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={() => { setShowForm(false); setEditData(null) }}>{L('Cancel','إلغاء')}</button>
            <button className="btn" style={{background:'#EE334E'}} onClick={() => handleSave(form)} disabled={saving}>
              {saving ? L('Saving…','جارٍ الحفظ…') : editData ? L('Save changes','حفظ التغييرات') : L('Add referee','إضافة حكم')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{L('Referees','الحكام')}</div>
          <div className="page-sub">{list.length} {L('of','من')} {(referees||[]).length} {L('referees','حكم')}</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn" style={{ background:'#009F6B' }} onClick={() => exportExcel(list, lang)}>
            <i className="ti ti-table-export" /> {L('Export Excel','تصدير Excel')}
          </button>
          <button className="btn" style={{ background:'#EE334E' }} onClick={() => { setEditData(null); setShowForm(true) }}>
            <i className="ti ti-plus" /> {L('Add referee','إضافة حكم')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters" style={{ marginBottom:16 }}>
        <div className="search-wrap">
          <i className="ti ti-search" />
          <input placeholder={L('Search by name, ID…','بحث بالاسم أو الهوية…')} value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <select className="filter" value={natF} onChange={e=>setNatF(e.target.value)}>
          <option value="All">{L('All nationalities','جميع الجنسيات')}</option>
          {COUNTRIES_EN.map(c=><option key={c} value={c}>{ar?(COUNTRY_AR[c]||c):c}</option>)}
        </select>
        <select className="filter" value={genderF} onChange={e=>setGenderF(e.target.value)}>
          <option value="All">{L('All genders','جميع')}</option>
          <option value="Male">{L('Male','ذكر')}</option>
          <option value="Female">{L('Female','أنثى')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{sortBtn('name', L('Full Name (English)','الاسم بالإنجليزي'))}</th>
              <th>{sortBtn('name_ar', L('Full Name (Arabic)','الاسم بالعربي'))}</th>
              <th>{sortBtn('nationality', L('Nationality','الجنسية'))}</th>
              <th>{L('Gender','الجنس')}</th>
              <th>{sortBtn('dob', L('Date of Birth','تاريخ الميلاد'))}</th>
              <th>{L('ID Number','الرقم الشخصي')}</th>
              <th>{sortBtn('joined_qpc', L('Joined QPC','تاريخ الانضمام'))}</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'var(--text3)' }}>{L('No referees found','لا يوجد حكام')}</td></tr>
            ) : list.map(r => (
              <tr key={r.id} onClick={() => setSelected(r.id)} style={{ cursor:'pointer' }}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <Avatar name={r.name||r.name_ar||'?'} id={r.id} size={32} fs={11} />
                    <span style={{ fontWeight:500, fontSize:13 }}>{r.name || '—'}</span>
                  </div>
                </td>
                <td style={{ fontSize:13 }}>{r.name_ar || '—'}</td>
                <td>{tcNat(r.nationality)}</td>
                <td>{r.gender ? (ar?(r.gender==='Male'?'ذكر':'أنثى'):r.gender) : '—'}</td>
                <td style={{ fontSize:12, color:'var(--text2)' }}>{r.dob || '—'}</td>
                <td style={{ fontSize:12, fontFamily:'monospace' }}>{r.id_number || '—'}</td>
                <td style={{ fontSize:12, color:'var(--text2)' }}>{r.joined_qpc || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <RefForm />}
    </div>
  )
}
