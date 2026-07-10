import { useState, useRef, useEffect } from 'react'
import { Avatar, MedalDisplay, statusClass, statusDot, DashRow, SPORT_META, SPORTS, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, sportLabel, initials, getCurrentSeason, effectiveStatus, COACH_DESIGNATIONS } from '../lib/helpers'
import { useLang } from '../lib/LangContext.jsx'
import { toast } from '../components/Toast'
import DashboardBanners from '../components/DashboardBanners'

// Role label shown under the welcome name in the hero banner
function roleLabel(role, ar) {
  const map = { admin: ar?'مسؤول':'Administrator', coach: ar?'مدرب':'Coach', employee: ar?'موظف':'Employee', athlete: ar?'رياضي':'Athlete' }
  return map[role] || role
}

export default function Dashboard({ athletes, coaches, employees, referees, events, results, pendingRequestsCount, pendingAccountsCount, onNav, profile }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'

  // Pending Requests card can point to two different places (form
  // submissions vs. account sign-ups) — when both have pending items, a
  // small popover lets the person choose, same pattern already used by
  // DashboardBanners' own "which one?" picker.
  const [showPendingPicker, setShowPendingPicker] = useState(false)
  const pendingPickerRef = useRef(null)
  useEffect(() => {
    function handleOutsideClick(e) {
      if (pendingPickerRef.current && !pendingPickerRef.current.contains(e.target)) setShowPendingPicker(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])
  const active   = athletes.filter(a => a.status === 'Active').length
  const upcoming = events.filter(e => e.status === 'Upcoming' || e.status === 'Registration Open').length

  const leaders = [...athletes]
    .sort((a, b) => (b.medals_gold*3+b.medals_silver*2+b.medals_bronze) - (a.medals_gold*3+a.medals_silver*2+a.medals_bronze))
    .filter(a => (a.medals_gold+a.medals_silver+a.medals_bronze) > 0)
    .slice(0, 5)

  // ── Away status — hoisted here so the same count can back the "Away" KPI
  // card too, instead of recalculating it in two places. Uses the real
  // effectiveStatus() (rule 6's single source of truth) directly instead of
  // a separately reimplemented check, so both the "not started yet" (rule 1)
  // and "already ended" (rule 3) cases are handled correctly and can't drift
  // out of sync with how every other page decides who's away. Only these
  // three statuses count as "away" — other non-Active statuses (Inactive,
  // Injured, Under Medical Review, Suspended, Retired) are not temporary
  // absences and must not be counted here. ──
  const AWAY_STATUSES = ['On Leave', 'In Competition', 'In Training Camp']
  const awayAthletes = athletes.filter(a => AWAY_STATUSES.includes(effectiveStatus(a)))
  const awayCoaches  = coaches.filter(c => AWAY_STATUSES.includes(effectiveStatus(c)))
  // Plain (non coach-type) employees can now also carry temporary statuses.
  // Coach-type employees are excluded here since their real status already
  // comes from the coaches table and is already counted via awayCoaches —
  // including them again here would double-count the same person.
  const awayEmployees = (employees || []).filter(e =>
    !COACH_DESIGNATIONS.includes(e.designation) && AWAY_STATUSES.includes(effectiveStatus(e))
  )
  const allAway = [
    ...awayAthletes.map(a => ({ ...a, _type: ar ? 'رياضي' : 'Athlete' })),
    ...awayCoaches.map(c  => ({ ...c, _type: ar ? 'مدرب' : 'Coach', _isCoach: true })),
    ...awayEmployees.map(e => ({ ...e, _type: ar ? 'موظف' : 'Employee', _isEmployee: true })),
  ]

  // ── Sports in use — same source data the Sports Breakdown section below
  // uses, reused here for the "Sports" KPI card count. ──
  const sportEntries = SPORT_CATEGORIES.flatMap(category =>
    (SPORTS_BY_CATEGORY[category] || []).map(s => ({
      sport: s, category,
      count: athletes.filter(a => a.sport === s && (a.sport_category === category || !a.sport_category)).length,
    }))
  ).filter(e => e.count > 0)

  const kpiCards = [
    { label: tx('dashboard.totalAthletes','Total Athletes'), val: athletes.length, hint: `${active} ${ar ? 'نشط' : 'active'}`, color: '#0085C7', icon: 'ti-users', click: () => onNav('athletes', { statusFilter:'Active' }) },
    { label: tx('nav.coaches','Coaches'), val: coaches.length, hint: `${[...new Set(coaches.map(c=>c.sport))].length} ${ar ? 'رياضة' : 'sports'}`, color: '#009F6B', icon: 'ti-whistle', click: () => onNav('coaches') },
    { label: tx('nav.employees','Employees'), val: employees.length, hint: ar ? 'الموظفون' : 'staff', color: '#8b5cf6', icon: 'ti-id-badge-2', click: () => onNav('employees') },
    { label: tx('nav.referees','Referees'), val: referees.length, hint: ar ? 'الحكام' : 'officials', color: '#f59e0b', icon: 'ti-flag-2', click: () => onNav('referees') },
    { label: tx('dashboard.sports','Sports'), val: sportEntries.length, hint: ar ? 'قيد الاستخدام' : 'in use', color: '#0d9488', icon: 'ti-ball-football', click: () => onNav('sports') },
    { label: tx('dashboard.activeEvents','Active Events'), val: upcoming, hint: ar ? 'قادمة' : 'upcoming', color: '#EE334E', icon: 'ti-calendar-event', click: () => onNav('events', { statusFilter:'Upcoming' }) },
    { label: ar ? 'خارج المقر' : 'Away', val: allAway.length, hint: ar ? 'إجازة/معسكر/منافسة' : 'leave/camp/comp.', color: '#f97316', icon: 'ti-map-pin-off',
      click: () => toast(ar ? 'إدارة الغياب قريباً' : 'Away Management is coming soon', 'error') },
    { isPending: true, label: tx('dashboard.pendingRequests','Pending Requests'), val: pendingRequestsCount + pendingAccountsCount,
      // Two genuinely different things both called "requests": form
      // submissions (Leave Request, Equipment Request, etc.) and account
      // sign-up approvals. The hint spells out both counts plainly. If only
      // one of them actually has anything pending, clicking goes straight
      // there — no need to ask when there's nothing to choose between. If
      // both do, clicking opens a small picker (same pattern as
      // DashboardBanners) so the person decides where to go instead of one
      // always silently winning over the other.
      hint: ar
        ? `${pendingRequestsCount} نماذج · ${pendingAccountsCount} تسجيل`
        : `${pendingRequestsCount} forms · ${pendingAccountsCount} sign-ups`,
      color: '#d97706', icon: 'ti-clipboard-text',
      click: () => {
        if (pendingRequestsCount > 0 && pendingAccountsCount > 0) setShowPendingPicker(v => !v)
        else if (pendingRequestsCount > 0) onNav('requests', { statusFilter:'pending' })
        else if (pendingAccountsCount > 0) onNav('users')
        // Both are 0 — nothing pending anywhere, so there's nowhere useful
        // to send them; do nothing rather than navigate to an empty list.
      } },
  ]

  return (
    <div>
      {/* ── Hero Banner (slightly shorter than before) ── */}
      <div style={{
        position: 'relative', borderRadius: 18, overflow: 'hidden', marginBottom: 14,
        minHeight: 140, display: 'flex', alignItems: 'center',
        background: '#1a0a14',
      }}>
        {/* Real QPC banner — athletes + Doha skyline */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url(/dashboard-banner.jpg)',
          backgroundSize: 'cover', backgroundPosition: 'center center',
          opacity: 1,
        }} />
        {/* Gradient overlay — lighter since the image's crimson left already gives text contrast */}
        <div style={{
          position: 'absolute', inset: 0,
          background: ar
            ? 'linear-gradient(to left, rgba(10,5,15,0.05) 0%, rgba(10,5,15,0.55) 40%, rgba(10,5,15,0.80) 60%)'
            : 'linear-gradient(to right, rgba(10,5,15,0.80) 0%, rgba(10,5,15,0.55) 40%, rgba(10,5,15,0.05) 65%)',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, padding: '18px 28px', flex: 1 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 6, fontWeight: 500 }}>
            {tx('dashboard.welcomeBack', 'Welcome back,')}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-.02em', marginBottom: 3 }}>
            {profile?.full_name || tx('roles.admin','Admin')}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginBottom: 10 }}>
            {roleLabel(profile?.role, ar)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#EE334E' }} />
            <span style={{ fontSize: 11.5, color: '#EE334E', fontWeight: 600 }}>
              {tx('nav.season','Season')} {getCurrentSeason()}
            </span>
          </div>
        </div>
      </div>

      <DashboardBanners profile={profile} onNav={onNav} />

      {/* ── 8 Compact KPI Cards ── */}
      <div className="kpi-grid">
        {kpiCards.map(({ label, val, hint, color, icon, click, isPending }) => (
          <div key={label} className="kpi-card" onClick={click}
            ref={isPending ? pendingPickerRef : undefined}
            // Only this card ever needs to show a popover below itself, so
            // only this one gets overflow:visible (inline style always wins
            // over the shared .kpi-card class rule) — every other card keeps
            // its normal clipped corners untouched.
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
          {events.filter(e => e.status !== 'Completed').slice(0, 4).map(ev => (
            <DashRow key={ev.id} onClick={() => onNav('events', { eventId: ev.id })}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:statusDot(ev.status), flexShrink:0 }} />
              <span style={{ flex:1, fontSize:13 }}>{ev.name}</span>
              <span style={{ fontSize:11, color:'#9aa3b2' }}>{ev.start_date}</span>
              <span className={`badge ${statusClass(ev.status)}`}>{ev.status}</span>
            </DashRow>
          ))}
          {events.filter(e => e.status !== 'Completed').length === 0 && <div className="empty">{tx('dashboard.noUpcomingEvents','No upcoming events')}</div>}
        </div>
        <div className="card">
          <div className="card-title"><i className="ti ti-medal" /> {tx('dashboard.medalLeaders','Medal leaders')}</div>
          {leaders.map(a => (
            <DashRow key={a.id} onClick={() => onNav('athletes', { athleteId: a.id })}>
              <Avatar name={a.name} id={a.id} size={28} fs={9} />
              <span style={{ flex:1, fontSize:13 }}>{a.name}</span>
              <MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} />
            </DashRow>
          ))}
          {leaders.length === 0 && <div className="empty">{tx('dashboard.noResults','No results yet')}</div>}
        </div>
      </div>

      {/* ── Sports Breakdown — now shows "X athletes · Y%" of total athletes ── */}
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
            {tx('dashboard.viewAllSports','View all sports')} →
          </span>
        </div>
      </div>
    </div>
  )
}
