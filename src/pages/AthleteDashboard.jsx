import { useLang } from '../lib/LangContext.jsx'
import { MedalDisplay, initials, avColor } from '../lib/helpers'

export default function AthleteDashboard({ athlete, coach, results, events, registrations, onNav }) {
  const { lang, tc } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  if (!athlete) return (
    <div className="empty">
      <i className="ti ti-user-off" style={{ fontSize:32, marginBottom:8 }} />
      <div>{L('No athlete profile linked to your account. Please contact the admin.', 'لا يوجد ملف رياضي مرتبط بحسابك. يرجى التواصل مع المسؤول.')}</div>
    </div>
  )

  const myResults      = (results||[]).filter(r => String(r.athlete_id) === String(athlete.id))
  const myEventIds     = (registrations||[]).filter(r => String(r.athlete_id) === String(athlete.id)).map(r => r.event_id)
  const myEvents       = (events||[]).filter(e => myEventIds.includes(e.id))
  const upcomingEvents = myEvents.filter(e => e.status === 'Upcoming' || e.status === 'Registration Open').sort((a,b) => new Date(a.start_date) - new Date(b.start_date))
  const recentResults  = [...myResults].sort((a,b) => new Date(b.date||0) - new Date(a.date||0)).slice(0,5)

  // Personal bests per discipline
  const bests = {}
  myResults.forEach(r => {
    if (!r.discipline) return
    if (!bests[r.discipline] || (r.medal==='gold' && bests[r.discipline].medal!=='gold')) bests[r.discipline] = r
  })
  const personalBests = Object.values(bests)

  const gold   = athlete.medals_gold   || 0
  const silver = athlete.medals_silver || 0
  const bronze = athlete.medals_bronze || 0
  const total  = gold + silver + bronze

  const SPORT_AR = {'Athletics':'ألعاب القوى','Swimming':'السباحة','Powerlifting':'رفع الأثقال','Boccia':'البوتشيا','Goalball':'كرة الهدف','Table Tennis':'تنس الطاولة','Special Olympics':'الأولمبياد الخاص','Shooting':'الرماية','Wheelchair Tennis':'تنس الكراسي المتحركة'}

  const Card = ({ title, icon, color='#0085C7', children, onClick }) => (
    <div className="info-card" onClick={onClick} style={{ cursor: onClick?'pointer':'default' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:color+'20', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <i className={`ti ${icon}`} style={{ fontSize:16, color }} />
        </div>
        <div className="info-title" style={{ margin:0 }}>{title}</div>
      </div>
      {children}
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24, padding:'20px 24px', background:'linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)', borderRadius:16, color:'#fff' }}>
        <div style={{ width:64, height:64, borderRadius:'50%', background: athlete.photo_url ? 'transparent' : avColor(athlete.id), display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, flexShrink:0, overflow:'hidden', border:'3px solid rgba(255,255,255,.2)' }}>
          {athlete.photo_url ? <img src={athlete.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : initials(athlete.name)}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:20, fontWeight:700 }}>{ar&&athlete.name_ar?athlete.name_ar:athlete.name}</div>
          <div style={{ fontSize:13, opacity:.7, marginTop:2 }}>{ar?(SPORT_AR[athlete.sport]||athlete.sport):athlete.sport} · {athlete.classification}</div>
          <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
            <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background: athlete.status==='Active'?'#009F6B30':'rgba(255,255,255,.1)', color: athlete.status==='Active'?'#4ade80':'rgba(255,255,255,.7)', border:`1px solid ${athlete.status==='Active'?'#009F6B50':'rgba(255,255,255,.2)'}` }}>
              {ar?{'Active':'نشط','Inactive':'غير نشط','Injured':'مصاب','Retired':'متقاعد'}[athlete.status]||athlete.status:athlete.status}
            </span>
            {athlete.nationality && <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, background:'rgba(255,255,255,.1)', color:'rgba(255,255,255,.7)', border:'1px solid rgba(255,255,255,.2)' }}>{tc(athlete.nationality)}</span>}
          </div>
        </div>
        {/* Total medals */}
        {total > 0 && (
          <div style={{ textAlign:'center', flexShrink:0 }}>
            <div style={{ fontSize:32, fontWeight:700, color:'#f1c40f' }}>{total}</div>
            <div style={{ fontSize:11, opacity:.6 }}>{L('Total medals','إجمالي الميداليات')}</div>
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
        {/* Gold */}
        <div style={{ background:'#f1c40f15', border:'1px solid #f1c40f30', borderRadius:14, padding:'16px', textAlign:'center' }}>
          <div style={{ fontSize:32 }}>🥇</div>
          <div style={{ fontSize:28, fontWeight:700, color:'#f1c40f' }}>{gold}</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>{L('Gold','ذهب')}</div>
        </div>
        {/* Silver */}
        <div style={{ background:'#aaaaaa15', border:'1px solid #aaaaaa30', borderRadius:14, padding:'16px', textAlign:'center' }}>
          <div style={{ fontSize:32 }}>🥈</div>
          <div style={{ fontSize:28, fontWeight:700, color:'#aaa' }}>{silver}</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>{L('Silver','فضة')}</div>
        </div>
        {/* Bronze */}
        <div style={{ background:'#cd7f3215', border:'1px solid #cd7f3230', borderRadius:14, padding:'16px', textAlign:'center' }}>
          <div style={{ fontSize:32 }}>🥉</div>
          <div style={{ fontSize:28, fontWeight:700, color:'#cd7f32' }}>{bronze}</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>{L('Bronze','برونز')}</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {/* Coach */}
        <Card title={L('My Coach','مدربي')} icon="ti-user-star" color="#009F6B">
          {coach ? (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:'#009F6B20', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#009F6B', flexShrink:0 }}>
                {initials(coach.name)}
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:600 }}>{ar&&coach.name_ar?coach.name_ar:coach.name}</div>
                <div style={{ fontSize:12, color:'var(--text3)' }}>{ar?(SPORT_AR[coach.sport]||coach.sport):coach.sport}</div>
              </div>
            </div>
          ) : <div className="empty" style={{ padding:'8px 0' }}>{L('No coach assigned','لم يتم تعيين مدرب')}</div>}
        </Card>

        {/* Quick stats */}
        <Card title={L('Stats','الإحصائيات')} icon="ti-chart-bar" color="#8b5cf6">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              [L('Total competitions','إجمالي المنافسات'), myEvents.length],
              [L('Total results','إجمالي النتائج'), myResults.length],
              [L('Personal bests','أفضل نتائج شخصية'), personalBests.length],
              [L('Upcoming events','الفعاليات القادمة'), upcomingEvents.length],
            ].map(([label, val]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                <span style={{ color:'var(--text2)' }}>{label}</span>
                <span style={{ fontWeight:600 }}>{val}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming events */}
        <Card title={L('Upcoming Events','الفعاليات القادمة')} icon="ti-calendar-event" color="#0085C7"
          onClick={upcomingEvents.length > 0 ? () => onNav('athlete-events') : null}>
          {upcomingEvents.length === 0
            ? <div className="empty" style={{ padding:'8px 0', fontSize:13 }}>{L('No upcoming events','لا توجد فعاليات قادمة')}</div>
            : upcomingEvents.slice(0,3).map(ev => (
              <div key={ev.id} style={{ padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                <div style={{ fontWeight:500 }}>{ev.name}</div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                  <i className="ti ti-calendar" style={{ fontSize:11, marginRight:3 }} />{ev.start_date}
                  {ev.venue && <span> · {ev.venue}</span>}
                </div>
              </div>
            ))
          }
        </Card>

        {/* Recent results */}
        <Card title={L('Recent Results','آخر النتائج')} icon="ti-medal" color="#EE334E"
          onClick={recentResults.length > 0 ? () => onNav('athlete-results') : null}>
          {recentResults.length === 0
            ? <div className="empty" style={{ padding:'8px 0', fontSize:13 }}>{L('No results yet','لا توجد نتائج بعد')}</div>
            : recentResults.map(r => (
              <div key={r.id} style={{ display:'flex', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)', alignItems:'center', fontSize:13 }}>
                <span style={{ fontSize:18 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':r.medal==='bronze'?'🥉':'📋'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.event_name}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{r.discipline}</div>
                </div>
                <span style={{ fontWeight:600, color:'#0085C7', flexShrink:0 }}>{r.result}</span>
              </div>
            ))
          }
        </Card>

        {/* Personal bests */}
        {personalBests.length > 0 && (
          <Card title={L('Personal Bests','أفضل النتائج الشخصية')} icon="ti-trophy" color="#f59e0b" >
            {personalBests.slice(0,4).map(r => (
              <div key={r.id} style={{ display:'flex', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)', alignItems:'center', fontSize:13 }}>
                <span style={{ fontSize:16 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':r.medal==='bronze'?'🥉':'📋'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500 }}>{r.discipline}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{r.event_name}</div>
                </div>
                <span style={{ fontWeight:600, color:'#0085C7' }}>{r.result}</span>
              </div>
            ))}
          </Card>
        )}

        {/* Medical status */}
        <Card title={L('Medical Status','الحالة الطبية')} icon="ti-heart-rate-monitor" color="#EE334E">
          {(() => {
            const ms = athlete.medical_status || 'None'
            const col = ms==='None'?'#EE334E':ms==='Screening'?'#009F6B':'#0085C7'
            const lbl = ar?{'None':'لا يوجد','Screening':'فحص','Medical Certificate':'شهادة طبية'}[ms]||ms:ms
            return (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:12, height:12, borderRadius:'50%', background:col, flexShrink:0 }} />
                <span style={{ fontSize:14, fontWeight:600, color:col }}>{lbl}</span>
              </div>
            )
          })()}
        </Card>
      </div>
    </div>
  )
}
