import { useState, useEffect } from 'react'
import { Avatar, Badge, statusDot, initials, DashRow } from '../lib/helpers'
import FormModal from '../components/FormModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'
import { useLang } from '../lib/LangContext.jsx'

export default function Events({ events, athletes, results, registrations, onRefresh, onNav, initEventId, initStatusFilter, profile }) {
  const { tx } = useLang()
  const [search, setSearch]   = useState('')
  const [sportF, setSportF]   = useState('All sports')
  const [typeF, setTypeF]     = useState('All types')
  const [statusF, setStatusF] = useState(initStatusFilter || 'All')
  const [sort, setSort]       = useState('date-asc')
  const [selected, setSelected] = useState(initEventId || null)
  const [form, setForm]         = useState(null)
  const [confirm, setConfirm]   = useState(null)

  useEffect(() => {
    if (initEventId)      setSelected(initEventId)
    if (initStatusFilter) setStatusF(initStatusFilter)
  }, [initEventId, initStatusFilter])

  const sports   = [tx('filters.allSports','All sports'), ...new Set(events.map(e => e.sport))]
  const statuses = ['All','Upcoming','Registration Open','Planning','Completed']

  let list = events.filter(e =>
    (statusF === 'All'        || e.status === statusF) &&
    (sportF  === tx('filters.allSports','All sports') || e.sport === sportF) &&
    (typeF   === 'All types'  || e.type   === typeF)   &&
    (e.name.toLowerCase().includes(search.toLowerCase()) || e.venue?.toLowerCase().includes(search.toLowerCase()))
  )
  list = [...list].sort((a, b) => {
    if (sort === 'date-asc')  return new Date(a.start_date) - new Date(b.start_date)
    if (sort === 'date-desc') return new Date(b.start_date) - new Date(a.start_date)
    if (sort === 'name-asc')  return a.name.localeCompare(b.name)
    if (sort === 'participants-desc') return registrations.filter(r=>r.event_id===b.id).length - registrations.filter(r=>r.event_id===a.id).length
    return 0
  })

  async function handleSave(formData) {
    const isEdit = !!formData.id
    const payload = {
      name: formData.name, sport: formData.sport, type: formData.type,
      venue: formData.venue, start_date: formData.startDate || null,
      end_date: formData.endDate || null, status: formData.status,
      max_participants: parseInt(formData.maxParticipants) || 30,
    }
    if (!payload.name) { toast(tx('form.nameRequired','Event name required'), 'error'); return }
    const { error } = isEdit
      ? await supabase.from('events').update(payload).eq('id', formData.id)
      : await supabase.from('events').insert(payload)
    if (error) { toast(error.message, 'error'); return }
    toast(isEdit ? `${payload.name} updated` : `${payload.name} created`)
    setForm(null); await onRefresh()
    if (isEdit) setSelected(formData.id)
  }

  async function handleDelete(id, name) {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} deleted`)
    setSelected(null); setConfirm(null); onRefresh()
  }

  async function registerAthlete(eventId, athleteId) {
    const { error } = await supabase.from('event_registrations').insert({ event_id: eventId, athlete_id: athleteId })
    if (error) { toast(error.message, 'error'); return }
    toast('Athlete registered'); onRefresh()
  }

  async function unregisterAthlete(eventId, athleteId) {
    const { error } = await supabase.from('event_registrations').delete().match({ event_id: eventId, athlete_id: athleteId })
    if (error) { toast(error.message, 'error'); return }
    toast('Athlete removed'); onRefresh()
  }

  if (selected) {
    const ev = events.find(x => x.id === selected)
    if (!ev) { setSelected(null); return null }
    const regIds      = registrations.filter(r => r.event_id === ev.id).map(r => r.athlete_id)
    const regAthletes = athletes.filter(a => regIds.includes(a.id))
    const eligible    = athletes.filter(a => a.sport === ev.sport && !regIds.includes(a.id))
    const evResults   = results.filter(r => r.event_name === ev.name)
    const pct         = Math.round((regAthletes.length / ev.max_participants) * 100)
    const canReg      = ['Registration Open','Upcoming','Planning'].includes(ev.status)
    const tc          = { National:'badge-blue', Regional:'badge-purple', Invitational:'badge-amber' }[ev.type] || 'badge-gray'

    return (
      <div>
        {form && <FormModal type="event" record={form==='edit' ? { id:ev.id, name:ev.name, sport:ev.sport, type:ev.type, venue:ev.venue, startDate:ev.start_date, endDate:ev.end_date, maxParticipants:ev.max_participants, status:ev.status } : null} onSave={handleSave} onClose={() => setForm(null)} />}
        {confirm && <ConfirmModal title={tx('confirm.deleteEvent','Delete event')} message={`Delete "${ev.name}"?`} onConfirm={() => handleDelete(ev.id, ev.name)} onCancel={() => setConfirm(null)} />}

        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> {tx('events.backToEvents','Back to events')}</button>
        {canEdit(profile) && (
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> {tx('actions.edit','Edit')}</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> {tx('actions.delete','Delete')}</button>
          </div>
        )}

        <div className="detail-grid">
          <div>
            <div className="detail-profile" style={{ textAlign:'left' }}>
              <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
                <span className={`badge ${tc}`}>{ev.type}</span>
                <Badge label={ev.status} />
                <span className="badge badge-blue">{ev.sport}</span>
              </div>
              <div className="detail-name">{ev.name}</div>
              <div className="detail-fields" style={{ marginTop:16 }}>
                {[[tx('events.venue','Venue'),ev.venue],[tx('events.startDate','Start date'),ev.start_date],[tx('events.endDate','End date'),ev.end_date],[tx('events.sport','Sport'),ev.sport],[tx('events.type','Type'),ev.type]].map(([k,v]) => (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v||'—'}</span></div>
                ))}
              </div>
            </div>
            <div className="info-card" style={{ marginTop:12 }}>
              <div className="info-title">{tx('events.participants','Registration')}</div>
              <div style={{ display:'flex', justifyContent:'space-around', padding:'6px 0 12px' }}>
                <div style={{ textAlign:'center' }}><div style={{ fontSize:22, fontWeight:600, color:statusDot(ev.status) }}>{regAthletes.length}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{tx('events.registered','Registered')}</div></div>
                <div style={{ textAlign:'center' }}><div style={{ fontSize:22, fontWeight:600 }}>{ev.max_participants}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{tx('events.capacity','Capacity')}</div></div>
                <div style={{ textAlign:'center' }}><div style={{ fontSize:22, fontWeight:600 }}>{ev.max_participants-regAthletes.length}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{tx('events.spotsLeft','Spots left')}</div></div>
              </div>
              <div className="prog-bar" style={{ height:7 }}><div className="prog-fill" style={{ width:`${pct}%`, background:statusDot(ev.status) }} /></div>
              <div className="prog-text" style={{ marginTop:5 }}>{pct}% {tx('events.filled','filled')}</div>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="info-card">
              <div className="info-title">{tx('events.registeredAthletes','Registered athletes')} ({regAthletes.length}) <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>— {tx('athletes.clickToView','click to view')}</span></div>
              {regAthletes.map(a => (
                <DashRow key={a.id} onClick={() => onNav('athletes', { athleteId: a.id })}>
                  <Avatar name={a.name} id={a.id} size={30} fs={10} />
                  <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:500 }}>{a.name}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{a.classification}</div></div>
                  <Badge label={a.status} />
                  {canReg && <button onClick={e => { e.stopPropagation(); unregisterAthlete(ev.id, a.id) }} style={{ background:'none', border:'1px solid #fca5a5', color:'#dc2626', borderRadius:6, padding:'2px 8px', fontSize:11, cursor:'pointer', flexShrink:0 }}>✕</button>}
                </DashRow>
              ))}
              {regAthletes.length === 0 && <div className="empty" style={{ padding:12 }}>{tx('events.noAthletes','No athletes registered')}</div>}
              {canReg && eligible.length > 0 && (
                <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                  <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.05em', fontWeight:600 }}>{tx('events.registerAthlete','Register an athlete')}</div>
                  {eligible.map(a => (
                    <div key={a.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                      <Avatar name={a.name} id={a.id} size={28} fs={9} />
                      <div style={{ flex:1 }}><div style={{ fontSize:13 }}>{a.name}</div><div style={{ fontSize:11, color:'var(--text3)' }}>{a.classification}</div></div>
                      <button onClick={() => registerAthlete(ev.id, a.id)} style={{ background:'#0085C7', color:'#fff', border:'none', borderRadius:7, padding:'4px 10px', fontSize:12, cursor:'pointer' }}>+ {tx('actions.register','Register')}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="info-card">
              <div className="info-title">{tx('events.results','Results')} ({evResults.length})</div>
              {evResults.length === 0
                ? <div className="empty" style={{ padding:16 }}>{tx('events.noResults','No results recorded')}</div>
                : evResults.map(r => {
                    const a = athletes.find(x => x.id === r.athlete_id)
                    return (
                      <DashRow key={r.id} onClick={() => a && onNav('athletes', { athleteId: a.id })}>
                        <span style={{ fontSize:18, flexShrink:0 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'}</span>
                        <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:500 }}>{r.athlete_name}</div><div style={{ fontSize:11, color:'var(--text2)' }}>{r.discipline}</div></div>
                        <span className="badge badge-blue">{r.result}</span>
                      </DashRow>
                    )
                  })
              }
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {form && <FormModal type="event" record={null} onSave={handleSave} onClose={() => setForm(null)} />}
      <div className="page-header">
        <div><div className="page-title">{tx('pages.events','Events')}</div><div className="page-sub">{list.length} {tx('events.ofEvents','of')} {events.length} {tx('pages.events','events')}</div></div>
        {canEdit(profile) && <button className="btn btn-red" onClick={() => setForm('new')}><i className="ti ti-plus" /> {tx('events.addEvent','New event')}</button>}
      </div>
      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder={tx('events.searchEvents','Search events…')} value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="filter" value={sportF} onChange={e => setSportF(e.target.value)}>{sports.map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={typeF} onChange={e => setTypeF(e.target.value)}>{['All types','National','Regional','Invitational'].map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="date-asc">{tx('filters.dateSoonest','Date (soonest)')}</option>
          <option value="date-desc">{tx('filters.dateLatest','Date (latest)')}</option>
          <option value="name-asc">{tx('filters.nameAZ','Name A→Z')}</option>
          <option value="participants-desc">{tx('filters.mostParticipants','Most participants')}</option>
        </select>
      </div>
      <div className="pill-filters">
        {statuses.map(s => <button key={s} className={`pill${s===statusF?' active':''}`} onClick={() => setStatusF(s)}>{s}</button>)}
      </div>
      {list.map(ev => {
        const regCount = registrations.filter(r => r.event_id === ev.id).length
        const pct = Math.round((regCount / ev.max_participants) * 100)
        const tc  = { National:'badge-blue', Regional:'badge-purple', Invitational:'badge-amber' }[ev.type] || 'badge-gray'
        return (
          <div key={ev.id} className="event-card" onClick={() => setSelected(ev.id)}>
            <div className="event-top">
              <div>
                <div className="event-name">{ev.name}</div>
                <div className="event-meta">
                  <span><i className="ti ti-map-pin" />{ev.venue}</span>
                  <span><i className="ti ti-calendar" />{ev.start_date} → {ev.end_date}</span>
                </div>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0, marginLeft:12 }}>
                <span className={`badge ${tc}`}>{ev.type}</span>
                <Badge label={ev.status} />
                <i className="ti ti-chevron-right" style={{ color:'#ccc', fontSize:16, marginLeft:4 }} />
              </div>
            </div>
            <div className="event-bottom">
              <div className="prog-wrap">
                <div className="prog-label">{tx('events.participants','Participants')}</div>
                <div className="prog-bar"><div className="prog-fill" style={{ width:`${pct}%`, background:statusDot(ev.status) }} /></div>
                <div className="prog-text">{regCount}/{ev.max_participants} {tx('events.registered','registered')}</div>
              </div>
              <div><div className="prog-label">{tx('events.sport','Sport')}</div><span className="badge badge-blue">{ev.sport}</span></div>
            </div>
          </div>
        )
      })}
      {list.length === 0 && <div className="empty">{tx('events.noEvents','No events match')}</div>}
    </div>
  )
}
