import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { Avatar, MedalDisplay, initials, avColor } from '../lib/helpers'
import CareerHistory from '../components/CareerHistory.jsx'
import { toast } from '../components/Toast'

export default function Profile({ user, profile, athletes, coaches, employees, results, onNav }) {
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

  const totalMedals = myResults.reduce((s, r) => ({
    gold:   s.gold   + (r.medal === 'gold'   ? 1 : 0),
    silver: s.silver + (r.medal === 'silver' ? 1 : 0),
    bronze: s.bronze + (r.medal === 'bronze' ? 1 : 0),
  }), { gold: 0, silver: 0, bronze: 0 })

  const myAthletes = role === 'coach' && personData
    ? athletes?.filter(a => String(a.coach_id) === String(personData.id)) || []
    : []

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
            <div className="detail-avatar" style={{ background: avColor(profile?.full_name||'') }}>
              {personData?.photo_url
                ? <img src={personData.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
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
            {!editing ? (
              <button className="action-btn action-btn-edit" style={{ marginTop:14, width:'100%', justifyContent:'center' }}
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

          {/* Career history for everyone */}
          {personData && (
            <CareerHistory
              personId={String(personData.id)}
              personType={role === 'admin' ? 'employee' : role}
              personName={ar&&personData.name_ar?personData.name_ar:personData.name}
              readOnly={role !== 'admin'}
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
