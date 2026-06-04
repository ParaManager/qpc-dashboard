import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Avatar, MedalDisplay, Badge, avColor, initials, DashRow } from '../lib/helpers'
import FormModal from '../components/FormModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'

const DOC_TYPES  = [
  'Photo',
  'Passport',
  'Qatar ID',
  'Medical Certificate',
  'QSS Registration',
  'Medical Report',
  'QSS ID',
  'Birth Certificate',
  'QSRSN Membership',
  'Health Card',
  'MDF',
  'IPC Athlete Eligibility Agreement',
  'SDMS License',
  'Other',
]
const DOC_ICONS  = {
  'Photo':                          'ti-photo',
  'Passport':                       'ti-id',
  'Qatar ID':                       'ti-id-badge',
  'Medical Certificate':            'ti-heart-rate-monitor',
  'QSS Registration':               'ti-clipboard-list',
  'Medical Report':                 'ti-stethoscope',
  'QSS ID':                         'ti-id-badge-2',
  'Birth Certificate':              'ti-certificate',
  'QSRSN Membership':               'ti-users',
  'Health Card':                    'ti-heart',
  'MDF':                            'ti-file-description',
  'IPC Athlete Eligibility Agreement': 'ti-file-check',
  'SDMS License':                   'ti-license',
  'Other':                          'ti-file',
}
const DOC_COLORS = {
  'Photo':                          '#0085C7',
  'Passport':                       '#0085C7',
  'Qatar ID':                       '#009F6B',
  'Medical Certificate':            '#EE334E',
  'QSS Registration':               '#8b5cf6',
  'Medical Report':                 '#EE334E',
  'QSS ID':                         '#009F6B',
  'Birth Certificate':              '#e67e22',
  'QSRSN Membership':               '#8b5cf6',
  'Health Card':                    '#EE334E',
  'MDF':                            '#16a085',
  'IPC Athlete Eligibility Agreement': '#0085C7',
  'SDMS License':                   '#e67e22',
  'Other':                          '#9aa3b2',
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/(1024*1024)).toFixed(1)} MB`
}

function exportExcel(athletes, coaches, documents) {
  const rows = athletes.map(a => {
    const coach    = coaches.find(c => c.id === a.coach_id)
    const docCount = documents.filter(d => d.athlete_id === a.id).length
    const docTypes = [...new Set(documents.filter(d => d.athlete_id === a.id).map(d => d.type))].join(', ')
    return {
      'Full Name':           a.name,
      'Arabic Name':         a.name_ar || '',
      'Date of Birth':       a.dob || '',
      'Age':                 a.dob ? calcAge(a.dob) : '',
      'Gender':              a.gender || '',
      'Nationality':         a.nationality || '',
      'Sport':               a.sport || '',
      'Classification':      a.classification || '',
      'Disability Type':     a.disability || '',
      'Status':              a.status || '',
      'Coach':               coach?.name || '',
      'Gold Medals':         a.medals_gold || 0,
      'Silver Medals':       a.medals_silver || 0,
      'Bronze Medals':       a.medals_bronze || 0,
      'Total Medals':        (a.medals_gold || 0) + (a.medals_silver || 0) + (a.medals_bronze || 0),
      'Phone':               a.phone || '',
      'Email':               a.email || '',
      'Joined QPC':          a.join_date || '',
      'Years with QPC':      a.join_date ? calcYearsActive(a.join_date) : '',
      'Documents on File':   docCount,
      'Document Types':      docTypes,
      'Notes':               a.notes || '',
      'Passport Number':     a.passport_number || '',
      'Passport Expiry':     a.passport_expiry || '',
      'Qatar ID Number':     a.id_number || '',
      'ID Expiry':           a.id_expiry || '',
      'Emergency Contact':   a.emergency_contact_name || '',
      'Emergency Relation':  a.emergency_contact_relation || '',
      'Emergency Phone':     a.emergency_contact_phone || '',
      'Blood Type':          a.blood_type || '',
      'Allergies':           a.allergies || '',
      'Medical Conditions':  a.medical_conditions || '',
    }
  })

  const ws   = XLSX.utils.json_to_sheet(rows)
  const wb   = XLSX.utils.book_new()

  // column widths
  ws['!cols'] = [
    {wch:22},{wch:22},{wch:14},{wch:6},{wch:8},{wch:12},{wch:18},{wch:16},
    {wch:20},{wch:14},{wch:20},{wch:6},{wch:6},{wch:6},{wch:6},
    {wch:16},{wch:26},{wch:12},{wch:14},{wch:8},{wch:20},{wch:30},
    {wch:16},{wch:14},{wch:16},{wch:12},{wch:20},{wch:16},{wch:16},{wch:10},{wch:20},{wch:22},
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Athletes')

  const date = new Date().toISOString().slice(0,10)
  XLSX.writeFile(wb, `QPC_Athletes_${date}.xlsx`)
}

async function downloadDoc(url, athleteName, docType, originalName) {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    const ext  = originalName.split('.').pop()
    const filename = `${athleteName.replace(/\s+/g,'_')}_${docType.replace(/\s+/g,'_')}.${ext}`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  } catch (e) {
    window.open(url, '_blank')
  }
}

function calcAge(dob) {
  if (!dob) return null
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function calcYearsActive(joinDate) {
  if (!joinDate) return null
  const today = new Date()
  const joined = new Date(joinDate)
  const years = today.getFullYear() - joined.getFullYear()
  const months = today.getMonth() - joined.getMonth()
  const totalMonths = years * 12 + months
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y}y ${m}mo` : `${y} year${y !== 1 ? 's' : ''}`
}

