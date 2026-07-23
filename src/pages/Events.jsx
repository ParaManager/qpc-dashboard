import { useState, useEffect, useRef } from 'react'
import { Avatar, Badge, statusDot, DashRow } from '../lib/helpers'
import FormModal from '../components/FormModal'
import EventCategoryModal from '../components/EventCategoryModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'
import { isTrustedAdmin } from '../lib/permissions'
import { logAdminActivity } from '../lib/adminActivity'
import { useLang } from '../lib/LangContext.jsx'

const APPROVAL_COLORS = { Approved: '#009F6B', TBC: '#f59e0b', Rejected: '#dc2626' }

export function computeEventStatus(startDate, endDate, deadline) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = startDate ? new Date(startDate) : null
  const effectiveEnd = endDate ? new Date(endDate) : (start ? new Date(startDate) : null)
  const dead = deadline ? new Date(deadline) : null
  if (!start) return 'Planning'
  if (dead) {
    if (today <= dead) return 'Planning'
    if (today < start) return 'Upcoming'
  } else {
    if (today < start) return 'Upcoming'
  }
  if (effectiveEnd && today > effectiveEnd) return 'Completed'
  return 'In Progress'
}

function getEventStatus(ev) {
  if (ev.approval_status === 'Rejected') return 'Canceled'
  if (ev.status === 'Canceled') return 'Canceled'
  return computeEventStatus(ev.start_date, ev.end_date, ev.deadline)
}

function CatBadge({ catId, eventCategories, lang }) {
  const cat = eventCategories?.find(c => c.id === catId)
  if (!cat) return null
  const label = lang === 'ar' && cat.name_ar ? cat.name_ar : cat.name
  return (
    <span style={{ background: cat.color + '20', color: cat.color, border: `1px solid ${cat.color}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <i className={`ti ${cat.icon}`} style={{ fontSize: 11 }} />{label}
    </span>
  )
}

function ApprovalBadge({ status, lang }) {
  const color = APPROVAL_COLORS[status] || '#64748b'
  const label = lang === 'ar'
    ? ({ Approved: 'معتمد', TBC: 'تحت المراجعة', Rejected: 'مرفوض' }[status] || status)
    : status
  return (
    <span style={{ background: color + '20', color, border: `1px solid ${color}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      {label}
    </span>
  )
}

function OfficialsPicker({ roleKey, title, officials, employees, eventId, canEditMode, canAdd, ar, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false)
  const [pick, setPick] = useState('')
  const assigned = officials[roleKey] || []
  const available = employees.filter(e => !assigned.find(o => o.employee_id === e.id))
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 28 }}>
        {assigned.length === 0 && !adding && (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{ar ? 'لا يوجد موظفون معينون' : 'No employees assigned'}</span>
        )}
        {assigned.map(o => {
          const emp = employees.find(e => e.id === o.employee_id)
          if (!emp) return null
          return (
            <span key={o.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px 3px 8px', fontSize: 12 }}>
              <Avatar name={emp.name} id={emp.id} size={18} fs={7} />
              {ar && emp.name_ar ? emp.name_ar : emp.name}
              {canEditMode && (
                <button onClick={() => onRemove(o.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '0 0 0 2px', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center' }}>×</button>
              )}
            </span>
          )
        })}
        {canAdd && canEditMode && (
          adding ? (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={pick} onChange={e => setPick(e.target.value)}
                style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface1)', color: 'var(--text1)', maxWidth: 220 }}>
                <option value="">{ar ? '— اختر موظفاً —' : '— Select employee —'}</option>
                {available.map(e => <option key={e.id} value={e.id}>{ar && e.name_ar ? e.name_ar : e.name}</option>)}
              </select>
              <button onClick={async () => { if (pick) { await onAdd(eventId, parseInt(pick), roleKey); setPick(''); setAdding(false) } }}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: '#0085C7', color: '#fff', border: 'none', cursor: 'pointer' }}>
                {ar ? 'إضافة' : 'Add'}
              </button>
              <button onClick={() => { setAdding(false); setPick('') }}
                style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#0085C7', color: '#fff', border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
              <i className="ti ti-plus" style={{ fontSize: 11 }} />{ar ? 'إضافة' : 'Add'}
            </button>
          )
        )}
      </div>
    </div>
  )
}

