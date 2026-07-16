import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Given a person_id, finds every linked role across athletes/coaches/
// employees/referees. `is_historical` (set by the Phase 2 migration) marks
// a role as no longer current — used both for the "Former X" badge label
// and to distinguish "current roles" from "all roles" in the status-scope
// modal.
export function usePersonRoles(personId) {
  const [roles, setRoles] = useState([]) // [{ type, id, status, is_historical, label }]
  const [loading, setLoading] = useState(!!personId)

  useEffect(() => {
    if (!personId) { setRoles([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('athletes').select('id, status, is_historical').eq('person_id', personId),
      supabase.from('coaches').select('id, status, is_historical').eq('person_id', personId),
      supabase.from('employees').select('id, status, is_historical').eq('person_id', personId),
      supabase.from('referees').select('id, is_historical').eq('person_id', personId),
    ]).then(([a, c, e, r]) => {
      if (cancelled) return
      const out = []
      ;(a.data || []).forEach(row => out.push({ type: 'athlete', id: row.id, status: row.status, is_historical: !!row.is_historical }))
      ;(c.data || []).forEach(row => out.push({ type: 'coach', id: row.id, status: row.status, is_historical: !!row.is_historical }))
      ;(e.data || []).forEach(row => out.push({ type: 'employee', id: row.id, status: row.status, is_historical: !!row.is_historical }))
      ;(r.data || []).forEach(row => out.push({ type: 'referee', id: row.id, status: null, is_historical: !!row.is_historical }))
      setRoles(out)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [personId])

  return { roles, loading }
}

const ROLE_LABEL = {
  athlete:  { en: 'Athlete',  ar: 'رياضي' },
  coach:    { en: 'Coach',    ar: 'مدرب' },
  employee: { en: 'Employee', ar: 'موظف' },
  referee:  { en: 'Referee',  ar: 'حكم' },
}

// Renders "Athlete • Employee" / "Employee • Former Coach" etc. A role
// shows as "Former" when it's explicitly is_historical=true, OR when its
// own status is "Retired" — Retired is a real, shared status now (not
// converted to Inactive), so a retired role must visually read the same
// as an is_historical one even though the underlying flag differs.
export function RoleBadges({ roles, lang, excludeType }) {
  const ar = lang === 'ar'
  const visible = (roles || []).filter(r => r.type !== excludeType)
  if (visible.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', margin: '6px 0' }}>
      {visible.map(r => {
        const isFormer = r.is_historical || r.status === 'Retired'
        return (
          <span key={`${r.type}-${r.id}`}
            className="badge"
            style={{
              fontSize: 10.5,
              background: isFormer ? 'var(--surface2)' : '#0085C715',
              color: isFormer ? 'var(--text3)' : '#0085C7',
              fontStyle: isFormer ? 'italic' : 'normal',
            }}>
            {isFormer ? (ar ? 'سابق ' : 'Former ') : ''}{ar ? ROLE_LABEL[r.type].ar : ROLE_LABEL[r.type].en}
          </span>
        )
      })}
    </div>
  )
}
