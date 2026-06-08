import { useState, useEffect, useRef } from 'react'
import { Avatar, MedalDisplay, Badge, initials, avColor, DashRow } from '../lib/helpers'
import FormModal from '../components/FormModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'
import { useLang } from '../lib/LangContext.jsx'
import PersonDocuments from '../components/PersonDocuments'

function exportCoachPDF(coach, myAthletes) {
  const totalMedals = myAthletes.reduce((s,a) => s + (a.medals_gold||0) + (a.medals_silver||0) + (a.medals_bronze||0), 0)
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; color:#1a1d23; padding:32px; font-size:13px; }
  .header { display:flex; align-items:center; gap:20px; margin-bottom:24px; padding-bottom:20px; border-bottom:3px solid #009F6B; }
  .dots { display:flex; gap:5px; }
  .dot { width:14px; height:14px; border-radius:50%; }
  h1 { font-size:20px; font-weight:700; color:#0a1628; }
  .sub { font-size:12px; color:#9aa3b2; margin-top:2px; }
  .profile { display:flex; gap:20px; margin-bottom:24px; }
  .photo { width:80px; height:80px; border-radius:50%; background:#009F6B; display:flex; align-items:center; justify-content:center; color:#fff; font-size:28px; font-weight:700; flex-shrink:0; overflow:hidden; }
  .photo img { width:100%; height:100%; object-fit:cover; }
  .info h2 { font-size:22px; font-weight:700; }
  .info p { font-size:13px; color:#5a6272; margin-top:3px; }
  .section { margin-bottom:20px; }
  .section-title { font-size:11px; font-weight:700; color:#9aa3b2; text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid #e2e5ea; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; }
  .field { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f1f3; font-size:12px; }
  .field .k { color:#5a6272; }
  .field .v { font-weight:600; }
  .stat-row { display:flex; gap:24px; margin-bottom:16px; }
  .stat { text-align:center; background:#f8f9fb; border-radius:10px; padding:12px 20px; }
  .stat-num { font-size:24px; font-weight:700; color:#009F6B; }
  .stat-lbl { font-size:11px; color:#9aa3b2; margin-top:2px; }
  .ath-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f1f3; font-size:12px; }
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #e2e5ea; font-size:10px; color:#9aa3b2; text-align:center; }
  @media print { body { padding:16px; } }
</style></head><body>
<div class="header">
  <div class="dots">
    <div class="dot" style="background:#EE334E"></div>
    <div class="dot" style="background:#0085C7"></div>
    <div class="dot" style="background:#009F6B"></div>
  </div>
  <div>
    <h1>Qatar Paralympic Committee</h1>
    <p class="sub">Official Coach Profile · Generated ${new Date().toLocaleDateString()}</p>
  </div>
</div>

<div class="profile">
  <div class="photo">
    ${coach.photo_url ? `<img src="${coach.photo_url}"/>` : initials(coach.name)}
  </div>
  <div class="info">
    <h2>${coach.name}</h2>
    ${coach.name_ar ? `<p>${coach.name_ar}</p>` : ''}
    <p style="margin-top:6px;color:#009F6B;font-weight:600">${coach.sport || ''} Coach · ${coach.status || ''}</p>
  </div>
</div>

<div class="section">
  <div class="section-title">Coach Information</div>
  <div class="grid-2">
    ${[['Employee #',coach.employee_number],['QSS #',coach.qss_number],['Sport',coach.sport],['Cert. Level',coach.cert_level],['Nationality',coach.nationality],['Gender',coach.gender],['With QPC since',coach.since],['Email',coach.email],['Phone',coach.phone]].map(([k,v])=>`<div class="field"><span class="k">${k}</span><span class="v">${v||'—'}</span></div>`).join('')}
  </div>
</div>

<div class="section">
  <div class="section-title">Athletes Overview</div>
  <div class="stat-row">
    <div class="stat"><div class="stat-num">${myAthletes.length}</div><div class="stat-lbl">Total Athletes</div></div>
    <div class="stat"><div class="stat-num">${myAthletes.filter(a=>a.status==='Active').length}</div><div class="stat-lbl">Active</div></div>
    <div class="stat"><div class="stat-num" style="color:#f1c40f">${myAthletes.reduce((s,a)=>s+(a.medals_gold||0),0)}</div><div class="stat-lbl">Gold Medals</div></div>
    <div class="stat"><div class="stat-num">${totalMedals}</div><div class="stat-lbl">Total Medals</div></div>
  </div>
</div>

${myAthletes.length > 0 ? `<div class="section">
  <div class="section-title">Athlete Roster (${myAthletes.length})</div>
  <div class="field" style="font-weight:600;background:#f8f9fb;padding:8px 6px">
    <span>Name</span><span>Sport</span><span>Class</span><span>Status</span><span>Medals</span>
  </div>
  ${myAthletes.map(a=>`<div class="ath-row">
    <span style="flex:2">${a.name}</span>
    <span style="flex:1;color:#5a6272">${a.sport||''}</span>
    <span style="flex:1;color:#5a6272">${a.classification||'—'}</span>
    <span style="flex:1;color:#5a6272">${a.status||''}</span>
    <span style="flex:1">🥇${a.medals_gold||0} 🥈${a.medals_silver||0} 🥉${a.medals_bronze||0}</span>
  </div>`).join('')}
</div>` : ''}

<div class="footer">Qatar Paralympic Committee · Confidential · ${new Date().getFullYear()}</div>
</body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 500)
}

export default function Coaches({ coaches, athletes, personDocs, onRefresh, onNav, initCoachId, navState, profile }) {
  const [search, setSearch]     = useState('')
  const [sport, setSport]       = useState('All sports')
  const [status, setStatus]     = useState('All statuses')
  const [sort, setSort]         = useState('name-asc')
  const [selected, setSelected] = useState(initCoachId || null)
  const [form, setForm]         = useState(null)
  const [confirm, setConfirm]   = useState(null)
  const [uploading, setUploading] = useState(false)
  const photoInput = useRef(null)

  const { tx } = useLang()
  useEffect(() => { if (initCoachId) setSelected(initCoachId) }, [initCoachId])

  useEffect(() => {
    if (navState?.reset) {
      setSelected(null)
      setSearch('')
      setSport('All sports')
      setStatus('All statuses')
      setSort('name-asc')
    }
  }, [navState])

  const sports     = ['All sports', ...new Set(coaches.map(c => c.sport).filter(Boolean))]
  const hasFilters = search || sport !== 'All sports' || status !== 'All statuses'

  let list = coaches.filter(c =>
    (sport  === 'All sports'   || c.sport  === sport)  &&
    (status === 'All statuses' || c.status === status) &&
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.sport||'').toLowerCase().includes(search.toLowerCase()))
  )
  list = [...list].sort((a, b) => {
    const aC = athletes.filter(x => x.coach_id === a.id).length
    const bC = athletes.filter(x => x.coach_id === b.id).length
    if (sort === 'name-asc')      return a.name.localeCompare(b.name)
    if (sort === 'name-desc')     return b.name.localeCompare(a.name)
    if (sort === 'athletes-desc') return bC - aC
    if (sort === 'since-asc')     return new Date(a.since) - new Date(b.since)
    return 0
  })

  async function handleSave(formData) {
    const isEdit = !!formData.id
    const payload = {
      name: formData.name, name_ar: formData.nameAr,
      nationality: formData.nationality, gender: formData.gender,
      sport: formData.sport, cert_level: formData.certLevel,
      license: formData.license, since: formData.since || null,
      email: formData.email, phone: formData.phone, status: formData.status,
      qss_number: formData.qssNumber, employee_number: formData.employeeNumber,
      passport_number: formData.passportNumber || null,
      passport_expiry: formData.passportExpiry || null,
      id_number: formData.idNumber || null,
      id_expiry: formData.idExpiry || null,
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

  async function handlePhotoUpload(coachId, file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${coachId}.${ext}`
      const { error: upErr } = await supabase.storage.from('coach-photos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('coach-photos').getPublicUrl(path)
      const photoUrl = data.publicUrl + '?t=' + Date.now()
      const { error: dbErr } = await supabase.from('coaches').update({ photo_url: photoUrl }).eq('id', coachId)
      if (dbErr) throw dbErr
      toast('Photo updated!'); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setUploading(false) }
  }

  async function handlePhotoRemove(coachId) {
    const { error } = await supabase.from('coaches').update({ photo_url: null }).eq('id', coachId)
    if (error) { toast(error.message, 'error'); return }
    toast('Photo removed'); await onRefresh()
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
            record={form==='edit' ? {
              id:c.id, name:c.name, nameAr:c.name_ar, nationality:c.nationality,
              gender:c.gender, sport:c.sport, certLevel:c.cert_level,
              license:c.license, since:c.since, email:c.email, phone:c.phone,
              status:c.status, qssNumber:c.qss_number, employeeNumber:c.employee_number,
              passportNumber:c.passport_number, passportExpiry:c.passport_expiry,
              idNumber:c.id_number, idExpiry:c.id_expiry,
            } : null}
            coaches={coaches} athletes={athletes} onSave={handleSave} onClose={() => setForm(null)} />
        )}
        {confirm && (
          <ConfirmModal title="Delete coach" message={`Delete ${c.name}? Athletes will be unassigned.`}
            onConfirm={() => handleDelete(c.id, c.name)} onCancel={() => setConfirm(null)} />
        )}

        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> {tx('actions.back','Back')}</button>
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          {canEdit(profile) && <>
            <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> Edit</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> Delete</button>
          </>}
          <button className="action-btn action-btn-edit"
            style={{ borderColor:'#009F6B', color:'#009F6B' }}
            onMouseEnter={e => e.currentTarget.style.background='#e6f4ee'}
            onMouseLeave={e => e.currentTarget.style.background=''}
            onClick={() => exportCoachPDF(c, myAthletes)}>
            <i className="ti ti-printer" /> Export PDF
          </button>
        </div>

        <div className="detail-grid">
          <div className="detail-profile">
            {/* PHOTO */}
            <div style={{ position:'relative', width:90, height:90, margin:'0 auto 14px' }}>
              {c.photo_url
                ? <img src={c.photo_url} alt={c.name} style={{ width:90, height:90, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--border)' }} />
                : <div style={{ width:90, height:90, borderRadius:'50%', background:'#009F6B', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:600, color:'#fff' }}>{initials(c.name)}</div>
              }
              {canEdit(profile) && (
                <div style={{ position:'absolute', bottom:0, right:0, display:'flex', gap:3 }}>
                  <button onClick={() => photoInput.current.click()} disabled={uploading} title="Upload photo"
                    style={{ width:26, height:26, borderRadius:'50%', background:'#009F6B', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                    {uploading
                      ? <div style={{ width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
                      : <i className="ti ti-camera" style={{ fontSize:12 }} />}
                  </button>
                  {c.photo_url && (
                    <button onClick={() => handlePhotoRemove(c.id)} title="Remove photo"
                      style={{ width:26, height:26, borderRadius:'50%', background:'#dc2626', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                      <i className="ti ti-x" style={{ fontSize:12 }} />
                    </button>
                  )}
                </div>
              )}
              <input ref={photoInput} type="file" accept="image/*" style={{ display:'none' }}
                onChange={e => { if(e.target.files[0]) handlePhotoUpload(c.id, e.target.files[0]) }} />
            </div>

            <div className="detail-name">{c.name}</div>
            {c.name_ar && <div className="detail-sub">{c.name_ar}</div>}
            <div className="detail-sub">{c.sport} Coach</div>
            <div className="detail-badges"><Badge label={c.status} /></div>
            <div className="detail-fields">
              {[
                ['Employee #', c.employee_number],
                ['QSS #', c.qss_number],
                ['Cert. level', c.cert_level],
                ['Nationality', c.nationality],
                ['Gender', c.gender],
                ['With QPC since', c.since],
                ['Passport #', c.passport_number],
                ['Passport expiry', c.passport_expiry],
                ['ID / Residence #', c.id_number],
                ['ID expiry', c.id_expiry],
                ['Email', c.email],
                ['Phone', c.phone],
              ].map(([k,v]) => (
                <div key={k} className="detail-row">
                  <span className="dk">{k}</span>
                  <span className="dv" style={{ fontSize:12 }}>{v||'—'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="info-card">
            {/* Medals summary */}
            <div style={{ display:'flex', justifyContent:'space-around', padding:'10px 0 16px', borderBottom:'1px solid var(--border)', marginBottom:14 }}>
              {[
                ['Athletes', myAthletes.length, '#0085C7'],
                ['Gold', myAthletes.reduce((s,a)=>s+(a.medals_gold||0),0), '#f1c40f'],
                ['Silver', myAthletes.reduce((s,a)=>s+(a.medals_silver||0),0), '#aaa'],
                ['Bronze', myAthletes.reduce((s,a)=>s+(a.medals_bronze||0),0), '#cd7f32'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:600, color }}>{val}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>

            <div className="info-title">
              Assigned athletes ({myAthletes.length})
              <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0, marginLeft:4 }}>— click to view</span>
            </div>
            {myAthletes.length === 0
              ? <div className="empty">No athletes assigned</div>
              : myAthletes.map(a => (
                <DashRow key={a.id} onClick={() => onNav('athletes', { athleteId: a.id })}>
                  {a.photo_url
                    ? <img src={a.photo_url} alt={a.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                    : <Avatar name={a.name} id={a.id} size={32} fs={10} />
                  }
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

        {/* DOCUMENTS */}
        <PersonDocuments
          personId={c.id}
          personType="coach"
          personName={c.name}
          docs={personDocs}
          onRefresh={onRefresh}
          profile={profile}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div>
      {form && <FormModal type="coach" record={null} coaches={coaches} athletes={athletes} onSave={handleSave} onClose={() => setForm(null)} />}
      <div className="page-header">
        <div><div className="page-title">{tx('pages.coaches','Coaches')}</div><div className="page-sub">{list.length} of {coaches.length} coaches</div></div>
        <div style={{ display:'flex', gap:8 }}>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setSport('All sports'); setStatus('All statuses') }}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:9, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
              <i className="ti ti-x" style={{ fontSize:13 }} /> Reset filters
            </button>
          )}
          {canEdit(profile) && (
            <button className="btn btn-green" onClick={() => setForm('new')}><i className="ti ti-plus" /> {tx('coaches.addCoach','Add coach')}</button>
          )}
        </div>
      </div>
      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder="Search by name, sport…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="filter" value={sport} onChange={e => setSport(e.target.value)}>{sports.map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={status} onChange={e => setStatus(e.target.value)}>{['All statuses','Active','On Leave','Inactive'].map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="name-asc">Name A→Z</option>
          <option value="name-desc">Name Z→A</option>
          <option value="athletes-desc">Most athletes</option>
          <option value="since-asc">Longest with QPC</option>
        </select>
      </div>
      <div className="coach-grid">
        {list.map(c => {
          const count = athletes.filter(a => a.coach_id === c.id).length
          return (
            <div key={c.id} className="coach-card" onClick={() => setSelected(c.id)}>
              <div className="coach-head">
                {c.photo_url
                  ? <img src={c.photo_url} alt={c.name} style={{ width:42, height:42, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                  : <div className="av" style={{ width:42, height:42, fontSize:13, background:'#009F6B' }}>{initials(c.name)}</div>
                }
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{c.name}</div>
                  {c.name_ar && <div style={{ fontSize:11, color:'#9aa3b2', marginTop:1 }}>{c.name_ar}</div>}
                  <div style={{ fontSize:11, color:'#9aa3b2', marginTop:1 }}>{c.nationality}</div>
                </div>
                <Badge label={c.status} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {[
                  ['Sport', c.sport],
                  ['Cert.', c.cert_level],
                  ['Employee #', c.employee_number],
                  ['Athletes', count],
                ].map(([k,v]) => (
                  <div key={k} className="coach-row">
                    <span>{k}</span>
                    <span style={k==='Athletes'?{color:'#0085C7',fontWeight:600}:{}}>{v||'—'}</span>
                  </div>
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
