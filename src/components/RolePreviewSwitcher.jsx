import { useState } from 'react'
import { useLang } from '../lib/LangContext.jsx'

// Only Admin, Read-Only Admin, Athlete, Coach, and Staff are selectable —
// Referee accounts aren't implemented yet (nothing to preview), and Guest
// has no account at all (Role Preview exists to test authenticated-account
// experiences, and the real Guest flow is already its own always-available,
// unauthenticated portal — nothing here removes or changes that).
const ROLES = [
  { value: 'admin',          en: 'Admin',            ar: 'مدير' },
  { value: 'readonly_admin', en: 'Read-Only Admin',  ar: 'مسؤول للعرض فقط' },
  { value: 'athlete',        en: 'Athlete',           ar: 'رياضي' },
  { value: 'coach',          en: 'Coach',             ar: 'مدرب' },
  { value: 'employee',       en: 'Staff',             ar: 'الكادر' },
]

// Only ever rendered when the signed-in account's REAL profile has
// is_support === true (gated by the caller). Picks a ROLE only — never a
// person — so this can never access or render another member's account
// context. Each role renders using the support account's own test-persona
// data (or, for Admin, the support account's real access).
export default function RolePreviewSwitcher({ onStartPreview }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        title={ar ? 'معاينة الدور' : 'Preview Role'}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid #8b5cf6', background: '#8b5cf615', color: '#8b5cf6', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        <i className="ti ti-device-tv" style={{ fontSize: 14 }} /> {ar ? 'معاينة الدور' : 'Preview Role'}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 2998 }} />
          <div style={{ position: 'absolute', insetInlineEnd: 0, top: 42, width: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.18)', zIndex: 2999, padding: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', margin: '4px 6px 8px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {ar ? 'اختر دوراً للمعاينة' : 'Select a role to preview'}
            </div>
            {ROLES.map(r => (
              <button key={r.value} onClick={() => { onStartPreview(r.value); setOpen(false) }}
                style={{ display: 'block', width: '100%', textAlign: ar ? 'right' : 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {ar ? r.ar : r.en}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
