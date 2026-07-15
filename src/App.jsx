import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import { useAuth, canEdit } from './lib/useAuth'
import { isTrustedAdmin, isMainAdmin as isMainAdminCheck, isTrustedAdminEmail } from './lib/permissions'
import { getCurrentSeason } from './lib/helpers'
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
import Referees       from './pages/Referees'
import Profile        from './pages/Profile'
import Settings          from './pages/Settings'
import AthleteDashboard  from './pages/AthleteDashboard'
import CoachDashboard    from './pages/CoachDashboard'
import Notifications     from './pages/Notifications'
import Resources         from './pages/Resources'
import Requests         from './pages/Requests'
import Away             from './pages/Away'
import Tasks              from './pages/Tasks'
import AthleteEvents     from './pages/AthleteEvents'
import AthleteResults    from './pages/AthleteResults'
import Attendance  from './pages/Attendance'
import Employees from './pages/Employees'
import './index.css'
import NotificationBell from './components/NotificationBell.jsx'
import { useLang } from './lib/LangContext.jsx'

const NAV_ADMIN = (tx) => [
  { section: tx('nav.overview','Overview'),      items: [{ id:'dashboard', icon:'ti-layout-dashboard', label:tx('nav.dashboard','Dashboard') }, { id:'notifications', icon:'ti-bell', label:tx('nav.notifications','Notifications') }, { id:'resources', icon:'ti-folder', label:tx('nav.resources','Resources') }, { id:'requests', icon:'ti-clipboard-text', label:tx('nav.requests','Requests') }, { id:'away', icon:'ti-map-pin-off', label:tx('nav.away','Away Management') }, { id:'tasks', icon:'ti-checklist', label:tx('nav.tasks','Tasks') }, { id:'profile', icon:'ti-user-circle', label:tx('nav.profile','My Profile') }] },
  { section: tx('nav.people','People'),          items: [{ id:'athletes', icon:'ti-run', label:tx('nav.athletes','Athletes') }, { id:'coaches', icon:'ti-user-star', label:tx('nav.coaches','Coaches') }, { id:'employees', icon:'ti-users', label:tx('nav.employees','Employees') }, { id:'referees', icon:'ti-award', label:tx('nav.referees','Referees') }] },
  { section: tx('nav.training','Training'),      items: [{ id:'schedule', icon:'ti-calendar', label:tx('nav.schedule','Schedule') }, { id:'attendance', icon:'ti-clipboard-check', label:tx('nav.attendance','Attendance') }] },
  { section: tx('nav.competitions','Competitions'), items: [{ id:'sports', icon:'ti-ball-football', label:tx('nav.sports','Sports') }, { id:'events', icon:'ti-calendar-event', label:tx('nav.events','Events') }, { id:'results', icon:'ti-medal', label:tx('nav.results','Results') }] },
  { section: tx('nav.admin','Admin'),            items: [{ id:'users', icon:'ti-users-group', label:tx('nav.users','User Management') }, { id:'settings', icon:'ti-settings', label:tx('nav.settings','Settings') }] },
]
const NAV_COACH = (tx) => [
  { section: tx('nav.overview','Overview'),      items: [{ id:'dashboard', icon:'ti-layout-dashboard', label:tx('nav.dashboard','Dashboard') }, { id:'notifications', icon:'ti-bell', label:tx('nav.notifications','Notifications') }, { id:'resources', icon:'ti-folder', label:tx('nav.resources','Resources') }, { id:'requests', icon:'ti-clipboard-text', label:tx('nav.requests','Requests') }, { id:'tasks', icon:'ti-checklist', label:tx('nav.tasks','Tasks') }, { id:'profile', icon:'ti-user-circle', label:tx('nav.profile','My Profile') }] },
  { section: tx('nav.training','Training'),      items: [{ id:'schedule', icon:'ti-calendar', label:tx('nav.schedule','Schedule') }, { id:'attendance', icon:'ti-clipboard-check', label:tx('nav.attendance','Attendance') }] },
  { section: tx('nav.competitions','Competitions'), items: [{ id:'events', icon:'ti-calendar-event', label:tx('nav.events','Events') }, { id:'results', icon:'ti-medal', label:tx('nav.results','Results') }] },
  { section: tx('nav.account','Account'),         items: [{ id:'settings', icon:'ti-settings', label:tx('nav.settings','Settings') }] },
]
const NAV_ATHLETE = (tx) => [
  { section: tx('nav.overview','Overview'),      items: [{ id:'athlete-dashboard', icon:'ti-layout-dashboard', label:tx('nav.dashboard','Dashboard') }, { id:'notifications', icon:'ti-bell', label:tx('nav.notifications','Notifications') }, { id:'resources', icon:'ti-folder', label:tx('nav.resources','Resources') }, { id:'requests', icon:'ti-clipboard-text', label:tx('nav.requests','Requests') }, { id:'profile', icon:'ti-user-circle', label:tx('nav.profile','My Profile') }] },
  { section: tx('nav.training','Training'),      items: [{ id:'schedule', icon:'ti-calendar', label:tx('nav.schedule','Schedule') }] },
  { section: tx('nav.mycompetitions','My Competitions'), items: [{ id:'athlete-events', icon:'ti-calendar-event', label:tx('nav.events','Events') }, { id:'athlete-results', icon:'ti-medal', label:tx('nav.results','Results') }] },
  { section: tx('nav.account','Account'),         items: [{ id:'settings', icon:'ti-settings', label:tx('nav.settings','Settings') }] },
]

