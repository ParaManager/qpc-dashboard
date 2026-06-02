import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { ToastContainer } from './components/Toast'
import Dashboard from './pages/Dashboard'
import Athletes  from './pages/Athletes'
import Coaches   from './pages/Coaches'
import Events    from './pages/Events'
import Results   from './pages/Results'
import Sports    from './pages/Sports'
import './index.css'

const NAV = [
  { section: 'Overview',     items: [{ id: 'dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' }] },
  { section: 'People',       items: [{ id: 'athletes',  icon: 'ti-run',              label: 'Athletes'  }, { id: 'coaches', icon: 'ti-whistle', label: 'Coaches' }] },
  { section: 'Competitions', items: [{ id: 'sports',    icon: 'ti-ball-football',    label: 'Sports'    }, { id: 'events',  icon: 'ti-calendar-event', label: 'Events' }, { id: 'results', icon: 'ti-medal', label: 'Results' }] },
]

export default function App() {
  const [page, setPage]                   = useState('dashboard')
  const [athletes, setAthletes]           = useState([])
  const [coaches, setCoaches]             = useState([])
  const [events, setEvents]               = useState([])
  const [results, setResults]             = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading]             = useState(true)
  const [navState, setNavState]           = useState({})

  const fetchAll = useCallback(async () => {
    const [a, c, e, r, reg] = await Promise.all([
      supabase.from('athletes').select('*').order('name'),
      supabase.from('coaches').select('*').order('name'),
      supabase.from('events').select('*').order('start_date'),
      supabase.from('results').select('*').order('date', { ascending: false }),
      supabase.from('event_registrations').select('*'),
    ])
    if (a.data)   setAthletes(a.data)
    if (c.data)   setCoaches(c.data)
    if (e.data)   setEvents(e.data)
    if (r.data)   setResults(r.data)
    if (reg.data) setRegistrations(reg.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function goTo(targetPage, state = {}) {
    setPage(targetPage)
    setNavState(state)
  }

  const upcomingCount = events.filter(e => e.status === 'Upcoming' || e.status === 'Registration Open').length

  if (loading) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ display:'flex', gap:5, marginBottom:16, justifyContent:'center' }}>
          {['#EE334E','#0085C7','#009F6B'].map(c => <div key={c} style={{ width:14, height:14, borderRadius:'50%', background:c }} />)}
        </div>
        <div style={{ fontSize:14, color:'var(--text2)' }}>Loading QPC Dashboard…</div>
      </div>
    </div>
  )

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sb-logo">
          <div className="agitos">
            <div className="agito" style={{ background:'#EE334E' }} />
            <div className="agito" style={{ background:'#0085C7' }} />
            <div className="agito" style={{ background:'#009F6B' }} />
          </div>
          <div className="sb-org">Qatar Paralympic</div>
          <div className="sb-sub">Committee · Admin Portal</div>
        </div>
        <div className="sb-nav">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div className="nav-section">{section}</div>
              {items.map(({ id, icon, label }) => (
                <div key={id} className={`nav-item${page===id?' active':''}`}
                  onClick={() => { setPage(id); setNavState({}) }}>
                  <i className={`ti ${icon}`} />
                  {label}
                  {id==='events' && upcomingCount>0 && <span className="nav-badge">{upcomingCount}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="sb-user">
          <div className="sb-av">MD</div>
          <div><div className="sb-uname">Managing Director</div><div className="sb-urole">admin@qpc.qa</div></div>
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <div className="tb-breadcrumb">
            <span>QPC</span> · <span>{page.charAt(0).toUpperCase()+page.slice(1)}</span> · Season 2026
          </div>
          <div className="tb-actions">
            <button className="tb-btn"><i className="ti ti-bell" /></button>
            <button className="tb-btn"><i className="ti ti-settings" /> Settings</button>
          </div>
        </div>
        <div id="content">
          {page==='dashboard' && <Dashboard athletes={athletes} coaches={coaches} events={events} results={results} onNav={goTo} />}
          {page==='athletes'  && <Athletes  athletes={athletes} coaches={coaches} results={results} onRefresh={fetchAll} onNav={goTo} initAthleteId={navState.athleteId} initStatusFilter={navState.statusFilter} />}
          {page==='coaches'   && <Coaches   coaches={coaches} athletes={athletes} onRefresh={fetchAll} onNav={goTo} initCoachId={navState.coachId} />}
          {page==='events'    && <Events    events={events} athletes={athletes} results={results} registrations={registrations} onRefresh={fetchAll} onNav={goTo} initEventId={navState.eventId} initStatusFilter={navState.statusFilter} />}
          {page==='results'   && <Results   results={results} athletes={athletes} onRefresh={fetchAll} onNav={goTo} />}
          {page==='sports'    && <Sports    athletes={athletes} coaches={coaches} events={events} results={results} onNav={goTo} initSport={navState.sport} />}
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}
