import { useLang } from '../lib/LangContext.jsx'

const ROLE_LABEL = {
  admin: { en: 'Admin', ar: 'مدير' },
  readonly_admin: { en: 'Read-Only Admin', ar: 'مسؤول للعرض فقط' },
  coach: { en: 'Coach', ar: 'مدرب' },
  athlete: { en: 'Athlete', ar: 'رياضي' },
  employee: { en: 'Staff', ar: 'الكادر' },
  referee: { en: 'Referee', ar: 'حكم' },
  guest: { en: 'Guest', ar: 'ضيف' },
}

// Always visible while Role Preview is active. Deliberately says nothing
// about "viewing as" any other person — the signed-in identity never
// changes, only which role's UI/permissions are being test-rendered using
// the support account's own test data.
export default function RolePreviewBanner({ previewRole, onExit }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  if (!previewRole) return null
  const roleLabel = ar ? (ROLE_LABEL[previewRole]?.ar || previewRole) : (ROLE_LABEL[previewRole]?.en || previewRole)

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 2000, width: '100%',
      background: 'linear-gradient(90deg,#8b5cf6,#7c3aed)', color: '#fff',
      padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 12, fontSize: 13, fontWeight: 600, flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(0,0,0,.15)',
    }}>
      <i className="ti ti-device-tv" style={{ fontSize: 16 }} />
      <span>{ar ? `معاينة الدور: ${roleLabel}` : `Role Preview: ${roleLabel}`}</span>
      <span style={{ fontSize: 11, fontWeight: 400, opacity: .9 }}>
        {ar ? 'يتم الاختبار باستخدام بيانات اختبار مخصصة للدعم' : 'Testing with support test data'}
      </span>
      <button onClick={onExit}
        style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.5)', color: '#fff', borderRadius: 8, padding: '4px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        <i className="ti ti-x" style={{ marginInlineEnd: 4 }} /> {ar ? 'إنهاء المعاينة' : 'Exit Preview'}
      </button>
    </div>
  )
}
