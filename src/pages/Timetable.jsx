import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { toast } from '../components/Toast'

export const SESSION_TYPES = ['Training','Competition','Medical','Meeting']
export const SESSION_COLORS = { Training:'#0085C7', Competition:'#EE334E', Medical:'#009F6B', Meeting:'#8b5cf6' }
export const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
export const DAYS_AR = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
const GENERATE_WEEKS_AHEAD = 8  // how many weeks into the future timetable_days get materialized into real sessions

// Formats a Date as YYYY-MM-DD using its LOCAL date components, never UTC.
// toISOString() converts to UTC first, which silently shifts the date by one day
// for any timezone ahead of UTC (like Qatar, UTC+3) — this avoids that entirely.
export function toLocalDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Formats a YYYY-MM-DD date string as "Weekday, YYYY-MM-DD" (or Arabic equivalent).
// Parses the parts manually rather than via `new Date(dateStr)` to avoid any UTC
// parsing surprises — the date string is already a local calendar date.
export function formatDateWithDay(dateStr, ar) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  const dayName = ar ? DAYS_AR[dow] : DAYS_EN[dow]
  return `${dayName}, ${dateStr}`
}

const STATUS_AR_EXPORT = { Present:'حاضر', Absent:'غائب', Excused:'معذور', 'Transport Problem':'مشكلة نقل', 'Medical Issue':'مشكلة صحية' }

/**
 * Builds a clean, readable attendance .xlsx export — proper column widths, sorted
 * rows, and a summary block with totals per status and the overall rate.
 *
 * rows: array of { date, day, session, athlete, status, notes }
 * filenamePrefix: e.g. "QPC_Attendance_Week_2026-06-21"
 */
export function exportAttendanceXlsx({ rows, ar, filenamePrefix }) {
  if (!rows || rows.length === 0) return false

  const sorted = [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    if (a.session !== b.session) return a.session.localeCompare(b.session)
    return a.athlete.localeCompare(b.athlete)
  })

  const headers = ar
    ? ['التاريخ', 'اليوم', 'الجلسة', 'الرياضي', 'الحالة', 'ملاحظات']
    : ['Date', 'Day', 'Session', 'Athlete', 'Status', 'Notes']

  const counts = { Present:0, Absent:0, Excused:0, 'Transport Problem':0, 'Medical Issue':0 }
  sorted.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++ })
  const total = sorted.length
  const rate = total ? Math.round((counts.Present / total) * 100) : 0

  const dataRows = sorted.map(r => [
    r.date,
    formatDateWithDay(r.date, ar).split(', ')[0],
    r.session,
    r.athlete,
    ar ? (STATUS_AR_EXPORT[r.status] || r.status) : r.status,
    r.notes || '',
  ])

  const summaryLabel = ar ? 'الملخص' : 'Summary'
  const summaryRows = [
    [],
    [summaryLabel],
    [ar ? 'حاضر' : 'Present', counts.Present],
    [ar ? 'غائب' : 'Absent', counts.Absent],
    [ar ? 'معذور' : 'Excused', counts.Excused],
    [ar ? 'مشكلة نقل' : 'Transport Problem', counts['Transport Problem']],
    [ar ? 'مشكلة صحية' : 'Medical Issue', counts['Medical Issue']],
    [ar ? 'الإجمالي' : 'Total records', total],
    [ar ? 'معدل الحضور' : 'Attendance rate', `${rate}%`],
  ]

  const aoa = [headers, ...dataRows, ...summaryRows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Column widths sized for real content, not the default ~8 chars
  ws['!cols'] = [
    { wch: 12 }, // Date
    { wch: 10 }, // Day
    { wch: 24 }, // Session
    { wch: 22 }, // Athlete
    { wch: 10 }, // Status
    { wch: 30 }, // Notes
  ]

  // Note: this xlsx build does not actually write frozen panes despite the property
  // being documented, so we don't rely on it — column widths do the real work here.

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, ar ? 'الحضور' : 'Attendance')
  XLSX.writeFile(wb, `${filenamePrefix}.xlsx`)
  return true
}

/**
 * Materializes real training_sessions rows from active timetables/timetable_days,
 * covering today through GENERATE_WEEKS_AHEAD weeks out. Safe to call repeatedly —
 * skips any (timetable_day, date) combination that already has a generated session.
 */
