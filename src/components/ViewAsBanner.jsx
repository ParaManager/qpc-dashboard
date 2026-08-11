import { useLang } from '../lib/LangContext.jsx'

const ROLE_LABEL = {
  admin: { en: 'Admin', ar: 'مدير' },
  coach: { en: 'Coach', ar: 'مدرب' },
  athlete: { en: 'Athlete', ar: 'رياضي' },
  employee: { en: 'Staff', ar: 'الكادر' },
  referee: { en: 'Referee', ar: 'حكم' },
  guest: { en: 'Guest', ar: 'ضيف' },
}

// Always visible while a View As session is active — this is the only
// safety signal the support engineer (or anyone glancing at their screen)
// gets that actions are being taken on behalf of someone else, so it is
// deliberately impossible to miss or dismiss short of pressing Exit.
export default function ViewAsBanner({ viewedProfile, onExit }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  if (!viewedProfile) return null
  const roleLabel = ar ? (ROLE_LABEL[viewedProfile.role]?.ar || viewedProfile.role) : (ROLE_LABEL[viewedProfile.role]?.en || viewedProfile.role)

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 2000, width: '100%',
      background: 'linear-gradient(90deg,#f59e0b,#d97706)', color: '#fff',
      padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 12, fontSize: 13, fontWeight: 600, flexWrap: 'wrap', boxShadow: '0 2px 8px rgba(0,0,0,.15)',
    }}>
      <i className="ti ti-eye" style={{ fontSize: 16 }} />
      <span>
        {ar ? 'وضع العرض كـ:' : 'Viewing As:'}{' '}
        <b>{viewedProfile.full_name}</b> · {roleLabel}
      </span>
      <span style={{ fontSize: 11, fontWeight: 400, opacity: .9 }}>
        {ar ? 'أي تغييرات تُجرى نيابة عن هذا المستخدم' : 'Changes made here are on behalf of this user'}
      </span>
      <button onClick={onExit}
        style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.5)', color: '#fff', borderRadius: 8, padding: '4px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        <i className="ti ti-x" style={{ marginInlineEnd: 4 }} /> {ar ? 'إنهاء العرض' : 'Exit View'}
      </button>
    </div>
  )
}
