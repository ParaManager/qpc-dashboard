import { useLang } from '../lib/LangContext.jsx'
import { initials, avColor } from '../lib/helpers'

export default function CoachDashboard({ coach, athletes, events, results, onNav }) {
  const { lang, tc } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  if (!coach) return (
    <div className="empty">
      <i className="ti ti-user-off" style={{ fontSize:32, marginBottom:8 }} />
      <div>{L('No coach profile linked to your account. Please contact the admin.', 'لا يوجد ملف مدرب مرتبط بحسابك. يرجى التواصل مع المسؤول.')}</div>
    </div>
  )

  const myAthletes   = (athletes||[]).filter(a => String(a.coach_id) === String(coach.id))
  const activeCount  = myAthletes.filter(a => a.status === 'Active').length
  const myAthleteIds = myAthletes.map(a => a.id)

  // upcoming events any of my athletes are registered for
  const upcomingEvents = (events||[])
    .filter(e => e.status === 'Upcoming' || e.status === 'Registration Open')
    .sort((a,b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 4)

  // recent results for my athletes
  const myResults = (results||[])
    .filter(r => myAthleteIds.includes(r.athlete_id))
    .sort((a,b) => new Date(b.date||0) - new Date(a.date||0))
    .slice(0, 5)

  const totalGold   = myAthletes.reduce((s, a) => s + (a.medals_gold   || 0), 0)
  const totalSilver = myAthletes.reduce((s, a) => s + (a.medals_silver || 0), 0)
  const totalBronze = myAthletes.reduce((s, a) => s + (a.medals_bronze || 0), 0)

  const SPORT_AR = {'Athletics':'ألعاب القوى','Swimming':'السباحة','Powerlifting':'رفع الأثقال','Boccia':'البوتشيا','Goalball':'كرة الهدف','Table Tennis':'تنس الطاولة','Special Olympics':'الأولمبياد الخاص','Shooting':'الرماية','Wheelchair Tennis':'تنس الكراسي المتحركة'}

  const Card = ({ title, icon, color='#009F6B', children, onClick }) => (
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
      {/* Banner */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24, padding:'20px 24px', background:'linear-gradient(135deg, #0a1f14 0%, #0d3320 100%)', borderRadius:16, color:'#fff' }}>
        <div style={{ width:64, height:64, borderRadius:'50%', background: coach.photo_url ? 'transparent' : '#009F6B', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, flexShrink:0, overflow:'hidden', border:'3px solid rgba(255,255,255,.2)' }}>
          {coach.photo_url
            ? <img src={coach.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center' }} />
            : initials(coach.name)
          }
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:20, fontWeight:700 }}>{ar&&coach.name_ar ? coach.name_ar : coach.name}</div>
          <div style={{ fontSize:13, opacity:.7, marginTop:2 }}>
            {ar ? (SPORT_AR[coach.sport]||coach.sport) : coach.sport}
            {coach.nationality ? ` · ${tc ? tc(coach.nationality) : coach.nationality}` : ''}
          </div>
          <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
            <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background: coach.status==='Active'?'#009F6B30':'rgba(255,255,255,.1)', color: coach.status==='Active'?'#4ade80':'rgba(255,255,255,.7)', border:`1px solid ${coach.status==='Active'?'#009F6B50':'rgba(255,255,255,.2)'}` }}>
              {ar ? {'Active':'نشط','Inactive':'غير نشط'}[coach.status]||coach.status : coach.status}
            </span>
            {coach.designation && (
              <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, background:'rgba(255,255,255,.1)', color:'rgba(255,255,255,.7)', border:'1px solid rgba(255,255,255,.2)' }}>
                {coach.designation}
              </span>
            )}
          </div>
        </div>
        {/* Athlete count */}
        <div style={{ textAlign:'center', flexShrink:0 }}>
          <div style={{ fontSize:32, fontWeight:700, color:'#4ade80' }}>{myAthletes.length}</div>
          <div style={{ fontSize:11, opacity:.6 }}>{L('Athletes','رياضيون')}</div>
        </div>
        {/* Total medals */}
        {(totalGold + totalSilver + totalBronze) > 0 && (
          <div style={{ textAlign:'center', flexShrink:0, borderLeft:'1px solid rgba(255,255,255,.15)', paddingLeft:20 }}>
            <div style={{ fontSize:32, fontWeight:700, color:'#f1c40f' }}>{totalGold + totalSilver + totalBronze}</div>
            <div style={{ fontSize:11, opacity:.6 }}>{L('Team Medals','ميداليات الفريق')}</div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
        {/* Medals */}
        <div style={{ background:'#f1c40f10', border:'1px solid #f1c40f30', borderRadius:14, padding:'16px' }}>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:600 }}>{L('Team Medals','ميداليات الفريق')}</div>
          <div style={{ display:'flex', justifyContent:'space-around' }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:22 }}>🥇</div>
              <div style={{ fontSize:22, fontWeight:700, color:'#f1c40f' }}>{totalGold}</div>
              <div style={{ fontSize:10, color:'var(--text3)' }}>{L('Gold','ذهب')}</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:22 }}>🥈</div>
              <div style={{ fontSize:22, fontWeight:700, color:'#aaa' }}>{totalSilver}</div>
              <div style={{ fontSize:10, color:'var(--text3)' }}>{L('Silver','فضة')}</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:22 }}>🥉</div>
              <div style={{ fontSize:22, fontWeight:700, color:'#cd7f32' }}>{totalBronze}</div>
              <div style={{ fontSize:10, color:'var(--text3)' }}>{L('Bronze','برونز')}</div>
            </div>
          </div>
        </div>
        {/* Squad status */}
        <div style={{ background:'#0085C710', border:'1px solid #0085C730', borderRadius:14, padding:'16px' }}>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:600 }}>{L('Squad Status','حالة الفريق')}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {[
              ['#009F6B', L('Active','نشط'),   myAthletes.filter(a => a.status === 'Active').length],
              ['#EE334E', L('Injured','مصاب'),  myAthletes.filter(a => a.status === 'Injured').length],
              ['#9aa3b2', L('Inactive','غير نشط'), myAthletes.filter(a => a.status !== 'Active' && a.status !== 'Injured').length],
            ].map(([color, label, count]) => (
              <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
                  <span style={{ color:'var(--text2)' }}>{label}</span>
                </div>
                <span style={{ fontWeight:700, color }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Upcoming events */}
        <div style={{ background:'#8b5cf610', border:'1px solid #8b5cf630', borderRadius:14, padding:'16px', textAlign:'center', cursor: upcomingEvents.length > 0 ? 'pointer' : 'default' }}
          onClick={() => upcomingEvents.length > 0 && onNav('events')}>
          <div style={{ fontSize:36 }}>📅</div>
          <div style={{ fontSize:28, fontWeight:700, color:'#8b5cf6' }}>{upcomingEvents.length}</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>{L('Upcoming Events','الفعاليات القادمة')}</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {/* My Athletes */}
        <Card title={L('My Athletes','رياضيّوي')} icon="ti-run" color="#009F6B"
          onClick={myAthletes.length > 0 ? () => onNav('athletes') : null}>
          {myAthletes.length === 0
            ? <div className="empty" style={{ padding:'8px 0', fontSize:13 }}>{L('No athletes assigned','لا يوجد رياضيون معينون')}</div>
            : myAthletes.slice(0, 5).map(a => (
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background: a.photo_url ? 'transparent' : avColor(a.id), display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0, overflow:'hidden', border:'2px solid var(--border)' }}>
                  {a.photo_url
                    ? <img src={a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center' }} />
                    : initials(a.name)
                  }
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ar&&a.name_ar ? a.name_ar : a.name}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{ar ? (SPORT_AR[a.sport]||a.sport) : a.sport} · {a.classification}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:10,
                  background: a.status==='Active'?'#009F6B20':'#9aa3b220',
                  color:       a.status==='Active'?'#009F6B':'#9aa3b2' }}>
                  {ar?{'Active':'نشط','Inactive':'غير نشط','Injured':'مصاب'}[a.status]||a.status:a.status}
                </span>
              </div>
            ))
          }
          {myAthletes.length > 5 && (
            <div style={{ fontSize:12, color:'var(--text3)', textAlign:'center', marginTop:8 }}>
              +{myAthletes.length - 5} {L('more','آخرون')}
            </div>
          )}
        </Card>

        {/* Quick stats */}
        <Card title={L('Overview','نظرة عامة')} icon="ti-chart-bar" color="#8b5cf6">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              [L('Total athletes','إجمالي الرياضيين'), myAthletes.length],
              [L('Active','نشط'), myAthletes.filter(a => a.status === 'Active').length],
              [L('Injured','مصاب'), myAthletes.filter(a => a.status === 'Injured').length],
              [L('Total results recorded','إجمالي النتائج'), (results||[]).filter(r => myAthleteIds.includes(r.athlete_id)).length],
              [L('🥇 Gold medals','🥇 ذهب'), totalGold],
              [L('🥈 Silver medals','🥈 فضة'), totalSilver],
              [L('🥉 Bronze medals','🥉 برونز'), totalBronze],
            ].map(([label, val]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                <span style={{ color:'var(--text2)' }}>{label}</span>
                <span style={{ fontWeight:600 }}>{val}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming Events */}
        <Card title={L('Upcoming Events','الفعاليات القادمة')} icon="ti-calendar-event" color="#0085C7"
          onClick={upcomingEvents.length > 0 ? () => onNav('events') : null}>
          {upcomingEvents.length === 0
            ? <div className="empty" style={{ padding:'8px 0', fontSize:13 }}>{L('No upcoming events','لا توجد فعاليات قادمة')}</div>
            : upcomingEvents.map(ev => (
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

        {/* Top medal earners */}
        <Card title={L('Top Medal Earners','أكثر الرياضيين تتويجاً')} icon="ti-trophy" color="#f1c40f">
          {myAthletes.length === 0
            ? <div className="empty" style={{ padding:'8px 0', fontSize:13 }}>{L('No athletes yet','لا يوجد رياضيون بعد')}</div>
            : [...myAthletes]
                .sort((a,b) => ((b.medals_gold||0)+(b.medals_silver||0)+(b.medals_bronze||0)) - ((a.medals_gold||0)+(a.medals_silver||0)+(a.medals_bronze||0)))
                .filter(a => (a.medals_gold||0)+(a.medals_silver||0)+(a.medals_bronze||0) > 0)
                .slice(0, 5)
                .map(a => {
                  const total = (a.medals_gold||0)+(a.medals_silver||0)+(a.medals_bronze||0)
                  return (
                    <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background: a.photo_url?'transparent':avColor(a.id), display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0, overflow:'hidden' }}>
                        {a.photo_url ? <img src={a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : initials(a.name)}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ar&&a.name_ar?a.name_ar:a.name}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>
                          {a.medals_gold||0}🥇 {a.medals_silver||0}🥈 {a.medals_bronze||0}🥉
                        </div>
                      </div>
                      <span style={{ fontWeight:700, color:'#f1c40f', fontSize:15 }}>{total}</span>
                    </div>
                  )
                })
          }
          {myAthletes.every(a => (a.medals_gold||0)+(a.medals_silver||0)+(a.medals_bronze||0) === 0) && myAthletes.length > 0 && (
            <div className="empty" style={{ padding:'8px 0', fontSize:13 }}>{L('No medals recorded yet','لا توجد ميداليات مسجلة بعد')}</div>
          )}
        </Card>
      </div>
    </div>
  )
}