export async function generateUpcomingSessions(coachId) {
  const { data: timetables } = await supabase
    .from('timetables')
    .select('*, timetable_days(*)')
    .eq('coach_id', String(coachId))
    .eq('active', true)
  if (!timetables || timetables.length === 0) return

  const activeDays = []
  timetables.forEach(tt => {
    (tt.timetable_days || []).filter(d => d.active).forEach(day => {
      activeDays.push({ ...day, timetable: tt })
    })
  })
  if (activeDays.length === 0) return

  const { data: existing } = await supabase
    .from('training_sessions')
    .select('id, session_date, timetable_day_id')
    .not('timetable_day_id', 'is', null)
    .eq('coach_id', String(coachId))

  const existingKeys = new Set((existing || []).map(s => `${s.timetable_day_id}:${s.session_date}`))

  const today = new Date()
  today.setHours(0,0,0,0)
  const toInsert = []

  for (let i = 0; i < GENERATE_WEEKS_AHEAD * 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dow = d.getDay()
    const dateStr = toLocalDateStr(d)
    activeDays.filter(day => day.day_of_week === dow).forEach(day => {
      const key = `${day.id}:${dateStr}`
      if (existingKeys.has(key)) return
      toInsert.push({
        title: day.timetable.title,
        coach_id: String(coachId),
        session_date: dateStr,
        session_type: day.timetable.session_type,
        sport: day.timetable.sport,
        location: day.timetable.location,
        start_time: day.start_time,
        end_time: day.end_time,
        notes: day.timetable.notes,
        timetable_id: day.timetable.id,
        timetable_day_id: day.id,
        _athleteIds: day.timetable.athlete_ids || [],
      })
    })
  }

  if (toInsert.length === 0) return

  const rows = toInsert.map(({ _athleteIds, ...rest }) => rest)
  const { data: inserted, error } = await supabase.from('training_sessions').insert(rows).select()
  if (error || !inserted) return

  const athleteRows = []
  inserted.forEach((row, i) => {
    toInsert[i]._athleteIds.forEach(athleteId => {
      athleteRows.push({ session_id: row.id, athlete_id: String(athleteId) })
    })
  })
  if (athleteRows.length > 0) {
    await supabase.from('training_session_athletes').insert(athleteRows)
  }
}

/**
 * Removes future (not-yet-happened) generated sessions for a given timetable_day,
 * so the calendar doesn't keep showing slots that no longer match the pattern.
 * Past sessions and their attendance are always left untouched.
 */
async function clearFutureGeneratedSessions({ timetableDayId, timetableId }) {
  const todayStr = toLocalDateStr(new Date())
  let q = supabase.from('training_sessions').delete().gte('session_date', todayStr)
  if (timetableDayId) q = q.eq('timetable_day_id', timetableDayId)
  else if (timetableId) q = q.eq('timetable_id', timetableId)
  await q
}

/**
 * Applies an edit made from a single generated session according to the chosen scope:
 *  - 'one'      : update only this session row, no pattern change
 *  - 'day'      : update the timetable_day pattern, regenerate future sessions for that day
 *  - 'timetable': update every active day in the timetable to the same new time/details,
 *                 regenerate future sessions across the whole timetable
 *
 * `changes` may include: title, location, sport, start_time, end_time, notes, athlete_ids
 */
