import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'

const ROLES = [
  { value: 'admin',    en: 'Admin',   ar: 'مدير' },
  { value: 'coach',    en: 'Coach',   ar: 'مدرب' },
  { value: 'athlete',  en: 'Athlete', ar: 'رياضي' },
  { value: 'employee', en: 'Staff',   ar: 'الكادر' },
  { value: 'referee',  en: 'Referee', ar: 'حكم' },
  { value: 'guest',    en: 'Guest',   ar: 'ضيف' },
]

// Only ever rendered when the signed-in account's REAL profile has
// is_support === true (gated by the caller) — this is the one and only
// entry point into View As, so no Admin/Coach/Staff/Athlete/Referee
// account can reach it regardless of their own role.
export default function ViewAsSwitcher({ onStartViewAs }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const [open, setOpen]       = useState(false)
  const [step, setStep]       = useState('role')   // role -> user
  const [role, setRole]       = useState(null)
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(false)

  async function pickRole(r) {
    setRole(r); setStep('user'); setLoading(true)
    const { data } = await supabase.from('profiles')
      .select('id, full_name, role, athlete_id, coach_id, employee_id, referee_id, person_id, email, status')
      .eq('role', r).eq('status', 'active')
      .order('full_name')
    setUsers(data || [])
    setLoading(false)
  }

  function reset() { setOpen(false); setStep('role'); setRole(null); setUsers([]) }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        title={ar ? 'العرض كمستخدم' : 'View As'}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid #8b5cf6', background: '#8b5cf615', color: '#8b5cf6', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        <i className="ti ti-user-search" style={{ fontSize: 14 }} /> {ar ? 'العرض كـ' : 'View As'}
      </button>

      {open && (
        <>
          <div onClick={reset} style={{ position: 'fixed', inset: 0, zIndex: 2998 }} />
          <div style={{ position: 'absolute', insetInlineEnd: 0, top: 42, width: 300, maxHeight: 420, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.18)', zIndex: 2999, padding: 10 }}>
            {step === 'role' && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {ar ? 'اختر الدور' : 'Select a role'}
                </div>
                {ROLES.map(r => (
                  <button key={r.value} onClick={() => pickRole(r.value)}
                    style={{ display: 'block', width: '100%', textAlign: ar ? 'right' : 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {ar ? r.ar : r.en}
                  </button>
                ))}
              </>
            )}
            {step === 'user' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <button onClick={() => setStep('role')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 0 }}>
                    <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
                  </button>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {ar ? 'اختر المستخدم' : 'Select a user'}
                  </div>
                </div>
                {loading && <div style={{ fontSize: 12, color: 'var(--text3)', padding: 8 }}>{ar ? 'جارٍ التحميل…' : 'Loading…'}</div>}
                {!loading && users.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', padding: 8 }}>{ar ? 'لا يوجد مستخدمون' : 'No users found'}</div>}
                {users.map(u => (
                  <button key={u.id} onClick={() => { onStartViewAs(u); reset() }}
                    style={{ display: 'block', width: '100%', textAlign: ar ? 'right' : 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {u.full_name}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
