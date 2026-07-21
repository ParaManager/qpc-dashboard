import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { renderNotificationText } from '../lib/helpers'

const TYPE_META = {
  excuse_request:   { color:'#8b5cf6', icon:'ti-message-circle' },
  session_added:    { color:'#009F6B', icon:'ti-calendar-plus' },
  timetable_created:{ color:'#8b5cf6', icon:'ti-calendar-repeat' },
  request_approved: { color:'#009F6B', icon:'ti-circle-check' },
  request_rejected: { color:'#EE334E', icon:'ti-circle-x' },
  account_approved: { color:'#009F6B', icon:'ti-user-check' },
  account_rejected: { color:'#EE334E', icon:'ti-user-x' },
  access_request:   { color:'#0085C7', icon:'ti-user-plus' },
}


/**
 * Reusable notification banner block for any dashboard (coach, athlete, admin, employee).
 * Fetches the logged-in user's notifications in real time and renders up to `maxBanners`
 * of them (plus any `extraBanners` passed in, e.g. coach session reminders), collapsing
 * the rest into a single "view all" pill linking to the Notifications page.
 *
 * Each banner carries `items`: an array of { label, onSelect } representing the individual
 * things grouped into that banner (e.g. each unclosed session, each pending excuse request).
 * If there's exactly one item, clicking the action button goes straight there. If there's
 * more than one, a picker opens so the user chooses which specific one to resolve —
 * never silently picking the first one for them.
 */
