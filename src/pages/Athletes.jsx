import { useState, useEffect } from 'react'
import { Avatar, MedalDisplay, Badge, avColor, initials, DashRow } from '../lib/helpers'
import FormModal from '../components/FormModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'

export default function Athletes({ athletes, coaches, results, onRefresh, onNav, initAthleteId, initStatusFilter }) {
  const [search, setSearch]     = useState('')
  const [sport, setSport]       = useState('All sports')
  const [status, setStatus]     = useState('All statuses')
  const [gender, setGender]     = useState('All genders')
  const [sort, setSort]         = useState('name-asc')
  const [selected, setSelected] = useState(initAthleteId || null)
  const [form, setForm]         = useState(null)
  const [confirm, setConfirm]   = useState(null)

  useEffect(() => {
    if (initAthleteId) setSelected(initAthleteId)
    if (initStatusFilter) setStatus(initStatusFilter)
  }, [initAthleteId, initStatusFilter])

  const sports = ['All sports', ...new Set(athletes.map(a => a.sport))]

  let list = athletes.filter(a =>
    (sport  === 'All sports'   || a.sport  === sport)  &&
    (status === 'All statuses' || a.status === status) &&
    (gender === 'All genders'  || a.gender === gender) &&
    (a.name.toLowerCase().includes(search.toLowerCase()) || a.sport.toLowerCase().includes(search.toLowerCase()))
  )
  list = [...list].sort((a, b) => {
    if (sort === 'name-asc')    return a.name.localeCompare(b.name)
    if (sort === 'name-desc')   return b.name.localeCompare(a.name)
    if (sort === 'medals-desc') return (b.medals_gold+b.medals_silver+b.medals_bronze)-(a.medals_gold+a.medals_silver+a.medals_bronze)
    if (sort === 'gold-desc')   return b.medals_gold - a.medals_gold
    if (sort === 'join-desc')   return new Date(b.join_date) - new Date(a.join_date)
    if (sort === 'join-asc')    return new Date(a.join_date) - new Date(b.join_date)
    return 0
  })

  async function handleSave(formData) {
    const isEdit = !!formData.id
    const payload = {
      name: formData.name, name_ar: formData.nameAr, dob: formData.dob || null,
      gender: formData.gender, nationality: formData.nationality,
      sport: formData.sport, classification: formData.classification,
      disability: formData.disability, coach_id: formData.coachId || null,
      status: formData.status, phone: formData.phone, email: formData.email,
      join_date: formData.joinDate || null,
    }
    if (!payload.name) { toast('Name is required', 'error'); return }
    const { error } = isEdit
      ? await supabase.from('athletes').update(payload).eq('id', formData.id)
      : await supabase.from('athletes').insert(payload)
    if (error) { toast(error.message, 'error'); return }
    toast(isEdit ? `${payload.name} updated` : `${payload.name} added`)
    setForm(null)
    await onRefresh()
    if (isEdit) setSelected(formData.id)
  }

  async function handleDelete(id, name) {
    const { error } = await supabase.from('athletes').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} deleted`)
    setSelected(null); setConfirm(null); onRefresh()
  }

  // ── DETAIL VIEW ──
  if (selected) {
    const a = athletes.find(x => x.id === selected)
    if (!a) { setSelected(null); return null }
    const coach = coaches.find(c => c.id === a.coach_id)
    const myResults = results.filter(r => r.athlete_id === a.id)

    return (
      <div>
        {form && (
          <FormModal type="athlete"
            record={form === 'edit' ? { id:a.id, name:a.name, nameAr:a.name_ar, dob:a.dob, gender:a.gender, nationality:a.nationality, sport:a.sport, classification:a.classification, disability:a.disability, coachId:a.coach_id, status:a.status, phone:a.phone, email:a.email, joinDate:a.join_date } : null}
            coaches={coaches} onSave={handleSave} onClose={() => setForm(null)} />
        )}
        {confirm && (
          <ConfirmModal title="Delete athlete" message={`Delete ${a.name}? This cannot be undone.`}
            onConfirm={() => handleDelete(a.id, a.name)} onCancel={() => setConfirm(null)} />
        )}

        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> Back to athletes</button>
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> Edit</button>
          <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> Delete</button>
        </div>

        <div className="detail-grid">
          <div>
            <div className="detail-profile">
              <div className="detail-av" style={{ background: avColor(a.id) }}>{initials(a.name)}</div>
              <div className="detail-name">{a.name}</div>
              {a.name_ar && <div className="detail-sub">{a.name_ar}</div>}
              <div className="detail-badges">
                <Badge label={a.status} /><span className="badge badge-blue">{a.sport}</span>
              </div>
              <div className="detail-fields">
                {[['Date of birth',a.dob],['Gender',a.gender],['Nationality',a.nationality],['Phone',a.phone],['Email',a.email],['Joined QPC',a.join_date]].map(([k,v]) => (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v||'—'}</span></div>
                ))}
              </div>
            </div>

            <div className="info-card" style={{ marginTop:12 }}>
              <div className="info-title">Medal count <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>(click to see details)</span></div>
              <div className="medal-row">
                {[['gold','#f1c40f','Gold'],['silver','#aaa','Silver'],['bronze','#cd7f32','Bronze']].map(([type,color,label]) => {
                  const count = a[`medals_${type}`] || 0
                  const myMedals = myResults.filter(r => r.medal === type)
                  return (
                    <div key={type} className="medal-item"
                      style={{ cursor: count>0?'pointer':'default', borderRadius:10, padding:'8px 4px', transition:'background .15s' }}
                      onMouseEnter={e => { if(count>0) e.currentTarget.style.background='#f4f6f9' }}
                      onMouseLeave={e => { e.currentTarget.style.background='' }}>
                      <div className="medal-num" style={{ color }}>{count}</div>
                      <div className="medal-lbl">{label}</div>
                      {count>0 && <div style={{ fontSize:9, color, marginTop:2, opacity:.8 }}>view ↗</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="info-card">
              <div className="info-title">Sport & classification</div>
              {[['Sport',a.sport],['Classification',a.classification],['Disability type',a.disability]].map(([k,v]) => (
                <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v||'—'}</span></div>
              ))}
            </div>

            <div className="info-card" style={{ marginTop:12 }}>
              <div className="info-title">Head coach <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>— click to view</span></div>
              {coach ? (
                <DashRow onClick={() => onNav('coaches', { coachId: coach.id })}>
                  <div className="av" style={{ width:28, height:28, fontSize:10, background:'#009F6B', flexShrink:0 }}>{initials(coach.name)}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{coach.name}</div>
                    <div style={{ fontSize:11, color:'#9aa3b2' }}>{coach.sport} · {coach.cert_level}</div>
                  </div>
                </DashRow>
              ) : (
                <div style={{ padding:'8px 0', fontSize:13, color:'var(--text3)' }}>No coach assigned</div>
              )}
            </div>

            {myResults.length > 0 && (
              <div className="info-card" style={{ marginTop:12 }}>
                <div className="info-title">Recent results</div>
                {myResults.slice(0,5).map(r => (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:18 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{r.discipline}</div>
                      <div style={{ fontSize:11, color:'var(--text2)' }}>{r.event_name}</div>
                    </div>
                    <span className="badge badge-blue">{r.result}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div>
      {form && <FormModal type="athlete" record={null} coaches={coaches} onSave={handleSave} onClose={() => setForm(null)} />}
      <div className="page-header">
        <div><div className="page-title">Athletes</div><div className="page-sub">{list.length} of {athletes.length} athletes</div></div>
        <button className="btn btn-blue" onClick={() => setForm('new')}><i className="ti ti-plus" /> Add athlete</button>
      </div>
      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder="Search by name, sport…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="filter" value={sport} onChange={e => setSport(e.target.value)}>{sports.map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={status} onChange={e => setStatus(e.target.value)}>{['All statuses','Active','In Training','Inactive'].map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={gender} onChange={e => setGender(e.target.value)}>{['All genders','Male','Female'].map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="name-asc">Name A→Z</option><option value="name-desc">Name Z→A</option>
          <option value="medals-desc">Most medals</option><option value="gold-desc">Most gold</option>
          <option value="join-desc">Newest members</option><option value="join-asc">Oldest members</option>
        </select>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Athlete</th><th>Sport</th><th>Class</th><th>Coach</th><th>Medals</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map(a => (
              <tr key={a.id} onClick={() => setSelected(a.id)}>
                <td><div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <Avatar name={a.name} id={a.id} />
                  <div><div style={{ fontWeight:500 }}>{a.name}</div><div style={{ fontSize:11, color:'#9aa3b2' }}>{a.nationality}</div></div>
                </div></td>
                <td>{a.sport}</td>
                <td><span className="badge badge-blue">{a.classification}</span></td>
                <td style={{ color:'#5a6272' }}>{coaches.find(c => c.id === a.coach_id)?.name || '—'}</td>
                <td><MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} /></td>
                <td><Badge label={a.status} /></td>
                <td><i className="ti ti-chevron-right" style={{ color:'#ccc', fontSize:16 }} /></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7}><div className="empty">No athletes match</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
