import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'

const TYPE_META = {
  excuse_request:   { color:'#8b5cf6', icon:'ti-message-circle' },
  session_added:    { color:'#009F6B', icon:'ti-calendar-plus' },
  request_approved: { color:'#009F6B', icon:'ti-circle-check' },
  request_rejected: { color:'#EE334E', icon:'ti-circle-x' },
  access_request:   { color:'#0085C7', icon:'ti-user-plus' },
}

/**
 * Reusable notification banner block for any dashboard (coach, athlete, admin, employee).
 * Fetches the logged-in user's unread notifications in real time and renders up to
 * `maxBanners` of them (plus any `extraBanners` passed in, e.g. coach session reminders),
 * collapsing the rest into a single "view all" pill linking to the Notifications page.
 *
 * extraBanners: optional array of { key, color, icon, title, sub, actionLabel, onAction }
 * objects that take priority and are shown before notification-derived banners.
 */
export default function DashboardBanners({ profile, onNav, extraBanners = [], maxBanners = 2 }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [unreadNotifs, setUnreadNotifs] = useState([])

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('notifications')
      .select('*')
      .eq('user_id', String(profile.id))
      .eq('read', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => setUnreadNotifs(data || []))

    const sub = supabase.channel(`dash-notifs-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        payload => setUnreadNotifs(prev => [payload.new, ...prev]))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [profile?.id])

  // needs_attendance/needs_closing are session reminders shown via dedicated extraBanners
  // on the coach dashboard — exclude them here to avoid showing the same thing twice.
  const SESSION_REMINDER_TYPES = ['needs_attendance', 'needs_closing']
  const excuseRequests = unreadNotifs.filter(n => n.type === 'excuse_request')
  const otherNotifs     = unreadNotifs.filter(n => n.type !== 'excuse_request' && !SESSION_REMINDER_TYPES.includes(n.type))

  const banners = [...extraBanners]

  if (excuseRequests.length > 0) {
    banners.push({
      key: 'excuseRequests', color: '#8b5cf6', icon: 'ti-message-circle',
      title: excuseRequests.length === 1
        ? L('1 new excuse/reschedule request', 'طلب عذر/إعادة جدولة جديد')
        : L(`${excuseRequests.length} new excuse/reschedule requests`, `${excuseRequests.length} طلبات عذر/إعادة جدولة جديدة`),
      sub: excuseRequests.slice(0,2).map(n => n.body).join(' · '),
      actionLabel: L('Review','مراجعة'),
      onAction: () => onNav('attendance', excuseRequests[0]?.data?.session_id ? { sessionId: excuseRequests[0].data.session_id } : {}),
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
      sub: top?.title || '',
      actionLabel: L('View','عرض'),
      onAction: () => onNav('notifications'),
    })
  }

  if (banners.length === 0) return null

  const shown = banners.slice(0, maxBanners)
  const overflowCount = banners.length - shown.length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
      {shown.map(b => (
        <div key={b.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:b.color+'15', border:`1px solid ${b.color}40`, borderRadius:12 }}>
          <i className={`ti ${b.icon}`} style={{ fontSize:20, color:b.color, flexShrink:0 }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:b.color }}>{b.title}</div>
            {b.sub && <div style={{ fontSize:11, color:'var(--text3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.sub}</div>}
          </div>
          <button className="btn" style={{ background:b.color, padding:'6px 14px', fontSize:12, flexShrink:0 }} onClick={b.onAction}>
            {b.actionLabel}
          </button>
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
