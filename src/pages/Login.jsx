import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { qpcLogo as QPC_LOGO } from '../lib/logos'
import { normalizeQid } from '../lib/helpers'

const ROLE_LABEL = {
  athlete:  { en: 'Athlete',      ar: 'رياضي' },
  coach:    { en: 'Coach',        ar: 'مدرب' },
  employee: { en: 'Staff Member', ar: 'عضو الكادر' },
}

export default function Login({ onRequestSent, onSigningUpChange, onGuestMode }) {
  const { lang, setLang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [mode, setMode]         = useState('login')   // login | register | pending | rejected | sent
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [form, setForm]         = useState({ qid:'', password:'' })
  const set = (k,v) => setForm(f => ({...f, [k]:v}))

  // Access Request — Qatar-ID-first flow. 'qid' -> 'confirm' -> 'password'.
  const [regStep, setRegStep] = useState('qid')
  const [regQid, setRegQid] = useState('')
  const [lookupCandidates, setLookupCandidates] = useState([])
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')

  function resetRegistration() {
    setRegStep('qid'); setRegQid(''); setLookupCandidates([]); setSelectedCandidate(null)
    setRegPassword(''); setRegConfirmPassword(''); setError('')
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

  // ── STEP 1: Qatar ID lookup ──
  // Goes through the secure lookup_access_request_identity RPC (SECURITY
  // DEFINER) instead of querying athletes/coaches/employees directly —
  // unauthenticated users never get raw table access, and the RPC returns
  // only the minimal identity-confirmation fields (no phone/email/passport/
  // documents). Normalization (spaces, hyphens, Arabic/Persian digits) is
  // done both client-side (normalizeQid) and again server-side in the RPC.
  async function handleQidLookup(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const normalized = normalizeQid(regQid)
    if (!normalized) { setError(L('Qatar ID is required','الرقم الشخصي مطلوب')); setLoading(false); return }

    const { data, error } = await supabase.rpc('lookup_access_request_identity', { p_qid: normalized })
    setLoading(false)
    if (error) { setError(error.message); return }

    switch (data?.status) {
      case 'not_found':
        setError(L('No record was found for this Qatar ID. Please check the number, or contact the admin.','لم يتم العثور على سجل بهذا الرقم الشخصي. يرجى التحقق من الرقم، أو التواصل مع المسؤول.'))
        return
      case 'already_has_account':
        setError(L('An account already exists for this Qatar ID. Please sign in instead.','يوجد حساب مسجل بالفعل بهذا الرقم الشخصي. يرجى تسجيل الدخول.'))
        return
      case 'pending_request':
        setError(L('An access request for this Qatar ID is already pending admin approval.','يوجد طلب وصول بهذا الرقم الشخصي قيد المراجعة من قبل المسؤول بالفعل.'))
        return
      case 'rejected_previously':
        setError(L('A previous access request for this Qatar ID was not approved. Please contact the admin.','لم تتم الموافقة على طلب وصول سابق بهذا الرقم الشخصي. يرجى التواصل مع المسؤول.'))
        return
      case 'inactive':
        setError(L('This record is currently inactive. Please contact the admin.','هذا السجل غير نشط حالياً. يرجى التواصل مع المسؤول.'))
        return
      case 'invalid':
        setError(L('Please enter a valid Qatar ID.','يرجى إدخال رقم شخصي صحيح.'))
        return
      case 'found':
        setLookupCandidates(data.candidates || [])
        setRegStep('confirm')
        return
      default:
        setError(L('Something went wrong. Please try again.','حدث خطأ ما. يرجى المحاولة مرة أخرى.'))
    }
  }

  // ── STEP 2 -> 3: identity confirmed, move to password creation ──
  function confirmIdentity(candidate) {
    setSelectedCandidate(candidate)
    setRegStep('password')
    setError('')
  }

  // ── STEP 3: password creation + actual account request submission ──
  async function handleCreatePassword(e) {
    e.preventDefault()
    setLoading(true); setError('')
    if (regPassword !== regConfirmPassword) { setError(L('Passwords do not match','كلمات المرور غير متطابقة')); setLoading(false); return }
    if (regPassword.length < 6) { setError(L('Password must be at least 6 characters','كلمة المرور يجب أن تكون 6 أحرف على الأقل')); setLoading(false); return }

    const normalized = normalizeQid(regQid)
    const c = selectedCandidate
    // Only the Qatar ID and the role the user picked in Step 2 are sent —
    // ref_id/person_id/name from the Step 1 lookup are display-only and
    // are never trusted for the actual write; submit_access_request
    // re-derives and re-verifies all of that server-side.
    const claimedRole = c.role
    const displayName = ar && c.name_ar ? c.name_ar : c.name

    onSigningUpChange?.(true)
    const { data, error } = await supabase.auth.signUp({
      email: qidToEmail(normalized),
      password: regPassword,
      options: { data: { full_name: displayName, qid: normalized } }
    })
    if (error) {
      if (error.message?.includes('already registered') || error.status === 422) {
        setError(L('This QID is already registered. Please sign in instead.','هذا الرقم الشخصي مسجل بالفعل. يرجى تسجيل الدخول.'))
      } else {
        setError(error.message)
      }
      onSigningUpChange?.(false)
      setLoading(false); return
    }
    if (!data?.user) { onSigningUpChange?.(false); setError(L('Signup failed. Please try again.','فشل التسجيل. حاول مجدداً.')); setLoading(false); return }

    // Server-side re-verification + atomic write. Runs as the just-created
    // user (auth.uid() inside the function resolves to data.user.id via
    // the active session signUp() just produced) — the function itself
    // re-runs the Qatar ID lookup, confirms claimedRole genuinely matches
    // a record for this QID, rechecks for existing accounts/pending
    // requests, and only then inserts the profile row using server-
    // derived ref_id/person_id/name. Any mismatch is rejected outright.
    const { data: result, error: rpcError } = await supabase.rpc('submit_access_request', {
      p_qid: normalized,
      p_role: claimedRole,
    })

    if (rpcError) {
      setError(rpcError.message)
      onSigningUpChange?.(false)
      setLoading(false); return
    }

    switch (result?.status) {
      case 'role_mismatch':
        setError(L('Your identity could not be re-verified for the selected role. Please start again.','تعذر إعادة التحقق من هويتك للدور المحدد. يرجى البدء من جديد.'))
        onSigningUpChange?.(false); setLoading(false); return
      case 'already_has_account':
        setError(L('An account already exists for this Qatar ID. Please sign in instead.','يوجد حساب مسجل بالفعل بهذا الرقم الشخصي. يرجى تسجيل الدخول.'))
        onSigningUpChange?.(false); setLoading(false); return
      case 'pending_request':
        setError(L('An access request for this Qatar ID is already pending admin approval.','يوجد طلب وصول بهذا الرقم الشخصي قيد المراجعة من قبل المسؤول بالفعل.'))
        onSigningUpChange?.(false); setLoading(false); return
      case 'inactive':
        setError(L('This record is currently inactive. Please contact the admin.','هذا السجل غير نشط حالياً. يرجى التواصل مع المسؤول.'))
        onSigningUpChange?.(false); setLoading(false); return
      case 'invalid': case 'invalid_role': case 'not_authenticated':
        setError(L('Something went wrong. Please try again.','حدث خطأ ما. يرجى المحاولة مرة أخرى.'))
        onSigningUpChange?.(false); setLoading(false); return
      case 'created':
        break // fall through to admin notification below
      default:
        setError(L('Something went wrong. Please try again.','حدث خطأ ما. يرجى المحاولة مرة أخرى.'))
        onSigningUpChange?.(false); setLoading(false); return
    }

    const fullName = ar && result.name_ar ? result.name_ar : (result.name || displayName)

    // Notify every admin in-app that a new access request is waiting for review
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
    if (admins?.length > 0) {
      const typeLabel = ar ? (ROLE_LABEL[claimedRole]?.ar || claimedRole) : (ROLE_LABEL[claimedRole]?.en || claimedRole)
      await supabase.from('notifications').insert(
        admins.map(a => ({
          user_id: a.id,
          type: 'access_request',
          title: ar ? 'طلب وصول جديد' : 'New access request',
          body: ar ? `${fullName} (${typeLabel}) يطلب الوصول` : `${fullName} (${typeLabel}) is requesting access`,
          data: { applicant_id: data.user.id },
          read: false,
          category: 'Accounts', target_path: 'users', related_entity_type: 'profile', related_entity_id: data.user.id,
          dedup_key: `access-request-${data.user.id}-${a.id}`,
        }))
      )
    }
    setLoading(false)
    if (onRequestSent) onRequestSent()
    await supabase.auth.signOut()
    onSigningUpChange?.(false)
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
              <button key={m} onClick={() => { setMode(m); setError(''); if (m==='register') resetRegistration() }}
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
              <button type="button" onClick={onGuestMode} style={{ width:'100%', padding:'11px', background:'transparent', color:'var(--text2)', border:'1px solid var(--border)', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', marginTop:8 }}>
                <i className="ti ti-eye" style={{ marginInlineEnd:6 }} /> {L('Continue as Guest','المتابعة كضيف')}
              </button>
            </form>
          )}

          {/* Access Request — Step 1: Qatar ID lookup */}
          {mode === 'register' && regStep === 'qid' && (
            <form onSubmit={handleQidLookup}>
              <p style={{ fontSize:12.5, color:'var(--text3)', marginBottom:16, lineHeight:1.5 }}>
                {L('Enter your Qatar ID to look up your record. We will confirm your identity before creating a request.',
                   'أدخل رقمك الشخصي للبحث عن سجلك. سنقوم بتأكيد هويتك قبل إنشاء الطلب.')}
              </p>
              <div className="form-group">
                <label className="form-label">{L('Qatar ID (QID)','الرقم الشخصي QID')}</label>
                <input className="form-input" type="text" placeholder={L("e.g. 28412345678","مثال: 28412345678")} value={regQid} onChange={e=>setRegQid(e.target.value)} required autoFocus />
              </div>
              {error && <div style={{ color:'#EE334E', fontSize:13, marginBottom:12, padding:'8px 12px', background:'#EE334E15', borderRadius:8 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ width:'100%', padding:'11px', background:'#EE334E', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', marginTop:4 }}>
                {loading ? L('Searching…','جارٍ البحث…') : L('Continue','متابعة')}
              </button>
            </form>
          )}

          {/* Access Request — Step 2: identity confirmation. Only the
              minimal fields the RPC returns are shown; no phone, email,
              passport, or documents. */}
          {mode === 'register' && regStep === 'confirm' && (
            <div>
              <p style={{ fontSize:12.5, color:'var(--text3)', marginBottom:16, lineHeight:1.5 }}>
                {lookupCandidates.length > 1
                  ? L('We found more than one matching record. Please select which one is you.','وجدنا أكثر من سجل مطابق. يرجى اختيار السجل الخاص بك.')
                  : L('Please confirm this is you before continuing.','يرجى تأكيد أن هذا أنت قبل المتابعة.')}
              </p>
              {lookupCandidates.map((c, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px', border:'1px solid var(--border)', borderRadius:12, marginBottom:10 }}>
                  {c.photo_url
                    ? <img src={c.photo_url} alt="" style={{ width:48, height:48, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                    : <div style={{ width:48, height:48, borderRadius:'50%', background:'#0085C7', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, flexShrink:0 }}>
                        {(c.name||'?').charAt(0)}
                      </div>
                  }
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{c.name}</div>
                    {c.name_ar && <div style={{ fontSize:12.5, color:'var(--text2)' }}>{c.name_ar}</div>}
                    <div style={{ fontSize:11.5, color:'var(--text3)', marginTop:2 }}>
                      {ar ? (ROLE_LABEL[c.role]?.ar||c.role) : (ROLE_LABEL[c.role]?.en||c.role)}
                      {c.role === 'employee' && (c.designation || c.designation_ar) ? ` · ${ar && c.designation_ar ? c.designation_ar : c.designation}` : ''}
                      {(c.role === 'athlete' || c.role === 'coach') && c.sport ? ` · ${c.sport}` : ''}
                    </div>
                  </div>
                  <button type="button" onClick={() => confirmIdentity(c)}
                    style={{ padding:'8px 14px', background:'#0085C7', color:'#fff', border:'none', borderRadius:8, fontSize:12.5, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                    {L('This is me','هذا أنا')}
                  </button>
                </div>
              ))}
              <button type="button" onClick={resetRegistration}
                style={{ width:'100%', padding:'11px', background:'transparent', color:'var(--text2)', border:'1px solid var(--border)', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', marginTop:6 }}>
                {L('This is not me','هذا ليس أنا')}
              </button>
            </div>
          )}

          {/* Access Request — Step 3: password creation. Role/identity are
              already locked in from Step 2 — the user cannot edit them. */}
          {mode === 'register' && regStep === 'password' && selectedCandidate && (
            <form onSubmit={handleCreatePassword}>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--surface2)', borderRadius:10, marginBottom:16 }}>
                {selectedCandidate.photo_url
                  ? <img src={selectedCandidate.photo_url} alt="" style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                  : <div style={{ width:36, height:36, borderRadius:'50%', background:'#0085C7', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, flexShrink:0, fontSize:13 }}>
                      {(selectedCandidate.name||'?').charAt(0)}
                    </div>
                }
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{ar && selectedCandidate.name_ar ? selectedCandidate.name_ar : selectedCandidate.name}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{ar ? (ROLE_LABEL[selectedCandidate.role]?.ar||selectedCandidate.role) : (ROLE_LABEL[selectedCandidate.role]?.en||selectedCandidate.role)}</div>
                </div>
                <button type="button" onClick={resetRegistration} style={{ marginInlineStart:'auto', background:'none', border:'none', color:'#0085C7', fontSize:12, cursor:'pointer', flexShrink:0 }}>
                  {L('Change','تغيير')}
                </button>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{L('Password','كلمة المرور')}</label>
                  <input className="form-input" type="password" placeholder="••••••••" value={regPassword} onChange={e=>setRegPassword(e.target.value)} required autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">{L('Confirm Password','تأكيد كلمة المرور')}</label>
                  <input className="form-input" type="password" placeholder="••••••••" value={regConfirmPassword} onChange={e=>setRegConfirmPassword(e.target.value)} required />
                </div>
              </div>
              {error && <div style={{ color:'#EE334E', fontSize:13, marginBottom:12, padding:'8px 12px', background:'#EE334E15', borderRadius:8 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ width:'100%', padding:'11px', background:'#EE334E', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', marginTop:4 }}>
                {loading ? L('Submitting…','جارٍ الإرسال…') : L('Request Access','طلب الوصول')}
              </button>
              <p style={{ fontSize:11, color:'var(--text3)', textAlign:'center', marginTop:12, lineHeight:1.5 }}>
                {L('Your request will be reviewed by the admin. You will be notified once approved.',
                   'سيتم مراجعة طلبك من قبل المسؤول وستتلقى إشعاراً عند الموافقة.')}
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
