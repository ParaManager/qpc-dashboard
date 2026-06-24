import { useState, useEffect, useRef } from 'react'
import { Avatar, MedalDisplay, Badge, initials, avColor, DashRow, SPORTS, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, SPORT_CATEGORY_NAMES_AR, SPORT_NAMES_AR, sportLabel } from '../lib/helpers'
import FormModal from '../components/FormModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'
import CareerHistory from '../components/CareerHistory.jsx'
import { useLang } from '../lib/LangContext.jsx'
import PersonDocuments from '../components/PersonDocuments'

function exportCoachPDF(coach, myAthletes, lang) {
  const isAr = lang === 'ar'
  const dir = isAr ? 'rtl' : 'ltr'
  const L = (en, ar) => isAr ? ar : en
  const field = (k, v) => {
    const clean = (v === null || v === undefined || v === 'null' || v === 'undefined' || v === '') ? null : v
    return clean ? `<div class="field"><span class="k">${k}</span><span class="v">${clean}</span></div>` : ''
  }
  const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','Suspended':'موقوف'}
  const COUNTRY_AR = {'Qatar':'قطر','Egypt':'مصر','Algeria':'الجزائر','Jordan':'الأردن','Tunisia':'تونس','Morocco':'المغرب','Saudi Arabia':'المملكة العربية السعودية','Somalia':'الصومال','Ireland':'أيرلندا','Spain':'إسبانيا','France':'فرنسا','UK':'المملكة المتحدة','USA':'الولايات المتحدة'}
  const totalMedals = myAthletes.reduce((s,a) => s+(a.medals_gold||0)+(a.medals_silver||0)+(a.medals_bronze||0), 0)
  const expLabel = isAr ? '⚠ منتهية' : '⚠ EXPIRED'

  const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr?'ar':'en'}"><head><meta charset="UTF-8"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; color:#1a1d23; padding:32px; font-size:13px; direction:${dir}; }
  .header { display:flex; align-items:center; gap:20px; margin-bottom:24px; padding-bottom:20px; border-bottom:3px solid #009F6B; }
  .dots { display:flex; gap:5px; }
  .dot { width:14px; height:14px; border-radius:50%; }
  h1 { font-size:20px; font-weight:700; color:#0a1628; }
  .sub { font-size:12px; color:#9aa3b2; margin-top:2px; }
  .profile { display:flex; gap:20px; margin-bottom:24px; }
  .photo { width:80px; height:80px; border-radius:50%; background:#009F6B; display:flex; align-items:center; justify-content:center; color:#fff; font-size:28px; font-weight:700; flex-shrink:0; overflow:hidden; }
  .photo img { width:100%; height:100%; object-fit:cover; }
  .info h2 { font-size:22px; font-weight:700; }
  .info p { font-size:13px; color:#5a6272; margin-top:3px; }
  .section { margin-bottom:20px; }
  .section-title { font-size:11px; font-weight:700; color:#9aa3b2; text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid #e2e5ea; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; }
  .field { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f1f3; font-size:12px; }
  .field .k { color:#5a6272; }
  .field .v { font-weight:600; text-align:${isAr?'left':'right'}; }
  .stat-row { display:flex; gap:24px; margin-bottom:16px; }
  .stat { text-align:center; background:#f8f9fb; border-radius:10px; padding:12px 20px; }
  .stat-num { font-size:24px; font-weight:700; color:#009F6B; }
  .stat-lbl { font-size:11px; color:#9aa3b2; margin-top:2px; }
  .ath-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f1f3; font-size:12px; gap:8px; }
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #e2e5ea; font-size:10px; color:#9aa3b2; text-align:center; }
  @media print { body { padding:16px; } }
</style></head><body>
<div class="no-print" style="position:fixed;top:16px;left:16px;z-index:999">
  <button onclick="if(window.opener||window.history.length<=1){window.close()}else{history.back()}"
    style="display:flex;align-items:center;gap:6px;padding:9px 18px;background:#0a1628;color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer;font-family:Arial;box-shadow:0 2px 12px rgba(0,0,0,.3)">
    &#8592; Back
  </button>
</div>

<div class="header">
  <div class="dots">
    <div class="dot" style="background:#EE334E"></div>
    <div class="dot" style="background:#0085C7"></div>
    <div class="dot" style="background:#009F6B"></div>
  </div>
  <div>
    <h1>${isAr ? 'الاتحاد القطري لذوي الاحتياجات الخاصة' : 'Qatar Paralympic Committee'}</h1>
    <p class="sub">${isAr ? `ملف المدرب الرسمي · تم الإنشاء ${new Date().toLocaleDateString('ar-QA')}` : `Official Coach Profile · Generated ${new Date().toLocaleDateString()}`}</p>
  </div>
</div>

<div class="profile">
  <div class="photo">${coach.photo_url ? `<img src="${coach.photo_url}"/>` : initials(coach.name)}</div>
  <div class="info">
    <h2>${isAr && coach.name_ar ? coach.name_ar : coach.name}</h2>
    <p>${isAr && coach.name_ar ? coach.name : (coach.name_ar||'')}</p>
    <p style="margin-top:6px;color:#009F6B;font-weight:600">
      ${coach.sport ? sportLabel(coach.sport, coach.sport_category, isAr) : ''} ${L('Coach','مدرب')} · ${isAr ? (STATUS_AR[coach.status]||coach.status||'') : (coach.status||'')}
    </p>
  </div>
</div>

<div class="section">
  <div class="section-title">${L('Coach Information','معلومات المدرب')}</div>
  <div class="grid-2">
    ${field(L('Employee #','رقم الموظف'), coach.employee_number)}
    ${field(L('QSS #','رقم QSS'), coach.qss_number)}
    ${field(L('Sport','الرياضة'), coach.sport ? sportLabel(coach.sport, coach.sport_category, isAr) : '')}
    ${field(L('Nationality','الجنسية'), isAr ? (COUNTRY_AR[coach.nationality]||coach.nationality) : coach.nationality)}
    ${field(L('Gender','الجنس'), coach.gender ? (isAr ? (coach.gender==='Male'?'ذكر':'أنثى') : coach.gender) : null)}
    ${field(L('With QPC since','مع QPC منذ'), coach.since)}
    ${field(L('Email','البريد الإلكتروني'), coach.email)}
    ${field(L('Phone','الهاتف'), coach.phone)}
  </div>
</div>

${(coach.passport_number || coach.id_number) ? `<div class="section">
  <div class="section-title">${L('Passport & ID','الجواز والهوية')}</div>
  <div class="grid-2">
    ${field(L('Passport number','رقم الجواز'), coach.passport_number)}
    ${coach.passport_expiry ? `<div class="field"><span class="k">${L('Passport expiry','انتهاء الجواز')}</span><span class="v" style="${new Date(coach.passport_expiry)<new Date()?'color:#dc2626':''}">${coach.passport_expiry}${new Date(coach.passport_expiry)<new Date()?' '+expLabel:''}</span></div>` : ''}
    ${field(L('ID / Residence #','الرقم الشخصي'), coach.id_number)}
    ${coach.id_expiry ? `<div class="field"><span class="k">${L('ID expiry','انتهاء الهوية')}</span><span class="v" style="${new Date(coach.id_expiry)<new Date()?'color:#dc2626':''}">${coach.id_expiry}${new Date(coach.id_expiry)<new Date()?' '+expLabel:''}</span></div>` : ''}
  </div>
</div>` : ''}

<div class="section">
  <div class="section-title">${L('Athletes Overview','نظرة عامة على الرياضيين')}</div>
  <div class="stat-row">
    <div class="stat"><div class="stat-num">${myAthletes.length}</div><div class="stat-lbl">${L('Total Athletes','إجمالي الرياضيين')}</div></div>
    <div class="stat"><div class="stat-num">${myAthletes.filter(a=>a.status==='Active').length}</div><div class="stat-lbl">${L('Active','نشط')}</div></div>
    <div class="stat"><div class="stat-num" style="color:#f1c40f">${myAthletes.reduce((s,a)=>s+(a.medals_gold||0),0)}</div><div class="stat-lbl">${L('Gold Medals','ذهب')}</div></div>
    <div class="stat"><div class="stat-num">${totalMedals}</div><div class="stat-lbl">${L('Total Medals','إجمالي الميداليات')}</div></div>
  </div>
</div>

${myAthletes.length > 0 ? `<div class="section">
  <div class="section-title">${L('Athlete Roster','قائمة الرياضيين')} (${myAthletes.length})</div>
  <div class="field" style="font-weight:600;background:#f8f9fb;padding:8px 6px">
    <span style="flex:2">${L('Name','الاسم')}</span>
    <span style="flex:1">${L('Sport','الرياضة')}</span>
    <span style="flex:1">${L('Class','التصنيف')}</span>
    <span style="flex:1">${L('Status','الحالة')}</span>
    <span style="flex:1">${L('Medals','الميداليات')}</span>
  </div>
  ${myAthletes.map(a=>`<div class="ath-row">
    <span style="flex:2">${isAr && a.name_ar ? a.name_ar : a.name}</span>
    <span style="flex:1;color:#5a6272">${a.sport ? sportLabel(a.sport, a.sport_category, isAr) : ''}</span>
    <span style="flex:1;color:#5a6272">${a.classification||'—'}</span>
    <span style="flex:1;color:#5a6272">${isAr?(STATUS_AR[a.status]||a.status||''):(a.status||'')}</span>
    <span style="flex:1">🥇${a.medals_gold||0} 🥈${a.medals_silver||0} 🥉${a.medals_bronze||0}</span>
  </div>`).join('')}
</div>` : ''}

<div class="footer">${isAr?'الاتحاد القطري لذوي الاحتياجات الخاصة · سري · ':'Qatar Paralympic Committee · Confidential · '}${new Date().getFullYear()}</div>
</body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 500)
}

function FormerAthletes({ coachId, athletes, lang, onNav }) {
  const [formerIds, setFormerIds] = useState([])
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!coachId) return
    supabase.from('athlete_coach_history')
      .select('athlete_id')
      .eq('coach_id', String(coachId))
      .eq('is_current', false)
      .then(({ data }) => setFormerIds((data||[]).map(r => String(r.athlete_id))))
  }, [coachId])

  const formerAthletes = athletes.filter(a => formerIds.includes(String(a.id)))
  if (!formerAthletes.length) return null

  const shown = showAll ? formerAthletes : formerAthletes.slice(0, 5)

  return (
    <div className="info-card" style={{ marginTop: 16 }}>
      <div className="info-title">
        {L('Former athletes', 'الرياضيون السابقون')} ({formerAthletes.length})
        <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0, marginLeft:4, color:'#f59e0b' }}>
          — {L('historical','تاريخي')}
        </span>
      </div>
      {shown.map(a => (
        <DashRow key={a.id} onClick={() => onNav('athletes', { athleteId: a.id })}>
          {a.photo_url
            ? <img src={a.photo_url} alt={a.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
            : <Avatar name={a.name} id={a.id} size={32} fs={10} />
          }
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:500 }}>{ar && a.name_ar ? a.name_ar : a.name}</div>
            <div style={{ fontSize:11, color:'#9aa3b2' }}>{a.sport} · {a.classification}</div>
          </div>
          <MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} />
          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'#f59e0b20', color:'#f59e0b', fontWeight:600, flexShrink:0 }}>
            {L('Former','سابق')}
          </span>
        </DashRow>
      ))}
      {formerAthletes.length > 5 && (
        <button onClick={() => setShowAll(v => !v)}
          style={{ width:'100%', marginTop:8, padding:'7px', background:'none', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', fontSize:12, color:'var(--text2)', fontFamily:'DM Sans, sans-serif' }}>
          {showAll
            ? L('Show less ▲', 'عرض أقل ▲')
            : L(`Show all ${formerAthletes.length} ▼`, `عرض الكل (${formerAthletes.length}) ▼`)}
        </button>
      )}
    </div>
  )
}

