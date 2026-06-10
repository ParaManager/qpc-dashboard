import { useState, useEffect, useRef } from 'react'
import { initials } from '../lib/helpers'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'
import { useLang } from '../lib/LangContext.jsx'
import PersonDocuments from '../components/PersonDocuments'
import * as XLSX from 'xlsx'

const DESIGNATIONS = [
  'All designations',
  'Coach', 'Assistant Coach', 'Technical Expert',
  'Physiotherapist', 'Doctor',
  'Secretary General', 'Executive Manager', 'Administration Secretary', 'Secretary Assistant',
  'Administrative National Team', 'Administrative Youth Team', 'Administrative Center & Development',
  'Accountant', 'Public Relation Officer', 'Receptionist',
  'Board Member', 'Official', 'Delegate',
  'Employee', 'Store Keeper', 'Waiter', 'Worker', 'Driver',
]

const COUNTRIES_EN = [
  'Afghanistan','Algeria','Argentina','Armenia','Australia','Azerbaijan',
  'Bahrain','Bangladesh','Belarus','Belgium','Brazil','Cameroon','Canada',
  'Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt',
  'Eritrea','Ethiopia','Finland','France','Georgia','Germany','Ghana',
  'Greece','Guinea','Hungary','India','Indonesia','Iran','Iraq','Ireland',
  'Italy','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan',
  'Lebanon','Libya','Malaysia','Mali','Mauritania','Mexico','Mongolia',
  'Morocco','Myanmar','Nepal','Netherlands','New Zealand','Nigeria',
  'Norway','Oman','Pakistan','Palestine','Peru','Philippines','Poland',
  'Portugal','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Scotland',
  'Senegal','Serbia','Singapore','Slovakia','Somalia','South Africa',
  'South Korea','Spain','Sri Lanka','Sudan','Sweden','Syria','Tajikistan',
  'Tanzania','Thailand','Tunisia','Turkey','Turkmenistan','UAE','Uganda',
  'UK','Ukraine','USA','Uzbekistan','Venezuela','Vietnam','Wales',
  'Yemen','Zambia','Zimbabwe',
]
const COUNTRIES_AR_MAP = {
  'Qatar':'قطر','Egypt':'مصر','Algeria':'الجزائر','Morocco':'المغرب',
  'Tunisia':'تونس','Jordan':'الأردن','Saudi Arabia':'المملكة العربية السعودية',
  'UAE':'الإمارات','Kuwait':'الكويت','Bahrain':'البحرين','Oman':'عُمان',
  'Iraq':'العراق','Syria':'سوريا','Lebanon':'لبنان','Palestine':'فلسطين',
  'Yemen':'اليمن','Somalia':'الصومال','Sudan':'السودان','Libya':'ليبيا',
  'Pakistan':'باكستان','India':'الهند','Bangladesh':'بنغلاديش',
  'Iran':'إيران','Turkey':'تركيا','Afghanistan':'أفغانستان',
  'Nigeria':'نيجيريا','Ghana':'غانا','Kenya':'كينيا','Ethiopia':'إثيوبيا',
  'Cameroon':'الكاميرون','Senegal':'السنغال','Tanzania':'تنزانيا',
  'France':'فرنسا','Spain':'إسبانيا','Germany':'ألمانيا','Italy':'إيطاليا',
  'UK':'المملكة المتحدة','USA':'الولايات المتحدة','Canada':'كندا',
  'Australia':'أستراليا','Brazil':'البرازيل','Russia':'روسيا',
  'China':'الصين','Japan':'اليابان','South Korea':'كوريا الجنوبية',
  'Azerbaijan':'أذربيجان','Kazakhstan':'كازاخستان','Ireland':'أيرلندا',
  'Netherlands':'هولندا','Belgium':'بلجيكا','Sweden':'السويد',
  'Norway':'النرويج','Denmark':'الدنمارك','Poland':'بولندا',
  'Portugal':'البرتغال','Greece':'اليونان','Ukraine':'أوكرانيا',
  'Indonesia':'إندونيسيا','Malaysia':'ماليزيا','Philippines':'الفلبين',
  'Thailand':'تايلاند','Vietnam':'فيتنام','Sri Lanka':'سريلانكا',
  'Nepal':'نيبال','Mongolia':'منغوليا','South Africa':'جنوب أفريقيا',
}

