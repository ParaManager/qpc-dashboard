import { useState } from 'react'
import { Avatar, MedalDisplay, Badge, statusClass } from '../lib/helpers'
import FormModal from '../components/FormModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'

export default function Results({ results, athletes, onRefresh }) {
  const [search, setSearch] = useState('')
  const [medal, setMedal]   = useState('All medals')
  const [sport, setSport]   = useState('All sports')
  const [sort, setSort]     = useState('date-desc')
  const [form, setForm]     = useState(null)
  const [confirm, setConfirm] = useState(null)

  const sports = ['All sports', ...new Set(athletes.map(a => a.sport))]

  let list = results.filter(r => {
    const as = athletes.find(a => a.id === r.athlete_id)?.sport || ''
    return (medal === 'All medals' || r.medal === medal) &&
           (sport === 'All sports' || as === sport) &&
           (r.athlete_name?.toLowerCase().includes(search.toLowerCase()) ||
            r.discipline?.toLowerCase().includes(search.toLowerCase()) ||
            r.event_name?.toLowerCase().includes(search.toLowerCase()))
  })
  list = [...list].sort((a, b) => {
    if (sort === 'date-desc')   return new Date(b.date) - new Date(a.date)
    if (sort === 'date-asc')    return new Date(a.date) - new Date(b.date)
    if (sort === 'athlete-asc') return (a.athlete_name||'').localeCompare(b.athlete_name||'')
    if (sort === 'medal-asc')   return ['gold','silver','bronze'].indexOf(a.medal) - ['gold','silver','bronze'].indexOf(b.medal)
    return 0
  })

  async function handleSave(formData) {
    const isEdit = !!formData.id
    const athlete = athletes.find(a => a.name === formData.athleteName)
    const payload = {
      athlete_name: formData.athleteName, athlete_id: athlete?.id || null,
      event_name: formData.eventName, discipline: formData.discipline,
      result: formData.result, position: parseInt(formData.position) || 1,
      medal: formData.medal, date: formData.date || null,
    }
    if (!payload.athlete_name || !payload.event_name) { toast('Athlete and competition required', 'error'); return }
    const { error } = isEdit
      ? await supabase.from('results').update(payload).eq('id', formData.id)
      : await supabase.from('results').insert(payload)
    if (error) { toast(error.message, 'error'); return }
    // sync medal counts on athlete
    if (athlete) {
      const allResults = isEdit
        ? [...results.filter(r => r.id !== formData.id && r.athlete_id === athlete.id), { ...payload, id: formData.id }]
        : [...results.filter(r => r.athlete_id === athlete.id), payload]
      await supabase.from('athletes').update({
        medals_gold:   allResults.filter(r => r.medal === 'gold').length,
        medals_silver: allResults.filter(r => r.medal === 'silver').length,
        medals_bronze: allResults.filter(r => r.medal === 'bronze').length,
      }).eq('id', athlete.id)
    }
    toast(isEdit ? 'Result updated' : 'Result added')
    setForm(null); onRefresh()
  }

  async function handleDelete(id) {
    const r = results.find(x => x.id === id)
    const { error } = await supabase.from('results').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    // re-sync medals
    if (r?.athlete_id) {
      const remaining = results.filter(x => x.id !== id && x.athlete_id === r.athlete_id)
      await supabase.from('athletes').update({
        medals_gold:   remaining.filter(x => x.medal === 'gold').length,
        medals_silver: remaining.filter(x => x.medal === 'silver').length,
        medals_bronze: remaining.filter(x => x.medal === 'bronze').length,
      }).eq('id', r.athlete_id)
    }
    toast('Result deleted'); setConfirm(null); onRefresh()
  }

  // tally
  const tallyAthletes = [...athletes]
    .filter(a => (a.medals_gold + a.medals_silver + a.medals_bronze) > 0)
    .sort((a, b) => b.medals_gold - a.medals_gold)

  return (
    <div>
      {form && <FormModal type="result" record={form === 'new' ? null : form} athletes={athletes} onSave={handleSave} onClose={() => setForm(null)} />}
      {confirm && <ConfirmModal title="Delete result" message="Delete this result? Medal counts will update." onConfirm={() => handleDelete(confirm)} onCancel={() => setConfirm(null)} />}

      <div className="page-header">
        <div><div className="page-title">Results</div><div className="page-sub">{list.length} of {results.length} results</div></div>
        {canEdit(profile) && <button className="btn btn-purple" onClick={() => setForm('new')}><i className="ti ti-plus" /> Add result</button>}
      </div>
      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder="Search by athlete, event…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="filter" value={medal} onChange={e => setMedal(e.target.value)}>{['All medals','gold','silver','bronze'].map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={sport} onChange={e => setSport(e.target.value)}>{sports.map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="date-desc">Date (newest)</option><option value="date-asc">Date (oldest)</option>
          <option value="athlete-asc">Athlete A→Z</option><option value="medal-asc">Medal rank</option>
        </select>
      </div>
      <div className="tbl-wrap" style={{ marginBottom: 16 }}>
        <table><thead><tr><th>Medal</th><th>Athlete</th><th>Discipline</th><th>Competition</th><th>Result</th><th>Date</th><th /></tr></thead>
          <tbody>
            {list.map(r => {
              const a = athletes.find(x => x.id === r.athlete_id)
              return (
                <tr key={r.id}>
                  <td style={{ fontSize: 20 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'}</td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {a && <Avatar name={a.name} id={a.id} size={26} fs={9} />}
                    <span style={{ fontWeight: 500 }}>{r.athlete_name}</span>
                  </div></td>
                  <td style={{ color: '#5a6272' }}>{r.discipline}</td>
                  <td>{r.event_name}</td>
                  <td><span className="badge badge-blue">{r.result}</span></td>
                  <td style={{ color: '#9aa3b2' }}>{r.date}</td>
                  <td><div style={{ display: 'flex', gap: 6 }}>
                    <button className="action-btn action-btn-edit" style={{ padding: '3px 8px', fontSize: 11 }}
                      onClick={e => { e.stopPropagation(); setForm({ id: r.id, athleteName: r.athlete_name, medal: r.medal, eventName: r.event_name, discipline: r.discipline, result: r.result, position: r.position, date: r.date }) }}>
                      <i className="ti ti-pencil" />
                    </button>
                    <button className="action-btn action-btn-delete" style={{ padding: '3px 8px', fontSize: 11 }}
                      onClick={e => { e.stopPropagation(); setConfirm(r.id) }}>
                      <i className="ti ti-trash" />
                    </button>
                  </div></td>
                </tr>
              )
            })}
            {list.length === 0 && <tr><td colSpan={7}><div className="empty">No results match</div></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title"><i className="ti ti-chart-bar" /> Medal tally by athlete</div>
        <div className="medal-tally-grid">
          {tallyAthletes.map(a => (
            <div key={a.id} className="tally-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <Avatar name={a.name} id={a.id} size={26} fs={9} />
                <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name.split(' ')[0]}</div>
              </div>
              <MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
