import { Avatar, MedalDisplay, statusClass, statusDot, DashRow, SPORT_META, SPORTS, initials } from '../lib/helpers'
import { useLang } from '../lib/LangContext.jsx'

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

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24, padding:'20px 24px', background:'linear-gradient(135deg, #0a1f14 0%, #0d3320 100%)', borderRadius:16, color:'#fff', flexWrap:'wrap' }}>
        <div style={{ width:64, height:64, borderRadius:'50%', background:'#0085C7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, flexShrink:0, border:'3px solid rgba(255,255,255,.2)' }}>
          {initials(profile?.full_name || 'Admin')}
        </div>
        <div style={{ flex:1, minWidth:160 }}>
          <div style={{ fontSize:20, fontWeight:700 }}>{profile?.full_name || tx('roles.admin','Admin')}</div>
          <div style={{ fontSize:13, opacity:.7, marginTop:2 }}>
            {tx('dashboard.qpc','Qatar Paralympic Committee')}
          </div>
          <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
            <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:'#0085C730', color:'#5ab8f0', border:'1px solid #0085C750' }}>
              {profile?.role === 'employee' ? (ar?'موظف':'Employee') : (ar?'مسؤول':'Administrator')}
            </span>
          </div>
        </div>
      </div>

      <div className="page-header">
        <div>
          <div className="page-title">{tx('pages.dashboard','Dashboard')}</div>
          <div className="page-sub">{tx('dashboard.qpc','Qatar Paralympic Committee')} · {tx('nav.season','Season')} 2026</div>
        </div>
      </div>

      <div className="stat-grid">
        {[
          { label:tx('dashboard.totalAthletes','Total Athletes'), val:athletes.length, hint:`${active} ${tx('dashboard.activeThisSeason','active this season')}`, color:'#0085C7', click:() => onNav('athletes', { statusFilter:'Active' }) },
          { label:tx('dashboard.activeEvents','Active Events'),  val:upcoming, hint:`${upcoming} ${tx('dashboard.upcoming','upcoming')}`, color:'#EE334E', click:() => onNav('events', { statusFilter:'Upcoming' }) },
          { label:tx('nav.coaches','Coaches'), val:coaches.length, hint:`${[...new Set(coaches.map(c=>c.sport))].length} ${tx('dashboard.sportsCovered','sports covered')}`, color:'#009F6B', click:() => onNav('coaches') },
          { label:lang==='ar'?'🥇 ذهب':'🥇 Gold',   val:gold,   hint:tx('dashboard.seasonTotal','season total'), color:'#f1c40f', click:() => onNav('results') },
          { label:lang==='ar'?'🥈 فضة':'🥈 Silver', val:silver, hint:tx('dashboard.seasonTotal','season total'), color:'#aaa',    click:() => onNav('results') },
          { label:lang==='ar'?'🥉 برونز':'🥉 Bronze', val:bronze, hint:tx('dashboard.seasonTotal','season total'), color:'#cd7f32', click:() => onNav('results') },
        ].map(({ label, val, hint, color, click }) => (
          <div key={label} className="stat-card" onClick={click}>
            <div className="stat-label"><div className="stat-dot" style={{ background:color }} />{label}</div>
            <div className="stat-val">{val}</div>
            <div className="stat-hint">{hint}</div>
            <i className="ti ti-arrow-right stat-arrow" />
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

      <div className="card">
        <div className="card-title">
          <i className="ti ti-ball-football" /> {tx('dashboard.sportsBreakdown','Sports breakdown')}
          <span style={{ fontSize:10, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0, marginLeft:4 }}>— {tx('dashboard.clickToExplore','click to explore')}</span>
        </div>
        <div className="sports-grid">
          {['Goalball','Special Olympics','Athletics','Boccia','Swimming','Powerlifting','Table Tennis'].filter(s => SPORT_META[s]).map(s => {
            const meta  = SPORT_META[s]
            const count = athletes.filter(a => a.sport === s).length
            return (
              <div key={s} className="sport-chip"
                onClick={() => onNav('sports', { sport: s })}
                onMouseEnter={e => { e.currentTarget.style.borderColor=meta.color; e.currentTarget.style.background=meta.color+'12' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.background='' }}>
                <div style={{ fontSize:20, marginBottom:4 }}><i className={`ti ${meta.icon}`} style={{ color:meta.color }} /></div>
                <div className="sport-num" style={{ color:meta.color }}>{count}</div>
                <div className="sport-name">{
                  {'Athletics':'ألعاب القوى','Swimming':'السباحة','Powerlifting':'رفع الأثقال',
                   'Boccia':'البوتشيا','Goalball':'كرة الهدف','Table Tennis':'تنس الطاولة',
                   'Special Olympics':'الأولمبياد الخاص','Shooting':'الرماية',
                   'Wheelchair Tennis':'تنس الكراسي المتحركة'}[s] && lang==='ar'
                  ? {'Athletics':'ألعاب القوى','Swimming':'السباحة','Powerlifting':'رفع الأثقال',
                     'Boccia':'البوتشيا','Goalball':'كرة الهدف','Table Tennis':'تنس الطاولة',
                     'Special Olympics':'الأولمبياد الخاص','Shooting':'الرماية',
                     'Wheelchair Tennis':'تنس الكراسي المتحركة'}[s]
                  : s
                }</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
