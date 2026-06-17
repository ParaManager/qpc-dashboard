import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { Avatar, Badge } from '../lib/helpers'
import { toast, ConfirmModal } from '../components/Toast'

const SESSION_TYPES = ['Training','Competition','Medical','Meeting']
const SESSION_COLORS = { Training:'#0085C7', Competition:'#EE334E', Medical:'#009F6B', Meeting:'#8b5cf6' }
const STATUS_OPTS = ['Present','Absent','Late','Excused']
const STATUS_COLORS = { Present:'#009F6B', Absent:'#EE334E', Late:'#f59e0b', Excused:'#8b5cf6' }

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDay(year, month) {
  return new Date(year, month, 1).getDay()
}

export default function Schedule({ profile, coachId, myAthletes, onNav, readOnly, athleteId, athletes, initSessionId }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const [sessions, setSessions]       = useState([])
  const [directSession, setDirectSession] = useState(null)  // session opened directly from dashboard
  const [deleteConfirm, setDeleteConfirm] = useState(null)  // session pending delete confirmation
  const [view, setView]               = useState('month') // month | week | list
  const [today]                       = useState(new Date())
  const [curDate, setCurDate]         = useState(new Date())
  const [selected, setSelected]       = useState(initSessionId || null)   // selected session
  const [showForm, setShowForm]       = useState(false)
  const [editData, setEditData]       = useState(null)
  const [requestModal, setRequestModal] = useState(null)  // session to request for
  const [requests, setRequests]         = useState([])
  const [loading, setLoading]         = useState(true)

  const year  = curDate.getFullYear()
  const month = curDate.getMonth()

  useEffect(() => { loadSessions(); loadRequests() }, [coachId, year, month, athleteId])

  // Auto-open session from dashboard click
  useEffect(() => {
    if (!initSessionId) return
    const s = sessions.find(x => x.id === initSessionId)
    if (s) { setDirectSession(null); setSelected(initSessionId); return }
    // Not in current month — fetch directly and store it so detail view can find it
    supabase.from('training_sessions').select('*').eq('id', initSessionId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = new Date(data.session_date)
          setCurDate(d)
          setDirectSession(data)
          setSelected(initSessionId)
        }
      })
  }, [initSessionId, sessions])

  async function loadRequests() {
    if (!coachId && !athleteId) return
    let q = supabase.from('training_session_requests').select('*').order('created_at', { ascending: false })
    if (coachId)   q = q.eq('coach_id', String(coachId))
    if (athleteId) q = q.eq('athlete_id', String(athleteId))
    const { data } = await q
    setRequests(data || [])
  }

  async function loadSessions() {
    setLoading(true)
    const from = `${year}-${String(month+1).padStart(2,'0')}-01`
    const to   = `${year}-${String(month+1).padStart(2,'0')}-${getDaysInMonth(year,month)}`
    let q = supabase.from('training_sessions').select('*, training_session_athletes(athlete_id)').gte('session_date', from).lte('session_date', to).order('session_date').order('start_time')
    if (coachId) q = q.eq('coach_id', coachId)
    const { data, error } = await q
    if (!error) setSessions(data || [])
    setLoading(false)
  }

  async function saveSession(form) {
    const payload = {
      coach_id: coachId, title: form.title, session_type: form.type || 'Training',
      sport: form.sport, location: form.location, session_date: form.date,
      start_time: form.startTime || null, end_time: form.endTime || null, notes: form.notes,
    }
    if (!payload.title || !payload.session_date) { toast(ar?'العنوان والتاريخ مطلوبان':'Title and date required','error'); return }
    let sessionId = form.id
    if (form.id) {
      const { error } = await supabase.from('training_sessions').update(payload).eq('id', form.id)
      if (error) { toast(error.message,'error'); return }
    } else {
      const { data, error } = await supabase.from('training_sessions').insert(payload).select().single()
      if (error) { toast(error.message,'error'); return }
      sessionId = data.id
    }
    // Update athlete links
    if (sessionId && form.athleteIds?.length >= 0) {
      await supabase.from('training_session_athletes').delete().eq('session_id', sessionId)
      if (form.athleteIds?.length > 0) {
        await supabase.from('training_session_athletes').insert(form.athleteIds.map(aid => ({ session_id: sessionId, athlete_id: aid })))
        // Notify each athlete - resolve their profile UUID first
        const { data: athleteProfiles } = await supabase
          .from('profiles')
          .select('id, athlete_id')
          .in('athlete_id', form.athleteIds.map(String))
        const notifs = (athleteProfiles || []).map(p => ({
          user_id: p.id,
          type: 'session_added',
          title: ar ? 'تمت إضافة جلسة جديدة' : 'New session added',
          body: `${form.title || (ar?'جلسة تدريب':'Training session')} - ${form.date}`,
          data: { session_id: sessionId },
          read: false,
        }))
        if (notifs.length > 0) await supabase.from('notifications').insert(notifs)
      }
    }
    toast(form.id ? (ar?'تم التحديث':'Updated') : (ar?'تم الإضافة':'Session added'))
    setShowForm(false); setEditData(null); loadSessions()
  }

  async function deleteSession(id) {
    await supabase.from('training_sessions').delete().eq('id', id)
    toast(ar?'تم الحذف':'Deleted')
    setSelected(null); loadSessions()
  }

  const L = (en, a) => ar ? a : en
  const monthNames = ar
    ? ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    : ['January','February','March','April','May','June','July','August','September','October','November','December']
  const dayNames = ar
    ? ['أح','اث','ثل','أر','خم','جم','سب']
    : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  // Filter sessions for athlete view
  const filterSessions = (list) => athleteId
    ? list.filter(s => (s.training_session_athletes||[]).some(sa => String(sa.athlete_id) === String(athleteId)))
    : list

  const sessionsOnDay = (d) => {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    return filterSessions(sessions.filter(s => s.session_date === ds))
  }

  const isToday = (d) => today.getFullYear()===year && today.getMonth()===month && today.getDate()===d

  // ── SESSION FORM ──
  if (showForm) {
    return <SessionForm
      data={editData}
      athletes={myAthletes}
      coachId={coachId}
      ar={ar}
      onSave={saveSession}
      onClose={() => { setShowForm(false); setEditData(null) }}
    />
  }

  // ── SESSION DETAIL ──
  if (selected) {
    const s = sessions.find(x => x.id === selected) || (directSession?.id === selected ? directSession : null)
    if (!s) { setSelected(null); setDirectSession(null); return null }
    const sAthletes = myAthletes.filter(a => s.training_session_athletes?.some(sa => String(sa.athlete_id) === String(a.id)))
    const myRequest = requests.find(r => r.session_id === s.id && String(r.athlete_id) === String(athleteId))
    const color = SESSION_COLORS[s.session_type] || '#0085C7'
    return (
      <div>
        {requestModal && (
          <RequestModal
            session={requestModal}
            athleteId={athleteId}
            ar={ar}
            onClose={() => setRequestModal(null)}
            onSave={async (type, reason) => {
              const { error: reqErr } = await supabase.from('training_session_requests').insert({
                session_id: requestModal.id,
                athlete_id: String(athleteId),
                coach_id: String(requestModal.coach_id || coachId || ''),
                type, reason, status: 'pending'
              })
              if (reqErr) { toast(reqErr.message, 'error'); return }
              // Find coach's profile ID to send notification
              const targetCoachId = String(requestModal.coach_id || coachId || '')
              const { data: cpList } = await supabase
                .from('profiles')
                .select('id, coach_id')
              const coachProfile = (cpList||[]).find(p => String(p.coach_id) === targetCoachId)
              if (coachProfile) {
                await supabase.from('notifications').insert({
                  user_id: String(coachProfile.id),
                  type: 'excuse_request',
                  title: ar ? 'طلب عذر جديد' : 'New excuse/reschedule request',
                  body: `${type === 'excuse' ? (ar?'عذر':'Excuse') : (ar?'إعادة جدولة':'Reschedule')} - ${requestModal.title || requestModal.session_date}`,
                  data: { session_id: requestModal.id },
                  read: false,
                })
              }
              setRequestModal(null)
              loadRequests()
              toast(ar ? 'تم إرسال الطلب' : 'Request sent')
            }}
          />
        )}
        <button className="back-btn" onClick={() => { setSelected(null); setDirectSession(null) }}>
          <i className="ti ti-arrow-left" /> {L('Back to schedule','رجوع إلى الجدول')}
        </button>
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          {!readOnly && <>
            <button className="action-btn action-btn-edit" onClick={() => { setEditData({ id:s.id, title:s.title, type:s.session_type, sport:s.sport, location:s.location, date:s.session_date, startTime:s.start_time, endTime:s.end_time, notes:s.notes, athleteIds: s.training_session_athletes?.map(sa=>sa.athlete_id)||[] }); setShowForm(true) }}>
              <i className="ti ti-pencil" /> {L('Edit','تعديل')}
            </button>
            <button className="action-btn action-btn-delete" onClick={() => setDeleteConfirm(s)}>
              <i className="ti ti-trash" /> {L('Delete','حذف')}
            </button>
            <button className="btn" style={{ background:color, fontSize:13, padding:'6px 14px' }}
              onClick={() => onNav('attendance', { sessionId: s.id })}>
              <i className="ti ti-clipboard-check" /> {L('Take attendance','تسجيل الحضور')}
            </button>
          </>}
          {readOnly && athleteId && (
            myRequest ? (
              <div style={{ padding:'8px 14px', borderRadius:8, fontSize:13, background: myRequest.status==='pending'?'#f59e0b15':myRequest.status==='approved'?'#009F6B15':'#EE334E15', color: myRequest.status==='pending'?'#f59e0b':myRequest.status==='approved'?'#009F6B':'#EE334E', border:`1px solid ${myRequest.status==='pending'?'#f59e0b40':myRequest.status==='approved'?'#009F6B40':'#EE334E40'}` }}>
                <i className={`ti ${myRequest.status==='pending'?'ti-clock':myRequest.status==='approved'?'ti-check':'ti-x'}`} style={{ marginRight:6 }} />
                {myRequest.type==='excuse'?(ar?'طلب عذر':'Excuse request'):(ar?'طلب إعادة جدولة':'Reschedule request')}
                {' — '}{ar?{'pending':'قيد الانتظار','approved':'موافق عليه','rejected':'مرفوض'}[myRequest.status]:myRequest.status}
              </div>
            ) : (
              <button onClick={() => setRequestModal(s)}
                style={{ padding:'7px 16px', background:'#EE334E10', color:'#EE334E', border:'1px solid #EE334E40', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'DM Sans, sans-serif', display:'flex', alignItems:'center', gap:6 }}>
                <i className="ti ti-calendar-off" /> {ar?'لا أستطيع الحضور':"Can't make it"}
              </button>
            )
          )}
        </div>
        <div className="detail-grid">
          <div className="detail-profile">
            <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
              <span className="badge" style={{ background:color+'20', color }}>{L(s.session_type, {'Training':'تدريب','Competition':'منافسة','Medical':'طبي','Meeting':'اجتماع'}[s.session_type]||s.session_type)}</span>
              {s.attendance_closed && (
                <span className="badge" style={{ background:'#9aa3b220', color:'#9aa3b2', display:'flex', alignItems:'center', gap:4 }}>
                  <i className="ti ti-lock" style={{ fontSize:11 }} /> {L('Attendance closed','الحضور مغلق')}
                </span>
              )}
            </div>
            <div className="detail-name">{s.title}</div>
            <div className="detail-fields" style={{ marginTop:14 }}>
              {[[L('Date','التاريخ'),s.session_date],[L('Time','الوقت'),s.start_time?(s.start_time+(s.end_time?' → '+s.end_time:'')):'—'],[L('Location','المكان'),s.location||'—'],[L('Sport','الرياضة'),s.sport||'—'],[L('Athletes','الرياضيون'),sAthletes.length],[L('Notes','ملاحظات'),s.notes||'—']].map(([k,v]) => (
                <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
              ))}
            </div>
          </div>
          <div className="info-card">
            <div className="info-title">{L('Athletes in this session','الرياضيون في هذه الجلسة')} ({sAthletes.length})</div>
            {sAthletes.length === 0
              ? <div className="empty">{L('No athletes assigned','لا يوجد رياضيون')}</div>
              : sAthletes.map(a => (
                <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                  <Avatar name={a.name} id={a.id} size={32} fs={10} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:500 }}>{ar && a.name_ar ? a.name_ar : a.name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{a.classification}</div>
                  </div>
                </div>
              ))
            }
          </div>

          {/* Requests from athletes - coach only */}
          {!readOnly && requests.filter(r => r.session_id === s.id).length > 0 && (
            <div className="info-card">
              <div className="info-title" style={{ color:'#f59e0b' }}>
                <i className="ti ti-clock" style={{ marginRight:6 }} />
                {L('Athlete Requests','طلبات الرياضيين')} ({requests.filter(r => r.session_id === s.id).length})
              </div>
              {requests.filter(r => r.session_id === s.id).map(req => {
                const ath = myAthletes.find(a => String(a.id) === String(req.athlete_id))
                return (
                  <div key={req.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
                      <Avatar name={ath?.name||'?'} id={req.athlete_id} size={28} fs={10} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500 }}>{ar&&ath?.name_ar?ath.name_ar:ath?.name||req.athlete_id}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>
                          {req.type==='excuse'?(ar?'عذر':'Excuse'):(ar?'إعادة جدولة':'Reschedule')}
                          {req.reason && ` — "${req.reason}"`}
                        </div>
                      </div>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600,
                        background: req.status==='pending'?'#f59e0b20':req.status==='approved'?'#009F6B20':'#EE334E20',
                        color: req.status==='pending'?'#f59e0b':req.status==='approved'?'#009F6B':'#EE334E' }}>
                        {ar?{'pending':'معلق','approved':'موافق','rejected':'مرفوض'}[req.status]:req.status}
                      </span>
                    </div>
                    {req.status === 'pending' && (
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={async () => {
                          await supabase.from('training_session_requests').update({ status:'approved' }).eq('id', req.id)
                          const { data: athProfile } = await supabase.from('profiles').select('id,athlete_id').then(r => r)
                          const ap = (athProfile||[]).find(p => String(p.athlete_id) === String(req.athlete_id))
                          if (ap) await supabase.from('notifications').insert({ user_id: String(ap.id), type:'request_approved', title: ar?'تم قبول طلبك':'Request approved', body: ar?'تم قبول طلب العذر/إعادة الجدولة':'Your request was approved', data: { session_id: req.session_id }, read: false })
                          loadRequests()
                          toast(L('Request approved','تم قبول الطلب'))
                        }} style={{ padding:'5px 14px', background:'#009F6B', color:'#fff', border:'none', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                          <i className="ti ti-check" /> {L('Approve','موافقة')}
                        </button>
                        <button onClick={async () => {
                          await supabase.from('training_session_requests').update({ status:'rejected' }).eq('id', req.id)
                          const { data: athProfile } = await supabase.from('profiles').select('id,athlete_id').then(r => r)
                          const ap = (athProfile||[]).find(p => String(p.athlete_id) === String(req.athlete_id))
                          if (ap) await supabase.from('notifications').insert({ user_id: String(ap.id), type:'request_rejected', title: ar?'تم رفض طلبك':'Request rejected', body: ar?'تم رفض طلب العذر/إعادة الجدولة':'Your request was rejected', data: { session_id: req.session_id }, read: false })
                          loadRequests()
                          toast(L('Request rejected','تم رفض الطلب'))
                        }} style={{ padding:'5px 14px', background:'#EE334E', color:'#fff', border:'none', borderRadius:7, fontSize:12, cursor:'pointer' }}>
                          <i className="ti ti-x" /> {L('Reject','رفض')}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {deleteConfirm && (
          <ConfirmModal
            title={ar ? 'حذف الجلسة' : 'Delete session'}
            message={ar ? `هل تريد حذف "${deleteConfirm.title || deleteConfirm.session_date}"؟ لا يمكن التراجع عن هذا.` : `Delete "${deleteConfirm.title || deleteConfirm.session_date}"? This cannot be undone.`}
            onConfirm={async () => { await deleteSession(deleteConfirm.id); setDeleteConfirm(null) }}
            onCancel={() => setDeleteConfirm(null)}
          />
        )}
      </div>
    )
  }

  // ── MONTH VIEW ──
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay    = getFirstDay(year, month)

  return (
    <div>
      {requestModal && (
        <RequestModal
          session={requestModal}
          athleteId={athleteId}
          ar={ar}
          onClose={() => setRequestModal(null)}
          onSave={async (type, reason) => {
            await supabase.from('training_session_requests').insert({
              session_id: requestModal.id,
              athlete_id: String(athleteId),
              coach_id: String(requestModal.coach_id || coachId || ''),
              type, reason,
              status: 'pending'
            })
            const targetId = String(requestModal.coach_id || coachId || '')
            const { data: cpList2 } = await supabase.from('profiles').select('id, coach_id')
            const cp = (cpList2||[]).find(p => String(p.coach_id) === targetId)
            if (cp) {
              await supabase.from('notifications').insert({
                user_id: String(cp.id),
                type: 'excuse_request',
                title: ar ? 'طلب عذر جديد' : 'New excuse/reschedule request',
                body: `${type === 'excuse' ? (ar?'عذر':'Excuse') : (ar?'إعادة جدولة':'Reschedule')} - ${requestModal.title || requestModal.session_date}`,
                read: false,
              })
            }
            setRequestModal(null)
            loadRequests()
            toast(ar ? 'تم إرسال الطلب' : 'Request sent')
          }}
        />
      )}
      <div className="page-header">
        <div>
          <div className="page-title">{L('Schedule','الجدول الزمني')}</div>
          <div className="page-sub">{monthNames[month]} {year}</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {!readOnly && (
            <button className="btn" style={{ background:'#0085C7', fontSize:13, padding:'6px 14px' }}
              onClick={() => setShowForm(true)}>
              <i className="ti ti-plus" /> {L('Add Session','إضافة جلسة')}
            </button>
          )}
        </div>
      </div>

      {/* Month nav */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <button className="tb-btn" onClick={() => setCurDate(new Date(year, month-1, 1))}>
          <i className="ti ti-chevron-left" />
        </button>
        <div style={{ fontSize:16, fontWeight:600, minWidth:160, textAlign:'center' }}>{monthNames[month]} {year}</div>
        <button className="tb-btn" onClick={() => setCurDate(new Date(year, month+1, 1))}>
          <i className="ti ti-chevron-right" />
        </button>
        <button className="tb-btn" onClick={() => setCurDate(new Date())}>
          {L('Today','اليوم')}
        </button>
      </div>

      {/* Calendar grid */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow)' }}>
        {/* Day headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border)' }}>
          {dayNames.map(d => (
            <div key={d} style={{ padding:'10px 0', textAlign:'center', fontSize:12, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em' }}>{d}</div>
          ))}
        </div>
        {/* Days */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
          {/* Empty cells */}
          {Array.from({length: firstDay}).map((_,i) => (
            <div key={`e${i}`} style={{ minHeight:90, borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', background:'var(--surface2)' }} />
          ))}
          {/* Day cells */}
          {Array.from({length: daysInMonth}).map((_,i) => {
            const d = i+1
            const daySessions = sessionsOnDay(d)
            const isTod = isToday(d)
            return (
              <div key={d} style={{ minHeight:90, borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)', padding:'6px 4px', position:'relative', background: isTod ? 'var(--surface2)' : 'var(--surface)' }}>
                <div style={{ fontSize:12, fontWeight: isTod?700:500, color: isTod?'#0085C7':'var(--text)', marginBottom:4, width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background: isTod?'#0085C7':'transparent', color: isTod?'#fff':'var(--text)' }}>{d}</div>
                {daySessions.slice(0,3).map(s => (
                  <div key={s.id} onClick={() => setSelected(s.id)}
                    style={{ fontSize:10, fontWeight:500, padding:'2px 5px', borderRadius:4, marginBottom:2, cursor:'pointer', background:(SESSION_COLORS[s.session_type]||'#0085C7')+'20', color:SESSION_COLORS[s.session_type]||'#0085C7', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                    {s.start_time?.slice(0,5)} {s.title}
                  </div>
                ))}
                {daySessions.length > 3 && <div style={{ fontSize:10, color:'var(--text3)' }}>+{daySessions.length-3}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming list */}
      {filterSessions(sessions.filter(s => s.session_date >= today.toISOString().slice(0,10))).slice(0,5).length > 0 && (
        <div className="card" style={{ marginTop:16 }}>
          <div className="card-title"><i className="ti ti-clock" /> {L('Upcoming sessions','الجلسات القادمة')}</div>
          {filterSessions(sessions.filter(s => s.session_date >= today.toISOString().slice(0,10))).slice(0,5).map(s => {
            const color = SESSION_COLORS[s.session_type]||'#0085C7'
            const sAthletes = myAthletes.filter(a => s.training_session_athletes?.some(sa=>String(sa.athlete_id)===String(a.id)))
            return (
              <div key={s.id} onClick={() => setSelected(s.id)}
                style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid var(--border)', cursor:'pointer', alignItems:'center' }}>
                <div style={{ width:4, borderRadius:4, alignSelf:'stretch', background:color, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{s.title}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                    {s.session_date} {s.start_time?.slice(0,5)} · {s.location||'—'} · {sAthletes.length} {L('athletes','رياضيون')}
                  </div>
                </div>
                <span style={{ fontSize:11, padding:'3px 8px', borderRadius:20, background:color+'20', color }}>{L(s.session_type,{'Training':'تدريب','Competition':'منافسة','Medical':'طبي','Meeting':'اجتماع'}[s.session_type]||s.session_type)}</span>
                <i className="ti ti-chevron-right" style={{ color:'#ccc' }} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SessionForm({ data, athletes, coachId, ar, onSave, onClose }) {
  const isEdit = !!data?.id
  const [form, setForm] = useState(data || { type:'Training', athleteIds:[] })
  const set = (k,v) => setForm(f => ({...f, [k]:v}))
  const toggleAth = (id) => setForm(f => { const sid = String(id); return { ...f, athleteIds: f.athleteIds?.includes(sid) ? f.athleteIds.filter(x=>x!==sid) : [...(f.athleteIds||[]),sid] } })
  const L = (en,a) => ar?a:en

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit?L('Edit Session','تعديل الجلسة'):L('New Session','جلسة جديدة')}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x"/></button>
        </div>
        <div className="modal-body">
          <div className="form-section">{L('Session Details','تفاصيل الجلسة')}</div>
          <div className="form-group">
            <label className="form-label">{L('Title','العنوان')} *</label>
            <input className="form-input" placeholder={L('e.g. Morning Training','مثال: تدريب صباحي')} value={form.title||''} onChange={e=>set('title',e.target.value)}/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{L('Type','النوع')}</label>
              <select className="form-input" value={form.type||'Training'} onChange={e=>set('type',e.target.value)}>
                {SESSION_TYPES.map(t=><option key={t} value={t}>{ar?{'Training':'تدريب','Competition':'منافسة','Medical':'طبي','Meeting':'اجتماع'}[t]:t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{L('Date','التاريخ')} *</label>
              <input className="form-input" type="date" value={form.date||''} onChange={e=>set('date',e.target.value)}/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{L('Start time','وقت البداية')}</label>
              <input className="form-input" type="time" value={form.startTime||''} onChange={e=>set('startTime',e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">{L('End time','وقت النهاية')}</label>
              <input className="form-input" type="time" value={form.endTime||''} onChange={e=>set('endTime',e.target.value)}/>
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

          <div className="form-section">{L('Athletes','الرياضيون')} ({form.athleteIds?.length||0} {L('selected','مختارون')})</div>
          <div style={{maxHeight:200,overflowY:'auto',border:'1px solid var(--border)',borderRadius:10,padding:'4px 0'}}>
            {athletes.map(a=>(
              <div key={a.id} onClick={()=>toggleAth(a.id)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',cursor:'pointer',background:form.athleteIds?.includes(String(a.id))?'var(--surface2)':'transparent'}}>
                <div style={{width:18,height:18,borderRadius:4,border:'2px solid',borderColor:form.athleteIds?.includes(String(a.id))?'#0085C7':'var(--border)',background:form.athleteIds?.includes(String(a.id))?'#0085C7':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {form.athleteIds?.includes(String(a.id))&&<i className="ti ti-check" style={{fontSize:10,color:'#fff'}}/>}
                </div>
                <Avatar name={a.name} id={a.id} size={28} fs={9}/>
                <span style={{fontSize:13}}>{ar&&a.name_ar?a.name_ar:a.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{L('Cancel','إلغاء')}</button>
          <button className="btn" style={{background:'#0085C7'}} onClick={()=>onSave(form)}>
            {isEdit?L('Save changes','حفظ التغييرات'):L('Add session','إضافة الجلسة')}
          </button>
        </div>
      </div>
    </div>
  )
}

function RequestModal({ session, athleteId, ar, onSave, onClose }) {
  const [type, setType]     = useState('excuse')
  const [reason, setReason] = useState('')
  const L = (en, a) => ar ? a : en

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><i className="ti ti-calendar-off" /> {L("Can't make it", 'لا أستطيع الحضور')}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize:13, color:'var(--text2)', marginBottom:12 }}>
            {session.title || L('Training session', 'جلسة تدريب')} — {session.session_date}
          </div>
          <div className="form-group">
            <label className="form-label">{L('Request type', 'نوع الطلب')}</label>
            <div style={{ display:'flex', gap:8 }}>
              {[['excuse', L('Excuse absence', 'تقديم عذر')], ['reschedule', L('Request reschedule', 'طلب إعادة جدولة')]].map(([val, lbl]) => (
                <button key={val} onClick={() => setType(val)}
                  style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', fontSize:12, fontWeight:600,
                    background: type===val ? '#0085C7' : 'var(--surface)', color: type===val ? '#fff' : 'var(--text2)' }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{L('Reason', 'السبب')}</label>
            <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)}
              placeholder={L('Explain why you cannot attend…', 'اشرح سبب عدم قدرتك على الحضور…')}
              style={{ resize:'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{L('Cancel', 'إلغاء')}</button>
          <button className="btn" style={{ background:'#EE334E' }} onClick={() => onSave(type, reason)}>
            <i className="ti ti-send" /> {L('Send request', 'إرسال الطلب')}
          </button>
        </div>
      </div>
    </div>
  )
}