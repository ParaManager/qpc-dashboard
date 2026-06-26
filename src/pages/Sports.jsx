import { useState, useEffect } from 'react'
import { SPORTS, SPORT_META, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, UNIFIED_SPORTS_GROUPS, SPORT_CATEGORY_NAMES_AR, SPORT_NAMES_AR, SPORT_DESC_AR, UNIFIED_GROUP_NAMES_AR, sportLabel, Avatar, Badge, MedalDisplay, statusDot, initials, DashRow } from '../lib/helpers'
import { useLang } from '../lib/LangContext.jsx'

export default function Sports({ athletes, coaches, events, results, onNav, initSport, initCategory, profile }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'

  const SPORT_NAMES = ar ? SPORT_NAMES_AR : {}

  // SPORTS_BY_CATEGORY already groups every known sport (including the legacy flat
  // 'Special Olympics' catch-all) by category — no separate construction needed now
  // that helpers.jsx is the single source of truth for all five programs.
  const sportsByCategorySection = SPORTS_BY_CATEGORY

  const [activeTab, setActiveTab] = useState(initCategory || 'Summer Paralympic')
  const [selected, setSelected] = useState(initSport ? { sport: initSport, category: initCategory || 'Summer Paralympic' } : null)
  const [search, setSearch] = useState('')
  // Which Unified Sports sub-groups are expanded — starts with all of them open so
  // the tab doesn't look empty on first visit, but each can be collapsed individually.
  const [expandedGroups, setExpandedGroups] = useState(() =>
    Object.fromEntries(Object.keys(UNIFIED_SPORTS_GROUPS).map(g => [g, true]))
  )
  useEffect(() => {
    if (initSport) {
      const cat = initCategory || 'Summer Paralympic'
      setSelected({ sport: initSport, category: cat })
      setActiveTab(cat)
    }
  }, [initSport, initCategory])

  if (selected) {
    const { sport: selSport, category: selCategory } = selected
    const meta     = SPORT_META[selSport] || { icon:'ti-ball-football', color:'#0085C7', desc:'' }
    // Filter by both sport name and category, since the same sport word (e.g.
    // "Athletics") can mean either program — without this, viewing "Para Athletics"
    // would also pull in Special Olympics athletes who happen to share that word.
    const myAths   = athletes.filter(a => a.sport === selSport && (a.sport_category === selCategory || !a.sport_category))
    const myCoaches = coaches.filter(c => c.sport === selSport && (c.sport_category === selCategory || !c.sport_category))
    const myEvents = events.filter(e => e.sport === selSport)
    // Medal counts live directly on each athlete (medals_gold/silver/bronze), not in
    // the results table — summing those gives the real breakdown for this sport.
    const goldCount   = myAths.reduce((t,a) => t + (a.medals_gold   || 0), 0)
    const silverCount = myAths.reduce((t,a) => t + (a.medals_silver || 0), 0)
    const bronzeCount = myAths.reduce((t,a) => t + (a.medals_bronze || 0), 0)
    const totalMedals = goldCount + silverCount + bronzeCount

    return (
      <div>
        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> {tx('sports.backToSports','Back to sports')}</button>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
          <div style={{ width:60, height:60, borderRadius:16, background:meta.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className={`ti ${meta.icon}`} style={{ fontSize:30, color:meta.color }} />
          </div>
          <div>
            <div style={{ fontSize:22, fontWeight:600 }}>{sportLabel(selSport, selCategory, ar)}</div>
            <div style={{ fontSize:13, color:'var(--text2)', marginTop:3 }}>{tx('dashboard.qpc','Qatar Paralympic Committee')}</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
          {[[tx('sports.athletes','Athletes'),myAths.length,meta.color],[tx('sports.events','Events'),myEvents.length,'#555']].map(([l,v,c]) => (
            <div key={l} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:14, textAlign:'center', boxShadow:'var(--shadow)' }}>
              <div style={{ fontSize:24, fontWeight:600, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{l}</div>
            </div>
          ))}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:14, textAlign:'center', boxShadow:'var(--shadow)' }}>
            <div style={{ fontSize:24, fontWeight:600, color:'#f1c40f' }}>{totalMedals}</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{tx('sports.medals','Total Medals')}</div>
            {totalMedals > 0 && (
              <div style={{ fontSize:11, marginTop:4, display:'flex', justifyContent:'center', gap:8 }}>
                {goldCount   > 0 && <span>🥇{goldCount}</span>}
                {silverCount > 0 && <span>🥈{silverCount}</span>}
                {bronzeCount > 0 && <span>🥉{bronzeCount}</span>}
              </div>
            )}
          </div>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:14, textAlign:'center', boxShadow:'var(--shadow)' }}>
            <div style={{ fontSize:24, fontWeight:600, color:'#009F6B' }}>{myCoaches.length}</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{tx('sports.coaches','Coaches')}</div>
          </div>
        </div>
        {myCoaches.length > 0 && (
          <div className="info-card" style={{ marginBottom:12 }}>
            <div className="info-title">{tx('sports.coaches','Coaches')} ({myCoaches.length}) <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>— {tx('athletes.clickToView','click to view')}</span></div>
            {myCoaches.map(coach => (
              <DashRow key={coach.id} onClick={() => onNav('coaches', { coachId: coach.id })}>
                <div className="av" style={{ width:34, height:34, fontSize:11, background:'#009F6B', flexShrink:0 }}>{initials(coach.name)}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{coach.name}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{coach.nationality}</div>
                </div>
                <Badge label={coach.status} />
              </DashRow>
            ))}
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

      {/* Search spans every category — typing a sport name jumps straight to it
          even if it's not in the currently active tab, and auto-expands the right
          Unified Sports group if that's where the match lives. */}
      <div style={{ position:'relative', marginBottom:18 }}>
        <i className="ti ti-search" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', fontSize:16 }} />
        <input
          type="text"
          value={search}
          onChange={e => {
            const val = e.target.value
            setSearch(val)
            if (!val.trim()) return
            const q = val.trim().toLowerCase()
            const matches = (s, category) =>
              sportLabel(s, category, false).toLowerCase().includes(q) ||
              sportLabel(s, category, true).includes(val.trim())

            // Only jump to a different tab if the one currently open has nothing
            // for this search — staying put while typing feels much less jumpy
            // than relocating on every keystroke.
            const currentHasMatch = (sportsByCategorySection[activeTab] || []).some(s => matches(s, activeTab))
            if (currentHasMatch) {
              if (activeTab === 'Unified Sports') {
                const group = Object.entries(UNIFIED_SPORTS_GROUPS).find(([,sports]) => sports.some(s => matches(s, activeTab)))
                if (group) setExpandedGroups(prev => ({ ...prev, [group[0]]: true }))
              }
              return
            }
            for (const category of SPORT_CATEGORIES) {
              const match = (sportsByCategorySection[category] || []).find(s => matches(s, category))
              if (match) {
                setActiveTab(category)
                if (category === 'Unified Sports') {
                  const group = Object.entries(UNIFIED_SPORTS_GROUPS).find(([,sports]) => sports.includes(match))
                  if (group) setExpandedGroups(prev => ({ ...prev, [group[0]]: true }))
                }
                break
              }
            }
          }}
          placeholder={tx('sports.searchPlaceholder','Search sports…')}
          style={{ width:'100%', padding:'12px 14px 12px 38px', borderRadius:12, border:'1px solid var(--border)', background:'var(--surface)', fontSize:14, color:'var(--text)' }}
        />
        {search && (
          <i className="ti ti-x" onClick={() => setSearch('')}
            style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:'var(--text3)', fontSize:16, cursor:'pointer' }} />
        )}
      </div>

      {/* Big, prominent tabs — switching jumps straight to that category with zero
          scrolling, which matters once each list grows to dozens of sports. */}
      <div style={{ display:'flex', gap:10, marginBottom:24, borderBottom:'2px solid var(--border)', flexWrap:'wrap' }}>
        {SPORT_CATEGORIES.map(category => {
          const isActive = activeTab === category
          const count = sportsByCategorySection[category].length
          return (
            <button key={category} onClick={() => setActiveTab(category)}
              style={{
                background:'none', border:'none', cursor:'pointer',
                padding:'14px 22px 16px', fontSize:17, fontWeight:700,
                color: isActive ? 'var(--text)' : 'var(--text3)',
                borderBottom: isActive ? '3px solid #0085C7' : '3px solid transparent',
                marginBottom:-2, transition:'color .15s',
                display:'flex', alignItems:'center', gap:8,
              }}>
              {ar ? (SPORT_CATEGORY_NAMES_AR[category]||category) : category}
              <span style={{ fontSize:12, fontWeight:600, padding:'2px 9px', borderRadius:20, background: isActive ? '#0085C720' : 'var(--surface2)', color: isActive ? '#0085C7' : 'var(--text3)' }}>{count}</span>
            </button>
          )
        })}
      </div>

      {(() => {
        const renderTile = (s) => {
          const meta     = SPORT_META[s] || { icon:'ti-ball-football', color:'#0085C7', desc:'' }
          // Scope by category too — the same sport word (e.g. "Athletics") can
          // belong to either program, so without this an athlete would be counted
          // under both the Paralympic and Special Olympics tiles for that word.
          const myAths   = athletes.filter(a => a.sport === s && (a.sport_category === activeTab || !a.sport_category))
          const myEvents = events.filter(e => e.sport === s)
          // Medal counts live directly on each athlete (medals_gold/silver/bronze), not
          // in the results table — summing those gives the real total for this sport.
          const myMedalsTotal = myAths.reduce((t,a) => t + (a.medals_gold||0) + (a.medals_silver||0) + (a.medals_bronze||0), 0)
          return (
            <div key={s} onClick={() => setSelected({ sport: s, category: activeTab })}
              style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:20, cursor:'pointer', marginBottom:12, transition:'all .15s', boxShadow:'var(--shadow)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=meta.color; e.currentTarget.style.transform='translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=''; e.currentTarget.style.transform='' }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:52, height:52, borderRadius:14, background:meta.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <i className={`ti ${meta.icon}`} style={{ fontSize:26, color:meta.color }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:16, fontWeight:600, marginBottom:3 }}>{sportLabel(s, activeTab, ar)}</div>
                  <div style={{ fontSize:12, color:'var(--text2)' }}>{ar ? (SPORT_DESC_AR[s]||meta.desc) : meta.desc}</div>
                </div>
                <div style={{ display:'flex', gap:20, flexShrink:0, textAlign:'center' }}>
                  <div><div style={{ fontSize:20, fontWeight:600, color:meta.color }}>{myAths.length}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{tx('sports.athletes','Athletes')}</div></div>
                  <div><div style={{ fontSize:20, fontWeight:600 }}>{myEvents.length}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{tx('sports.events','Events')}</div></div>
                  <div><div style={{ fontSize:20, fontWeight:600, color:'#f1c40f' }}>{myMedalsTotal}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{tx('sports.medals','Medals')}</div></div>
                </div>
                <i className="ti ti-chevron-right" style={{ color:'#ccc', fontSize:18, marginLeft:8 }} />
              </div>
            </div>
          )
        }

        // A sport "matches" the active search term if its label (in either language)
        // contains the typed text — used to narrow the visible list as you type.
        const q = search.trim().toLowerCase()
        const matchesSearch = (s) => !q ||
          sportLabel(s, activeTab, false).toLowerCase().includes(q) ||
          sportLabel(s, activeTab, true).includes(search.trim())

        if (activeTab !== 'Unified Sports') {
          const filtered = sportsByCategorySection[activeTab].filter(matchesSearch)
          if (q && filtered.length === 0) {
            return <div className="empty" style={{ padding:16 }}>{tx('sports.noMatches','No sports match your search')}</div>
          }
          return filtered.map(s => renderTile(s))
        }

        // Unified Sports: render each sub-group as its own collapsible section,
        // since the full list (26 disciplines across 4 groups) is too long to
        // show flat without becoming hard to scan.
        const groupsWithMatches = Object.entries(UNIFIED_SPORTS_GROUPS)
          .map(([groupName, groupSports]) => [groupName, groupSports.filter(matchesSearch)])
          .filter(([, groupSports]) => groupSports.length > 0)
        if (q && groupsWithMatches.length === 0) {
          return <div className="empty" style={{ padding:16 }}>{tx('sports.noMatches','No sports match your search')}</div>
        }
        return groupsWithMatches.map(([groupName, groupSports]) => {
          const isExpanded = q ? true : !!expandedGroups[groupName]
          return (
            <div key={groupName} style={{ marginBottom:20 }}>
              <div onClick={() => setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', padding:'10px 4px', borderBottom:'1px solid var(--border)', marginBottom: isExpanded ? 12 : 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14, fontWeight:700 }}>{ar ? (UNIFIED_GROUP_NAMES_AR[groupName]||groupName) : groupName}</span>
                  <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'var(--surface2)', color:'var(--text3)' }}>{groupSports.length}</span>
                </div>
                <i className={`ti ti-chevron-${isExpanded ? 'up' : 'down'}`} style={{ fontSize:16, color:'var(--text3)' }} />
              </div>
              {isExpanded && groupSports.map(s => renderTile(s))}
            </div>
          )
        })
      })()}
    </div>
  )
}