const DESIG_AR = {
  'Coach':'مدرب', 'Assistant Coach':'مدرب مساعد', 'Technical Expert':'خبير تقني',
  'Physiotherapist':'معالج فيزيائي', 'Doctor':'طبيب',
  'Secretary General':'الأمين العام', 'Executive Manager':'مدير تنفيذي',
  'Administration Secretary':'سكرتير إداري', 'Secretary Assistant':'مساعد سكرتير',
  'Administrative National Team':'إداري الفريق الوطني',
  'Administrative Youth Team':'إداري فريق الشباب',
  'Administrative Center & Development':'إداري المركز والتطوير',
  'Accountant':'محاسب', 'Public Relation Officer':'مسؤول علاقات عامة',
  'Receptionist':'موظف استقبال', 'Board Member':'عضو مجلس إدارة',
  'Official':'مسؤول', 'Delegate':'مندوب', 'Employee':'موظف',
  'Store Keeper':'أمين مخزن', 'Waiter':'نادل', 'Worker':'عامل', 'Driver':'سائق',
}

const DESIG_COLORS = {
  'Coach': '#009F6B', 'Assistant Coach': '#009F6B', 'Technical Expert': '#009F6B',
  'Physiotherapist': '#EE334E', 'Doctor': '#EE334E',
  'Secretary General': '#0085C7', 'Executive Manager': '#0085C7',
  'Board Member': '#8b5cf6', 'Official': '#8b5cf6', 'Delegate': '#8b5cf6',
  'Administration Secretary': '#e67e22', 'Secretary Assistant': '#e67e22',
  'Administrative National Team': '#e67e22', 'Administrative Youth Team': '#e67e22',
  'Administrative Center & Development': '#e67e22',
  'Accountant': '#16a085', 'Public Relation Officer': '#16a085',
  'Receptionist': '#9aa3b2', 'Employee': '#9aa3b2',
  'Store Keeper': '#9aa3b2', 'Waiter': '#9aa3b2', 'Worker': '#9aa3b2', 'Driver': '#9aa3b2',
}

function DesigBadge({ label, displayLabel }) {
  const color = DESIG_COLORS[label] || '#9aa3b2'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', fontSize:11, padding:'3px 9px', borderRadius:20, fontWeight:500, background:color+'18', color }}>
      {displayLabel || label}
    </span>
  )
}