const NAV_GUEST = (tx) => [
  { section: tx('nav.overview','Overview'),      items: [{ id:'dashboard', icon:'ti-layout-dashboard', label:tx('nav.dashboard','Dashboard') }, { id:'notifications', icon:'ti-bell', label:tx('nav.notifications','Notifications') }, { id:'profile', icon:'ti-user-circle', label:tx('nav.profile','My Profile') }] },
  { section: tx('nav.competitions','Competitions'), items: [{ id:'events', icon:'ti-calendar-event', label:tx('nav.events','Events') }, { id:'results', icon:'ti-medal', label:tx('nav.results','Results') }] },
  { section: tx('nav.account','Account'),         items: [{ id:'settings', icon:'ti-settings', label:tx('nav.settings','Settings') }] },
]

const ROLE_COLORS = { admin: '#0085C7', coach: '#009F6B', athlete: '#EE334E', guest: '#9aa3b2' }
const ROLE_ICONS  = { admin: 'ti-shield', coach: 'ti-whistle', athlete: 'ti-run', guest: 'ti-eye' }

export default function App() {
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const { lang, setLang, tx } = useLang()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState({})  // { [sectionLabel]: true } when collapsed; sections default to expanded
  const [requestSent, setRequestSent] = useState(false)
  // True for the brief window between a new sign-up creating its auth session
  // and its profiles row actually finishing its insert. Without this, a logged-in
  // user with no profile yet (purely a timing gap, not a real broken account)
  // would briefly render NoProfileScreen — which is meant for genuinely missing
  // profiles, not this normal in-progress moment.
  const [signingUp, setSigningUp] = useState(false)
  const [page, setPage]               = useState(() => {
    // Any fresh load of the app (a real page refresh, opening a bookmarked/
    // shared link, a tab the browser discarded and silently reloaded, etc.)
    // always starts on the dashboard, regardless of whatever page was last
    // shown before the reload. In-session navigation, and the browser's own
    // back/forward buttons (handled separately via popstate below), are
    // unaffected by this — this only governs the very first mount.
    if (window.location.pathname !== '/dashboard' && window.location.pathname !== '/') {
      window.history.replaceState({ page: 'dashboard' }, '', '/dashboard')
    }
    return 'dashboard'
  })
  const [refreshToken, setRefreshToken] = useState(0)  // bumped on every nav click to force a fresh reload, even when clicking the already-active page
  const [athletes, setAthletes]           = useState([])
  const [coaches, setCoaches]             = useState([])
  const [events, setEvents]               = useState([])
  const [results, setResults]             = useState([])
  const [registrations, setRegistrations] = useState([])
  const [documents, setDocuments]         = useState([])
  const [employees, setEmployees]         = useState([])
  const [personDocs, setPersonDocs]         = useState([])
  const [referees, setReferees]             = useState([])
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const [pendingAccountsCount, setPendingAccountsCount] = useState(0)
  const [dataLoading, setDataLoading]     = useState(true)
  const [navState, setNavState]           = useState({})
  const [notifCount, setNotifCount]       = useState(0)

  useEffect(() => {
    if (!profile?.id) { setNotifCount(0); return }
    function refreshCount() {
      supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', String(profile.id))
        .eq('read', false)
        .then(({ count }) => setNotifCount(count || 0))
    }
    refreshCount()
    const sub = supabase.channel(`nav-notif-count-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, refreshCount)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [profile?.id])

  const fetchAll = useCallback(async () => {
    // Auto-reset dated statuses where end date has passed
    // Local Qatar-day string, not UTC (toISOString() shifts the date back
    // for any UTC+ timezone, e.g. still "yesterday" at 00:44 local).
    const _now = new Date()
    const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`
    const dated = ['On Leave','In Competition','In Training Camp']
    await Promise.all([
      supabase.from('athletes').update({ status:'Active', status_start:null, status_end:null })
        .in('status', dated).lt('status_end', today).not('status_end', 'is', null),
      supabase.from('coaches').update({ status:'Active', status_start:null, status_end:null })
        .in('status', dated).lt('status_end', today).not('status_end', 'is', null),
    ])

    // ── Admin Notification Center: scheduled-style reminder checks ──────────
    // There is no server-side cron in this project, so these checks run once
    // per admin session load instead. Every insert below relies on the
    // (user_id, dedup_key) unique index added to `notifications` — running
    // this block repeatedly (multiple tabs, frequent reloads, etc.) can never
    // create a duplicate, since a conflicting dedup_key is simply rejected.

    const [a, c, e, r, reg, docs, emp, pdocs, refs, reqSubs, profs, tasksRes] = await Promise.all([
      supabase.from('athletes').select('*').order('name'),
      supabase.from('coaches').select('*').order('name'),
      supabase.from('events').select('*').order('start_date'),
      supabase.from('results').select('*').order('date', { ascending: false }),
      supabase.from('event_registrations').select('*'),
      supabase.from('athlete_documents').select('*').order('uploaded_at', { ascending: false }),
      supabase.from('employees').select('*').order('name'),
      supabase.from('person_documents').select('*').order('uploaded_at', { ascending: false }),
      supabase.from('referees').select('*').order('number'),
      // Lightweight status-only fetch, same shape Requests.jsx itself already
      // uses to compute per-form pending counts — reused here just to get a
      // single dashboard-wide pending count without duplicating that logic.
      supabase.from('request_submissions').select('status'),
      // Same idea for pending account sign-ups — UserManagement.jsx already
      // treats profiles.status === 'pending' as "awaiting approval"; this is
      // just that same count, fetched centrally so Dashboard can show it too.
      supabase.from('profiles').select('status'),
      // Needed for the due-date reminder checks run below.
      supabase.from('tasks').select('*'),
    ])
    if (a.data)    setAthletes(a.data)
    if (c.data)    setCoaches(c.data)
    if (e.data)    setEvents(e.data)
    if (r.data)    setResults(r.data)
    if (reg.data)  setRegistrations(reg.data)
    if (docs.data) setDocuments(docs.data)
    if (emp.data)   setEmployees(emp.data)
    if (pdocs.data) setPersonDocs(pdocs.data)
    if (refs.data)  setReferees(refs.data)
    if (reqSubs.data) setPendingRequestsCount(reqSubs.data.filter(s => s.status === 'pending').length)
    if (profs.data)   setPendingAccountsCount(profs.data.filter(p => p.status === 'pending').length)
    setDataLoading(false)
  }, [profile?.id, profile?.role, lang])

  // Runs the admin notification-reminder checks (tasks, away management,
  // document expiry). This used to run inline inside fetchAll(), sequentially
  // *before* the real app data was fetched — every network round-trip here
  // (admins query, tasks query, per-task delete calls, away queries, expiry
  // queries, upserts) added directly to how long the white "Loading QPC
  // Dashboard…" screen stayed up, which is especially painful on a cold/slow
  // connection (first open of the day, idle for hours, etc.). It's invisible
  // background bookkeeping the user never sees happen, so it now runs
  // separately, fired off *after* the real data has already loaded and the
  // dashboard is on screen — it no longer blocks anything the user is
  // waiting to see.
  const runAdminReminders = useCallback(async () => {
    if (profile?.role === 'admin') {
      try {
        // Away/expiry reminders go to the two trusted admins specifically,
        // not every role='admin' account — a future third admin must not
        // be flooded with these by default, matching the trusted-admin model.
        const { data: admins } = await supabase.from('profiles').select('id, email').eq('role', 'admin')
        const adminIds = (admins || []).filter(a => isTrustedAdminEmail(a.email)).map(x => x.id)
        if (adminIds.length) {
          const todayD = new Date(); todayD.setHours(0,0,0,0)
          const tomorrowD = new Date(todayD.getTime() + 86400000)
          const toLocalDateStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
          const tomorrowStr = toLocalDateStr(tomorrowD)
          const todayStr = toLocalDateStr(todayD)
          const inserts = []
          // Plain .upsert() here fails RLS: broadcasting to OTHER users'
          // user_id requires satisfying the UPDATE policy on the ON CONFLICT
          // path even when nothing is actually updated, and "Users can update
          // own notifications" only allows user_id = auth.uid(). This RPC
          // performs the same dedup-safe insert (insert, skip on existing
          // user_id+dedup_key) as SECURITY DEFINER, so it isn't blocked by
          // the caller's own row-level policy — it never updates existing
          // rows, only conditionally inserts new ones.
          const upsertIgnoreConflict = async (rows, label) => {
            if (!rows.length) return
            const { error } = await supabase.rpc('insert_notifications_ignore_duplicates', { rows })
            if (error) console.error(`[notifications] insert failed for ${label}:`, error)
          }

          // 4. TASKS — due tomorrow / due today / overdue, once each, never
          // for completed tasks (the only "resolved" status this app has).
          // Stage transitions: once a task reaches a later stage, its
          // earlier-stage notification(s) are deleted so only the current,
          // relevant one remains — a task that's now overdue shouldn't still
          // show a stale "due tomorrow"/"due today" alongside it.
          const { data: liveTasks } = await supabase.from('tasks').select('*').neq('status', 'done')
          for (const t of (liveTasks || [])) {
            if (!t.due_date) continue
            const ownerId = t.assigned_to || t.created_by
            if (!ownerId) continue
            const base = { user_id: ownerId, category: 'Tasks', target_path: 'tasks', related_entity_type: 'task', related_entity_id: t.id, read: false }
            if (t.due_date === tomorrowStr) {
              inserts.push({ ...base, type: 'task_due_tomorrow',
                title: lang==='ar' ? 'مهمة مستحقة غداً' : 'Task due tomorrow', body: t.title,
                dedup_key: `task-due-tomorrow-${t.id}` })
            } else if (t.due_date === todayStr) {
              const { error } = await supabase.from('notifications').delete()
                .eq('related_entity_type', 'task').eq('related_entity_id', t.id).eq('dedup_key', `task-due-tomorrow-${t.id}`)
              if (error) console.error('[notifications] failed clearing due-tomorrow on transition to due-today:', error)
              inserts.push({ ...base, type: 'task_due_today',
                title: lang==='ar' ? 'مهمة مستحقة اليوم' : 'Task due today', body: t.title,
                dedup_key: `task-due-today-${t.id}-${todayStr}` })
            } else if (t.due_date < todayStr) {
              const { error } = await supabase.from('notifications').delete()
                .eq('related_entity_type', 'task').eq('related_entity_id', t.id)
                .in('type', ['task_due_tomorrow', 'task_due_today'])
              if (error) console.error('[notifications] failed clearing due-tomorrow/due-today on transition to overdue:', error)
              inserts.push({ ...base, type: 'task_overdue',
                title: lang==='ar' ? 'مهمة متأخرة' : 'Task overdue', body: t.title,
                dedup_key: `task-overdue-${t.id}` })
            }
          }

          // 5. AWAY MANAGEMENT — status starts today / ends today, once each.
          // This reads status/status_start/status_end directly and checks
          // exact date equality against today — it does NOT call the shared
          // effectiveStatus()/computeAwayPeople() helpers, since those answer
          // a different question ("is this person currently away right now")
          // than what's needed here ("did their away period start or end on
          // exactly today's date"). The inclusive-boundary semantics are the
          // same ones those helpers use, just applied directly to the
          // already-fetched rows below rather than routed through them.
          const AWAY_STATUSES = ['On Leave','In Competition','In Training Camp']
          const [athletesForAway, coachesForAway, employeesForAway] = await Promise.all([
            supabase.from('athletes').select('id,name,name_ar,status,status_start,status_end'),
            supabase.from('coaches').select('id,name,name_ar,status,status_start,status_end'),
            supabase.from('employees').select('id,name,name_ar,status,status_start,status_end'),
          ])
          const awayGroups = [
            { rows: athletesForAway.data || [], type: 'athlete', path: 'athletes', param: 'athleteId' },
            { rows: coachesForAway.data || [],  type: 'coach',   path: 'coaches',  param: 'coachId' },
            { rows: employeesForAway.data || [],type: 'employee',path: 'employees',param: 'employeeId' },
          ]
          for (const group of awayGroups) {
            for (const p of group.rows) {
              if (!AWAY_STATUSES.includes(p.status)) continue
              const name = p.name || ''
              if (p.status_start === todayStr) {
                inserts.push({
                  user_id: adminIds[0], category: 'Away Management', target_path: group.path,
                  related_entity_type: group.type, related_entity_id: String(p.id), read: false,
                  type: 'away_start',
                  title: lang==='ar' ? 'بدء غياب مؤقت' : 'Temporary status started',
                  body: lang==='ar' ? `${name} — ${p.status} يبدأ اليوم` : `${name}'s ${p.status.toLowerCase()} starts today`,
                  dedup_key: `away-start-${group.type}-${p.id}-${todayStr}`,
                })
              }
              if (p.status_end === todayStr) {
                inserts.push({
                  user_id: adminIds[0], category: 'Away Management', target_path: group.path,
                  related_entity_type: group.type, related_entity_id: String(p.id), read: false,
                  type: 'away_end',
                  title: lang==='ar' ? 'انتهاء غياب مؤقت' : 'Temporary status ending',
                  body: lang==='ar' ? `${name} — ${p.status} ينتهي اليوم` : `${name}'s ${p.status.toLowerCase()} ends today`,
                  dedup_key: `away-end-${group.type}-${p.id}-${todayStr}`,
                })
              }
            }
          }
          // Away notifications go to every admin, not just the first — expand.
          const awayInserts = inserts.filter(x => x.type === 'away_start' || x.type === 'away_end')
          const nonAwayInserts = inserts.filter(x => x.type !== 'away_start' && x.type !== 'away_end')
          const expandedAway = awayInserts.flatMap(row => adminIds.map(uid => ({ ...row, user_id: uid, dedup_key: `${row.dedup_key}-${uid}` })))

          // 6. DOCUMENT EXPIRY — passport & Qatar ID, athletes only (per
          // existing fields reviewed). Initial warning at 30/14/7 days out
          // and on/after expiry, then a repeat only every 30 days while still
          // unresolved — encoded as a cycle number baked directly into the
          // dedup_key so re-running this never duplicates the same cycle,
          // and a later renewal (expiry date pushed forward) naturally
          // produces a fresh, different dedup_key instead of being silently
          // suppressed forever.
          const { data: athletesForExpiry } = await supabase.from('athletes').select('id,name,name_ar,passport_expiry,id_expiry')
          const expiryInserts = []
          for (const a2 of (athletesForExpiry || [])) {
            for (const [field, docType, label, labelAr] of [['passport_expiry','passport','Passport','جواز السفر'], ['id_expiry','id','Qatar ID','الرقم الشخصي']]) {
              const exp = a2[field]
              if (!exp) continue
              const expDate = new Date(exp); expDate.setHours(0,0,0,0)
              const daysUntil = Math.round((expDate - todayD) / 86400000)
              // Document is valid through its expiry date — only "day after
              // expiry" (daysUntil < 0) counts as expired. 60-day and 30-day
              // warnings fire only on those exact days, not a >30 window.
              const expired = daysUntil < 0
              let type, title, body, dedupKey
              if (!expired && daysUntil === 60) {
                type = 'document_expiring'
                title = lang==='ar' ? `${labelAr} — تنبيه 60 يوماً` : `${label} — 60-day warning`
                body = lang==='ar' ? `${a2.name_ar || a2.name} — ${labelAr} ينتهي في ${exp}` : `${a2.name} — ${label} expires on ${exp}`
                dedupKey = `document-warning-60-${a2.id}-${docType}-${exp}`
              } else if (!expired && daysUntil === 30) {
                type = 'document_expiring'
                title = lang==='ar' ? `${labelAr} — تنبيه 30 يوماً` : `${label} — 30-day warning`
                body = lang==='ar' ? `${a2.name_ar || a2.name} — ${labelAr} ينتهي في ${exp}` : `${a2.name} — ${label} expires on ${exp}`
                dedupKey = `document-warning-30-${a2.id}-${docType}-${exp}`
              } else if (expired && Math.abs(daysUntil) === 1) {
                // Fires exactly once, the day after expiry. Previously this
                // used a 30-day "cycle" number computed from today's gap to
                // the expiry date — for a document that expired long ago,
                // that cycle number is something the app has never seen
                // before, so it inserted it as a brand-new notification the
                // next time anyone opened the app, regardless of how old the
                // expiry actually was. A fixed key with no cycle/date math
                // means it can only ever fire on the single day it applies.
                type = 'document_expired'
                title = lang==='ar' ? `${labelAr} منتهي الصلاحية` : `${label} expired`
                body = lang==='ar' ? `${a2.name_ar || a2.name} — ${labelAr} منتهي منذ ${exp}` : `${a2.name} — ${label} expired on ${exp}`
                dedupKey = `document-expired-${a2.id}-${docType}-${exp}`
              } else {
                continue // not one of the exact reminder days
              }
              expiryInserts.push({
                category: 'Documents', target_path: 'athletes', related_entity_type: 'athlete', related_entity_id: String(a2.id), read: false,
                type, title, body, dedup_key: dedupKey,
              })
            }
          }
          const expandedExpiry = expiryInserts.flatMap(row => adminIds.map(uid => ({ ...row, user_id: uid, dedup_key: `${row.dedup_key}-${uid}` })))

          await upsertIgnoreConflict(nonAwayInserts, 'tasks')
          await upsertIgnoreConflict(expandedAway, 'away')
          await upsertIgnoreConflict(expandedExpiry, 'expiry')
        }
      } catch (err) {
        // Reminder generation failing must never block the app from loading
        // its actual data below — but the failure itself must be visible,
        // not silently swallowed.
        console.error('[notifications] reminder generation failed:', err)
      }
    }
  }, [profile?.id, profile?.role, lang])

  // Depend on user?.id (a stable string), not the `user` object itself —
  // TOKEN_REFRESHED (fired routinely, including on tab focus) produces a
  // new user object reference with the same id, which previously
  // re-triggered this effect and reloaded all app data on every tab
  // switch even though nothing the user was looking at had changed.
  useEffect(() => { if (user) fetchAll() }, [user?.id, fetchAll])
  // Fire-and-forget: runs after the visible app data is already loaded, so
  // it never delays the initial render. Any failure inside is caught and
  // logged by runAdminReminders itself.
  // Same reasoning as the fetchAll effect above — key off user?.id (stable)
  // rather than the user object itself, so a routine token refresh on tab
  // focus doesn't re-run the whole admin reminder sweep every time.
  useEffect(() => { if (user && profile?.role === 'admin' && !dataLoading) runAdminReminders() }, [user?.id, profile?.role, dataLoading, runAdminReminders])

  // Manual refresh for mobile/tablet, where pull-to-refresh isn't available in a
  // Manual refresh for mobile/tablet. Two different problems live under one button:
  // (1) stale DATA — fixed by re-fetching from Supabase, same as any reload would do.
  // (2) stale CODE — when this app is added to the home screen, iOS/Android run it
  // in a standalone webview that does NOT re-check for a new JS bundle the way a
  // normal browser tab does — AND this app has its own service worker doing
  // network-first-with-cache-fallback caching (see public/sw.js), which can keep
  // serving an old cached bundle even after a normal reload. A real fix needs to
  // clear that cache and unregister the worker before reloading, not just change
  // the URL — a cache-busted query string alone doesn't make the service worker
  // treat the request any differently.
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  }

  async function handleRefresh() {
    if (isRefreshing) return
    setIsRefreshing(true)

    if (isStandalone()) {
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          await Promise.all(registrations.map(r => r.unregister()))
        }
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
      } catch (e) {
        // Even if clearing fails for some reason, still attempt the reload below
        // rather than leaving the person stuck with no way forward.
        console.error('Failed to clear service worker/cache:', e)
      }
      // Force a real reload from the server — by this point there's no service
      // worker left to intercept the request, and no cache left for it to serve
      // from even if there were.
      const url = new URL(window.location.href)
      url.searchParams.set('_refresh', Date.now().toString())
      window.location.href = url.toString()
      return
    }

    const start = Date.now()
    try {
      await fetchAll()
    } finally {
      const elapsed = Date.now() - start
      setTimeout(() => setIsRefreshing(false), Math.max(0, 500 - elapsed))
    }
  }

  // Keep the sidebar section containing the current page expanded, even if the
  // person navigated there some other way (e.g. clicking a notification) rather
  // than through the sidebar itself — otherwise the active item could be hidden
  // inside a collapsed section with no visible indication of where they are.
  // Computed inline from profile?.role (not the isAdmin/activeNav variables,
  // which are defined after this component's early returns) so this hook runs
  // unconditionally on every render, same as every other hook here.
  useEffect(() => {
    const r = profile?.role || 'guest'
    const nav = r === 'coach' ? NAV_COACH(tx) : r === 'admin' ? NAV_ADMIN(tx) : r === 'athlete' ? NAV_ATHLETE(tx) : NAV_GUEST(tx)
    const owningSection = nav.find(({ items }) => items.some(it => it.id === page))?.section
    if (owningSection) {
      setCollapsedSections(prev => prev[owningSection] ? { ...prev, [owningSection]: false } : prev)
    }
  }, [page, profile?.role])

  // Reset to the role's default page on an actual new login — but not on the
  // very first mount, where profile?.id also "changes" (from undefined to a
  // real id) purely because an existing session is being restored. Without
  // this distinction, restoring the page from the URL on reload would always
  // get immediately overwritten back to the dashboard the moment the profile
  // finished loading, which defeats the point of reading the URL at all.
  const previousUserId = useRef(undefined)
  useEffect(() => {
    if (!profile) return
    const isFirstResolution = previousUserId.current === undefined
    const isNewLogin = !isFirstResolution && previousUserId.current !== profile.id
    previousUserId.current = profile.id
    if (!isNewLogin) return

    const role = profile?.role || 'guest'
    if (role === 'athlete') {
      goTo('athlete-dashboard')
    } else {
      goTo('dashboard')
    }
  }, [profile?.id])

  function goTo(targetPage, state = {}) {
    setPage(targetPage)
    setNavState(state)
    // Keep the URL in sync so a reload, a tab the browser discarded and
    // silently reloaded, or the browser's own back/forward buttons all land
    // back on the right page instead of always resetting to the dashboard.
    const path = `/${targetPage}`
    if (window.location.pathname !== path) {
      window.history.pushState({ page: targetPage }, '', path)
    }
  }

  // Browser back/forward buttons — now that pages are reflected in the URL,
  // these should move between them rather than doing nothing or leaving the
  // address bar out of sync with what's actually shown.
  useEffect(() => {
    function handlePopState(e) {
      const targetPage = e.state?.page || window.location.pathname.replace(/^\/+/, '') || 'dashboard'
      setPage(targetPage)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Listen for navigation events from NotificationBell
  useEffect(() => {
    function handleNav(e) {
      const detail = e.detail
      if (typeof detail === 'string') {
        goTo(detail)
      } else if (detail?.page) {
        goTo(detail.page, detail)
      }
    }
    window.addEventListener('navigate', handleNav)
    return () => window.removeEventListener('navigate', handleNav)
  }, [goTo])

  // Temporary diagnostic — remove once tab-focus state loss is confirmed
  // fully resolved. Logs every time either loading gate changes value, so we
  // can see directly in the console if/when they flip back to true after
  // the initial load (which is what unmounts every page underneath).
  useEffect(() => {
    console.log('[App] authLoading:', authLoading, 'dataLoading:', dataLoading, 'page:', page)
  }, [authLoading, dataLoading, page])

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

  if (requestSent) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:20 }}>
      <div style={{ fontSize:48 }}>📧</div>
      <div style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>Request Sent!</div>
      <div style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:300 }}>
        Your account request has been sent to the admin for approval. You will be notified once your account is activated.
      </div>
      <button onClick={() => setRequestSent(false)} style={{ marginTop:8, padding:'9px 24px', background:'#0085C7', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:14 }}>
        Back to Login
      </button>
    </div>
  )

  if (!user) return <Login onRequestSent={() => setRequestSent(true)} onSigningUpChange={setSigningUp} />

  // Wait for the profile to actually finish loading before reading its role/status —
  // otherwise a rejected or pending account could briefly (or permanently, if the
  // profile fetch ever fails) fall through to the 'guest'/'active' fallback below
  // and bypass the access gate entirely.
  if (authLoading) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ display:'flex', gap:5, marginBottom:16, justifyContent:'center' }}>
          {['#EE334E','#0085C7','#009F6B'].map(c => <div key={c} style={{ width:14, height:14, borderRadius:'50%', background:c }} />)}
        </div>
        <div style={{ fontSize:14, color:'var(--text2)' }}>Loading QPC Dashboard…</div>
      </div>
    </div>
  )

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

  const role      = profile?.role || 'guest'
  const userStatus = profile?.status || 'active'
  const isAdmin   = role === 'admin'
  // Trusted-admin status now comes from the centralized permissions helper
  // (src/lib/permissions.js), which is also mirrored by the SQL
  // is_trusted_admin() function used in RLS policies — a future third
  // role='admin' profile is NOT automatically trusted, unlike `isAdmin`
  // above which still means "any admin-role account" for the many
  // capabilities both trusted admins share with every other admin today.
  const isTrusted   = isTrustedAdmin(profile, user)
  const isMainAdmin = isMainAdminCheck(profile, user)
  const isAthlete = role === 'athlete'
  const isCoach   = role === 'coach'
  const activeNav = isCoach ? NAV_COACH(tx) : isAdmin ? NAV_ADMIN(tx) : isAthlete ? NAV_ATHLETE(tx) : NAV_GUEST(tx)

  const myCoachId  = profile?.coach_id || null
  const myAthleteId = profile?.athlete_id || null
  const myAthlete   = isAthlete ? athletes.find(a => String(a.id) === String(myAthleteId)) : null
  const myCoach     = myAthlete ? coaches.find(c => c.id === myAthlete.coach_id) : null
  const myAthletes    = isCoach ? athletes.filter(a => a.coach_id === myCoachId) : athletes
  const myCoachRecord = isCoach && myCoachId ? coaches.find(c => String(c.id) === String(myCoachId)) || null : null

  // My Profile should open the same detail page used elsewhere for this
  // person (athlete/coach/employee), not a separate summary view — so we
  // resolve which one applies once here and reuse it at the profile route.
  const myEmployeeRecord = (role === 'employee' || role === 'admin') && profile?.employee_id
    ? employees.find(e => String(e.id) === String(profile.employee_id)) || null
    : null
  // Same coach-designation list Employees.jsx already uses to decide when an
  // employee record should really open the combined Coaches detail page.
  const PROFILE_COACH_DESIGNATIONS = ['Coach', 'Assistant Coach', 'Technical Expert', 'Physiotherapist', 'Doctor']
  const myEmployeeAsCoach = myEmployeeRecord && PROFILE_COACH_DESIGNATIONS.includes(myEmployeeRecord.designation)
    ? coaches.find(c =>
        c.status !== 'Inactive' && (
          (myEmployeeRecord.qss_number && c.qss_number && c.qss_number === myEmployeeRecord.qss_number) ||
          (myEmployeeRecord.name && c.name && c.name.trim().toLowerCase() === myEmployeeRecord.name.trim().toLowerCase())
        )
      ) || null
    : null

  // Block pending/rejected (admins always pass)
  // A signed-in auth user with no matching profiles row at all (e.g. their account
  // was rejected and then deleted, but the underlying auth login still exists) is
  // a distinct case from pending/rejected — they were never just "waiting", and
  // calling it either would be misleading. Give it its own explicit message.
  if (!isAdmin && !profile && signingUp) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ display:'flex', gap:5, marginBottom:16, justifyContent:'center' }}>
          {['#EE334E','#0085C7','#009F6B'].map(c => <div key={c} style={{ width:14, height:14, borderRadius:'50%', background:c }} />)}
        </div>
        <div style={{ fontSize:14, color:'var(--text2)' }}>Setting up your account…</div>
      </div>
    </div>
  )
  if (!isAdmin && !profile) return <NoProfileScreen />
  if (!isAdmin && userStatus === 'pending')  return <PendingScreen />
  if (!isAdmin && userStatus === 'rejected') return <RejectedScreen profile={profile} />

  const roleColor = ROLE_COLORS[role]
  const roleIcon  = ROLE_ICONS[role]
  const userName  = profile?.full_name || (user.email?.endsWith('@qpc-system.qa') ? user.email.replace('@qpc-system.qa','') : user.email)
  const userPhoto = (() => {
    if (isAthlete && myAthleteId) {
      const a = athletes.find(a => String(a.id) === String(myAthleteId))
      return a?.photo_url || null
    }
    if (isCoach && profile?.coach_id) {
      const c = coaches.find(c => String(c.id) === String(profile.coach_id))
      return c?.photo_url || null
    }
    if (role === 'employee' && profile?.employee_id) {
      const e = employees.find(e => String(e.id) === String(profile.employee_id))
      return e?.photo_url || null
    }
    return null
  })()

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
          {activeNav.map(({ section, items }) => {
            const isCollapsed = !!collapsedSections[section]
            return (
              <div key={section}>
                <div className="nav-section" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}
                  onClick={() => setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }))}>
                  <span>{section}</span>
                  <i className={`ti ti-chevron-${isCollapsed ? (lang==='ar' ? 'left' : 'right') : 'down'}`} style={{ fontSize:13, flexShrink:0 }} />
                </div>
                {!isCollapsed && items.map(({ id, icon, label }) => (
                  <div key={id} className={`nav-item${page===id?' active':''}`}
                    onClick={() => {
                      setNavState({ reset: true })
                      if ((id === 'schedule' || id === 'attendance') ) setRefreshToken(t => t + 1)
                      setPage(id)
                      setSidebarOpen(false)
                    }}>
                    <i className={`ti ${icon}`} />
                    {label}
                    {id==='events' && upcomingCount>0 && <span className="nav-badge">{upcomingCount}</span>}
                    {id==='notifications' && notifCount>0 && <span className="nav-badge">{notifCount}</span>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,.07)' }}>
          <div
            onClick={() => { setNavState({ reset: true }); setPage('profile'); setSidebarOpen(false) }}
            style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10, cursor:'pointer', borderRadius:9, padding:'6px 8px', margin:'0 -8px 10px', transition:'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.08)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
            title="Go to My Profile"
          >
            <div style={{ position:'relative', flexShrink:0 }}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:roleColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'#fff', overflow:'hidden', border:`2px solid ${roleColor}40` }}>
                {userPhoto
                  ? <img src={userPhoto} alt={userName} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center' }} />
                  : userName.charAt(0).toUpperCase()
                }
              </div>
              <div style={{ position:'absolute', bottom:0, right:0, width:9, height:9, borderRadius:'50%', background:'#22c55e', border:'2px solid #0f1923' }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'#fff', fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{userName}</div>
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                <i className={`ti ${roleIcon}`} style={{ fontSize:10, color:roleColor }} />
                <span style={{ color:roleColor, fontSize:10, fontWeight:500, textTransform:'capitalize' }}>{role}</span>
              </div>
            </div>
            <i className="ti ti-chevron-right" style={{ fontSize:12, color:'rgba(255,255,255,.3)', flexShrink:0 }} />
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
            <span>{lang==='ar'?'QPC':'QPC'}</span> · <span>{tx(`pages.${page}`, page.charAt(0).toUpperCase()+page.slice(1))}</span><span className="hide-mobile"> · {tx('nav.season','Season')} {getCurrentSeason()}</span>
          </div></div>
          <div className="tb-actions">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="refresh-btn"
              title={lang==='ar' ? 'تحديث' : 'Refresh'}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', cursor: isRefreshing ? 'default' : 'pointer', flexShrink:0 }}>
              <i className="ti ti-refresh" style={{ fontSize:16, color:'var(--text2)', display:'inline-block', animation: isRefreshing ? 'spin 0.6s linear infinite' : 'none' }} />
            </button>
            <div className="role-badge-text" style={{ display:'flex', alignItems:'center', padding:'4px 10px', background:roleColor+'15', border:`1px solid ${roleColor}40`, borderRadius:20, fontSize:11, color:roleColor, fontWeight:600, flexShrink:0, whiteSpace:'nowrap' }}>
              {role.charAt(0).toUpperCase()+role.slice(1)}
            </div>
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="lang-btn"
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px solid var(--border)', background: lang === 'ar' ? '#0085C7' : 'var(--surface)', color: lang === 'ar' ? '#fff' : 'var(--text2)', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .15s', fontFamily:'DM Sans, sans-serif' }}
              title="Switch language">
              {lang === 'en' ? 'عربي' : 'EN'}
            </button>
            <NotificationBell isAdmin={isAdmin} userId={profile?.id} />
          </div>
        </div>
        <div id="content">
          {page==='dashboard' && !isCoach && <Dashboard athletes={myAthletes} coaches={coaches} employees={employees} referees={referees} events={events} results={results} pendingRequestsCount={pendingRequestsCount} pendingAccountsCount={pendingAccountsCount} onNav={goTo} profile={profile} />}
          {page==='dashboard' && isCoach  && <CoachDashboard coach={myCoachRecord} athletes={myAthletes} events={events} results={results} onNav={goTo} profile={profile} />}
          {page==='athletes'  && <Athletes  athletes={myAthletes} coaches={coaches} employees={employees} results={results} documents={documents} events={events} registrations={registrations} onRefresh={fetchAll} onNav={goTo} initAthleteId={navState.athleteId} initStatusFilter={navState.statusFilter} navState={navState} profile={profile} />}
          {page==='coaches'   && isAdmin && <Coaches   coaches={coaches} athletes={athletes} employees={employees} personDocs={personDocs} onRefresh={fetchAll} onNav={goTo} initCoachId={navState.coachId} navState={navState} profile={profile} />}
          {page==='events'    && <Events    events={events} athletes={athletes} results={results} registrations={registrations} onRefresh={fetchAll} onNav={goTo} initEventId={navState.eventId} initStatusFilter={navState.statusFilter} profile={profile} />}
          {page==='schedule'  && <Schedule  key={`schedule-${refreshToken}`} profile={profile} coachId={isAdmin ? null : myCoachId} myAthletes={myAthletes} athletes={athletes} coaches={coaches} onNav={goTo} readOnly={isAthlete} viewOnly={isAdmin} athleteId={isAthlete ? myAthleteId : null} initSessionId={navState?.sessionId} initCoachFilter={navState?.coachFilter} />}
          {page==='attendance' && <Attendance key={`attendance-${refreshToken}`} profile={profile} coachId={isAdmin ? null : myCoachId} myAthletes={myAthletes} onNav={goTo} viewOnly={isAdmin} initSessionId={navState.sessionId} />}
          {page==='users'     && isAdmin && <UserManagement profile={profile} initUserId={navState?.userId} />}
          {page==='athlete-dashboard' && <AthleteDashboard athlete={myAthlete} coach={myCoach} results={results} events={events} registrations={registrations} onNav={goTo} profile={profile} />}
          {page==='athlete-events'    && <AthleteEvents athlete={myAthlete} events={events} registrations={registrations} results={results} />}
          {page==='athlete-results'   && <AthleteResults athlete={myAthlete} results={results} />}
          {page==='settings'  && <Settings user={user} profile={profile} signOut={signOut} />}
          {/* My Profile: open the same detail page this person already has
              elsewhere (athlete / combined coach / employee), instead of a
              separate summary — falls back to the generic Profile page only
              when there's no matching record (e.g. guest accounts). */}
          {page==='profile' && isAthlete && myAthlete && (
            <Athletes athletes={[myAthlete]} coaches={coaches} employees={employees} results={results} documents={documents} events={events} registrations={registrations} onRefresh={fetchAll} onNav={goTo} initAthleteId={myAthlete.id} navState={navState} profile={profile} />
          )}
          {page==='profile' && isCoach && myCoachRecord && (
            <Coaches coaches={[myCoachRecord]} athletes={athletes.filter(a => a.coach_id === myCoachRecord.id)} employees={employees} personDocs={personDocs} onRefresh={fetchAll} onNav={goTo} initCoachId={myCoachRecord.id} navState={navState} profile={profile} />
          )}
          {page==='profile' && !isAthlete && !isCoach && myEmployeeAsCoach && (
            <Coaches coaches={[myEmployeeAsCoach]} athletes={athletes.filter(a => a.coach_id === myEmployeeAsCoach.id)} employees={employees} personDocs={personDocs} onRefresh={fetchAll} onNav={goTo} initCoachId={myEmployeeAsCoach.id} navState={navState} profile={profile} />
          )}
          {page==='profile' && !isAthlete && !isCoach && !myEmployeeAsCoach && myEmployeeRecord && (
            <Employees employees={[myEmployeeRecord]} coaches={coaches} personDocs={personDocs} onRefresh={fetchAll} onNav={goTo} initEmployeeId={myEmployeeRecord.id} navState={navState} profile={profile} />
          )}
          {page==='profile' && !(isAthlete && myAthlete) && !(isCoach && myCoachRecord) && !myEmployeeAsCoach && !myEmployeeRecord && (
            <Profile user={user} profile={profile} athletes={athletes} coaches={coaches} employees={employees} results={results} onNav={goTo} documents={documents} personDocs={personDocs} onRefresh={fetchAll} />
          )}
          {page==='notifications' && <Notifications profile={profile} onNav={goTo} />}
          {page==='resources'     && <Resources profile={profile} onRefresh={fetchAll} />}
          {page==='requests'     && <Requests  profile={profile} onNav={goTo} navState={navState} />}
          {page==='away' && isAdmin && <Away athletes={athletes} coaches={coaches} employees={employees} onNav={goTo} profile={profile} />}
          {page==='tasks'         && <Tasks profile={profile} isMainAdmin={isMainAdmin} onNav={goTo} />}
          {page==='referees'  && isAdmin && <Referees referees={referees} onRefresh={fetchAll} profile={profile} />}
          {page==='results'   && <Results   results={results} athletes={athletes} onRefresh={fetchAll} onNav={goTo} profile={profile} />}
          {page==='sports'    && isAdmin && <Sports    athletes={athletes} coaches={coaches} events={events} results={results} onNav={goTo} initSport={navState.sport} initCategory={navState.category} profile={profile} />}
          {page==='employees' && isAdmin && <Employees employees={employees} coaches={coaches} personDocs={personDocs} onRefresh={fetchAll} onNav={goTo} initEmployeeId={navState.employeeId} navState={navState} profile={profile} />}
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

function NoProfileScreen() {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const { signOut } = useAuth()
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'var(--bg)', direction:ar?'rtl':'ltr' }}>
      <div style={{ fontSize:48 }}>⚠️</div>
      <div style={{ fontSize:20, fontWeight:700 }}>{ar?'لا يوجد حساب نشط':'No Active Account Found'}</div>
      <div style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:320 }}>
        {ar?'لم يتم العثور على حساب مرتبط بهذا الدخول. قد يكون حسابك قد أُزيل. يرجى التواصل مع المسؤول أو تسجيل طلب جديد.':"We couldn't find an account linked to this login — it may have been removed. Please contact the administrator, or sign out and submit a new request."}
      </div>
      <button onClick={signOut} style={{ marginTop:8, padding:'9px 24px', background:'#EE334E', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:14 }}>
        {ar?'تسجيل الخروج':'Sign Out'}
      </button>
    </div>
  )
}

function RejectedScreen({ profile }) {
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
      {profile?.rejection_reason && (
        <div style={{ fontSize:13, color:'var(--text2)', textAlign:'center', maxWidth:320, background:'var(--surface2)', borderRadius:10, padding:'10px 16px' }}>
          <strong>{ar?'السبب: ':'Reason: '}</strong>{profile.rejection_reason}
        </div>
      )}
      <button onClick={signOut} style={{ marginTop:8, padding:'9px 24px', background:'#EE334E', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:14 }}>
        {ar?'تسجيل الخروج':'Sign Out'}
      </button>
    </div>
  )
}