function getPersonalBests(results) {
  const bests = {}
  results.forEach(r => {
    if (!r.discipline || !r.result) return
    if (!bests[r.discipline]) {
      bests[r.discipline] = r
    } else {
      // keep the one with better position, or gold over silver etc
      const medalRank = { gold: 1, silver: 2, bronze: 3, null: 4 }
      const cur = medalRank[bests[r.discipline].medal] || 4
      const next = medalRank[r.medal] || 4
      if (next < cur) bests[r.discipline] = r
    }
  })
  return Object.values(bests)
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
  const [notes, setNotes]           = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesChanged, setNotesChanged] = useState(false)
  const [editMode, setEditMode]     = useState(false)
  const [edits, setEdits]           = useState({})
  const [savingAll, setSavingAll]   = useState(false)
  const photoInput = useRef(null)
  const docInput   = useRef(null)

  useEffect(() => {
    if (initAthleteId)    setSelected(initAthleteId)
    if (initStatusFilter) setStatus(initStatusFilter)
  }, [initAthleteId, initStatusFilter])

  // sync notes when selected athlete changes
  useEffect(() => {
    if (selected) {
      const a = athletes.find(x => x.id === selected)
      setNotes(a?.notes || '')
      setNotesChanged(false)
    }
  }, [selected, athletes])

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
      passport_number: formData.passportNumber || null,
      passport_expiry: formData.passportExpiry || null,
      id_number: formData.idNumber || null,
      id_expiry: formData.idExpiry || null,
      emergency_contact_name: formData.emergencyName || null,
      emergency_contact_relation: formData.emergencyRelation || null,
      emergency_contact_phone: formData.emergencyPhone || null,
      blood_type: formData.bloodType || null,
      allergies: formData.allergies || null,
      medical_conditions: formData.medicalConditions || null,
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
      const ext  = file.name.split('.').pop()
      const path = `${athleteId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('athlete-documents').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('athlete-documents').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('athlete_documents').insert({
        athlete_id: athleteId, name: file.name, type: docType,
        file_url: data.publicUrl, file_path: path, file_size: file.size,
      })
      if (dbErr) throw dbErr
      toast(`${docType} uploaded!`); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setDocUploading(false); if (docInput.current) docInput.current.value = '' }
  }

  async function handleDocDelete(doc) {
    await supabase.storage.from('athlete-documents').remove([doc.file_path])
    const { error } = await supabase.from('athlete_documents').delete().eq('id', doc.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Document deleted'); setDocConfirm(null); await onRefresh()
  }

  async function saveNotes(athleteId) {
    setSavingNotes(true)
    const { error } = await supabase.from('athletes').update({ notes }).eq('id', athleteId)
    if (error) { toast(error.message, 'error') }
    else { toast('Notes saved'); setNotesChanged(false); await onRefresh() }
    setSavingNotes(false)
  }

  // ── PDF EXPORT ──
  function exportPDF(a, coach, myResults, myDocs, myEvents) {
    const age = calcAge(a.dob)
    const yearsActive = calcYearsActive(a.join_date)
    const bests = getPersonalBests(myResults)

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #1a1d23; padding: 32px; font-size: 13px; }
  .header { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 3px solid #0085C7; }
  .header-logo { display: flex; gap: 5px; }
  .dot { width: 14px; height: 14px; border-radius: 50%; }
  .header-text h1 { font-size: 20px; font-weight: 700; color: #0a1628; }
  .header-text p { font-size: 12px; color: #9aa3b2; margin-top: 2px; }
  .profile-header { display: flex; gap: 20px; margin-bottom: 24px; }
  .photo { width: 80px; height: 80px; border-radius: 50%; background: #0085C7; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 28px; font-weight: 700; flex-shrink: 0; overflow: hidden; }
  .photo img { width: 100%; height: 100%; object-fit: cover; }
  .profile-info h2 { font-size: 22px; font-weight: 700; }
  .profile-info p { font-size: 13px; color: #5a6272; margin-top: 3px; }
  .badges { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-blue { background: #e8f3fb; color: #1565a0; }
  .badge-green { background: #e6f4ee; color: #0d6e42; }
  .badge-gray { background: #f0f1f3; color: #555e70; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: 700; color: #9aa3b2; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e5ea; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  .field { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f1f3; font-size: 12px; }
  .field .k { color: #5a6272; }
  .field .v { font-weight: 600; }
  .medal-row { display: flex; gap: 24px; }
  .medal-item { text-align: center; }
  .medal-num { font-size: 24px; font-weight: 700; }
  .result-row { display: flex; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f1f3; font-size: 12px; }
  .timeline-item { display: flex; gap: 10px; margin-bottom: 10px; font-size: 12px; }
  .tl-dot { width: 10px; height: 10px; border-radius: 50%; background: #0085C7; margin-top: 3px; flex-shrink: 0; }
  .doc-row { padding: 6px 0; border-bottom: 1px solid #f0f1f3; font-size: 12px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e5ea; font-size: 10px; color: #9aa3b2; text-align: center; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="header">
  <div class="header-logo">
    <div class="dot" style="background:#EE334E"></div>
    <div class="dot" style="background:#0085C7"></div>
    <div class="dot" style="background:#009F6B"></div>
  </div>
  <div class="header-text">
    <h1>Qatar Paralympic Committee</h1>
    <p>Official Athlete Profile · Generated ${new Date().toLocaleDateString()}</p>
  </div>
</div>

<div class="profile-header">
  <div class="photo">${a.photo_url ? `<img src="${a.photo_url}" />` : initials(a.name)}</div>
  <div class="profile-info">
    <h2>${a.name}</h2>
    ${a.name_ar ? `<p>${a.name_ar}</p>` : ''}
    <div class="badges">
      <span class="badge badge-blue">${a.sport}</span>
      <span class="badge badge-blue">${a.classification}</span>
      <span class="badge badge-${a.status==='Active'?'green':'gray'}">${a.status}</span>
    </div>
    <p style="margin-top:8px;color:#9aa3b2;font-size:11px">
      ${age ? `Age ${age}` : ''} ${age && yearsActive ? '·' : ''} ${yearsActive ? `${yearsActive} with QPC` : ''}
    </p>
  </div>
</div>

<div class="section">
  <div class="section-title">Personal Information</div>
  <div class="grid-2">
    ${[['Date of birth',a.dob],['Gender',a.gender],['Nationality',a.nationality],['Phone',a.phone],['Email',a.email],['Joined QPC',a.join_date]].map(([k,v])=>`<div class="field"><span class="k">${k}</span><span class="v">${v||'—'}</span></div>`).join('')}
  </div>
</div>

<div class="section">
  <div class="section-title">Sport & Classification</div>
  <div class="grid-2">
    ${[['Sport',a.sport],['Classification',a.classification],['Disability type',a.disability],['Head coach',coach?.name||'Unassigned']].map(([k,v])=>`<div class="field"><span class="k">${k}</span><span class="v">${v||'—'}</span></div>`).join('')}
  </div>
</div>

${(a.passport_number || a.id_number) ? `<div class="section">
  <div class="section-title">Passport & ID</div>
  <div class="grid-2">
    ${[['Passport number',a.passport_number],['Passport expiry',a.passport_expiry],['Qatar ID number',a.id_number],['ID expiry',a.id_expiry]].filter(([k,v])=>v).map(([k,v])=>`<div class="field"><span class="k">${k}</span><span class="v" style="${v && new Date(v) < new Date() ? 'color:#dc2626' : ''}">${v}${v && new Date(v) < new Date() ? ' ⚠ EXPIRED' : ''}</span></div>`).join('')}
  </div>
