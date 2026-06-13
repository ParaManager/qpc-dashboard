import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyAdminNewRequest } from '../lib/emails'
import { useLang } from '../lib/LangContext.jsx'
import { qpcLogo as QPC_LOGO } from '../lib/logos'

export default function Login({ onRequestSent }) {
  const { lang, setLang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [mode, setMode]         = useState('login')   // login | register | pending | rejected | sent
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [form, setForm]         = useState({ qid:'', password:'', confirmPassword:'', fullName:'', accountType:'guest', coachId:'', athleteId:'' })
  const [coaches, setCoaches]   = useState([])
  const [athletes, setAthletes] = useState([])
  const set = (k,v) => setForm(f => ({...f, [k]:v}))

  async function loadCoachesAthletes() {
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from('coaches').select('id,name,name_ar').order('name'),
      supabase.from('athletes').select('id,name,name_ar').order('name'),
    ])
    setCoaches(c||[])
    setAthletes(a||[])
  }

  const qidToEmail = (qid) => `${qid.replace(/\s+/g,'')}@qpc-system.qa`

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    if (!form.qid.trim()) { setError(L('QID is required','الرقم الشخصي مطلوب')); setLoading(false); return }
    // Support both QID and email login (for admin who registered with email)
    const loginEmail = form.qid.includes('@') ? form.qid : qidToEmail(form.qid)
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: form.password })
    if (error) { setError(error.message); setLoading(false); return }
    // App.jsx handles pending/rejected screens based on profile.status
    setLoading(false)
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true); setError('')
    if (!form.fullName.trim()) { setError(L('Full name is required','الاسم الكامل مطلوب')); setLoading(false); return }
    if (!form.qid.trim()) { setError(L('QID is required','الرقم الشخصي مطلوب')); setLoading(false); return }
    if (form.password !== form.confirmPassword) { setError(L('Passwords do not match','كلمات المرور غير متطابقة')); setLoading(false); return }
    if (form.password.length < 6) { setError(L('Password must be at least 6 characters','كلمة المرور يجب أن تكون 6 أحرف على الأقل')); setLoading(false); return }
    if (form.accountType === 'coach' && !form.coachId) { setError(L('Please select your coach profile','الرجاء اختيار ملف المدرب')); setLoading(false); return }
    if (form.accountType === 'athlete' && !form.athleteId) { setError(L('Please select your athlete profile','الرجاء اختيار ملف الرياضي')); setLoading(false); return }

    // ── QID VERIFICATION ──
    if (form.accountType === 'coach' && form.coachId) {
      const { data: coachData } = await supabase.from('coaches').select('id_number').eq('id', form.coachId).single()
      const storedQID = (coachData?.id_number || '').replace(/\s+/g, '').trim()
      const enteredQID = form.qid.replace(/\s+/g, '').trim()
      if (storedQID && storedQID !== enteredQID) {
        setError(L('The QID you entered does not match our records for this coach. Please check your ID number.', 'الرقم الشخصي الذي أدخلته لا يتطابق مع سجلاتنا لهذا المدرب. يرجى التحقق من رقم هويتك.'))
        setLoading(false); return
      }
    }
    if (form.accountType === 'athlete' && form.athleteId) {
      const { data: athData } = await supabase.from('athletes').select('id_number').eq('id', form.athleteId).single()
      const storedQID = (athData?.id_number || '').replace(/\s+/g, '').trim()
      const enteredQID = form.qid.replace(/\s+/g, '').trim()
      if (storedQID && storedQID !== enteredQID) {
        setError(L('The QID you entered does not match our records for this athlete. Please check your ID number.', 'الرقم الشخصي الذي أدخلته لا يتطابق مع سجلاتنا لهذا الرياضي. يرجى التحقق من رقم هويتك.'))
        setLoading(false); return
      }
    }

    // Sign up
    const { data, error } = await supabase.auth.signUp({
      email: qidToEmail(form.qid),
      password: form.password,
      options: {
        data: { full_name: form.fullName, qid: form.qid }
      }
    })
    if (error) {
      if (error.message?.includes('already registered') || error.status === 422) {
        setError(L('This email is already registered. Please sign in instead.','هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.'))
      } else {
        setError(error.message)
      }
      setLoading(false); return
    }
    if (!data?.user) { setError(L('Signup failed. Please try again.','فشل التسجيل. حاول مجدداً.')); setLoading(false); return }

    // Only create profile if one doesn't already exist
    const { data: existing } = await supabase.from('profiles').select('id,status').eq('id', data.user.id).maybeSingle()
    if (!existing) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: form.fullName,
        email: form.qid,  // store QID as identifier
        account_type: form.accountType,
        role: form.accountType,
        status: 'pending',
        coach_id: form.coachId || null,
        athlete_id: form.athleteId || null,
        requested_at: new Date().toISOString(),
      })
    }

    // (admin notification handled via User Management page)

    // Show sent screen immediately, then sign out
    // Notify admin
    notifyAdminNewRequest({ fullName: form.fullName, email: form.qid, accountType: form.accountType })
    setLoading(false)
    if (onRequestSent) onRequestSent()
    await supabase.auth.signOut()
  }

  // ── SENT / PENDING / REJECTED SCREENS ──


  if (mode === 'pending') return (
    <Screen ar={ar}>
      <div style={{ fontSize:48, marginBottom:16 }}>⏳</div>
      <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>{L('Pending Approval','في انتظار الموافقة')}</div>
      <div style={{ fontSize:14, color:'#9aa3b2', textAlign:'center', lineHeight:1.6, maxWidth:300 }}>
        {L('Your account is pending admin approval. Please check back later.',
           'حسابك في انتظار موافقة المسؤول. يرجى المحاولة لاحقاً.')}
      </div>
      <button onClick={() => setMode('login')} style={{ marginTop:20, padding:'10px 28px', background:'#0085C7', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:14 }}>
        {L('Back','رجوع')}
      </button>
    </Screen>
  )

  if (mode === 'rejected') return (
    <Screen ar={ar}>
      <div style={{ fontSize:48, marginBottom:16 }}>❌</div>
      <div style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>{L('Access Denied','تم رفض الطلب')}</div>
      <div style={{ fontSize:14, color:'#9aa3b2', textAlign:'center', lineHeight:1.6, maxWidth:300 }}>
        {L('Your access request was not approved. Please contact the administrator.',
           'لم تتم الموافقة على طلب الوصول. يرجى التواصل مع المسؤول.')}
      </div>
      <button onClick={() => setMode('login')} style={{ marginTop:20, padding:'10px 28px', background:'#0085C7', color:'#fff', border:'none', borderRadius:10, cursor:'pointer', fontSize:14 }}>
        {L('Back','رجوع')}
      </button>
    </Screen>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, direction: ar?'rtl':'ltr' }}>
      <div style={{ width:'100%', maxWidth:420 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src={QPC_LOGO} alt="QPC" style={{ height:70, marginBottom:12 }} />
          <div style={{ fontSize:18, fontWeight:700, color:'var(--text)' }}>
            {L('Qatar Paralympic Committee','الاتحاد القطري لذوي الاحتياجات الخاصة')}
          </div>
          <div style={{ fontSize:13, color:'var(--text3)', marginTop:4 }}>
            {L('Admin Dashboard','لوحة التحكم')}
          </div>
        </div>

        {/* Card */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:28, boxShadow:'0 8px 32px rgba(0,0,0,.12)' }}>

          {/* Tabs */}
          <div style={{ display:'flex', marginBottom:24, background:'var(--surface2)', borderRadius:10, padding:4, gap:4 }}>
            {[['login', L('Sign In','تسجيل الدخول')], ['register', L('Request Access','طلب الوصول')]].map(([m,lbl]) => (
              <button key={m} onClick={() => { setMode(m); setError(''); if (m==='register') loadCoachesAthletes() }}
                style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                  background: mode===m ? 'var(--surface)' : 'transparent',
                  color: mode===m ? 'var(--text)' : 'var(--text3)',
                  boxShadow: mode===m ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
                {lbl}
              </button>
            ))}
          </div>

          {/* Login form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">{L('Qatar ID (QID)','الرقم الشخصي QID')}</label>
                <input className="form-input" type="text" placeholder={L("e.g. 28412345678","مثال: 28412345678")} value={form.qid} onChange={e=>set('qid',e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{L('Password','كلمة المرور')}</label>
                <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e=>set('password',e.target.value)} required />
              </div>
              {error && <div style={{ color:'#EE334E', fontSize:13, marginBottom:12, padding:'8px 12px', background:'#EE334E15', borderRadius:8 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ width:'100%', padding:'11px', background:'#0085C7', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', marginTop:4 }}>
                {loading ? L('Signing in…','جارٍ تسجيل الدخول…') : L('Sign In','تسجيل الدخول')}
              </button>
            </form>
          )}

          {/* Register form */}
          {mode === 'register' && (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">{L('Full Name','الاسم الكامل')}</label>
                <input className="form-input" placeholder={L('e.g. Ahmed Al-Ansari','مثال: أحمد الأنصاري')} value={form.fullName} onChange={e=>set('fullName',e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{L('Qatar ID (QID)','الرقم الشخصي QID')}</label>
                <input className="form-input" type="text" placeholder={L("e.g. 28412345678","مثال: 28412345678")} value={form.qid} onChange={e=>set('qid',e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{L('Account Type','نوع الحساب')}</label>
                <select className="form-input" value={form.accountType} onChange={e=>set('accountType',e.target.value)}>
                  <option value="coach">{L('Coach','مدرب')}</option>
                  <option value="athlete">{L('Athlete','رياضي')}</option>
                  <option value="guest">{L('Guest / Viewer','زائر / مشاهد')}</option>
                </select>
              </div>
              {form.accountType === 'coach' && (
                <div className="form-group">
                  <label className="form-label">{L('Select your coach profile','اختر ملف المدرب')}</label>
                  <select className="form-input" value={form.coachId} onChange={e=>set('coachId',e.target.value)} required>
                    <option value="">{L('— Select coach —','— اختر المدرب —')}</option>
                    {coaches.map(c=><option key={c.id} value={c.id}>{ar&&c.name_ar?c.name_ar:c.name}</option>)}
                  </select>
                </div>
              )}
              {form.accountType === 'athlete' && (
                <div className="form-group">
                  <label className="form-label">{L('Select your athlete profile','اختر ملف الرياضي')}</label>
                  <select className="form-input" value={form.athleteId} onChange={e=>set('athleteId',e.target.value)} required>
                    <option value="">{L('— Select athlete —','— اختر الرياضي —')}</option>
                    {athletes.map(a=><option key={a.id} value={a.id}>{ar&&a.name_ar?a.name_ar:a.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{L('Password','كلمة المرور')}</label>
                  <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e=>set('password',e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{L('Confirm Password','تأكيد كلمة المرور')}</label>
                  <input className="form-input" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)} required />
                </div>
              </div>
              {error && <div style={{ color:'#EE334E', fontSize:13, marginBottom:12, padding:'8px 12px', background:'#EE334E15', borderRadius:8 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ width:'100%', padding:'11px', background:'#EE334E', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', marginTop:4 }}>
                {loading ? L('Submitting…','جارٍ الإرسال…') : L('Request Access','طلب الوصول')}
              </button>
              <p style={{ fontSize:11, color:'var(--text3)', textAlign:'center', marginTop:12, lineHeight:1.5 }}>
                {L('Your request will be reviewed by the admin. You will be notified by email once approved.',
                   'سيتم مراجعة طلبك من قبل المسؤول وستتلقى إشعاراً بالبريد الإلكتروني عند الموافقة.')}
              </p>
            </form>
          )}
        </div>

        {/* Language toggle */}
        <div style={{ textAlign:'center', marginTop:16 }}>
          <button onClick={() => setLang(lang==='en'?'ar':'en')}
            style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'6px 16px', color:'var(--text2)', fontSize:13, cursor:'pointer' }}>
            {lang==='en' ? 'عربي' : 'EN'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Screen({ ar, children }) {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, direction: ar?'rtl':'ltr' }}>
      {children}
    </div>
  )
}
