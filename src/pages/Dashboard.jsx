import { Avatar, MedalDisplay, statusClass, statusDot, DashRow, SPORT_META, SPORTS, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, sportLabel, initials, getCurrentSeason } from '../lib/helpers'
import { useLang } from '../lib/LangContext.jsx'
import DashboardBanners from '../components/DashboardBanners'

// Role label shown under the welcome name in the hero banner
function roleLabel(role, ar) {
  const map = { admin: ar?'مسؤول':'Administrator', coach: ar?'مدرب':'Coach', employee: ar?'موظف':'Employee', athlete: ar?'رياضي':'Athlete' }
  return map[role] || role
}

export default function Dashboard({ athletes, coaches, events, results, onNav, profile }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'
  const active   = athletes.filter(a => a.status === 'Active').length
  const upcoming = events.filter(e => e.status === 'Upcoming' || e.status === 'Registration Open').length
  const gold     = athletes.reduce((s, a) => s + (a.medals_gold   || 0), 0)
  const silver   = athletes.reduce((s, a) => s + (a.medals_silver || 0), 0)
  const bronze   = athletes.reduce((s, a) => s + (a.medals_bronze || 0), 0)

  const leaders = [...athletes]
    .sort((a, b) => (b.medals_gold*3+b.medals_silver*2+b.medals_bronze) - (a.medals_gold*3+a.medals_silver*2+a.medals_bronze))
    .filter(a => (a.medals_gold+a.medals_silver+a.medals_bronze) > 0)
    .slice(0, 5)

  const statCards = [
    { label: tx('dashboard.totalAthletes','Total Athletes'), val: athletes.length, hint: `${active} ${tx('dashboard.activeThisSeason','active this season')}`, color: '#0085C7', icon: 'ti-users', click: () => onNav('athletes', { statusFilter:'Active' }) },
    { label: tx('dashboard.activeEvents','Active Events'),  val: upcoming, hint: `${upcoming} ${tx('dashboard.upcoming','upcoming')}`, color: '#EE334E', icon: 'ti-calendar-event', click: () => onNav('events', { statusFilter:'Upcoming' }) },
    { label: tx('nav.coaches','Coaches'), val: coaches.length, hint: `${[...new Set(coaches.map(c=>c.sport))].length} ${tx('dashboard.sportsCovered','sports covered')}`, color: '#009F6B', icon: 'ti-whistle', click: () => onNav('coaches') },
    { label: ar ? 'ذهب' : 'Gold',   val: gold,   hint: tx('dashboard.seasonTotal','season total'), color: '#d4af37', icon: 'ti-medal', click: () => onNav('results') },
    { label: ar ? 'فضة' : 'Silver', val: silver, hint: tx('dashboard.seasonTotal','season total'), color: '#9aa3b2', icon: 'ti-medal', click: () => onNav('results') },
    { label: ar ? 'برونز' : 'Bronze', val: bronze, hint: tx('dashboard.seasonTotal','season total'), color: '#cd7f32', icon: 'ti-medal', click: () => onNav('results') },
  ]

  return (
    <div>
      {/* ── Hero Banner ── */}
      <div style={{
        position: 'relative', borderRadius: 18, overflow: 'hidden', marginBottom: 22,
        minHeight: 180, display: 'flex', alignItems: 'center',
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
        <div style={{ position: 'relative', zIndex: 1, padding: '28px 32px', flex: 1 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 8, fontWeight: 500 }}>
            {tx('dashboard.welcomeBack', 'Welcome back,')}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>
            {profile?.full_name || tx('roles.admin','Admin')}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginBottom: 16 }}>
            {roleLabel(profile?.role, ar)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EE334E' }} />
            <span style={{ fontSize: 12, color: '#EE334E', fontWeight: 600 }}>
              {tx('nav.season','Season')} {getCurrentSeason()}
            </span>
          </div>
        </div>
      </div>

      <DashboardBanners profile={profile} onNav={onNav} />

      {/* ── Stat Cards ── */}
      <div className="stat-grid" style={{ marginTop: 4 }}>
        {statCards.map(({ label, val, hint, color, icon, click }) => (
          <div key={label} className="stat-card" onClick={click}>
            <div className="stat-icon" style={{ background: color + '18' }}>
              <i className={`ti ${icon}`} style={{ color, fontSize: 22 }} />
            </div>
            <div className="stat-body">
              <div className="stat-label">{label}</div>
              <div className="stat-val" style={{ color }}>{val}</div>
              <div className="stat-hint">{hint}</div>
            </div>
            <i className="ti ti-chevron-right stat-arrow" />
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

      {/* ── Away / Out of Office Section (admin only) ── */}
      {(() => {
        const AWAY_STATUSES = ['On Leave', 'In Competition', 'In Training Camp']
        const STATUS_COLOR  = { 'On Leave':'#f59e0b', 'In Competition':'#0085C7', 'In Training Camp':'#0d9488' }
        const STATUS_ICON   = { 'On Leave':'ti-beach', 'In Competition':'ti-trophy', 'In Training Camp':'ti-run' }
        const STATUS_AR     = { 'On Leave':'في إجازة', 'In Competition':'في منافسة', 'In Training Camp':'في معسكر تدريبي' }

        const today = new Date(); today.setHours(0,0,0,0)

        // Effective status — respects dates: only show as "away" if today >= status_start
        function isEffectivelyAway(p) {
          if (!AWAY_STATUSES.includes(p.status)) return false
          if (!p.status_start) return true  // no start date = immediate
          const start = new Date(p.status_start); start.setHours(0,0,0,0)
          return today >= start
        }

        const awayAthletes = athletes.filter(isEffectivelyAway)
        const awayCoaches  = coaches.filter(isEffectivelyAway)
        const allAway = [
          ...awayAthletes.map(a => ({ ...a, _type: ar ? 'رياضي' : 'Athlete' })),
          ...awayCoaches.map(c  => ({ ...c, _type: ar ? 'مدرب' : 'Coach', _isCoach: true })),
        ]

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
          <div className="card" style={{ marginBottom:16 }}>
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
                <div key={status} style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:clr+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <i className={`ti ${icon}`} style={{ fontSize:14, color:clr }} />
                    </div>
                    <span style={{ fontWeight:600, fontSize:13, color:clr }}>{lbl}</span>
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
                        <Avatar name={p.name} id={p.id} size={30} fs={10} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</div>
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:1, display:'flex', gap:6, flexWrap:'wrap' }}>
                            <span>{p._type}</span>
                            {sncLabel && <span style={{ color:'var(--text3)' }}>· {sncLabel}</span>}
                            {p.status_end && <span>→ {p.status_end}</span>}
                          </div>
                        </div>
                        {remLabel && (
                          <span style={{ fontSize:11, fontWeight:600, color:remColor, background:remColor+'18', padding:'2px 8px', borderRadius:20, flexShrink:0, whiteSpace:'nowrap' }}>
                            {remLabel}
                          </span>
                        )}
                      </DashRow>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })()}

      <div className="card">
        <div className="card-title">
          <i className="ti ti-ball-football" /> {tx('dashboard.sportsBreakdown','Sports breakdown')}
          <span style={{ fontSize:10, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0, marginLeft:4 }}>— {tx('dashboard.clickToExplore','click to explore')}</span>
        </div>
        {(() => {
          const allEntries = SPORT_CATEGORIES.flatMap(category =>
            (SPORTS_BY_CATEGORY[category] || []).map(s => ({
              sport: s, category,
              count: athletes.filter(a => a.sport === s && (a.sport_category === category || !a.sport_category)).length,
            }))
          )
          const topSports = allEntries.filter(e => e.count > 0).sort((a,b) => b.count - a.count).slice(0, 8)
          if (topSports.length === 0) return <div className="empty" style={{ padding:16 }}>{tx('dashboard.noSportsYet','No athletes assigned to a sport yet')}</div>
          return (
            <div className="sports-grid">
              {topSports.map(({ sport: s, category, count }) => {
                const meta = SPORT_META[s] || { icon:'ti-ball-football', color:'#0085C7' }
                return (
                  <div key={`${category}-${s}`} className="sport-chip"
                    onClick={() => onNav('sports', { sport: s, category })}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=meta.color; e.currentTarget.style.background=meta.color+'12' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.background='' }}>
                    <div style={{ fontSize:20, marginBottom:4 }}><i className={`ti ${meta.icon}`} style={{ color:meta.color }} /></div>
                    <div className="sport-num" style={{ color:meta.color }}>{count}</div>
                    <div className="sport-name">{sportLabel(s, category, lang==='ar')}</div>
                  </div>
                )
              })}
            </div>
          )
        })()}
        <div style={{ textAlign:'center', marginTop:14 }}>
          <span onClick={() => onNav('sports')} style={{ fontSize:12, fontWeight:600, color:'#0085C7', cursor:'pointer' }}>
            {tx('dashboard.viewAllSports','View all sports')} →
          </span>
        </div>
      </div>
    </div>
  )
}
