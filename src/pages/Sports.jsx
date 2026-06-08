import { useState, useEffect } from 'react'
import { SPORTS, SPORT_META, Avatar, Badge, MedalDisplay, statusDot, initials, DashRow } from '../lib/helpers'
import { useLang } from '../lib/LangContext.jsx'

export default function Sports({ athletes, coaches, events, results, onNav, initSport, profile }) {
  const { tx } = useLang()

  const SPORT_NAMES = {
    'Athletics':         tx('sports.athletics','Athletics'),
    'Swimming':          tx('sports.swimming','Swimming'),
    'Powerlifting':      tx('sports.powerlifting','Powerlifting'),
    'Boccia':            tx('sports.boccia','Boccia'),
    'Goalball':          tx('sports.goalball','Goalball'),
    'Table Tennis':      tx('sports.tableTennis','Table Tennis'),
    'Special Olympics':  tx('sports.specialOlympics','Special Olympics'),
    'Shooting':          tx('sports.shooting','Shooting'),
    'Wheelchair Tennis': tx('sports.wheelchairTennis','Wheelchair Tennis'),
  }

  // Show all sports
  const activeSports = SPORTS
  const [selected, setSelected] = useState(initSport || null)
  useEffect(() => { if (initSport) setSelected(initSport) }, [initSport])

  if (selected) {
    const meta     = SPORT_META[selected] || { icon:'ti-ball-football', color:'#0085C7', desc:'' }
    const myAths   = athletes.filter(a => a.sport === selected)
    const myCoach  = coaches.find(c => c.sport === selected)
    const myEvents = events.filter(e => e.sport === selected)
    const myMedals = results.filter(r => myAths.some(a => a.id === r.athlete_id))

    return (
      <div>
        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> {tx('sports.backToSports','Back to sports')}</button>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
          <div style={{ width:60, height:60, borderRadius:16, background:meta.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className={`ti ${meta.icon}`} style={{ fontSize:30, color:meta.color }} />
          </div>
          <div>
            <div style={{ fontSize:22, fontWeight:600 }}>{SPORT_NAMES[selected] || selected}</div>
            <div style={{ fontSize:13, color:'var(--text2)', marginTop:3 }}>{tx('dashboard.qpc','Qatar Paralympic Committee')}</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
          {[[tx('sports.athletes','Athletes'),myAths.length,meta.color],[tx('sports.events','Events'),myEvents.length,'#555'],[tx('sports.medals','Total Medals'),myMedals.length,'#f1c40f'],[tx('sports.headCoach','Coach'),myCoach?'✓':'—','#009F6B']].map(([l,v,c]) => (
            <div key={l} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:14, textAlign:'center', boxShadow:'var(--shadow)' }}>
              <div style={{ fontSize:24, fontWeight:600, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>
        {myCoach && (
          <div className="info-card" style={{ marginBottom:12 }}>
            <div className="info-title">{tx('sports.headCoach','Head coach')} <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>— {tx('athletes.clickToView','click to view')}</span></div>
            <DashRow onClick={() => onNav('coaches', { coachId: myCoach.id })}>
              <div className="av" style={{ width:34, height:34, fontSize:11, background:'#009F6B', flexShrink:0 }}>{initials(myCoach.name)}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>{myCoach.name}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>{myCoach.cert_level} · {myCoach.nationality}</div>
              </div>
              <Badge label={myCoach.status} />
            </DashRow>
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="info-card">
            <div className="info-title">{tx('sports.athletes','Athletes')} ({myAths.length}) <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>— {tx('athletes.clickToView','click to view')}</span></div>
            {myAths.length === 0 ? <div className="empty">{tx('sports.noAthletes','No athletes')}</div> :
              myAths.map(a => (
                <DashRow key={a.id} onClick={() => onNav('athletes', { athleteId: a.id })}>
                  <Avatar name={a.name} id={a.id} size={32} fs={10} />
                  <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:500 }}>{a.name}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{a.classification}</div></div>
                  <MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} />
                  <Badge label={a.status} />
                </DashRow>
              ))
            }
          </div>
          <div className="info-card">
            <div className="info-title">{tx('sports.events','Events')} ({myEvents.length}) <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>— {tx('athletes.clickToView','click to view')}</span></div>
            {myEvents.length === 0 ? <div className="empty" style={{ padding:10 }}>{tx('sports.noEvents','No events')}</div> :
              myEvents.map(ev => (
                <DashRow key={ev.id} onClick={() => onNav('events', { eventId: ev.id })}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:statusDot(ev.status), flexShrink:0 }} />
                  <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:500 }}>{ev.name}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{ev.start_date}</div></div>
                  <Badge label={ev.status} />
                </DashRow>
              ))
            }
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">{tx('pages.sports','Sports')}</div><div className="page-sub">{tx('dashboard.qpc','Qatar Paralympic Committee')}</div></div>
      </div>
      {activeSports.map(s => {
        const meta     = SPORT_META[s]
        const myAths   = athletes.filter(a => a.sport === s)
        const myEvents = events.filter(e => e.sport === s)
        const myMedals = results.filter(r => myAths.some(a => a.id === r.athlete_id))
        return (
          <div key={s} onClick={() => setSelected(s)}
            style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:20, cursor:'pointer', marginBottom:12, transition:'all .15s', boxShadow:'var(--shadow)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=meta.color; e.currentTarget.style.transform='translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=''; e.currentTarget.style.transform='' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:52, height:52, borderRadius:14, background:meta.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`ti ${meta.icon}`} style={{ fontSize:26, color:meta.color }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:16, fontWeight:600, marginBottom:3 }}>{SPORT_NAMES[s] || s}</div>
                <div style={{ fontSize:12, color:'var(--text2)' }}>{meta.desc}</div>
              </div>
              <div style={{ display:'flex', gap:20, flexShrink:0, textAlign:'center' }}>
                <div><div style={{ fontSize:20, fontWeight:600, color:meta.color }}>{myAths.length}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{tx('sports.athletes','Athletes')}</div></div>
                <div><div style={{ fontSize:20, fontWeight:600 }}>{myEvents.length}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{tx('sports.events','Events')}</div></div>
                <div><div style={{ fontSize:20, fontWeight:600, color:'#f1c40f' }}>{myMedals.length}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{tx('sports.medals','Medals')}</div></div>
              </div>
              <i className="ti ti-chevron-right" style={{ color:'#ccc', fontSize:18, marginLeft:8 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