export default function Coaches({ coaches, athletes, personDocs, onRefresh, onNav, initCoachId, navState, profile }) {
  const [search, setSearch]     = useState('')
  const [sport, setSport]       = useState('All sports')
  const [sportCategory, setSportCategory] = useState('All categories')
  const [status, setStatus]     = useState('All statuses')
  const [sort, setSort]         = useState('name-asc')
  const sortBtn = (key, label) => {
    const isAsc = sort === `${key}-asc`
    const isDesc = sort === `${key}-desc`
    return <span onClick={() => setSort(isAsc ? `${key}-desc` : `${key}-asc`)} style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>
      {label} <span style={{ fontSize:9, color: (isAsc||isDesc)?'#0085C7':'#ccc' }}>{isAsc?'▲':isDesc?'▼':'▲▼'}</span>
    </span>
  }
  const [selected, setSelected] = useState(initCoachId || null)
  const [form, setForm]         = useState(null)
  const [confirm, setConfirm]   = useState(null)
  const [uploading, setUploading] = useState(false)
  const [showAllAthletes, setShowAllAthletes] = useState(false)
  const photoInput = useRef(null)

  const { tx, tc, lang } = useLang()
  const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','Suspended':'موقوف','Under Medical Review':'تحت المراجعة الطبية','Injured':'مصاب','Retired':'متقاعد','On Leave':'في إجازة'}
  const SPORT_NAMES = lang==='ar' ? SPORT_NAMES_AR : {}
  useEffect(() => { if (initCoachId) setSelected(initCoachId) }, [initCoachId])

  useEffect(() => {
    if (navState?.reset) {
      setSelected(null)
      setSearch('')
      setSport('All sports')
      setSportCategory('All categories')
      setStatus('All statuses')
      setSort('name-asc')
    }
  }, [navState])

  // Show every known sport (Paralympic + Special Olympics), not just ones currently
  // in use — so a sport with zero coaches today is still findable.
  const coachSportsInData = new Set(coaches.map(c => c.sport).filter(Boolean))
  const sportsRaw  = ['All sports', ...SPORTS, ...[...coachSportsInData].filter(s => !SPORTS.includes(s))]
  const categoriesRaw = ['All categories', ...SPORT_CATEGORIES]
  const hasFilters = search || sport !== 'All sports' || sportCategory !== 'All categories' || status !== 'All statuses'

  let list = coaches.filter(c =>
    (sport  === 'All sports'   || c.sport  === sport)  &&
    (sportCategory === 'All categories' || c.sport_category === sportCategory) &&
    (status === 'All statuses' || c.status === status) &&
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.sport||'').toLowerCase().includes(search.toLowerCase()))
  )
  list = [...list].sort((a, b) => {
    const aC = athletes.filter(x => x.coach_id === a.id).length
    const bC = athletes.filter(x => x.coach_id === b.id).length
    if (sort === 'name-asc')      return a.name.localeCompare(b.name)
    if (sort === 'name-desc')     return b.name.localeCompare(a.name)
    if (sort === 'athletes-desc') return bC - aC
    if (sort === 'since-asc')     return new Date(a.since) - new Date(b.since)
    if (sort === 'since-desc')    return new Date(b.since) - new Date(a.since)
    if (sort === 'sport-asc')     return (a.sport||'').localeCompare(b.sport||'')
    if (sort === 'sport-desc')    return (b.sport||'').localeCompare(a.sport||'')
    if (sort === 'nationality-asc')  return (a.nationality||'').localeCompare(b.nationality||'')
    if (sort === 'nationality-desc') return (b.nationality||'').localeCompare(a.nationality||'')
    if (sort === 'status-asc')    return (a.status||'').localeCompare(b.status||'')
    if (sort === 'status-desc')   return (b.status||'').localeCompare(a.status||'')
    return 0
  })

  async function handleSave(formData) {
    const isEdit = !!formData.id
    const payload = {
      name: formData.name, name_ar: formData.nameAr,
      nationality: formData.nationality, gender: formData.gender,
      sport_category: formData.sportCategory,
      sport: formData.sport,
      license: formData.license, since: formData.since || null,
      email: formData.email, phone: formData.phone, status: formData.status,
      qss_number: formData.qssNumber, employee_number: formData.employeeNumber,
      passport_number: formData.passportNumber || null,
      passport_expiry: formData.passportExpiry || null,
      id_number: formData.idNumber || null,
      id_expiry: formData.idExpiry || null,
    }
    if (!payload.name) { toast('Name is required', 'error'); return }
    const { error } = isEdit
      ? await supabase.from('coaches').update(payload).eq('id', formData.id)
      : await supabase.from('coaches').insert(payload)
    if (error) { toast(error.message, 'error'); return }
    toast(isEdit ? `${payload.name} updated` : `${payload.name} added`)
    setForm(null); await onRefresh()
    if (isEdit) setSelected(formData.id)
  }

  async function handleDelete(id, name) {
    const { error } = await supabase.from('coaches').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} deleted`)
    setSelected(null); setConfirm(null); onRefresh()
  }

  async function handlePhotoUpload(coachId, file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${coachId}.${ext}`
      // Remove any existing photos for this coach first (all extensions)
      await supabase.storage.from('coach-photos').remove([
        `${coachId}.jpg`, `${coachId}.jpeg`, `${coachId}.png`, `${coachId}.webp`
      ])
      // Upload fresh
      const { error: upErr } = await supabase.storage.from('coach-photos').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('coach-photos').getPublicUrl(path)
      const photoUrl = data.publicUrl + '?t=' + Date.now()
      const { error: dbErr } = await supabase.from('coaches').update({ photo_url: photoUrl }).eq('id', coachId)
      if (dbErr) throw dbErr
      toast('Photo updated!'); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setUploading(false) }
  }

  async function handlePhotoRemove(coachId) {
    const { error } = await supabase.from('coaches').update({ photo_url: null }).eq('id', coachId)
    if (error) { toast(error.message, 'error'); return }
    toast('Photo removed'); await onRefresh()
  }

  // ── DETAIL VIEW ──
  if (selected) {
    const c = coaches.find(x => x.id === selected)
    if (!c) { setSelected(null); return null }
    const myAthletes = athletes.filter(a => a.coach_id === c.id)

    return (
      <div>
        {form && (
          <FormModal type="coach"
            record={form==='edit' ? {
              id:c.id, name:c.name, nameAr:c.name_ar, nationality:c.nationality,
              gender:c.gender, sportCategory:c.sport_category, sport:c.sport,
              license:c.license, since:c.since, email:c.email, phone:c.phone,
              status:c.status, qssNumber:c.qss_number, employeeNumber:c.employee_number,
              passportNumber:c.passport_number, passportExpiry:c.passport_expiry,
              idNumber:c.id_number, idExpiry:c.id_expiry,
            } : null}
            coaches={coaches} athletes={athletes} onSave={handleSave} onClose={() => setForm(null)} />
        )}
        {confirm && (
          <ConfirmModal title="Delete coach" message={`Delete ${c.name}? Athletes will be unassigned.`}
            onConfirm={() => handleDelete(c.id, c.name)} onCancel={() => setConfirm(null)} />
        )}

        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> {tx('actions.back','Back')}</button>
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          {canEdit(profile) && <>
            <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> {tx('actions.edit','Edit')}</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> {tx('actions.delete','Delete')}</button>
          </>}
          <button className="action-btn"
            style={{ borderColor:'#0085C7', color:'#0085C7' }}
            onMouseEnter={e => e.currentTarget.style.background='#e8f3fb'}
            onMouseLeave={e => e.currentTarget.style.background=''}
            onClick={() => onNav('schedule', { coachFilter: c.id })}>
            <i className="ti ti-calendar" /> {tx('actions.viewSchedule', lang==='ar' ? 'عرض الجدول' : 'View Schedule')}
          </button>
          <button className="action-btn action-btn-edit"
            style={{ borderColor:'#009F6B', color:'#009F6B' }}
            onMouseEnter={e => e.currentTarget.style.background='#e6f4ee'}
            onMouseLeave={e => e.currentTarget.style.background=''}
            onClick={() => exportCoachPDF(c, myAthletes, lang)}>
            <i className="ti ti-printer" /> {tx('actions.exportPDF','Export PDF')}
          </button>
        </div>

        <div className="detail-grid">
          <div className="detail-profile">
            {/* PHOTO */}
            <div style={{ position:'relative', width:90, height:90, margin:'0 auto 14px' }}>
              {c.photo_url
                ? <img src={c.photo_url} alt={c.name} style={{ width:90, height:90, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--border)' }} />
                : <div style={{ width:90, height:90, borderRadius:'50%', background:'#009F6B', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:600, color:'#fff' }}>{initials(c.name)}</div>
              }
              {canEdit(profile) && (
                <div style={{ position:'absolute', bottom:0, right:0, display:'flex', gap:3 }}>
                  <button onClick={() => photoInput.current.click()} disabled={uploading} title="Upload photo"
                    style={{ width:26, height:26, borderRadius:'50%', background:'#009F6B', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                    {uploading
                      ? <div style={{ width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
                      : <i className="ti ti-camera" style={{ fontSize:12 }} />}
                  </button>
                  {c.photo_url && (
                    <button onClick={() => handlePhotoRemove(c.id)} title="Remove photo"
                      style={{ width:26, height:26, borderRadius:'50%', background:'#dc2626', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                      <i className="ti ti-x" style={{ fontSize:12 }} />
                    </button>
                  )}
                </div>
              )}
              <input ref={photoInput} type="file" accept="image/*" style={{ display:'none' }}
                onChange={e => { if(e.target.files[0]) handlePhotoUpload(c.id, e.target.files[0]) }} />
            </div>

            <div className="detail-name">{lang==='ar' && c.name_ar ? c.name_ar : c.name}</div>
            <div className="detail-sub">{lang==='ar' && c.name_ar ? c.name : c.name_ar}</div>
            <div className="detail-sub">
              {c.sport ? sportLabel(c.sport, c.sport_category, lang==='ar') : ''} {tx('nav.coaches','Coach')}
              {c.sport_category && <span style={{ marginLeft:6, fontSize:11, color:'var(--text3)' }}>· {lang==='ar' ? (SPORT_CATEGORY_NAMES_AR[c.sport_category]||c.sport_category) : c.sport_category}</span>}
            </div>
            <div className="detail-badges"><Badge label={lang==='ar'?(STATUS_AR[c.status]||c.status):c.status} /></div>
            <div className="detail-fields">
              {[
                [lang==='ar'?'رقم الموظف':'Employee #', c.employee_number],
                [lang==='ar'?'رقم QSS':'QSS #', c.qss_number],
                  [lang==='ar'?'الجنسية':'Nationality', tc(c.nationality)],
                [lang==='ar'?'الجنس':'Gender', lang==='ar'&&c.gender?(c.gender==='Male'?'ذكر':'أنثى'):c.gender],
                [lang==='ar'?'مع QPC منذ':'With QPC since', c.since],
                [lang==='ar'?'رقم الجواز':'Passport #', c.passport_number],
                [lang==='ar'?'انتهاء الجواز':'Passport expiry', c.passport_expiry],
                [lang==='ar'?'الرقم الشخصي':'ID / Residence #', c.id_number],
                [lang==='ar'?'انتهاء الهوية':'ID expiry', c.id_expiry],
                [lang==='ar'?'البريد الإلكتروني':'Email', c.email],
                [lang==='ar'?'الهاتف':'Phone', c.phone],
              ].map(([k,v]) => (
                <div key={k} className="detail-row">
                  <span className="dk">{k}</span>
                  <span className="dv" style={{ fontSize:12 }}>{v||'—'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="info-card">
            {/* Medals summary */}
            <div style={{ display:'flex', justifyContent:'space-around', padding:'10px 0 16px', borderBottom:'1px solid var(--border)', marginBottom:14 }}>
              {[
                [lang==='ar'?'الرياضيون':'Athletes', myAthletes.length, '#0085C7'],
                [lang==='ar'?'ذهب':'Gold', myAthletes.reduce((s,a)=>s+(a.medals_gold||0),0), '#f1c40f'],
                [lang==='ar'?'فضة':'Silver', myAthletes.reduce((s,a)=>s+(a.medals_silver||0),0), '#aaa'],
                [lang==='ar'?'برونز':'Bronze', myAthletes.reduce((s,a)=>s+(a.medals_bronze||0),0), '#cd7f32'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:600, color }}>{val}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>

            <div className="info-title">
              {lang==='ar'?'الرياضيون المعينون':'Assigned athletes'} ({myAthletes.length})
              <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0, marginLeft:4 }}>— {lang==='ar'?'انقر للعرض':'click to view'}</span>
            </div>
            {myAthletes.length === 0
              ? <div className="empty">{lang==='ar'?'لا يوجد رياضيون معينون':'No athletes assigned'}</div>
              : <>
                  {(showAllAthletes ? myAthletes : myAthletes.slice(0, 5)).map(a => (
                    <DashRow key={a.id} onClick={() => onNav('athletes', { athleteId: a.id })}>
                      {a.photo_url
                        ? <img src={a.photo_url} alt={a.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                        : <Avatar name={a.name} id={a.id} size={32} fs={10} />
                      }
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500 }}>{lang==='ar' && a.name_ar ? a.name_ar : a.name}</div>
                        <div style={{ fontSize:11, color:'#9aa3b2' }}>{a.sport ? sportLabel(a.sport, a.sport_category, lang==='ar') : ''} · {a.classification}</div>
                      </div>
                      <MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} />
                      <Badge label={lang==='ar' ? (STATUS_AR[a.status]||a.status) : a.status} />
                    </DashRow>
                  ))}
                  {myAthletes.length > 5 && (
                    <button onClick={() => setShowAllAthletes(v => !v)}
                      style={{ width:'100%', marginTop:8, padding:'7px', background:'none', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', fontSize:12, color:'var(--text2)', fontFamily:'DM Sans, sans-serif' }}>
                      {showAllAthletes
                        ? (lang==='ar' ? 'عرض أقل ▲' : 'Show less ▲')
                        : (lang==='ar' ? `عرض الكل (${myAthletes.length}) ▼` : `Show all ${myAthletes.length} athletes ▼`)
                      }
                    </button>
                  )}
                </>
            }
          </div>

        </div>

        {/* FORMER ATHLETES */}
        <FormerAthletes coachId={c.id} athletes={athletes} lang={lang} onNav={onNav} />

        {/* DOCUMENTS - full width below both columns */}
        <PersonDocuments
          personId={c.id}
          personType="coach"
          personName={c.name}
          docs={personDocs}
          onRefresh={onRefresh}
          profile={profile}
        />
      <CareerHistory personId={c.id} personType="coach" personName={c.name} />

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div>
      {form && <FormModal type="coach" record={null} coaches={coaches} athletes={athletes} onSave={handleSave} onClose={() => setForm(null)} />}
      <div className="page-header">
        <div><div className="page-title">{tx('pages.coaches','Coaches')}</div><div className="page-sub">{list.length} {tx('coaches.ofCoaches','of')} {coaches.length} {tx('pages.coaches','coaches')}</div></div>
        <div style={{ display:'flex', gap:8 }}>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setSport('All sports'); setSportCategory('All categories'); setStatus('All statuses') }}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:9, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
              <i className="ti ti-x" style={{ fontSize:13 }} /> {tx('actions.resetFilters','Reset filters')}
            </button>
          )}
          {canEdit(profile) && (
            <button className="btn btn-green" onClick={() => setForm('new')}><i className="ti ti-plus" /> {tx('coaches.addCoach','Add coach')}</button>
          )}
        </div>
      </div>
      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder={tx("coaches.searchCoaches","Search by name, sport…")} value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="filter" value={sportCategory} onChange={e => setSportCategory(e.target.value)}>{categoriesRaw.map(c => <option key={c} value={c}>{c === 'All categories' ? tx('filters.allCategories','All categories') : (lang==='ar' ? (SPORT_CATEGORY_NAMES_AR[c]||c) : c)}</option>)}</select>
        <select className="filter" value={sport} onChange={e => setSport(e.target.value)}>{sportsRaw.map(s => <option key={s} value={s}>{s === 'All sports' ? tx('filters.allSports','All sports') : (SPORT_NAMES[s]||s)}</option>)}</select>
        <select className="filter" value={status} onChange={e => setStatus(e.target.value)}>{[['All statuses',tx('filters.allStatuses','All statuses')],['Active',tx('status.active','Active')],['On Leave',tx('status.onLeave','On Leave')],['Inactive',tx('status.inactive','Inactive')]].map(([val,lbl]) => <option key={val} value={val}>{lbl}</option>)}</select>
        <select className="filter" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="name-asc">{tx('filters.nameAZ','Name A→Z')}</option>
          <option value="name-desc">{tx('filters.nameZA','Name Z→A')}</option>
          <option value="sport-asc">{lang==='ar'?'الرياضة أ-ي':'Sport A→Z'}</option>
          <option value="sport-desc">{lang==='ar'?'الرياضة ي-أ':'Sport Z→A'}</option>
          <option value="nationality-asc">{lang==='ar'?'الجنسية أ-ي':'Nationality A→Z'}</option>
          <option value="status-asc">{lang==='ar'?'الحالة':'Status'}</option>
          <option value="athletes-desc">{tx('filters.mostAthletes','Most athletes')}</option>
          <option value="since-asc">{tx('filters.longestWithQPC','Longest with QPC')}</option>
          <option value="since-desc">{lang==='ar'?'الأحدث':'Newest'}</option>
        </select>
      </div>
      <div className="coach-grid">
        {list.map(c => {
          const count = athletes.filter(a => a.coach_id === c.id).length
          return (
            <div key={c.id} className="coach-card" onClick={() => setSelected(c.id)}>
              <div className="coach-head">
                {c.photo_url
                  ? <img src={c.photo_url} alt={c.name} style={{ width:42, height:42, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                  : <div className="av" style={{ width:42, height:42, fontSize:13, background:'#009F6B' }}>{initials(c.name)}</div>
                }
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{lang==='ar' && c.name_ar ? c.name_ar : c.name}</div>
                  <div style={{ fontSize:11, color:'#9aa3b2', marginTop:1 }}>{lang==='ar' && c.name_ar ? c.name : (c.name_ar || tc(c.nationality))}</div>
                  <div style={{ fontSize:11, color:'#9aa3b2', marginTop:1 }}>{tc(c.nationality)}</div>
                </div>
                <Badge label={lang==='ar'?(STATUS_AR[c.status]||c.status):c.status} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {[
                  [tx('form.sport','Sport'), c.sport ? sportLabel(c.sport, c.sport_category, lang==='ar') : ''],
                      [tx('coaches.employeeNum','Employee #'), c.employee_number],
                  [tx('coaches.athletes','Athletes'), count],
                ].map(([k,v]) => (
                  <div key={k} className="coach-row">
                    <span>{k}</span>
                    <span style={k==='Athletes'?{color:'#0085C7',fontWeight:600}:{}}>{v||'—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {list.length === 0 && <div className="empty">{tx('coaches.noCoachesMatch','No coaches match')}</div>}
      </div>
    </div>
  )
}