export default function DashboardBanners({ profile, onNav, extraBanners = [], maxBanners = 2 }) {
  const { lang, tx } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [activeNotifs, setActiveNotifs] = useState([])
  const [pickerFor, setPickerFor] = useState(null) // banner key currently showing its picker
  const containerRef = useRef(null)

  // Close the open picker when clicking anywhere outside the banner container
  useEffect(() => {
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setPickerFor(null)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    // Dashboard banners exist to keep nagging about unresolved items, so they ignore
    // both `read` and `dismissed` — those only control the bell dropdown / list view.
    // A notification only disappears from here once it's actually resolved (i.e. its
    // row is deleted by the relevant resync/cleanup logic elsewhere).
    function refresh() {
      supabase.from('notifications')
        .select('*')
        .eq('user_id', String(profile.id))
        .order('created_at', { ascending: false })
        .then(({ data }) => setActiveNotifs(data || []))
    }
    refresh()
    const sub = supabase.channel(`dash-notifs-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, refresh)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [profile?.id])

  // needs_attendance is a session reminder shown via dedicated extraBanners
  // on the coach dashboard — exclude it here to avoid showing the same thing twice.
  const SESSION_REMINDER_TYPES = ['needs_attendance']
  const excuseRequests = activeNotifs.filter(n => n.type === 'excuse_request')
  const accessRequests = activeNotifs.filter(n => n.type === 'access_request')
  // Only the legacy types this banner block was originally built around
  // (i.e. anything actually listed in TYPE_META above) get the persistent
  // "keep nagging until resolved" treatment. Newer notification types
  // (resource_added, task reminders, away/expiry reminders, etc.) were never
  // meant to behave that way — they're normal, dismissible notifications, so
  // they must respect read/dismissed like the bell dropdown and full list do.
  // Falling back to "respect read/dismissed" for anything not explicitly
  // known here also means a future new type added elsewhere won't
  // accidentally inherit the nagging behavior just by existing.
  const otherNotifs = activeNotifs.filter(n =>
    n.type !== 'excuse_request' && n.type !== 'access_request' && !SESSION_REMINDER_TYPES.includes(n.type) &&
    (TYPE_META[n.type] ? true : (!n.read && !n.dismissed))
  )

  const banners = [...extraBanners]

  if (excuseRequests.length > 0) {
    banners.push({
      key: 'excuseRequests', color: '#8b5cf6', icon: 'ti-message-circle',
      title: excuseRequests.length === 1
        ? L('1 new excuse/reschedule request', 'طلب عذر/إعادة جدولة جديد')
        : L(`${excuseRequests.length} new excuse/reschedule requests`, `${excuseRequests.length} طلبات عذر/إعادة جدولة جديدة`),
      sub: excuseRequests.slice(0,2).map(n => n.body).join(' · '),
      actionLabel: L('Review','مراجعة'),
      items: excuseRequests.map(n => ({
        label: n.body || n.title,
        onSelect: () => onNav('schedule', n.data?.session_id ? { sessionId: n.data.session_id } : {}),
      })),
    })
  }

  if (accessRequests.length > 0) {
    banners.push({
      key: 'accessRequests', color: '#0085C7', icon: 'ti-user-plus',
      title: accessRequests.length === 1
        ? L('1 new sign-up request', 'طلب تسجيل جديد')
        : L(`${accessRequests.length} new sign-up requests`, `${accessRequests.length} طلبات تسجيل جديدة`),
      sub: accessRequests.slice(0,2).map(n => n.body).join(' · '),
      actionLabel: L('View','عرض'),
      items: accessRequests.map(n => ({
        label: n.body || n.title,
        onSelect: () => onNav('users', n.data?.applicant_id ? { userId: n.data.applicant_id } : {}),
      })),
    })
  }

  if (otherNotifs.length > 0) {
    const top = otherNotifs[0]
    const meta = TYPE_META[top?.type] || { color:'#0085C7', icon:'ti-bell' }
    banners.push({
      key: 'otherNotifs', color: meta.color, icon: meta.icon,
      title: otherNotifs.length === 1
        ? L('1 new notification', 'إشعار جديد واحد')
        : L(`${otherNotifs.length} new notifications`, `${otherNotifs.length} إشعارات جديدة`),
      sub: top ? renderNotificationText(top, tx, L).title : '',
      actionLabel: L('View','عرض'),
      // Other notifications are heterogeneous, so there's no single "right" destination per
      // item worth picking between — always send to the full Notifications page.
      items: [{ label: L('View all notifications','عرض جميع الإشعارات'), onSelect: () => onNav('notifications') }],
    })
  }

  if (banners.length === 0) return null

  const shown = banners.slice(0, maxBanners)
  const overflowCount = banners.length - shown.length

  function handleBannerClick(b) {
    if (!b.items || b.items.length <= 1) {
      if (b.items?.[0]) b.items[0].onSelect()
      else if (b.onAction) b.onAction()
      setPickerFor(null)
    } else {
      setPickerFor(pickerFor === b.key ? null : b.key)
    }
  }

  return (
    <div ref={containerRef} style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
      {shown.map(b => (
        <div key={b.key} style={{ position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:b.color+'15', border:`1px solid ${b.color}40`, borderRadius:12 }}>
            <i className={`ti ${b.icon}`} style={{ fontSize:20, color:b.color, flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:b.color }}>{b.title}</div>
              {b.sub && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.sub}</div>}
            </div>
            <button className="btn" style={{ background:b.color, padding:'6px 14px', fontSize:12, flexShrink:0 }} onClick={() => handleBannerClick(b)}>
              {b.actionLabel}
            </button>
          </div>

          {pickerFor === b.key && b.items?.length > 1 && (
            <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, left:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,.15)', zIndex:20, maxHeight:260, overflowY:'auto' }}>
              <div style={{ padding:'8px 14px', fontSize:11, fontWeight:600, color:'var(--text3)', borderBottom:'1px solid var(--border)' }}>
                {L('Which one?','أيها؟')}
              </div>
              {b.items.map((item, i) => (
                <div key={i} onClick={() => { item.onSelect(); setPickerFor(null) }}
                  style={{ padding:'10px 14px', fontSize:13, cursor:'pointer', borderBottom: i < b.items.length-1 ? '1px solid var(--border)' : 'none', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <span>{item.label}</span>
                  <i className="ti ti-arrow-right" style={{ fontSize:13, color:'var(--text3)', flexShrink:0 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {overflowCount > 0 && (
        <div onClick={() => onNav('notifications')}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', background:'var(--surface2)', borderRadius:12, cursor:'pointer', fontSize:12, fontWeight:600, color:'var(--text2)' }}>
          <i className="ti ti-bell" style={{ fontSize:15 }} />
          {L(`+${overflowCount} more — view all notifications`, `+${overflowCount} أخرى — عرض جميع الإشعارات`)}
          <i className="ti ti-arrow-right" style={{ fontSize:13 }} />
        </div>
      )}
    </div>
  )
}
