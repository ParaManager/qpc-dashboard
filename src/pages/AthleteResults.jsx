import { useState } from 'react'
import { useLang } from '../lib/LangContext.jsx'

export default function AthleteResults({ athlete, results }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en
  const [filter, setFilter] = useState('all') // all, gold, silver, bronze

  if (!athlete) return <div className="empty">{L('No athlete profile linked.','لا يوجد ملف رياضي مرتبط.')}</div>

  const myResults = (results||[])
    .filter(r => String(r.athlete_id) === String(athlete.id))
    .filter(r => filter === 'all' || r.medal === filter)
    .sort((a,b) => new Date(b.date||0) - new Date(a.date||0))

  const allResults = (results||[]).filter(r => String(r.athlete_id) === String(athlete.id))
  const counts = {
    gold:   allResults.filter(r => r.medal==='gold').length,
    silver: allResults.filter(r => r.medal==='silver').length,
    bronze: allResults.filter(r => r.medal==='bronze').length,
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{L('My Results','نتائجي')}</div>
          <div className="page-sub">{allResults.length} {L('total results','نتيجة إجمالية')}</div>
        </div>
      </div>

      {/* Medal filter pills */}
      <div className="pill-filters" style={{ marginBottom:16 }}>
        {[
          ['all',    L('All','الكل'),    allResults.length, null],
          ['gold',   L('Gold','ذهب'),    counts.gold,       '#f1c40f'],
          ['silver', L('Silver','فضة'),  counts.silver,     '#aaa'],
          ['bronze', L('Bronze','برونز'),counts.bronze,     '#cd7f32'],
        ].map(([val, lbl, count, color]) => (
          <button key={val} className={`pill${filter===val?' active':''}`} onClick={() => setFilter(val)}>
            {color && <span style={{ color }}>{val==='gold'?'🥇':val==='silver'?'🥈':'🥉'} </span>}
            {lbl} <span style={{ marginLeft:4, background: filter===val?'rgba(255,255,255,.3)':'var(--surface2)', borderRadius:20, padding:'1px 7px', fontSize:11 }}>{count}</span>
          </button>
        ))}
      </div>

      {myResults.length === 0 ? (
        <div className="empty">
          <i className="ti ti-medal-off" style={{ fontSize:32, marginBottom:8 }} />
          <div>{L('No results yet.','لا توجد نتائج بعد.')}</div>
        </div>
      ) : myResults.map(r => (
        <div key={r.id} style={{ display:'flex', gap:14, padding:'14px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, marginBottom:10, alignItems:'center', boxShadow:'var(--shadow)' }}>
          <div style={{ width:48, height:48, borderRadius:12, background: r.medal==='gold'?'#f1c40f20':r.medal==='silver'?'#aaa20':'#cd7f3220', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
            {r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':r.medal==='bronze'?'🥉':'📋'}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{r.event_name}</div>
            <div style={{ fontSize:12, color:'var(--text3)', display:'flex', gap:10, flexWrap:'wrap' }}>
              {r.discipline && <span><i className="ti ti-run" style={{ fontSize:11, marginRight:3 }} />{r.discipline}</span>}
              {r.date       && <span><i className="ti ti-calendar" style={{ fontSize:11, marginRight:3 }} />{r.date}</span>}
              {r.position   && <span><i className="ti ti-hash" style={{ fontSize:11, marginRight:3 }} />{L('Position','المركز')} #{r.position}</span>}
            </div>
          </div>
          {r.result && (
            <div style={{ textAlign:'center', flexShrink:0 }}>
              <div style={{ fontSize:18, fontWeight:700, color:'#0085C7' }}>{r.result}</div>
              <div style={{ fontSize:10, color:'var(--text3)' }}>{L('Result','النتيجة')}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
