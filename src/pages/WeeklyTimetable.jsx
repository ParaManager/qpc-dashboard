import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toast, ConfirmModal } from '../components/Toast'

const SESSION_TYPES = ['Training','Competition','Medical','Meeting']
const SESSION_COLORS = { Training:'#0085C7', Competition:'#EE334E', Medical:'#009F6B', Meeting:'#8b5cf6' }
const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAYS_AR = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
const GENERATE_WEEKS_AHEAD = 8  // how many weeks into the future rules get materialized

/**
 * Generates real training_sessions rows from active weekly_schedule rules, covering
 * today through GENERATE_WEEKS_AHEAD weeks out. Safe to call repeatedly — skips any
 * (rule, date) combination that already has a generated session.
 */
export async function generateUpcomingSessions(coachId) {
  const { data: rules } = await supabase
    .from('weekly_schedule')
    .select('*')
    .eq('coach_id', String(coachId))
    .eq('active', true)
  if (!rules || rules.length === 0) return

  const { data: existing } = await supabase
    .from('training_sessions')
    .select('id, session_date, generated_from_rule_id')
    .not('generated_from_rule_id', 'is', null)
    .eq('coach_id', String(coachId))

  const existingKeys = new Set((existing || []).map(s => `${s.generated_from_rule_id}:${s.session_date}`))

  const today = new Date()
  today.setHours(0,0,0,0)
  const toInsert = []
  const toInsertAthletes = []

  for (let i = 0; i < GENERATE_WEEKS_AHEAD * 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dow = d.getDay()
    const dateStr = d.toISOString().slice(0,10)
    rules.filter(r => r.day_of_week === dow).forEach(rule => {
      const key = `${rule.id}:${dateStr}`
      if (existingKeys.has(key)) return
      toInsert.push({
        title: rule.title,
        coach_id: String(coachId),
        session_date: dateStr,
        session_type: rule.session_type,
        sport: rule.sport,
        location: rule.location,
        start_time: rule.start_time,
        end_time: rule.end_time,
        notes: rule.notes,
        generated_from_rule_id: rule.id,
        _athleteIds: rule.athlete_ids || [],  // stripped before insert, used after
      })
    })
  }

  if (toInsert.length === 0) return

  // Insert sessions first (without the helper field), then link athletes per inserted row
  const rows = toInsert.map(({ _athleteIds, ...rest }) => rest)
  const { data: inserted, error } = await supabase.from('training_sessions').insert(rows).select()
  if (error || !inserted) return

  inserted.forEach((row, i) => {
    const athleteIds = toInsert[i]._athleteIds
    athleteIds.forEach(athleteId => {
      toInsertAthletes.push({ session_id: row.id, athlete_id: String(athleteId) })
    })
  })

  if (toInsertAthletes.length > 0) {
    await supabase.from('training_session_athletes').insert(toInsertAthletes)
  }
}

