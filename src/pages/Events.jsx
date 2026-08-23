import { useState, useEffect, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import MultiSelectFilter from '../components/MultiSelectFilter.jsx'
import { Avatar, Badge, statusDot, statusClass, DashRow, sportLabel, buildSearchText, matchesSearch, BackButton, loadImageAsDataURL, safeAddImage, initials as personInitials } from '../lib/helpers'
import FormModal from '../components/FormModal'
import EventCategoryModal from '../components/EventCategoryModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'
import { isTrustedAdmin, canViewAthleteDetails } from '../lib/permissions'
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

// ── Event PDF export ─────────────────────────────────────────────────────
// Same QPC-branding conventions used by the Athletes list export (logo,
// maroon header/accent, Amiri font loaded only when Arabic text is
// actually needed) — a portrait single-event report rather than a big
// data table: letterhead, event details, then the athletes/officials the
// user chose to include. A Special Olympics event instead gets the same
// Special Olympics logo/red theme already used on the dedicated Special
// Olympics page's own PDF export — every other Paralympic event keeps the
// standard QPC template unchanged.
const QPC_MAROON = [87, 25, 50]
const SO_RED = [211, 47, 47]

// Same membership convention already used elsewhere (SpecialOlympics.jsx,
// Events.jsx's own athleteMatchesSports) — the legacy flat 'Special
// Olympics' sport tag, or either Special Olympics sport_category value.
function isSpecialOlympicsEvent(ev) {
  const evSports = ev.sports?.length ? ev.sports : (ev.sport ? [ev.sport] : [])
  return evSports.includes('Special Olympics')
    || ev.sport_category === 'Summer Special Olympics'
    || ev.sport_category === 'Winter Special Olympics'
}

async function exportEventPDF(ev, selectedAthletes, includeOfficials, officialsByRole, roleTitles, employees, lang) {
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en
  const isSO = isSpecialOlympicsEvent(ev)
  const THEME = isSO ? SO_RED : QPC_MAROON
  const logoPath = isSO ? '/logo-so.png' : '/logo-qpc.png'
  const orgName = isSO ? L('Special Olympics Qatar', 'الأولمبياد الخاص القطري') : L('Qatar Paralympic Committee', 'اللجنة البارالمبية القطرية')

  const [logoDataUrl] = await Promise.all([
    loadImageAsDataURL(logoPath),
  ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const needsArabicFont = ar
  let arabicFontOk = false
  if (needsArabicFont) {
    try {
      const { AMIRI_REGULAR_BASE64 } = await import('../lib/fonts/AmiriFont')
      doc.addFileToVFS('Amiri-Regular.ttf', AMIRI_REGULAR_BASE64)
      doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal')
      doc.addFont('Amiri-Regular.ttf', 'Amiri', 'bold')
      arabicFontOk = true
    } catch (err) {
      console.error('Event PDF export: Arabic font failed to load, falling back to Helvetica', err)
    }
  }
  const FONT = (ar && arabicFontOk) ? 'Amiri' : 'helvetica'
  const setPdfFont = style => doc.setFont(FONT, style)
  const safeStr = s => (s === null || s === undefined) ? '' : String(s)

  const evSports = ev.sports?.length ? ev.sports : (ev.sport ? [ev.sport] : [])
  const sportNames = evSports.map(s => sportLabel(s, ev.sport_category, ar)).join(ar ? '، ' : ', ')
  // jsPDF's built-in Helvetica has no glyph for "→" — it silently renders
  // as garbled characters (exactly what showed up in the exported PDF).
  // Use a plain ASCII separator instead, safe in every font.
  const dateRange = ev.start_date ? (ev.end_date && ev.end_date !== ev.start_date ? `${ev.start_date} - ${ev.end_date}` : ev.start_date) : ''

  let y = 40
  // Preserve the logo's real aspect ratio instead of forcing it into a
  // fixed square, which was stretching/distorting it.
  const LOGO_MAX_W = 52, LOGO_MAX_H = 46
  let logoW = 0, logoH = 0
  if (logoDataUrl) {
    try {
      const props = doc.getImageProperties(logoDataUrl)
      const ratio = Math.min(LOGO_MAX_W / props.width, LOGO_MAX_H / props.height)
      logoW = props.width * ratio
      logoH = props.height * ratio
    } catch { /* falls back to not drawing the logo */ }
  }
  safeAddImage(doc, logoDataUrl, 40, y, logoW, logoH)
  setPdfFont('bold')
  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text(safeStr(orgName), pageWidth / 2, y + 16, { align: 'center' })
  setPdfFont('normal')
  doc.setFontSize(9)
  doc.setTextColor(110, 110, 110)
  doc.text(safeStr(L('Event Report', 'تقرير الفعالية')), pageWidth / 2, y + 30, { align: 'center' })
  y += 58
  doc.setDrawColor(...THEME)
  doc.setLineWidth(1.2)
  doc.line(40, y, pageWidth - 40, y)
  y += 26

  // Event title (EN + AR when available)
  setPdfFont('bold')
  doc.setTextColor(...THEME)
  doc.setFontSize(16)
  doc.text(safeStr(ev.name), 40, y)
  y += 20
  if (ev.name_ar) {
    doc.setFontSize(13)
    doc.text(safeStr(ev.name_ar), pageWidth - 40, y, { align: 'right' })
    y += 18
  }
  y += 6

  // Details block — dates, location, sports
  const details = [
    [L('Dates', 'التواريخ'), dateRange],
    [L('Location', 'الموقع'), ev.venue],
    [L('Sport(s)', 'الرياضة/الرياضات'), sportNames],
  ].filter(([, v]) => v)
  setPdfFont('normal')
  doc.setFontSize(10.5)
  doc.setTextColor(40, 40, 40)
  for (const [label, value] of details) {
    setPdfFont('bold')
    doc.text(safeStr(`${label}:`), 40, y)
    setPdfFont('normal')
    doc.text(safeStr(value), 40 + doc.getTextWidth(safeStr(`${label}: `)) + 4, y)
    y += 16
  }
  y += 10

  // Athletes table
  if (selectedAthletes.length > 0) {
    setPdfFont('bold')
    doc.setFontSize(12)
    doc.setTextColor(...THEME)
    doc.text(safeStr(L(`Athletes (${selectedAthletes.length})`, `الرياضيون (${selectedAthletes.length})`)), 40, y)
    y += 10

    const head = [[L('Name', 'الاسم'), L('Sport', 'الرياضة'), L('Classification', 'التصنيف'), L('Nationality', 'الجنسية')]]
    const body = selectedAthletes.map(a => [
      safeStr(ar && a.name_ar ? a.name_ar : a.name),
      safeStr(sportLabel(a.sport, a.sport_category, ar)),
      safeStr(a.classification),
      safeStr(a.nationality),
    ])
    autoTable(doc, {
      startY: y + 6,
      head, body,
      theme: 'grid',
      styles: { font: FONT, fontSize: 9.5, textColor: [30,30,30], cellPadding: 5, halign: ar ? 'right' : 'left' },
      headStyles: { font: FONT, fillColor: THEME, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 245, 245] },
      margin: { left: 40, right: 40 },
    })
    y = doc.lastAutoTable.finalY + 26
  }

  // Officials — grouped by role, only if the person chose to include them
  if (includeOfficials) {
    const roleKeys = Object.keys(roleTitles).filter(k => (officialsByRole[k] || []).length > 0)
    if (roleKeys.length > 0) {
      if (y > pageHeight - 100) { doc.addPage(); y = 40 }
      setPdfFont('bold')
      doc.setFontSize(12)
      doc.setTextColor(...THEME)
      doc.text(safeStr(L('Officials', 'المسؤولون')), 40, y)
      y += 10
      const officialRows = []
      for (const key of roleKeys) {
        for (const o of officialsByRole[key]) {
          const emp = employees.find(e => e.id === o.employee_id)
          if (!emp) continue
          officialRows.push([roleTitles[key], safeStr(ar && emp.name_ar ? emp.name_ar : emp.name), safeStr(emp.designation)])
        }
      }
      autoTable(doc, {
        startY: y + 6,
        head: [[L('Role', 'الدور'), L('Name', 'الاسم'), L('Designation', 'الوظيفة')]],
        body: officialRows,
        theme: 'grid',
        styles: { font: FONT, fontSize: 9.5, textColor: [30,30,30], cellPadding: 5, halign: ar ? 'right' : 'left' },
        headStyles: { font: FONT, fillColor: THEME, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 245, 245] },
        margin: { left: 40, right: 40 },
      })
    }
  }

  const exportDate = new Date().toISOString().slice(0, 10)
  doc.save(`${(ev.name || 'Event').replace(/[^\w\-]+/g, '_')}_${exportDate}.pdf`)
}

// Pre-export modal — pick which registered athletes and whether officials
// go into the report. "Select all" toggles every currently-registered
// athlete at once; individual checkboxes stay available either way.
function EventExportModal({ ev, regAthletes, officials, roleTitles, employees, ar, tx, onClose, onExport }) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(regAthletes.map(a => a.id)))
  const [includeOfficials, setIncludeOfficials] = useState(true)
  const [exporting, setExporting] = useState(false)
  const allSelected = regAthletes.length > 0 && selectedIds.size === regAthletes.length

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(regAthletes.map(a => a.id)))
  }
  function toggleOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  async function handleExport() {
    setExporting(true)
    try {
      const chosen = regAthletes.filter(a => selectedIds.has(a.id))
      await exportEventPDF(ev, chosen, includeOfficials, officials, roleTitles, employees, ar ? 'ar' : 'en')
      onExport?.()
      onClose()
    } catch (err) {
      console.error('Event PDF export failed', err)
      toast(ar ? 'تعذر إنشاء ملف PDF' : 'Could not generate the PDF', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{ar ? 'تصدير الفعالية كـ PDF' : 'Export Event as PDF'}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{ar ? ev.name_ar || ev.name : ev.name}</div>
        </div>
        <div style={{ padding: '16px 22px', maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {ar ? `الرياضيون (${selectedIds.size}/${regAthletes.length})` : `Athletes (${selectedIds.size}/${regAthletes.length})`}
            </span>
            {regAthletes.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                {ar ? 'تحديد الكل' : 'Select all'}
              </label>
            )}
          </div>
          {regAthletes.length === 0 ? (
            <div className="empty" style={{ padding: '12px 0', fontSize: 12.5 }}>{ar ? 'لا يوجد رياضيون مسجلون' : 'No athletes registered'}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 18 }}>
              {regAthletes.map(a => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '5px 4px', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleOne(a.id)} />
                  <Avatar name={a.name} photoUrl={a.photo_url} size={22} />
                  <span>{ar && a.name_ar ? a.name_ar : a.name}</span>
                  <span style={{ color: 'var(--text3)', fontSize: 11 }}>· {sportLabel(a.sport, a.sport_category, ar)}</span>
                </label>
              ))}
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={includeOfficials} onChange={e => setIncludeOfficials(e.target.checked)} />
              {ar ? 'تضمين المسؤولين (المدربون، الطاقم الطبي، إلخ)' : 'Include officials (coaches, medical staff, etc.)'}
            </label>
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-cancel" onClick={onClose}>{ar ? 'إلغاء' : 'Cancel'}</button>
          <button className="btn btn-blue" disabled={exporting} onClick={handleExport}>
            <i className="ti ti-file-download" /> {exporting ? (ar ? 'جارٍ التصدير…' : 'Exporting…') : (ar ? 'تصدير PDF' : 'Export PDF')}
          </button>
        </div>
      </div>
    </div>
  )
}

