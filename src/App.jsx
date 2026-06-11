import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { useAuth, canEdit } from './lib/useAuth'
import { ToastContainer } from './components/Toast'
import Login     from './pages/Login'
import Dashboard from './pages/Dashboard'
import Athletes  from './pages/Athletes'
import Coaches   from './pages/Coaches'
import Events    from './pages/Events'
import Results   from './pages/Results'
import Sports      from './pages/Sports'
import Schedule       from './pages/Schedule'
import UserManagement from './pages/UserManagement'
import Attendance  from './pages/Attendance'
import Employees from './pages/Employees'
import './index.css'
import { useLang } from './lib/LangContext.jsx'

const NAV_ADMIN = (tx) => [
  { section: tx('nav.overview','Overview'),      items: [{ id:'dashboard', icon:'ti-layout-dashboard', label:tx('nav.dashboard','Dashboard') }] },
  { section: tx('nav.people','People'),          items: [{ id:'athletes', icon:'ti-run', label:tx('nav.athletes','Athletes') }, { id:'coaches', icon:'ti-user-star', label:tx('nav.coaches','Coaches') }, { id:'employees', icon:'ti-users', label:tx('nav.employees','Employees') }] },
  { section: tx('nav.competitions','Competitions'), items: [{ id:'sports', icon:'ti-ball-football', label:tx('nav.sports','Sports') }, { id:'events', icon:'ti-calendar-event', label:tx('nav.events','Events') }, { id:'results', icon:'ti-medal', label:tx('nav.results','Results') }] },
  { section: tx('nav.admin','Admin'),            items: [{ id:'users', icon:'ti-users-group', label:tx('nav.users','User Management') }] },
]
const NAV_COACH = (tx) => [
  { section: tx('nav.overview','Overview'),      items: [{ id:'dashboard', icon:'ti-layout-dashboard', label:tx('nav.dashboard','Dashboard') }] },
  { section: tx('nav.people','People'),          items: [{ id:'athletes', icon:'ti-run', label:tx('nav.athletes','Athletes') }] },
  { section: tx('nav.competitions','Competitions'), items: [{ id:'schedule', icon:'ti-calendar', label:tx('nav.schedule','Schedule') }, { id:'attendance', icon:'ti-clipboard-check', label:tx('nav.attendance','Attendance') }, { id:'events', icon:'ti-calendar-event', label:tx('nav.events','Events') }, { id:'results', icon:'ti-medal', label:tx('nav.results','Results') }] },
]
const NAV_GUEST = (tx) => [
  { section: tx('nav.overview','Overview'),      items: [{ id:'dashboard', icon:'ti-layout-dashboard', label:tx('nav.dashboard','Dashboard') }] },
  { section: tx('nav.competitions','Competitions'), items: [{ id:'events', icon:'ti-calendar-event', label:tx('nav.events','Events') }, { id:'results', icon:'ti-medal', label:tx('nav.results','Results') }] },
]

const ROLE_COLORS = { admin: '#0085C7', coach: '#009F6B', athlete: '#EE334E', guest: '#9aa3b2' }
const ROLE_ICONS  = { admin: 'ti-shield', coach: 'ti-whistle', athlete: 'ti-run', guest: 'ti-eye' }

