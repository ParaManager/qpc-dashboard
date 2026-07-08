import { Avatar, MedalDisplay, statusClass, statusDot, DashRow, SPORT_META, SPORTS, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, sportLabel, initials, getCurrentSeason } from '../lib/helpers'
import { useLang } from '../lib/LangContext.jsx'
import { toast } from '../components/Toast'
import DashboardBanners from '../components/DashboardBanners'

// Role label shown under the welcome name in the hero banner
function roleLabel(role, ar) {
  const map = { admin: ar?'مسؤول':'Administrator', coach: ar?'مدرب':'Coach', employee: ar?'موظف':'Employee', athlete: ar?'رياضي':'Athlete' }
  return map[role] || role
}

export default function Dashboard({ athletes, coaches, employees, referees, events, results, pendingRequestsCount, onNav, profile }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'
  const active   = athletes.filter(a => a.status === 'Active').length
  const upcoming = events.filter(e => e.status === 'Upcoming' || e.status === 'Registration Open').length

  const leaders = [...athletes]
    .sort((a, b) => (b.medals_gold*3+b.medals_silver*2+b.medals_bronze) - (a.medals_gold*3+a.medals_silver*2+a.medals_bronze))
    .filter(a => (a.medals_gold+a.medals_silver+a.medals_bronze) > 0)
    .slice(0, 5)

  // ── Away status — hoisted here (was previously computed only inside the
  // Away section below) so the same count can back the "Away" KPI card too,
  // instead of recalculating it in two places. ──
  const AWAY_STATUSES = ['On Leave', 'In Competition', 'In Training Camp']
  const todayForAway = new Date(); todayForAway.setHours(0,0,0,0)
  function isEffectivelyAway(p) {
    if (!AWAY_STATUSES.includes(p.status)) return false
    if (!p.status_start) return true // no start date = immediate
    const start = new Date(p.status_start); start.setHours(0,0,0,0)
    return todayForAway >= start
  }
  const awayAthletes = athletes.filter(isEffectivelyAway)
  const awayCoaches  = coaches.filter(isEffectivelyAway)
  const allAway = [
    ...awayAthletes.map(a => ({ ...a, _type: ar ? 'رياضي' : 'Athlete' })),
    ...awayCoaches.map(c  => ({ ...c, _type: ar ? 'مدرب' : 'Coach', _isCoach: true })),
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
    { label: tx('dashboard.pendingRequests','Pending Requests'), val: pendingRequestsCount, hint: ar ? 'بانتظار المراجعة' : 'awaiting review', color: '#d97706', icon: 'ti-clipboard-text', click: () => onNav('requests', { statusFilter:'pending' }) },
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

      {/* ── Away / Out of Office Section (admin only) — reuses allAway computed above ── */}
      {(() => {
        const STATUS_COLOR  = { 'On Leave':'#f59e0b', 'In Competition':'#0085C7', 'In Training Camp':'#0d9488' }
        const STATUS_ICON   = { 'On Leave':'ti-beach', 'In Competition':'ti-trophy', 'In Training Camp':'ti-run' }
        const STATUS_AR     = { 'On Leave':'في إجازة', 'In Competition':'في منافسة', 'In Training Camp':'في معسكر تدريبي' }

        const today = todayForAway

        if (allAway.length === 0) return null

        function daysDiff(dateStr) {
          if (!dateStr) return null
          const d = new Date(dateStr); d.setHours(0,0,0,0)
          return Math.round((d - today) / 86400000)
        }

        function remainingLabel(days) {
          if (days === null) return null
          if (days < 0)  return ar ? `تأخر ${Math.abs(days)} يوم` : `${Math.abs(days)}d overdue`
          if (days === 0) return ar ? 'يعود اليوم' : 'Returns today'
          if (days === 1) return ar ? 'يعود غداً' : 'Returns tomorrow'
          return ar ? `${days} أيام متبقية` : `${days}d left`
        }

        function sinceLabel(days) {
          if (days === null) return null
          const abs = Math.abs(days)
          if (abs === 0) return ar ? 'غادر اليوم' : 'Left today'
          if (abs === 1) return ar ? 'منذ أمس' : 'Since yesterday'
          return ar ? `منذ ${abs} أيام` : `${abs}d ago`
        }

        function remainingColor(days) {
          if (days === null) return 'var(--text3)'
          if (days < 0)  return '#EE334E'
          if (days <= 2) return '#f59e0b'
          return '#009F6B'
        }

        return (
          <div className="card" style={{ marginBottom:14 }}>
            <div className="card-title">
              <i className="ti ti-map-pin-off" /> {ar ? 'خارج المقر' : 'Away'}
              <span style={{ fontSize:10, fontWeight:400, color:'var(--text3)', marginLeft:6 }}>
                {allAway.length} {ar ? 'شخص' : 'people'}
              </span>
            </div>

            {AWAY_STATUSES.map(status => {
              const group = allAway.filter(p => p.status === status)
              if (group.length === 0) return null
              const clr  = STATUS_COLOR[status]
              const icon = STATUS_ICON[status]
              const lbl  = ar ? STATUS_AR[status] : status
              return (
                <div key={status} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <div style={{ width:26, height:26, borderRadius:8, background:clr+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <i className={`ti ${icon}`} style={{ fontSize:13, color:clr }} />
                    </div>
                    <span style={{ fontWeight:600, fontSize:12.5, color:clr }}>{lbl}</span>
                    <span style={{ fontSize:11, color:'var(--text3)', background:'var(--surface2)', padding:'1px 8px', borderRadius:20 }}>{group.length}</span>
                  </div>
                  {group.map(p => {
                    const daysLeft  = daysDiff(p.status_end)
                    const daysGone  = p.status_start ? -daysDiff(p.status_start) : null
                    const remLabel  = remainingLabel(daysLeft)
                    const sncLabel  = sinceLabel(daysGone)
                    const remColor  = remainingColor(daysLeft)
                    const name      = ar && p.name_ar ? p.name_ar : p.name
                    return (
                      <DashRow key={p.id}
                        onClick={() => p._isCoach ? onNav('coaches', { coachId: p.id }) : onNav('athletes', { athleteId: p.id })}>
                        <Avatar name={p.name} id={p.id} size={28} fs={9} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</div>
                          <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:1, display:'flex', gap:6, flexWrap:'wrap' }}>
                            <span>{p._type}</span>
                            {p.status_start && <span>· {p.status_start}{p.status_end ? ` → ${p.status_end}` : ''}</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, flexShrink:0 }}>
                          {remLabel && (
                            <span style={{ fontSize:10.5, fontWeight:600, color:remColor, background:remColor+'18', padding:'2px 8px', borderRadius:20, whiteSpace:'nowrap' }}>
                              {remLabel}
                            </span>
                          )}
                          {sncLabel && (
                            <span style={{ fontSize:9.5, color:'var(--text3)', whiteSpace:'nowrap' }}>
                              {sncLabel}
                            </span>
                          )}
                        </div>
                      </DashRow>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })()}

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
