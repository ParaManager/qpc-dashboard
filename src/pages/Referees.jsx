import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { Avatar } from '../lib/helpers'
import { toast } from '../components/Toast'
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
    return (
      <div>
        <button className="back-btn" onClick={() => setSelected(null)}>
          <i className="ti ti-arrow-left" /> {L('Back to referees','رجوع إلى الحكام')}
        </button>
        <div className="detail-grid">
          <div className="detail-profile">
            <div className="detail-avatar">
              <span>{(r.name||r.name_ar||'?')[0].toUpperCase()}</span>
            </div>
            <div className="detail-name">{ar && r.name_ar ? r.name_ar : (r.name || '—')}</div>
            {r.name_ar && r.name && <div className="detail-sub">{ar ? r.name : r.name_ar}</div>}
            <div className="detail-sub">{tcNat(r.nationality)}</div>
            <div className="detail-fields" style={{ marginTop:16 }}>
              {[
                [L('Full Name (English)','الاسم الكامل بالإنجليزي'), r.name],
                [L('Full Name (Arabic)','الاسم الكامل بالعربي'),    r.name_ar],
                [L('Gender','الجنس'),       r.gender?(ar?(r.gender==='Male'?'ذكر':'أنثى'):r.gender):null],
                [L('Nationality','الجنسية'), tcNat(r.nationality)],
                [L('Date of Birth','تاريخ الميلاد'), r.dob],
                [L('ID Number','الرقم الشخصي'), r.id_number],
                [L('Joined QPC','تاريخ الانضمام'), r.joined_qpc],
              ].map(([k,v]) => v ? (
                <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
              ) : null)}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16, flexWrap:'wrap' }}>
              <button className="action-btn action-btn-edit" onClick={() => { setEditData(r); setShowForm(true); setSelected(null) }}>
                <i className="ti ti-pencil" /> {L('Edit','تعديل')}
              </button>
              <button className="action-btn action-btn-delete" onClick={() => handleDelete(r.id)}>
                <i className="ti ti-trash" /> {L('Delete','حذف')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
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
