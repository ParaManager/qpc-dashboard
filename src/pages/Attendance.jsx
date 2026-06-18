import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { Avatar } from '../lib/helpers'
import { toast, ConfirmModal } from '../components/Toast'

const STATUS_OPTS   = ['Present','Absent','Late','Excused']
const STATUS_AR     = { Present:'حاضر', Absent:'غائب', Late:'متأخر', Excused:'معذور' }
const STATUS_COLORS = { Present:'#009F6B', Absent:'#EE334E', Late:'#f59e0b', Excused:'#8b5cf6' }
const STATUS_ICONS  = { Present:'ti-circle-check', Absent:'ti-circle-x', Late:'ti-clock', Excused:'ti-note' }

export default function Attendance({ profile, coachId, myAthletes, initSessionId, onNav }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [sessions, setSessions]     = useState([])
  const [selSession, setSelSession] = useState(initSessionId || null)
  const [attendance, setAttendance] = useState({})
  const [notes, setNotes]           = useState({})
  const [saving, setSaving]         = useState(false)
  const [stats, setStats]           = useState({})
  const [viewMode, setViewMode]     = useState(initSessionId ? 'session' : 'overview')
  const [search, setSearch]         = useState('')
  const [tab, setTab]               = useState('week')
  const [closePrompt, setClosePrompt] = useState(false)
  const [showExport, setShowExport]   = useState(false)
  const [exportMode, setExportMode]   = useState('month')
  const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0,7))
  const [exportWeekStart, setExportWeekStart] = useState(getWeekStart(new Date()).toISOString().slice(0,10))
  const [exportFrom, setExportFrom]   = useState('')
  const [exportTo, setExportTo]       = useState('')
  const [exportSessionId, setExportSessionId] = useState('')
  const [exporting, setExporting]     = useState(false)
  const [unclosedWarning, setUnclosedWarning] = useState(null)  // { target, blocking } when trying to open a new session with an older one still open
  const [athleteDetail, setAthleteDetail] = useState(null)  // athlete object when viewing their personal attendance
  const [athleteDetailTab, setAthleteDetailTab] = useState('week')
  const [athleteDetailRecords, setAthleteDetailRecords] = useState([])

  useEffect(() => { loadSessions() }, [coachId])
  useEffect(() => { if (selSession) loadAttendance(selSession) }, [selSession])
  useEffect(() => { loadStats() }, [sessions, tab])

  useEffect(() => {
    if (!athleteDetail) { setAthleteDetailRecords([]); return }
    const sessionIds = sessions.map(s => s.id)
    if (sessionIds.length === 0) { setAthleteDetailRecords([]); return }
    supabase.from('attendance').select('*').eq('athlete_id', String(athleteDetail.id)).in('session_id', sessionIds)
      .then(({ data }) => setAthleteDetailRecords(data || []))
  }, [athleteDetail, sessions])

  async function loadSessions() {
    let q = supabase.from('training_sessions').select('*, training_session_athletes(athlete_id)').order('session_date', { ascending: false })
    if (coachId) q = q.eq('coach_id', coachId)
    const { data } = await q
    setSessions(data || [])
    if (initSessionId && !selSession) setSelSession(initSessionId)
  }

  async function loadAttendance(sessionId) {
    const { data } = await supabase.from('attendance').select('*').eq('session_id', sessionId)
    const attMap = {}, notesMap = {}
    ;(data||[]).forEach(r => { attMap[r.athlete_id] = r.status; notesMap[r.athlete_id] = r.notes||'' })
    setAttendance(attMap)
    setNotes(notesMap)
  }

  function getPeriodStart(period) {
    const now = new Date()
    if (period === 'week') return getWeekStart(now)
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
    return null
  }

  async function loadStats() {
    if (!sessions.length) { setStats({}); return }
    const periodStart = getPeriodStart(tab)
    const relevantSessions = periodStart
      ? sessions.filter(s => new Date(s.session_date) >= periodStart)
      : sessions
    const sessionIds = relevantSessions.map(s => s.id)
    if (sessionIds.length === 0) { setStats({}); return }
    const { data } = await supabase.from('attendance').select('*').in('session_id', sessionIds)
    const statsMap = {}
    myAthletes.forEach(a => {
      const recs = (data||[]).filter(r => String(r.athlete_id) === String(a.id))
      statsMap[a.id] = {
        total:   recs.length,
        present: recs.filter(r=>r.status==='Present').length,
        absent:  recs.filter(r=>r.status==='Absent').length,
        late:    recs.filter(r=>r.status==='Late').length,
        excused: recs.filter(r=>r.status==='Excused').length,
      }
    })
    setStats(statsMap)
  }

  async function saveAttendance(promptClose = true) {
    if (!selSession) return
    setSaving(true)
    const session = sessions.find(s => s.id === selSession)
    const sessionAthletes = myAthletes.filter(a => session?.training_session_athletes?.some(sa => String(sa.athlete_id) === String(a.id)))
    const rows = sessionAthletes.map(a => ({
      session_id: selSession,
      athlete_id: a.id,
      status: attendance[a.id] || 'Absent',
      notes: notes[a.id] || null,
    }))
    await supabase.from('attendance').delete().eq('session_id', selSession)
    if (rows.length > 0) {
      const { error } = await supabase.from('attendance').insert(rows)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
    }
    toast(L('Attendance saved','تم حفظ الحضور'))
    setSaving(false)
    loadStats()
    if (promptClose && !session?.attendance_closed) setClosePrompt(true)
  }

  async function closeSession() {
    await supabase.from('training_sessions').update({ attendance_closed: true }).eq('id', selSession)
    toast(L('Session closed','تم إغلاق الجلسة'))
    setClosePrompt(false)
    setViewMode('overview')
    loadSessions()
  }

  async function reopenSession(sessionId) {
    await supabase.from('training_sessions').update({ attendance_closed: false }).eq('id', sessionId)
    toast(L('Session reopened','تم إعادة فتح الجلسة'))
    loadSessions()
  }

  // Find any older sessions (by date) that are still unclosed, excluding the target itself
  function findOlderUnclosed(targetSession) {
    if (!targetSession) return []
    return sessions.filter(s =>
      s.id !== targetSession.id &&
      !s.attendance_closed &&
      s.session_date < targetSession.session_date
    )
  }

  // Wraps opening a session: if older unclosed sessions exist, warn first
  function openSessionFor(targetSession) {
    const blocking = findOlderUnclosed(targetSession)
    if (blocking.length > 0) {
      setUnclosedWarning({ target: targetSession, blocking })
      return
    }
    setSelSession(targetSession.id)
    setViewMode('session')
  }

  function markAll(status) {
    const session = sessions.find(s => s.id === selSession)
    const sessionAthletes = myAthletes.filter(a => session?.training_session_athletes?.some(sa => String(sa.athlete_id) === String(a.id)))
    const newAtt = {}
    sessionAthletes.forEach(a => { newAtt[a.id] = status })
    setAttendance(prev => ({ ...prev, ...newAtt }))
  }

  async function runExport() {
    setExporting(true)
    try {
      let sessionIds = []
      let label = ''

      if (exportMode === 'session') {
        if (!exportSessionId) { toast(L('Pick a session','اختر جلسة'), 'error'); setExporting(false); return }
        sessionIds = [exportSessionId]
        const s = sessions.find(x => x.id === exportSessionId)
        label = s ? `${s.session_date}_${(s.title||'session').replace(/\s+/g,'_')}` : 'session'
      } else {
        let from, to
        if (exportMode === 'week') {
          from = new Date(exportWeekStart)
          to = new Date(from); to.setDate(to.getDate() + 6)
          label = `Week_${exportWeekStart}`
        } else if (exportMode === 'month') {
          const [y, m] = exportMonth.split('-').map(Number)
          from = new Date(y, m-1, 1)
          to = new Date(y, m, 0)
          label = `Month_${exportMonth}`
        } else {
          if (!exportFrom || !exportTo) { toast(L('Pick a date range','اختر فترة')); setExporting(false); return }
          from = new Date(exportFrom)
          to = new Date(exportTo)
          label = `${exportFrom}_to_${exportTo}`
        }
        sessionIds = sessions
          .filter(s => { const d = new Date(s.session_date); return d >= from && d <= to })
          .map(s => s.id)
      }

      if (sessionIds.length === 0) {
        toast(L('No sessions found for this period','لا توجد جلسات في هذه الفترة'), 'error')
        setExporting(false)
        return
      }

      const { data: attRows } = await supabase.from('attendance').select('*').in('session_id', sessionIds)
      const sessionMap = {}
      sessions.forEach(s => { sessionMap[s.id] = s })

      const rows = (attRows || []).map(r => {
        const s = sessionMap[r.session_id]
        const a = myAthletes.find(x => String(x.id) === String(r.athlete_id))
        return {
          [L('Date','التاريخ')]:    s?.session_date || '',
          [L('Session','الجلسة')]:  s?.title || '',
          [L('Athlete','الرياضي')]: a ? (ar && a.name_ar ? a.name_ar : a.name) : r.athlete_id,
          [L('Status','الحالة')]:   ar ? (STATUS_AR[r.status] || r.status) : r.status,
          [L('Notes','ملاحظات')]:   r.notes || '',
        }
      }).sort((x,y) => (x[L('Date','التاريخ')] || '').localeCompare(y[L('Date','التاريخ')] || ''))

      if (rows.length === 0) {
        toast(L('No attendance records found for this period','لا توجد سجلات حضور لهذه الفترة'), 'error')
        setExporting(false)
        return
      }

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, ar ? 'الحضور' : 'Attendance')
      XLSX.writeFile(wb, `QPC_Attendance_${label}.xlsx`)
      toast(L('Exported!','تم التصدير!'))
      setShowExport(false)
    } catch (err) {
      toast(err.message || 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  const session = sessions.find(s => s.id === selSession)
  const sessionAthletes = session
    ? myAthletes.filter(a => session.training_session_athletes?.some(sa => String(sa.athlete_id) === String(a.id)))
    : []

  const filteredAthletes = myAthletes.filter(a =>
    (ar && a.name_ar ? a.name_ar : a.name).toLowerCase().includes(search.toLowerCase())
  )

  if (viewMode === 'session' && selSession) {
    const present = sessionAthletes.filter(a => attendance[a.id] === 'Present').length
    const absent  = sessionAthletes.filter(a => attendance[a.id] === 'Absent' || !attendance[a.id]).length
    const pct     = sessionAthletes.length ? Math.round((present / sessionAthletes.length) * 100) : 0
    const isClosed = !!session?.attendance_closed

    return (
      <div>
        <button className="back-btn" onClick={() => setViewMode('overview')}>
          <i className="ti ti-arrow-left" /> {L('Back to overview','رجوع إلى النظرة العامة')}
        </button>

        {session && (
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:16, marginBottom:16, boxShadow:'var(--shadow)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div style={{ fontSize:16, fontWeight:600 }}>{session.title}</div>
              {isClosed && (
                <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:600, color:'#9aa3b2', background:'var(--surface2)', padding:'4px 10px', borderRadius:20 }}>
                  <i className="ti ti-lock" style={{ fontSize:12 }} /> {L('Closed','مغلقة')}
                </span>
              )}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>
              {session.session_date} · {session.start_time?.slice(0,5)||'—'} · {session.location||'—'}
            </div>
            <div style={{ display:'flex', gap:16, marginTop:12 }}>
              {[['Present','حاضر',present,'#009F6B'],['Absent','غائب',absent,'#EE334E'],['Late','متأخر',sessionAthletes.filter(a=>attendance[a.id]==='Late').length,'#f59e0b'],['Excused','معذور',sessionAthletes.filter(a=>attendance[a.id]==='Excused').length,'#8b5cf6']].map(([en,a,val,col])=>(
                <div key={en} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:700, color:col }}>{val}</div>
                  <div style={{ fontSize:10, color:'var(--text3)' }}>{ar?a:en}</div>
                </div>
              ))}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>{pct}% {L('attendance rate','معدل الحضور')}</div>
                <div style={{ height:8, background:'var(--surface2)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:'#009F6B', borderRadius:4, transition:'width .3s' }} />
                </div>
              </div>
            </div>
            {isClosed && (
              <button className="action-btn" style={{ marginTop:12, borderColor:'#0085C7', color:'#0085C7' }}
                onClick={() => reopenSession(session.id)}>
                <i className="ti ti-lock-open" /> {L('Reopen to edit','إعادة فتح للتعديل')}
              </button>
            )}
          </div>
        )}

        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'var(--text3)', alignSelf:'center' }}>{L('Mark all:','تحديد الكل:')}</span>
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => markAll(s)} disabled={isClosed}
              style={{ padding:'4px 12px', borderRadius:20, border:`1px solid ${STATUS_COLORS[s]}`, background:'transparent', color:STATUS_COLORS[s], fontSize:11, fontWeight:600, cursor: isClosed?'not-allowed':'pointer', opacity: isClosed?.5:1 }}>
              {ar ? STATUS_AR[s] : s}
            </button>
          ))}
        </div>

        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', marginBottom:16 }}>
          {sessionAthletes.length === 0
            ? <div className="empty" style={{ padding:24 }}>{L('No athletes in this session','لا يوجد رياضيون في هذه الجلسة')}</div>
            : sessionAthletes.map((a, i) => {
                const status = attendance[a.id] || 'Absent'
                const color  = STATUS_COLORS[status]
                return (
                  <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: i<sessionAthletes.length-1?'1px solid var(--border)':'' }}>
                    <Avatar name={a.name} id={a.id} size={36} fs={11} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{ar&&a.name_ar?a.name_ar:a.name}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{a.classification}</div>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      {STATUS_OPTS.map(s => (
                        <button key={s} disabled={isClosed} onClick={() => setAttendance(prev => ({...prev, [a.id]: s}))}
                          title={ar ? STATUS_AR[s] : s}
                          style={{ width:32, height:32, borderRadius:8, border:'2px solid', borderColor: status===s ? STATUS_COLORS[s] : 'var(--border)', background: status===s ? STATUS_COLORS[s]+'20' : 'transparent', cursor: isClosed?'not-allowed':'pointer', opacity: isClosed && status!==s ? .4 : 1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <i className={`ti ${STATUS_ICONS[s]}`} style={{ fontSize:14, color: status===s ? STATUS_COLORS[s] : 'var(--text3)' }} />
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize:12, fontWeight:600, color, minWidth:50, textAlign:'center' }}>{ar?STATUS_AR[status]:status}</span>
                  </div>
                )
              })
          }
        </div>

        {!isClosed && (
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="btn" style={{ background:'#009F6B', padding:'9px 24px' }} onClick={() => saveAttendance(true)} disabled={saving}>
              {saving ? (L('Saving…','جارٍ الحفظ…')) : <><i className="ti ti-device-floppy" /> {L('Save attendance','حفظ الحضور')}</>}
            </button>
          </div>
        )}

        {closePrompt && (
          <ConfirmModal
            title={L('Close this session?','إغلاق هذه الجلسة؟')}
            message={L(
              'Attendance has been saved. Closing it will hide it from the active list, but you can still view, export, or reopen it anytime from the Schedule calendar.',
              'تم حفظ الحضور. سيؤدي إغلاق الجلسة إلى إخفائها من القائمة النشطة، ولكن يمكنك دائمًا عرضها أو تصديرها أو إعادة فتحها من تقويم الجدول.'
            )}
            confirmLabel={L('Close session','إغلاق الجلسة')}
            cancelLabel={L('Keep it open','إبقاؤها مفتوحة')}
            onConfirm={closeSession}
            onCancel={() => { setClosePrompt(false); setViewMode('overview') }}
          />
        )}
      </div>
    )
  }

  const openSessions = sessions.filter(s => !s.attendance_closed)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{L('Attendance','الحضور والغياب')}</div>
          <div className="page-sub">{myAthletes.length} {L('athletes','رياضيون')}</div>
        </div>
        <button className="btn" style={{ background:'#009F6B' }} onClick={() => setShowExport(true)}>
          <i className="ti ti-file-export" /> {L('Export Excel','تصدير Excel')}
        </button>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-title"><i className="ti ti-clipboard-check" /> {L('Take attendance for a session','تسجيل الحضور لجلسة')}</div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <select className="filter" style={{ flex:1, minWidth:200 }} value={selSession||''} onChange={e => setSelSession(e.target.value)}>
            <option value="">{L('Select a session…','اختر جلسة…')}</option>
            {openSessions.map(s => (
              <option key={s.id} value={s.id}>{s.session_date} — {s.title}</option>
            ))}
          </select>
          <button className="btn" style={{ background:'#0085C7' }} disabled={!selSession}
            onClick={() => { const s = sessions.find(x => x.id === selSession); if (s) openSessionFor(s) }}>
            {L('Open','فتح')} <i className="ti ti-arrow-right" />
          </button>
        </div>
        {sessions.length > openSessions.length && (
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:10 }}>
            <i className="ti ti-info-circle" style={{ marginRight:4 }} />
            {L('Closed sessions are hidden here — view, export, or reopen them from the Schedule calendar.','الجلسات المغلقة مخفية هنا — يمكنك عرضها أو تصديرها أو إعادة فتحها من تقويم الجدول.')}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:14 }}>
          <div className="card-title" style={{ margin:0 }}><i className="ti ti-chart-bar" /> {L('Attendance overview','نظرة عامة على الحضور')}</div>
          <div style={{ display:'flex', gap:6, background:'var(--surface2)', borderRadius:10, padding:4 }}>
            {[['week',L('This Week','هذا الأسبوع')],['month',L('This Month','هذا الشهر')]].map(([key,label]) => (
              <button key={key} onClick={() => setTab(key)}
                style={{
                  padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
                  fontSize:12, fontWeight:600,
                  background: tab===key ? 'var(--surface)' : 'transparent',
                  color: tab===key ? 'var(--text)' : 'var(--text3)',
                  boxShadow: tab===key ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="search-wrap" style={{ marginBottom:14 }}>
          <i className="ti ti-search" />
          <input placeholder={L('Search athletes…','بحث عن رياضي…')} value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'var(--surface2)' }}>
                    <th style={{ padding:'10px 12px', textAlign: ar?'right':'left', fontWeight:600, fontSize:12, color:'var(--text3)' }}>{L('Athlete','الرياضي')}</th>
                    <th style={{ padding:'10px 12px', textAlign:'center', color:'#009F6B', fontSize:12 }}>{L('Present','حاضر')}</th>
                    <th style={{ padding:'10px 12px', textAlign:'center', color:'#EE334E', fontSize:12 }}>{L('Absent','غائب')}</th>
                    <th style={{ padding:'10px 12px', textAlign:'center', color:'#f59e0b', fontSize:12 }}>{L('Late','متأخر')}</th>
                    <th style={{ padding:'10px 12px', textAlign:'center', color:'#8b5cf6', fontSize:12 }}>{L('Excused','معذور')}</th>
                    <th style={{ padding:'10px 12px', textAlign:'center', fontSize:12 }}>{L('Rate','المعدل')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAthletes.map(a => {
                    const s = stats[a.id] || { total:0, present:0, absent:0, late:0, excused:0 }
                    const rate = s.total ? Math.round((s.present / s.total) * 100) : 0
                    return (
                      <tr key={a.id} onClick={() => setAthleteDetail(a)}
                        style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <Avatar name={a.name} id={a.id} size={28} fs={9} />
                            <span style={{ fontWeight:500 }}>{ar&&a.name_ar?a.name_ar:a.name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign:'center', fontWeight:600, color:'#009F6B' }}>{s.present}</td>
                        <td style={{ textAlign:'center', fontWeight:600, color:'#EE334E' }}>{s.absent}</td>
                        <td style={{ textAlign:'center', fontWeight:600, color:'#f59e0b' }}>{s.late}</td>
                        <td style={{ textAlign:'center', fontWeight:600, color:'#8b5cf6' }}>{s.excused}</td>
                        <td style={{ textAlign:'center' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'center' }}>
                            <div style={{ width:50, height:6, background:'var(--surface2)', borderRadius:3, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${rate}%`, background: rate>=80?'#009F6B':rate>=60?'#f59e0b':'#EE334E', borderRadius:3 }} />
                            </div>
                            <span style={{ fontSize:11, fontWeight:600 }}>{s.total?`${rate}%`:L('N/A','—')}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

      </div>

      {athleteDetail && (() => {
        const periodStart = athleteDetailTab === 'week' ? getWeekStart(new Date())
          : athleteDetailTab === 'month' ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          : null
        const sessionMap = {}
        sessions.forEach(s => { sessionMap[s.id] = s })
        const relevant = athleteDetailRecords.filter(r => {
          const s = sessionMap[r.session_id]
          if (!s) return false
          if (!periodStart) return true
          return new Date(s.session_date) >= periodStart
        })
        const counts = {
          present: relevant.filter(r => r.status === 'Present').length,
          absent:  relevant.filter(r => r.status === 'Absent').length,
          late:    relevant.filter(r => r.status === 'Late').length,
          excused: relevant.filter(r => r.status === 'Excused').length,
        }
        const total = relevant.length
        const rate  = total ? Math.round((counts.present / total) * 100) : 0
        const sortedRows = relevant
          .map(r => ({ ...r, session: sessionMap[r.session_id] }))
          .sort((a,b) => (b.session?.session_date||'').localeCompare(a.session?.session_date||''))

        return (
          <div onClick={() => setAthleteDetail(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background:'var(--surface)', borderRadius:16, padding:24, width:480, maxWidth:'100%', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 12px 40px rgba(0,0,0,.25)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                <Avatar name={athleteDetail.name} id={athleteDetail.id} size={40} fs={14} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:16, fontWeight:700 }}>{ar && athleteDetail.name_ar ? athleteDetail.name_ar : athleteDetail.name}</div>
                  <div style={{ fontSize:12, color:'var(--text3)' }}>{L('Attendance history','سجل الحضور')}</div>
                </div>
                <button onClick={() => setAthleteDetail(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:20 }}>×</button>
              </div>

              <div style={{ display:'flex', gap:6, background:'var(--surface2)', borderRadius:10, padding:4, marginBottom:16 }}>
                {[['week',L('This Week','هذا الأسبوع')],['month',L('This Month','هذا الشهر')]].map(([key,label]) => (
                  <button key={key} onClick={() => setAthleteDetailTab(key)}
                    style={{ flex:1, padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                      background: athleteDetailTab===key ? 'var(--surface)' : 'transparent',
                      color: athleteDetailTab===key ? 'var(--text)' : 'var(--text3)',
                      boxShadow: athleteDetailTab===key ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display:'flex', gap:16, marginBottom:16, justifyContent:'space-around' }}>
                {[['Present','حاضر',counts.present,'#009F6B'],['Absent','غائب',counts.absent,'#EE334E'],['Late','متأخر',counts.late,'#f59e0b'],['Excused','معذور',counts.excused,'#8b5cf6']].map(([en,arLbl,val,col])=>(
                  <div key={en} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:700, color:col }}>{val}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{ar?arLbl:en}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>{rate}% {L('attendance rate','معدل الحضور')}</div>
                <div style={{ height:8, background:'var(--surface2)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${rate}%`, background:'#009F6B', borderRadius:4 }} />
                </div>
              </div>

              <div style={{ borderTop:'1px solid var(--border)', paddingTop:12 }}>
                {sortedRows.length === 0
                  ? <div className="empty" style={{ padding:16, fontSize:13 }}>{L('No records for this period','لا توجد سجلات لهذه الفترة')}</div>
                  : sortedRows.map(r => (
                    <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                      <div>
                        <div style={{ fontWeight:500 }}>{r.session?.title || r.session?.session_date}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>{r.session?.session_date}</div>
                      </div>
                      <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:STATUS_COLORS[r.status]+'20', color:STATUS_COLORS[r.status] }}>
                        {ar ? STATUS_AR[r.status] : r.status}
                      </span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )
      })()}

      {unclosedWarning && (
        <ConfirmModal
          danger={false}
          title={L('Previous session still open','جلسة سابقة لا تزال مفتوحة')}
          message={
            unclosedWarning.blocking.length === 1
              ? L(
                  `"${unclosedWarning.blocking[0].title || unclosedWarning.blocking[0].session_date}" from ${unclosedWarning.blocking[0].session_date} hasn't been closed yet. We recommend closing it before starting a new one, so it doesn't get forgotten.`,
                  `الجلسة "${unclosedWarning.blocking[0].title || unclosedWarning.blocking[0].session_date}" من ${unclosedWarning.blocking[0].session_date} لم تُغلق بعد. ننصح بإغلاقها قبل بدء جلسة جديدة حتى لا تُنسى.`
                )
              : L(
                  `You have ${unclosedWarning.blocking.length} earlier sessions that haven't been closed yet. We recommend closing them before starting a new one.`,
                  `لديك ${unclosedWarning.blocking.length} جلسات سابقة لم تُغلق بعد. ننصح بإغلاقها قبل بدء جلسة جديدة.`
                )
          }
          confirmLabel={L('Continue anyway','المتابعة على أي حال')}
          cancelLabel={L('Go close it first','إغلاقها أولاً')}
          onConfirm={() => {
            const t = unclosedWarning.target
            setUnclosedWarning(null)
            setSelSession(t.id)
            setViewMode('session')
          }}
          onCancel={() => {
            const oldest = unclosedWarning.blocking[0]
            setUnclosedWarning(null)
            setSelSession(oldest.id)
            setViewMode('session')
          }}
        />
      )}

      {showExport && (
        <div onClick={() => setShowExport(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'var(--surface)', borderRadius:16, padding:24, width:420, maxWidth:'100%', boxShadow:'0 12px 40px rgba(0,0,0,.25)' }}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>{L('Export Attendance','تصدير الحضور')}</div>

            <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
              {[['week',L('Week','أسبوع')],['month',L('Month','شهر')],['range',L('Custom range','فترة مخصصة')],['session',L('Single session','جلسة واحدة')]].map(([key,label]) => (
                <button key={key} onClick={() => setExportMode(key)}
                  style={{ padding:'6px 12px', borderRadius:20, border:`1.5px solid ${exportMode===key?'#0085C7':'var(--border)'}`, background: exportMode===key?'#0085C720':'transparent', color: exportMode===key?'#0085C7':'var(--text2)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  {label}
                </button>
              ))}
            </div>

            {exportMode === 'week' && (
              <div>
                <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:6 }}>{L('Week starting','الأسبوع يبدأ من')}</label>
                <input type="date" className="filter" style={{ width:'100%' }} value={exportWeekStart} onChange={e => setExportWeekStart(e.target.value)} />
              </div>
            )}

            {exportMode === 'month' && (
              <div>
                <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:6 }}>{L('Month','الشهر')}</label>
                <input type="month" className="filter" style={{ width:'100%' }} value={exportMonth} onChange={e => setExportMonth(e.target.value)} />
              </div>
            )}

            {exportMode === 'range' && (
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:6 }}>{L('From','من')}</label>
                  <input type="date" className="filter" style={{ width:'100%' }} value={exportFrom} onChange={e => setExportFrom(e.target.value)} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:6 }}>{L('To','إلى')}</label>
                  <input type="date" className="filter" style={{ width:'100%' }} value={exportTo} onChange={e => setExportTo(e.target.value)} />
                </div>
              </div>
            )}

            {exportMode === 'session' && (
              <div>
                <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:6 }}>{L('Session','الجلسة')}</label>
                <select className="filter" style={{ width:'100%' }} value={exportSessionId} onChange={e => setExportSessionId(e.target.value)}>
                  <option value="">{L('Select a session…','اختر جلسة…')}</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.session_date} — {s.title}{s.attendance_closed ? ` (${L('closed','مغلقة')})` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
              <button className="action-btn" onClick={() => setShowExport(false)}>{L('Cancel','إلغاء')}</button>
              <button className="btn" style={{ background:'#009F6B' }} onClick={runExport} disabled={exporting}>
                {exporting ? L('Exporting…','جارٍ التصدير…') : <><i className="ti ti-file-export" /> {L('Export Excel','تصدير Excel')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0,0,0,0)
  return d
}
