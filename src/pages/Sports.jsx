import { useState, useEffect } from 'react'
import { SPORTS, SPORT_META, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, UNIFIED_SPORTS_GROUPS, SPORT_CATEGORY_NAMES_AR, SPORT_NAMES_AR, SPORT_DESC_AR, UNIFIED_GROUP_NAMES_AR, sportLabel, Avatar, Badge, MedalDisplay, statusDot, initials, DashRow } from '../lib/helpers'
import { useLang } from '../lib/LangContext.jsx'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'
import { toast } from '../components/Toast'

export default function Sports({ athletes, coaches, events, results, onNav, initSport, initCategory, profile }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'

  const SPORT_NAMES = ar ? SPORT_NAMES_AR : {}

  // SPORTS_BY_CATEGORY groups every known sport by category, but its Summer
  // Paralympic list still includes the legacy flat 'Special Olympics'
  // catch-all — that entry belongs conceptually under the Special Olympics
  // programs, not here, so it's filtered out for this page's tabs only.
  // (Left untouched in helpers.jsx since athlete/coach forms still rely on it.)
  const sportsByCategorySection = {
    ...SPORTS_BY_CATEGORY,
    'Summer Paralympic': SPORTS_BY_CATEGORY['Summer Paralympic'].filter(s => s !== 'Special Olympics'),
  }

  const [activeTab, setActiveTab] = useState(initCategory || 'Summer Paralympic')
  const [selected, setSelected] = useState(initSport ? { sport: initSport, category: initCategory || 'Summer Paralympic' } : null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const editable = canEdit(profile)

  // Sport Status (Active/Planned) lives in the `sports` DB table, keyed by
  // its full catalog name (e.g. "Para Athletics"), while this page's tiles
  // use the short key (e.g. "Athletics") from the static SPORTS_BY_CATEGORY
  // catalog — same short/full naming split already handled elsewhere in
  // the app (Athletes.jsx filters/migration). Fetched once, looked up by
  // short-name + category with the same prefix-aware matching.
  const [sportStatusRows, setSportStatusRows] = useState([])
  useEffect(() => {
    supabase.from('sports').select('id, name, category, status')
      .then(({ data, error }) => { if (!error) setSportStatusRows(data || []) })
  }, [])
  function findSportStatusRow(shortName, category) {
    if (!shortName) return null
    return sportStatusRows.find(s =>
      s.category === category &&
      (s.name === shortName || s.name === `Para ${shortName}` || s.name === `SO ${shortName}` || s.name === `Unified ${shortName}`)
    ) || null
  }

  // Athlete counts per sport — must come from athlete_sports (the
  // multi-sport source of truth), not athletes.sport (the legacy single-
  // sport field). An athlete assigned to multiple sports (e.g. both
  // Powerlifting and Swimming) appears under every one of them; the same
  // athlete is never double-counted for the same sport even if a
  // duplicate junction row somehow exists, since athletesForSport
  // deduplicates by athlete id.
  const [athleteSportRows, setAthleteSportRows] = useState([])
  useEffect(() => {
    supabase.from('athlete_sports').select('athlete_id, sport_id')
      .then(({ data, error }) => { if (!error) setAthleteSportRows(data || []) })
  }, [])
  function athletesForSport(athletes, shortName, category) {
    const row = findSportStatusRow(shortName, category)
    const athleteIds = row
      ? new Set(athleteSportRows.filter(r => r.sport_id === row.id).map(r => r.athlete_id))
      : new Set()
    if (athleteIds.size > 0) return athletes.filter(a => athleteIds.has(a.id))
    // Fallback for any athlete not yet migrated into athlete_sports —
    // keeps the page working during the transition rather than silently
    // showing 0 for a sport nobody's been assigned to through the
    // junction table yet.
    return athletes.filter(a => a.sport === shortName && (a.sport_category === category || !a.sport_category))
  }

  function getSportStatus(shortName, category) {
    return findSportStatusRow(shortName, category)?.status || 'Planned'
  }
  async function setSportStatus(shortName, category, newStatus) {
    const row = findSportStatusRow(shortName, category)
    if (!row) { toast(ar ? 'هذه الرياضة غير موجودة في كتالوج قاعدة البيانات' : 'This sport has no matching catalog entry to update', 'error'); return }
    const { error } = await supabase.from('sports').update({ status: newStatus }).eq('id', row.id)
    if (error) { toast(error.message, 'error'); return }
    setSportStatusRows(prev => prev.map(s => s.id === row.id ? { ...s, status: newStatus } : s))
  }
  function SportStatusBadge({ status, onClick }) {
    const isActive = status === 'Active'
    return (
      <span onClick={onClick} style={{
        fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
        background: isActive ? '#009F6B18' : 'var(--surface2)',
        color: isActive ? '#009F6B' : 'var(--text3)',
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}>
        {isActive ? (ar ? 'نشط' : 'Active') : (ar ? 'غير نشط' : 'Inactive')}
      </span>
    )
  }
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
    const myAths   = athletesForSport(athletes, selSport, selCategory)
    const myCoaches = coaches.filter(c => c.sport === selSport && (c.sport_category === selCategory || !c.sport_category))
    const myEvents = events.filter(e => (e.sports || (e.sport ? [e.sport] : [])).includes(selSport))
    // Medal counts live directly on each athlete (medals_gold/silver/bronze), not in
    // the results table — summing those gives the real breakdown for this sport.
    const goldCount   = myAths.reduce((t,a) => t + (a.medals_gold   || 0), 0)
    const silverCount = myAths.reduce((t,a) => t + (a.medals_silver || 0), 0)
    const bronzeCount = myAths.reduce((t,a) => t + (a.medals_bronze || 0), 0)
    return (
      <div>
        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> {tx('sports.backToSports','Back to sports')}</button>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
          <div style={{ width:60, height:60, borderRadius:16, background:meta.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className={`ti ${meta.icon}`} style={{ fontSize:30, color:meta.color }} />
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ fontSize:22, fontWeight:600 }}>{sportLabel(selSport, selCategory, ar)}</div>
              <SportStatusBadge
                status={getSportStatus(selSport, selCategory)}
                onClick={editable ? () => {
                  const next = getSportStatus(selSport, selCategory) === 'Active' ? 'Planned' : 'Active'
                  setSportStatus(selSport, selCategory, next)
                } : undefined}
              />
            </div>
            <div style={{ fontSize:13, color:'var(--text2)', marginTop:3 }}>{tx('dashboard.qpc','Qatar Paralympic Committee')}</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(90px, 1fr))', gap:10, marginBottom:18 }}>
          {[
            [tx('sports.athletes','Athletes'), myAths.length, meta.color],
            [tx('sports.events','Events'), myEvents.length, '#555'],
            [tx('sports.coaches','Coaches'), myCoaches.length, '#009F6B'],
            [ar ? 'ذهب' : 'Gold', goldCount, '#d4af37'],
            [ar ? 'فضة' : 'Silver', silverCount, '#9aa3b2'],
            [ar ? 'برونز' : 'Bronze', bronzeCount, '#b5703a'],
          ].map(([l,v,c]) => (
            <div key={l} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:14, textAlign:'center', boxShadow:'var(--shadow)' }}>
              <div style={{ fontSize:24, fontWeight:600, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{l}</div>
            </div>
          ))}
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

      {/* Total / Active / Planned Sports — counted from the sports catalog
          table's status field, not from athlete participation. */}
      <div className="kpi-grid" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:18 }}>
        {[
          { label: ar?'إجمالي الرياضات':'Total Sports', val: sportStatusRows.length, color:'#0085C7', icon:'ti-ball-football' },
          { label: ar?'الرياضات النشطة':'Active Sports', val: sportStatusRows.filter(s=>s.status==='Active').length, color:'#009F6B', icon:'ti-circle-check' },
          { label: ar?'الرياضات غير النشطة':'Inactive Sports', val: sportStatusRows.filter(s=>s.status==='Planned').length, color:'#9aa3b2', icon:'ti-clock' },
        ].map(({ label, val, color, icon }) => (
          <div key={label} className="kpi-card" style={{ cursor:'default' }}>
            <div className="kpi-icon" style={{ background: color + '18' }}><i className={`ti ${icon}`} style={{ color, fontSize: 16 }} /></div>
            <div className="kpi-body"><div className="kpi-label">{label}</div><div className="kpi-val" style={{ color }}>{val}</div></div>
          </div>
        ))}
      </div>

      {/* Status filter — All / Active / Planned */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {['All','Active','Planned'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            style={{
              padding:'6px 14px', borderRadius:20, fontSize:12.5, fontWeight:600, cursor:'pointer',
              border: statusFilter===s ? 'none' : '1px solid var(--border)',
              background: statusFilter===s ? '#0085C7' : 'var(--surface)',
              color: statusFilter===s ? '#fff' : 'var(--text2)',
            }}>
            {s==='All' ? (ar?'الكل':'All') : s==='Active' ? (ar?'نشط':'Active') : (ar?'غير نشط':'Inactive')}
          </button>
        ))}
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
          const myAths   = athletesForSport(athletes, s, activeTab)
          const myEvents = events.filter(e => (e.sports || (e.sport ? [e.sport] : [])).includes(s))
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
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                    <div style={{ fontSize:16, fontWeight:600 }}>{sportLabel(s, activeTab, ar)}</div>
                    <SportStatusBadge
                      status={getSportStatus(s, activeTab)}
                      onClick={editable ? (e) => {
                        e.stopPropagation()
                        const next = getSportStatus(s, activeTab) === 'Active' ? 'Planned' : 'Active'
                        setSportStatus(s, activeTab, next)
                      } : undefined}
                    />
                  </div>
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
        const matchesStatus = (s) => statusFilter === 'All' || getSportStatus(s, activeTab) === statusFilter
        const matchesAll = (s) => matchesSearch(s) && matchesStatus(s)

        if (activeTab !== 'Unified Sports') {
          const filtered = sportsByCategorySection[activeTab].filter(matchesAll)
          if (filtered.length === 0) {
            return <div className="empty" style={{ padding:16 }}>{tx('sports.noMatches','No sports match your search')}</div>
          }
          return filtered.map(s => renderTile(s))
        }

        // Unified Sports: render each sub-group as its own collapsible section,
        // since the full list (26 disciplines across 4 groups) is too long to
        // show flat without becoming hard to scan.
        const groupsWithMatches = Object.entries(UNIFIED_SPORTS_GROUPS)
          .map(([groupName, groupSports]) => [groupName, groupSports.filter(matchesAll)])
          .filter(([, groupSports]) => groupSports.length > 0)
        if (groupsWithMatches.length === 0) {
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