function exportEmployeesPDF(emp, lang) {
  const isAr = lang === 'ar'
  const dir = isAr ? 'rtl' : 'ltr'
  const L = (en, ar) => isAr ? ar : en
  const field = (k, v) => v ? `<div class="field"><span class="k">${k}</span><span class="v">${v}</span></div>` : ''
  const color = DESIG_COLORS[emp.designation] || '#9aa3b2'
  const DESIG_AR_MAP = {'Coach':'مدرب','Assistant Coach':'مدرب مساعد','Technical Expert':'خبير تقني','Physiotherapist':'معالج فيزيائي','Doctor':'طبيب','Secretary General':'الأمين العام','Executive Manager':'مدير تنفيذي','Administration Secretary':'سكرتير إداري','Secretary Assistant':'مساعد سكرتير','Administrative National Team':'إداري الفريق الوطني','Administrative Youth Team':'إداري فريق الشباب','Administrative Center & Development':'إداري المركز والتطوير','Accountant':'محاسب','Public Relation Officer':'مسؤول علاقات عامة','Receptionist':'موظف استقبال','Board Member':'عضو مجلس إدارة','Official':'مسؤول','Delegate':'مندوب','Employee':'موظف','Store Keeper':'أمين مخزن','Waiter':'نادل','Worker':'عامل','Driver':'سائق'}
  const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة'}
  const COUNTRY_AR = {'Qatar':'قطر','Egypt':'مصر','Algeria':'الجزائر','Jordan':'الأردن','Tunisia':'تونس','Morocco':'المغرب','Saudi Arabia':'المملكة العربية السعودية','Somalia':'الصومال','Ireland':'أيرلندا','Spain':'إسبانيا','France':'فرنسا','UK':'المملكة المتحدة','USA':'الولايات المتحدة','Sudan':'السودان','Libya':'ليبيا','Pakistan':'باكستان','India':'الهند'}

  const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr?'ar':'en'}"><head><meta charset="UTF-8"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; color:#1a1d23; padding:32px; font-size:13px; direction:${dir}; }
  .header { display:flex; align-items:center; gap:20px; margin-bottom:24px; padding-bottom:20px; border-bottom:3px solid #0085C7; }
  .dots { display:flex; gap:5px; }
  .dot { width:14px; height:14px; border-radius:50%; }
  h1 { font-size:20px; font-weight:700; color:#0a1628; }
  .sub { font-size:12px; color:#9aa3b2; margin-top:2px; }
  .profile { display:flex; gap:20px; margin-bottom:24px; }
  .photo { width:80px; height:80px; border-radius:50%; background:${color}; display:flex; align-items:center; justify-content:center; color:#fff; font-size:28px; font-weight:700; flex-shrink:0; overflow:hidden; }
  .photo img { width:100%; height:100%; object-fit:cover; }
  .section-title { font-size:11px; font-weight:700; color:#9aa3b2; text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid #e2e5ea; margin-top:20px; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; }
  .field { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f1f3; font-size:12px; }
  .field .k { color:#5a6272; }
  .field .v { font-weight:600; text-align:${isAr?'left':'right'}; }
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #e2e5ea; font-size:10px; color:#9aa3b2; text-align:center; }
</style></head><body>

<div class="header">
  <div class="dots">
    <div class="dot" style="background:#EE334E"></div>
    <div class="dot" style="background:#0085C7"></div>
    <div class="dot" style="background:#009F6B"></div>
  </div>
  <div>
    <h1>${isAr?'الاتحاد القطري لذوي الاحتياجات الخاصة':'Qatar Paralympic Committee'}</h1>
    <p class="sub">${isAr?`ملف الموظف الرسمي · تم الإنشاء ${new Date().toLocaleDateString('ar-QA')}`:`Employee Profile · Generated ${new Date().toLocaleDateString()}`}</p>
  </div>
</div>

<div class="profile">
  <div class="photo">${emp.photo_url?`<img src="${emp.photo_url}"/>`:initials(emp.name)}</div>
  <div>
    <div style="font-size:22px;font-weight:700">${isAr && emp.name_ar ? emp.name_ar : emp.name}</div>
    <div style="font-size:14px;color:#5a6272;margin-top:3px">${isAr && emp.name_ar ? emp.name : (emp.name_ar||'')}</div>
    <div style="margin-top:8px;font-size:13px;font-weight:600;color:${color}">
      ${isAr ? (DESIG_AR_MAP[emp.designation]||emp.designation||'') : (emp.designation||'')}
    </div>
    ${emp.designation_ar ? `<div style="font-size:12px;color:#5a6272;margin-top:2px">${emp.designation_ar}</div>` : ''}
  </div>
</div>

<div class="section-title">${L('Employee Information','معلومات الموظف')}</div>
<div class="grid-2">
  ${field(L('Employee #','رقم الموظف'), emp.employee_number)}
  ${field(L('QSS #','رقم QSS'), emp.qss_number)}
  ${field(L('Gender','الجنس'), emp.gender ? (isAr?(emp.gender==='Male'?'ذكر':'أنثى'):emp.gender) : null)}
  ${field(L('Nationality','الجنسية'), isAr?(COUNTRY_AR[emp.nationality]||emp.nationality):emp.nationality)}
  ${field(L('Status','الحالة'), isAr?(STATUS_AR[emp.status]||emp.status):emp.status)}
  ${field(L('Phone','الهاتف'), emp.phone)}
  ${field(L('Email','البريد الإلكتروني'), emp.email)}
</div>

${emp.notes ? `<div class="section-title">${L('Notes','ملاحظات')}</div><p style="font-size:12px;color:#5a6272;line-height:1.6;margin-top:8px">${emp.notes}</p>` : ''}

<div class="footer">${isAr?'الاتحاد القطري لذوي الاحتياجات الخاصة · سري · ':'Qatar Paralympic Committee · Confidential · '}${new Date().getFullYear()}</div>
</body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 500)
}

function exportEmployeesExcel(list) {
  const rows = list.map(e => ({
    'Name':           e.name,
    'Arabic Name':    e.name_ar || '',
    'Designation':    e.designation || '',
    'Designation AR': e.designation_ar || '',
    'Gender':         e.gender || '',
    'Nationality':    e.nationality || '',
    'Employee #':     e.employee_number || '',
    'QSS #':          e.qss_number || '',
    'Phone':          e.phone || '',
    'Email':          e.email || '',
    'Status':         e.status || '',
    'Notes':          e.notes || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{wch:24},{wch:24},{wch:28},{wch:24},{wch:8},{wch:14},{wch:12},{wch:10},{wch:16},{wch:26},{wch:10},{wch:30}]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employees')
  XLSX.writeFile(wb, `QPC_Employees_${new Date().toISOString().slice(0,10)}.xlsx`)
}

export default function Employees({ employees, personDocs, onRefresh, onNav, navState, profile }) {
  const { tx, tc, lang } = useLang()
  const [search, setSearch]         = useState('')
  const [sort, setSort]             = useState('name-asc')
  const [colFilters, setColFilters] = useState({})
  const [selected, setSelected]     = useState(null)
  const [confirm, setConfirm]       = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [editForm, setEditForm]     = useState(null)
  const [addModal, setAddModal]     = useState(false)
  const photoInput = useRef(null)

  useEffect(() => {
    if (navState?.reset) {
      setSelected(null); setSearch(''); setSort('name-asc'); setColFilters({})
    }
  }, [navState])

  const hasFilters = search || Object.values(colFilters).some(v => v && v !== 'All')
  const DESIG_LABELS = {
    'All designations':tx('filters.allDesignations','جميع المسميات'),
    'All':tx('filters.all','الكل'),
    'Coach':tx('nav.coaches','مدرب'), 'Assistant Coach':tx('employees.assistantCoach','مدرب مساعد'),
    'Technical Expert':tx('employees.technicalExpert','Technical Expert'),
    'Physiotherapist':tx('employees.physiotherapist','Physiotherapist'), 'Doctor':tx('employees.doctor','Doctor'),
    'Secretary General':tx('employees.secretaryGeneral','Secretary General'),
    'Executive Manager':tx('employees.executiveManager','Executive Manager'),
    'Administration Secretary':tx('employees.adminSecretary','Administration Secretary'),
    'Secretary Assistant':tx('employees.secretaryAssistant','Secretary Assistant'),
    'Administrative National Team':tx('employees.adminNational','Administrative National Team'),
    'Administrative Youth Team':tx('employees.adminYouth','Administrative Youth Team'),
    'Administrative Center & Development':tx('employees.adminCenter','Administrative Center & Development'),
    'Accountant':tx('employees.accountant','Accountant'),
    'Public Relation Officer':tx('employees.pr','Public Relation Officer'),
    'Receptionist':tx('employees.receptionist','Receptionist'),
    'Board Member':tx('employees.boardMember','Board Member'),
    'Official':tx('employees.official','Official'), 'Delegate':tx('employees.delegate','Delegate'),
    'Employee':tx('employees.employeeRole','Employee'), 'Store Keeper':tx('employees.storeKeeper','Store Keeper'),
    'Waiter':tx('employees.waiter','Waiter'), 'Worker':tx('employees.worker','Worker'),
    'Driver':tx('employees.driver','Driver'),
  }

  const COL_FILTERS = {
    designation: ['All', ...DESIGNATIONS.slice(1)],
    nationality: ['All', ...new Set(employees.map(e => e.nationality).filter(Boolean))].sort(),
    gender:      ['All','Male','Female'],
    status:      ['All','Active','On Leave','Inactive'],
  }
  const COL_FILTER_LABELS = {
    gender: { 'All':tx('filters.all','All'), 'Male':tx('form.male','Male'), 'Female':tx('form.female','Female') },
    status: { 'All':tx('filters.all','All'), 'Active':tx('status.active','Active'), 'On Leave':tx('status.onLeave','On Leave'), 'Inactive':tx('status.inactive','Inactive') },
  }

  let list = employees.filter(e =>
    (!search || e.name.toLowerCase().includes(search.toLowerCase()) ||
               (e.designation||'').toLowerCase().includes(search.toLowerCase())) &&
    (!colFilters.designation || colFilters.designation === 'All' || e.designation === colFilters.designation) &&
    (!colFilters.nationality || colFilters.nationality === 'All' || e.nationality === colFilters.nationality) &&
    (!colFilters.gender      || colFilters.gender === 'All'      || e.gender === colFilters.gender) &&
    (!colFilters.status      || colFilters.status === 'All'      || e.status === colFilters.status)
  )
  list = [...list].sort((a, b) => {
    if (sort === 'name-asc')   return a.name.localeCompare(b.name)
    if (sort === 'name-desc')  return b.name.localeCompare(a.name)
    if (sort === 'desig-asc')  return (a.designation||'').localeCompare(b.designation||'')
    if (sort === 'desig-desc') return (b.designation||'').localeCompare(a.designation||'')
    if (sort === 'nat-asc')    return (a.nationality||'').localeCompare(b.nationality||'')
    if (sort === 'nat-desc')   return (b.nationality||'').localeCompare(a.nationality||'')
    return 0
  })

  async function handleDelete(id, name) {
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} deleted`)
    setSelected(null); setConfirm(null); onRefresh()
  }

  async function handleSave(formData, isEdit) {
    const payload = {
      name: formData.name, name_ar: formData.name_ar || null,
      gender: formData.gender || null, nationality: formData.nationality || null,
      designation: formData.designation || null, designation_ar: formData.designation_ar || null,
      employee_number: formData.employee_number || null, qss_number: formData.qss_number || null,
      phone: formData.phone || null, email: formData.email || null,
      status: formData.status || 'Active', notes: formData.notes || null,
    }
    if (!payload.name) { toast('Name is required', 'error'); return }
    const { error } = isEdit
      ? await supabase.from('employees').update(payload).eq('id', formData.id)
      : await supabase.from('employees').insert(payload)
    if (error) { toast(error.message, 'error'); return }
    toast(isEdit ? `${payload.name} updated` : `${payload.name} added`)
    setEditForm(null); setAddModal(false)
    await onRefresh()
    if (isEdit) setSelected(formData.id)
  }

  async function handlePhotoUpload(empId, file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `emp_${empId}.${ext}`
      const { error: upErr } = await supabase.storage.from('coach-photos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('coach-photos').getPublicUrl(path)
      await supabase.from('employees').update({ photo_url: data.publicUrl + '?t=' + Date.now() }).eq('id', empId)
      toast('Photo updated!'); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setUploading(false) }
  }

  function SortTh({ field, children }) {
    const isAsc  = sort === `${field}-asc`
    const isDesc = sort === `${field}-desc`
    return (
      <th onClick={() => isAsc ? setSort(`${field}-desc`) : setSort(`${field}-asc`)}
        style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          {children}
          <span style={{ fontSize:9, color:(isAsc||isDesc)?'#0085C7':'#ccc' }}>
            {isAsc?'▲':isDesc?'▼':'▲▼'}
          </span>
        </div>
      </th>
    )
  }

  function EmpModal({ data, isEdit, onClose }) {
    const [form, setForm] = useState(data || { status:'Active' })
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const ar = lang === 'ar'
    const statusOpts = [
      { value:'Active',   label: ar?'نشط':'Active' },
      { value:'On Leave', label: ar?'في إجازة':'On Leave' },
      { value:'Inactive', label: ar?'غير نشط':'Inactive' },
    ]
    const genderOpts = [
      { value:'',       label: '' },
      { value:'Male',   label: ar?'ذكر':'Male' },
      { value:'Female', label: ar?'أنثى':'Female' },
    ]
    const F = ({ label, name, type='text', placeholder, options }) => (
      <div className="form-group">
        <label className="form-label">{label}</label>
        {options
          ? <select className="form-input" value={form[name]||''} onChange={e => set(name, e.target.value)}>
              {options.map(o => <option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
            </select>
          : <input className="form-input" type={type} placeholder={placeholder} value={form[name]||''} onChange={e => set(name, e.target.value)} />
        }
      </div>
    )
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{isEdit ? (ar?'تعديل':'Edit') : (ar?'إضافة':'New')} {ar?'موظف':'Employee'}</div>
            <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
          </div>
          <div className="modal-body">
            <div className="form-section">{ar?'المعلومات الشخصية':'Personal Information'}</div>
            <div className="form-row">
              <F label={ar?'الاسم الكامل (إنجليزي)':'Full name (English)'} name="name" placeholder="e.g. Ahmed Al-Ansari" />
              <F label={ar?'الاسم الكامل (عربي)':'Full name (Arabic)'} name="name_ar" placeholder="أحمد الأنصاري" />
            </div>
            <div className="form-row">
              <F label={ar?'الجنس':'Gender'} name="gender" options={genderOpts} />
              <F label={ar?'الجنسية':'Nationality'} name="nationality" options={[{value:'',label:''}, ...COUNTRIES_EN.map(cn => ({value:cn, label: ar?(COUNTRIES_AR_MAP[cn]||cn):cn}))]} />
            </div>
            <div className="form-section">{ar?'الدور والتوظيف':'Role & Employment'}</div>
            <div className="form-row">
              <F label={ar?'المسمى الوظيفي (إنجليزي)':'Designation (English)'} name="designation" options={[{value:'',label:''},...DESIGNATIONS.slice(1).map(d => ({ value:d, label: ar ? (DESIG_AR[d]||d) : d }))]} />
              <F label={ar?'المسمى الوظيفي (عربي)':'Designation (Arabic)'} name="designation_ar" placeholder="e.g. مدرب" />
            </div>
            <div className="form-row">
              <F label={ar?'رقم الموظف':'Employee number'} name="employee_number" placeholder="e.g. 12501" />
              <F label={ar?'رقم QSS':'QSS number'} name="qss_number" placeholder="e.g. 50112" />
            </div>
            <F label={ar?'الحالة':'Status'} name="status" options={statusOpts} />
            <div className="form-section">{ar?'معلومات الاتصال':'Contact'}</div>
            <div className="form-row">
              <F label={ar?'الهاتف':'Phone'} name="phone" placeholder="+974 XXXX XXXX" />
              <F label={ar?'البريد الإلكتروني':'Email'} name="email" type="email" placeholder="name@qpc.qa" />
            </div>
            <div className="form-group">
              <label className="form-label">{ar?'ملاحظات':'Notes'}</label>
              <textarea className="form-input" rows={3} value={form.notes||''} onChange={e => set('notes', e.target.value)} style={{ resize:'vertical' }} />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={onClose}>{ar?'إلغاء':'Cancel'}</button>
            <button className="btn btn-blue" onClick={() => handleSave(form, isEdit)}>
              {isEdit ? (ar?'حفظ التغييرات':'Save changes') : (ar?'إضافة موظف':'Add employee')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── DETAIL VIEW ──
  if (selected) {
    const emp = employees.find(x => x.id === selected)
    if (!emp) { setSelected(null); return null }
    const color = DESIG_COLORS[emp.designation] || '#9aa3b2'
    return (
      <div>
        {editForm && <EmpModal data={editForm} isEdit={true} onClose={() => setEditForm(null)} />}
        {confirm && (
          <ConfirmModal title="Delete employee" message={`Delete ${emp.name}?`}
            onConfirm={() => handleDelete(emp.id, emp.name)} onCancel={() => setConfirm(null)} />
        )}
        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> {tx('actions.back','Back')}</button>
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          {canEdit(profile) && <>
            <button className="action-btn action-btn-edit" onClick={() => setEditForm({ ...emp })}><i className="ti ti-pencil" /> {tx('actions.edit','Edit')}</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> {tx('actions.delete','Delete')}</button>
          </>}
          <button className="action-btn action-btn-edit"
            style={{ borderColor:'#009F6B', color:'#009F6B' }}
            onMouseEnter={e => e.currentTarget.style.background='#e6f4ee'}
            onMouseLeave={e => e.currentTarget.style.background=''}
            onClick={() => exportEmployeesPDF(emp, lang)}>
            <i className="ti ti-printer" /> {tx('actions.exportPDF','Export PDF')}
          </button>
        </div>
        <div className="detail-grid">
          <div className="detail-profile">
            <div style={{ position:'relative', width:90, height:90, margin:'0 auto 14px' }}>
              {emp.photo_url
                ? <img src={emp.photo_url} alt={emp.name} style={{ width:90, height:90, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--border)' }} />
                : <div style={{ width:90, height:90, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:600, color:'#fff' }}>{initials(emp.name)}</div>
              }
              {canEdit(profile) && (
                <div style={{ position:'absolute', bottom:0, right:0, display:'flex', gap:3 }}>
                  <button onClick={() => photoInput.current.click()} disabled={uploading} title="Upload photo"
                    style={{ width:26, height:26, borderRadius:'50%', background:color, border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                    {uploading ? <div style={{ width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> : <i className="ti ti-camera" style={{ fontSize:12 }} />}
                  </button>
                  {emp.photo_url && (
                    <button onClick={async () => { await supabase.from('employees').update({ photo_url:null }).eq('id', emp.id); await onRefresh() }}
                      style={{ width:26, height:26, borderRadius:'50%', background:'#dc2626', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                      <i className="ti ti-x" style={{ fontSize:12 }} />
                    </button>
                  )}
                </div>
              )}
              <input ref={photoInput} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { if(e.target.files[0]) handlePhotoUpload(emp.id, e.target.files[0]) }} />
            </div>
            <div className="detail-name">{lang==='ar' && emp.name_ar ? emp.name_ar : emp.name}</div>
            {(lang==='ar' ? emp.name : emp.name_ar) && <div className="detail-sub">{lang==='ar' ? emp.name : emp.name_ar}</div>}
            <div style={{ margin:'10px 0' }}><DesigBadge label={emp.designation} displayLabel={DESIG_LABELS[emp.designation]} /></div>
            {emp.designation_ar && <div style={{ fontSize:13, color:'var(--text2)', marginBottom:8, direction:'rtl' }}>{emp.designation_ar}</div>}
            <div className="detail-fields">
              {[[tx('profile.employeeNum','Employee #'),emp.employee_number],[tx('profile.qssNumber','QSS #'),emp.qss_number],[tx('profile.gender','Gender'),emp.gender],[tx('profile.nationality','Nationality'),tc(emp.nationality)],[tx('profile.phone','Phone'),emp.phone],[tx('profile.email','Email'),emp.email],[tx('employees.status','Status'),emp.status]].map(([k,v]) => (
                <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv" style={{ fontSize:12 }}>{v||'—'}</span></div>
              ))}
            </div>
          </div>
          {emp.notes && (
            <div className="info-card">
              <div className="info-title">{tx('employees.notes','Notes')}</div>
              <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{emp.notes}</p>
            </div>
          )}
          <PersonDocuments
            personId={emp.id}
            personType="employee"
            personName={emp.name}
            docs={personDocs}
            onRefresh={onRefresh}
            profile={profile}
          />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div>
      {(addModal || editForm) && (
        <EmpModal data={editForm||{}} isEdit={!!editForm} onClose={() => { setAddModal(false); setEditForm(null) }} />
      )}
      <div className="page-header">
        <div><div className="page-title">{tx('pages.employees','Employees')}</div><div className="page-sub">{list.length} {tx('employees.ofEmployees','of')} {employees.length} {tx('pages.employees','employees')}</div></div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" style={{ background:'#009F6B' }} onClick={() => exportEmployeesExcel(list)}>
            <i className="ti ti-table-export" /> {tx('actions.exportExcel','Export Excel')}
          </button>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setColFilters({}) }}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:9, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
              <i className="ti ti-x" style={{ fontSize:13 }} /> {tx('actions.resetFilters','Reset filters')}
            </button>
          )}
          {canEdit(profile) && (
            <button className="btn btn-blue" onClick={() => setAddModal(true)}><i className="ti ti-plus" /> {tx('employees.addEmployee','Add employee')}</button>
          )}
        </div>
      </div>

      <div className="filters">
        <div className="search-wrap">
          <i className="ti ti-search" />
          <input placeholder={tx("employees.searchEmployees","Search by name, designation…")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>



      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <SortTh field="name">{tx('employees.employee','Employee')}</SortTh>
              <SortTh field="desig">{tx('employees.designation','Designation')}</SortTh>
              <SortTh field="nat">{tx('employees.nationality','Nationality')}</SortTh>
              <th>{tx('employees.gender','Gender')}</th>
              <th>{tx('employees.employeeNum','Employee #')}</th>
              <th>{tx('employees.qssNum','QSS #')}</th>
              <th>{tx('employees.status','Status')}</th>
              <th />
            </tr>
            <tr style={{ background:'#f8f9fb' }}>
              <th />
              {[
                { key:'designation', span:1 },
                { key:'nationality', span:1 },
                { key:'gender',      span:1 },
                { key:null,          span:1 },
                { key:null,          span:1 },
                { key:'status',      span:1 },
              ].map(({ key }, i) => (
                <th key={i} style={{ padding:'4px 8px' }}>
                  {key && COL_FILTERS[key] ? (
                    <select
                      value={colFilters[key] || 'All'}
                      onChange={e => setColFilters(f => ({ ...f, [key]: e.target.value }))}
                      style={{ fontSize:11, border:'1px solid var(--border)', borderRadius:6, padding:'3px 4px', background:'var(--surface)', color:(colFilters[key]&&colFilters[key]!=='All')?'#0085C7':'var(--text3)', cursor:'pointer', outline:'none', fontWeight:(colFilters[key]&&colFilters[key]!=='All')?600:400, maxWidth:130 }}>
                      {COL_FILTERS[key].map(o => <option key={o} value={o}>{
                key==='designation' ? (DESIG_LABELS[o]||o) :
                key==='nationality' ? (o==='All' ? (lang==='ar'?'الكل':'All') : tc(o)) :
                key==='gender' ? ({'All':lang==='ar'?'الكل':'All','Male':lang==='ar'?'ذكر':'Male','Female':lang==='ar'?'أنثى':'Female'}[o]||o) :
                (COL_FILTER_LABELS[key]?.[o]||o)
              }</option>)}
                    </select>
                  ) : null}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map(emp => (
              <tr key={emp.id} onClick={() => setSelected(emp.id)} style={{ cursor:'pointer' }}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {emp.photo_url
                      ? <img src={emp.photo_url} alt={emp.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                      : <div className="av" style={{ width:32, height:32, fontSize:11, background:DESIG_COLORS[emp.designation]||'#9aa3b2', flexShrink:0 }}>{initials(emp.name)}</div>
                    }
                    <div>
                      <div style={{ fontWeight:500, fontSize:13 }}>{lang==='ar' && emp.name_ar ? emp.name_ar : emp.name}</div>
                      {emp.name_ar && <div style={{ fontSize:11, color:'#9aa3b2' }}>{lang==='ar' ? emp.name : emp.name_ar}</div>}
                    </div>
                  </div>
                </td>
                <td>
                  <div><DesigBadge label={emp.designation} displayLabel={DESIG_LABELS[emp.designation]} /></div>
                  {emp.designation_ar && <div style={{ fontSize:11, color:'#9aa3b2', marginTop:3, direction:'rtl' }}>{emp.designation_ar}</div>}
                </td>
                <td style={{ fontSize:13, color:'#5a6272' }}>{tc(emp.nationality)||'—'}</td>
                <td style={{ fontSize:13, color:'#5a6272' }}>{emp.gender ? (lang==='ar' ? (emp.gender==='Male'?'ذكر':'أنثى') : emp.gender) : '—'}</td>
                <td style={{ fontSize:12, color:'#5a6272', fontFamily:'monospace' }}>{emp.employee_number||'—'}</td>
                <td style={{ fontSize:12, color:'#5a6272', fontFamily:'monospace' }}>{emp.qss_number||'—'}</td>
                <td><span className={`badge ${emp.status==='Active'?'badge-green':emp.status==='On Leave'?'badge-amber':'badge-gray'}`}>
              {lang==='ar' ? ({'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة'}[emp.status]||emp.status) : (emp.status||'—')}
            </span></td>
                <td><i className="ti ti-chevron-right" style={{ color:'#ccc', fontSize:16 }} /></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8}><div className="empty">{tx('employees.noEmployeesMatch','No employees match')}</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