export default function WeeklyTimetable({ coachId, myAthletes, ar, onClose, onChanged }) {
  const L = (en, a) => ar ? a : en
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)  // rule being edited, or {} for new
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => { load() }, [coachId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('weekly_schedule')
      .select('*')
      .eq('coach_id', String(coachId))
      .order('day_of_week')
    setRules(data || [])
    setLoading(false)
  }

  async function saveRule(form) {
    const payload = {
      title: form.title,
      coach_id: String(coachId),
      session_type: form.session_type,
      sport: form.sport || null,
      location: form.location || null,
      day_of_week: form.day_of_week,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      notes: form.notes || null,
      athlete_ids: form.athlete_ids || [],
      active: form.active !== false,
    }
    let error
    if (form.id) {
      const r = await supabase.from('weekly_schedule').update(payload).eq('id', form.id)
      error = r.error
    } else {
      const r = await supabase.from('weekly_schedule').insert(payload)
      error = r.error
    }
    if (error) { toast(error.message, 'error'); return }
    toast(L('Saved','تم الحفظ'))
    setEditing(null)
    await load()
    setRegenerating(true)
    await generateUpcomingSessions(coachId)
    setRegenerating(false)
    onChanged?.()
  }

  async function deleteRule(rule) {
    // Remove future not-yet-happened generated sessions tied to this rule so the
    // calendar doesn't keep showing slots for a rule that no longer exists. Past
    // sessions (already happened / may have attendance) are left untouched.
    const todayStr = new Date().toISOString().slice(0,10)
    await supabase.from('training_sessions').delete()
      .eq('generated_from_rule_id', rule.id)
      .gte('session_date', todayStr)
    await supabase.from('weekly_schedule').delete().eq('id', rule.id)
    toast(L('Deleted','تم الحذف'))
    setDeleteConfirm(null)
    load()
    onChanged?.()
  }

  async function toggleActive(rule) {
    await supabase.from('weekly_schedule').update({ active: !rule.active }).eq('id', rule.id)
    if (rule.active) {
      // Turning off: remove future generated sessions for this rule (not yet happened)
      const todayStr = new Date().toISOString().slice(0,10)
      await supabase.from('training_sessions').delete()
        .eq('generated_from_rule_id', rule.id)
        .gte('session_date', todayStr)
    }
    load()
    onChanged?.()
    if (!rule.active) {
      setRegenerating(true)
      await generateUpcomingSessions(coachId)
      setRegenerating(false)
    }
  }

  if (editing) {
    return <RuleForm
      data={editing}
      myAthletes={myAthletes}
      ar={ar}
      onSave={saveRule}
      onClose={() => setEditing(null)}
    />
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{L('Weekly Timetable','الجدول الأسبوعي')}</div>
          <div className="page-sub">{L('Fixed recurring slots — sessions are created automatically each week','فترات أسبوعية ثابتة — يتم إنشاء الجلسات تلقائيًا كل أسبوع')}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="action-btn" onClick={onClose}>
            <i className="ti ti-arrow-left" /> {L('Back to calendar','رجوع إلى التقويم')}
          </button>
          <button className="btn" style={{ background:'#0085C7' }} onClick={() => setEditing({ day_of_week:1, session_type:'Training', athlete_ids:[] })}>
            <i className="ti ti-plus" /> {L('Add recurring slot','إضافة فترة أسبوعية')}
          </button>
        </div>
      </div>

      {regenerating && (
        <div style={{ fontSize:12, color:'var(--text3)', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
          <i className="ti ti-loader-2" /> {L('Updating upcoming sessions…','جارٍ تحديث الجلسات القادمة…')}
        </div>
      )}

      {loading ? (
        <div className="empty" style={{ padding:32 }}>{L('Loading…','جارٍ التحميل…')}</div>
      ) : rules.length === 0 ? (
        <div className="card">
          <div className="empty" style={{ padding:32 }}>
            <i className="ti ti-calendar-repeat" style={{ fontSize:28, marginBottom:8 }} />
            <div>{L('No recurring slots yet. Add one to stop creating the same session every week.','لا توجد فترات أسبوعية بعد. أضف واحدة لتجنب إنشاء نفس الجلسة كل أسبوع.')}</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {[0,1,2,3,4,5,6].map(dow => {
            const dayRules = rules.filter(r => r.day_of_week === dow)
            if (dayRules.length === 0) return null
            return (
              <div key={dow}>
                <div style={{ padding:'10px 16px', background:'var(--surface2)', fontSize:12, fontWeight:600, color:'var(--text3)', textTransform:'uppercase' }}>
                  {ar ? DAYS_AR[dow] : DAYS_EN[dow]}
                </div>
                {dayRules.map(rule => {
                  const color = SESSION_COLORS[rule.session_type] || '#0085C7'
                  return (
                    <div key={rule.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid var(--border)', opacity: rule.active ? 1 : .5 }}>
                      <div style={{ width:4, height:36, borderRadius:2, background:color, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600 }}>{rule.title}</div>
                        <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                          {rule.start_time?.slice(0,5)||'—'} → {rule.end_time?.slice(0,5)||'—'}
                          {rule.location ? ` · ${rule.location}` : ''}
                          {' · '}{(rule.athlete_ids||[]).length} {L('athletes','رياضيون')}
                          {!rule.active && ` · ${L('inactive','غير نشط')}`}
                        </div>
                      </div>
                      <button className="action-btn" onClick={() => toggleActive(rule)} title={rule.active ? L('Pause','إيقاف مؤقت') : L('Resume','استئناف')}>
                        <i className={`ti ${rule.active ? 'ti-pause' : 'ti-play'}`} />
                      </button>
                      <button className="action-btn action-btn-edit" onClick={() => setEditing(rule)}>
                        <i className="ti ti-pencil" />
                      </button>
                      <button className="action-btn action-btn-delete" onClick={() => setDeleteConfirm(rule)}>
                        <i className="ti ti-trash" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {deleteConfirm && (
        <ConfirmModal
          title={L('Delete this recurring slot?','حذف هذه الفترة الأسبوعية؟')}
          message={L(
            `"${deleteConfirm.title}" will stop generating new sessions. Upcoming sessions already on the calendar will be removed, but past sessions and their attendance records are kept.`,
            `سيتوقف "${deleteConfirm.title}" عن إنشاء جلسات جديدة. سيتم حذف الجلسات القادمة من التقويم، ولكن سيتم الاحتفاظ بالجلسات السابقة وسجلات الحضور الخاصة بها.`
          )}
          confirmLabel={L('Delete','حذف')}
          cancelLabel={L('Cancel','إلغاء')}
          onConfirm={() => deleteRule(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

function RuleForm({ data, myAthletes, ar, onSave, onClose }) {
  const L = (en, a) => ar ? a : en
  const [form, setForm] = useState(data)
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))
  const toggleAth = (id) => {
    const sid = String(id)
    set('athlete_ids', form.athlete_ids?.includes(sid) ? form.athlete_ids.filter(x=>x!==sid) : [...(form.athlete_ids||[]), sid])
  }
  const isEdit = !!form.id

  function handleSubmit() {
    if (!form.title) { toast(L('Title is required','العنوان مطلوب'), 'error'); return }
    if (form.day_of_week === undefined || form.day_of_week === null) { toast(L('Pick a day','اختر يومًا'), 'error'); return }
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? L('Edit recurring slot','تعديل الفترة الأسبوعية') : L('New recurring slot','فترة أسبوعية جديدة')}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x"/></button>
        </div>
        <div className="modal-body">
          <div className="form-section">{L('Slot Details','تفاصيل الفترة')}</div>
          <div className="form-group">
            <label className="form-label">{L('Title','العنوان')} *</label>
            <input className="form-input" placeholder={L('e.g. Morning Training','مثال: تدريب صباحي')} value={form.title||''} onChange={e=>set('title',e.target.value)}/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{L('Type','النوع')}</label>
              <select className="form-input" value={form.session_type||'Training'} onChange={e=>set('session_type',e.target.value)}>
                {SESSION_TYPES.map(t=><option key={t} value={t}>{ar?{'Training':'تدريب','Competition':'منافسة','Medical':'طبي','Meeting':'اجتماع'}[t]:t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{L('Day of week','يوم الأسبوع')} *</label>
              <select className="form-input" value={form.day_of_week ?? 1} onChange={e=>set('day_of_week', Number(e.target.value))}>
                {DAYS_EN.map((d, i) => <option key={i} value={i}>{ar ? DAYS_AR[i] : d}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{L('Start time','وقت البداية')}</label>
              <input className="form-input" type="time" value={form.start_time||''} onChange={e=>set('start_time',e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">{L('End time','وقت النهاية')}</label>
              <input className="form-input" type="time" value={form.end_time||''} onChange={e=>set('end_time',e.target.value)}/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{L('Location','المكان')}</label>
              <input className="form-input" placeholder={L('e.g. Main Hall','مثال: القاعة الرئيسية')} value={form.location||''} onChange={e=>set('location',e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">{L('Sport','الرياضة')}</label>
              <input className="form-input" placeholder={L('e.g. Goalball','مثال: كرة الهدف')} value={form.sport||''} onChange={e=>set('sport',e.target.value)}/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{L('Notes','ملاحظات')}</label>
            <textarea className="form-input" rows={2} value={form.notes||''} onChange={e=>set('notes',e.target.value)} style={{resize:'vertical'}}/>
          </div>

          <div className="form-section">{L('Athletes','الرياضيون')} ({(form.athlete_ids||[]).length} {L('selected','مختارون')})</div>
          <div style={{maxHeight:200,overflowY:'auto',border:'1px solid var(--border)',borderRadius:10,padding:'4px 0'}}>
            {myAthletes.map(a=>(
              <div key={a.id} onClick={()=>toggleAth(a.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',cursor:'pointer',background:form.athlete_ids?.includes(String(a.id))?'var(--surface2)':'transparent'}}>
                <div style={{width:18,height:18,borderRadius:4,border:'2px solid',borderColor:form.athlete_ids?.includes(String(a.id))?'#0085C7':'var(--border)',background:form.athlete_ids?.includes(String(a.id))?'#0085C7':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {form.athlete_ids?.includes(String(a.id))&&<i className="ti ti-check" style={{fontSize:10,color:'#fff'}}/>}
                </div>
                <span style={{fontSize:13}}>{ar&&a.name_ar?a.name_ar:a.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{L('Cancel','إلغاء')}</button>
          <button className="btn" style={{background:'#0085C7'}} onClick={handleSubmit}>
            {isEdit ? L('Save changes','حفظ التغييرات') : L('Add recurring slot','إضافة الفترة')}
          </button>
        </div>
      </div>
    </div>
  )
}
