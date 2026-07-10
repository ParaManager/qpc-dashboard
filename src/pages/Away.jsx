import { useState, useMemo } from 'react'
import { useLang } from '../lib/LangContext.jsx'
import { Avatar, Badge, statusClass, computeAwayPeople, AWAY_STATUSES } from '../lib/helpers'

// Localized labels for the three away statuses and the three person types —
// kept local to this page since nothing else needs them bundled together
// like this.
const STATUS_LABEL = {
  'On Leave':         { en: 'On Leave',         ar: 'في إجازة' },
  'In Competition':   { en: 'In Competition',   ar: 'في منافسة' },
  'In Training Camp': { en: 'In Training Camp', ar: 'في معسكر تدريبي' },
}

const TYPE_LABEL = {
  Athlete:  { en: 'Athlete',  ar: 'رياضي' },
  Coach:    { en: 'Coach',    ar: 'مدرب' },
  Employee: { en: 'Employee', ar: 'موظف' },
}

export default function Away({ athletes, coaches, employees, onNav }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, arText) => ar ? arText : en

  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  // Single source of truth — same computation the Dashboard Away KPI card
  // uses, so this page's results can never drift from that number.
  const { allAway } = useMemo(
    () => computeAwayPeople(athletes, coaches, employees, lang),
    [athletes, coaches, employees, lang]
  )

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  function daysRemaining(endDate) {
    if (!endDate) return null
    const end = new Date(endDate); end.setHours(0,0,0,0)
    return Math.round((end - today) / 86400000)
  }
  function daysPassed(startDate) {
    if (!startDate) return null
    const start = new Date(startDate); start.setHours(0,0,0,0)
    return Math.round((today - start) / 86400000)
  }

  const filtered = allAway.filter(p => {
    if (typeFilter !== 'All') {
      const type = p._isCoach ? 'Coach' : p._isEmployee ? 'Employee' : 'Athlete'
      if (type !== typeFilter) return false
    }
    if (statusFilter !== 'All' && p.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const name = (p.name || '').toLowerCase()
      const nameAr = (p.name_ar || '').toLowerCase()
      if (!name.includes(q) && !nameAr.includes(q)) return false
    }
    return true
  })

  const hasActiveFilters = search || typeFilter !== 'All' || statusFilter !== 'All'
  function clearFilters() { setSearch(''); setTypeFilter('All'); setStatusFilter('All') }

  function goToPerson(p) {
    if (p._isCoach)    onNav('coaches',   { coachId: p.id })
    else if (p._isEmployee) onNav('employees', { employeeId: p.id })
    else onNav('athletes', { athleteId: p.id })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{L('Away Management', 'إدارة الغياب')}</div>
          <div className="page-sub">
            {filtered.length} {L('of', 'من')} {allAway.length} {L('currently away', 'غائب حالياً')}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters" style={{ marginBottom: 12 }}>
        <div className="search-wrap">
          <i className="ti ti-search" />
          <input
            placeholder={L('Search by name…', 'بحث بالاسم…')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: typeFilter !== 'All' ? '#0085C7' : 'var(--text)', fontWeight: typeFilter !== 'All' ? 600 : 400, cursor: 'pointer', outline: 'none' }}>
          <option value="All">{L('Person Type: All', 'نوع الشخص: الكل')}</option>
          <option value="Athlete">{L('Athletes', 'الرياضيون')}</option>
          <option value="Coach">{L('Coaches', 'المدربون')}</option>
          <option value="Employee">{L('Employees', 'الموظفون')}</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, color: statusFilter !== 'All' ? '#0085C7' : 'var(--text)', fontWeight: statusFilter !== 'All' ? 600 : 400, cursor: 'pointer', outline: 'none' }}>
          <option value="All">{L('Away Status: All', 'حالة الغياب: الكل')}</option>
          {AWAY_STATUSES.map(s => (
            <option key={s} value={s}>{ar ? STATUS_LABEL[s].ar : STATUS_LABEL[s].en}</option>
          ))}
        </select>
        {hasActiveFilters && (
          <button onClick={clearFilters}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 9, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <i className="ti ti-x" style={{ fontSize: 13 }} /> {L('Clear Filters', 'مسح الفلاتر')}
          </button>
        )}
      </div>

      {/* Main content */}
      {allAway.length === 0 ? (
        <div className="empty">{L('No one is currently away.', 'لا يوجد أحد غائب حالياً.')}</div>
      ) : filtered.length === 0 ? (
        <div className="empty">{L('No results match the selected filters.', 'لا توجد نتائج مطابقة للفلاتر المحددة.')}</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>{L('Name', 'الاسم')}</th>
                <th>{L('Person Type', 'نوع الشخص')}</th>
                <th>{L('Away Status', 'حالة الغياب')}</th>
                <th>{L('Start Date', 'تاريخ البداية')}</th>
                <th>{L('End Date', 'تاريخ النهاية')}</th>
                <th>{L('Days Remaining', 'الأيام المتبقية')}</th>
                <th>{L('Days Passed', 'الأيام المنقضية')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const type = p._isCoach ? 'Coach' : p._isEmployee ? 'Employee' : 'Athlete'
                const displayName = ar && p.name_ar ? p.name_ar : (p.name || '—')
                const remaining = daysRemaining(p.status_end)
                const passed    = daysPassed(p.status_start)
                return (
                  <tr key={`${type}-${p.id}`} onClick={() => goToPerson(p)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={p.name || '?'} id={p.id} size={30} fs={10} />
                        <span style={{ fontWeight: 500 }}>{displayName}</span>
                      </div>
                    </td>
                    <td>{ar ? TYPE_LABEL[type].ar : TYPE_LABEL[type].en}</td>
                    <td><Badge label={ar ? STATUS_LABEL[p.status]?.ar || p.status : p.status} cls={statusClass(p.status)} /></td>
                    <td style={{ color: 'var(--text2)', fontSize: 12.5 }}>{p.status_start || '—'}</td>
                    <td style={{ color: 'var(--text2)', fontSize: 12.5 }}>{p.status_end || '—'}</td>
                    <td>
                      {remaining === null ? '—' : (
                        <span style={{ fontWeight: 600, color: remaining < 0 ? '#dc2626' : remaining <= 2 ? '#d97706' : '#00875a' }}>
                          {remaining < 0
                            ? L(`${Math.abs(remaining)}d overdue`, `تأخر ${Math.abs(remaining)} يوم`)
                            : remaining === 0
                              ? L('Today', 'اليوم')
                              : L(`${remaining}d`, `${remaining} يوم`)}
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text3)', fontSize: 12.5 }}>
                      {passed === null ? '—' : passed <= 0 ? L('Today', 'اليوم') : L(`${passed}d`, `${passed} يوم`)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
