import { useState, useEffect, useRef } from 'react'
import { Avatar, MedalDisplay, Badge, avColor, initials, DashRow } from '../lib/helpers'
import FormModal from '../components/FormModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'

const DOC_TYPES = ['Passport', 'Medical Clearance', 'Classification Certificate', 'Disability Certificate', 'Other']
const DOC_ICONS = {
  'Passport': 'ti-id',
  'Medical Clearance': 'ti-heart-rate-monitor',
  'Classification Certificate': 'ti-certificate',
  'Disability Certificate': 'ti-accessible',
  'Other': 'ti-file',
}
const DOC_COLORS = {
  'Passport': '#0085C7',
  'Medical Clearance': '#EE334E',
  'Classification Certificate': '#009F6B',
  'Disability Certificate': '#8b5cf6',
  'Other': '#9aa3b2',
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function Athletes({ athletes, coaches, results, documents, events, registrations, onRefresh, onNav, initAthleteId, initStatusFilter, profile }) {
  const [search, setSearch]         = useState('')
  const [sport, setSport]           = useState('All sports')
  const [status, setStatus]         = useState('All statuses')
  const [gender, setGender]         = useState('All genders')
  const [sort, setSort]             = useState('name-asc')
  const [selected, setSelected]     = useState(initAthleteId || null)
  const [form, setForm]             = useState(null)
  const [confirm, setConfirm]       = useState(null)
  const [medalModal, setMedalModal] = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [docUploading, setDocUploading] = useState(false)
  const [docType, setDocType]       = useState('Passport')
  const [docConfirm, setDocConfirm] = useState(null)
  const photoInput                  = useRef(null)
  const docInput                    = useRef(null)

  useEffect(() => {
    if (initAthleteId)    setSelected(initAthleteId)
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
    setForm(null); await onRefresh()
    if (isEdit) setSelected(formData.id)
  }

  async function handleDelete(id, name) {
    const { error } = await supabase.from('athletes').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} deleted`)
    setSelected(null); setConfirm(null); onRefresh()
  }

  async function handlePhotoUpload(athleteId, file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${athleteId}.${ext}`
      const { error: upErr } = await supabase.storage.from('athlete-photos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('athlete-photos').getPublicUrl(path)
      const photoUrl = data.publicUrl + '?t=' + Date.now()
      const { error: dbErr } = await supabase.from('athletes').update({ photo_url: photoUrl }).eq('id', athleteId)
      if (dbErr) throw dbErr
      toast('Photo updated!'); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setUploading(false) }
  }

  async function handlePhotoRemove(athleteId) {
    const { error } = await supabase.from('athletes').update({ photo_url: null }).eq('id', athleteId)
    if (error) { toast(error.message, 'error'); return }
    toast('Photo removed'); await onRefresh()
  }

  async function handleDocUpload(athleteId, file) {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { toast('File must be under 20MB', 'error'); return }
    setDocUploading(true)
    try {
      const ext      = file.name.split('.').pop()
      const path     = `${athleteId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('athlete-documents').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('athlete-documents').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('athlete_documents').insert({
        athlete_id: athleteId,
        name: file.name,
        type: docType,
        file_url: data.publicUrl,
        file_path: path,
        file_size: file.size,
      })
      if (dbErr) throw dbErr
      toast(`${docType} uploaded!`); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setDocUploading(false); if (docInput.current) docInput.current.value = '' }
  }

  async function handleDocDelete(doc) {
    // delete from storage
    await supabase.storage.from('athlete-documents').remove([doc.file_path])
    // delete from db
    const { error } = await supabase.from('athlete_documents').delete().eq('id', doc.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Document deleted'); setDocConfirm(null); await onRefresh()
  }

  // ── DETAIL VIEW ──
  if (selected) {
    const a = athletes.find(x => x.id === selected)
    if (!a) { setSelected(null); return null }
    const coach     = coaches.find(c => c.id === a.coach_id)
    const myResults = (results || []).filter(r => r.athlete_id === a.id)
    const myDocs    = (documents || []).filter(d => d.athlete_id === a.id)

    // events the athlete is registered for
    const myEventIds   = (registrations || []).filter(r => r.athlete_id === a.id).map(r => r.event_id)
    const myEvents     = (events || []).filter(e => myEventIds.includes(e.id)).sort((a,b) => new Date(b.start_date) - new Date(a.start_date))

    // group docs by type
    const docsByType = DOC_TYPES.reduce((acc, t) => {
      acc[t] = myDocs.filter(d => d.type === t)
      return acc
    }, {})

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
        {docConfirm && (
          <ConfirmModal title="Delete document" message={`Delete "${docConfirm.name}"? This cannot be undone.`}
            onConfirm={() => handleDocDelete(docConfirm)} onCancel={() => setDocConfirm(null)} />
        )}
        {medalModal && (
          <div className="modal-overlay" onClick={() => setMedalModal(null)}>
            <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">{medalModal.type==='gold'?'🥇':medalModal.type==='silver'?'🥈':'🥉'} {medalModal.label} Medals — {medalModal.athleteName}</div>
                <button className="modal-close" onClick={() => setMedalModal(null)}><i className="ti ti-x" /></button>
              </div>
              <div className="modal-body">
                {medalModal.results.length === 0
                  ? <div className="empty">No {medalModal.label.toLowerCase()} medals recorded yet.</div>
                  : medalModal.results.map(r => (
                    <div key={r.id} style={{ display:'flex', gap:14, alignItems:'flex-start', padding:'14px 0', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ width:44, height:44, borderRadius:'50%', background:medalModal.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                        {medalModal.type==='gold'?'🥇':medalModal.type==='silver'?'🥈':'🥉'}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>{r.discipline}</div>
                        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:8 }}>{r.event_name}</div>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                          <span className="badge badge-blue">{r.result}</span>
                          <span className="badge badge-gray"><i className="ti ti-calendar" style={{ fontSize:11, verticalAlign:-1, marginRight:3 }} />{r.date}</span>
                          <span className="badge" style={{ background:medalModal.color+'18', color:medalModal.color }}>Position #{r.position}</span>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> Back to athletes</button>
        {canEdit(profile) && (
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> Edit</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> Delete</button>
          </div>
        )}

        <div className="detail-grid">
          <div>
            {/* PROFILE CARD */}
            <div className="detail-profile">
              <div style={{ position:'relative', width:90, height:90, margin:'0 auto 14px' }}>
                {a.photo_url
                  ? <img src={a.photo_url} alt={a.name} style={{ width:90, height:90, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--border)' }} />
                  : <div style={{ width:90, height:90, borderRadius:'50%', background:avColor(a.id), display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:600, color:'#fff' }}>{initials(a.name)}</div>
                }
                {canEdit(profile) && (
                  <div style={{ position:'absolute', bottom:0, right:0, display:'flex', gap:3 }}>
                    <button onClick={() => photoInput.current.click()} disabled={uploading} title="Upload photo"
                      style={{ width:26, height:26, borderRadius:'50%', background:'#0085C7', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                      {uploading
                        ? <div style={{ width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
                        : <i className="ti ti-camera" style={{ fontSize:12 }} />}
                    </button>
                    {a.photo_url && (
                      <button onClick={() => handlePhotoRemove(a.id)} title="Remove photo"
                        style={{ width:26, height:26, borderRadius:'50%', background:'#dc2626', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                        <i className="ti ti-x" style={{ fontSize:12 }} />
                      </button>
                    )}
                  </div>
                )}
                <input ref={photoInput} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={e => { if(e.target.files[0]) handlePhotoUpload(a.id, e.target.files[0]) }} />
              </div>
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

            {/* MEDALS */}
            <div className="info-card" style={{ marginTop:12 }}>
              <div className="info-title">Medal count <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>(click to see details)</span></div>
              <div className="medal-row">
                {[['gold','#f1c40f','Gold'],['silver','#aaa','Silver'],['bronze','#cd7f32','Bronze']].map(([type,color,label]) => {
                  const count   = a[`medals_${type}`] || 0
                  const typeRes = myResults.filter(r => r.medal === type)
                  return (
                    <div key={type} className="medal-item"
                      style={{ cursor:count>0?'pointer':'default', borderRadius:10, padding:'8px 4px', transition:'background .15s' }}
                      onMouseEnter={e => { if(count>0) e.currentTarget.style.background='#f4f6f9' }}
                      onMouseLeave={e => { e.currentTarget.style.background='' }}
                      onClick={() => { if(count>0) setMedalModal({ athleteName:a.name, type, color, label, results:typeRes }) }}>
                      <div className="medal-num" style={{ color }}>{count}</div>
                      <div className="medal-lbl">{label}</div>
                      {count>0 && <div style={{ fontSize:9, color, marginTop:2, opacity:.8 }}>view ↗</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* SPORT */}
            <div className="info-card">
              <div className="info-title">Sport & classification</div>
              {[['Sport',a.sport],['Classification',a.classification],['Disability type',a.disability]].map(([k,v]) => (
                <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v||'—'}</span></div>
              ))}
            </div>

            {/* COACH */}
            <div className="info-card">
              <div className="info-title">Head coach <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>— click to view</span></div>
              {coach ? (
                <DashRow onClick={() => onNav('coaches', { coachId: coach.id })}>
                  <div className="av" style={{ width:28, height:28, fontSize:10, background:'#009F6B', flexShrink:0 }}>{initials(coach.name)}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{coach.name}</div>
                    <div style={{ fontSize:11, color:'#9aa3b2' }}>{coach.sport} · {coach.cert_level}</div>
                  </div>
                </DashRow>
              ) : <div style={{ padding:'8px 0', fontSize:13, color:'var(--text3)' }}>No coach assigned</div>}
            </div>

            {/* RECENT RESULTS */}
            {myResults.length > 0 && (
              <div className="info-card">
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

            {/* ── COMPETITION HISTORY ── */}
            <div className="info-card">
              <div className="info-title" style={{ marginBottom: 14 }}>
                Competition history
                <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>
                  {myEvents.length} event{myEvents.length !== 1 ? 's' : ''}
                </span>
              </div>
              {myEvents.length === 0
                ? <div className="empty" style={{ padding:'16px 0' }}>Not registered in any events yet.</div>
                : <div style={{ position:'relative' }}>
                    {/* vertical timeline line */}
                    <div style={{ position:'absolute', left:15, top:6, bottom:6, width:2, background:'var(--border)', borderRadius:2 }} />
                    {myEvents.map(ev => {
                      const evResults = (results || []).filter(r => r.athlete_id === a.id && r.event_name === ev.name)
                      const medals    = evResults.filter(r => r.medal)
                      const dotColor  = ev.status === 'Completed'
                        ? medals.length > 0 ? '#f1c40f' : '#009F6B'
                        : ev.status === 'Upcoming' ? '#0085C7'
                        : ev.status === 'Registration Open' ? '#8b5cf6'
                        : '#9aa3b2'
                      return (
                        <div key={ev.id} style={{ display:'flex', gap:14, marginBottom:16, position:'relative' }}>
                          {/* dot */}
                          <div style={{ width:32, height:32, borderRadius:'50%', background:dotColor+'20', border:`2px solid ${dotColor}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1 }}>
                            {ev.status === 'Completed' && medals.length > 0
                              ? <span style={{ fontSize:14 }}>{medals[0].medal==='gold'?'🥇':medals[0].medal==='silver'?'🥈':'🥉'}</span>
                              : <i className={`ti ${ev.status==='Completed'?'ti-check':'ti-calendar'}`} style={{ fontSize:13, color:dotColor }} />
                            }
                          </div>
                          <div style={{ flex:1, paddingTop:4 }}>
                            <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{ev.name}</div>
                            <div style={{ fontSize:11, color:'var(--text2)', marginBottom:4, display:'flex', gap:10, flexWrap:'wrap' }}>
                              <span><i className="ti ti-map-pin" style={{ fontSize:11, marginRight:3 }} />{ev.venue}</span>
                              <span><i className="ti ti-calendar" style={{ fontSize:11, marginRight:3 }} />{ev.start_date}</span>
                            </div>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                              <span className={`badge badge-blue`} style={{ fontSize:10 }}>{ev.sport}</span>
                              <span className={`badge`} style={{ fontSize:10, background:dotColor+'15', color:dotColor }}>{ev.status}</span>
                              {medals.map(r => (
                                <span key={r.id} style={{ fontSize:11 }}>
                                  {r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'} {r.discipline} — {r.result}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
            </div>

            {/* ── DOCUMENTS ── */}
            <div className="info-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div className="info-title" style={{ margin:0 }}>
                  Documents
                  <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>
                    {myDocs.length} file{myDocs.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* UPLOAD ROW — admins only */}
              {canEdit(profile) && (
                <div style={{ display:'flex', gap:8, marginBottom:16, padding:'10px 12px', background:'var(--surface2)', borderRadius:10, alignItems:'center' }}>
                  <select value={docType} onChange={e => setDocType(e.target.value)}
                    style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', fontSize:12, color:'var(--text)', outline:'none' }}>
                    {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <button onClick={() => docInput.current.click()} disabled={docUploading}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'#0085C7', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', flexShrink:0, fontFamily:'DM Sans, sans-serif' }}>
                    {docUploading
                      ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Uploading…</>
                      : <><i className="ti ti-upload" style={{ fontSize:14 }} />Upload</>
                    }
                  </button>
                  <input ref={docInput} type="file" style={{ display:'none' }}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={e => { if(e.target.files[0]) handleDocUpload(a.id, e.target.files[0]) }} />
                </div>
              )}

              {/* DOCUMENT LIST grouped by type */}
              {myDocs.length === 0
                ? <div className="empty" style={{ padding:'20px 0' }}>No documents uploaded yet.</div>
                : DOC_TYPES.map(type => {
                    const typeDocs = docsByType[type]
                    if (typeDocs.length === 0) return null
                    const color = DOC_COLORS[type]
                    const icon  = DOC_ICONS[type]
                    return (
                      <div key={type} style={{ marginBottom:14 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                          <i className={`ti ${icon}`} style={{ fontSize:13, color }} />
                          <span style={{ fontSize:11, fontWeight:600, color, textTransform:'uppercase', letterSpacing:'.05em' }}>{type}</span>
                        </div>
                        {typeDocs.map(doc => (
                          <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', background:'var(--surface2)', borderRadius:9, marginBottom:6, border:'1px solid var(--border)' }}>
                            <div style={{ width:34, height:34, borderRadius:8, background:color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <i className={`ti ${icon}`} style={{ fontSize:16, color }} />
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.name}</div>
                              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                                {formatFileSize(doc.file_size)} · {doc.uploaded_at?.slice(0,10)}
                              </div>
                            </div>
                            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                              <a href={doc.file_url} target="_blank" rel="noreferrer"
                                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text2)', textDecoration:'none', fontSize:14 }}
                                title="View / Download">
                                <i className="ti ti-external-link" />
                              </a>
                              {canEdit(profile) && (
                                <button onClick={() => setDocConfirm(doc)}
                                  style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626', cursor:'pointer' }}
                                  title="Delete">
                                  <i className="ti ti-trash" style={{ fontSize:14 }} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })
              }
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div>
      {form && <FormModal type="athlete" record={null} coaches={coaches} onSave={handleSave} onClose={() => setForm(null)} />}
      <div className="page-header">
        <div><div className="page-title">Athletes</div><div className="page-sub">{list.length} of {athletes.length} athletes</div></div>
        {canEdit(profile) && (
          <button className="btn btn-blue" onClick={() => setForm('new')}><i className="ti ti-plus" /> Add athlete</button>
        )}
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
          <thead><tr><th>Athlete</th><th>Sport</th><th>Class</th><th>Coach</th><th>Medals</th><th>Status</th><th>Docs</th><th /></tr></thead>
          <tbody>
            {list.map(a => {
              const docCount = (documents || []).filter(d => d.athlete_id === a.id).length
              return (
                <tr key={a.id} onClick={() => setSelected(a.id)}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      {a.photo_url
                        ? <img src={a.photo_url} alt={a.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                        : <Avatar name={a.name} id={a.id} />
                      }
                      <div>
                        <div style={{ fontWeight:500 }}>{a.name}</div>
                        <div style={{ fontSize:11, color:'#9aa3b2' }}>{a.nationality}</div>
                      </div>
                    </div>
                  </td>
                  <td>{a.sport}</td>
                  <td><span className="badge badge-blue">{a.classification}</span></td>
                  <td style={{ color:'#5a6272' }}>{coaches.find(c => c.id === a.coach_id)?.name || '—'}</td>
                  <td><MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} /></td>
                  <td><Badge label={a.status} /></td>
                  <td>
                    {docCount > 0
                      ? <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#0085C7', fontWeight:500 }}>
                          <i className="ti ti-files" style={{ fontSize:14 }} />{docCount}
                        </span>
                      : <span style={{ fontSize:12, color:'var(--text3)' }}>—</span>
                    }
                  </td>
                  <td><i className="ti ti-chevron-right" style={{ color:'#ccc', fontSize:16 }} /></td>
                </tr>
              )
            })}
            {list.length === 0 && <tr><td colSpan={8}><div className="empty">No athletes match</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
