import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { Avatar } from '../lib/helpers'
import { toast } from '../components/Toast'

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
  const [attendance, setAttendance] = useState({}) // athlete_id -> status
  const [notes, setNotes]           = useState({}) // athlete_id -> note
  const [saving, setSaving]         = useState(false)
  const [stats, setStats]           = useState({}) // athlete_id -> { present, absent, late, excused, total }
  const [viewMode, setViewMode]     = useState(initSessionId ? 'session' : 'overview')
  const [search, setSearch]         = useState('')

  useEffect(() => { loadSessions() }, [coachId])
  useEffect(() => { if (selSession) loadAttendance(selSession) }, [selSession])
  useEffect(() => { loadStats() }, [sessions])

  async function loadSessions() {
    let q = supabase.from('training_sessions').select('*, session_athletes(athlete_id)').order('session_date', { ascending: false })
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

  async function loadStats() {
    if (!sessions.length) return
    const sessionIds = sessions.map(s => s.id)
    const { data } = await supabase.from('attendance').select('*').in('session_id', sessionIds)
    const statsMap = {}
    myAthletes.forEach(a => {
      const recs = (data||[]).filter(r => r.athlete_id === a.id)
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

  async function saveAttendance() {
    if (!selSession) return
    setSaving(true)
    const session = sessions.find(s => s.id === selSession)
    const sessionAthletes = myAthletes.filter(a => session?.session_athletes?.some(sa => sa.athlete_id === a.id))
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
  }

  function markAll(status) {
    const session = sessions.find(s => s.id === selSession)
    const sessionAthletes = myAthletes.filter(a => session?.session_athletes?.some(sa => sa.athlete_id === a.id))
    const newAtt = {}
    sessionAthletes.forEach(a => { newAtt[a.id] = status })
    setAttendance(prev => ({ ...prev, ...newAtt }))
  }

  const session = sessions.find(s => s.id === selSession)
  const sessionAthletes = session
    ? myAthletes.filter(a => session.session_athletes?.some(sa => sa.athlete_id === a.id))
    : []

  const filteredAthletes = myAthletes.filter(a =>
    (ar && a.name_ar ? a.name_ar : a.name).toLowerCase().includes(search.toLowerCase())
  )

  // ── SESSION ATTENDANCE VIEW ──
  if (viewMode === 'session' && selSession) {
    const present = sessionAthletes.filter(a => attendance[a.id] === 'Present').length
    const absent  = sessionAthletes.filter(a => attendance[a.id] === 'Absent' || !attendance[a.id]).length
    const pct     = sessionAthletes.length ? Math.round((present / sessionAthletes.length) * 100) : 0

    return (
      <div>
        <button className="back-btn" onClick={() => setViewMode('overview')}>
          <i className="ti ti-arrow-left" /> {L('Back to overview','رجوع إلى النظرة العامة')}
        </button>

        {session && (
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:16, marginBottom:16, boxShadow:'var(--shadow)' }}>
            <div style={{ fontSize:16, fontWeight:600 }}>{session.title}</div>
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
          </div>
        )}

        {/* Quick mark all */}
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'var(--text3)', alignSelf:'center' }}>{L('Mark all:','تحديد الكل:')}</span>
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => markAll(s)}
              style={{ padding:'4px 12px', borderRadius:20, border:`1px solid ${STATUS_COLORS[s]}`, background:'transparent', color:STATUS_COLORS[s], fontSize:11, fontWeight:600, cursor:'pointer' }}>
              {ar ? STATUS_AR[s] : s}
            </button>
          ))}
        </div>

        {/* Athlete attendance rows */}
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
                    {/* Status buttons */}
                    <div style={{ display:'flex', gap:6 }}>
                      {STATUS_OPTS.map(s => (
                        <button key={s} onClick={() => setAttendance(prev => ({...prev, [a.id]: s}))}
                          title={ar ? STATUS_AR[s] : s}
                          style={{ width:32, height:32, borderRadius:8, border:'2px solid', borderColor: status===s ? STATUS_COLORS[s] : 'var(--border)', background: status===s ? STATUS_COLORS[s]+'20' : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
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

        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button className="btn" style={{ background:'#009F6B', padding:'9px 24px' }} onClick={saveAttendance} disabled={saving}>
            {saving ? (L('Saving…','جارٍ الحفظ…')) : <><i className="ti ti-device-floppy" /> {L('Save attendance','حفظ الحضور')}</>}
          </button>
        </div>
      </div>
    )
  }

  // ── OVERVIEW ──
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{L('Attendance','الحضور والغياب')}</div>
          <div className="page-sub">{myAthletes.length} {L('athletes','رياضيون')}</div>
        </div>
      </div>

      {/* Session selector */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-title"><i className="ti ti-clipboard-check" /> {L('Take attendance for a session','تسجيل الحضور لجلسة')}</div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <select className="filter" style={{ flex:1, minWidth:200 }} value={selSession||''} onChange={e => setSelSession(e.target.value)}>
            <option value="">{L('Select a session…','اختر جلسة…')}</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.session_date} — {s.title}</option>
            ))}
          </select>
          <button className="btn" style={{ background:'#0085C7' }} disabled={!selSession}
            onClick={() => setViewMode('session')}>
            {L('Open','فتح')} <i className="ti ti-arrow-right" />
          </button>
        </div>
      </div>

      {/* Stats overview */}
      <div className="card">
        <div className="card-title"><i className="ti ti-chart-bar" /> {L('Attendance overview','نظرة عامة على الحضور')}</div>
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
                  <tr key={a.id} style={{ borderBottom:'1px solid var(--border)' }}>
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
    </div>
  )
}
