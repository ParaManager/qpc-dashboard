import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast, ConfirmModal } from '../components/Toast'
import MeetingFormModal from '../components/MeetingFormModal.jsx'

const KIND_COLORS = { meeting: '#8b5cf6', event: '#EE334E', task: '#0085C7' }

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function getFirstDay(year, month) { return new Date(year, month, 1).getDay() }
function toDateStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function startOfWeek(d) { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); return r }

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
    toast(L('Meeting deleted','تم حذف الاجتماع'))
  }

  // ── Unified items list ──
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

  function itemsOnDay(dateStr) {
    return visibleItems.filter(i => dateStr >= i.date && dateStr <= i.endDate)
      .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'))
  }

  function isToday(dateStr) { return dateStr === toDateStr(today) }

  function openItem(item) {
    if (item.kind === 'event') onNav('events', { eventId: item.raw.id })
    else if (item.kind === 'task') onNav('tasks', { taskId: item.raw.id })
    else { setEditingMeeting(item.raw); setShowMeetingForm(true) }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{L('Loading…','جاري التحميل…')}</div>

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay    = getFirstDay(year, month)
  const weekStart    = startOfWeek(curDate)
  const weekDays      = Array.from({ length: 7 }).map((_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d })

  // Agenda: everything within the visible month, chronological
  const agendaByDate = {}
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const dayItems = itemsOnDay(dateStr)
    if (dayItems.length) agendaByDate[dateStr] = dayItems
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

      {/* MONTH VIEW */}
      {view === 'month' && (
        <div className="cal-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <div className="cal-headers" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
            {dayNames.map(d => (
              <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{d}</div>
            ))}
          </div>
          <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} style={{ minHeight: 90, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
              const dayItems = itemsOnDay(dateStr)
              const isTod = isToday(dateStr)
              return (
                <div key={d} style={{ minHeight: 90, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '6px 4px', position: 'relative', background: isTod ? 'var(--surface2)' : 'var(--surface)' }}>
                  <div style={{ fontSize: 12, fontWeight: isTod ? 700 : 500, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isTod ? '#0085C7' : 'transparent', color: isTod ? '#fff' : 'var(--text)', marginBottom: 4 }}>{d}</div>
                  {dayItems.slice(0, 3).map(item => (
                    <div key={item.id} onClick={() => openItem(item)}
                      style={{ fontSize: 10, fontWeight: 500, padding: '2px 5px', borderRadius: 4, marginBottom: 2, cursor: 'pointer', background: KIND_COLORS[item.kind] + '20', color: KIND_COLORS[item.kind], overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {item.startTime ? `${item.startTime.slice(0,5)} ` : ''}{item.title}
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <div style={{ fontSize: 10, color: '#0085C7', fontWeight: 600 }}>+{dayItems.length - 3} {L('more','أخرى')}</div>
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
              const dayItems = itemsOnDay(dateStr)
              const isTod = isToday(dateStr)
              return (
                <div key={dateStr} style={{ minHeight: 220, borderRight: '1px solid var(--border)', padding: '8px 6px', background: isTod ? 'var(--surface2)' : 'var(--surface)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>{dayNames[d.getDay()]}</div>
                  <div style={{ fontSize: 13, fontWeight: isTod ? 700 : 500, color: isTod ? '#0085C7' : 'var(--text)', marginBottom: 6 }}>{d.getDate()}</div>
                  {dayItems.map(item => (
                    <div key={item.id} onClick={() => openItem(item)}
                      style={{ fontSize: 11, fontWeight: 500, padding: '4px 6px', borderRadius: 5, marginBottom: 3, cursor: 'pointer', background: KIND_COLORS[item.kind] + '20', color: KIND_COLORS[item.kind] }}>
                      {item.startTime ? `${item.startTime.slice(0,5)} · ` : ''}{item.title}
                    </div>
                  ))}
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
          {Object.entries(agendaByDate).map(([dateStr, dayItems]) => (
            <div key={dateStr} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
                {new Date(dateStr + 'T00:00:00').toLocaleDateString(ar ? 'ar' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              {dayItems.map(item => (
                <div key={item.id} onClick={() => openItem(item)}
                  style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center' }}>
                  <div style={{ width: 4, borderRadius: 4, alignSelf: 'stretch', background: KIND_COLORS[item.kind], flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {item.startTime ? item.startTime.slice(0,5) : ''}{item.startTime && item.endTime ? ` – ${item.endTime.slice(0,5)}` : ''}
                      {item.kind === 'meeting' && item.raw.location ? ` · ${item.raw.location}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: KIND_COLORS[item.kind] + '20', color: KIND_COLORS[item.kind], textTransform: 'capitalize' }}>
                    {item.kind === 'meeting' ? L('Meeting','اجتماع') : item.kind === 'event' ? L('Event','فعالية') : L('Task','مهمة')}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
