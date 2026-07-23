import { useState, useEffect } from 'react'
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

// Compute live status from dates; only respect 'Canceled' if manually set
function getEventStatus(ev) {
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

export default function Events({ events, athletes, results, registrations, onRefresh, onNav, initEventId, initStatusFilter, profile, eventCategories = [] }) {
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

  useEffect(() => {
    if (initEventId)      setSelected(initEventId)
    if (initStatusFilter) setStatusF(initStatusFilter)
  }, [initEventId, initStatusFilter])

  const statuses = ['All', 'Planning', 'Upcoming', 'In Progress', 'Completed', 'Canceled']
  const statusLabelsAr = { All: 'الكل', Planning: 'قيد التخطيط', Upcoming: 'قادم', 'In Progress': 'جارٍ', Completed: 'مكتمل', Canceled: 'ملغى' }

  let list = events.filter(e => {
    const evStatus  = getEventStatus(e)
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
      name:             formData.name,
      name_ar:          formData.nameAr || null,
      category_id:      formData.categoryId ? parseInt(formData.categoryId) : null,
      sport:            formData.sport || null,
      venue:            formData.venue || null,
      start_date:       formData.startDate || null,
      end_date:         formData.endDate || null,
      deadline:         formData.deadline || null,
      status:           formData.status || 'Planning',
      approval_status:  formData.approvalStatus || 'TBC',
      max_participants: parseInt(formData.maxParticipants) || 30,
      notes:            formData.notes || null,
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

  if (selected) {
    const ev = events.find(x => x.id === selected)
    if (!ev) { setSelected(null); return null }
    const evStatus    = getEventStatus(ev)
    const regIds      = registrations.filter(r => r.event_id === ev.id).map(r => r.athlete_id)
    const regAthletes = athletes.filter(a => regIds.includes(a.id))
    const eligible    = athletes.filter(a => ev.sport && a.sport === ev.sport && !regIds.includes(a.id))
    const evResults   = results.filter(r => r.event_name === ev.name)
    const pct         = Math.round((regAthletes.length / ev.max_participants) * 100)
    const canReg      = ['Upcoming', 'In Progress', 'Planning'].includes(evStatus)

    const editRecord = {
      id: ev.id, name: ev.name, nameAr: ev.name_ar,
      categoryId: ev.category_id ? String(ev.category_id) : '',
      sport: ev.sport, venue: ev.venue,
      startDate: ev.start_date, endDate: ev.end_date,
      deadline: ev.deadline, status: ev.status,
      approvalStatus: ev.approval_status,
      maxParticipants: ev.max_participants,
      notes: ev.notes,
    }

    return (
      <div>
        {form && <FormModal type="event" record={form === 'edit' ? editRecord : null} onSave={handleSave} onClose={() => setForm(null)} eventCategories={eventCategories} />}
        {confirm && <ConfirmModal title={tx('confirm.deleteEvent', 'Delete event')} message={`Delete "${ev.name}"?`} onConfirm={() => handleDelete(ev.id, ev.name)} onCancel={() => setConfirm(null)} />}

        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> {tx('events.backToEvents', 'Back to events')}</button>
        {canEdit(profile) && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> {tx('actions.edit', 'Edit')}</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> {tx('actions.delete', 'Delete')}</button>
          </div>
        )}

        <div className="detail-grid">
          <div>
            <div className="detail-profile" style={{ textAlign: 'left' }}>
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

            <div className="info-card" style={{ marginTop: 12 }}>
              <div className="info-title">{tx('events.participants', 'Registration')}</div>
              <div style={{ display: 'flex', justifyContent: 'space-around', padding: '6px 0 12px' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 600, color: statusDot(evStatus) }}>{regAthletes.length}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{tx('events.registered', 'Registered')}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 600 }}>{ev.max_participants}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{tx('events.capacity', 'Capacity')}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 600 }}>{ev.max_participants - regAthletes.length}</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>{tx('events.spotsLeft', 'Spots left')}</div></div>
              </div>
              <div className="prog-bar" style={{ height: 7 }}><div className="prog-fill" style={{ width: `${pct}%`, background: statusDot(evStatus) }} /></div>
              <div className="prog-text" style={{ marginTop: 5 }}>{pct}% {tx('events.filled', 'filled')}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        const pct = Math.round((regCount / ev.max_participants) * 100)
        return (
          <div key={ev.id} className="event-card" onClick={() => setSelected(ev.id)}>
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
                <div className="prog-text">{regCount}/{ev.max_participants} {tx('events.registered', 'registered')}</div>
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
