import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast } from '../components/Toast'
import { Avatar } from '../lib/helpers'
import { isTrustedAdmin } from '../lib/permissions'
import { canEdit } from '../lib/useAuth'
import { logAdminActivity } from '../lib/adminActivity'

const ROLE_COLORS  = { admin:'#EE334E', readonly_admin:'#f59e0b', medical_staff:'#14b8a6', coach:'#0085C7', employee:'#8b5cf6', athlete:'#009F6B' }

// ── "Notify User" mailto builder ─────────────────────────────────────────
// Pure and self-contained on purpose: given the linked name/email already
// resolved above and the current interface language, produces a plain
// `mailto:` URL — no backend call, no stored draft, opens the Admin's own
// default email client with everything pre-filled. Recipient is left
// blank (not defaulted to anything) when no linked email is on file, per
// spec — the Admin can still send, just has to type the address in.
function buildApprovalMailto(name, email, ar) {
  const subject = ar
    ? 'تمت الموافقة على طلب الوصول إلى بوابة الاتحاد القطري لذوي الاحتياجات الخاصة'
    : 'QPC Portal Access Approved'
  const portalUrl = 'https://qpc-dashboard.vercel.app/'
  const displayName = name || (ar ? 'عزيزي المستخدم' : 'there')
  const body = ar
    ? `السلام عليكم ${displayName}،\n\nيسرنا إبلاغكم بأنه تمت الموافقة على طلب الوصول إلى بوابة الاتحاد القطري لذوي الاحتياجات الخاصة.\n\nيمكنكم الآن تسجيل الدخول باستخدام رقم البطاقة الشخصية القطرية وكلمة المرور التي قمتم بإنشائها أثناء طلب الوصول.\n\nرابط البوابة:\n${portalUrl}\n\nفي حال واجهتم أي مشكلة في تسجيل الدخول، يرجى التواصل مع الاتحاد القطري لذوي الاحتياجات الخاصة.\n\nمع خالص التحية،\nالاتحاد القطري لذوي الاحتياجات الخاصة`
    : `Hello ${displayName},\n\nWe are pleased to inform you that your request to access the Qatar Paralympic Committee Portal has been approved.\n\nYou may now sign in using your Qatar ID and the password you created during the access request process.\n\nPortal:\n${portalUrl}\n\nIf you experience any issues logging in, please contact the Qatar Paralympic Committee.\n\nKind regards,\nQatar Paralympic Committee`
  const to = email ? encodeURIComponent(email).replace(/%40/g, '@') : ''
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// ── Account-role source of truth ────────────────────────────────────────
// The ONLY four assignable account roles in this system. `employee` stays
// the canonical internal/database key (unchanged, per existing schema) —
// it is simply always labeled "Staff" in the UI. `guest` is intentionally
// excluded: guests have no account/profile row to manage here. `referee`
// is excluded too — not implemented as an account role yet.
const ACCOUNT_ROLES = ['admin', 'readonly_admin', 'medical_staff', 'coach', 'employee', 'athlete']
const ROLE_LABEL_EN = { admin: 'Admin', readonly_admin: 'Read-Only Admin', medical_staff: 'Medical Staff', coach: 'Coach', employee: 'Staff', athlete: 'Athlete' }
const ROLE_LABEL_AR = { admin: 'مسؤول', readonly_admin: 'مسؤول للعرض فقط', medical_staff: 'الكادر الطبي', coach: 'مدرب', employee: 'كادر', athlete: 'رياضي' }

// Never falls back to 'admin' (or anything else) for a missing/unrecognized
// value — returns null so callers can render an explicit "Unassigned/
// Unknown" state and the audit below can report it, instead of silently
// misrepresenting who actually has admin access.
function normalizeAccountRole(rawRole) {
  return ACCOUNT_ROLES.includes(rawRole) ? rawRole : null
}
const STATUS_COLORS = { active:'#009F6B', pending:'#f59e0b', rejected:'#EE334E' }


export default function UserManagement({ profile, initUserId }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState(initUserId ? 'all' : 'pending') // pending | active | all
  const [highlightId, setHighlightId] = useState(initUserId || null)
  const highlightRef = useRef(null)
  const [rejReason, setRejReason] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [actionPending, setActionPending] = useState({}) // userId -> true while approve/reject in flight

  useEffect(() => { loadUsers() }, [])

  // Keep this list/pending-count live for every admin who has it open —
  // if another admin approves/rejects a request from their own session,
  // this page previously had no way to find out until manually revisited
  // (loadUsers() only ran once on mount). Always re-reads current profiles
  // straight from Supabase, never a stale local count.
  useEffect(() => {
    const sub = supabase.channel('user-management-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadUsers)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  // Scroll to and briefly highlight the specific request the admin came here for
  useEffect(() => {
    if (!highlightId || loading) return
    const t = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    const clear = setTimeout(() => setHighlightId(null), 3000)
    return () => { clearTimeout(t); clearTimeout(clear) }
  }, [highlightId, loading])

  async function loadUsers() {
    setLoading(true)
    // profiles now has TWO foreign keys into coaches/athletes/employees
    // each (the normal <role>_id link, and the new support_<role>_id link
    // used only by the Support account's Role Preview test personas) —
    // PostgREST's embed shorthand `coaches(...)` became ambiguous the
    // moment the second FK was added and started erroring on every call,
    // which this code was silently swallowing (destructuring only `data`,
    // never `error`) and falling back to an empty array. Naming the exact
    // FK constraint for each embed resolves the ambiguity; the profiles.*
    // columns themselves were never affected — no support/test-persona
    // filtering has ever applied to this query.
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        coaches:coaches!profiles_coach_id_fkey(name, name_ar, email),
        athletes:athletes!profiles_athlete_id_fkey(name, name_ar, email),
        employees:employees!profiles_employee_id_fkey(name, name_ar, designation, designation_ar, status, email)
      `)
      .order('requested_at', { ascending: false })
    if (error) {
      console.error('[UserManagement] loadUsers failed:', error)
      toast(error.message, 'error')
      setUsers([])
      setLoading(false)
      return
    }
    setUsers(data || [])
    setLoading(false)
  }

  async function approve(user) {
    if (actionPending[user.id]) return
    setActionPending(prev => ({ ...prev, [user.id]: true }))
    try {
      await supabase.from('profiles').update({
        status: 'active',
        role: user.account_type || user.role,
        account_type: user.account_type || user.role,  // keep in sync for legacy
        approved_at: new Date().toISOString(),
        approved_by: profile?.id,
      }).eq('id', user.id)
      // Claim any tasks that were assigned to this person's Staff record
      // before they had an account (assigned_employee_id set, assigned_to
      // still null) — routed through a SECURITY DEFINER RPC rather than a
      // plain client-side update, since tasks' own RLS would otherwise
      // block any admin who isn't specifically a trusted admin from
      // setting someone ELSE's assigned_to. Idempotent — safe even if
      // approve() is somehow triggered twice for the same user.
      if (user.employee_id) {
        const { error: claimErr } = await supabase.rpc('claim_employee_tasks', { p_employee_id: user.employee_id, p_profile_id: user.id })
        if (claimErr) console.error('[tasks] failed claiming employee tasks on approve:', claimErr)
      }
      // Stable dedup_key means a second approve click (or a retried request)
      // can never insert a duplicate approval notification for this user.
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'account_approved',
        title: ar ? 'تم قبول طلب الوصول' : 'Access request approved',
        body: ar ? 'تم تفعيل حسابك، يمكنك الآن تسجيل الدخول.' : 'Your account has been activated — you can now sign in.',
        data: {},
        read: false,
        category: 'Accounts', target_path: 'dashboard', related_entity_type: 'profile', related_entity_id: user.id,
        dedup_key: `account-approved-${user.id}`,
      })
      if (notifErr) console.error('[notifications] failed to insert account_approved:', notifErr)
      // Resolve the access_request notification(s) every admin received for this
      // applicant, and remove any earlier account_rejected notification too —
      // if the account was previously rejected and is now approved, that old
      // rejection notice is stale and must not remain active.
      // Routed through a SECURITY DEFINER RPC rather than a plain client-side
      // delete: notifications' DELETE RLS is (user_id = auth.uid()), so a
      // direct delete here only ever actually removed the acting admin's OWN
      // copy — every other admin who'd received the same access_request
      // notification (e.g. Dina's support account, when Ahcene was the one
      // approving) kept it stuck forever with no error surfaced. The RPC
      // clears it for every admin who has a copy, scoped narrowly to this
      // one applicant_id.
      const { error: delErr1 } = await supabase.rpc('resolve_access_request_notifications', { p_applicant_id: user.id })
      if (delErr1) console.error('[notifications] failed clearing access_request on approve:', delErr1)
      toast(L(`${user.full_name || user.email} approved`, `تمت الموافقة على ${user.full_name || ''}`))
      if (isTrustedAdmin(profile)) {
        logAdminActivity({ actor: profile, action: 'approved', entityType: 'user', entityId: user.id, entityLabel: user.full_name || user.email, module: 'users' })
      }
      loadUsers()
    } finally {
      setActionPending(prev => { const next = { ...prev }; delete next[user.id]; return next })
    }
  }

  async function reject(user) {
    if (actionPending[user.id]) return
    setActionPending(prev => ({ ...prev, [user.id]: true }))
    try {
      const reason = rejReason[user.id] || ''
      await supabase.from('profiles').update({
        status: 'rejected',
        rejection_reason: reason,
      }).eq('id', user.id)
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'account_rejected',
        title: ar ? 'تحديث على طلب الوصول' : 'Access request update',
        body: reason
          ? (ar ? `لم تتم الموافقة على طلبك. السبب: ${reason}` : `Your request was not approved. Reason: ${reason}`)
          : (ar ? 'لم تتم الموافقة على طلبك في الوقت الحالي.' : 'Your request was not approved at this time.'),
        data: {},
        read: false,
        category: 'Accounts', target_path: 'dashboard', related_entity_type: 'profile', related_entity_id: user.id,
        dedup_key: `account-rejected-${user.id}`,
      })
      if (notifErr) console.error('[notifications] failed to insert account_rejected:', notifErr)
      // Resolve the original access_request, and remove any earlier
      // account_approved notification — if a previously-approved account is
      // now being rejected, that old approval notice is stale. Same RPC as
      // approve() above, for the same RLS reason (see comment there).
      const { error: delErr1 } = await supabase.rpc('resolve_access_request_notifications', { p_applicant_id: user.id })
      if (delErr1) console.error('[notifications] failed clearing access_request on reject:', delErr1)
      toast(L('Request rejected', 'تم رفض الطلب'))
      if (isTrustedAdmin(profile)) {
        logAdminActivity({ actor: profile, action: 'rejected', entityType: 'user', entityId: user.id, entityLabel: user.full_name || user.email, module: 'users' })
      }
      loadUsers()
    } finally {
      setActionPending(prev => { const next = { ...prev }; delete next[user.id]; return next })
    }
  }

  async function changeRole(userId, role) {
    const target = users.find(u => u.id === userId)
    await supabase.from('profiles').update({ role, account_type: role }).eq('id', userId)  // keep both in sync
    toast(L('Role updated', 'تم تحديث الدور'))
    if (isTrustedAdmin(profile)) {
      logAdminActivity({ actor: profile, action: 'role_changed', entityType: 'user', entityId: userId, entityLabel: target?.full_name || target?.email || String(userId), module: 'users', metadata: { new_role: role } })
    }
    loadUsers()
  }

  async function deactivate(userId) {
    const target = users.find(u => u.id === userId)
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', userId)
    toast(L('Account deactivated', 'تم إلغاء تفعيل الحساب'))
    if (isTrustedAdmin(profile)) {
      logAdminActivity({ actor: profile, action: 'status_changed', entityType: 'user', entityId: userId, entityLabel: target?.full_name || target?.email || String(userId), module: 'users', metadata: { new_status: 'rejected' } })
    }
    loadUsers()
  }

  async function deleteAccount(userId) {
    // Delete the Auth user (and its profile row, as a backstop) via the
    // delete-user edge function. Previously this called a Vercel API route
    // that depended on an env var that was never actually set, so it silently
    // failed every time — leaving the auth account behind even though the UI
    // said "deleted." That meant the same QID could never register again,
    // since Supabase Auth still considered it taken. Now the failure is
    // visible instead of swallowed, so it's never a silent surprise again.
    const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId } })
    if (error || data?.error) {
      toast(L('Failed to fully delete account — please try again or contact support', 'فشل حذف الحساب بالكامل — يرجى المحاولة مرة أخرى أو التواصل مع الدعم'), 'error')
      console.error('delete-user error:', error || data?.error)
      return
    }
    toast(L('Account deleted', 'تم حذف الحساب'))
    setConfirmDelete(null)
    loadUsers()
  }

  const filtered = users.filter(u => {
    if (filter === 'pending') return u.status === 'pending'
    if (filter === 'active')  return u.status === 'active'
    return true
  })

  const pendingCount = users.filter(u => u.status === 'pending').length

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{L('User Management','إدارة المستخدمين')}</div>
          <div className="page-sub">{users.length} {L('total users','مستخدم إجمالاً')}</div>
        </div>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <div style={{ background:'#f59e0b15', border:'1px solid #f59e0b40', borderRadius:12, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <i className="ti ti-bell-ringing" style={{ color:'#f59e0b', fontSize:18 }} />
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#f59e0b' }}>
              {pendingCount} {L('pending request(s) awaiting approval','طلب(ات) في انتظار الموافقة')}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>
              {L('Click "Pending" tab to review','انقر على تبويب "قيد الانتظار" للمراجعة')}
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="pill-filters" style={{ marginBottom:16 }}>
        {[['pending', L('Pending','قيد الانتظار'), pendingCount], ['active', L('Active','نشط'), users.filter(u=>u.status==='active').length], ['all', L('All','الكل'), users.length]].map(([val, lbl, count]) => (
          <button key={val} className={`pill${filter===val?' active':''}`} onClick={() => setFilter(val)}>
            {lbl} <span style={{ marginLeft:5, background: filter===val?'rgba(255,255,255,.3)':'var(--surface2)', borderRadius:20, padding:'1px 7px', fontSize:11 }}>{count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">{L('No requests','لا توجد طلبات')}</div>
      ) : (
        filtered.map(u => {
          const normRole    = normalizeAccountRole(u.account_type)
          const roleColor   = normRole ? ROLE_COLORS[normRole] : '#9aa3b2'
          const statusColor = STATUS_COLORS[u.status] || '#9aa3b2'
          const linkedName  = u.account_type === 'coach'   ? (ar && u.coaches?.name_ar ? u.coaches.name_ar : u.coaches?.name)
                            : u.account_type === 'athlete' ? (ar && u.athletes?.name_ar ? u.athletes.name_ar : u.athletes?.name)
                            : (u.account_type === 'employee' || u.account_type === 'medical_staff') ? (ar && u.employees?.name_ar ? u.employees.name_ar : u.employees?.name)
                            : null
          // Auto-populated recipient for "Notify User" below — pulled from
          // whichever linked record (Athlete/Coach/Staff) this account
          // maps to. Never required: left undefined when the linked
          // record has no email on file, so the mailto: link still opens
          // with an empty To field for the Admin to fill in.
          const linkedEmail = u.account_type === 'coach'   ? u.coaches?.email
                            : u.account_type === 'athlete' ? u.athletes?.email
                            : (u.account_type === 'employee' || u.account_type === 'medical_staff') ? u.employees?.email
                            : null
          // Employee approvals additionally show designation + the linked
          // employee record's own status, per the employee signup review
          // requirements — Coach/Athlete only ever showed the linked name.
          const linkedExtra = (u.account_type === 'employee' || u.account_type === 'medical_staff') && u.employees
            ? [
                ar ? (u.employees.designation_ar || u.employees.designation) : u.employees.designation,
                u.employees.status,
              ].filter(Boolean).join(' · ')
            : null

          return (
            <div key={u.id} ref={u.id === highlightId ? highlightRef : null}
              style={{ background:'var(--surface)', border: u.id === highlightId ? '2px solid #0085C7' : '1px solid var(--border)', borderRadius:14, padding:18, marginBottom:12, boxShadow: u.id === highlightId ? '0 0 0 4px #0085C720' : 'var(--shadow)', transition:'border .3s, box-shadow .3s' }}>
              <div style={{ display:'flex', gap:14, alignItems:'flex-start', flexWrap:'wrap' }}>
                <Avatar name={u.full_name || u.email || '?'} id={u.id} size={44} fs={14} />
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ fontSize:15, fontWeight:700 }}>{u.full_name || L('(No name)','(بدون اسم)')}</div>
                  <div style={{ fontSize:13, color:'var(--text3)', marginTop:2 }}>{u.email}</div>
                  <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:roleColor+'20', color:roleColor }}>
                      {normRole ? (ar ? ROLE_LABEL_AR[normRole] : ROLE_LABEL_EN[normRole]) : L('Unassigned','غير محدد')}
                    </span>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:statusColor+'20', color:statusColor }}>
                      {ar ? {'active':'نشط','pending':'قيد الانتظار','rejected':'مرفوض'}[u.status]||u.status : u.status}
                    </span>
                    {linkedName && (
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, background:'var(--surface2)', color:'var(--text2)' }}>
                        <i className="ti ti-link" style={{ fontSize:10 }} /> {linkedName}
                      </span>
                    )}
                    {linkedExtra && (
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, background:'var(--surface2)', color:'var(--text2)' }}>
                        <i className="ti ti-id-badge-2" style={{ fontSize:10 }} /> {linkedExtra}
                      </span>
                    )}
                  </div>
                  {u.requested_at && (
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>
                      {L('Requested','طُلب في')} {new Date(u.requested_at).toLocaleDateString(ar?'ar-QA':'en-GB')}
                    </div>
                  )}
                  {u.approved_at && (
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      {L('Approved','موافقة في')} {new Date(u.approved_at).toLocaleDateString(ar?'ar-QA':'en-GB')}
                    </div>
                  )}
                </div>

                {/* Actions — write-only, hidden entirely for Read-Only Admin.
                    This is a UX convenience, not the real enforcement: every
                    approve/reject/role-change/deactivate/delete call above
                    still hits Supabase RLS policies that check
                    profiles.role = 'admin' literally, so a readonly_admin
                    account could never perform these even by calling the
                    same functions directly. */}
                {canEdit(profile) ? (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-start' }}>
                  {u.status === 'pending' && (
                    <>
                      <button onClick={() => approve(u)} disabled={!!actionPending[u.id]}
                        style={{ padding:'7px 16px', background:'#009F6B', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: actionPending[u.id] ? 'default' : 'pointer', opacity: actionPending[u.id] ? .6 : 1, display:'flex', alignItems:'center', gap:5 }}>
                        <i className="ti ti-check" /> {L('Approve','موافقة')}
                      </button>
                      <div style={{ display:'flex', gap:6 }}>
                        <input
                          placeholder={L('Rejection reason (optional)','سبب الرفض (اختياري)')}
                          value={rejReason[u.id]||''}
                          onChange={e => setRejReason(prev => ({...prev, [u.id]: e.target.value}))}
                          style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--surface)', color:'var(--text)', width:200 }}
                        />
                        <button onClick={() => reject(u)} disabled={!!actionPending[u.id]}
                          style={{ padding:'7px 14px', background:'#EE334E', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: actionPending[u.id] ? 'default' : 'pointer', opacity: actionPending[u.id] ? .6 : 1, display:'flex', alignItems:'center', gap:5 }}>
                          <i className="ti ti-x" /> {L('Reject','رفض')}
                        </button>
                      </div>
                    </>
                  )}

                  {u.status === 'active' && (
                    <>
                      <select value={normRole || ''} onChange={e=>changeRole(u.id, e.target.value)}
                        style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--surface)', color:'var(--text)', cursor:'pointer' }}>
                        {/* Explicit placeholder so a missing/unrecognized role never
                            visually renders as whichever role happens to be first in
                            the list (the browser's native <select> behavior when
                            `value` doesn't match any <option> — this, combined with
                            "Staff" being entirely absent from the old option list,
                            is exactly why Staff accounts were rendering as "Admin":
                            value="employee" matched no <option>, so the browser fell
                            back to displaying the first one, admin.) An Admin must
                            explicitly pick a role to clear this — it's never implied. */}
                        {!normRole && <option value="" disabled>{L('Unassigned — select a role','غير محدد — اختر دوراً')}</option>}
                        {ACCOUNT_ROLES.map(r=><option key={r} value={r}>{ar?ROLE_LABEL_AR[r]:ROLE_LABEL_EN[r]}</option>)}
                      </select>
                      <button onClick={() => deactivate(u.id)}
                        style={{ padding:'7px 14px', background:'var(--surface2)', color:'var(--text2)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, cursor:'pointer' }}>
                        <i className="ti ti-user-off" /> {L('Deactivate','إلغاء التفعيل')}
                      </button>
                      {/* Shown only once approval is complete (u.status === 'active'
                          branch) — never for a still-pending request. Opens the
                          Admin's own default mail client via mailto:, pre-filled
                          with the linked record's email (blank if none) and the
                          approval message. No email is sent by the app itself. */}
                      <a href={buildApprovalMailto(linkedName, linkedEmail, ar)}
                        style={{ padding:'7px 14px', background:'#0085C710', color:'#0085C7', border:'1px solid #0085C740', borderRadius:8, fontSize:12, cursor:'pointer', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:5 }}>
                        <i className="ti ti-mail" /> {L('Notify User','إشعار المستخدم')}
                      </a>
                    </>
                  )}

                  {u.status === 'rejected' && (
                    <>
                    <button onClick={() => approve(u)} disabled={!!actionPending[u.id]}
                      style={{ padding:'7px 14px', background:'var(--surface2)', color:'var(--text2)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, cursor: actionPending[u.id] ? 'default' : 'pointer', opacity: actionPending[u.id] ? .6 : 1 }}>
                      <i className="ti ti-refresh" /> {L('Re-activate','إعادة التفعيل')}
                    </button>
                    <button onClick={() => setConfirmDelete(u)}
                      style={{ padding:'7px 14px', background:'#EE334E10', color:'#EE334E', border:'1px solid #EE334E40', borderRadius:8, fontSize:12, cursor:'pointer' }}>
                      <i className="ti ti-trash" /> {L('Delete account','حذف الحساب')}
                    </button>
                    </>
                  )}
                </div>
                ) : (
                  <div style={{ fontSize:11, color:'var(--text3)', fontStyle:'italic', padding:'6px 0' }}>
                    <i className="ti ti-eye" style={{ marginInlineEnd:4 }} /> {L('View only','عرض فقط')}
                  </div>
                )}
              </div>

              {u.rejection_reason && (
                <div style={{ marginTop:10, padding:'8px 12px', background:'#EE334E10', borderRadius:8, fontSize:12, color:'#EE334E' }}>
                  <i className="ti ti-alert-circle" /> {L('Rejection reason:','سبب الرفض:')} {u.rejection_reason}
                </div>
              )}
            </div>
          )
        })
      )}
    {/* Delete confirmation modal */}
    {confirmDelete && (
      <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
        <div className="modal-box" style={{ maxWidth:400 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title" style={{ color:'#EE334E' }}>
              <i className="ti ti-alert-triangle" /> {L('Delete Account','حذف الحساب')}
            </div>
            <button className="modal-close" onClick={() => setConfirmDelete(null)}><i className="ti ti-x" /></button>
          </div>
          <div className="modal-body">
            <p style={{ fontSize:14, color:'var(--text)', marginBottom:8 }}>
              {L('Are you sure you want to permanently delete this account?','هل أنت متأكد من حذف هذا الحساب نهائياً؟')}
            </p>
            <div style={{ background:'var(--surface2)', borderRadius:10, padding:'10px 14px', fontSize:13 }}>
              <div style={{ fontWeight:600 }}>{confirmDelete.full_name || L('Unknown','غير معروف')}</div>
              <div style={{ color:'var(--text3)', fontSize:12, marginTop:2 }}>{confirmDelete.email} · {confirmDelete.account_type}</div>
            </div>
            <p style={{ fontSize:12, color:'#EE334E', marginTop:10 }}>
              <i className="ti ti-alert-circle" /> {L('This action cannot be undone.','لا يمكن التراجع عن هذا الإجراء.')}
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={() => setConfirmDelete(null)}>{L('Cancel','إلغاء')}</button>
            <button className="btn" style={{ background:'#EE334E' }} onClick={() => deleteAccount(confirmDelete.id)}>
              <i className="ti ti-trash" /> {L('Yes, delete','نعم، احذف')}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}
