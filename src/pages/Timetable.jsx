import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast } from '../components/Toast'

export const SESSION_TYPES = ['Training','Competition','Medical','Meeting']
export const SESSION_COLORS = { Training:'#0085C7', Competition:'#EE334E', Medical:'#009F6B', Meeting:'#8b5cf6' }
export const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
export const DAYS_AR = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
const GENERATE_WEEKS_AHEAD = 8  // how many weeks into the future timetable_days get materialized into real sessions

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
    const dateStr = d.toISOString().slice(0,10)
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
  const todayStr = new Date().toISOString().slice(0,10)
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
  const [days, setDays] = useState({})  // { [day_of_week]: { selected, start_time, end_time } }
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
      return { ...prev, [dow]: { selected: true, start_time: cur?.start_time || '16:00', end_time: cur?.end_time || '18:00' } }
    })
  }

  function setDayTime(dow, field, value) {
    setDays(prev => ({ ...prev, [dow]: { ...prev[dow], [field]: value } }))
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

    const dayRows = selectedDays.map(([dow, v]) => ({
      timetable_id: tt.id,
      day_of_week: Number(dow),
      start_time: v.start_time || null,
      end_time: v.end_time || null,
      active: true,
    }))
    const { error: daysError } = await supabase.from('timetable_days').insert(dayRows)
    if (daysError) { toast(daysError.message, 'error'); setSaving(false); return }

    await generateUpcomingSessions(coachId)
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
                    <div style={{ display:'flex', gap:10, marginTop:8, paddingLeft:28 }}>
                      <input type="time" className="form-input" style={{ flex:1 }} value={dayData.start_time||''} onChange={e=>setDayTime(dow,'start_time',e.target.value)} />
                      <span style={{ alignSelf:'center', color:'var(--text3)' }}>→</span>
                      <input type="time" className="form-input" style={{ flex:1 }} value={dayData.end_time||''} onChange={e=>setDayTime(dow,'end_time',e.target.value)} />
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

  async function handleSave() {
    if (!timetable.title) { toast(L('Title is required','العنوان مطلوب'), 'error'); return }
    setSaving(true)
    await supabase.from('timetables').update({
      title: timetable.title, session_type: timetable.session_type, sport: timetable.sport,
      location: timetable.location, notes: timetable.notes, athlete_ids: timetable.athlete_ids,
    }).eq('id', timetable.id)

    for (const d of days) {
      await supabase.from('timetable_days').update({
        start_time: d.start_time, end_time: d.end_time, active: d.active,
      }).eq('id', d.id)
    }

    // Regenerate: clear future sessions for the whole timetable, then rebuild from
    // the updated pattern (covers time changes, day activation/deactivation, and
    // shared-field changes like title/location/athletes all in one pass).
    const todayStr = new Date().toISOString().slice(0,10)
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
            {days.map(d => (
              <div key={d.id} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', opacity: d.active ? 1 : .5 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div onClick={() => toggleDayActive(d.id)} style={{width:18,height:18,borderRadius:4,border:'2px solid',borderColor:d.active?'#0085C7':'var(--border)',background:d.active?'#0085C7':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer'}}>
                    {d.active && <i className="ti ti-check" style={{ fontSize:10, color:'#fff' }} />}
                  </div>
                  <span style={{ fontSize:13, fontWeight:600 }}>{ar ? DAYS_AR[d.day_of_week] : DAYS_EN[d.day_of_week]}</span>
                </div>
                {d.active && (
                  <div style={{ display:'flex', gap:10, marginTop:8, paddingLeft:28 }}>
                    <input type="time" className="form-input" style={{ flex:1 }} value={d.start_time||''} onChange={e=>setDayField(d.id,'start_time',e.target.value)} />
                    <span style={{ alignSelf:'center', color:'var(--text3)' }}>→</span>
                    <input type="time" className="form-input" style={{ flex:1 }} value={d.end_time||''} onChange={e=>setDayField(d.id,'end_time',e.target.value)} />
                  </div>
                )}
              </div>
            ))}
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
