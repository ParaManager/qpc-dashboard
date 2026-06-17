import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import {
  requestNotificationPermission,
  getNotificationPermission,
  sendNotification,
  saveNotificationPreference,
  getNotificationPreference,
} from '../lib/notifications'

export default function NotificationBell({ isAdmin, userId }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [open, setOpen]               = useState(false)
  const [pending, setPending]         = useState([])
  const [notifications, setNotifs]    = useState([])
  const [permission, setPermission]   = useState(getNotificationPermission())
  const ref                           = useRef(null)
  const prevCountRef                  = useRef(0)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Load data and subscribe
  useEffect(() => {
    if (isAdmin) loadPending()
    if (userId)  loadNotifications()

    const channels = []

    if (isAdmin) {
      const sub = supabase.channel('profiles-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadPending())
        .subscribe()
      channels.push(sub)
    }

    if (userId) {
      const subN = supabase.channel(`notifs-${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => loadNotifications())
        .subscribe()
      channels.push(subN)
    }

    return () => channels.forEach(c => supabase.removeChannel(c))
  }, [isAdmin, userId])

  async function loadPending() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, account_type, requested_at, email')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
    const list = data || []
    setPending(list)
    if (list.length > prevCountRef.current && Notification.permission === 'granted' && getNotificationPreference() === 'enabled') {
      sendNotification(L(`${list.length} New Access Request`, `${list.length} طلب وصول جديد`), list[0]?.full_name || '', { tag:'new-request', requireInteraction:true })
    }
    prevCountRef.current = list.length
  }

  async function loadNotifications() {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', String(userId))
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifs(data || [])
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function markAllRead() {
    if (!userId) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', String(userId)).eq('read', false)
    setNotifs([])
  }

  async function enableNotifications() {
    const granted = await requestNotificationPermission()
    setPermission(granted ? 'granted' : 'denied')
    if (granted) {
      saveNotificationPreference(true)
      sendNotification(L('Notifications Enabled', 'تم تفعيل الإشعارات'), L('You will be notified of new updates.', 'ستتلقى إشعارات عند وصول تحديثات جديدة.'))
    }
  }

  const totalCount = pending.length + notifications.length

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
        <div style={{ position:'absolute', top:'calc(100% + 8px)', right: ar?'auto':0, left: ar?0:'auto', width:320, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, boxShadow:'0 8px 32px rgba(0,0,0,.2)', zIndex:1000, overflow:'hidden' }}>

          {/* Header */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:13, fontWeight:600 }}>
              {L('Notifications', 'الإشعارات')}
              {totalCount > 0 && <span style={{ marginLeft:6, background:'#EE334E20', color:'#EE334E', borderRadius:20, padding:'2px 8px', fontSize:11 }}>{totalCount}</span>}
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {notifications.length > 0 && (
                <button onClick={markAllRead} style={{ fontSize:11, color:'#0085C7', background:'none', border:'none', cursor:'pointer' }}>
                  {L('Mark all read', 'تحديد الكل كمقروء')}
                </button>
              )}
              {permission !== 'granted' && (
                <button onClick={enableNotifications} style={{ fontSize:11, background:'#0085C720', color:'#0085C7', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer' }}>
                  <i className="ti ti-bell-ringing" /> {L('Enable', 'تفعيل')}
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
                  markRead(n.id)
                  const sessionId = n.data?.session_id
                  if (n.type === 'needs_attendance' || n.type === 'needs_closing') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'attendance', sessionId } }))
                  } else if (n.type==='excuse_request' || n.type==='session_added' || n.type==='request_approved' || n.type==='request_rejected') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'schedule', sessionId } }))
                  } else if (n.type==='access_request') {
                    window.dispatchEvent(new CustomEvent('navigate', { detail: { page:'users' } }))
                  }
                }}
                style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', gap:10, alignItems:'flex-start', background:'#0085C705', cursor:'pointer', transition:'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background='#0085C705'}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: n.type==='excuse_request'?'#f59e0b':n.type==='session_added'?'#009F6B':n.type==='needs_attendance'?'#f59e0b':n.type==='needs_closing'?'#0085C7':'#0085C7', flexShrink:0, marginTop:5 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{n.title}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{n.body}</div>
                  <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>{new Date(n.created_at).toLocaleDateString(ar?'ar-QA':'en-GB')}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); markRead(n.id) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, padding:0, flexShrink:0 }}>×</button>
              </div>
            ))}

            {/* Admin: pending access requests */}
            {isAdmin && pending.length > 0 && (
              <>
                {notifications.length > 0 && <div style={{ padding:'6px 16px', fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', background:'var(--surface2)' }}>{L('Access Requests','طلبات الوصول')}</div>}
                {pending.map(u => (
                  <div key={u.id} style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', gap:10, alignItems:'center' }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'#0085C720', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#0085C7', flexShrink:0 }}>
                      {(u.full_name||u.email||'?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.full_name||u.email}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{u.account_type} · {new Date(u.requested_at).toLocaleDateString(ar?'ar-QA':'en-GB')}</div>
                    </div>
                    <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'#f59e0b20', color:'#f59e0b', fontWeight:600, flexShrink:0 }}>{L('Pending','معلق')}</span>
                  </div>
                ))}
              </>
            )}

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
          {isAdmin && pending.length > 0 && (
            <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', textAlign:'center' }}>
              <a href="#" onClick={e => { e.preventDefault(); setOpen(false); window.dispatchEvent(new CustomEvent('navigate', { detail: 'users' })) }}
                style={{ fontSize:12, color:'#0085C7', textDecoration:'none', fontWeight:600 }}>
                {L('Review all requests →','مراجعة جميع الطلبات ←')}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
