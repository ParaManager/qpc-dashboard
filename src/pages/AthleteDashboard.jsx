import { useState, useEffect } from 'react'
import { useLang } from '../lib/LangContext.jsx'
import { supabase } from '../lib/supabase'
import { Avatar, DashRow, SPORT_META, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, sportLabel, initials, effectiveStatus, statusClass, statusDot, getCurrentSeason, computeSportsBreakdown, ClickablePhoto } from '../lib/helpers'
import { computeEventStatus } from './Events'

function getEventStatus(ev) {
  if (ev.approval_status === 'Rejected') return 'Canceled'
  if (ev.status === 'Canceled') return 'Canceled'
  return computeEventStatus(ev.start_date, ev.end_date, ev.deadline)
}

export default function AthleteDashboard({ athlete, athletes, coaches, employees, referees, sportsList = [], results, events, registrations, onNav, profile }) {
  const { lang, tx } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  if (!athlete) return (
    <div className="empty">
      <i className="ti ti-user-off" style={{ fontSize:32, marginBottom:8 }} />
      <div>{L('No athlete profile linked to your account. Please contact the admin.', 'لا يوجد ملف رياضي مرتبط بحسابك. يرجى التواصل مع المسؤول.')}</div>
    </div>
  )

  // My Sports — athlete_sports is the sole source of truth: every
  // assigned sport, its category (derived from the sport), and its coach.
  const [mySports, setMySports] = useState([])
  useEffect(() => {
    if (!athlete?.id) return
    supabase.from('athlete_sports')
      .select('id, sport_id, coach_id, sports(name, category), coaches(name, name_ar)')
      .eq('athlete_id', athlete.id)
      .then(({ data, error }) => { if (!error) setMySports(data || []) })
  }, [athlete?.id])

  // Upcoming Sessions — from the real training_session_athletes roster
  // junction (the same source Schedule.jsx uses for "my sessions"), not
  // just sport-matching, since a session's roster is specific per athlete.
  const [upcomingSessions, setUpcomingSessions] = useState([])
  useEffect(() => {
    if (!athlete?.id) return
    const today = new Date().toISOString().split('T')[0]
    supabase.from('training_session_athletes')
      .select('training_sessions(id, title, session_date, start_time, end_time, sport, location, session_type)')
      .eq('athlete_id', String(athlete.id))
      .then(({ data, error }) => {
        if (error) return
        const sessions = (data || [])
          .map(r => r.training_sessions)
          .filter(s => s && s.session_date >= today)
          .sort((a, b) => (a.session_date + (a.start_time||'')).localeCompare(b.session_date + (b.start_time||'')))
          .slice(0, 5)
        setUpcomingSessions(sessions)
      })
  }, [athlete?.id])

  // Competitions This Season — registered events within the current
  // season/upcoming, same source as before (registrations junction).
  const myEventIds = (registrations||[]).filter(r => String(r.athlete_id) === String(athlete.id)).map(r => r.event_id)
  const myEvents = (events||[]).filter(e => myEventIds.includes(e.id))

  // Upcoming Events — general system-wide upcoming QPC events, same
  // source/logic as the Coach/Staff dashboards. Not limited to events the
  // logged-in athlete is personally registered for.
  const myUpcomingEvents = (events||[])
    .filter(e => { const st = getEventStatus(e); return e.approval_status === 'Approved' && st === 'Upcoming' })
    .sort((a,b) => new Date(a.start_date) - new Date(b.start_date))

  const gold   = athlete.medals_gold   || 0
  const silver = athlete.medals_silver || 0
  const bronze = athlete.medals_bronze || 0

  const athleteStatus = effectiveStatus(athlete)

  const allAthletes = athletes || []

  // Sports catalog + athlete_sports — same multi-sport source of truth the
  // Sports page uses, so this dashboard and that page can never disagree.
  const [sportsCatalog, setSportsCatalog] = useState([])
  const [athleteSportRows, setAthleteSportRows] = useState([])
  useEffect(() => {
    supabase.from('sports').select('id, name, category, status').then(({ data, error }) => { if (!error) setSportsCatalog(data || []) })
    supabase.from('athlete_sports').select('athlete_id, sport_id').then(({ data, error }) => { if (!error) setAthleteSportRows(data || []) })
  }, [])

  // Sports Breakdown / Active Sports — system-wide, same source as
  // Admin/Coach/Staff dashboards (moved up so the KPI card below can use it).
  const sportEntries = computeSportsBreakdown(sportsCatalog, athleteSportRows)
  const activeSportsCount = sportsCatalog.filter(s => s.status === 'Active').length

  // Active Events — system-wide, same logic as Admin/Coach/Staff dashboards.
  const activeEventsCount = (events||[]).filter(e => {
    const st = getEventStatus(e)
    return e.approval_status === 'Approved' && (st === 'Upcoming' || st === 'In Progress')
  }).length

  const kpiCards = [
    { label: L('Total Athletes','إجمالي الرياضيين'), val: allAthletes.length, color:'#0085C7', icon:'ti-users' },
    { label: tx('nav.coaches','Coaches'), val: (coaches||[]).length, color:'#009F6B', icon:'ti-user-star' },
    { label: tx('nav.employees','Staff'), val: (employees||[]).length, color:'#8b5cf6', icon:'ti-id-badge-2' },
    { label: tx('nav.referees','Referees'), val: (referees||[]).length, color:'#f59e0b', icon:'ti-flag-2' },
    { label: L('Active Sports','الرياضات النشطة'), val: activeSportsCount, color:'#EE334E', icon:'ti-ball-football' },
    { label: tx('dashboard.activeEvents','Active Events'), val: activeEventsCount, color:'#0085C7', icon:'ti-calendar-event', click: () => onNav('events') },
  ]

  return (
    <div>
      {/* ── Hero Banner — same component/style as Admin/Coach/Staff ── */}
      <div style={{
        position: 'relative', borderRadius: 18, overflow: 'hidden', marginBottom: 14,
        minHeight: 140, display: 'flex', alignItems: 'center',
        background: '#1a0a14',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/dashboard-banner.jpg)', backgroundSize: 'cover', backgroundPosition: 'center center' }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: ar
            ? 'linear-gradient(to left, rgba(10,5,15,0.85) 0%, rgba(10,5,15,0.55) 40%, rgba(10,5,15,0.05) 65%)'
            : 'linear-gradient(to right, rgba(10,5,15,0.80) 0%, rgba(10,5,15,0.55) 40%, rgba(10,5,15,0.05) 65%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '18px 28px', flex: 1, display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background: athlete.photo_url ? 'transparent' : '#EE334E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, fontWeight:700, color:'#fff', flexShrink:0, overflow:'hidden', border:'3px solid rgba(255,255,255,.2)' }}>
            {athlete.photo_url
              ? <ClickablePhoto photoUrl={athlete.photo_url} alt={athlete.name}>
                  <img src={athlete.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center', cursor:'pointer' }} />
                </ClickablePhoto>
              : initials(athlete.name)
            }
          </div>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 6, fontWeight: 500 }}>
              {tx('dashboard.welcomeBack','Welcome back,')}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-.02em', marginBottom: 3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {(ar && athlete.name_ar ? athlete.name_ar : athlete.name)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginBottom: 10 }}>
              {L('Athlete','رياضي')}
              {athlete.classification && <span> · {athlete.classification}</span>}
              {mySports.length > 0 && <span> · {mySports.map(s => s.sports?.name).filter(Boolean).join(', ')}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap:'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EE334E' }} />
                <span style={{ fontSize: 11.5, color: '#EE334E', fontWeight: 600 }}>
                  {tx('nav.season','Season')} <span dir="ltr">{getCurrentSeason()}</span>
                </span>
              </div>
              <span className={`badge ${statusClass(athleteStatus)}`} style={{ fontSize:11 }}>
                {ar ? ({'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Injured':'مصاب','Under Medical Review':'تحت المراجعة الطبية','Suspended':'موقوف','Retired':'متقاعد'}[athleteStatus]||athleteStatus) : athleteStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="kpi-grid kpi-grid-3">
        {kpiCards.map(({ label, val, color, icon, click }) => (
          <div key={label} className="kpi-card" onClick={click} style={{ cursor: click ? 'pointer' : 'default' }}>
            <div className="kpi-icon" style={{ background: color + '18' }}>
              <i className={`ti ${icon}`} style={{ color, fontSize: 16 }} />
            </div>
            <div className="kpi-body">
              <div className="kpi-label">{label}</div>
              <div className="kpi-val" style={{ color }}>{val}</div>
            </div>
            {click && <i className="ti ti-chevron-right kpi-arrow" />}
          </div>
        ))}
      </div>

      {/* ── Upcoming Events / Upcoming Sessions ── */}
      <div className="two-col">
        <div className="card">
          <div className="card-title"><i className="ti ti-calendar-event" /> {tx('dashboard.upcomingEvents','Upcoming events')}</div>
          {myUpcomingEvents.slice(0, 4).map(ev => {
            const evStatus = getEventStatus(ev)
            return (
              <DashRow key={ev.id} onClick={() => onNav('events')}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:statusDot(evStatus), flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13 }}>{ar && ev.name_ar ? ev.name_ar : ev.name}</span>
                <span style={{ fontSize:11, color:'#9aa3b2' }}>{ev.start_date}</span>
              </DashRow>
            )
          })}
          {myUpcomingEvents.length === 0 && <div className="empty">{L('No upcoming events','لا توجد فعاليات قادمة')}</div>}
        </div>

        <div className="card">
          <div className="card-title"><i className="ti ti-calendar-time" /> {L('Upcoming Sessions','الجلسات القادمة')}</div>
          {upcomingSessions.map(s => (
            <DashRow key={s.id}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#8b5cf6', flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title || (s.sport ? sportLabel(s.sport, null, ar) : '')}</div>
                <div style={{ display:'flex', gap:8, fontSize:11, color:'var(--text3)', flexWrap:'wrap', marginTop:1 }}>
                  <span>{s.session_date}</span>
                  {s.start_time && <span>{s.start_time}{s.end_time ? ` → ${s.end_time}` : ''}</span>}
                  {s.sport && <span>{sportLabel(s.sport, null, ar)}</span>}
                </div>
              </div>
            </DashRow>
          ))}
          {upcomingSessions.length === 0 && <div className="empty">{L('No upcoming sessions','لا توجد جلسات قادمة')}</div>}
        </div>
      </div>

      {/* ── Sports Breakdown — identical to Admin/Coach/Staff ── */}
      <div className="card">
        <div className="card-title">
          <i className="ti ti-ball-football" /> {tx('dashboard.sportsBreakdown','Sports breakdown')}
        </div>
        {(() => {
          const topSports = [...sportEntries].sort((a,b) => b.count - a.count).slice(0, 8)
          if (topSports.length === 0) return <div className="empty" style={{ padding:16 }}>{tx('dashboard.noSportsYet','No athletes assigned to a sport yet')}</div>
          const totalAthletes = allAthletes.length
          return (
            <div className="sports-grid">
              {topSports.map(({ sport: s, category, count }) => {
                const meta = SPORT_META[s] || { icon:'ti-ball-football', color:'#0085C7' }
                const pct = totalAthletes > 0 ? Math.round((count / totalAthletes) * 100) : 0
                return (
                  <div key={`${category}-${s}`} className="sport-chip">
                    <div style={{ fontSize:18 }}><i className={`ti ${meta.icon}`} style={{ color:meta.color }} /></div>
                    <div className="sport-label">{sportLabel(s, category, ar)}</div>
                    <div className="sport-stat">{count} {ar ? 'رياضي' : 'athletes'} · {pct}%</div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