export default function Events({ events, athletes, results, registrations, onRefresh, onNav, initEventId, initStatusFilter, profile, eventCategories = [], employees = [] }) {
  const { lang, tx } = useLang()
  const ar = lang === 'ar'
  const [search, setSearch]       = useState('')
  const [categoryF, setCategoryF] = useState('all')
  const [approvalF, setApprovalF] = useState('all')
  const [statusF, setStatusF]     = useState(initStatusFilter || 'All')
  const [sort, setSort]           = useState('date-asc')
  const [selected, setSelected]   = useState(initEventId || null)
  const [form, setForm]           = useState(null)
  const [confirm, setConfirm]     = useState(null)
  const [showCatModal, setShowCatModal] = useState(false)
  const [officials, setOfficials] = useState({ head_of_delegation: [], medical_staff: [], coach: [], administrative_staff: [] })
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoInputRef = useRef(null)

  useEffect(() => {
    if (initEventId)      setSelected(initEventId)
    if (initStatusFilter) setStatusF(initStatusFilter)
  }, [initEventId, initStatusFilter])

  useEffect(() => {
    if (!selected) return
    loadOfficials(selected)
  }, [selected])

  async function loadOfficials(eventId) {
    const { data } = await supabase.from('event_officials').select('id, employee_id, role').eq('event_id', eventId)
    if (!data) return
    const grouped = { head_of_delegation: [], medical_staff: [], coach: [], administrative_staff: [] }
    for (const row of data) { if (grouped[row.role]) grouped[row.role].push(row) }
    setOfficials(grouped)
  }

  async function addOfficial(eventId, employeeId, role) {
    const { error } = await supabase.from('event_officials').insert({ event_id: eventId, employee_id: employeeId, role })
    if (error) { toast(error.message, 'error'); return }
    await loadOfficials(eventId)
  }

  async function removeOfficial(officialId) {
    const { error } = await supabase.from('event_officials').delete().eq('id', officialId)
    if (error) { toast(error.message, 'error'); return }
    await loadOfficials(selected)
  }

  async function handlePhotoUpload(eventId, file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    setPhotoUploading(true)
    try {
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${eventId}.${ext}`
      await supabase.storage.from('event-photos').remove([
        `${eventId}.jpg`, `${eventId}.jpeg`, `${eventId}.png`, `${eventId}.webp`
      ])
      const { error: upErr } = await supabase.storage.from('event-photos').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('event-photos').getPublicUrl(path)
      const photoUrl = data.publicUrl + '?t=' + Date.now()
      const { error: dbErr } = await supabase.from('events').update({ photo_url: photoUrl }).eq('id', eventId)
      if (dbErr) throw dbErr
      toast(ar ? 'تم تحديث الصورة' : 'Photo updated'); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setPhotoUploading(false); if (photoInputRef.current) photoInputRef.current.value = '' }
  }

  async function handlePhotoRemove(eventId) {
    const { error } = await supabase.from('events').update({ photo_url: null }).eq('id', eventId)
    if (error) { toast(error.message, 'error'); return }
    toast(ar ? 'تم حذف الصورة' : 'Photo removed'); await onRefresh()
  }

  const statuses = ['All', 'Planning', 'Upcoming', 'In Progress', 'Completed', 'Canceled']
  const statusLabelsAr = { All: 'الكل', Planning: 'قيد التخطيط', Upcoming: 'قادم', 'In Progress': 'جارٍ', Completed: 'مكتمل', Canceled: 'ملغى' }

  let list = events.filter(e => {
    const evStatus      = getEventStatus(e)
    const matchStatus   = statusF === 'All' || evStatus === statusF
    const matchCategory = categoryF === 'all' || String(e.category_id) === categoryF
    const matchApproval = approvalF === 'all' || e.approval_status === approvalF
    const matchSearch   = e.name.toLowerCase().includes(search.toLowerCase())
      || (e.name_ar || '').includes(search)
      || (e.venue || '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchCategory && matchApproval && matchSearch
  })

  list = [...list].sort((a, b) => {
    if (sort === 'date-asc')          return new Date(a.start_date) - new Date(b.start_date)
    if (sort === 'date-desc')         return new Date(b.start_date) - new Date(a.start_date)
    if (sort === 'name-asc')          return a.name.localeCompare(b.name)
    if (sort === 'participants-desc') return registrations.filter(r => r.event_id === b.id).length - registrations.filter(r => r.event_id === a.id).length
    return 0
  })

  async function handleSave(formData) {
    const isEdit = !!formData.id
    const payload = {
      name:            formData.name,
      name_ar:         formData.nameAr || null,
      category_id:     formData.categoryId ? parseInt(formData.categoryId) : null,
      sport:           formData.sport || null,
      venue:           formData.venue || null,
      start_date:      formData.startDate || null,
      end_date:        formData.endDate || null,
      deadline:        formData.deadline || null,
      status:          formData.status || 'Planning',
      approval_status: formData.approvalStatus || 'TBC',
      notes:           formData.notes || null,
    }
    if (!payload.name) { toast(tx('form.nameRequired', 'Event name required'), 'error'); return }
    const { error } = isEdit
      ? await supabase.from('events').update(payload).eq('id', formData.id)
      : await supabase.from('events').insert(payload)
    if (error) { toast(error.message, 'error'); return }
    toast(isEdit ? `${payload.name} updated` : `${payload.name} created`)
    if (isTrustedAdmin(profile)) {
      logAdminActivity({ actor: profile, action: isEdit ? 'updated' : 'created', entityType: 'event', entityId: formData.id || null, entityLabel: payload.name, module: 'events' })
    }
    setForm(null); await onRefresh()
    if (isEdit) setSelected(formData.id)
  }

  async function handleDelete(id, name) {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} deleted`)
    if (isTrustedAdmin(profile)) {
      logAdminActivity({ actor: profile, action: 'deleted', entityType: 'event', entityId: id, entityLabel: name, module: 'events' })
    }
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

  // ── DETAIL VIEW ──
  if (selected) {
    const ev = events.find(x => x.id === selected)
    if (!ev) { setSelected(null); return null }
    const evStatus           = getEventStatus(ev)
    const regIds             = registrations.filter(r => r.event_id === ev.id).map(r => r.athlete_id)
    const regAthletes        = athletes.filter(a => regIds.includes(a.id))
    const eligible           = athletes.filter(a => ev.sport && a.sport === ev.sport && !regIds.includes(a.id))
    const evResults          = results.filter(r => r.event_name === ev.name)
    const canReg             = ['Upcoming', 'In Progress', 'Planning'].includes(evStatus)
    const canManageOfficials = ['Planning', 'Upcoming'].includes(evStatus)
    const canEditProfile     = canEdit(profile)

    const editRecord = {
      id: ev.id, name: ev.name, nameAr: ev.name_ar,
      categoryId: ev.category_id ? String(ev.category_id) : '',
      sport: ev.sport, venue: ev.venue,
      startDate: ev.start_date, endDate: ev.end_date,
      deadline: ev.deadline, status: ev.status,
      approvalStatus: ev.approval_status,
      notes: ev.notes,
    }

    const ROLE_TITLES = {
      head_of_delegation:   ar ? 'رئيس الوفد'    : 'Head of Delegation',
      medical_staff:        ar ? 'الجهاز الطبي'   : 'Medical Staff',
      coach:                ar ? 'المدربون'        : 'Coaches',
      administrative_staff: ar ? 'الجهاز الإداري' : 'Administrative Staff',
    }

    const pickerProps = { officials, employees, eventId: ev.id, canEditMode: canEditProfile, canAdd: canManageOfficials, ar, onAdd: addOfficial, onRemove: removeOfficial }

    return (
      <div>
        {form && <FormModal type="event" record={form === 'edit' ? editRecord : null} onSave={handleSave} onClose={() => setForm(null)} eventCategories={eventCategories} />}
        {confirm && <ConfirmModal title={tx('confirm.deleteEvent', 'Delete event')} message={`Delete "${ev.name}"?`} onConfirm={() => handleDelete(ev.id, ev.name)} onCancel={() => setConfirm(null)} />}

        {/* Hidden photo input */}
        <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) handlePhotoUpload(ev.id, e.target.files[0]) }} />

        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> {tx('events.backToEvents', 'Back to events')}</button>
        {canEditProfile && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> {tx('actions.edit', 'Edit')}</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> {tx('actions.delete', 'Delete')}</button>
          </div>
        )}

        <div className="detail-grid">
          {/* Left column — event info */}
          <div>
            <div className="detail-profile" style={{ textAlign: 'left', padding: 0, overflow: 'hidden' }}>

              {/* Event photo */}
              <div style={{ position: 'relative', width: '100%', height: ev.photo_url ? 180 : (canEditProfile ? 110 : 0), background: ev.photo_url ? 'transparent' : 'var(--surface2)', borderRadius: ev.photo_url ? '12px 12px 0 0' : 12, overflow: 'hidden', marginBottom: ev.photo_url ? 0 : (canEditProfile ? 12 : 0), cursor: canEditProfile ? 'pointer' : 'default', flexShrink: 0 }}
                onClick={() => canEditProfile && photoInputRef.current?.click()}>
                {ev.photo_url ? (
                  <img src={ev.photo_url} alt={ev.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : canEditProfile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 6, color: 'var(--text3)' }}>
                    <i className="ti ti-photo" style={{ fontSize: 28 }} />
                    <span style={{ fontSize: 12 }}>{ar ? 'انقر لإضافة صورة' : 'Click to add a photo'}</span>
                  </div>
                ) : null}

                {/* Overlay controls when photo exists */}
                {ev.photo_url && canEditProfile && (
                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); photoInputRef.current?.click() }}
                      style={{ background: 'rgba(0,0,0,.55)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      disabled={photoUploading}>
                      <i className="ti ti-camera" style={{ fontSize: 12 }} />{ar ? 'تغيير' : 'Change'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); handlePhotoRemove(ev.id) }}
                      style={{ background: 'rgba(220,38,38,.7)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                      <i className="ti ti-trash" style={{ fontSize: 12 }} />
                    </button>
                  </div>
                )}
                {photoUploading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontSize: 13 }}>{ar ? 'جارٍ الرفع…' : 'Uploading…'}</span>
                  </div>
                )}
              </div>

              {/* Event info below photo */}
              <div style={{ padding: '16px 20px 20px' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                  <CatBadge catId={ev.category_id} eventCategories={eventCategories} lang={lang} />
                  <Badge label={evStatus} />
                  <ApprovalBadge status={ev.approval_status} lang={lang} />
                </div>
                <div className="detail-name">{ev.name}</div>
                {ev.name_ar && <div style={{ fontSize: 14, color: 'var(--text2)', marginTop: 4, direction: 'rtl' }}>{ev.name_ar}</div>}
                <div className="detail-fields" style={{ marginTop: 16 }}>
                  {[
                    [tx('events.venue',     'Venue'),      ev.venue],
                    [tx('events.startDate', 'Start date'), ev.start_date],
                    [tx('events.endDate',   'End date'),   ev.end_date],
                    [tx('events.deadline',  'Deadline'),   ev.deadline],
                    [tx('events.sport',     'Sport'),      ev.sport],
                    [tx('events.notes',     'Notes'),      ev.notes],
                  ].map(([k, v]) => v ? (
                    <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
                  ) : null)}
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Registered athletes */}
            <div className="info-card">
              <div className="info-title">{tx('events.registeredAthletes', 'Registered athletes')} ({regAthletes.length}) <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— {tx('athletes.clickToView', 'click to view')}</span></div>
              {regAthletes.map(a => (
                <DashRow key={a.id} onClick={() => onNav('athletes', { athleteId: a.id })}>
                  <Avatar name={a.name} id={a.id} size={30} fs={10} />
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.classification}</div></div>
                  <Badge label={a.status} />
                  {canReg && <button onClick={e => { e.stopPropagation(); unregisterAthlete(ev.id, a.id) }} style={{ background: 'none', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✕</button>}
                </DashRow>
              ))}
              {regAthletes.length === 0 && <div className="empty" style={{ padding: 12 }}>{tx('events.noAthletes', 'No athletes registered')}</div>}
              {canReg && eligible.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{tx('events.registerAthlete', 'Register an athlete')}</div>
                  {eligible.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <Avatar name={a.name} id={a.id} size={28} fs={9} />
                      <div style={{ flex: 1 }}><div style={{ fontSize: 13 }}>{a.name}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.classification}</div></div>
                      <button onClick={() => registerAthlete(ev.id, a.id)} style={{ background: '#0085C7', color: '#fff', border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>+ {tx('actions.register', 'Register')}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Team Officials */}
            <div className="info-card">
              <div className="info-title">{ar ? 'المسؤولون الرسميون' : 'Team Officials'}</div>
              <OfficialsPicker roleKey="head_of_delegation" title={ROLE_TITLES.head_of_delegation} {...pickerProps} />
              <OfficialsPicker roleKey="medical_staff"      title={ROLE_TITLES.medical_staff}      {...pickerProps} />
            </div>

            {/* Technical Officials */}
            <div className="info-card">
              <div className="info-title">{ar ? 'المسؤولون التقنيون' : 'Technical Officials'}</div>
              <OfficialsPicker roleKey="coach"                title={ROLE_TITLES.coach}                {...pickerProps} />
              <OfficialsPicker roleKey="administrative_staff" title={ROLE_TITLES.administrative_staff} {...pickerProps} />
            </div>

            {/* Results */}
            <div className="info-card">
              <div className="info-title">{tx('events.results', 'Results')} ({evResults.length})</div>
              {evResults.length === 0
                ? <div className="empty" style={{ padding: 16 }}>{tx('events.noResults', 'No results recorded')}</div>
                : evResults.map(r => {
                    const a = athletes.find(x => x.id === r.athlete_id)
                    return (
                      <DashRow key={r.id} onClick={() => a && onNav('athletes', { athleteId: a.id })}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{r.medal === 'gold' ? '🥇' : r.medal === 'silver' ? '🥈' : '🥉'}</span>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{r.athlete_name}</div><div style={{ fontSize: 11, color: 'var(--text2)' }}>{r.discipline}</div></div>
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

  // ── LIST VIEW ──
  return (
    <div>
      {form && <FormModal type="event" record={null} onSave={handleSave} onClose={() => setForm(null)} eventCategories={eventCategories} />}
      {showCatModal && <EventCategoryModal categories={eventCategories} onClose={() => setShowCatModal(false)} onRefresh={onRefresh} />}

      <div className="page-header">
        <div>
          <div className="page-title">{tx('pages.events', 'Events')}</div>
          <div className="page-sub">{list.length} {tx('events.ofEvents', 'of')} {events.length} {tx('pages.events', 'events')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isTrustedAdmin(profile) && (
            <button className="btn" style={{ background: 'var(--surface2)', color: 'var(--text1)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowCatModal(true)}>
              <i className="ti ti-tag" /> {ar ? 'التصنيفات' : 'Categories'}
            </button>
          )}
          {canEdit(profile) && (
            <button className="btn btn-red" onClick={() => setForm('new')}><i className="ti ti-plus" /> {tx('events.addEvent', 'New event')}</button>
          )}
        </div>
      </div>

      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder={tx('events.searchEvents', 'Search events…')} value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="filter" value={categoryF} onChange={e => setCategoryF(e.target.value)}>
          <option value="all">{ar ? 'جميع التصنيفات' : 'All categories'}</option>
          {eventCategories.filter(c => c.is_active).map(c => (
            <option key={c.id} value={String(c.id)}>{ar && c.name_ar ? c.name_ar : c.name}</option>
          ))}
        </select>
        <select className="filter" value={approvalF} onChange={e => setApprovalF(e.target.value)}>
          <option value="all">{ar ? 'جميع حالات الموافقة' : 'All approvals'}</option>
          {['Approved', 'TBC', 'Rejected'].map(s => (
            <option key={s} value={s}>{ar ? { Approved: 'معتمد', TBC: 'تحت المراجعة', Rejected: 'مرفوض' }[s] : s}</option>
          ))}
        </select>
        <select className="filter" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="date-asc">{tx('filters.dateSoonest', 'Date (soonest)')}</option>
          <option value="date-desc">{tx('filters.dateLatest', 'Date (latest)')}</option>
          <option value="name-asc">{tx('filters.nameAZ', 'Name A→Z')}</option>
          <option value="participants-desc">{tx('filters.mostParticipants', 'Most participants')}</option>
        </select>
      </div>

      <div className="pill-filters">
        {statuses.map(s => (
          <button key={s} className={`pill${s === statusF ? ' active' : ''}`} onClick={() => setStatusF(s)}>
            {ar ? (statusLabelsAr[s] || s) : s}
          </button>
        ))}
      </div>

      {list.map(ev => {
        const evStatus = getEventStatus(ev)
        const regCount = registrations.filter(r => r.event_id === ev.id).length
        const maxPart  = ev.max_participants || 30
        const pct      = Math.round((regCount / maxPart) * 100)
        return (
          <div key={ev.id} className="event-card" onClick={() => setSelected(ev.id)} style={{ overflow: 'hidden' }}>
            {ev.photo_url && (
              <div style={{ height: 100, overflow: 'hidden', margin: '-1px -1px 0', borderRadius: '12px 12px 0 0' }}>
                <img src={ev.photo_url} alt={ev.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}
            <div className="event-top">
              <div>
                <div className="event-name">{ev.name}</div>
                <div className="event-meta">
                  {ev.venue && <span><i className="ti ti-map-pin" />{ev.venue}</span>}
                  <span><i className="ti ti-calendar" />{ev.start_date}{ev.end_date && ev.end_date !== ev.start_date ? ` → ${ev.end_date}` : ''}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <CatBadge catId={ev.category_id} eventCategories={eventCategories} lang={lang} />
                <Badge label={evStatus} />
                <ApprovalBadge status={ev.approval_status} lang={lang} />
                <i className="ti ti-chevron-right" style={{ color: '#ccc', fontSize: 16, marginLeft: 4 }} />
              </div>
            </div>
            <div className="event-bottom">
              <div className="prog-wrap">
                <div className="prog-label">{tx('events.participants', 'Participants')}</div>
                <div className="prog-bar"><div className="prog-fill" style={{ width: `${pct}%`, background: statusDot(evStatus) }} /></div>
                <div className="prog-text">{regCount}/{maxPart} {tx('events.registered', 'registered')}</div>
              </div>
              {ev.sport && <div><div className="prog-label">{tx('events.sport', 'Sport')}</div><span className="badge badge-blue">{ev.sport}</span></div>}
            </div>
          </div>
        )
      })}
      {list.length === 0 && <div className="empty">{tx('events.noEvents', 'No events match')}</div>}
    </div>
  )
}
