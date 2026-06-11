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

export default function NotificationBell({ isAdmin }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [open, setOpen]           = useState(false)
  const [pending, setPending]     = useState([])
  const [permission, setPermission] = useState(getNotificationPermission())
  const ref                       = useRef(null)
  const prevCountRef              = useRef(0)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Load pending requests and subscribe to changes
  useEffect(() => {
    if (!isAdmin) return
    loadPending()

    // Real-time subscription — fires when profiles table changes
    const sub = supabase
      .channel('profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadPending()
      })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [isAdmin])

  async function loadPending() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, account_type, requested_at, email')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })

    const list = data || []
    setPending(list)

    // Send push notification if count increased
    if (list.length > prevCountRef.current && prevCountRef.current >= 0) {
      const newCount = list.length - prevCountRef.current
      if (Notification.permission === 'granted' && getNotificationPreference() === 'enabled') {
        sendNotification(
          L(`${newCount} New Access Request`, `${newCount} طلب وصول جديد`),
          list[0] ? L(
            `${list[0].full_name || list[0].email} wants to join as ${list[0].account_type}`,
            `${list[0].full_name || ''} يريد الانضمام كـ ${list[0].account_type}`
          ) : '',
          { tag: 'new-request', requireInteraction: true, url: '/?page=users' }
        )
      }
    }
    prevCountRef.current = list.length
  }

  async function enableNotifications() {
    const granted = await requestNotificationPermission()
    setPermission(granted ? 'granted' : 'denied')
    if (granted) {
      saveNotificationPreference(true)
      sendNotification(
        L('Notifications Enabled', 'تم تفعيل الإشعارات'),
        L('You will be notified when new access requests arrive.', 'ستتلقى إشعاراً عند وصول طلبات وصول جديدة.')
      )
    }
  }

  if (!isAdmin) return null

  return (
    <div ref={ref} style={{ position:'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position:'relative', background:'transparent', border:'none',
          cursor:'pointer', padding:'6px 8px', borderRadius:8,
          color:'var(--text2)', fontSize:18, display:'flex', alignItems:'center',
          transition:'background .15s',
        }}
        title={L('Notifications', 'الإشعارات')}
      >
        <i className="ti ti-bell" />
        {pending.length > 0 && (
          <span style={{
            position:'absolute', top:2, right:2,
            background:'#EE334E', color:'#fff',
            borderRadius:'50%', width:16, height:16,
            fontSize:10, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
            lineHeight:1,
          }}>
            {pending.length > 9 ? '9+' : pending.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)',
          right: ar ? 'auto' : 0, left: ar ? 0 : 'auto',
          width:320, background:'var(--surface)',
          border:'1px solid var(--border)', borderRadius:14,
          boxShadow:'0 8px 32px rgba(0,0,0,.2)',
          zIndex:1000, overflow:'hidden',
        }}>
          {/* Header */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:13, fontWeight:600 }}>
              {L('Access Requests', 'طلبات الوصول')}
              {pending.length > 0 && (
                <span style={{ marginLeft:6, background:'#EE334E20', color:'#EE334E', borderRadius:20, padding:'2px 8px', fontSize:11 }}>
                  {pending.length}
                </span>
              )}
            </div>
            {/* Enable notifications button */}
            {permission !== 'granted' && (
              <button
                onClick={enableNotifications}
                style={{ fontSize:11, background:'#0085C720', color:'#0085C7', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer' }}
              >
                <i className="ti ti-bell-ringing" style={{ marginRight:3 }} />
                {L('Enable alerts', 'تفعيل التنبيهات')}
              </button>
            )}
            {permission === 'granted' && (
              <span style={{ fontSize:11, color:'#009F6B', display:'flex', alignItems:'center', gap:3 }}>
                <i className="ti ti-bell-check" /> {L('Alerts on', 'التنبيهات مفعّلة')}
              </span>
            )}
          </div>

          {/* Pending list */}
          {pending.length === 0 ? (
            <div style={{ padding:24, textAlign:'center', color:'var(--text3)', fontSize:13 }}>
              {L('No pending requests', 'لا توجد طلبات معلقة')}
            </div>
          ) : (
            <div style={{ maxHeight:320, overflowY:'auto' }}>
              {pending.map(u => (
                <div key={u.id} style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', gap:10, alignItems:'center' }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'#0085C720', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#0085C7', flexShrink:0 }}>
                    {(u.full_name || u.email || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {u.full_name || u.email || L('Unknown', 'غير معروف')}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                      {u.account_type} · {new Date(u.requested_at).toLocaleDateString(ar ? 'ar-QA' : 'en-GB')}
                    </div>
                  </div>
                  <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, background:'#f59e0b20', color:'#f59e0b', fontWeight:600, flexShrink:0 }}>
                    {L('Pending', 'معلق')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          {pending.length > 0 && (
            <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', textAlign:'center' }}>
              <a
                href="/?page=users"
                onClick={e => { e.preventDefault(); setOpen(false); window.dispatchEvent(new CustomEvent('navigate', { detail: 'users' })) }}
                style={{ fontSize:12, color:'#0085C7', textDecoration:'none', fontWeight:600 }}
              >
                {L('Review all requests →', 'مراجعة جميع الطلبات ←')}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