</div>` : ''}

${(a.emergency_contact_name || a.emergency_contact_phone) ? `<div class="section">
  <div class="section-title">Emergency Contact</div>
  <div class="grid-2">
    ${[['Name',a.emergency_contact_name],['Relationship',a.emergency_contact_relation],['Phone',a.emergency_contact_phone]].filter(([k,v])=>v).map(([k,v])=>`<div class="field"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
  </div>
</div>` : ''}

${(a.blood_type || a.allergies || a.medical_conditions) ? `<div class="section">
  <div class="section-title">Medical Information</div>
  <div class="grid-2">
    ${[['Blood type',a.blood_type],['Allergies',a.allergies],['Medical conditions',a.medical_conditions]].filter(([k,v])=>v).map(([k,v])=>`<div class="field"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
  </div>
</div>` : ''}

<div class="section">
  <div class="section-title">Medal Count</div>
  <div class="medal-row">
    <div class="medal-item"><div class="medal-num" style="color:#f1c40f">${a.medals_gold||0}</div><div style="font-size:11px;color:#9aa3b2">Gold</div></div>
    <div class="medal-item"><div class="medal-num" style="color:#aaa">${a.medals_silver||0}</div><div style="font-size:11px;color:#9aa3b2">Silver</div></div>
    <div class="medal-item"><div class="medal-num" style="color:#cd7f32">${a.medals_bronze||0}</div><div style="font-size:11px;color:#9aa3b2">Bronze</div></div>
  </div>
</div>

${bests.length > 0 ? `<div class="section">
  <div class="section-title">Personal Bests</div>
  ${bests.map(r=>`<div class="result-row"><span>${r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':r.medal==='bronze'?'🥉':'📋'}</span><span style="flex:1;font-weight:600">${r.discipline}</span><span style="color:#0085C7;font-weight:600">${r.result}</span><span style="color:#9aa3b2;margin-left:10px">${r.event_name}</span></div>`).join('')}
</div>` : ''}

${myEvents.length > 0 ? `<div class="section">
  <div class="section-title">Competition History (${myEvents.length} events)</div>
  ${myEvents.map(ev=>{
    const evMedals = myResults.filter(r=>r.event_name===ev.name)
    return `<div class="timeline-item"><div class="tl-dot" style="background:${ev.status==='Completed'?'#009F6B':'#0085C7'}"></div><div><strong>${ev.name}</strong> · ${ev.start_date}<br/><span style="color:#5a6272">${ev.venue||''}</span>${evMedals.length>0?`<br/>${evMedals.map(r=>`${r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'} ${r.discipline} — ${r.result}`).join(' · ')}`:''}
    </div></div>`
  }).join('')}
</div>` : ''}

${myDocs.length > 0 ? `<div class="section">
  <div class="section-title">Documents on File</div>
  ${myDocs.map(d=>`<div class="doc-row">📄 ${d.name} <span style="color:#9aa3b2">(${d.type})</span></div>`).join('')}
</div>` : ''}

${a.notes ? `<div class="section">
  <div class="section-title">Notes</div>
  <p style="font-size:12px;color:#5a6272;line-height:1.6">${a.notes}</p>
</div>` : ''}

<div class="footer">Qatar Paralympic Committee · Confidential · ${new Date().getFullYear()}</div>
</body></html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  // ── DETAIL VIEW ──
  if (selected) {
    const a = athletes.find(x => x.id === selected)
    if (!a) { setSelected(null); return null }
    const coach      = coaches.find(c => c.id === a.coach_id)
    const myResults  = (results || []).filter(r => r.athlete_id === a.id)
    const myDocs     = (documents || []).filter(d => d.athlete_id === a.id)
    const myEventIds = (registrations || []).filter(r => r.athlete_id === a.id).map(r => r.event_id)
    const myEvents   = (events || []).filter(e => myEventIds.includes(e.id)).sort((a,b) => new Date(b.start_date) - new Date(a.start_date))
    const docsByType = DOC_TYPES.reduce((acc, t) => { acc[t] = myDocs.filter(d => d.type === t); return acc }, {})
    const bests      = getPersonalBests(myResults)
    const age        = calcAge(a.dob)
    const yearsActive = calcYearsActive(a.join_date)

    return (
      <div>
        {form && (
          <FormModal type="athlete"
            record={form==='edit' ? {
              id:a.id, name:a.name, nameAr:a.name_ar, dob:a.dob,
              gender:a.gender, nationality:a.nationality, sport:a.sport,
              classification:a.classification, disability:a.disability,
              coachId:a.coach_id, status:a.status, phone:a.phone,
              email:a.email, joinDate:a.join_date,
              passportNumber:a.passport_number, passportExpiry:a.passport_expiry,
              idNumber:a.id_number, idExpiry:a.id_expiry,
              emergencyName:a.emergency_contact_name,
              emergencyRelation:a.emergency_contact_relation,
              emergencyPhone:a.emergency_contact_phone,
              bloodType:a.blood_type, allergies:a.allergies,
              medicalConditions:a.medical_conditions,
            } : null}
            coaches={coaches} onSave={handleSave} onClose={() => setForm(null)} />
        )}
        {confirm && <ConfirmModal title="Delete athlete" message={`Delete ${a.name}? This cannot be undone.`} onConfirm={() => handleDelete(a.id, a.name)} onCancel={() => setConfirm(null)} />}
        {docConfirm && <ConfirmModal title="Delete document" message={`Delete "${docConfirm.name}"?`} onConfirm={() => handleDocDelete(docConfirm)} onCancel={() => setDocConfirm(null)} />}
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
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          {canEdit(profile) && <>
            <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> Edit</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> Delete</button>
          </>}
          <button className="action-btn action-btn-edit" onClick={() => exportPDF(a, coach, myResults, myDocs, myEvents)}
            style={{ borderColor:'#009F6B', color:'#009F6B' }}
            onMouseEnter={e => { e.currentTarget.style.background='#e6f4ee' }}
            onMouseLeave={e => { e.currentTarget.style.background='' }}>
            <i className="ti ti-printer" /> Export PDF
          </button>
        </div>

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
                      {uploading ? <div style={{ width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> : <i className="ti ti-camera" style={{ fontSize:12 }} />}
                    </button>
                    {a.photo_url && (
                      <button onClick={() => handlePhotoRemove(a.id)} title="Remove photo"
                        style={{ width:26, height:26, borderRadius:'50%', background:'#dc2626', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                        <i className="ti ti-x" style={{ fontSize:12 }} />
                      </button>
                    )}
                  </div>
                )}
                <input ref={photoInput} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { if(e.target.files[0]) handlePhotoUpload(a.id, e.target.files[0]) }} />
              </div>
              <div className="detail-name">{a.name}</div>
              {a.name_ar && <div className="detail-sub">{a.name_ar}</div>}
              <div className="detail-badges"><Badge label={a.status} /><span className="badge badge-blue">{a.sport}</span></div>

              {/* AGE & YEARS ACTIVE */}
              {(age || yearsActive) && (
                <div style={{ display:'flex', justifyContent:'center', gap:16, margin:'12px 0', padding:'10px', background:'var(--surface2)', borderRadius:10 }}>
                  {age && <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:600, color:'#0085C7' }}>{age}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>years old</div>
                  </div>}
                  {age && yearsActive && <div style={{ width:1, background:'var(--border)' }} />}
                  {yearsActive && <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:16, fontWeight:600, color:'#009F6B' }}>{yearsActive}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>with QPC</div>
                  </div>}
                </div>
              )}

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
                  <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:500 }}>{coach.name}</div><div style={{ fontSize:11, color:'#9aa3b2' }}>{coach.sport} · {coach.cert_level}</div></div>
                </DashRow>
              ) : <div style={{ padding:'8px 0', fontSize:13, color:'var(--text3)' }}>No coach assigned</div>}
            </div>

            {/* PASSPORT & ID */}
            {(a.passport_number || a.id_number) && (
              <div className="info-card">
                <div className="info-title">Passport & ID</div>
                {a.passport_number && (
                  <>
                    {[['Passport number', a.passport_number], ['Passport expiry', a.passport_expiry]].map(([k,v]) => (
                      <div key={k} className="detail-row">
                        <span className="dk">{k}</span>
                        <span className="dv" style={{ color: v && new Date(v) < new Date() ? '#dc2626' : 'inherit' }}>
                          {v || '—'}
                          {v && new Date(v) < new Date() && <span style={{ marginLeft:6, fontSize:10, color:'#dc2626' }}>EXPIRED</span>}
                        </span>
                      </div>
                    ))}
                  </>
                )}
                {a.id_number && (
                  <>
                    {[['Qatar ID number', a.id_number], ['ID expiry', a.id_expiry]].map(([k,v]) => (
                      <div key={k} className="detail-row">
                        <span className="dk">{k}</span>
                        <span className="dv" style={{ color: v && new Date(v) < new Date() ? '#dc2626' : 'inherit' }}>
                          {v || '—'}
                          {v && new Date(v) < new Date() && <span style={{ marginLeft:6, fontSize:10, color:'#dc2626' }}>EXPIRED</span>}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* EMERGENCY CONTACT */}
            {(a.emergency_contact_name || a.emergency_contact_phone) && (
              <div className="info-card">
                <div className="info-title">Emergency contact</div>
                {[
                  ['Name', a.emergency_contact_name],
                  ['Relationship', a.emergency_contact_relation],
                  ['Phone', a.emergency_contact_phone],
                ].map(([k,v]) => v ? (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
                ) : null)}
              </div>
            )}

            {/* MEDICAL INFO */}
            {(a.blood_type || a.allergies || a.medical_conditions) && (
              <div className="info-card">
                <div className="info-title" style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <i className="ti ti-heart-rate-monitor" style={{ fontSize:13, color:'#EE334E' }} />
                  Medical information
                </div>
                {[
                  ['Blood type', a.blood_type],
                  ['Allergies', a.allergies],
                  ['Medical conditions', a.medical_conditions],
                ].map(([k,v]) => v ? (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
                ) : null)}
              </div>
            )}

            {/* PERSONAL BESTS */}
            {bests.length > 0 && (
              <div className="info-card">
                <div className="info-title">Personal bests</div>
                {bests.map(r => (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':r.medal==='bronze'?'🥉':'📋'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{r.discipline}</div>
                      <div style={{ fontSize:11, color:'var(--text2)' }}>{r.event_name}</div>
                    </div>
                    <span style={{ fontSize:13, fontWeight:600, color:'#0085C7' }}>{r.result}</span>
                  </div>
                ))}
              </div>
            )}

            {/* COMPETITION HISTORY */}
            <div className="info-card">
              <div className="info-title" style={{ marginBottom:14 }}>
                Competition history
                <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>{myEvents.length} event{myEvents.length !== 1 ? 's' : ''}</span>
              </div>
              {myEvents.length === 0
                ? <div className="empty" style={{ padding:'16px 0' }}>Not registered in any events yet.</div>
                : <div style={{ position:'relative' }}>
                    <div style={{ position:'absolute', left:15, top:6, bottom:6, width:2, background:'var(--border)', borderRadius:2 }} />
                    {myEvents.map(ev => {
                      const evResults = (results||[]).filter(r => r.athlete_id === a.id && r.event_name === ev.name)
                      const medals    = evResults.filter(r => r.medal)
                      const dotColor  = ev.status==='Completed' ? medals.length>0 ? '#f1c40f' : '#009F6B' : ev.status==='Upcoming' ? '#0085C7' : ev.status==='Registration Open' ? '#8b5cf6' : '#9aa3b2'
                      return (
                        <div key={ev.id} style={{ display:'flex', gap:14, marginBottom:16, position:'relative' }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background:dotColor+'20', border:`2px solid ${dotColor}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1 }}>
                            {ev.status==='Completed' && medals.length>0
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
                              <span className="badge badge-blue" style={{ fontSize:10 }}>{ev.sport}</span>
                              <span className="badge" style={{ fontSize:10, background:dotColor+'15', color:dotColor }}>{ev.status}</span>
                              {medals.map(r => <span key={r.id} style={{ fontSize:11 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'} {r.discipline} — {r.result}</span>)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
            </div>

            {/* NOTES */}
            <div className="info-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div className="info-title" style={{ margin:0 }}>
                  Notes
                  <span style={{ marginLeft:6, fontSize:10, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>— private, visible to admins only</span>
                </div>
                {notesChanged && canEdit(profile) && (
                  <button onClick={() => saveNotes(a.id)} disabled={savingNotes}
                    style={{ padding:'4px 12px', background:'#0085C7', color:'#fff', border:'none', borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'DM Sans, sans-serif' }}>
                    {savingNotes ? 'Saving…' : <><i className="ti ti-device-floppy" style={{ fontSize:13 }} /> Save</>}
                  </button>
                )}
              </div>
              {canEdit(profile)
                ? <textarea
                    value={notes}
                    onChange={e => { setNotes(e.target.value); setNotesChanged(true) }}
                    placeholder="Add notes about this athlete — injury history, training observations, personal bests context…"
                    style={{ width:'100%', minHeight:100, padding:'10px 12px', borderRadius:9, border:'1px solid var(--border)', background:'var(--surface)', fontSize:13, color:'var(--text)', outline:'none', resize:'vertical', fontFamily:'DM Sans, sans-serif', lineHeight:1.6, transition:'border .15s' }}
                    onFocus={e => e.target.style.borderColor='#0085C7'}
                    onBlur={e => e.target.style.borderColor='var(--border)'}
                  />
                : a.notes
                  ? <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{a.notes}</p>
                  : <div style={{ fontSize:13, color:'var(--text3)', fontStyle:'italic' }}>No notes added yet.</div>
              }
            </div>

            {/* DOCUMENTS */}
            <div className="info-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div className="info-title" style={{ margin:0 }}>Documents <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>{myDocs.length} file{myDocs.length !== 1 ? 's' : ''}</span></div>
              </div>
              {canEdit(profile) && (
                <div style={{ display:'flex', gap:8, marginBottom:16, padding:'10px 12px', background:'var(--surface2)', borderRadius:10, alignItems:'center' }}>
                  <select value={docType} onChange={e => setDocType(e.target.value)}
                    style={{ flex:1, padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', fontSize:12, color:'var(--text)', outline:'none' }}>
                    {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <button onClick={() => docInput.current.click()} disabled={docUploading}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'#0085C7', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', flexShrink:0, fontFamily:'DM Sans, sans-serif' }}>
                    {docUploading ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Uploading…</> : <><i className="ti ti-upload" style={{ fontSize:14 }} />Upload</>}
                  </button>
                  <input ref={docInput} type="file" style={{ display:'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => { if(e.target.files[0]) handleDocUpload(a.id, e.target.files[0]) }} />
                </div>
              )}
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
                              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{formatFileSize(doc.file_size)} · {doc.uploaded_at?.slice(0,10)}</div>
                            </div>
                            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                              <button
                                onClick={() => downloadDoc(doc.file_url, a.name, doc.type, doc.name)}
                                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text2)', cursor:'pointer', fontSize:14 }} title="Download">
                                <i className="ti ti-download" />
                              </button>
                              {canEdit(profile) && (
                                <button onClick={() => setDocConfirm(doc)}
                                  style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626', cursor:'pointer' }} title="Delete">
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
  function startEdit() { setEditMode(true); setEdits({}) }
  function cancelEdit() { setEditMode(false); setEdits({}) }
  function setEdit(id, field, value) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }
  function getVal(a, field) {
    return edits[a.id]?.[field] !== undefined ? edits[a.id][field] : a[field]
  }

  async function saveAllEdits() {
    const changed = Object.entries(edits)
    if (changed.length === 0) { setEditMode(false); return }
    setSavingAll(true)
    try {
      await Promise.all(changed.map(([id, fields]) =>
        supabase.from('athletes').update(fields).eq('id', parseInt(id))
      ))
      toast(`${changed.length} athlete${changed.length > 1 ? 's' : ''} updated`)
      setEditMode(false)
      setEdits({})
      await onRefresh()
    } catch (err) {
      toast('Save failed: ' + err.message, 'error')
    } finally {
      setSavingAll(false)
    }
  }

  const changedCount = Object.keys(edits).length
  const inlineInput = { padding:'5px 8px', borderRadius:7, border:'1px solid var(--border)', fontSize:12, background:'var(--surface)', color:'var(--text)', outline:'none', width:'100%', fontFamily:'DM Sans, sans-serif' }
  const inlineSelect = { ...inlineInput, cursor:'pointer' }

  return (
    <div>
      {form && <FormModal type="athlete" record={null} coaches={coaches} onSave={handleSave} onClose={() => setForm(null)} />}
      <div className="page-header">
        <div><div className="page-title">Athletes</div><div className="page-sub">{list.length} of {athletes.length} athletes</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {!editMode && (
            <button className="btn" style={{ background:'#009F6B' }} onClick={() => exportExcel(list, coaches, documents || [])}>
              <i className="ti ti-table-export" /> Export Excel
            </button>
          )}
          {canEdit(profile) && !editMode && (
            <button className="action-btn action-btn-edit" style={{ padding:'8px 14px', fontSize:13 }} onClick={startEdit}>
              <i className="ti ti-table-options" /> Edit list
            </button>
          )}
          {editMode && (
            <>
              <button className="btn-cancel" onClick={cancelEdit} style={{ padding:'8px 14px' }}>
                Cancel
              </button>
              <button className="btn btn-blue" onClick={saveAllEdits} disabled={savingAll}>
                {savingAll
                  ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> Saving…</>
                  : <><i className="ti ti-device-floppy" /> Save {changedCount > 0 ? `${changedCount} change${changedCount > 1 ? 's' : ''}` : 'all'}</>
                }
              </button>
            </>
          )}
          {canEdit(profile) && !editMode && (
            <button className="btn btn-blue" onClick={() => setForm('new')}><i className="ti ti-plus" /> Add athlete</button>
          )}
        </div>
      </div>

      {editMode && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#e8f3fb', border:'1px solid #bdd8f0', borderRadius:10, marginBottom:14, fontSize:13 }}>
          <i className="ti ti-pencil" style={{ color:'#0085C7', fontSize:16 }} />
          <span style={{ color:'#1565a0' }}>
            <strong>Edit mode on</strong> — click any cell to edit. Changes are saved together when you click Save.
          </span>
          {changedCount > 0 && (
            <span style={{ marginLeft:'auto', background:'#0085C7', color:'#fff', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>
              {changedCount} unsaved change{changedCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder="Search by name, sport…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="filter" value={sport} onChange={e => setSport(e.target.value)}>{sports.map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={status} onChange={e => setStatus(e.target.value)}>{['All statuses','Active','Inactive','Suspended','Under Medical Review','Injured','Retired'].map(s => <option key={s}>{s}</option>)}</select>
        <select className="filter" value={gender} onChange={e => setGender(e.target.value)}>{['All genders','Male','Female'].map(s => <option key={s}>{s}</option>)}</select>
        {!editMode && (
          <select className="filter" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="name-asc">Name A→Z</option><option value="name-desc">Name Z→A</option>
            <option value="medals-desc">Most medals</option><option value="gold-desc">Most gold</option>
            <option value="join-desc">Newest members</option><option value="join-asc">Oldest members</option>
          </select>
        )}
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Athlete</th>
              <th>Sport</th>
              <th>Classification</th>
              <th>Nationality</th>
              <th>Coach</th>
              <th>Status</th>
              {!editMode && <th>Medals</th>}
              {!editMode && <th>Docs</th>}
              {!editMode && <th />}
              {editMode && <th style={{ color:'#0085C7' }}>Changed</th>}
            </tr>
          </thead>
          <tbody>
            {list.map(a => {
              const docCount  = (documents || []).filter(d => d.athlete_id === a.id).length
              const isChanged = !!edits[a.id]
              return (
                <tr key={a.id}
                  onClick={() => !editMode && setSelected(a.id)}
                  style={{ cursor: editMode ? 'default' : 'pointer', background: isChanged ? '#f0f7ff' : '' }}>

                  {/* NAME — always show, editable in edit mode */}
                  <td>
                    {editMode ? (
                      <input style={{ ...inlineInput, minWidth:140 }}
                        value={getVal(a,'name')}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEdit(a.id, 'name', e.target.value)} />
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        {a.photo_url ? <img src={a.photo_url} alt={a.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} /> : <Avatar name={a.name} id={a.id} />}
                        <div><div style={{ fontWeight:500 }}>{a.name}</div><div style={{ fontSize:11, color:'#9aa3b2' }}>{a.nationality}</div></div>
                      </div>
                    )}
                  </td>

                  {/* SPORT */}
                  <td>
                    {editMode ? (
                      <select style={inlineSelect} value={getVal(a,'sport')} onClick={e => e.stopPropagation()} onChange={e => setEdit(a.id,'sport',e.target.value)}>
                        {['Athletics','Swimming','Powerlifting','Boccia','Shooting','Wheelchair Tennis'].map(s => <option key={s}>{s}</option>)}
                      </select>
                    ) : a.sport}
                  </td>

                  {/* CLASSIFICATION */}
                  <td>
                    {editMode ? (
                      <input style={{ ...inlineInput, width:100 }} value={getVal(a,'classification') || ''} onClick={e => e.stopPropagation()} onChange={e => setEdit(a.id,'classification',e.target.value)} />
                    ) : <span className="badge badge-blue">{a.classification}</span>}
                  </td>

                  {/* NATIONALITY */}
                  <td>
                    {editMode ? (
                      <input style={{ ...inlineInput, width:100 }} value={getVal(a,'nationality') || ''} onClick={e => e.stopPropagation()} onChange={e => setEdit(a.id,'nationality',e.target.value)} />
                    ) : <span style={{ color:'#5a6272' }}>{a.nationality}</span>}
                  </td>

                  {/* COACH */}
                  <td>
                    {editMode ? (
                      <select style={inlineSelect} value={getVal(a,'coach_id') || ''} onClick={e => e.stopPropagation()} onChange={e => setEdit(a.id,'coach_id', e.target.value ? parseInt(e.target.value) : null)}>
                        <option value="">Unassigned</option>
                        {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : <span style={{ color:'#5a6272' }}>{coaches.find(c => c.id === a.coach_id)?.name || '—'}</span>}
                  </td>

                  {/* STATUS */}
                  <td>
                    {editMode ? (
                      <select style={inlineSelect} value={getVal(a,'status')} onClick={e => e.stopPropagation()} onChange={e => setEdit(a.id,'status',e.target.value)}>
                        {['','Active','Inactive','Suspended','Under Medical Review','Injured','Retired'].map(s => <option key={s} value={s}>{s || '— None —'}</option>)}
                      </select>
                    ) : <Badge label={a.status} />}
                  </td>

                  {/* VIEW MODE ONLY columns */}
                  {!editMode && <td><MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} /></td>}
                  {!editMode && <td>{docCount > 0 ? <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#0085C7', fontWeight:500 }}><i className="ti ti-files" style={{ fontSize:14 }} />{docCount}</span> : <span style={{ fontSize:12, color:'var(--text3)' }}>—</span>}</td>}
                  {!editMode && <td><i className="ti ti-chevron-right" style={{ color:'#ccc', fontSize:16 }} /></td>}

                  {/* EDIT MODE — changed indicator */}
                  {editMode && (
                    <td>
                      {isChanged
                        ? <span style={{ display:'flex', alignItems:'center', gap:4, color:'#0085C7', fontSize:12, fontWeight:500 }}><i className="ti ti-check" style={{ fontSize:14 }} />Modified</span>
                        : <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>
                      }
                    </td>
                  )}
                </tr>
              )
            })}
            {list.length === 0 && <tr><td colSpan={editMode ? 7 : 9}><div className="empty">No athletes match</div></td></tr>}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
