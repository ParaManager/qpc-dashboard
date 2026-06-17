import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'

const TYPE_META = {
  excuse_request:     { icon:'ti-clock',           color:'#f59e0b' },
  session_added:      { icon:'ti-calendar-plus',   color:'#009F6B' },
  request_approved:   { icon:'ti-circle-check',    color:'#009F6B' },
  request_rejected:   { icon:'ti-circle-x',        color:'#EE334E' },
  needs_attendance:   { icon:'ti-clipboard-check', color:'#f59e0b' },
  needs_closing:      { icon:'ti-lock-open',        color:'#0085C7' },
  access_request:     { icon:'ti-user-plus',        color:'#0085C7' },
}

export default function Notifications({ profile, onNav }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'unread'

  useEffect(() => { load() }, [profile?.id])

  async function load() {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', String(profile.id))
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifs(data || [])
    setLoading(false)
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function deleteNotif(id) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function markAllRead() {
    const unreadIds = notifs.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  function handleClick(n) {
    if (!n.read) markRead(n.id)
    const sessionId = n.data?.session_id
    if (['needs_attendance', 'needs_closing'].includes(n.type)) {
      onNav('attendance', sessionId ? { sessionId } : {})
    } else if (['excuse_request','session_added','request_approved','request_rejected'].includes(n.type)) {
      onNav('schedule', sessionId ? { sessionId } : {})
    } else if (n.type === 'access_request') {
      onNav('users', {})
    }
  }

  const visible = filter === 'unread' ? notifs.filter(n => !n.read) : notifs

  // Group session-reminder types (needs_attendance / needs_closing) into one row per type,
  // since these can pile up to one-per-session and shouldn't clutter the list individually.
  const GROUPED_TYPES = ['needs_attendance', 'needs_closing']
  const groupedNotifs = visible.filter(n => GROUPED_TYPES.includes(n.type))
  const individualNotifs = visible.filter(n => !GROUPED_TYPES.includes(n.type))

  const groups = GROUPED_TYPES.map(type => {
    const items = groupedNotifs.filter(n => n.type === type)
    if (items.length === 0) return null
    return {
      type,
      items,
      latestCreatedAt: items[0]?.created_at,
      anyUnread: items.some(n => !n.read),
    }
  }).filter(Boolean)

  const unreadCount = notifs.filter(n => !n.read).length

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{L('Notifications','الإشعارات')}</div>
          <div className="page-sub">
            {unreadCount > 0
              ? L(`${unreadCount} unread`, `${unreadCount} غير مقروء`)
              : L('All caught up','لا توجد إشعارات جديدة')}
          </div>
        </div>
        {unreadCount > 0 && (
          <button className="action-btn" onClick={markAllRead}>
            <i className="ti ti-checks" /> {L('Mark all read','تحديد الكل كمقروء')}
          </button>
        )}
      </div>

      <div style={{ display:'flex', gap:6, background:'var(--surface2)', borderRadius:10, padding:4, marginBottom:16, width:'fit-content' }}>
        {[['all',L('All','الكل')],['unread',L('Unread','غير مقروء')]].map(([key,label]) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{ padding:'6px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
              background: filter===key ? 'var(--surface)' : 'transparent',
              color: filter===key ? 'var(--text)' : 'var(--text3)',
              boxShadow: filter===key ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? (
          <div className="empty" style={{ padding:32 }}>{L('Loading…','جارٍ التحميل…')}</div>
        ) : (groups.length === 0 && individualNotifs.length === 0) ? (
          <div className="empty" style={{ padding:32 }}>
            <i className="ti ti-bell-off" style={{ fontSize:28, marginBottom:8 }} />
            <div>{filter === 'unread' ? L('No unread notifications','لا توجد إشعارات غير مقروءة') : L('No notifications yet','لا توجد إشعارات بعد')}</div>
          </div>
        ) : (
          <>
            {groups.map(g => {
              const meta = TYPE_META[g.type] || { icon:'ti-bell', color:'#9aa3b2' }
              const isAttendance = g.type === 'needs_attendance'
              const title = g.items.length === 1
                ? (isAttendance ? L('1 session needs attendance','جلسة واحدة بحاجة لتسجيل الحضور') : L('1 session is ready to close','جلسة واحدة جاهزة للإغلاق'))
                : (isAttendance ? L(`${g.items.length} sessions need attendance`,`${g.items.length} جلسات بحاجة لتسجيل الحضور`) : L(`${g.items.length} sessions are ready to close`,`${g.items.length} جلسات جاهزة للإغلاق`))
              return (
                <div key={g.type} style={{ borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'14px 16px', background: g.anyUnread ? meta.color+'08' : 'transparent' }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:meta.color+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <i className={`ti ${meta.icon}`} style={{ fontSize:17, color:meta.color }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{title}</div>
                        {g.anyUnread && <div style={{ width:7, height:7, borderRadius:'50%', background:meta.color, flexShrink:0 }} />}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:5 }}>
                        {new Date(g.latestCreatedAt).toLocaleString(ar?'ar-QA':'en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                    <button onClick={() => { g.items.forEach(n => { if (!n.read) markRead(n.id) }) }}
                      title={L('Mark all as read','تحديد الكل كمقروء')}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, flexShrink:0, padding:4 }}>
                      <i className="ti ti-checks" />
                    </button>
                    <button onClick={() => { g.items.forEach(n => deleteNotif(n.id)) }}
                      title={L('Delete all','حذف الكل')}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, flexShrink:0, padding:4 }}>
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                  <div style={{ padding:'0 16px 12px 64px', display:'flex', flexDirection:'column', gap:4 }}>
                    {g.items.map(n => (
                      <div key={n.id} onClick={() => handleClick(n)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:12 }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <span style={{ color:'var(--text2)' }}>{n.body}</span>
                        <i className="ti ti-arrow-right" style={{ fontSize:12, color:'var(--text3)' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {individualNotifs.map((n, i) => {
              const meta = TYPE_META[n.type] || { icon:'ti-bell', color:'#9aa3b2' }
              return (
                <div key={n.id} onClick={() => handleClick(n)}
                  style={{
                    display:'flex', gap:12, alignItems:'flex-start', padding:'14px 16px',
                    borderBottom: i < individualNotifs.length-1 ? '1px solid var(--border)' : 'none',
                    background: n.read ? 'transparent' : meta.color+'08',
                    cursor:'pointer', transition:'background .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background= n.read ? 'transparent' : meta.color+'08'}>
                  <div style={{ width:36, height:36, borderRadius:10, background:meta.color+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className={`ti ${meta.icon}`} style={{ fontSize:17, color:meta.color }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{n.title}</div>
                      {!n.read && <div style={{ width:7, height:7, borderRadius:'50%', background:meta.color, flexShrink:0 }} />}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>{n.body}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:5 }}>
                      {new Date(n.created_at).toLocaleString(ar?'ar-QA':'en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                  {!n.read && (
                    <button onClick={e => { e.stopPropagation(); markRead(n.id) }}
                      title={L('Mark as read','تحديد كمقروء')}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, flexShrink:0, padding:4 }}>
                      <i className="ti ti-check" />
                    </button>
                  )}
                  <button onClick={e => { e.stopPropagation(); deleteNotif(n.id) }}
                    title={L('Delete','حذف')}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, flexShrink:0, padding:4 }}>
                    <i className="ti ti-trash" />
                  </button>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