function OfficialsPicker({ roleKey, title, officials, employees, eventId, canEditMode, canAdd, ar, tx, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef(null)
  const wrapRef = useRef(null)
  const assigned  = officials[roleKey] || []
  const available = employees.filter(e => !assigned.find(o => o.employee_id === e.id))
  const filtered = search.trim()
    ? available.filter(e => {
        const q = search.trim().toLowerCase()
        return (e.name||'').toLowerCase().includes(q) || (e.name_ar||'').includes(search.trim())
      })
    : available

  useEffect(() => {
    if (!dropdownOpen) return
    function onOutside(ev) { if (wrapRef.current && !wrapRef.current.contains(ev.target)) setDropdownOpen(false) }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [dropdownOpen])

  async function pickEmployee(emp) {
    await onAdd(eventId, emp.id, roleKey)
    setSearch(''); setDropdownOpen(false); setAdding(false)
  }

  // Read-only (Coach/Staff) viewers never see an empty role section at
  // all — no heading, no "No employees assigned" placeholder — since
  // they can't act on it anyway. Admin keeps the heading + empty state
  // so they know the section exists and can add someone.
  if (assigned.length === 0 && !canEditMode) return null
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
            <div ref={wrapRef} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap', position: 'relative' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
                <i className="ti ti-search" style={{ position: 'absolute', insetInlineStart: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text3)', pointerEvents: 'none' }} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setDropdownOpen(true) }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder={tx('events.searchEmployee', 'Search staff…')}
                  style={{ fontSize: 12, padding: '4px 8px 4px 26px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface1)', color: 'var(--text1)', width: '100%' }}
                />
                {dropdownOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', insetInlineStart: 0, insetInlineEnd: 0, zIndex: 50, maxHeight: 220, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.15)' }}>
                    {filtered.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>{tx('common.noResults', 'No matches')}</div>
                    ) : filtered.map(e => (
                      <div key={e.id} onClick={() => pickEmployee(e)}
                        style={{ padding: '7px 12px', fontSize: 12.5, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={ev => ev.currentTarget.style.background = 'var(--surface2)'}
                        onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                        {ar && e.name_ar ? e.name_ar : e.name}
                        {e.designation && <span style={{ color: 'var(--text3)', marginInlineStart: 6, fontSize: 11 }}>· {e.designation}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => { setAdding(false); setSearch(''); setDropdownOpen(false) }} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, padding: '3px 8px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>✕</button>
            </div>
          ) : (
            <button onClick={() => { setAdding(true); setTimeout(() => searchRef.current?.focus(), 0) }} style={{ background: '#0085C7', color: '#fff', border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-plus" style={{ fontSize: 11 }} />{tx('actions.add', 'Add')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}



export default function Events({ events, athletes, results, registrations, onRefresh, onNav, initEventId, initStatusFilter, onConsumeNavState, profile, eventCategories = [], employees = [], sportsList = [], guestMode = false }) {
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
  const [showExportModal, setShowExportModal] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [officials, setOfficials] = useState({ head_of_delegation: [], medical_staff: [], coach: [], administrative_staff: [], support_staff: [], technical_expert: [] })
  const [athleteSearch, setAthleteSearch] = useState('')

  useEffect(() => {
    if (initEventId) {
      setSelected(initEventId)
      onConsumeNavState?.('eventId') // one-time "open this event" intent — must not reapply on a later remount
    }
    // One-time nav-originated status filter (e.g. a Dashboard KPI card) —
    // consumed exactly once, then immediately cleared from the parent's
    // navState so a later remount (global Refresh button, unrelated
    // nav-reset, etc.) can never silently reapply it after the person has
    // changed or cleared the filter themselves.
    if (initStatusFilter) {
      setStatusF(initStatusFilter)
      onConsumeNavState?.('statusFilter')
    }
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
    const grouped = { head_of_delegation: [], medical_staff: [], coach: [], administrative_staff: [], support_staff: [], technical_expert: [] }
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

  const statuses = guestMode ? ['All', 'Upcoming', 'Completed'] : ['All', 'Planning', 'Upcoming', 'In Progress', 'Completed', 'Canceled']
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
    if (guestMode && evStatus !== 'Upcoming' && evStatus !== 'Completed') return false
    const matchStatus   = statusF === 'All' || evStatus === statusF
    const matchCategory = categoryF.length === 0 || categoryF.includes(String(e.category_id))
    const matchApproval = approvalF.length === 0 || approvalF.includes(e.approval_status)
    const eSports        = e.sports?.length ? e.sports : (e.sport ? [e.sport] : [])
    const matchSport     = sportF.length === 0 || eSports.some(s => sportF.includes(s))
    const matchSearch   = matchesSearch(buildSearchText(
      e.name, e.name_ar, e.venue, e.notes, evStatus, e.approval_status, ...eSports,
    ), search)
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

    toast(isEdit ? (ar ? `تم تحديث ${payload.name}` : `${payload.name} updated`) : (ar ? `تم إنشاء ${payload.name}` : `${payload.name} created`))
    if (isTrustedAdmin(profile)) {
      logAdminActivity({ actor: profile, action: isEdit ? 'updated' : 'created', entityType: 'event', entityId: eventId || null, entityLabel: payload.name, module: 'events' })
    }
    setForm(null); await onRefresh()
    if (isEdit) setSelected(eventId)
  }

  async function handleDelete(id, name) {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(ar ? `تم حذف ${name}` : `${name} deleted`)
    if (isTrustedAdmin(profile)) {
      logAdminActivity({ actor: profile, action: 'deleted', entityType: 'event', entityId: id, entityLabel: name, module: 'events' })
    }
    setSelected(null); setConfirm(null); onRefresh()
  }

  async function registerAthlete(eventId, athleteId) {
    const { error } = await supabase.from('event_registrations').insert({ event_id: eventId, athlete_id: athleteId })
    if (error) { toast(error.message, 'error'); return }
    toast(ar ? 'تم تسجيل الرياضي' : 'Athlete registered'); onRefresh()
  }

  async function unregisterAthlete(eventId, athleteId) {
    const { error } = await supabase.from('event_registrations').delete().match({ event_id: eventId, athlete_id: athleteId })
    if (error) { toast(error.message, 'error'); return }
    toast(ar ? 'تمت إزالة الرياضي' : 'Athlete removed'); onRefresh()
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
    const canManageOfficials = ['Planning', 'Upcoming'].includes(evStatus)
    const canEditProfile     = canEdit(profile)
    const canReg             = canEditProfile && ['Upcoming', 'In Progress', 'Planning'].includes(evStatus)
    // Registered-athlete / results-athlete rows stay clickable only for
    // Full Admin and Read-Only Admin — Staff, Coach, and Athlete accounts
    // get a read-only participant list here (Coach's own roster is still
    // reachable, unaffected, from the dedicated "My Athletes" page).
    // Registered-athlete / results-athlete rows stay clickable only for
    // Full Admin and Read-Only Admin — Staff, Coach, and Athlete accounts
    // get a read-only participant list here (Coach's own roster is still
    // reachable, unaffected, from the dedicated "My Athletes" page).
    // Medical Staff is the one exception: full read-only athlete-detail
    // access, same as Read-Only Admin, everywhere athletes are listed.
    const canClickAthletes   = canViewAthleteDetails(profile)

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
      head_of_delegation:   tx('events.teamLeader',        'Team Leader'),
      medical_staff:        tx('events.medicalStaff',       'Medical Staff'),
      coach:                tx('events.coaches',             'Coaches'),
      administrative_staff: tx('events.administrativeStaff','Administrative Staff'),
      support_staff:        tx('events.supportStaff',       'Support Staff'),
      technical_expert:     tx('events.technicalExpert',    'Technical Expert'),
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

        <BackButton onClick={() => setSelected(null)} label={tx('events.backToEvents', 'Back to events')} />

        {canEditProfile && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> {tx('actions.edit', 'Edit')}</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> {tx('actions.delete', 'Delete')}</button>
            <button className="action-btn action-btn-edit" onClick={() => setShowExportModal(true)}><i className="ti ti-file-download" /> {tx('events.exportPdf', 'Export PDF')}</button>
          </div>
        )}
        {!canEditProfile && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="action-btn action-btn-edit" onClick={() => setShowExportModal(true)}><i className="ti ti-file-download" /> {tx('events.exportPdf', 'Export PDF')}</button>
          </div>
        )}
        {showExportModal && (
          <EventExportModal
            ev={ev} regAthletes={regAthletes} officials={officials} roleTitles={ROLE_TITLES} employees={employees}
            ar={ar} tx={tx} onClose={() => setShowExportModal(false)}
          />
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

            {/* Officials — single card with all four roles */}
            <div className="info-card">
              <div className="info-title">{tx('events.officials', 'Officials')}</div>
              <OfficialsPicker roleKey="head_of_delegation"   title={ROLE_TITLES.head_of_delegation}   {...pickerProps} />
              <OfficialsPicker roleKey="technical_expert"     title={ROLE_TITLES.technical_expert}     {...pickerProps} />
              <OfficialsPicker roleKey="medical_staff"        title={ROLE_TITLES.medical_staff}        {...pickerProps} />
              <OfficialsPicker roleKey="coach"                title={ROLE_TITLES.coach}                {...pickerProps} />
              <OfficialsPicker roleKey="administrative_staff" title={ROLE_TITLES.administrative_staff} {...pickerProps} />
              <OfficialsPicker roleKey="support_staff"        title={ROLE_TITLES.support_staff}        {...pickerProps} />
            </div>

            {/* Registered Athletes */}
            <div className="info-card">
              <div className="info-title">
                {tx('events.registeredAthletes', 'Registered athletes')} ({regAthletes.length})
                {canClickAthletes && <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — {tx('events.clickToView', 'click to view')}</span>}
              </div>
              {regAthletes.map(a => {
                const stillEligible = evSports.length === 0 || athleteMatchesSports(a, evSports)
                return (
                  <DashRow key={a.id} clickable={canClickAthletes} onClick={() => onNav('athletes', { athleteId: a.id })}>
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

            {/* Results */}
            <div className="info-card">
              <div className="info-title">{tx('events.results', 'Results')} ({evResults.length})</div>
              {evResults.length === 0
                ? <div className="empty" style={{ padding: 16 }}>{tx('events.noResults', 'No results recorded')}</div>
                : evResults.map(r => {
                    const a = athletes.find(x => x.id === r.athlete_id)
                    return (
                      <DashRow key={r.id} clickable={canClickAthletes} onClick={() => a && onNav('athletes', { athleteId: a.id })}>
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
        .ev-gc-guest { cursor: default; }
        .ev-gc-guest:hover { box-shadow: none; transform: none; }
        .ev-gc-guest:focus-visible { box-shadow: none; }
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
        {!guestMode && (
          <MultiSelectFilter
            options={eventCategories.filter(c => c.is_active).map(c => ({ value: String(c.id), label: ar && c.name_ar ? c.name_ar : c.name }))}
            selected={categoryF}
            onChange={setCategoryF}
            allLabel={tx('events.allCategories', 'All categories')}
            style={{ minWidth: 160 }}
          />
        )}
        {!guestMode && (
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
        )}
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
              className={guestMode ? 'ev-gc ev-gc-guest' : 'ev-gc'}
              onClick={guestMode ? undefined : () => setSelected(ev.id)}
              onKeyDown={guestMode ? undefined : (e => e.key === 'Enter' && setSelected(ev.id))}
              tabIndex={guestMode ? -1 : 0}
              role={guestMode ? undefined : 'button'}
              aria-label={guestMode ? undefined : ev.name}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '12px 12px 0' }}>
                <CatBadge catId={ev.category_id} eventCategories={eventCategories} lang={lang} />
                <StatusBadge status={evStatus} tx={tx} />
                {!guestMode && <ApprovalBadge status={ev.approval_status} tx={tx} />}
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
