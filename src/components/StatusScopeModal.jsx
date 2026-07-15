import { useState } from 'react'

const ROLE_LABEL = {
  athlete:  { en: 'Athlete',  ar: 'رياضي' },
  coach:    { en: 'Coach',    ar: 'مدرب' },
  employee: { en: 'Employee', ar: 'موظف' },
  referee:  { en: 'Referee',  ar: 'حكم' },
}

// Shown when changing status for a person who has more than one linked
// role. Never auto-applies to other roles — the admin must explicitly pick
// a scope every time. `currentRoleType` is the role of the page the change
// was initiated from, and is the default selection.
export default function StatusScopeModal({ roles, currentRoleType, lang, onConfirm, onCancel }) {
  const ar = lang === 'ar'
  const [scope, setScope] = useState('current') // 'current' | 'selected' | 'all'
  const currentRoles = roles.filter(r => !r.is_historical)
  const [selected, setSelected] = useState(new Set([currentRoleType]))

  function toggle(type) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

  function confirm() {
    if (scope === 'current') return onConfirm([currentRoleType])
    if (scope === 'all') return onConfirm(currentRoles.map(r => r.type))
    return onConfirm([...selected])
  }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="modal-box" style={{ width: 420 }}>
        <div className="modal-header">
          <div className="modal-title">{ar ? 'تطبيق تغيير الحالة على' : 'Apply status change to'}</div>
          <button className="modal-close" onClick={onCancel}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="radio" checked={scope === 'current'} onChange={() => setScope('current')} />
              <span>{ar ? `دور ${ar ? ROLE_LABEL[currentRoleType].ar : ROLE_LABEL[currentRoleType].en} فقط` : `${ROLE_LABEL[currentRoleType].en} role only`}</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="radio" checked={scope === 'selected'} onChange={() => setScope('selected')} />
              <span>{ar ? 'أدوار محددة' : 'Selected roles'}</span>
            </label>
            {scope === 'selected' && (
              <div style={{ marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {currentRoles.map(r => (
                  <label key={r.type} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={selected.has(r.type)} onChange={() => toggle(r.type)} />
                    <span>{ar ? ROLE_LABEL[r.type].ar : ROLE_LABEL[r.type].en}</span>
                  </label>
                ))}
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} />
              <span>{ar ? 'كل الأدوار الحالية' : 'All current roles'}</span>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onCancel}>{ar ? 'إلغاء' : 'Cancel'}</button>
          <button className="btn btn-blue" onClick={confirm}>{ar ? 'تأكيد' : 'Confirm'}</button>
        </div>
      </div>
    </div>
  )
}
