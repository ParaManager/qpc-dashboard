import { useState, useEffect } from 'react'
import MultiSelectFilter from '../components/MultiSelectFilter.jsx'
import { Avatar, Badge, statusDot, statusClass, DashRow, sportLabel } from '../lib/helpers'
import FormModal from '../components/FormModal'
import EventCategoryModal from '../components/EventCategoryModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'
import { isTrustedAdmin } from '../lib/permissions'
import { logAdminActivity } from '../lib/adminActivity'
import { useLang } from '../lib/LangContext.jsx'

const APPROVAL_COLORS = { Approved: '#009F6B', TBC: '#f59e0b', Rejected: '#dc2626' }

// Maps English status value → translation key suffix under `events.*`
const STATUS_TX = {
  Planning:     'planning',
  Upcoming:     'upcoming',
  'In Progress':'inProgress',
  Completed:    'completed',
  Canceled:     'canceled',
}

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

// Category badge — uses name_ar from DB via tx-agnostic prop
function CatBadge({ catId, eventCategories, lang }) {
  const cat = eventCategories?.find(c => c.id === catId)
  if (!cat) return null
  const label = lang === 'ar' && cat.name_ar ? cat.name_ar : cat.name
  return (
    <span style={{ background: cat.color + '20', color: cat.color, border: `1px solid ${cat.color}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <i className={`ti ${cat.icon}`} style={{ fontSize: 11 }} />{label}
    </span>
  )
}

// Approval badge — uses tx() for labels
function ApprovalBadge({ status, tx }) {
  const color = APPROVAL_COLORS[status] || '#64748b'
  const labelMap = { Approved: tx('events.approved', 'Approved'), TBC: tx('events.tbc', 'TBC'), Rejected: tx('events.rejected', 'Rejected') }
  return (
    <span style={{ background: color + '20', color, border: `1px solid ${color}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {labelMap[status] || status}
    </span>
  )
}

// Status badge — English value drives CSS class; tx() drives display label
function StatusBadge({ status, tx }) {
  const key = STATUS_TX[status]
  const label = key ? tx(`events.${key}`, status) : status
  return <span className={`badge ${statusClass(status)}`}>{label}</span>
}

function PersonRow({ name, nameAr, id, subtitle, subtitleAr, status, ar, canRemove, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <Avatar name={name} id={id} size={30} fs={10} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{ar && nameAr ? nameAr : name}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{ar && subtitleAr ? subtitleAr : subtitle}</div>}
      </div>
      {status && <Badge label={status} />}
      {canRemove && (
        <button onClick={onRemove} style={{ background: 'none', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✕</button>
      )}
    </div>
  )
}

function OfficialsPicker({ roleKey, title, officials, employees, eventId, canEditMode, canAdd, ar, tx, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false)
  const [pick, setPick]     = useState('')
  const assigned  = officials[roleKey] || []
  const available = employees.filter(e => !assigned.find(o => o.employee_id === e.id))
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{title}</div>
      {assigned.length === 0 && (
        <div className="empty" style={{ padding: '8px 0', fontSize: 12 }}>{tx('events.noEmployeesAssigned', 'No employees assigned')}</div>
      )}
      {assigned.map(o => {
        const emp = employees.find(e => e.id === o.employee_id)
        if (!emp) return null
        return (
          <PersonRow
            key={o.id}
            name={emp.name} nameAr={emp.name_ar}
            id={emp.id}
            subtitle={emp.designation || null} subtitleAr={emp.designation_ar || null}
            status={emp.status || null}
            ar={ar}
            canRemove={canEditMode}
            onRemove={() => onRemove(o.id)}
          />
        )
      })}
      {canAdd && canEditMode && (
        <div style={{ marginTop: 8 }}>
          {adding ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={pick} onChange={e => setPick(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface1)', color: 'var(--text1)', flex: 1, minWidth: 0 }}>
                <option value="">— {tx('events.selectEmployee', 'Select employee')} —</option>
                {available.map(e => <option key={e.id} value={e.id}>{ar && e.name_ar ? e.name_ar : e.name}</option>)}
              </select>
              <button
                onClick={async () => { if (pick) { await onAdd(eventId, parseInt(pick), roleKey); setPick(''); setAdding(false) } }}
                style={{ background: '#0085C7', color: '#fff', border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                {tx('actions.add', 'Add')}
              </button>
              <button onClick={() => { setAdding(false); setPick('') }} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ background: '#0085C7', color: '#fff', border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-plus" style={{ fontSize: 11 }} />{tx('actions.add', 'Add')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}



export default function Events({ events, athletes, results, registrations, onRefresh, onNav, initEventId, initStatusFilter, profile, eventCategories = [], employees = [], sportsList = [] }) {
  const { lang, tx } = useLang()
  const ar = lang === 'ar'

  // Bridges an athlete's (sport, sport_category) pair to the event's
  // selected canonical sport names. Most athletes get an exact match via
  // sportLabel (e.g. sport='Athletics' + category='Summer Paralympic' ->
  // 'Para Athletics'). Special Olympics athletes in this system are only
  // ever tagged with the generic 'Special Olympics' catch-all (no specific
  // discipline is tracked per athlete yet), so they're treated as eligible
  // for ANY selected Special Olympics sport, not just an exact-name match.
  function athleteMatchesSports(a, sportNames) {
    if (!sportNames.length) return false
    const label = sportLabel(a.sport, a.sport_category, false)
    if (sportNames.includes(label)) return true
    if (a.sport === 'Special Olympics') {
      return sportNames.some(name => {
        const s = sportsList.find(sp => sp.name === name)
        return s && (s.category === 'Summer Special Olympics' || s.category === 'Winter Special Olympics')
      })
    }
    return false
  }

  const [search, setSearch]       = useState('')
  const [categoryF, setCategoryF] = useState([])
  const [approvalF, setApprovalF] = useState([])
  const [sportF, setSportF]       = useState([])
  const [statusF, setStatusF]     = useState(initStatusFilter || 'All')
  const [sort, setSort]           = useState('date-asc')
  const [selected, setSelected]   = useState(initEventId || null)
  const [form, setForm]           = useState(null)
  const [confirm, setConfirm]     = useState(null)
  const [showCatModal, setShowCatModal] = useState(false)
  const [officials, setOfficials] = useState({ head_of_delegation: [], medical_staff: [], coach: [], administrative_staff: [] })
  const [athleteSearch, setAthleteSearch] = useState('')

  useEffect(() => {
    if (initEventId)      setSelected(initEventId)
    if (initStatusFilter) setStatusF(initStatusFilter)
  }, [initEventId, initStatusFilter])

  useEffect(() => {
    if (!selected) return
    loadOfficials(selected)
  }, [selected])

  // Clear the eligible-athletes search whenever a different event is opened
  // (or the detail view is left) so it never carries over stale text.
  useEffect(() => { setAthleteSearch('') }, [selected])

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

  const statuses = ['All', 'Planning', 'Upcoming', 'In Progress', 'Completed', 'Canceled']
  const filterSportOptions = [...new Set(events.flatMap(e => e.sports?.length ? e.sports : (e.sport ? [e.sport] : [])))].sort()
  const hasActiveFilters = !!search || categoryF.length > 0 || approvalF.length > 0 || sportF.length > 0 || statusF !== 'All'
  function clearFilters() { setSearch(''); setCategoryF([]); setApprovalF([]); setSportF([]); setStatusF('All') }

  function pillLabel(s) {
    if (s === 'All') return tx('filters.all', 'All')
    const key = STATUS_TX[s]
    return key ? tx(`events.${key}`, s) : s
  }

  let list = events.filter(e => {
    const evStatus      = getEventStatus(e)
    const matchStatus   = statusF === 'All' || evStatus === statusF
    const matchCategory = categoryF.length === 0 || categoryF.includes(String(e.category_id))
    const matchApproval = approvalF.length === 0 || approvalF.includes(e.approval_status)
    const eSports        = e.sports?.length ? e.sports : (e.sport ? [e.sport] : [])
    const matchSport     = sportF.length === 0 || eSports.some(s => sportF.includes(s))
    const matchSearch   = e.name.toLowerCase().includes(search.toLowerCase())
      || (e.name_ar || '').includes(search)
      || (e.venue || '').toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchCategory && matchApproval && matchSport && matchSearch
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
    // formData.sports is now an array of sports.id (never names) — see
    // EventSportSelect, which is keyed by id precisely so visually similar
    // sports (Para Athletics vs SO Athletics) can never be conflated.
    const selectedSportIds = (Array.isArray(formData.sports) ? formData.sports : []).filter(Boolean)
    const selectedSportNames = selectedSportIds.map(id => sportsList.find(s => s.id === id)?.name).filter(Boolean)
    const payload = {
      name:            formData.name,
      name_ar:         formData.nameAr || null,
      category_id:     formData.categoryId ? parseInt(formData.categoryId) : null,
      // Kept in sync to the first selected sport's name purely for backward
      // compatibility with any read site not yet updated to `sports[]` —
      // event_sports (below), keyed by id, is the real source of truth now.
      sport:           selectedSportNames[0] || null,
      venue:           formData.venue || null,
      start_date:      formData.startDate || null,
      end_date:        formData.endDate || null,
      deadline:        formData.deadline || null,
      status:          formData.status || 'Planning',
      approval_status: formData.approvalStatus || 'TBC',
      notes:           formData.notes || null,
    }
    if (!payload.name) { toast(tx('form.nameRequired', 'Event name required'), 'error'); return }
    if (selectedSportIds.length === 0) { toast(tx('events.sportRequired', 'Select at least one sport'), 'error'); return }

    let eventId = formData.id
    if (isEdit) {
      const { error } = await supabase.from('events').update(payload).eq('id', eventId)
      if (error) { toast(error.message, 'error'); return }
    } else {
      const { data, error } = await supabase.from('events').insert(payload).select().single()
      if (error) { toast(error.message, 'error'); return }
      eventId = data.id
    }

    // Sync event_sports: remove all, re-insert current selection (same
    // simple pattern used for meeting attendees) — stores sport_id directly,
    // never duplicating the sport data itself.
    const { error: delErr } = await supabase.from('event_sports').delete().eq('event_id', eventId)
    if (delErr) { toast(delErr.message, 'error'); return }
    const { error: insErr } = await supabase.from('event_sports')
      .insert(selectedSportIds.map(sportId => ({ event_id: eventId, sport_id: sportId })))
    if (insErr) { toast(insErr.message, 'error'); return }

    toast(isEdit ? `${payload.name} updated` : `${payload.name} created`)
    if (isTrustedAdmin(profile)) {
      logAdminActivity({ actor: profile, action: isEdit ? 'updated' : 'created', entityType: 'event', entityId: eventId || null, entityLabel: payload.name, module: 'events' })
    }
    setForm(null); await onRefresh()
    if (isEdit) setSelected(eventId)
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
    const evSports           = ev.sports?.length ? ev.sports : (ev.sport ? [ev.sport] : [])
    const regIds             = registrations.filter(r => r.event_id === ev.id).map(r => r.athlete_id)
    const regAthletes        = athletes.filter(a => regIds.includes(a.id))
    // Union of athletes across every selected sport, deduplicated by id.
    // No sport selected → no eligible athletes (clear empty state below).
    const eligible           = evSports.length === 0 ? [] : athletes.filter(a => athleteMatchesSports(a, evSports) && !regIds.includes(a.id))
    const filteredEligible    = athleteSearch.trim()
      ? eligible.filter(a => {
          const q = athleteSearch.toLowerCase()
          return a.name.toLowerCase().includes(q)
            || (a.name_ar || '').includes(athleteSearch)
            || (a.sport || '').toLowerCase().includes(q)
            || sportLabel(a.sport, a.sport_category, false).toLowerCase().includes(q)
        })
      : eligible
    const evResults          = results.filter(r => r.event_name === ev.name)
    const canReg             = ['Upcoming', 'In Progress', 'Planning'].includes(evStatus)
    const canManageOfficials = ['Planning', 'Upcoming'].includes(evStatus)
    const canEditProfile     = canEdit(profile)

    const editRecord = {
      id: ev.id, name: ev.name, nameAr: ev.name_ar,
      categoryId: ev.category_id ? String(ev.category_id) : '',
      sports: ev.sportIds?.length ? ev.sportIds : evSports.map(name => sportsList.find(s => s.name === name)?.id).filter(Boolean), venue: ev.venue,
      startDate: ev.start_date, endDate: ev.end_date,
      deadline: ev.deadline, status: ev.status,
      approvalStatus: ev.approval_status,
      notes: ev.notes,
    }

    const ROLE_TITLES = {
      head_of_delegation:   tx('events.headOfDelegation',   'Head of Delegation'),
      medical_staff:        tx('events.medicalStaff',       'Medical Staff'),
      coach:                tx('events.coaches',             'Coaches'),
      administrative_staff: tx('events.administrativeStaff','Administrative Staff'),
    }

    const pickerProps = {
      officials, employees, eventId: ev.id,
      canEditMode: canEditProfile,
      canAdd: canManageOfficials,
      ar, tx,
      onAdd: addOfficial,
      onRemove: removeOfficial,
    }

    return (
      <div>
        {form && <FormModal type="event" record={form === 'edit' ? editRecord : null} onSave={handleSave} onClose={() => setForm(null)} eventCategories={eventCategories} sportsList={sportsList} />}
        {confirm && <ConfirmModal title={tx('confirm.deleteEvent', 'Delete event')} message={`Delete "${ev.name}"?`} onConfirm={() => handleDelete(ev.id, ev.name)} onCancel={() => setConfirm(null)} />}

        <button className="back-btn" onClick={() => setSelected(null)}>
          <i className="ti ti-arrow-left" /> {tx('events.backToEvents', 'Back to events')}
        </button>

        {canEditProfile && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> {tx('actions.edit', 'Edit')}</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> {tx('actions.delete', 'Delete')}</button>
          </div>
        )}

        <div className="detail-grid">
          {/* Left column */}
          <div>
            <div className="detail-profile">
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                <CatBadge catId={ev.category_id} eventCategories={eventCategories} lang={lang} />
                <StatusBadge status={evStatus} tx={tx} />
                <ApprovalBadge status={ev.approval_status} tx={tx} />
              </div>
              <div className="detail-name">{ev.name}</div>
              {ev.name_ar && <div style={{ fontSize: 14, color: 'var(--text2)', marginTop: 4, direction: 'rtl' }}>{ev.name_ar}</div>}
              {evSports.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                  {evSports.map(s => (
                    <span key={s} style={{ background: '#0085C718', color: '#0085C7', border: '1px solid #0085C740', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
                <div className="detail-fields" style={{ marginTop: 16 }}>
                  {[
                    [tx('events.venue',     'Venue'),      ev.venue],
                    [tx('events.startDate', 'Start date'), ev.start_date],
                    [tx('events.endDate',   'End date'),   ev.end_date],
                    [tx('events.deadline',  'Deadline'),   ev.deadline],
                    [tx('events.notes',     'Notes'),      ev.notes],
                  ].map(([k, v]) => v ? <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div> : null)}
                </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Registered Athletes */}
            <div className="info-card">
              <div className="info-title">
                {tx('events.registeredAthletes', 'Registered athletes')} ({regAthletes.length})
                <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — {tx('events.clickToView', 'click to view')}</span>
              </div>
              {regAthletes.map(a => {
                const stillEligible = evSports.length === 0 || athleteMatchesSports(a, evSports)
                return (
                  <DashRow key={a.id} onClick={() => onNav('athletes', { athleteId: a.id })}>
                    <Avatar name={a.name} id={a.id} size={30} fs={10} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{ar && a.name_ar ? a.name_ar : a.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 1 }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{a.classification}</span>
                        {a.sport && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: '#0085C718', color: '#0085C7', whiteSpace: 'nowrap' }}>
                            {sportLabel(a.sport, a.sport_category, ar)}
                          </span>
                        )}
                      </div>
                      {!stillEligible && (
                        <div style={{ fontSize: 10.5, color: '#dc2626', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <i className="ti ti-alert-triangle" style={{ fontSize: 11 }} />
                          {tx('events.notInSelectedSports', 'Not in a selected sport')}
                        </div>
                      )}
                    </div>
                    <Badge label={a.status} />
                    {canReg && (
                      <button onClick={e => { e.stopPropagation(); unregisterAthlete(ev.id, a.id) }}
                        style={{ background: 'none', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                    )}
                  </DashRow>
                )
              })}
              {regAthletes.length === 0 && <div className="empty" style={{ padding: 12 }}>{tx('events.noAthletes', 'No athletes registered')}</div>}
              {canReg && eligible.length === 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>
                  {evSports.length === 0
                    ? tx('events.selectSportForEligible', 'Select a sport for this event to see eligible athletes')
                    : tx('events.noEligibleAthletes', 'No eligible athletes for the selected sports')}
                </div>
              )}
              {canReg && eligible.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
                    {tx('events.registerAthlete', 'Register an athlete')}
                  </div>
                  <div className="search-wrap" style={{ marginBottom: 8 }}>
                    <i className="ti ti-search" />
                    <input
                      placeholder={tx('events.searchEligible', 'Search by name or sport…')}
                      value={athleteSearch}
                      onChange={e => setAthleteSearch(e.target.value)}
                    />
                  </div>
                  {filteredEligible.length === 0 && (
                    <div className="empty" style={{ padding: 12 }}>{tx('events.noSearchMatches', 'No athletes match your search')}</div>
                  )}
                  {filteredEligible.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <Avatar name={a.name} id={a.id} size={28} fs={9} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13 }}>{ar && a.name_ar ? a.name_ar : a.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 1 }}>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{a.classification}</span>
                          {a.sport && (
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: '#0085C718', color: '#0085C7', whiteSpace: 'nowrap' }}>
                              {sportLabel(a.sport, a.sport_category, ar)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => registerAthlete(ev.id, a.id)}
                        style={{ background: '#0085C7', color: '#fff', border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                        + {tx('actions.register', 'Register')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Officials — single card with all four roles */}
            <div className="info-card">
              <div className="info-title">{tx('events.officials', 'Officials')}</div>
              <OfficialsPicker roleKey="head_of_delegation"   title={ROLE_TITLES.head_of_delegation}   {...pickerProps} />
              <OfficialsPicker roleKey="medical_staff"        title={ROLE_TITLES.medical_staff}        {...pickerProps} />
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
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'}</span>
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
      <style>{`
        .ev-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 4px; }
        @media (max-width: 1100px) { .ev-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .ev-grid { grid-template-columns: 1fr; } }
        .ev-gc { background: var(--surface1); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; cursor: pointer; transition: box-shadow .15s, transform .15s; display: flex; flex-direction: column; outline: none; }
        .ev-gc:hover { box-shadow: 0 4px 18px rgba(0,0,0,.10); transform: translateY(-2px); }
        .ev-gc:focus-visible { box-shadow: 0 0 0 3px #0085C740; }
        .ev-gc-body { padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .ev-gc-title { font-size: 14px; font-weight: 600; color: var(--text1); line-height: 1.35; word-break: break-word; }
        .ev-gc-meta-row { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text3); }
        .ev-gc-meta-row i { font-size: 12px; flex-shrink: 0; }
        .ev-gc-footer { display: flex; align-items: center; gap: 6px; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--border); font-size: 11px; color: var(--text3); }
      `}</style>

      {form && <FormModal type="event" record={null} onSave={handleSave} onClose={() => setForm(null)} eventCategories={eventCategories} sportsList={sportsList} />}
      {showCatModal && <EventCategoryModal categories={eventCategories} onClose={() => setShowCatModal(false)} onRefresh={onRefresh} />}

      <div className="page-header">
        <div>
          <div className="page-title">{tx('pages.events', 'Events')}</div>
          <div className="page-sub">{list.length} {tx('events.ofEvents', 'of')} {events.length} {tx('pages.events', 'events')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isTrustedAdmin(profile) && (
            <button className="btn" style={{ background: 'var(--surface2)', color: 'var(--text1)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowCatModal(true)}>
              <i className="ti ti-tag" /> {tx('events.manageCategories', 'Categories')}
            </button>
          )}
          {canEdit(profile) && (
            <button className="btn btn-red" onClick={() => setForm('new')}>
              <i className="ti ti-plus" /> {tx('events.addEvent', 'New event')}
            </button>
          )}
        </div>
      </div>

      <div className="filters">
        <div className="search-wrap">
          <i className="ti ti-search" />
          <input placeholder={tx('events.searchEvents', 'Search events…')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <MultiSelectFilter
          options={eventCategories.filter(c => c.is_active).map(c => ({ value: String(c.id), label: ar && c.name_ar ? c.name_ar : c.name }))}
          selected={categoryF}
          onChange={setCategoryF}
          allLabel={tx('events.allCategories', 'All categories')}
          style={{ minWidth: 160 }}
        />
        <MultiSelectFilter
          options={[
            { value: 'Approved', label: tx('events.approved', 'Approved') },
            { value: 'TBC',      label: tx('events.tbc', 'TBC') },
            { value: 'Rejected', label: tx('events.rejected', 'Rejected') },
          ]}
          selected={approvalF}
          onChange={setApprovalF}
          allLabel={tx('events.allApprovals', 'All approvals')}
          style={{ minWidth: 160 }}
        />
        <MultiSelectFilter
          options={filterSportOptions.map(s => ({ value: s, label: s }))}
          selected={sportF}
          onChange={setSportF}
          allLabel={tx('events.allSports', 'All sports')}
          style={{ minWidth: 160 }}
        />
        <select className="filter" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="date-asc">{tx('filters.dateAsc', 'Date ↑')}</option>
          <option value="date-desc">{tx('filters.dateDesc', 'Date ↓')}</option>
          <option value="name-asc">{tx('filters.nameAZ', 'Name A→Z')}</option>
          <option value="participants-desc">{tx('filters.mostParticipants', 'Most participants')}</option>
        </select>
        {hasActiveFilters && (
          <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 9, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <i className="ti ti-x" style={{ fontSize: 13 }} /> {tx('actions.resetFilters', 'Reset filters')}
          </button>
        )}
      </div>

      <div className="pill-filters">
        {statuses.map(s => (
          <button key={s} className={`pill${s === statusF ? ' active' : ''}`} onClick={() => setStatusF(s)}>
            {pillLabel(s)}
          </button>
        ))}
      </div>

      {list.length === 0 && <div className="empty">{tx('events.noEvents', 'No events match')}</div>}

      <div className="ev-grid">
        {list.map(ev => {
          const evStatus = getEventStatus(ev)
          const regCount = registrations.filter(r => r.event_id === ev.id).length
          return (
            <div
              key={ev.id}
              className="ev-gc"
              onClick={() => setSelected(ev.id)}
              onKeyDown={e => e.key === 'Enter' && setSelected(ev.id)}
              tabIndex={0}
              role="button"
              aria-label={ev.name}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '12px 12px 0' }}>
                <CatBadge catId={ev.category_id} eventCategories={eventCategories} lang={lang} />
                <StatusBadge status={evStatus} tx={tx} />
                <ApprovalBadge status={ev.approval_status} tx={tx} />
              </div>

              <div className="ev-gc-body">
                <div className="ev-gc-title">{ar && ev.name_ar ? ev.name_ar : ev.name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {ev.venue && (
                    <div className="ev-gc-meta-row">
                      <i className="ti ti-map-pin" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.venue}</span>
                    </div>
                  )}
                  {ev.start_date && (
                    <div className="ev-gc-meta-row">
                      <i className="ti ti-calendar" />
                      <span>{ev.start_date}{ev.end_date && ev.end_date !== ev.start_date ? ` → ${ev.end_date}` : ''}</span>
                    </div>
                  )}
                  {(ev.sports?.length ? ev.sports : (ev.sport ? [ev.sport] : [])).length > 0 && (
                    <div className="ev-gc-meta-row">
                      <i className="ti ti-trophy" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(ev.sports?.length ? ev.sports : [ev.sport]).join(', ')}</span>
                    </div>
                  )}
                </div>
                <div className="ev-gc-footer">
                  <i className="ti ti-users" style={{ fontSize: 12 }} />
                  <span>{regCount} {tx('events.registered', 'registered')}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
