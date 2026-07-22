import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { renderNotificationText } from '../lib/helpers'

const TYPE_META = {
  excuse_request:     { icon:'ti-clock',           color:'#f59e0b', category:'System' },
  session_added:      { icon:'ti-calendar-plus',   color:'#009F6B', category:'System' },
  timetable_created:  { icon:'ti-calendar-repeat', color:'#8b5cf6', category:'System' },
  request_approved:   { icon:'ti-circle-check',    color:'#009F6B', category:'Requests' },
  request_rejected:   { icon:'ti-circle-x',        color:'#EE334E', category:'Requests' },
  account_approved:   { icon:'ti-user-check',      color:'#009F6B', category:'Accounts' },
  account_rejected:   { icon:'ti-user-x',          color:'#EE334E', category:'Accounts' },
  needs_attendance:   { icon:'ti-clipboard-check', color:'#f59e0b', category:'System' },
  access_request:     { icon:'ti-user-plus',       color:'#0085C7', category:'Accounts' },
  request:            { icon:'ti-clipboard-text',  color:'#0085C7', category:'Requests' },
  resource_added:     { icon:'ti-folder-plus',     color:'#0085C7', category:'Resources' },
  import_succeeded:   { icon:'ti-file-check',      color:'#009F6B', category:'Documents' },
  import_failed:      { icon:'ti-file-x',          color:'#EE334E', category:'Documents' },
  task_due_tomorrow:  { icon:'ti-calendar-event',  color:'#f59e0b', category:'Tasks' },
  task_due_today:     { icon:'ti-calendar-event',  color:'#f59e0b', category:'Tasks' },
  task_overdue:       { icon:'ti-alert-triangle',  color:'#EE334E', category:'Tasks' },
  away_start:         { icon:'ti-plane-departure',  color:'#d97706', category:'Away Management' },
  away_end:           { icon:'ti-plane-arrival',    color:'#009F6B', category:'Away Management' },
  document_expiring:  { icon:'ti-file-alert',       color:'#f59e0b', category:'Documents' },
  document_expired:   { icon:'ti-file-x',           color:'#EE334E', category:'Documents' },
  admin_activity:     { icon:'ti-shield-check',     color:'#6366f1', category:'System' },
}

const CAT_AR = {
  'All': 'كل الفئات',
  'Requests': 'الطلبات',
  'Tasks': 'المهام',
  'Documents': 'الوثائق',
  'Resources': 'الموارد',
  'Away Management': 'إدارة الغياب',
  'Accounts': 'الحسابات',
  'System': 'النظام',
}

const CATEGORIES = ['All','Requests','Tasks','Documents','Resources','Away Management','Accounts','System']