export async function applySessionEdit({ session, scope, changes, coachId }) {
  if (scope === 'one' || !session.timetable_day_id) {
    const payload = {}
    if (changes.title !== undefined) payload.title = changes.title
    if (changes.location !== undefined) payload.location = changes.location
    if (changes.sport !== undefined) payload.sport = changes.sport
    if (changes.start_time !== undefined) payload.start_time = changes.start_time
    if (changes.end_time !== undefined) payload.end_time = changes.end_time
    if (changes.notes !== undefined) payload.notes = changes.notes
    const { error } = await supabase.from('training_sessions').update(payload).eq('id', session.id)
    if (error) { toast(error.message, 'error'); return false }

    if (changes.athlete_ids !== undefined) {
      await supabase.from('training_session_athletes').delete().eq('session_id', session.id)
      if (changes.athlete_ids.length > 0) {
        await supabase.from('training_session_athletes').insert(
          changes.athlete_ids.map(aid => ({ session_id: session.id, athlete_id: String(aid) }))
        )
      }
    }
    return true
  }

  if (scope === 'day') {
    const dayPayload = {}
    if (changes.start_time !== undefined) dayPayload.start_time = changes.start_time
    if (changes.end_time !== undefined) dayPayload.end_time = changes.end_time
    if (Object.keys(dayPayload).length > 0) {
      const { error } = await supabase.from('timetable_days').update(dayPayload).eq('id', session.timetable_day_id)
      if (error) { toast(error.message, 'error'); return false }
    }

    // title/location/sport/notes/athletes live on the timetable itself, not the day
    const ttPayload = {}
    if (changes.title !== undefined) ttPayload.title = changes.title
    if (changes.location !== undefined) ttPayload.location = changes.location
    if (changes.sport !== undefined) ttPayload.sport = changes.sport
    if (changes.notes !== undefined) ttPayload.notes = changes.notes
    if (changes.athlete_ids !== undefined) ttPayload.athlete_ids = changes.athlete_ids
    // NOTE: editing these via "day" scope would affect the whole timetable since they're
    // shared fields — so we only allow time changes at the day scope in the UI, and treat
    // title/location/sport/notes/athletes edits as always being 'timetable' scope.

    await clearFutureGeneratedSessions({ timetableDayId: session.timetable_day_id })
    await generateUpcomingSessions(coachId)
    return true
  }

  if (scope === 'timetable') {
    const ttPayload = {}
    if (changes.title !== undefined) ttPayload.title = changes.title
    if (changes.location !== undefined) ttPayload.location = changes.location
    if (changes.sport !== undefined) ttPayload.sport = changes.sport
    if (changes.notes !== undefined) ttPayload.notes = changes.notes
    if (changes.athlete_ids !== undefined) ttPayload.athlete_ids = changes.athlete_ids
    if (Object.keys(ttPayload).length > 0) {
      const { error } = await supabase.from('timetables').update(ttPayload).eq('id', session.timetable_id)
      if (error) { toast(error.message, 'error'); return false }
    }

    if (changes.start_time !== undefined || changes.end_time !== undefined) {
      const dayPayload = {}
      if (changes.start_time !== undefined) dayPayload.start_time = changes.start_time
      if (changes.end_time !== undefined) dayPayload.end_time = changes.end_time
      await supabase.from('timetable_days').update(dayPayload).eq('timetable_id', session.timetable_id)
    }

    await clearFutureGeneratedSessions({ timetableId: session.timetable_id })
    await generateUpcomingSessions(coachId)
    return true
  }

  return false
}

/**
 * Cancels (deletes) one specific future occurrence without touching the pattern —
 * used for "skip this Monday" type one-off exceptions.
 */
export async function cancelOneOccurrence(sessionId) {
  await supabase.from('training_session_athletes').delete().eq('session_id', sessionId)
  await supabase.from('training_sessions').delete().eq('id', sessionId)
}

/**
 * Creation form: pick a coach, title, shared details, multiple days each with its own
 * time, and a shared athlete list. Creates one `timetables` row + one `timetable_days`
 * row per selected day, then immediately generates the next 8 weeks of real sessions.
 */
