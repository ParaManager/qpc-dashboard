import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { renderNotificationText } from '../lib/helpers'
import {
  requestNotificationPermission,
  getNotificationPermission,
  sendNotification,
  saveNotificationPreference,
  hasActivePushSubscription,
  disablePushNotifications,
  isPushSupported,
} from '../lib/notifications'

export default function NotificationBell({ isAdmin, userId }) {
  const { lang, tx } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [open, setOpen]               = useState(false)
  const [notifications, setNotifs]    = useState([])
  const [permission, setPermission]   = useState(getNotificationPermission())
  const [hasSubscription, setHasSubscription] = useState(false)
  const ref                           = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Load data and subscribe
  useEffect(() => {
    if (userId)  loadNotifications()

    const channels = []

    if (userId) {
      const subN = supabase.channel(`notifs-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => loadNotifications())
        .subscribe()
      channels.push(subN)
    }

    return () => channels.forEach(c => supabase.removeChannel(c))
  }, [userId])

  // OS-level permission alone doesn't mean push is actually wired up on this
  // device — someone could have granted permission under the old, non-functional
  // version of this feature with no real subscription behind it. Check the
  // genuine subscription state so the button reflects reality.
  useEffect(() => {
    hasActivePushSubscription().then(setHasSubscription)
  }, [])

  async function loadNotifications() {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', String(userId))
      .eq('dismissed', false)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifs(data || [])
  }

  async function dismiss(id) {
    await supabase.from('notifications').update({ dismissed: true, read: true }).eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function dismissAll() {
    if (!userId) return
    await supabase.from('notifications')
      .update({ dismissed: true, read: true })
      .eq('user_id', String(userId))
      .eq('dismissed', false)
    setNotifs([])
  }

  async function enableNotifications() {
    const granted = await requestNotificationPermission(userId)
    setPermission(granted ? 'granted' : 'denied')
    if (granted) {
      setHasSubscription(true)
      saveNotificationPreference(true)
      sendNotification(L('Notifications Enabled', 'تم تفعيل الإشعارات'), L('You will be notified of new updates, even when the app is closed.', 'ستتلقى إشعارات عند وصول تحديثات جديدة، حتى عند إغلاق التطبيق.'))
    }
  }

  const totalCount = notifications.filter(n => !n.read).length

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ position:'relative', background:'transparent', border:'none', cursor:'pointer', padding:'6px 8px', borderRadius:8, color:'var(--text2)', fontSize:18, display:'flex', alignItems:'center' }}>
        <i className="ti ti-bell" />
        {totalCount > 0 && (
          <span style={{ position:'absolute', top:2, right:2, background:'#EE334E', color:'#fff', borderRadius:'50%', width:16, height:16, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right: ar?'auto':0, left: ar?0:'auto', width:320, maxWidth:'calc(100vw - 24px)', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, boxShadow:'0 8px 32px rgba(0,0,0,.2)', zIndex:1000, overflow:'hidden' }}>

          {/* Header */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:13, fontWeight:600 }}>
              {L('Notifications', 'الإشعارات')}
              {totalCount > 0 && <span style={{ marginLeft:6, background:'#EE334E20', color:'#EE334E', borderRadius:20, padding:'2px 8px', fontSize:11 }}>{totalCount}</span>}
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {notifications.length > 0 && (
                <button onClick={dismissAll} style={{ fontSize:11, color:'#0085C7', background:'none', border:'none', cursor:'pointer' }}>
                  {L('Clear all', 'مسح الكل')}
                </button>
              )}
              {!hasSubscription ? (
                isPushSupported() ? (
                  <button onClick={enableNotifications} style={{ fontSize:11, background:'#0085C720', color:'#0085C7', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer' }}>
                    <i className="ti ti-bell-ringing" /> {L('Enable', 'تفعيل')}
                  </button>
                ) : null
              ) : (
                <button
                  onClick={async () => { await disablePushNotifications(); setHasSubscription(false); saveNotificationPreference(false) }}
                  title={L('Click to turn off notifications on this device', 'انقر لإيقاف الإشعارات على هذا الجهاز')}
                  style={{ fontSize:11, background:'#009F6B15', color:'#009F6B', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                  <i className="ti ti-bell-check" /> {L('On', 'مفعّل')}
                </button>
              )}
            </div>
          </div>

          <div style={{ maxHeight:400, overflowY:'auto' }}>
            {/* Personal notifications */}
            {notifications.map(n => (
              <div key={n.id} 
                onClick={() => {
                  setOpen(false)
                  // Clicking through marks it seen, but never affects whether the underlying
                  // thing is resolved — dashboard banners track resolution separately.
                  supabase.from('notifications').update({ read: true }).eq('id', n.id)
                  const sessionId = n.data?.session_id
                  if (n.type === 'needs_attendance') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'attendance', sessionId } }))
                  } else if (n.type==='excuse_request' || n.type==='session_added' || n.type==='request_approved' || n.type==='request_rejected') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'schedule', sessionId } }))
                  } else if (n.type==='timetable_created') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'schedule' } }))
                  } else if (n.type==='access_request') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'users', userId: n.data?.applicant_id } }))
                  } else if (n.type==='account_approved' || n.type==='account_rejected') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'dashboard' } }))
                  } else if (n.type==='request') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'requests' } }))
                  } else if (n.type==='resource_added') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'resources' } }))
                  } else if (n.type==='import_succeeded' || n.type==='import_failed') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'athletes' } }))
                  } else if (n.type==='task_due_tomorrow' || n.type==='task_due_today' || n.type==='task_overdue') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'tasks' } }))
                  } else if (n.type==='away_start' || n.type==='away_end') {
                    const entityPage = n.related_entity_type==='coach' ? 'coaches' : n.related_entity_type==='employee' ? 'employees' : 'athletes'
                    const idParam = n.related_entity_type==='coach' ? 'coachId' : n.related_entity_type==='employee' ? 'employeeId' : 'athleteId'
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page: n.target_path || entityPage, [idParam]: n.related_entity_id } }))
                  } else if (n.type==='document_expiring' || n.type==='document_expired') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'athletes', athleteId: n.related_entity_id } }))
                  }
                }}
                style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', gap:10, alignItems:'flex-start', background:'#0085C705', cursor:'pointer', transition:'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background='#0085C705'}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: (
                  n.type==='excuse_request'?'#f59e0b':n.type==='session_added'?'#009F6B':n.type==='needs_attendance'?'#f59e0b':
                  n.type==='timetable_created'?'#8b5cf6':n.type==='account_rejected'?'#EE334E':n.type==='account_approved'?'#009F6B':
                  n.type==='request'?'#0085C7':n.type==='resource_added'?'#0085C7':
                  n.type==='import_succeeded'?'#009F6B':n.type==='import_failed'?'#EE334E':
                  n.type==='task_due_tomorrow'?'#f59e0b':n.type==='task_due_today'?'#f59e0b':n.type==='task_overdue'?'#EE334E':
                  n.type==='away_start'?'#d97706':n.type==='away_end'?'#009F6B':
                  n.type==='document_expiring'?'#f59e0b':n.type==='document_expired'?'#EE334E':
                  '#0085C7'
                ), flexShrink:0, marginTop:5 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{renderNotificationText(n, tx, L).title}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{renderNotificationText(n, tx, L).body}</div>
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>{new Date(n.created_at).toLocaleDateString(ar?'ar-QA':'en-GB')}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); dismiss(n.id) }}
                  title={L('Clear from bell','مسح من الجرس')}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, padding:0, flexShrink:0 }}>×</button>
              </div>
            ))}

            {totalCount === 0 && (
              <div style={{ padding:24, textAlign:'center', color:'var(--text3)', fontSize:13 }}>
                {L('No new notifications','لا توجد إشعارات جديدة')}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', textAlign:'center' }}>
              <a href="#" onClick={e => { e.preventDefault(); setOpen(false); window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'notifications' } })) }}
                style={{ fontSize:12, color:'#0085C7', textDecoration:'none', fontWeight:600 }}>
                {L('View all notifications →','عرض جميع الإشعارات ←')}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
