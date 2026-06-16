import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast } from '../components/Toast'
import { canEdit } from '../lib/useAuth'

export default function Settings({ user, profile, signOut }) {
  const { lang, setLang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [pwForm, setPwForm]         = useState({ current: '', new: '', confirm: '' })
  const [pwLoading, setPwLoading]   = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  async function changePassword(e) {
    e.preventDefault()
    if (pwForm.new !== pwForm.confirm) {
      toast(L('Passwords do not match', 'كلمات المرور غير متطابقة'), 'error'); return
    }
    if (pwForm.new.length < 6) {
      toast(L('Password must be at least 6 characters', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'), 'error'); return
    }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.new })
    if (error) { toast(error.message, 'error') }
    else { toast(L('Password changed successfully', 'تم تغيير كلمة المرور بنجاح')); setPwForm({ current:'', new:'', confirm:'' }) }
    setPwLoading(false)
  }

  const role = profile?.account_type || profile?.role || 'guest'
  const ROLE_AR = { admin:'مسؤول', coach:'مدرب', athlete:'رياضي', guest:'زائر' }

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="page-title" style={{ marginBottom: 20 }}>{L('Settings', 'الإعدادات')}</div>

      {/* Account info */}
      <div className="info-card" style={{ marginBottom: 16 }}>
        <div className="info-title">{L('Account', 'الحساب')}</div>
        <div className="detail-row">
          <span className="dk">{L('QID / Username', 'الرقم الشخصي')}</span>
          <span className="dv">{profile?.qid || user?.email}</span>
        </div>
        <div className="detail-row">
          <span className="dk">{L('Display name', 'الاسم المعروض')}</span>
          <span className="dv">{profile?.full_name || '—'}</span>
        </div>
        <div className="detail-row">
          <span className="dk">{L('Role', 'الدور')}</span>
          <span className="dv">{ar ? (ROLE_AR[role]||role) : role.charAt(0).toUpperCase()+role.slice(1)}</span>
        </div>
      </div>

      {/* Change password */}
      <div className="info-card" style={{ marginBottom: 16 }}>
        <div className="info-title">{L('Change Password', 'تغيير كلمة المرور')}</div>
        {!showPwForm ? (
          <button onClick={() => setShowPwForm(true)} className="action-btn action-btn-edit">
            <i className="ti ti-lock" /> {L('Change password', 'تغيير كلمة المرور')}
          </button>
        ) : (
          <form onSubmit={async (e) => { await changePassword(e); setShowPwForm(false) }}>
            <div className="form-group">
              <label className="form-label">{L('New password', 'كلمة المرور الجديدة')}</label>
              <input className="form-input" type="password" placeholder="••••••••" autoFocus
                value={pwForm.new} onChange={e => setPwForm(f => ({...f, new: e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">{L('Confirm new password', 'تأكيد كلمة المرور الجديدة')}</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={pwForm.confirm} onChange={e => setPwForm(f => ({...f, confirm: e.target.value}))} required />
            </div>
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <button type="button" className="btn-cancel" onClick={() => { setShowPwForm(false); setPwForm({ current:'', new:'', confirm:'' }) }}>
                {L('Cancel', 'إلغاء')}
              </button>
              <button type="submit" disabled={pwLoading} className="btn" style={{ background:'#0085C7' }}>
                {pwLoading ? L('Saving…','جارٍ الحفظ…') : <><i className="ti ti-check" /> {L('Update password','تحديث كلمة المرور')}</>}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Language */}
      <div className="info-card" style={{ marginBottom: 16 }}>
        <div className="info-title">{L('Language', 'اللغة')}</div>
        <div style={{ display:'flex', gap:10, marginTop:4 }}>
          {[['en','English'],['ar','عربي']].map(([code, label]) => (
            <button key={code} onClick={() => setLang(code)}
              style={{ padding:'8px 24px', borderRadius:10, border:'1px solid var(--border)', cursor:'pointer', fontSize:14, fontWeight:600,
                background: lang===code ? '#0085C7' : 'var(--surface)',
                color: lang===code ? '#fff' : 'var(--text2)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions */}
      <div className="info-card" style={{ marginBottom: 16 }}>
        <div className="info-title">{L('Sessions', 'الجلسات')}</div>
        <p style={{ fontSize:13, color:'var(--text2)', marginBottom:12 }}>
          {L('Sign out of your current session on this device.',
             'تسجيل الخروج من جلستك الحالية على هذا الجهاز.')}
        </p>
        <button onClick={signOut} className="action-btn action-btn-delete">
          <i className="ti ti-logout" /> {L('Sign out', 'تسجيل الخروج')}
        </button>
      </div>

      {/* Danger zone - admin only */}
      {role === 'admin' && (
        <div className="info-card" style={{ border:'1px solid #EE334E40' }}>
          <div className="info-title" style={{ color:'#EE334E' }}>
            <i className="ti ti-alert-triangle" /> {L('Danger Zone', 'منطقة الخطر')}
          </div>
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)}
              style={{ padding:'8px 16px', background:'#EE334E10', color:'#EE334E', border:'1px solid #EE334E40', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
              <i className="ti ti-trash" /> {L('Delete my account', 'حذف حسابي')}
            </button>
          ) : (
            <div style={{ background:'#EE334E08', borderRadius:10, padding:14 }}>
              <p style={{ fontSize:13, color:'#EE334E', marginBottom:12, fontWeight:500 }}>
                {L('Are you sure? This will permanently delete your account and cannot be undone.',
                   'هل أنت متأكد؟ سيتم حذف حسابك نهائياً ولا يمكن التراجع.')}
              </p>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowDelete(false)} className="btn-cancel">{L('Cancel','إلغاء')}</button>
                <button onClick={async () => {
                  await supabase.from('profiles').delete().eq('id', user.id)
                  await supabase.auth.signOut()
                  signOut()
                }} style={{ padding:'8px 16px', background:'#EE334E', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                  <i className="ti ti-trash" /> {L('Yes, delete my account', 'نعم، احذف حسابي')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
