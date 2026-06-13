import { useLang } from '../lib/LangContext.jsx'

export default function AthleteEvents({ athlete, events, registrations, results }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  if (!athlete) return <div className="empty">{L('No athlete profile linked.','لا يوجد ملف رياضي مرتبط.')}</div>

  const myEventIds = (registrations||[]).filter(r => String(r.athlete_id) === String(athlete.id)).map(r => r.event_id)
  const myEvents   = (events||[]).filter(e => myEventIds.includes(e.id)).sort((a,b) => new Date(b.start_date) - new Date(a.start_date))

  const STATUS_COLORS = { 'Upcoming':'#0085C7', 'Registration Open':'#8b5cf6', 'Completed':'#009F6B', 'Cancelled':'#EE334E' }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{L('My Events','فعالياتي')}</div>
          <div className="page-sub">{myEvents.length} {L('events','فعاليات')}</div>
        </div>
      </div>

      {myEvents.length === 0 ? (
        <div className="empty">
          <i className="ti ti-calendar-off" style={{ fontSize:32, marginBottom:8 }} />
          <div>{L('You are not registered in any events yet.','لم تكن مسجلاً في أي فعاليات بعد.')}</div>
        </div>
      ) : myEvents.map(ev => {
        const evResults = (results||[]).filter(r => String(r.athlete_id) === String(athlete.id) && r.event_name === ev.name)
        const color = STATUS_COLORS[ev.status] || '#9aa3b2'
        return (
          <div key={ev.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:18, marginBottom:12, boxShadow:'var(--shadow)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700 }}>{ev.name}</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginTop:4, display:'flex', gap:12, flexWrap:'wrap' }}>
                  {ev.start_date && <span><i className="ti ti-calendar" style={{ fontSize:11, marginRight:3 }} />{ev.start_date}</span>}
                  {ev.venue     && <span><i className="ti ti-map-pin" style={{ fontSize:11, marginRight:3 }} />{ev.venue}</span>}
                  {ev.sport     && <span><i className="ti ti-ball-football" style={{ fontSize:11, marginRight:3 }} />{ev.sport}</span>}
                </div>
              </div>
              <span style={{ padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600, background:color+'20', color }}>{ev.status}</span>
            </div>
            {evResults.length > 0 && (
              <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>{L('My results in this event','نتائجي في هذه الفعالية')}</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {evResults.map(r => (
                    <div key={r.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background:'var(--surface2)', borderRadius:8, fontSize:13 }}>
                      <span>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':r.medal==='bronze'?'🥉':'📋'}</span>
                      <span style={{ fontWeight:500 }}>{r.discipline}</span>
                      <span style={{ color:'#0085C7', fontWeight:600 }}>{r.result}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
