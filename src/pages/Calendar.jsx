import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast, ConfirmModal } from '../components/Toast'
import MeetingFormModal from '../components/MeetingFormModal.jsx'
import { computeEventStatus } from './Events'

const KIND_COLORS = { meeting: '#8b5cf6', event: '#EE334E', task: '#0085C7' }
const KIND_ICONS  = { meeting: 'ti-users-group', event: 'ti-calendar-event', task: 'ti-checklist' }

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function getFirstDay(year, month) { return new Date(year, month, 1).getDay() }
function toDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function startOfWeek(d) { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); return r }

function isEventCanceled(ev) {
  return ev.status === 'Canceled' || ev.approval_status === 'Rejected'
}

export default function Calendar({ profile, events = [], onNav }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [meetings, setMeetings]   = useState([])
  const [tasks, setTasks]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState('month') // month | week | agenda
  const [filter, setFilter]       = useState('All')   // All | Meetings | Events | Tasks
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
      .select('*, meeting_attendees(person_id, people(id, name, name_ar))')
      .order('meeting_date')
    if (error) { toast(error.message, 'error'); return }
    setMeetings(data || [])
  }

  async function loadTasks() {
    const { data, error } = await supabase.from('tasks').select('*').eq('archived', false)
    if (error) { toast(error.message, 'error'); return }
    setTasks(data || [])
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([loadMeetings(), loadTasks()]).finally(() => setLoading(false))
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
    ? ['أح','اث','ثل','أر','خم','جم','سب']
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

  const filterKind = filter === 'Meetings' ? 'meeting' : filter === 'Events' ? 'event' : filter === 'Tasks' ? 'task' : null
  const visibleItems = filterKind ? allItems.filter(i => i.kind === filterKind) : allItems

  // Each day only ever looks at its own date range — a multi-day event simply
  // appears again (compact, not spanning) on every date it covers.
  function itemsOnDay(dateStr) {
    return visibleItems.filter(i => dateStr >= i.date && dateStr <= i.endDate)
      .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'))
  }

  function isToday(dateStr) { return dateStr === toDateStr(today) }

  // Completed tasks render muted. Events are never muted here — canceled ones
  // are already excluded above, and there's no other "dim but visible" state.
  function isMuted(item) {
    return item.kind === 'task' && item.raw.status === 'done'
  }

  function openItem(item) {
    if (item.kind === 'event') onNav('events', { eventId: item.raw.id })
    else if (item.kind === 'task') onNav('tasks', { taskId: item.raw.id })
    else { setDayDetail(null); setEditingMeeting(item.raw); setShowMeetingForm(true) }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{L('Loading…','جاري التحميل…')}</div>

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay    = getFirstDay(year, month)
  const weekStart   = startOfWeek(curDate)
  const weekDays    = Array.from({ length: 7 }).map((_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d })

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
    return (
      <div onClick={(e) => { e.stopPropagation(); openItem(item) }}
        title={item.title}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 500,
          padding: '2px 5px', borderRadius: 5, marginBottom: 2, cursor: 'pointer',
          background: KIND_COLORS[item.kind] + (muted ? '0c' : '18'),
          color: muted ? 'var(--text3)' : KIND_COLORS[item.kind],
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
                return (
                  <div key={item.id} onClick={() => openItem(item)}
                    style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center', opacity: muted ? 0.6 : 1 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: KIND_COLORS[item.kind] + '18', color: KIND_COLORS[item.kind], flexShrink: 0 }}>
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
          <select className="filter" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="All">{L('All','الكل')}</option>
            <option value="Meetings">{L('Meetings','الاجتماعات')}</option>
            <option value="Events">{L('Events','الفعاليات')}</option>
            <option value="Tasks">{L('Tasks','المهام')}</option>
          </select>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
            {['month', 'week', 'agenda'].map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: view === v ? '#0085C7' : 'var(--surface)', color: view === v ? '#fff' : 'var(--text2)' }}>
                {v === 'month' ? L('Month','شهر') : v === 'week' ? L('Week','أسبوع') : L('Agenda','جدول الأعمال')}
              </button>
            ))}
          </div>
          <button className="btn" style={{ background: '#0085C7', fontSize: 13, padding: '6px 14px' }}
            onClick={() => { setEditingMeeting(null); setShowMeetingForm(true) }}>
            <i className="ti ti-plus" /> {L('New Meeting','اجتماع جديد')}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        {['meeting', 'event', 'task'].map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text2)' }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: KIND_COLORS[k], display: 'inline-block' }} />
            {k === 'meeting' ? L('Meetings','الاجتماعات') : k === 'event' ? L('Events','الفعاليات') : L('Tasks','المهام')}
          </div>
        ))}
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="tb-btn" onClick={() => {
          if (view === 'week') setCurDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7))
          else setCurDate(new Date(year, month - 1, 1))
        }}><i className="ti ti-chevron-left" /></button>
        <div style={{ fontSize: 16, fontWeight: 600, minWidth: 160, textAlign: 'center' }}>
          {view === 'week'
            ? `${weekDays[0].getDate()} ${monthNames[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${monthNames[weekDays[6].getMonth()]}`
            : `${monthNames[month]} ${year}`}
        </div>
        <button className="tb-btn" onClick={() => {
          if (view === 'week') setCurDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7))
          else setCurDate(new Date(year, month + 1, 1))
        }}><i className="ti ti-chevron-right" /></button>
        <button className="tb-btn" onClick={() => setCurDate(new Date())}>{L('Today','اليوم')}</button>
      </div>

      {/* MONTH VIEW — each cell renders only its own items, no cross-cell elements */}
      {view === 'month' && (
        <div className="cal-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <div className="cal-headers" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
            {dayNames.map((d, i) => (
              <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: (i === 0 || i === 6) ? 'var(--text3)' : 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', opacity: (i === 0 || i === 6) ? 0.75 : 1 }}>{d}</div>
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

      {/* WEEK VIEW */}
      {view === 'week' && (
        <div className="cal-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {weekDays.map(d => {
              const dateStr = toDateStr(d)
              const dItems = itemsOnDay(dateStr)
              const isTod = isToday(dateStr)
              const weekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <div key={dateStr} style={{ minHeight: 220, borderRight: '1px solid var(--border)', padding: '8px 6px', background: weekend ? 'var(--surface2)' : 'var(--surface)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>{dayNames[d.getDay()]}</div>
                  <div style={{ fontSize: 13, fontWeight: isTod ? 700 : 500, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isTod ? '#0085C7' : 'transparent', color: isTod ? '#fff' : 'var(--text)', marginBottom: 6 }}>{d.getDate()}</div>
                  {dItems.map(item => <CompactItem key={item.id} item={item} />)}
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
                return (
                  <div key={item.id} onClick={() => openItem(item)}
                    style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center', opacity: muted ? 0.6 : 1 }}>
                    <div style={{ width: 4, borderRadius: 4, alignSelf: 'stretch', background: KIND_COLORS[item.kind], flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, textDecoration: muted ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        {item.startTime ? item.startTime.slice(0,5) : ''}{item.startTime && item.endTime ? ` – ${item.endTime.slice(0,5)}` : ''}
                        {item.kind === 'meeting' && item.raw.location ? ` · ${item.raw.location}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: KIND_COLORS[item.kind] + '20', color: KIND_COLORS[item.kind], textTransform: 'capitalize', flexShrink: 0 }}>
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
