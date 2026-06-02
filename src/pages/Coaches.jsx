import { useState, useEffect } from 'react'
import { Avatar, MedalDisplay, Badge, initials, DashRow } from '../lib/helpers'
import FormModal from '../components/FormModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'

export default function Coaches({ coaches, athletes, onRefresh, onNav, initCoachId }) {
  const [search, setSearch]     = useState('')
  const [sport, setSport]       = useState('All sports')
  const [status, setStatus]     = useState('All statuses')
  const [sort, setSort]         = useState('name-asc')
  const [selected, setSelected] = useState(initCoachId || null)
  const [form, setForm]         = useState(null)
  const [confirm, setConfirm]   = useState(null)

  useEffect(() => { if (initCoachId) setSelected(initCoachId) }, [initCoachId])

  const sports = ['All sports', ...new Set(coaches.map(c => c.sport))]
  let list = coaches.filter(c =>
    (sport  === 'All sports'   || c.sport  === sport)  &&
    (status === 'All statuses' || c.status === status) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.sport.toLowerCase().includes(search.toLowerCase()))
  )
  list = [...list].sort((a, b) => {
    if (sort === 'name-asc')      return a.name.localeCompare(b.name)
    if (sort === 'name-desc')     return b.name.localeCompare(a.name)
    if (sort === 'athletes-desc') return athletes.filter(x=>x.coach_id===b.id).length - athletes.filter(x=>x.coach_id===a.id).length
    if (sort === 'since-asc')     return new Date(a.since) - new Date(b.since)
    return 0
  })

  async function handleSave(formData) {
    const isEdit = !!formData.id
    const payload = {
      name: formData.name, nationality: formData.nationality, sport: formData.sport,
      cert_level: formData.certLevel, license: formData.license,
      since: formData.since || null, email: formData.email, phone: formData.phone,
      status: formData.status,
    }
    if (!payload.name) { toast('Name is required', 'error'); return }
    const { error } = isEdit
      ? await supabase.from('coaches').update(payload).eq('id', formData.id)
      : await supabase.from('coaches').insert(payload)
    if (error) { toast(error.message, 'error'); return }
    toast(isEdit ? `${payload.name} updated` : `${payload.name} added`)
    setForm(null); await onRefresh()
    if (isEdit) setSelected(formData.id)
  }

  async function handleDelete(id, name) {
    const { error } = await supabase.from('coaches').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} deleted`)
    setSelected(null); setConfirm(null); onRefresh()
  }

  // ── DETAIL VIEW ──
  if (selected) {
    const c = coaches.find(x => x.id === selected)
    if (!c) { setSelected(null); return null }
    const myAthletes = athletes.filter(a => a.coach_id === c.id)

    return (
      <div>
        {form && (
          <FormModal type="coach"
            record={form==='edit' ? { id:c.id, name:c.name, nationality:c.nationality, sport:c.sport, certLevel:c.cert_level, license:c.license, since:c.since, email:c.email, phone:c.phone, status:c.status } : null}
            coaches={coaches} athletes={athletes} onSave={handleSave} onClose={() => setForm(null)} />
        )}
        {confirm && (
          <ConfirmModal title="Delete coach" message={`Delete ${c.name}? Athletes will be unassigned.`}
            onConfirm={() => handleDelete(c.id, c.name)} onCancel={() => setConfirm(null)} />
        )}

        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> Back to coaches</button>
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> Edit</button>
          <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> Delete</button>
        </div>

        <div className="detail-grid">
          <div className="detail-profile">
            <div className="detail-av" style={{ background:'#009F6B' }}>{initials(c.name)}</div>
            <div className="detail-name">{c.name}</div>
            <div className="detail-sub">{c.sport} Coach</div>
            <div className="detail-badges"><Badge label={c.status} /></div>
            <div className="detail-fields">
              {[['License',c.license],['Cert. level',c.cert_level],['Nationality',c.nationality],['With QPC since',c.since],['Email',c.email],['Phone',c.phone]].map(([k,v]) => (
                <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv" style={{ fontSize:12 }}>{v||'—'}</span></div>
              ))}
            </div>
          </div>

          <div className="info-card">
            <div className="info-title">Assigned athletes ({myAthletes.length}) <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>— click to view</span></div>
            {myAthletes.length === 0
              ? <div className="empty">No athletes assigned</div>
              : myAthletes.map(a => (
                <DashRow key={a.id} onClick={() => onNav('athletes', { athleteId: a.id })}>
                  <Avatar name={a.name} id={a.id} size={36} fs={11} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{a.name}</div>
                    <div style={{ fontSize:11, color:'#9aa3b2' }}>{a.sport} · {a.classification}</div>
                  </div>
                  <MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} />
                  <Badge label={a.status} />
                </DashRow>
              ))
            }
          </div>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div>
      {form && <FormModal type="coach" record={null} coaches={coaches} athletes={athletes} onSave={handleSave} onClose={() => setForm(null)} />}
      <div className="page-header">
        <div><div className="page-title">Coaches</div><div className="page-sub">{list.length} of {coaches.length} coaches</div></div>
        <button className="btn btn-green" onClick={() => setForm('new')}><i className="ti ti-plus" /> Add coach</button>
      </div>
      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder="Search by name, sport…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="filter" value={sport} onChange={e => setSport(e.target.value)}>{sports.map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={status} onChange={e => setStatus(e.target.value)}>{['All statuses','Active','On Leave'].map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="name-asc">Name A→Z</option><option value="name-desc">Name Z→A</option>
          <option value="athletes-desc">Most athletes</option><option value="since-asc">Longest with QPC</option>
        </select>
      </div>
      <div className="coach-grid">
        {list.map(c => {
          const count = athletes.filter(a => a.coach_id === c.id).length
          return (
            <div key={c.id} className="coach-card" onClick={() => setSelected(c.id)}>
              <div className="coach-head">
                <div className="av" style={{ width:42, height:42, fontSize:13, background:'#009F6B' }}>{initials(c.name)}</div>
                <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600 }}>{c.name}</div><div style={{ fontSize:11, color:'#9aa3b2', marginTop:2 }}>{c.nationality}</div></div>
                <Badge label={c.status} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {[['Sport',c.sport],['Cert.',c.cert_level],['License',c.license],['Athletes',count]].map(([k,v]) => (
                  <div key={k} className="coach-row"><span>{k}</span><span style={k==='Athletes'?{color:'#0085C7'}:{}}>{v||'—'}</span></div>
                ))}
              </div>
            </div>
          )
        })}
        {list.length === 0 && <div className="empty">No coaches match</div>}
      </div>
    </div>
  )
}
