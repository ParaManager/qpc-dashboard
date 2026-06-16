import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { Avatar, MedalDisplay, initials, avColor } from '../lib/helpers'
import AthleteCardButton, { generateAthleteCard } from '../components/AthleteCard'
import EmployeeCardButton, { generateEmployeeCard } from '../components/EmployeeCard'
import CareerHistory from '../components/CareerHistory.jsx'
import PersonDocuments from '../components/PersonDocuments'
import { toast } from '../components/Toast'

function ExportPDFButton({ athlete }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  function handlePDF() {
    const html = generateAthleteCard(athlete)
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 600)
  }
  return (
    <button onClick={handlePDF} className="action-btn"
      style={{ borderColor:'#009F6B', color:'#009F6B', padding:'5px 12px', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
      onMouseEnter={e => { e.currentTarget.style.background='#e6f4ee' }}
      onMouseLeave={e => { e.currentTarget.style.background='' }}>
      <i className="ti ti-printer" style={{ fontSize:14 }} />
      <span>{ar ? 'تصدير PDF' : 'Export PDF'}</span>
    </button>
  )
}

export default function Profile({ user, profile, athletes, coaches, employees, results, events, registrations, onNav, documents, personDocs, onRefresh }) {
  const { lang, tc } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [personData, setPersonData] = useState(null)
  const [editing, setEditing]       = useState(false)
  const [form, setForm]             = useState({})
  const [saving, setSaving]         = useState(false)

  const role = profile?.account_type || profile?.role || 'guest'

  useEffect(() => {
    loadPersonData()
  }, [profile, role])

  async function loadPersonData() {
    if (role === 'coach' && profile?.coach_id) {
      const d = coaches?.find(c => String(c.id) === String(profile.coach_id))
      setPersonData(d || null)
    } else if (role === 'athlete' && profile?.athlete_id) {
      const d = athletes?.find(a => String(a.id) === String(profile.athlete_id))
      setPersonData(d || null)
    } else if (role === 'admin' || role === 'employee') {
      // Find in employees by email/name
      const d = employees?.find(e =>
        e.name?.toLowerCase().includes(profile?.full_name?.split(' ')[0]?.toLowerCase() || '') ||
        e.qss_number === profile?.qid
      )
      setPersonData(d || null)
    }
  }

  async function saveProfile() {
    setSaving(true)
    await supabase.from('profiles').update({ full_name: form.full_name }).eq('id', profile.id)
    toast(L('Profile updated', 'تم تحديث الملف الشخصي'))
    setSaving(false)
    setEditing(false)
  }

  const myResults = results?.filter(r =>
    personData && (String(r.athlete_id) === String(personData?.id))
  ) || []

  const myEventIds = registrations?.filter(r => personData && String(r.athlete_id) === String(personData?.id)).map(r => r.event_id) || []
  const myEvents   = events?.filter(e => myEventIds.includes(e.id)).sort((a,b) => new Date(b.start_date) - new Date(a.start_date)) || []

  const totalMedals = myResults.reduce((s, r) => ({
    gold:   s.gold   + (r.medal === 'gold'   ? 1 : 0),
    silver: s.silver + (r.medal === 'silver' ? 1 : 0),
    bronze: s.bronze + (r.medal === 'bronze' ? 1 : 0),
  }), { gold: 0, silver: 0, bronze: 0 })

  const [hasCareerHistory, setHasCareerHistory] = useState(false)

  useEffect(() => {
    if (!personData?.id) return
    const type = role === 'admin' ? 'employee' : role
    supabase.from('career_history')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', String(personData.id))
      .eq('person_type', type)
      .then(({ count }) => setHasCareerHistory((count || 0) > 0))
  }, [personData?.id, role])

  const myAthletes = role === 'coach' && personData
    ? athletes?.filter(a => String(a.coach_id) === String(personData.id)) || []
    : []

  function exportAthleteProfile(a, myResults, myEvents) {
    const isAr = lang === 'ar'
    const L2 = (en, ar2) => isAr ? ar2 : en
    const SPORT_AR = {'Athletics':'ألعاب القوى','Swimming':'السباحة','Powerlifting':'رفع الأثقال','Boccia':'البوتشيا','Goalball':'كرة الهدف','Table Tennis':'تنس الطاولة','Special Olympics':'الأولمبياد الخاص','Shooting':'الرماية','Wheelchair Tennis':'تنس الكراسي المتحركة'}
    const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','Suspended':'موقوف','Under Medical Review':'تحت المراجعة الطبية','Injured':'مصاب','Retired':'متقاعد'}
    const field = (k, v) => v ? `<div class="field"><span class="k">${k}</span><span class="v">${v}</span></div>` : ''
    const html = `<!DOCTYPE html><html dir="${isAr?'rtl':'ltr'}" lang="${isAr?'ar':'en'}"><head><meta charset="UTF-8"/>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#1a1d23;padding:32px;font-size:13px}
.header{display:flex;align-items:center;gap:20px;margin-bottom:24px;padding-bottom:20px;border-bottom:3px solid #0085C7}
.profile-header{display:flex;gap:20px;margin-bottom:24px}.photo{width:80px;height:80px;border-radius:50%;background:#0085C7;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:700;flex-shrink:0;overflow:hidden}
.photo img{width:100%;height:100%;object-fit:cover}.profile-info h2{font-size:22px;font-weight:700}.badges{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}.badge-blue{background:#e8f3fb;color:#1565a0}.badge-green{background:#e6f4ee;color:#0d6e42}.badge-gray{background:#f0f1f3;color:#555e70}
.section{margin-bottom:20px}.section-title{font-size:11px;font-weight:700;color:#9aa3b2;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e5ea}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}.field{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f1f3;font-size:12px}
.field .k{color:#5a6272}.field .v{font-weight:600;text-align:${isAr?'left':'right'}}.medal-row{display:flex;gap:24px}.medal-item{text-align:center}.medal-num{font-size:24px;font-weight:700}
.result-row{display:flex;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid #f0f1f3;font-size:12px}.footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e5ea;font-size:10px;color:#9aa3b2;text-align:center}
</style></head><body>
<div class="header"><div class="header-text"><h1>${isAr?'الاتحاد القطري لذوي الاحتياجات الخاصة':'Qatar Paralympic Committee'}</h1><p>${isAr?'ملف الرياضي الرسمي · تم الإنشاء '+new Date().toLocaleDateString('ar-QA'):'Official Athlete Profile · Generated '+new Date().toLocaleDateString()}</p></div></div>
<div class="profile-header">
  <div class="photo">${a.photo_url?`<img src="${a.photo_url}"/>`:(a.name||'').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</div>
  <div class="profile-info">
    <h2>${isAr&&a.name_ar?a.name_ar:a.name}</h2>
    <div class="badges">
      <span class="badge badge-blue">${isAr?(SPORT_AR[a.sport]||a.sport||''):a.sport||''}</span>
      ${a.classification?`<span class="badge badge-blue">${a.classification}</span>`:''}
      <span class="badge badge-${a.status==='Active'?'green':'gray'}">${isAr?(STATUS_AR[a.status]||a.status||''):(a.status||'')}</span>
    </div>
  </div>
</div>
<div class="section"><div class="section-title">${L2('Personal Information','المعلومات الشخصية')}</div><div class="grid-2">
${field(L2('Date of birth','تاريخ الميلاد'),a.dob)}${field(L2('Gender','الجنس'),a.gender)}${field(L2('Nationality','الجنسية'),a.nationality)}${field(L2('Phone','الهاتف'),a.phone)}${field(L2('Email','البريد الإلكتروني'),a.email)}
</div></div>
<div class="section"><div class="section-title">${L2('Sport & Classification','الرياضة والتصنيف')}</div><div class="grid-2">
${field(L2('Sport','الرياضة'),isAr?(SPORT_AR[a.sport]||a.sport):a.sport)}${field(L2('Classification','التصنيف'),a.classification)}${field(L2('Disability type','نوع الإعاقة'),a.disability)}
</div></div>
<div class="section"><div class="section-title">${L2('Medals','الميداليات')}</div><div class="medal-row">
<div class="medal-item"><div class="medal-num" style="color:#f1c40f">${a.medals_gold||0}</div><div style="font-size:11px;color:#9aa3b2">${L2('Gold','ذهب')}</div></div>
<div class="medal-item"><div class="medal-num" style="color:#aaa">${a.medals_silver||0}</div><div style="font-size:11px;color:#9aa3b2">${L2('Silver','فضة')}</div></div>
<div class="medal-item"><div class="medal-num" style="color:#cd7f32">${a.medals_bronze||0}</div><div style="font-size:11px;color:#9aa3b2">${L2('Bronze','برونز')}</div></div>
</div></div>
${myResults.length>0?`<div class="section"><div class="section-title">${L2('Competition Results','سجل النتائج')}</div>${myResults.map(r=>`<div class="result-row"><span style="font-size:18px">${r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'}</span><div style="flex:1"><div style="font-weight:500">${r.event_name}</div><div style="color:#9aa3b2">${r.discipline||''}</div></div><span style="font-weight:600;color:#0085C7">${r.result||''}</span></div>`).join('')}</div>`:''}
<div class="footer">${isAr?'الاتحاد القطري لذوي الاحتياجات الخاصة · سري · ':'Qatar Paralympic Committee · Confidential · '}${new Date().getFullYear()}</div>
</body></html>`
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  const ROLE_COLORS = { admin:'#0085C7', coach:'#009F6B', athlete:'#EE334E', guest:'#9aa3b2' }
  const roleColor = ROLE_COLORS[role] || '#9aa3b2'
  const ROLE_AR = { admin:'مسؤول', coach:'مدرب', athlete:'رياضي', guest:'زائر' }

  return (
    <div>
      <div className="page-title" style={{ marginBottom:20 }}>{L('My Profile', 'ملفي الشخصي')}</div>

      <div className="detail-grid">
        {/* ── LEFT: Profile card ── */}
        <div>
          <div className="detail-profile">
            {/* Avatar */}
            <div style={{
              width: 90, height: 90, borderRadius: '50%',
              background: personData?.photo_url ? 'transparent' : avColor(profile?.full_name || ''),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color: '#fff',
              margin: '0 auto 4px', overflow: 'hidden',
              border: '3px solid var(--border)',
              flexShrink: 0,
            }}>
              {personData?.photo_url
                ? <img src={personData.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center' }} />
                : <span>{initials(profile?.full_name || user?.email || '?')}</span>
              }
            </div>

            {/* Name */}
            <div className="detail-name" style={{ marginTop:12 }}>
              {ar && personData?.name_ar ? personData.name_ar : (personData?.name || profile?.full_name || user?.email)}
            </div>
            {personData?.name_ar && personData?.name && (
              <div className="detail-sub">{ar ? personData.name : personData.name_ar}</div>
            )}

            {/* Role badge */}
            <div style={{ marginTop:8 }}>
              <span style={{ padding:'4px 14px', borderRadius:20, fontSize:12, fontWeight:600, background:roleColor+'20', color:roleColor }}>
                {ar ? (ROLE_AR[role]||role) : role.charAt(0).toUpperCase()+role.slice(1)}
              </span>
            </div>

            {/* Account info */}
            <div className="detail-fields" style={{ marginTop:16 }}>
              {[
                [L('QID / Username', 'الرقم الشخصي'), profile?.qid || profile?.email],
                [L('Account type', 'نوع الحساب'), ar ? (ROLE_AR[role]||role) : role],
                [L('Status', 'الحالة'), ar ? {'active':'نشط','pending':'قيد الانتظار','rejected':'مرفوض'}[profile?.status]||profile?.status : profile?.status],
                [L('Member since', 'عضو منذ'), profile?.approved_at ? new Date(profile.approved_at).toLocaleDateString(ar?'ar-QA':'en-GB') : '—'],
              ].map(([k,v]) => v ? (
                <div key={k} className="detail-row">
                  <span className="dk">{k}</span>
                  <span className="dv">{v}</span>
                </div>
              ) : null)}
            </div>

            {/* Edit name button */}
            {role === 'athlete' && personData && (
              <div style={{ marginTop:14, display:'flex', gap:8, flexDirection:'column' }}>
                <AthleteCardButton athlete={personData} />
                <button className="action-btn"
                  style={{ borderColor:'#009F6B', color:'#009F6B', justifyContent:'center' }}
                  onMouseEnter={e => { e.currentTarget.style.background='#e6f4ee' }}
                  onMouseLeave={e => { e.currentTarget.style.background='' }}
                  onClick={() => exportAthleteProfile(personData, myResults, myEvents)}>
                  <i className="ti ti-printer" style={{ fontSize:14 }} /> {L('Export PDF','تصدير PDF')}
                </button>
              </div>
            )}
            {(role === 'employee' || role === 'admin') && personData && (
              <div style={{ marginTop:14, display:'flex', gap:8, flexDirection:'column' }}>
                <EmployeeCardButton emp={personData} />
                <button className="action-btn"
                  style={{ borderColor:'#009F6B', color:'#009F6B', justifyContent:'center' }}
                  onMouseEnter={e => { e.currentTarget.style.background='#e6f4ee' }}
                  onMouseLeave={e => { e.currentTarget.style.background='' }}
                  onClick={() => { const html = generateEmployeeCard(personData); const win = window.open('','_blank'); win.document.write(html); win.document.close(); setTimeout(()=>win.print(),600) }}>
                  <i className="ti ti-printer" style={{ fontSize:14 }} /> {L('Export PDF','تصدير PDF')}
                </button>
              </div>
            )}
            {!editing ? (
              <button className="action-btn action-btn-edit" style={{ marginTop:8, width:'100%', justifyContent:'center' }}
                onClick={() => { setForm({ full_name: profile?.full_name }); setEditing(true) }}>
                <i className="ti ti-pencil" /> {L('Edit display name', 'تعديل الاسم')}
              </button>
            ) : (
              <div style={{ marginTop:14 }}>
                <input className="form-input" value={form.full_name||''} onChange={e => setForm(f=>({...f, full_name:e.target.value}))}
                  placeholder={L('Display name', 'الاسم المعروض')} style={{ marginBottom:8 }} />
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn-cancel" style={{ flex:1 }} onClick={() => setEditing(false)}>{L('Cancel','إلغاء')}</button>
                  <button className="btn" style={{ flex:1, background:'#0085C7' }} onClick={saveProfile} disabled={saving}>
                    {saving ? L('Saving…','حفظ…') : L('Save','حفظ')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── MEDALS for athlete ── */}
          {role === 'athlete' && (totalMedals.gold + totalMedals.silver + totalMedals.bronze) > 0 && (
            <div className="info-card" style={{ marginTop:12 }}>
              <div className="info-title">{L('My medals','ميدالياتي')}</div>
              <div style={{ display:'flex', gap:20, justifyContent:'center', padding:'8px 0' }}>
                <div style={{ textAlign:'center' }}><div style={{ fontSize:28, fontWeight:700, color:'#f1c40f' }}>{totalMedals.gold}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{L('Gold','ذهب')}</div></div>
                <div style={{ textAlign:'center' }}><div style={{ fontSize:28, fontWeight:700, color:'#aaa' }}>{totalMedals.silver}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{L('Silver','فضة')}</div></div>
                <div style={{ textAlign:'center' }}><div style={{ fontSize:28, fontWeight:700, color:'#cd7f32' }}>{totalMedals.bronze}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{L('Bronze','برونز')}</div></div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Details ── */}
        <div>
          {/* COACH details */}
          {role === 'coach' && personData && (
            <div className="info-card">
              <div className="info-title">{L('Coach Information','معلومات المدرب')}</div>
              {[
                [L('Sport','الرياضة'), personData.sport],
                [L('Nationality','الجنسية'), tc(personData.nationality)],
                [L('Employee #','رقم الموظف'), personData.employee_number],
                [L('QSS #','رقم QSS'), personData.qss_number],
                [L('Status','الحالة'), personData.status],
              ].map(([k,v]) => v ? (
                <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
              ) : null)}

              {/* My athletes */}
              {myAthletes.length > 0 && (
                <div style={{ marginTop:16 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
                    {L('My athletes','رياضيوني')} ({myAthletes.length})
                  </div>
                  {myAthletes.slice(0,5).map(a => (
                    <div key={a.id} onClick={() => onNav('athletes', { athleteId: a.id })}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
                      <Avatar name={a.name} id={a.id} size={28} fs={9} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500 }}>{ar&&a.name_ar?a.name_ar:a.name}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>{a.sport} · {a.classification}</div>
                      </div>
                    </div>
                  ))}
                  {myAthletes.length > 5 && (
                    <button onClick={() => onNav('athletes')} style={{ fontSize:12, color:'#0085C7', background:'none', border:'none', cursor:'pointer', marginTop:6, padding:0 }}>
                      {L(`View all ${myAthletes.length} athletes →`, `عرض كل ${myAthletes.length} رياضيون →`)}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ATHLETE details */}
          {role === 'athlete' && personData && (
            <div className="info-card">
              <div className="info-title">{L('Athlete Information','معلومات الرياضي')}</div>
              {[
                [L('Sport','الرياضة'), personData.sport],
                [L('Classification','التصنيف'), personData.classification],
                [L('Nationality','الجنسية'), tc(personData.nationality)],
                [L('Age category','الفئة العمرية'), personData.age_category],
                [L('Status','الحالة'), personData.status],
                [L('QSS #','رقم QSS'), personData.qss_number],
              ].map(([k,v]) => v ? (
                <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
              ) : null)}
            </div>
          )}

          {/* ADMIN details */}
          {role === 'admin' && personData && (
            <div className="info-card">
              <div className="info-title">{L('Employee Information','معلومات الموظف')}</div>
              {[
                [L('Designation','المسمى الوظيفي'), ar&&personData.designation_ar?personData.designation_ar:personData.designation],
                [L('Nationality','الجنسية'), tc(personData.nationality)],
                [L('Employee #','رقم الموظف'), personData.employee_number],
                [L('QSS #','رقم QSS'), personData.qss_number],
                [L('Phone','الهاتف'), personData.phone],
                [L('Email','البريد الإلكتروني'), personData.email],
              ].map(([k,v]) => v ? (
                <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
              ) : null)}
            </div>
          )}

          {/* Results for athlete */}
          {role === 'athlete' && myResults.length > 0 && (
            <div className="info-card" style={{ marginTop:12 }}>
              <div className="info-title">{L('My results','نتائجي')}</div>
              {myResults.slice(0,5).map(r => (
                <div key={r.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)', alignItems:'center', fontSize:13 }}>
                  <span style={{ fontSize:20 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:500 }}>{r.event_name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{r.discipline} · {r.date}</div>
                  </div>
                  <span style={{ fontWeight:600, color:'#0085C7' }}>{r.result}</span>
                </div>
              ))}
            </div>
          )}

          {/* Career history — only shown if entries exist */}
          {personData && hasCareerHistory && (
            <CareerHistory
              personId={String(personData.id)}
              personType={role === 'admin' ? 'employee' : role}
              personName={ar&&personData.name_ar?personData.name_ar:personData.name}
              readOnly={role !== 'admin'}
            />
          )}

          {/* Documents for coach */}
          {role === 'coach' && personData && (
            <PersonDocuments
              personId={personData.id}
              personType="coach"
              personName={ar&&personData.name_ar?personData.name_ar:personData.name}
              docs={personDocs}
              onRefresh={onRefresh || (() => {})}
              profile={profile}
            />
          )}

          {/* Documents for employee */}
          {role === 'employee' && personData && (
            <PersonDocuments
              personId={personData.id}
              personType="employee"
              personName={ar&&personData.name_ar?personData.name_ar:personData.name}
              docs={personDocs}
              onRefresh={onRefresh || (() => {})}
              profile={profile}
            />
          )}

          {/* Guest - no linked profile */}
          {role === 'guest' && (
            <div className="info-card">
              <div className="empty">
                <i className="ti ti-user" style={{ fontSize:32, marginBottom:8 }} />
                <div>{L('Guest account — view only access','حساب زائر — صلاحية عرض فقط')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
