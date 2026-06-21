import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import {
  requestNotificationPermission,
  getNotificationPermission,
  sendNotification,
  saveNotificationPreference,
} from '../lib/notifications'

export default function NotificationBell({ isAdmin, userId }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [open, setOpen]               = useState(false)
  const [notifications, setNotifs]    = useState([])
  const [permission, setPermission]   = useState(getNotificationPermission())
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
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => loadNotifications())
        .subscribe()
      channels.push(subN)
    }

    return () => channels.forEach(c => supabase.removeChannel(c))
  }, [userId])

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
    const granted = await requestNotificationPermission()
    setPermission(granted ? 'granted' : 'denied')
    if (granted) {
      saveNotificationPreference(true)
      sendNotification(L('Notifications Enabled', 'تم تفعيل الإشعارات'), L('You will be notified of new updates.', 'ستتلقى إشعارات عند وصول تحديثات جديدة.'))
    }
  }

  const totalCount = notifications.length

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
                  }
                }}
                style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', gap:10, alignItems:'flex-start', background:'#0085C705', cursor:'pointer', transition:'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background='#0085C705'}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: n.type==='excuse_request'?'#f59e0b':n.type==='session_added'?'#009F6B':n.type==='needs_attendance'?'#f59e0b':n.type==='timetable_created'?'#8b5cf6':n.type==='account_rejected'?'#EE334E':n.type==='account_approved'?'#009F6B':'#0085C7', flexShrink:0, marginTop:5 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{n.title}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{n.body}</div>
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