export function CreateTimetableForm({ coachId, myAthletes, ar, onClose, onCreated }) {
  const L = (en, a) => ar ? a : en
  const [title, setTitle] = useState('')
  const [sessionType, setSessionType] = useState('Training')
  const [sport, setSport] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [athleteIds, setAthleteIds] = useState([])
  const [days, setDays] = useState({})  // { [day_of_week]: { selected, slots: [{ start_time, end_time, label }] } }
  const [saving, setSaving] = useState(false)

  const toggleAth = (id) => {
    const sid = String(id)
    setAthleteIds(prev => prev.includes(sid) ? prev.filter(x=>x!==sid) : [...prev, sid])
  }

  function toggleDay(dow) {
    setDays(prev => {
      const cur = prev[dow]
      if (cur?.selected) {
        const next = { ...prev }
        next[dow] = { ...cur, selected: false }
        return next
      }
      return { ...prev, [dow]: { selected: true, slots: cur?.slots?.length ? cur.slots : [{ start_time:'16:00', end_time:'18:00', label:'' }] } }
    })
  }

  function setSlotField(dow, slotIdx, field, value) {
    setDays(prev => {
      const slots = prev[dow].slots.map((s,i) => i===slotIdx ? { ...s, [field]: value } : s)
      return { ...prev, [dow]: { ...prev[dow], slots } }
    })
  }

  function addSlot(dow) {
    setDays(prev => {
      const slots = [...prev[dow].slots, { start_time:'16:00', end_time:'18:00', label:'' }]
      return { ...prev, [dow]: { ...prev[dow], slots } }
    })
  }

  function removeSlot(dow, slotIdx) {
    setDays(prev => {
      const slots = prev[dow].slots.filter((_,i) => i !== slotIdx)
      return { ...prev, [dow]: { ...prev[dow], slots } }
    })
  }

  async function handleSubmit() {
    if (!title) { toast(L('Title is required','العنوان مطلوب'), 'error'); return }
    const selectedDays = Object.entries(days).filter(([,v]) => v.selected)
    if (selectedDays.length === 0) { toast(L('Pick at least one day','اختر يومًا واحدًا على الأقل'), 'error'); return }

    setSaving(true)
    const { data: tt, error } = await supabase.from('timetables').insert({
      coach_id: String(coachId),
      title, session_type: sessionType, sport: sport || null, location: location || null,
      notes: notes || null, athlete_ids: athleteIds, active: true,
    }).select().single()

    if (error || !tt) { toast(error?.message || 'Error', 'error'); setSaving(false); return }

    const dayRows = []
    selectedDays.forEach(([dow, v]) => {
      (v.slots || []).forEach(slot => {
        dayRows.push({
          timetable_id: tt.id,
          day_of_week: Number(dow),
          start_time: slot.start_time || null,
          end_time: slot.end_time || null,
          label: slot.label || null,
          active: true,
        })
      })
    })
    const { error: daysError } = await supabase.from('timetable_days').insert(dayRows)
    if (daysError) { toast(daysError.message, 'error'); setSaving(false); return }

    await generateUpcomingSessions(coachId)

    // Notify assigned athletes that a new recurring timetable was created for them
    if (athleteIds.length > 0) {
      const { data: athleteProfiles } = await supabase
        .from('profiles')
        .select('id, athlete_id')
        .in('athlete_id', athleteIds.map(String))
      const notifs = (athleteProfiles || []).map(p => ({
        user_id: p.id,
        type: 'timetable_created',
        title: ar ? 'تم إنشاء جدول أسبوعي جديد' : 'New weekly timetable created',
        body: title,
        data: { timetable_id: tt.id },
        read: false,
      }))
      if (notifs.length > 0) await supabase.from('notifications').insert(notifs)
    }

    toast(L('Timetable created','تم إنشاء الجدول'))
    setSaving(false)
    onCreated?.()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{L('New Weekly Timetable','جدول أسبوعي جديد')}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x"/></button>
        </div>
        <div className="modal-body">
          <div className="form-section">{L('Timetable Details','تفاصيل الجدول')}</div>
          <div className="form-group">
            <label className="form-label">{L('Title','العنوان')} *</label>
            <input className="form-input" placeholder={L('e.g. Goalball Training','مثال: تدريب كرة الهدف')} value={title} onChange={e=>setTitle(e.target.value)}/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{L('Type','النوع')}</label>
              <select className="form-input" value={sessionType} onChange={e=>setSessionType(e.target.value)}>
                {SESSION_TYPES.map(t=><option key={t} value={t}>{ar?{'Training':'تدريب','Competition':'منافسة','Medical':'طبي','Meeting':'اجتماع'}[t]:t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{L('Sport','الرياضة')}</label>
              <input className="form-input" placeholder={L('e.g. Goalball','مثال: كرة الهدف')} value={sport} onChange={e=>setSport(e.target.value)}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{L('Location','المكان')}</label>
            <input className="form-input" placeholder={L('e.g. Main Hall','مثال: القاعة الرئيسية')} value={location} onChange={e=>setLocation(e.target.value)}/>
          </div>
          <div className="form-group">
            <label className="form-label">{L('Notes','ملاحظات')}</label>
            <textarea className="form-input" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} style={{resize:'vertical'}}/>
          </div>

          <div className="form-section">{L('Days & Times','الأيام والأوقات')}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {DAYS_EN.map((d, dow) => {
              const dayData = days[dow]
              const isSelected = !!dayData?.selected
              return (
                <div key={dow} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', background: isSelected ? 'var(--surface2)' : 'transparent' }}>
                  <div onClick={() => toggleDay(dow)} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                    <div style={{width:18,height:18,borderRadius:4,border:'2px solid',borderColor:isSelected?'#0085C7':'var(--border)',background:isSelected?'#0085C7':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {isSelected && <i className="ti ti-check" style={{ fontSize:10, color:'#fff' }} />}
                    </div>
                    <span style={{ fontSize:13, fontWeight:600 }}>{ar ? DAYS_AR[dow] : d}</span>
                  </div>
                  {isSelected && (
                    <div style={{ paddingLeft:28, marginTop:8, display:'flex', flexDirection:'column', gap:8 }}>
                      {dayData.slots.map((slot, slotIdx) => (
                        <div key={slotIdx} style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          <input className="form-input" style={{ fontSize:12 }} placeholder={L('Label (optional, e.g. Morning)','تسمية (اختياري، مثال: صباحي)')} value={slot.label||''} onChange={e=>setSlotField(dow,slotIdx,'label',e.target.value)} />
                          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <input type="time" className="form-input" style={{ flex:'1 1 90px', minWidth:0 }} value={slot.start_time||''} onChange={e=>setSlotField(dow,slotIdx,'start_time',e.target.value)} />
                            <span style={{ color:'var(--text3)', flexShrink:0 }}>→</span>
                            <input type="time" className="form-input" style={{ flex:'1 1 90px', minWidth:0 }} value={slot.end_time||''} onChange={e=>setSlotField(dow,slotIdx,'end_time',e.target.value)} />
                            {dayData.slots.length > 1 && (
                              <button type="button" onClick={() => removeSlot(dow, slotIdx)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EE334E', flexShrink:0 }}>
                                <i className="ti ti-x" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => addSlot(dow)} style={{ alignSelf:'flex-start', background:'none', border:'none', cursor:'pointer', color:'#0085C7', fontSize:12, fontWeight:600, padding:'4px 0', display:'flex', alignItems:'center', gap:4 }}>
                        <i className="ti ti-plus" style={{ fontSize:12 }} /> {L('Add another time','إضافة وقت آخر')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="form-section">{L('Athletes','الرياضيون')} ({athleteIds.length} {L('selected','مختارون')})</div>
          <div style={{maxHeight:200,overflowY:'auto',border:'1px solid var(--border)',borderRadius:10,padding:'4px 0'}}>
            {myAthletes.map(a=>(
              <div key={a.id} onClick={()=>toggleAth(a.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',cursor:'pointer',background:athleteIds.includes(String(a.id))?'var(--surface2)':'transparent'}}>
                <div style={{width:18,height:18,borderRadius:4,border:'2px solid',borderColor:athleteIds.includes(String(a.id))?'#0085C7':'var(--border)',background:athleteIds.includes(String(a.id))?'#0085C7':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {athleteIds.includes(String(a.id)) && <i className="ti ti-check" style={{fontSize:10,color:'#fff'}}/>}
                </div>
                <span style={{fontSize:13}}>{ar&&a.name_ar?a.name_ar:a.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{L('Cancel','إلغاء')}</button>
          <button className="btn" style={{background:'#0085C7'}} onClick={handleSubmit} disabled={saving}>
            {saving ? L('Creating…','جارٍ الإنشاء…') : L('Create Timetable','إنشاء الجدول')}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Bulk edit screen: shows every day in a timetable side by side so the coach can
 * reshape the whole week in one save (e.g. shifting every session for Ramadan).
 */
export function EditTimetableForm({ timetableId, myAthletes, ar, coachId, onClose, onSaved }) {
  const L = (en, a) => ar ? a : en
  const [timetable, setTimetable] = useState(null)
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [timetableId])

  async function load() {
    setLoading(true)
    const { data: tt } = await supabase.from('timetables').select('*').eq('id', timetableId).single()
    const { data: dayRows } = await supabase.from('timetable_days').select('*').eq('timetable_id', timetableId).order('day_of_week')
    setTimetable(tt)
    setDays(dayRows || [])
    setRemovedDayIds([])
    setLoading(false)
  }

  function setField(field, value) { setTimetable(prev => ({ ...prev, [field]: value })) }
  function toggleAth(id) {
    const sid = String(id)
    setTimetable(prev => ({ ...prev, athlete_ids: prev.athlete_ids?.includes(sid) ? prev.athlete_ids.filter(x=>x!==sid) : [...(prev.athlete_ids||[]), sid] }))
  }
  function setDayField(dayId, field, value) {
    setDays(prev => prev.map(d => d.id === dayId ? { ...d, [field]: value } : d))
  }
  function toggleDayActive(dayId) {
    setDays(prev => prev.map(d => d.id === dayId ? { ...d, active: !d.active } : d))
  }
  const [removedDayIds, setRemovedDayIds] = useState([])

  function addNewSlot(dow) {
    // Temporary client-side id (negative timestamp) so React can key it before it's saved.
    const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setDays(prev => [...prev, { id: tempId, _isNew: true, timetable_id: timetableId, day_of_week: dow, start_time:'16:00', end_time:'18:00', label:'', active:true }])
  }
  function removeSlot(dayId) {
    const removed = days.find(d => d.id === dayId)
    if (removed && !removed._isNew) setRemovedDayIds(prev => [...prev, dayId])
    setDays(prev => prev.filter(d => d.id !== dayId))
  }

  async function handleSave() {
    if (!timetable.title) { toast(L('Title is required','العنوان مطلوب'), 'error'); return }
    setSaving(true)
    await supabase.from('timetables').update({
      title: timetable.title, session_type: timetable.session_type, sport: timetable.sport,
      location: timetable.location, notes: timetable.notes, athlete_ids: timetable.athlete_ids,
    }).eq('id', timetable.id)

    const existingDays = days.filter(d => !d._isNew)
    const newDays       = days.filter(d => d._isNew)

    if (removedDayIds.length > 0) {
      await supabase.from('timetable_days').delete().in('id', removedDayIds)
    }

    for (const d of existingDays) {
      await supabase.from('timetable_days').update({
        start_time: d.start_time, end_time: d.end_time, label: d.label || null, active: d.active,
      }).eq('id', d.id)
    }

    if (newDays.length > 0) {
      await supabase.from('timetable_days').insert(newDays.map(d => ({
        timetable_id: timetable.id, day_of_week: d.day_of_week,
        start_time: d.start_time, end_time: d.end_time, label: d.label || null, active: d.active,
      })))
    }

    // Regenerate: clear future sessions for the whole timetable, then rebuild from
    // the updated pattern (covers time changes, day activation/deactivation, new/removed
    // slots, and shared-field changes like title/location/athletes all in one pass).
    const todayStr = toLocalDateStr(new Date())
    await supabase.from('training_sessions').delete().eq('timetable_id', timetable.id).gte('session_date', todayStr)
    await generateUpcomingSessions(coachId)

    toast(L('Timetable updated','تم تحديث الجدول'))
    setSaving(false)
    onSaved?.()
  }

  if (loading || !timetable) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={e=>e.stopPropagation()}>
          <div className="modal-body"><div className="empty" style={{ padding:32 }}>{L('Loading…','جارٍ التحميل…')}</div></div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{L('Edit Timetable','تعديل الجدول')}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x"/></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
            <i className="ti ti-info-circle" />
            {L('Changes apply to all upcoming sessions in this timetable. Past sessions are not affected.','تنطبق التغييرات على جميع الجلسات القادمة في هذا الجدول. لا تتأثر الجلسات السابقة.')}
          </div>

          <div className="form-section">{L('Timetable Details','تفاصيل الجدول')}</div>
          <div className="form-group">
            <label className="form-label">{L('Title','العنوان')} *</label>
            <input className="form-input" value={timetable.title||''} onChange={e=>setField('title',e.target.value)}/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{L('Type','النوع')}</label>
              <select className="form-input" value={timetable.session_type||'Training'} onChange={e=>setField('session_type',e.target.value)}>
                {SESSION_TYPES.map(t=><option key={t} value={t}>{ar?{'Training':'تدريب','Competition':'منافسة','Medical':'طبي','Meeting':'اجتماع'}[t]:t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{L('Sport','الرياضة')}</label>
              <input className="form-input" value={timetable.sport||''} onChange={e=>setField('sport',e.target.value)}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{L('Location','المكان')}</label>
            <input className="form-input" value={timetable.location||''} onChange={e=>setField('location',e.target.value)}/>
          </div>
          <div className="form-group">
            <label className="form-label">{L('Notes','ملاحظات')}</label>
            <textarea className="form-input" rows={2} value={timetable.notes||''} onChange={e=>setField('notes',e.target.value)} style={{resize:'vertical'}}/>
          </div>

          <div className="form-section">{L('Days & Times','الأيام والأوقات')}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[0,1,2,3,4,5,6].map(dow => {
              const slotsForDay = days.filter(d => d.day_of_week === dow)
              if (slotsForDay.length === 0) return (
                <div key={dow} style={{ border:'1px dashed var(--border)', borderRadius:10, padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, color:'var(--text3)' }}>{ar ? DAYS_AR[dow] : DAYS_EN[dow]}</span>
                  <button type="button" onClick={() => addNewSlot(dow)} style={{ background:'none', border:'none', cursor:'pointer', color:'#0085C7', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                    <i className="ti ti-plus" style={{ fontSize:12 }} /> {L('Add time','إضافة وقت')}
                  </button>
                </div>
              )
              return (
                <div key={dow} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px' }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>{ar ? DAYS_AR[dow] : DAYS_EN[dow]}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {slotsForDay.map(d => (
                      <div key={d.id} style={{ opacity: d.active ? 1 : .5 }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
                          <div onClick={() => toggleDayActive(d.id)} style={{width:18,height:18,borderRadius:4,border:'2px solid',borderColor:d.active?'#0085C7':'var(--border)',background:d.active?'#0085C7':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer'}}>
                            {d.active && <i className="ti ti-check" style={{ fontSize:10, color:'#fff' }} />}
                          </div>
                          <input className="form-input" style={{ flex:1, fontSize:12, minWidth:0 }} placeholder={L('Label (optional)','تسمية (اختياري)')} value={d.label||''} onChange={e=>setDayField(d.id,'label',e.target.value)} disabled={!d.active} />
                        </div>
                        <div style={{ display:'flex', gap:8, alignItems:'center', paddingLeft:26 }}>
                          <input type="time" className="form-input" style={{ flex:'1 1 90px', minWidth:0 }} value={d.start_time||''} onChange={e=>setDayField(d.id,'start_time',e.target.value)} disabled={!d.active} />
                          <span style={{ color:'var(--text3)', flexShrink:0 }}>→</span>
                          <input type="time" className="form-input" style={{ flex:'1 1 90px', minWidth:0 }} value={d.end_time||''} onChange={e=>setDayField(d.id,'end_time',e.target.value)} disabled={!d.active} />
                          <button type="button" onClick={() => removeSlot(d.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EE334E', flexShrink:0 }}>
                            <i className="ti ti-trash" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => addNewSlot(dow)} style={{ alignSelf:'flex-start', background:'none', border:'none', cursor:'pointer', color:'#0085C7', fontSize:12, fontWeight:600, padding:'4px 0', display:'flex', alignItems:'center', gap:4 }}>
                      <i className="ti ti-plus" style={{ fontSize:12 }} /> {L('Add another time','إضافة وقت آخر')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="form-section">{L('Athletes','الرياضيون')} ({(timetable.athlete_ids||[]).length} {L('selected','مختارون')})</div>
          <div style={{maxHeight:200,overflowY:'auto',border:'1px solid var(--border)',borderRadius:10,padding:'4px 0'}}>
            {myAthletes.map(a=>(
              <div key={a.id} onClick={()=>toggleAth(a.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',cursor:'pointer',background:timetable.athlete_ids?.includes(String(a.id))?'var(--surface2)':'transparent'}}>
                <div style={{width:18,height:18,borderRadius:4,border:'2px solid',borderColor:timetable.athlete_ids?.includes(String(a.id))?'#0085C7':'var(--border)',background:timetable.athlete_ids?.includes(String(a.id))?'#0085C7':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {timetable.athlete_ids?.includes(String(a.id)) && <i className="ti ti-check" style={{fontSize:10,color:'#fff'}}/>}
                </div>
                <span style={{fontSize:13}}>{ar&&a.name_ar?a.name_ar:a.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{L('Cancel','إلغاء')}</button>
          <button className="btn" style={{background:'#0085C7'}} onClick={handleSave} disabled={saving}>
            {saving ? L('Saving…','جارٍ الحفظ…') : L('Save Changes','حفظ التغييرات')}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Modal shown when editing a generated session — lets the coach pick how broadly
 * their edit should apply before it's saved.
 */
/**
 * Small focused form for 'day' scope edits — only start/end time, since title,
 * location, sport, notes, and athletes are shared fields that live on the whole
 * timetable, not on an individual day.
 */
export function DayTimeForm({ session, coachId, ar, onClose, onSaved }) {
  const L = (en, a) => ar ? a : en
  const [startTime, setStartTime] = useState(session.start_time || '')
  const [endTime, setEndTime]     = useState(session.end_time || '')
  const [saving, setSaving]       = useState(false)

  async function handleSave() {
    setSaving(true)
    const ok = await applySessionEdit({
      session, scope: 'day', coachId,
      changes: { start_time: startTime || null, end_time: endTime || null },
    })
    setSaving(false)
    if (ok) { toast(L('Updated','تم التحديث')); onSaved?.() }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:420 }}>
        <div className="modal-header">
          <div className="modal-title">{L('Edit time for this day','تعديل الوقت لهذا اليوم')}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x"/></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:14 }}>
            {L('This changes the time for every future occurrence of this day. Other details stay the same.','سيغير هذا الوقت لكل الجلسات القادمة في هذا اليوم. التفاصيل الأخرى تبقى كما هي.')}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{L('Start time','وقت البداية')}</label>
              <input className="form-input" type="time" value={startTime} onChange={e=>setStartTime(e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">{L('End time','وقت النهاية')}</label>
              <input className="form-input" type="time" value={endTime} onChange={e=>setEndTime(e.target.value)}/>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{L('Cancel','إلغاء')}</button>
          <button className="btn" style={{background:'#0085C7'}} onClick={handleSave} disabled={saving}>
            {saving ? L('Saving…','جارٍ الحفظ…') : L('Save','حفظ')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function EditScopeModal({ session, ar, onPick, onCancel }) {
  const L = (en, a) => ar ? a : en
  if (!session.timetable_day_id) return null  // one-off sessions never need this

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={e => e.stopPropagation()} style={{ maxWidth:420 }}>
        <div className="confirm-icon"><i className="ti ti-calendar-repeat" /></div>
        <div className="confirm-title">{L('Apply this change to…','تطبيق هذا التغيير على…')}</div>
        <div className="confirm-msg">{L('This session is part of a weekly timetable. Choose how far this edit should apply.','هذه الجلسة جزء من جدول أسبوعي. اختر مدى تطبيق هذا التغيير.')}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:16 }}>
          <button className="action-btn" style={{ justifyContent:'flex-start' }} onClick={() => onPick('one')}>
            <i className="ti ti-calendar-event" style={{ marginRight:8 }} /> {L('Just this session','هذه الجلسة فقط')}
          </button>
          <button className="action-btn" style={{ justifyContent:'flex-start' }} onClick={() => onPick('day')}>
            <i className="ti ti-calendar" style={{ marginRight:8 }} /> {L('This day, going forward','هذا اليوم، من الآن فصاعدًا')}
          </button>
          <button className="action-btn" style={{ justifyContent:'flex-start' }} onClick={() => onPick('timetable')}>
            <i className="ti ti-calendar-repeat" style={{ marginRight:8 }} /> {L('Whole timetable, going forward','الجدول كامل، من الآن فصاعدًا')}
          </button>
        </div>
        <button className="btn-cancel" style={{ marginTop:12, width:'100%' }} onClick={onCancel}>{L('Cancel','إلغاء')}</button>
      </div>
    </div>
  )
}
