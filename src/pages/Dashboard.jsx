import { useState, useRef, useEffect } from 'react'
import { Avatar, MedalDisplay, statusClass, statusDot, DashRow, SPORT_META, SPORTS, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, sportLabel, initials, getCurrentSeason, computeAwayPeople } from '../lib/helpers'
import { useLang } from '../lib/LangContext.jsx'
import DashboardBanners from '../components/DashboardBanners'
import { computeEventStatus } from './Events'

// Derives effective display status — mirrors Events.jsx getEventStatus exactly.
function getEventStatus(ev) {
  if (ev.approval_status === 'Rejected') return 'Canceled'
  if (ev.status === 'Canceled') return 'Canceled'
  return computeEventStatus(ev.start_date, ev.end_date, ev.deadline)
}

function roleLabel(role, ar) {
  const map = { admin: ar?'مسؤول':'Administrator', coach: ar?'مدرب':'Coach', employee: ar?'موظف':'Employee', athlete: ar?'رياضي':'Athlete' }
  return map[role] || role
}

export default function Dashboard({ athletes, coaches, employees, referees, events, results, pendingRequestsCount, pendingAccountsCount, onNav, profile }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'

  const personNameAr = (() => {
    if (!profile?.person_id) return null
    const match =
      athletes.find(a => a.person_id === profile.person_id) ||
      coaches.find(c => c.person_id === profile.person_id) ||
      employees.find(e => e.person_id === profile.person_id)
    return match?.name_ar || null
  })()

  const [showPendingPicker, setShowPendingPicker] = useState(false)
  const pendingPickerRef = useRef(null)
  useEffect(() => {
    function handleOutsideClick(e) {
      if (pendingPickerRef.current && !pendingPickerRef.current.contains(e.target)) setShowPendingPicker(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const active = athletes.filter(a => a.status === 'Active').length

  // Active Events = Approved + (Upcoming OR In Progress), using effective status
  const activeEventsCount = events.filter(e => {
    const st = getEventStatus(e)
    return e.approval_status === 'Approved' && (st === 'Upcoming' || st === 'In Progress')
  }).length

  // Upcoming Events list: Approved + effective Upcoming, sorted soonest first
  const upcomingEvents = events
    .filter(e => {
      const st = getEventStatus(e)
      return e.approval_status === 'Approved' && st === 'Upcoming'
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 4)

  const leaders = [...athletes]
    .sort((a, b) => (b.medals_gold*3+b.medals_silver*2+b.medals_bronze) - (a.medals_gold*3+a.medals_silver*2+a.medals_bronze))
    .filter(a => (a.medals_gold+a.medals_silver+a.medals_bronze) > 0)
    .slice(0, 5)

  const { allAway } = computeAwayPeople(athletes, coaches, employees, lang)

  const sportEntries = SPORT_CATEGORIES.flatMap(category =>
    (SPORTS_BY_CATEGORY[category] || []).map(s => ({
      sport: s, category,
      count: athletes.filter(a => a.sport === s && (a.sport_category === category || !a.sport_category)).length,
    }))
  ).filter(e => e.count > 0)

  const kpiCards = [
    {
      label: tx('dashboard.totalAthletes','Total Athletes'),
      val: athletes.length,
      hint: `${active} ${tx('status.active','active')}`,
      color: '#0085C7', icon: 'ti-users',
      click: () => onNav('athletes', { statusFilter:'Active' }),
    },
    {
      label: tx('nav.coaches','Coaches'),
      val: coaches.length,
      hint: `${[...new Set(coaches.map(c=>c.sport))].length} ${tx('dashboard.sports','sports')}`,
      color: '#009F6B', icon: 'ti-whistle',
      click: () => onNav('coaches'),
    },
    {
      label: tx('nav.employees','Employees'),
      val: employees.length,
      hint: tx('employees.employee','staff'),
      color: '#8b5cf6', icon: 'ti-id-badge-2',
      click: () => onNav('employees'),
    },
    {
      label: tx('nav.referees','Referees'),
      val: referees.length,
      hint: tx('nav.referees','officials'),
      color: '#f59e0b', icon: 'ti-flag-2',
      click: () => onNav('referees'),
    },
    {
      label: tx('dashboard.sports','Sports'),
      val: sportEntries.length,
      hint: tx('filters.all','in use'),
      color: '#0d9488', icon: 'ti-ball-football',
      click: () => onNav('sports'),
    },
    {
      label: tx('dashboard.activeEvents','Active Events'),
      val: activeEventsCount,
      hint: tx('dashboard.activeEventsHint','Upcoming & in progress'),
      color: '#EE334E', icon: 'ti-calendar-event',
      click: () => onNav('events', { statusFilter:'Upcoming' }),
    },
    {
      label: tx('dashboard.away','Away'),
      val: allAway.length,
      hint: tx('dashboard.awayHint','leave/camp/comp.'),
      color: '#f97316', icon: 'ti-map-pin-off',
      click: () => onNav('away'),
    },
    {
      isPending: true,
      label: tx('dashboard.pendingRequests','Pending Requests'),
      val: pendingRequestsCount + pendingAccountsCount,
      hint: ar
        ? `${pendingRequestsCount} نماذج · ${pendingAccountsCount} تسجيل`
        : `${pendingRequestsCount} forms · ${pendingAccountsCount} sign-ups`,
      color: '#d97706', icon: 'ti-clipboard-text',
      click: () => {
        if (pendingRequestsCount > 0 && pendingAccountsCount > 0) setShowPendingPicker(v => !v)
        else if (pendingRequestsCount > 0) onNav('requests', { statusFilter:'pending' })
        else if (pendingAccountsCount > 0) onNav('users')
      },
    },
  ]

  return (
    <div>
      {/* ── Hero Banner ── */}
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
        <div style={{ position: 'relative', zIndex: 1, padding: '18px 28px', flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 6, fontWeight: 500 }}>
            {tx('dashboard.welcomeBack','Welcome back,')}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-.02em', marginBottom: 3 }}>
            {(ar ? (personNameAr || profile?.full_name) : profile?.full_name) || tx('roles.admin','Admin')}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginBottom: 10 }}>
            {roleLabel(profile?.role, ar)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EE334E' }} />
            <span style={{ fontSize: 11.5, color: '#EE334E', fontWeight: 600 }}>
              {tx('nav.season','Season')} <span dir="ltr">{getCurrentSeason()}</span>
            </span>
          </div>
        </div>
      </div>

      <DashboardBanners profile={profile} onNav={onNav} />

      {/* ── KPI Cards ── */}
      <div className="kpi-grid">
        {kpiCards.map(({ label, val, hint, color, icon, click, isPending }) => (
          <div key={label} className="kpi-card" onClick={click}
            ref={isPending ? pendingPickerRef : undefined}
            style={isPending ? { overflow: 'visible' } : undefined}>
            <div className="kpi-icon" style={{ background: color + '18' }}>
              <i className={`ti ${icon}`} style={{ color, fontSize: 16 }} />
            </div>
            <div className="kpi-body">
              <div className="kpi-label">{label}</div>
              <div className="kpi-val" style={{ color }}>{val}</div>
              <div className="kpi-hint">{hint}</div>
            </div>
            <i className="ti ti-chevron-right kpi-arrow" />

            {isPending && showPendingPicker && (
              <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,.15)', zIndex:30 }}
                onClick={e => e.stopPropagation()}>
                <div style={{ padding:'8px 14px', fontSize:11, fontWeight:600, color:'var(--text3)', borderBottom:'1px solid var(--border)' }}>
                  {ar ? 'أين تريد الذهاب؟' : 'Which one?'}
                </div>
                <div onClick={() => { setShowPendingPicker(false); onNav('requests', { statusFilter:'pending' }) }}
                  style={{ padding:'10px 14px', fontSize:13, cursor:'pointer', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <span>{ar ? `طلبات النماذج (${pendingRequestsCount})` : `Form Requests (${pendingRequestsCount})`}</span>
                  <i className="ti ti-arrow-right" style={{ fontSize:13, color:'var(--text3)', flexShrink:0 }} />
                </div>
                <div onClick={() => { setShowPendingPicker(false); onNav('users') }}
                  style={{ padding:'10px 14px', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <span>{ar ? `طلبات الحسابات (${pendingAccountsCount})` : `Account Sign-ups (${pendingAccountsCount})`}</span>
                  <i className="ti ti-arrow-right" style={{ fontSize:13, color:'var(--text3)', flexShrink:0 }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

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
          <div className="card-title"><i className="ti ti-medal" /> {tx('dashboard.medalLeaders','Medal leaders')}</div>
          {leaders.map(a => (
            <DashRow key={a.id} onClick={() => onNav('athletes', { athleteId: a.id })}>
              <Avatar name={a.name} id={a.id} size={28} fs={9} />
              <span style={{ flex:1, fontSize:13 }}>{ar && a.name_ar ? a.name_ar : a.name}</span>
              <MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} />
            </DashRow>
          ))}
          {leaders.length === 0 && <div className="empty">{tx('dashboard.noResults','No results yet')}</div>}
        </div>
      </div>

      {/* ── Sports Breakdown ── */}
      <div className="card">
        <div className="card-title">
          <i className="ti ti-ball-football" /> {tx('dashboard.sportsBreakdown','Sports breakdown')}
          <span style={{ fontSize:10, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0, marginLeft:4 }}>— {tx('dashboard.clickToExplore','click to explore')}</span>
        </div>
        {(() => {
          const topSports = sportEntries.sort((a,b) => b.count - a.count).slice(0, 8)
          if (topSports.length === 0) return <div className="empty" style={{ padding:16 }}>{tx('dashboard.noSportsYet','No athletes assigned to a sport yet')}</div>
          const totalAthletes = athletes.length
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