export default function Notifications({ profile, onNav }) {
  const { lang, tx } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const PAGE_SIZE = 100
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' | 'unread'
  const [catFilter, setCatFilter] = useState('All')

  useEffect(() => { load() }, [profile?.id])

  async function load() {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', String(profile.id))
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)
    setNotifs(data || [])
    setHasMore((data || []).length === PAGE_SIZE)
    setLoading(false)
  }

  async function loadMore() {
    if (!profile?.id || loadingMore) return
    setLoadingMore(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', String(profile.id))
      .order('created_at', { ascending: false })
      .range(notifs.length, notifs.length + PAGE_SIZE - 1)
    setNotifs(prev => [...prev, ...(data || [])])
    setHasMore((data || []).length === PAGE_SIZE)
    setLoadingMore(false)
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function dismiss(id) {
    await supabase.from('notifications').update({ dismissed: true, read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, dismissed: true, read: true } : n))
  }

  async function deleteNotif(id) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function markAllRead() {
    const unreadIds = notifs.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    setNotifs(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, read: true } : n))
  }

  function handleClick(n) {
    if (!n.read) markRead(n.id)
    const sessionId = n.data?.session_id
    if (n.type === 'needs_attendance') {
      onNav('attendance', sessionId ? { sessionId } : {})
    } else if (['excuse_request','session_added','request_approved','request_rejected'].includes(n.type)) {
      onNav('schedule', sessionId ? { sessionId } : {})
    } else if (n.type === 'timetable_created') {
      onNav('schedule', {})
    } else if (n.type === 'access_request') {
      onNav('users', n.data?.applicant_id ? { userId: n.data.applicant_id } : {})
    } else if (n.type === 'account_approved' || n.type === 'account_rejected') {
      onNav('dashboard', {})
    } else if (n.type === 'request') {
      onNav('requests', {})
    } else if (n.type === 'resource_added') {
      onNav('resources', {})
    } else if (n.type === 'import_succeeded' || n.type === 'import_failed') {
      onNav('athletes', {})
    } else if (['task_due_tomorrow','task_due_today','task_overdue'].includes(n.type)) {
      onNav('tasks', {})
    } else if (n.type === 'away_start' || n.type === 'away_end') {
      const page = n.related_entity_type === 'coach' ? 'coaches' : n.related_entity_type === 'employee' ? 'employees' : 'athletes'
      const idParam = n.related_entity_type === 'coach' ? 'coachId' : n.related_entity_type === 'employee' ? 'employeeId' : 'athleteId'
      onNav(n.target_path || page, { [idParam]: n.related_entity_id })
    } else if (n.type === 'document_expiring' || n.type === 'document_expired') {
      onNav('athletes', { athleteId: n.related_entity_id })
    }
  }

  const visible = (filter === 'unread' ? notifs.filter(n => !n.read) : notifs)
    .filter(n => catFilter === 'All' || (n.category || TYPE_META[n.type]?.category || 'System') === catFilter)

  const filterScopedNotifs = filter === 'unread' ? notifs.filter(n => !n.read) : notifs
  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filterScopedNotifs.filter(n =>
      cat === 'All' || (n.category || TYPE_META[n.type]?.category || 'System') === cat
    ).length
    return acc
  }, {})

  const GROUPED_TYPES = ['needs_attendance']
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
        <div style={{ display:'flex', gap:8 }}>
          {unreadCount > 0 && (
            <button className="action-btn" onClick={markAllRead}>
              <i className="ti ti-checks" /> {L('Mark all read','تحديد الكل كمقروء')}
            </button>
          )}
          {notifs.some(n => !n.dismissed) && (
            <button className="action-btn" onClick={() => notifs.filter(n => !n.dismissed).forEach(n => dismiss(n.id))}>
              <i className="ti ti-bell-off" /> {L('Clear all','مسح الكل')}
            </button>
          )}
        </div>
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

      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)}
            style={{ padding:'5px 14px', borderRadius:20, fontSize:12, cursor:'pointer', transition:'all .15s',
              fontWeight: catFilter===cat ? 600 : 400,
              border: `1.5px solid ${catFilter===cat ? '#0085C7' : 'var(--border)'}`,
              background: catFilter===cat ? '#0085C7' : 'transparent',
              color: catFilter===cat ? 'white' : 'var(--text2)' }}>
            {ar ? CAT_AR[cat] : (cat === 'All' ? 'All categories' : cat)} ({categoryCounts[cat] || 0})
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
              const title = g.items.length === 1
                ? L('1 session needs attendance','جلسة واحدة بحاجة لتسجيل الحضور')
                : L(`${g.items.length} sessions need attendance`,`${g.items.length} جلسات بحاجة لتسجيل الحضور`)
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
                    <button onClick={() => { g.items.forEach(n => dismiss(n.id)) }}
                      title={L('Clear all','مسح الكل')}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, flexShrink:0, padding:4 }}>
                      <i className="ti ti-x" />
                    </button>
                  </div>
                  <div className="notif-group-items" style={{ padding: ar ? '0 64px 12px 16px' : '0 16px 12px 64px', display:'flex', flexDirection:'column', gap:4 }}>
                    {g.items.map(n => (
                      <div key={n.id} onClick={() => handleClick(n)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:12 }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <span style={{ color:'var(--text2)' }}>{renderNotificationText(n, tx, L).body}</span>
                        <i className={`ti ${ar ? 'ti-arrow-left' : 'ti-arrow-right'}`} style={{ fontSize:12, color:'var(--text3)' }} />
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
                      <div style={{ fontSize:13, fontWeight:600 }}>{renderNotificationText(n, tx, L).title}</div>
                      {!n.read && <div style={{ width:7, height:7, borderRadius:'50%', background:meta.color, flexShrink:0 }} />}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text3)', marginTop:3 }}>{renderNotificationText(n, tx, L).body}</div>
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
                  {n.dismissed ? (
                    <span title={L('Cleared from bell','تم مسحها من الجرس')} style={{ fontSize:10, color:'var(--text3)', flexShrink:0, padding:4 }}>
                      <i className="ti ti-bell-off" />
                    </span>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); dismiss(n.id) }}
                      title={L('Clear from bell','مسح من الجرس')}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, flexShrink:0, padding:4 }}>
                      <i className="ti ti-x" />
                    </button>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
      {hasMore && (
        <div style={{ textAlign:'center', marginTop:14 }}>
          <button onClick={loadMore} disabled={loadingMore}
            style={{ padding:'8px 18px', borderRadius:9, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text2)', fontSize:13, cursor: loadingMore ? 'default' : 'pointer' }}>
            {loadingMore ? L('Loading…','جارٍ التحميل…') : L('Load more','تحميل المزيد')}
          </button>
        </div>
      )}
    </div>
  )
}
