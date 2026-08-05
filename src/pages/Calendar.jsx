import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast, ConfirmModal } from '../components/Toast'
import MeetingFormModal from '../components/MeetingFormModal.jsx'

const KIND_COLORS = { meeting: '#8b5cf6', event: '#EE334E', task: '#0d9488' }
const KIND_ICONS  = { meeting: 'ti-users-group', event: 'ti-calendar-event', task: 'ti-checklist' }

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function getFirstDay(year, month) { return new Date(year, month, 1).getDay() }
function toDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

function isEventCanceled(ev) {
  return ev.status === 'Canceled' || ev.approval_status === 'Rejected'
}

export default function Calendar({ profile, events = [], employees = [], onNav, readOnly = false, guestMode = false }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  // Resolves the logged-in coach's linked Employee record strictly via the
  // verified profile relationship — profiles.employee_id if already set,
  // else a person_id match against the employees list. Never falls back to
  // matching by name. Only meaningful in readOnly (Coach) mode; unused for
  // the Admin calendar.
  const myEmployeeId = (() => {
    if (!readOnly) return null
    if (profile?.employee_id) return profile.employee_id
    if (profile?.person_id) {
      const match = employees.find(e => e.person_id === profile.person_id)
      if (match) return match.id
    }
    return null
  })()

  const [meetings, setMeetings]   = useState([])
  const [tasks, setTasks]         = useState([])
  const [eventCats, setEventCats] = useState([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState('month') // month | agenda
  const [activeFilters, setActiveFilters] = useState(['all']) // 'all' | 'meetings' | 'tasks' | 'cat-<id>', multi-select except 'all'
  const [today]                   = useState(new Date())
  const [curDate, setCurDate]     = useState(new Date())
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [editingMeeting, setEditingMeeting]   = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [dayDetail, setDayDetail]   = useState(null) // { dateStr, items }

  const year  = curDate.getFullYear()
  const month = curDate.getMonth()

  async function loadMeetings() {
    const { data, error } = await supabase
      .from('meetings')
      .select('*, meeting_attendees(employee_id, employees(id, name, name_ar))')
      .order('meeting_date')
    if (error) { toast(error.message, 'error'); return }
    if (readOnly) {
      // Coach view: only meetings where the resolved employee id is an
      // attendee. No linked employee -> no meetings, never a name-based guess.
      const scoped = myEmployeeId
        ? (data || []).filter(m => (m.meeting_attendees || []).some(a => a.employee_id === myEmployeeId))
        : []
      setMeetings(scoped)
      return
    }
    setMeetings(data || [])
  }

  async function loadTasks() {
    let q = supabase.from('tasks').select('*').eq('archived', false)
    // Coach view: only tasks assigned directly to this authenticated user —
    // never another coach's tasks.
    if (readOnly) {
      if (!profile?.id) { setTasks([]); return }
      q = q.eq('assigned_to', profile.id)
    }
    const { data, error } = await q
    if (error) { toast(error.message, 'error'); return }
    setTasks(data || [])
  }

  async function loadEventCats() {
    const { data, error } = await supabase.from('event_categories').select('*').eq('is_active', true).order('name')
    if (error) { toast(error.message, 'error'); return }
    setEventCats(data || [])
  }

  useEffect(() => {
    setLoading(true)
    const jobs = guestMode ? [loadEventCats()] : [loadMeetings(), loadTasks(), loadEventCats()]
    Promise.all(jobs).finally(() => setLoading(false))
  }, [])

  async function handleDeleteMeeting(m) {
    const { error } = await supabase.from('meetings').delete().eq('id', m.id)
    if (error) { toast(error.message, 'error'); return }
    setMeetings(prev => prev.filter(x => x.id !== m.id))
    setConfirmDel(null)
    setShowMeetingForm(false)
    setEditingMeeting(null)
    setDayDetail(null)
    toast(L('Meeting deleted','تم حذف الاجتماع'))
  }

  const monthNames = ar
    ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    : ['January','February','March','April','May','June','July','August','September','October','November','December']
  const dayNames = ar
    ? ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
    : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const allItems = useMemo(() => {
    const items = []
    for (const m of meetings) {
      items.push({
        id: `meeting-${m.id}`, kind: 'meeting', date: m.meeting_date, endDate: m.meeting_date,
        startTime: m.start_time, endTime: m.end_time,
        title: m.title, raw: m,
      })
    }
    for (const e of events) {
      if (!e.start_date) continue
      if (isEventCanceled(e)) continue // canceled events are excluded from the calendar entirely
      items.push({
        id: `event-${e.id}`, kind: 'event', date: e.start_date, endDate: e.end_date || e.start_date,
        startTime: null, endTime: null,
        title: ar && e.name_ar ? e.name_ar : e.name, raw: e,
      })
    }
    for (const t of tasks) {
      if (!t.due_date) continue
      items.push({
        id: `task-${t.id}`, kind: 'task', date: t.due_date, endDate: t.due_date,
        startTime: t.due_time, endTime: null,
        title: t.title, raw: t,
      })
    }
    return items
  }, [meetings, events, tasks, ar])

  const showAll        = activeFilters.includes('all')
  const activeCatIds   = activeFilters.filter(f => f.startsWith('cat-')).map(f => f.slice(4))
  const visibleItems = allItems.filter(i => {
    if (showAll) return true
    if (i.kind === 'meeting') return activeFilters.includes('meetings')
    if (i.kind === 'task')    return activeFilters.includes('tasks')
    if (i.kind === 'event')   return activeCatIds.includes(String(i.raw.category_id))
    return false
  })

  function toggleFilter(key) {
    setActiveFilters(prev => {
      if (key === 'all') return ['all']
      const withoutAll = prev.filter(f => f !== 'all')
      const next = withoutAll.includes(key) ? withoutAll.filter(f => f !== key) : [...withoutAll, key]
      return next.length ? next : ['all']
    })
  }

  // Each day only ever looks at its own date range — a multi-day event simply
  // appears again (compact, not spanning) on every date it covers.
  function itemsOnDay(dateStr) {
    return visibleItems.filter(i => dateStr >= i.date && dateStr <= i.endDate)
      .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'))
  }

  function isToday(dateStr) { return dateStr === toDateStr(today) }

  // Event items are colored by their own category (matching the filter pills)
  // instead of one generic red — meetings/tasks keep their fixed kind color.
  function itemColor(item) {
    if (item.kind === 'event') {
      const cat = eventCats.find(c => c.id === item.raw.category_id)
      return cat?.color || KIND_COLORS.event
    }
    return KIND_COLORS[item.kind]
  }

  // Completed tasks render muted. Events are never muted here — canceled ones
  // are already excluded above, and there's no other "dim but visible" state.
  function isMuted(item) {
    return item.kind === 'task' && item.raw.status === 'done'
  }

  function openItem(item) {
    if (item.kind === 'event') onNav('events', { eventId: item.raw.id })
    else if (item.kind === 'task') onNav('tasks')
    else if (!readOnly) { setDayDetail(null); setEditingMeeting(item.raw); setShowMeetingForm(true) }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{L('Loading…','جاري التحميل…')}</div>

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay    = getFirstDay(year, month)

  // Full month grid including muted lead/trail days from adjacent months
  const weeksCount = Math.ceil((firstDay + daysInMonth) / 7)
  const gridStart  = new Date(year, month, 1 - firstDay)
  const monthCells = Array.from({ length: weeksCount * 7 }).map((_, i) => {
    const d = new Date(gridStart); d.setDate(d.getDate() + i)
    return { date: d, dateStr: toDateStr(d), inMonth: d.getMonth() === month, weekend: d.getDay() === 0 || d.getDay() === 6 }
  })

  // Agenda: everything within the visible month, chronological
  const agendaByDate = {}
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const dItems = itemsOnDay(dateStr)
    if (dItems.length) agendaByDate[dateStr] = dItems
  }

  function CompactItem({ item }) {
    const muted = isMuted(item)
    const color = itemColor(item)
    return (
      <div onClick={(e) => { e.stopPropagation(); openItem(item) }}
        title={item.title}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 500,
          padding: '2px 5px', borderRadius: 5, marginBottom: 2, cursor: 'pointer',
          background: color + (muted ? '0c' : '18'),
          color: muted ? 'var(--text3)' : color,
          opacity: muted ? 0.65 : 1,
          textDecoration: muted ? 'line-through' : 'none',
          overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100%',
        }}>
        <i className={`ti ${KIND_ICONS[item.kind]}`} style={{ fontSize: 10, flexShrink: 0 }} />
        {item.kind === 'meeting' && item.startTime && <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{item.startTime.slice(0,5)}</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{item.title}</span>
      </div>
    )
  }

  return (
    <div>
      {showMeetingForm && (
        <MeetingFormModal
          meeting={editingMeeting}
          onClose={() => { setShowMeetingForm(false); setEditingMeeting(null) }}
          onSaved={() => { setShowMeetingForm(false); setEditingMeeting(null); loadMeetings() }}
          onDelete={m => setConfirmDel(m)}
          profile={profile}
        />
      )}
      {confirmDel && (
        <ConfirmModal
          title={L('Delete meeting','حذف الاجتماع')}
          message={`${L('Delete','حذف')} "${confirmDel.title}"?`}
          onConfirm={() => handleDeleteMeeting(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
      {dayDetail && (
        <div className="modal-overlay" onClick={() => setDayDetail(null)}>
          <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {new Date(dayDetail.dateStr + 'T00:00:00').toLocaleDateString(ar ? 'ar' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <button className="modal-close" onClick={() => setDayDetail(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {dayDetail.items.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>{L('Nothing scheduled','لا يوجد شيء مجدول')}</div>
              )}
              {dayDetail.items.map(item => {
                const muted = isMuted(item)
                const color = itemColor(item)
                return (
                  <div key={item.id} onClick={() => openItem(item)}
                    style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center', opacity: muted ? 0.6 : 1 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '18', color, flexShrink: 0 }}>
                      <i className={`ti ${KIND_ICONS[item.kind]}`} style={{ fontSize: 13 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, textDecoration: muted ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        {item.startTime ? item.startTime.slice(0,5) : ''}{item.startTime && item.endTime ? ` – ${item.endTime.slice(0,5)}` : ''}
                        {item.kind === 'event' && item.endDate !== item.date ? `${item.date} → ${item.endDate}` : ''}
                        {item.kind === 'meeting' && item.raw.location ? ` · ${item.raw.location}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">{L('Calendar','التقويم')}</div>
          <div className="page-sub">{monthNames[month]} {year}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {!readOnly && (
            <button className="btn" style={{ background: '#0085C7', fontSize: 13, padding: '6px 14px' }}
              onClick={() => { setEditingMeeting(null); setShowMeetingForm(true) }}>
              <i className="ti ti-plus" /> {L('New Meeting','اجتماع جديد')}
            </button>
          )}
        </div>
      </div>

      {/* Filter pills — All / Meetings / Tasks / one per active Event Category */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { key: 'all',      label: L('All','الكل'),      color: '#334155' },
          ...(guestMode ? [] : [
            { key: 'meetings', label: L('Meetings','الاجتماعات'), color: KIND_COLORS.meeting },
            { key: 'tasks',    label: L('Tasks','المهام'),   color: KIND_COLORS.task },
          ]),
          ...eventCats.map(c => ({ key: `cat-${c.id}`, label: ar && c.name_ar ? c.name_ar : c.name, color: c.color })),
        ].map(({ key, label, color }) => {
          const isActive = activeFilters.includes(key)
          return (
            <button key={key} onClick={() => toggleFilter(key)}
              style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', transition: 'all .15s', fontWeight: isActive ? 600 : 400,
                border: `1.5px solid ${isActive ? color : 'var(--border)'}`,
                background: isActive ? color : 'transparent',
                color: isActive ? '#fff' : 'var(--text2)',
              }}>
              {label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
          {['month', 'agenda'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: view === v ? '#0085C7' : 'var(--surface)', color: view === v ? '#fff' : 'var(--text2)' }}>
              {v === 'month' ? L('Month','شهر') : L('Agenda','جدول الأعمال')}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        {(guestMode ? ['event'] : ['meeting', 'event', 'task']).map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text2)' }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: KIND_COLORS[k], display: 'inline-block' }} />
            {k === 'meeting' ? L('Meetings','الاجتماعات') : k === 'event' ? L('Events','الفعاليات') : L('Tasks','المهام')}
          </div>
        ))}
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="tb-btn" onClick={() => setCurDate(new Date(year, month - 1, 1))}><i className="ti ti-chevron-left" /></button>
        <div style={{ fontSize: 16, fontWeight: 600, minWidth: 160, textAlign: 'center' }}>
          {monthNames[month]} {year}
        </div>
        <button className="tb-btn" onClick={() => setCurDate(new Date(year, month + 1, 1))}><i className="ti ti-chevron-right" /></button>
        <button className="tb-btn" onClick={() => setCurDate(new Date())}>{L('Today','اليوم')}</button>
      </div>

      {/* MONTH VIEW — each cell renders only its own items, no cross-cell elements */}
      {view === 'month' && (
        <div className="cal-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <div className="cal-headers" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
            {dayNames.map((d, i) => (
              <div key={d} className="cal-header-cell" style={{ padding: '10px 2px', textAlign: 'center', fontSize: ar ? 11 : 12, fontWeight: 600, color: (i === 0 || i === 6) ? 'var(--text3)' : 'var(--text2)', textTransform: ar ? 'none' : 'uppercase', letterSpacing: ar ? 0 : '.05em', opacity: (i === 0 || i === 6) ? 0.75 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d}</div>
            ))}
          </div>
          <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {monthCells.map(({ date, dateStr, inMonth, weekend }) => {
              const dItems = itemsOnDay(dateStr)
              const visible = dItems.slice(0, 3)
              const hiddenCount = dItems.length - visible.length
              const isTod = isToday(dateStr)
              return (
                <div key={dateStr} className="cal-day-cell"
                  style={{
                    minHeight: 96, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
                    padding: '5px 5px 4px', overflow: 'hidden',
                    background: (weekend || !inMonth) ? 'var(--surface2)' : 'var(--surface)',
                    opacity: inMonth ? 1 : 0.55,
                  }}>
                  <div style={{ fontSize: 11.5, fontWeight: isTod ? 700 : 500, width: 21, height: 21, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isTod ? '#0085C7' : 'transparent', color: isTod ? '#fff' : weekend ? 'var(--text3)' : 'var(--text)', marginBottom: 3 }}>{date.getDate()}</div>
                  {visible.map(item => <CompactItem key={item.id} item={item} />)}
                  {hiddenCount > 0 && (
                    <div onClick={() => setDayDetail({ dateStr, items: dItems })}
                      style={{ fontSize: 10, color: '#0085C7', fontWeight: 600, cursor: 'pointer', marginTop: 1 }}>
                      +{hiddenCount} {L('more','أخرى')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AGENDA VIEW */}
      {view === 'agenda' && (
        <div className="card">
          <div className="card-title"><i className="ti ti-list" /> {L('Agenda','جدول الأعمال')}</div>
          {Object.keys(agendaByDate).length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>{L('Nothing scheduled this month','لا يوجد شيء مجدول هذا الشهر')}</div>
          )}
          {Object.entries(agendaByDate).map(([dateStr, dItems]) => (
            <div key={dateStr} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
                {new Date(dateStr + 'T00:00:00').toLocaleDateString(ar ? 'ar' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              {dItems.map(item => {
                const muted = isMuted(item)
                const color = itemColor(item)
                return (
                  <div key={item.id} onClick={() => openItem(item)}
                    style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center', opacity: muted ? 0.6 : 1 }}>
                    <div style={{ width: 4, borderRadius: 4, alignSelf: 'stretch', background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, textDecoration: muted ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        {item.startTime ? item.startTime.slice(0,5) : ''}{item.startTime && item.endTime ? ` – ${item.endTime.slice(0,5)}` : ''}
                        {item.kind === 'meeting' && item.raw.location ? ` · ${item.raw.location}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: color + '20', color, textTransform: 'capitalize', flexShrink: 0 }}>
                      {item.kind === 'meeting' ? L('Meeting','اجتماع') : item.kind === 'event' ? L('Event','فعالية') : L('Task','مهمة')}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