export default function App() {
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const { lang, setLang, tx } = useLang()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [page, setPage]                   = useState('dashboard')
  const [athletes, setAthletes]           = useState([])
  const [coaches, setCoaches]             = useState([])
  const [events, setEvents]               = useState([])
  const [results, setResults]             = useState([])
  const [registrations, setRegistrations] = useState([])
  const [documents, setDocuments]         = useState([])
  const [employees, setEmployees]         = useState([])
  const [personDocs, setPersonDocs]         = useState([])
  const [dataLoading, setDataLoading]     = useState(true)
  const [navState, setNavState]           = useState({})

  const fetchAll = useCallback(async () => {
    const [a, c, e, r, reg, docs, emp, pdocs] = await Promise.all([
      supabase.from('athletes').select('*').order('name'),
      supabase.from('coaches').select('*').order('name'),
      supabase.from('events').select('*').order('start_date'),
      supabase.from('results').select('*').order('date', { ascending: false }),
      supabase.from('event_registrations').select('*'),
      supabase.from('athlete_documents').select('*').order('uploaded_at', { ascending: false }),
      supabase.from('employees').select('*').order('name'),
      supabase.from('person_documents').select('*').order('uploaded_at', { ascending: false }),
    ])
    if (a.data)    setAthletes(a.data)
    if (c.data)    setCoaches(c.data)
    if (e.data)    setEvents(e.data)
    if (r.data)    setResults(r.data)
    if (reg.data)  setRegistrations(reg.data)
    if (docs.data) setDocuments(docs.data)
    if (emp.data)   setEmployees(emp.data)
    if (pdocs.data) setPersonDocs(pdocs.data)
    setDataLoading(false)
  }, [])

  useEffect(() => { if (user) fetchAll() }, [user, fetchAll])

  function goTo(targetPage, state = {}) {
    setPage(targetPage)
    setNavState(state)
  }

  const upcomingCount = events.filter(e => e.status === 'Upcoming' || e.status === 'Registration Open').length

  if (authLoading) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'#0a1628' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ display:'flex', gap:6, marginBottom:16, justifyContent:'center' }}>
          {['#EE334E','#0085C7','#009F6B'].map(c => <div key={c} style={{ width:14, height:14, borderRadius:'50%', background:c }} />)}
        </div>
        <div style={{ fontSize:14, color:'rgba(255,255,255,.5)' }}>Loading…</div>
      </div>
    </div>
  )

  if (!user) return <Login />

  if (dataLoading) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ display:'flex', gap:5, marginBottom:16, justifyContent:'center' }}>
          {['#EE334E','#0085C7','#009F6B'].map(c => <div key={c} style={{ width:14, height:14, borderRadius:'50%', background:c }} />)}
        </div>
        <div style={{ fontSize:14, color:'var(--text2)' }}>Loading QPC Dashboard…</div>
      </div>
    </div>
  )

  const role      = profile?.account_type || profile?.role || 'guest'
  const userStatus = profile?.status || 'active'
  const isAdmin   = role === 'admin'
  const isCoach   = role === 'coach'
  const myCoachId = profile?.coach_id || null
  const myAthletes = isCoach ? athletes.filter(a => a.coach_id === myCoachId) : athletes

  // Block pending/rejected (admins always pass)
  if (!isAdmin && userStatus === 'pending')  return <PendingScreen />
  if (!isAdmin && userStatus === 'rejected') return <RejectedScreen />

  const roleColor = ROLE_COLORS[role]
  const roleIcon  = ROLE_ICONS[role]
  const userName  = profile?.full_name || user.email

  return (
    <div className="app">
      <div className={`sb-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <div className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sb-logo">
          <div className="agitos">
            <div className="agito" style={{ background:'#EE334E' }} />
            <div className="agito" style={{ background:'#0085C7' }} />
            <div className="agito" style={{ background:'#009F6B' }} />
          </div>
          <div className="sb-org">{lang==='ar' ? 'الاتحاد القطري' : 'Qatar Paralympic'}</div>
          <div className="sb-sub">{lang==='ar' ? 'لذوي الاحتياجات الخاصة' : 'Committee'} · {role}</div>
        </div>
        <div className="sb-nav">
          {(isCoach ? NAV_COACH(tx) : isAdmin ? NAV_ADMIN(tx) : NAV_GUEST(tx)).map(({ section, items }) => (
            <div key={section}>
              <div className="nav-section">{section}</div>
              {items.map(({ id, icon, label }) => (
                <div key={id} className={`nav-item${page===id?' active':''}`}
                  onClick={() => {
                    setNavState({ reset: true })
                    setPage(id)
                    setSidebarOpen(false)
                  }}>
                  <i className={`ti ${icon}`} />
                  {label}
                  {id==='events' && upcomingCount>0 && <span className="nav-badge">{upcomingCount}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:roleColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'#fff', flexShrink:0 }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'#fff', fontSize:12, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{userName}</div>
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                <i className={`ti ${roleIcon}`} style={{ fontSize:10, color:roleColor }} />
                <span style={{ color:roleColor, fontSize:10, fontWeight:500, textTransform:'capitalize' }}>{role}</span>
              </div>
            </div>
          </div>
          <button onClick={signOut} style={{ width:'100%', padding:'7px', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)', borderRadius:7, color:'rgba(255,255,255,.6)', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all .15s', fontFamily:'DM Sans, sans-serif' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.12)'; e.currentTarget.style.color='#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.07)'; e.currentTarget.style.color='rgba(255,255,255,.6)' }}>
            <i className="ti ti-logout" style={{ fontSize:14 }} /> {tx('nav.signOut','Sign out')}
          </button>
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>
              <i className="ti ti-menu-2" />
            </button>
          <div className="tb-breadcrumb">
            <span>{lang==='ar'?'QPC':'QPC'}</span> · <span>{tx(`pages.${page}`, page.charAt(0).toUpperCase()+page.slice(1))}</span> · {tx('nav.season','Season')} 2026
          </div></div>
          <div className="tb-actions">
            <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:roleColor+'15', border:`1px solid ${roleColor}40`, borderRadius:20, fontSize:11, color:roleColor, fontWeight:500 }}>
              <i className={`ti ${roleIcon}`} style={{ fontSize:13 }} />
              {role.charAt(0).toUpperCase()+role.slice(1)}
            </div>
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px solid var(--border)', background: lang === 'ar' ? '#0085C7' : 'var(--surface)', color: lang === 'ar' ? '#fff' : 'var(--text2)', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .15s', fontFamily:'DM Sans, sans-serif' }}
              title="Switch language">
              {lang === 'en' ? 'عربي' : 'EN'}
            </button>
            <button className="tb-btn"><i className="ti ti-bell" /></button>
          </div>
        </div>
        <div id="content">
          {page==='dashboard' && <Dashboard athletes={myAthletes} coaches={coaches} events={events} results={results} onNav={goTo} profile={profile} />}
          {page==='athletes'  && <Athletes  athletes={myAthletes} coaches={coaches} results={results} documents={documents} events={events} registrations={registrations} onRefresh={fetchAll} onNav={goTo} initAthleteId={navState.athleteId} initStatusFilter={navState.statusFilter} navState={navState} profile={profile} />}
          {page==='coaches'   && <Coaches   coaches={coaches} athletes={athletes} personDocs={personDocs} onRefresh={fetchAll} onNav={goTo} initCoachId={navState.coachId} navState={navState} profile={profile} />}
          {page==='events'    && <Events    events={events} athletes={athletes} results={results} registrations={registrations} onRefresh={fetchAll} onNav={goTo} initEventId={navState.eventId} initStatusFilter={navState.statusFilter} profile={profile} />}
          {page==='schedule'  && <Schedule  profile={profile} coachId={myCoachId} myAthletes={myAthletes} onNav={goTo} />}
        {page==='attendance' && <Attendance profile={profile} coachId={myCoachId} myAthletes={myAthletes} onNav={goTo} />}
        {page==='users'     && <UserManagement profile={profile} />}
        {page==='results'   && <Results   results={results} athletes={athletes} onRefresh={fetchAll} onNav={goTo} profile={profile} />}
          {page==='sports'    && <Sports    athletes={athletes} coaches={coaches} events={events} results={results} onNav={goTo} initSport={navState.sport} profile={profile} />}
          {page==='employees' && <Employees employees={employees} personDocs={personDocs} onRefresh={fetchAll} onNav={goTo} navState={navState} profile={profile} />}
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}

function PendingScreen() {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const { signOut } = useAuth()
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'var(--bg)', direction:ar?'rtl':'ltr' }}>
      <div style={{ fontSize:48 }}>⏳</div>
      <div style={{ fontSize:20, fontWeight:700 }}>{ar?'في انتظار الموافقة':'Pending Approval'}</div>
      <div style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:300 }}>
        {ar?'حسابك في انتظار موافقة المسؤول. يرجى المحاولة لاحقاً.':'Your account is pending admin approval. Please check back later.'}
      </div>
      <button onClick={signOut} style={{ marginTop:8, padding:'9px 24px', background:'#EE334E', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:14 }}>
        {ar?'تسجيل الخروج':'Sign Out'}
      </button>
    </div>
  )
}

function RejectedScreen() {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const { signOut } = useAuth()
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'var(--bg)', direction:ar?'rtl':'ltr' }}>
      <div style={{ fontSize:48 }}>❌</div>
      <div style={{ fontSize:20, fontWeight:700 }}>{ar?'تم رفض الطلب':'Access Denied'}</div>
      <div style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:300 }}>
        {ar?'لم تتم الموافقة على طلب الوصول. يرجى التواصل مع المسؤول.':'Your access request was not approved. Please contact the administrator.'}
      </div>
      <button onClick={signOut} style={{ marginTop:8, padding:'9px 24px', background:'#EE334E', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:14 }}>
        {ar?'تسجيل الخروج':'Sign Out'}
      </button>
    </div>
  )
}
