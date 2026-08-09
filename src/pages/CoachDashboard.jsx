import { useState, useEffect } from 'react'
import { useLang } from '../lib/LangContext.jsx'
import { supabase } from '../lib/supabase'
import { Avatar, MedalDisplay, statusClass, statusDot, DashRow, SPORT_META, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, sportLabel, initials, effectiveStatus, getCurrentSeason, computeSportsBreakdown } from '../lib/helpers'
import DashboardBanners from '../components/DashboardBanners'
import { formatDateWithDay } from './Timetable'
import { computeEventStatus } from './Events'

// Mirrors Dashboard.jsx's getEventStatus exactly, so Active Events /
// Upcoming Events use identical logic to the Admin dashboard.
function getEventStatus(ev) {
  if (ev.approval_status === 'Rejected') return 'Canceled'
  if (ev.status === 'Canceled') return 'Canceled'
  return computeEventStatus(ev.start_date, ev.end_date, ev.deadline)
}

export default function CoachDashboard({ coach, athletes, myAthletes: myAthletesProp, coaches, employees, referees, events, results, onNav, profile }) {
  const { lang, tx } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  if (!coach) return (
    <div className="empty">
      <i className="ti ti-user-off" style={{ fontSize:32, marginBottom:8 }} />
      <div>{L('No coach profile linked to your account. Please contact the admin.', 'لا يوجد ملف مدرب مرتبط بحسابك. يرجى التواصل مع المسؤول.')}</div>
    </div>
  )

  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [reminders, setReminders] = useState({ needsAttendance: [] })
  const [myPendingRequests, setMyPendingRequests] = useState(0)

  useEffect(() => {
    if (!coach?.id) return
    const today = new Date().toISOString().split('T')[0]
    supabase.from('training_sessions')
      .select('*')
      .eq('coach_id', String(coach.id))
      .gte('session_date', today)
      .order('session_date').order('start_time')
      .limit(5)
      .then(({ data }) => setUpcomingSessions(data || []))
  }, [coach?.id])

  // Pending Requests KPI — scoped strictly to this coach's own submissions
  // (request_submissions.submitted_by === profile.id), mirroring exactly
  // how Requests.jsx itself identifies "my" requests. Fetched separately
  // from the app-wide pending count Admin uses, since that one has no
  // per-submitter breakdown.
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('request_submissions').select('status').eq('submitted_by', profile.id)
      .then(({ data }) => setMyPendingRequests((data || []).filter(s => s.status === 'pending').length))
  }, [profile?.id])

  useEffect(() => {
    if (!coach?.id) return
    const today = new Date().toISOString().split('T')[0]
    ;(async () => {
      // Only today's sessions — attendance is taken day-of, there's no concept of
      // "closing" sessions or chasing a backlog anymore. Anything older is handled
      // by opening that specific session directly from Schedule.
      const { data: todaysSessions } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('coach_id', String(coach.id))
        .eq('session_date', today)

      if (!todaysSessions?.length) { setReminders({ needsAttendance: [] }); return }

      const sessionIds = todaysSessions.map(s => s.id)
      const { data: attRows } = await supabase
        .from('attendance')
        .select('session_id')
        .in('session_id', sessionIds)

      const sessionsWithAttendance = new Set((attRows || []).map(r => r.session_id))
      const needsAttendance = todaysSessions.filter(s => !sessionsWithAttendance.has(s.id))

      setReminders({ needsAttendance })

      // Mirror this reminder into the notifications table so it also shows on the
      // full Notifications page and in the bell, not just here on the dashboard.
      if (profile?.id) {
        const { data: existing } = await supabase
          .from('notifications')
          .select('id, type, data')
          .eq('user_id', String(profile.id))
          .eq('type', 'needs_attendance')

        const existingKeys = new Set((existing || []).map(n => `${n.type}:${n.data?.session_id}`))

        const toInsert = []
        needsAttendance.forEach(s => {
          const key = `needs_attendance:${s.id}`
          if (!existingKeys.has(key)) {
            toInsert.push({
              user_id: profile.id, type: 'needs_attendance', read: false,
              title: L('Session needs attendance','جلسة بحاجة لتسجيل الحضور'),
              body: s.title || s.session_date,
              data: { session_id: s.id },
            })
          }
        })
        if (toInsert.length > 0) await supabase.from('notifications').insert(toInsert)

        // Clean up notifications for sessions that are no longer pending
        // (attendance taken since, or no longer today)
        const stillPendingIds = needsAttendance.map(s => s.id)
        const idsToDelete = (existing || [])
          .filter(n => {
            const sid = n.data?.session_id
            return sid && !stillPendingIds.includes(sid)
          })
          .map(n => n.id)
        if (idsToDelete.length > 0) await supabase.from('notifications').delete().in('id', idsToDelete)
      }
    })()
  }, [coach?.id])

  // Resync excuse/reschedule request notifications: keep firing while still pending,
  // remove once approved/rejected (so deleting one re-appears if it's still unresolved).
  useEffect(() => {
    if (!coach?.id || !profile?.id) return
    ;(async () => {
      const { data: pendingRequests } = await supabase
        .from('training_session_requests')
        .select('*')
        .eq('coach_id', String(coach.id))
        .eq('status', 'pending')

      const { data: existing } = await supabase
        .from('notifications')
        .select('id, data')
        .eq('user_id', String(profile.id))
        .eq('type', 'excuse_request')

      const existingSessionRequestIds = new Set((existing || []).map(n => n.data?.request_id).filter(Boolean))
      const pendingIds = (pendingRequests || []).map(r => r.id)

      const toInsert = (pendingRequests || [])
        .filter(r => !existingSessionRequestIds.has(r.id))
        .map(r => ({
          user_id: profile.id, type: 'excuse_request', read: false,
          title: L('New excuse/reschedule request','طلب عذر/إعادة جدولة جديد'),
          body: r.type === 'excuse' ? L('Excuse request','طلب عذر') : L('Reschedule request','طلب إعادة جدولة'),
          data: { session_id: r.session_id, request_id: r.id },
        }))
      if (toInsert.length > 0) await supabase.from('notifications').insert(toInsert)

      const idsToDelete = (existing || [])
        .filter(n => n.data?.request_id && !pendingIds.includes(n.data.request_id))
        .map(n => n.id)
      if (idsToDelete.length > 0) await supabase.from('notifications').delete().in('id', idsToDelete)
    })()
  }, [coach?.id, profile?.id])

  const allAthletes = athletes || []
  const myAthletes = (myAthletesProp && myAthletesProp.length ? myAthletesProp : allAthletes.filter(a => String(a.coach_id) === String(coach.id)))
    .slice()
    .sort((a,b) => { if (a.status==='Active' && b.status!=='Active') return -1; if (a.status!=='Active' && b.status==='Active') return 1; return 0 })
  const myAthleteIds = myAthletes.map(a => a.id)

  // Active Events / Upcoming Events — identical logic + source data to the
  // Admin dashboard (system-wide, not filtered to this coach).
  const activeEventsCount = (events||[]).filter(e => {
    const st = getEventStatus(e)
    return e.approval_status === 'Approved' && (st === 'Upcoming' || st === 'In Progress')
  }).length
  const upcomingEvents = (events||[])
    .filter(e => {
      const st = getEventStatus(e)
      return e.approval_status === 'Approved' && st === 'Upcoming'
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 4)

  // Sports catalog + athlete_sports — same multi-sport source of truth the
  // Sports page uses, so this dashboard and that page can never disagree.
  const [sportsCatalog, setSportsCatalog] = useState([])
  const [athleteSportRows, setAthleteSportRows] = useState([])
  useEffect(() => {
    supabase.from('sports').select('id, name, category, status').then(({ data, error }) => { if (!error) setSportsCatalog(data || []) })
    supabase.from('athlete_sports').select('athlete_id, sport_id').then(({ data, error }) => { if (!error) setAthleteSportRows(data || []) })
  }, [])

  // Sports breakdown — unique athletes per sport, from athlete_sports (an
  // athlete in multiple sports counts once in each), never athletes.sport.
  const sportEntries = computeSportsBreakdown(sportsCatalog, athleteSportRows)
  // Active Sports KPI — counts sports.status==='Active' directly, not
  // "sports with at least one athlete."
  const activeSportsCount = sportsCatalog.filter(s => s.status === 'Active').length

  const totalGold   = myAthletes.reduce((s, a) => s + (a.medals_gold   || 0), 0)
  const totalSilver = myAthletes.reduce((s, a) => s + (a.medals_silver || 0), 0)
  const totalBronze = myAthletes.reduce((s, a) => s + (a.medals_bronze || 0), 0)

  const coachStatus = effectiveStatus(coach)

  const kpiCards = [
    { label: L('Total Athletes','إجمالي الرياضيين'), val: allAthletes.length, hint: L('system-wide','على مستوى النظام'), color:'#0085C7', icon:'ti-users', click: () => onNav('athletes-all') },
    { label: L('My Athletes','الرياضيون المسندون إليّ'), val: myAthletes.length, hint: L('assigned to me','معينون لي'), color:'#009F6B', icon:'ti-run', click: () => onNav('athletes') },
    { label: tx('nav.coaches','Coaches'), val: (coaches||[]).length, hint: L('all coaches','كل المدربين'), color:'#0d9488', icon:'ti-user-star', click: () => onNav('coaches') },
    { label: tx('nav.employees','Staff'), val: (employees||[]).length, hint: tx('employees.employee','staff'), color:'#8b5cf6', icon:'ti-id-badge-2', click: () => onNav('employees') },
    { label: tx('nav.referees','Referees'), val: (referees||[]).length, hint: tx('nav.referees','officials'), color:'#f59e0b', icon:'ti-flag-2', click: () => onNav('referees') },
    { label: tx('dashboard.sports','Sports'), val: activeSportsCount, hint: tx('filters.all','in use'), color:'#EE334E', icon:'ti-ball-football', click: () => onNav('sports') },
    { label: tx('dashboard.activeEvents','Active Events'), val: activeEventsCount, hint: tx('dashboard.activeEventsHint','Upcoming & in progress'), color:'#0085C7', icon:'ti-calendar-event', click: () => onNav('events') },
    { label: tx('dashboard.pendingRequests','Pending Requests'), val: myPendingRequests, hint: L('mine','خاصة بي'), color:'#d97706', icon:'ti-clipboard-text', click: () => onNav('requests') },
  ]

  return (
    <div>
      {/* ── Hero Banner — same component/style as Admin, with coach-specific extras (photo, sport, effective status) ── */}
      <div style={{
        position: 'relative', borderRadius: 18, overflow: 'hidden', marginBottom: 14,
        minHeight: 140, display: 'flex', alignItems: 'center',
        background: '#1a0a14',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/dashboard-banner.jpg)', backgroundSize: 'cover', backgroundPosition: 'center center', opacity: 1 }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: ar
            ? 'linear-gradient(to left, rgba(10,5,15,0.85) 0%, rgba(10,5,15,0.55) 40%, rgba(10,5,15,0.05) 65%)'
            : 'linear-gradient(to right, rgba(10,5,15,0.80) 0%, rgba(10,5,15,0.55) 40%, rgba(10,5,15,0.05) 65%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '18px 28px', flex: 1, display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background: coach.photo_url ? 'transparent' : '#009F6B', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, fontWeight:700, color:'#fff', flexShrink:0, overflow:'hidden', border:'3px solid rgba(255,255,255,.2)' }}>
            {coach.photo_url
              ? <img src={coach.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center' }} />
              : initials(coach.name)
            }
          </div>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 6, fontWeight: 500 }}>
              {tx('dashboard.welcomeBack','Welcome back,')}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-.02em', marginBottom: 3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {(ar && coach.name_ar ? coach.name_ar : coach.name)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginBottom: 10 }}>
              {L('Coach','مدرب')}
              {coach.sport && <span> · {sportLabel(coach.sport, coach.sport_category, ar)}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap:'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EE334E' }} />
                <span style={{ fontSize: 11.5, color: '#EE334E', fontWeight: 600 }}>
                  {tx('nav.season','Season')} <span dir="ltr">{getCurrentSeason()}</span>
                </span>
              </div>
              <span className={`badge ${statusClass(coachStatus)}`} style={{ fontSize:11 }}>
                {ar ? ({'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Retired':'متقاعد'}[coachStatus]||coachStatus) : coachStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Reminders & notifications */}
      <DashboardBanners
        profile={profile}
        onNav={onNav}
        extraBanners={[
          ...(reminders.needsAttendance.length > 0 ? [{
            key: 'needsAttendance', color: '#f59e0b', icon: 'ti-alert-circle',
            title: reminders.needsAttendance.length === 1
              ? L('1 session needs attendance', 'جلسة واحدة بحاجة لتسجيل الحضور')
              : L(`${reminders.needsAttendance.length} sessions need attendance`, `${reminders.needsAttendance.length} جلسات بحاجة لتسجيل الحضور`),
            sub: reminders.needsAttendance.slice(0,3).map(s => s.title || s.session_date).join(', ') + (reminders.needsAttendance.length > 3 ? '…' : ''),
            actionLabel: L('Take attendance','تسجيل الحضور'),
            items: reminders.needsAttendance.map(s => ({
              label: `${s.title || s.session_date} (${s.session_date})`,
              onSelect: () => onNav('attendance', { sessionId: s.id }),
            })),
          }] : []),
        ]}
      />

      {/* ── KPI Cards — same .kpi-grid/.kpi-card styling as Admin ── */}
      <div className="kpi-grid">
        {kpiCards.map(({ label, val, hint, color, icon, click }) => (
          <div key={label} className="kpi-card" onClick={click}>
            <div className="kpi-icon" style={{ background: color + '18' }}>
              <i className={`ti ${icon}`} style={{ color, fontSize: 16 }} />
            </div>
            <div className="kpi-body">
              <div className="kpi-label">{label}</div>
              <div className="kpi-val" style={{ color }}>{val}</div>
              <div className="kpi-hint">{hint}</div>
            </div>
            <i className="ti ti-chevron-right kpi-arrow" />
          </div>
        ))}
      </div>

      {/* ── Upcoming Events / Upcoming Sessions — same .two-col/.card styling as Admin ── */}
      <div className="two-col">
        <div className="card">
          <div className="card-title"><i className="ti ti-calendar-event" /> {tx('dashboard.upcomingEvents','Upcoming events')}</div>
          {upcomingEvents.map(ev => {
            const evStatus = getEventStatus(ev)
            return (
              <DashRow key={ev.id} onClick={() => onNav('events', { eventId: ev.id })}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:statusDot(evStatus), flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13 }}>{ar && ev.name_ar ? ev.name_ar : ev.name}</span>
                <span style={{ fontSize:11, color:'#9aa3b2' }}>{ev.start_date}</span>
                <span className={`badge ${statusClass(evStatus)}`}>{evStatus}</span>
              </DashRow>
            )
          })}
          {upcomingEvents.length === 0 && <div className="empty">{tx('dashboard.noUpcomingEvents','No upcoming events')}</div>}
        </div>

        <div className="card">
          <div className="card-title"><i className="ti ti-calendar-time" /> {L('Upcoming Sessions','الجلسات القادمة')}</div>
          {upcomingSessions.map(s => (
            <DashRow key={s.id} onClick={() => onNav('schedule', { sessionId: s.id })}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#8b5cf6', flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</div>
                <div style={{ display:'flex', gap:8, fontSize:11, color:'var(--text3)', flexWrap:'wrap', marginTop:1 }}>
                  <span>{formatDateWithDay(s.session_date, ar)}</span>
                  {s.start_time && <span>{s.start_time}{s.end_time ? ` → ${s.end_time}` : ''}</span>}
                  {s.location && <span>{s.location}</span>}
                </div>
              </div>
              <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:8, background:'#8b5cf620', color:'#8b5cf6', flexShrink:0 }}>
                {s.session_type || L('Training','تدريب')}
              </span>
            </DashRow>
          ))}
          {upcomingSessions.length === 0 && <div className="empty">{L('No upcoming sessions','لا توجد جلسات قادمة')}</div>}
        </div>
      </div>

      {/* ── My Athletes — same .two-col/.card styling as Admin, limited list + View all ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-title">
          <i className="ti ti-run" /> {L('My Athletes','الرياضيون المسندون إليّ')} ({myAthletes.length})
        </div>
        {myAthletes.slice(0, 6).map(a => (
          <DashRow key={a.id} onClick={() => onNav('athletes', { athleteId: a.id })}>
            <Avatar name={a.name} id={a.id} size={30} fs={10} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ar && a.name_ar ? a.name_ar : a.name}</div>
              <div style={{ fontSize:11, color:'#9aa3b2' }}>{a.sport ? sportLabel(a.sport, a.sport_category, ar) : ''} · {a.classification}</div>
            </div>
            <MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} />
            <span className={`badge ${statusClass(effectiveStatus(a))}`}>{ar ? ({'Active':'نشط','Inactive':'غير نشط','Injured':'مصاب','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Under Medical Review':'تحت المراجعة الطبية','Suspended':'موقوف','Retired':'متقاعد'}[effectiveStatus(a)]||effectiveStatus(a)) : effectiveStatus(a)}</span>
          </DashRow>
        ))}
        {myAthletes.length === 0 && <div className="empty">{L('No athletes assigned','لا يوجد رياضيون معينون')}</div>}
        {myAthletes.length > 6 && (
          <div style={{ textAlign:'center', marginTop:10 }}>
            <span onClick={() => onNav('athletes')} style={{ fontSize:12, fontWeight:600, color:'#0085C7', cursor:'pointer' }}>
              {L('View all athletes','عرض جميع الرياضيين')} {ar ? '←' : '→'}
            </span>
          </div>
        )}
        {(totalGold + totalSilver + totalBronze) > 0 && (
          <div style={{ display:'flex', justifyContent:'center', gap:16, marginTop:12, paddingTop:10, borderTop:'1px solid var(--border)', fontSize:12, color:'var(--text3)' }}>
            <span>🥇 {totalGold}</span>
            <span>🥈 {totalSilver}</span>
            <span>🥉 {totalBronze}</span>
          </div>
        )}
      </div>

      {/* ── Sports Breakdown — identical to Admin ── */}
      <div className="card">
        <div className="card-title">
          <i className="ti ti-ball-football" /> {tx('dashboard.sportsBreakdown','Sports breakdown')}
          <span style={{ fontSize:10, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0, marginLeft:4 }}>— {tx('dashboard.clickToExplore','click to explore')}</span>
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
                  <div key={`${category}-${s}`} className="sport-chip"
                    onClick={() => onNav('sports', { sport: s, category })}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=meta.color; e.currentTarget.style.background=meta.color+'12' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.background='' }}>
                    <div style={{ fontSize:18 }}><i className={`ti ${meta.icon}`} style={{ color:meta.color }} /></div>
                    <div className="sport-label">{sportLabel(s, category, lang==='ar')}</div>
                    <div className="sport-stat">{count} {ar ? 'رياضي' : 'athletes'} · {pct}%</div>
                  </div>
                )
              })}
            </div>
          )
        })()}
        <div style={{ textAlign:'center', marginTop:10 }}>
          <span onClick={() => onNav('sports')} style={{ fontSize:12, fontWeight:600, color:'#0085C7', cursor:'pointer' }}>
            {tx('dashboard.viewAllSports','View all sports')} {ar ? '←' : '→'}
          </span>
        </div>
      </div>
    </div>
  )
}
