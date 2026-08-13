import { useState, useEffect } from 'react'
import { useLang } from '../lib/LangContext.jsx'
import { supabase } from '../lib/supabase'
import { Avatar, MedalDisplay, statusClass, statusDot, DashRow, SPORT_META, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, sportLabel, initials, effectiveStatus, getCurrentSeason, computeSportsBreakdown, ClickablePhoto } from '../lib/helpers'
import { computeEventStatus } from './Events'

// Mirrors Dashboard.jsx's getEventStatus exactly, so Active Events /
// Upcoming Events use identical logic to the Admin dashboard.
function getEventStatus(ev) {
  if (ev.approval_status === 'Rejected') return 'Canceled'
  if (ev.status === 'Canceled') return 'Canceled'
  return computeEventStatus(ev.start_date, ev.end_date, ev.deadline)
}

export default function EmployeeDashboard({ employee, athletes, coaches, employees, referees, events, onNav, profile }) {
  const { lang, tx } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  if (!employee) return (
    <div className="empty">
      <i className="ti ti-user-off" style={{ fontSize:32, marginBottom:8 }} />
      <div>{L('No employee profile linked to your account. Please contact the admin.', 'لا يوجد ملف موظف مرتبط بحسابك. يرجى التواصل مع المسؤول.')}</div>
    </div>
  )

  const [upcomingMeetings, setUpcomingMeetings] = useState([])
  const [myPendingRequests, setMyPendingRequests] = useState(0)
  const [myOpenTasks, setMyOpenTasks] = useState(0)

  // Upcoming Meetings — only meetings where this employee is a verified
  // attendee (meeting_attendees.employee_id), never by name.
  useEffect(() => {
    if (!employee?.id) return
    const today = new Date().toISOString().split('T')[0]
    ;(async () => {
      const { data: attendeeRows } = await supabase
        .from('meeting_attendees')
        .select('meeting_id')
        .eq('employee_id', employee.id)
      const meetingIds = (attendeeRows || []).map(r => r.meeting_id)
      if (meetingIds.length === 0) { setUpcomingMeetings([]); return }
      const { data: meetings } = await supabase
        .from('meetings')
        .select('*')
        .in('id', meetingIds)
        .gte('meeting_date', today)
        .order('meeting_date').order('start_time')
        .limit(5)
      setUpcomingMeetings(meetings || [])
    })()
  }, [employee?.id])

  // Pending Requests KPI — scoped strictly to this employee's own
  // submissions (request_submissions.submitted_by === profile.id).
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('request_submissions').select('status').eq('submitted_by', profile.id)
      .then(({ data }) => setMyPendingRequests((data || []).filter(s => s.status === 'pending').length))
  }, [profile?.id])

  // My Tasks KPI — tasks assigned directly to this authenticated user,
  // not archived, not yet done.
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('tasks').select('status').eq('archived', false).eq('assigned_to', profile.id)
      .then(({ data }) => setMyOpenTasks((data || []).filter(t => t.status !== 'Done').length))
  }, [profile?.id])

  const allAthletes = athletes || []

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

  const sportEntries = computeSportsBreakdown(sportsCatalog, athleteSportRows)
  const activeSportsCount = sportsCatalog.filter(s => s.status === 'Active').length

  const employeeStatus = effectiveStatus(employee)

  const kpiCards = [
    { label: L('Total Athletes','إجمالي الرياضيين'), val: allAthletes.length, hint: L('system-wide','على مستوى النظام'), color:'#0085C7', icon:'ti-users', click: () => onNav('athletes-all') },
    { label: tx('nav.coaches','Coaches'), val: (coaches||[]).length, hint: L('all coaches','كل المدربين'), color:'#009F6B', icon:'ti-user-star', click: () => onNav('coaches') },
    { label: tx('nav.employees','Staff'), val: (employees||[]).length, hint: tx('employees.employee','staff'), color:'#8b5cf6', icon:'ti-id-badge-2', click: () => onNav('employees') },
    { label: tx('nav.referees','Referees'), val: (referees||[]).length, hint: tx('nav.referees','officials'), color:'#f59e0b', icon:'ti-flag-2', click: () => onNav('referees') },
    { label: tx('dashboard.sports','Sports'), val: activeSportsCount, hint: tx('filters.all','in use'), color:'#EE334E', icon:'ti-ball-football', click: () => onNav('sports') },
    { label: tx('dashboard.activeEvents','Active Events'), val: activeEventsCount, hint: tx('dashboard.activeEventsHint','Upcoming & in progress'), color:'#0085C7', icon:'ti-calendar-event', click: () => onNav('events') },
    { label: tx('dashboard.pendingRequests','Pending Requests'), val: myPendingRequests, hint: L('mine','خاصة بي'), color:'#d97706', icon:'ti-clipboard-text', click: () => onNav('requests') },
    { label: L('My Tasks','مهامي'), val: myOpenTasks, hint: L('assigned to me','مسندة إليّ'), color:'#8b5cf6', icon:'ti-checklist', click: () => onNav('tasks') },
  ]

  return (
    <div>
      {/* ── Hero Banner — same component/style as Admin/Coach ── */}
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
          <div style={{ width:56, height:56, borderRadius:'50%', background: employee.photo_url ? 'transparent' : '#8b5cf6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, fontWeight:700, color:'#fff', flexShrink:0, overflow:'hidden', border:'3px solid rgba(255,255,255,.2)' }}>
            {employee.photo_url
              ? <ClickablePhoto photoUrl={employee.photo_url} alt={employee.name}>
                  <img src={employee.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center', cursor:'pointer' }} />
                </ClickablePhoto>
              : initials(employee.name)
            }
          </div>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 6, fontWeight: 500 }}>
              {tx('dashboard.welcomeBack','Welcome back,')}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-.02em', marginBottom: 3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {(ar && employee.name_ar ? employee.name_ar : employee.name)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginBottom: 10 }}>
              {ar ? (employee.designation_ar || employee.designation || 'عضو كادر') : (employee.designation || 'Staff Member')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap:'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EE334E' }} />
                <span style={{ fontSize: 11.5, color: '#EE334E', fontWeight: 600 }}>
                  {tx('nav.season','Season')} <span dir="ltr">{getCurrentSeason()}</span>
                </span>
              </div>
              <span className={`badge ${statusClass(employeeStatus)}`} style={{ fontSize:11 }}>
                {ar ? ({'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','When needed':'عند الحاجة','External':'خارجي'}[employeeStatus]||employeeStatus) : employeeStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards — same .kpi-grid/.kpi-card styling as Admin/Coach ── */}
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

      {/* ── Upcoming Events / Upcoming Meetings — same .two-col/.card styling ── */}
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
          <div className="card-title"><i className="ti ti-users-group" /> {L('Upcoming Meetings','الاجتماعات القادمة')}</div>
          {upcomingMeetings.map(m => (
            <DashRow key={m.id} onClick={() => onNav('calendar')}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#8b5cf6', flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.title}</div>
                <div style={{ display:'flex', gap:8, fontSize:11, color:'var(--text3)', flexWrap:'wrap', marginTop:1 }}>
                  <span>{m.meeting_date}</span>
                  {m.start_time && <span>{m.start_time}{m.end_time ? ` → ${m.end_time}` : ''}</span>}
                </div>
              </div>
            </DashRow>
          ))}
          {upcomingMeetings.length === 0 && <div className="empty">{L('No upcoming meetings','لا توجد اجتماعات قادمة')}</div>}
        </div>
      </div>

      {/* ── Sports Breakdown — identical to Admin/Coach ── */}
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
