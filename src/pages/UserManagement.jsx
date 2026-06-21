import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast } from '../components/Toast'
import { Avatar } from '../lib/helpers'

const ROLE_COLORS  = { admin:'#EE334E', coach:'#0085C7', athlete:'#009F6B', guest:'#8b5cf6' }
const STATUS_COLORS = { active:'#009F6B', pending:'#f59e0b', rejected:'#EE334E' }


export default function UserManagement({ profile }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('pending') // pending | active | all
  const [rejReason, setRejReason] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*, coaches(name, name_ar), athletes(name, name_ar)')
      .order('requested_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  async function approve(user) {
    await supabase.from('profiles').update({
      status: 'active',
      role: user.account_type || user.role,
      account_type: user.account_type || user.role,  // keep in sync for legacy
      approved_at: new Date().toISOString(),
      approved_by: profile?.id,
    }).eq('id', user.id)
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'account_approved',
      title: ar ? 'تم قبول طلب الوصول' : 'Access request approved',
      body: ar ? 'تم تفعيل حسابك، يمكنك الآن تسجيل الدخول.' : 'Your account has been activated — you can now sign in.',
      data: {},
      read: false,
    })
    // Resolve the access_request notification(s) every admin received for this applicant
    const { data: pendingNotifs } = await supabase.from('notifications').select('id, data').eq('type', 'access_request')
    const toResolve = (pendingNotifs || []).filter(n => n.data?.applicant_id === user.id).map(n => n.id)
    if (toResolve.length > 0) await supabase.from('notifications').delete().in('id', toResolve)
    toast(L(`${user.full_name || user.email} approved`, `تمت الموافقة على ${user.full_name || ''}`))
    loadUsers()
  }

  async function reject(user) {
    const reason = rejReason[user.id] || ''
    await supabase.from('profiles').update({
      status: 'rejected',
      rejection_reason: reason,
    }).eq('id', user.id)
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'account_rejected',
      title: ar ? 'تحديث على طلب الوصول' : 'Access request update',
      body: reason
        ? (ar ? `لم تتم الموافقة على طلبك. السبب: ${reason}` : `Your request was not approved. Reason: ${reason}`)
        : (ar ? 'لم تتم الموافقة على طلبك في الوقت الحالي.' : 'Your request was not approved at this time.'),
      data: {},
      read: false,
    })
    // Resolve the access_request notification(s) every admin received for this applicant
    const { data: pendingNotifs } = await supabase.from('notifications').select('id, data').eq('type', 'access_request')
    const toResolve = (pendingNotifs || []).filter(n => n.data?.applicant_id === user.id).map(n => n.id)
    if (toResolve.length > 0) await supabase.from('notifications').delete().in('id', toResolve)
    toast(L('Request rejected', 'تم رفض الطلب'))
    loadUsers()
  }

  async function changeRole(userId, role) {
    await supabase.from('profiles').update({ role, account_type: role }).eq('id', userId)  // keep both in sync
    toast(L('Role updated', 'تم تحديث الدور'))
    loadUsers()
  }

  async function deactivate(userId) {
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', userId)
    toast(L('Account deactivated', 'تم إلغاء تفعيل الحساب'))
    loadUsers()
  }

  async function deleteAccount(userId) {
    // Delete from profiles table
    await supabase.from('profiles').delete().eq('id', userId)
    // Delete from Supabase Auth via serverless function
    try {
      await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
    } catch (e) {
      console.warn('Auth delete failed:', e)
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
          const roleColor   = ROLE_COLORS[u.account_type]   || '#9aa3b2'
          const statusColor = STATUS_COLORS[u.status] || '#9aa3b2'
          const linkedName  = u.account_type === 'coach'   ? (ar && u.coaches?.name_ar ? u.coaches.name_ar : u.coaches?.name)
                            : u.account_type === 'athlete' ? (ar && u.athletes?.name_ar ? u.athletes.name_ar : u.athletes?.name)
                            : null

          return (
            <div key={u.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:18, marginBottom:12, boxShadow:'var(--shadow)' }}>
              <div style={{ display:'flex', gap:14, alignItems:'flex-start', flexWrap:'wrap' }}>
                <Avatar name={u.full_name || u.email || '?'} id={u.id} size={44} fs={14} />
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ fontSize:15, fontWeight:700 }}>{u.full_name || L('(No name)','(بدون اسم)')}</div>
                  <div style={{ fontSize:13, color:'var(--text3)', marginTop:2 }}>{u.email}</div>
                  <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:roleColor+'20', color:roleColor }}>
                      {ar ? {'admin':'مسؤول','coach':'مدرب','athlete':'رياضي','guest':'زائر'}[u.account_type]||u.account_type : u.account_type}
                    </span>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:statusColor+'20', color:statusColor }}>
                      {ar ? {'active':'نشط','pending':'قيد الانتظار','rejected':'مرفوض'}[u.status]||u.status : u.status}
                    </span>
                    {linkedName && (
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, background:'var(--surface2)', color:'var(--text2)' }}>
                        <i className="ti ti-link" style={{ fontSize:10 }} /> {linkedName}
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

                {/* Actions */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-start' }}>
                  {u.status === 'pending' && (
                    <>
                      <button onClick={() => approve(u)}
                        style={{ padding:'7px 16px', background:'#009F6B', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
                        <i className="ti ti-check" /> {L('Approve','موافقة')}
                      </button>
                      <div style={{ display:'flex', gap:6 }}>
                        <input
                          placeholder={L('Rejection reason (optional)','سبب الرفض (اختياري)')}
                          value={rejReason[u.id]||''}
                          onChange={e => setRejReason(prev => ({...prev, [u.id]: e.target.value}))}
                          style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--surface)', color:'var(--text)', width:200 }}
                        />
                        <button onClick={() => reject(u)}
                          style={{ padding:'7px 14px', background:'#EE334E', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
                          <i className="ti ti-x" /> {L('Reject','رفض')}
                        </button>
                      </div>
                    </>
                  )}

                  {u.status === 'active' && (
                    <>
                      <select value={u.account_type||'guest'} onChange={e=>changeRole(u.id, e.target.value)}
                        style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:12, background:'var(--surface)', color:'var(--text)', cursor:'pointer' }}>
                        {['admin','coach','athlete','guest'].map(r=><option key={r} value={r}>{ar?{'admin':'مسؤول','coach':'مدرب','athlete':'رياضي','guest':'زائر'}[r]:r}</option>)}
                      </select>
                      <button onClick={() => deactivate(u.id)}
                        style={{ padding:'7px 14px', background:'var(--surface2)', color:'var(--text2)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, cursor:'pointer' }}>
                        <i className="ti ti-user-off" /> {L('Deactivate','إلغاء التفعيل')}
                      </button>
                    </>
                  )}

                  {u.status === 'rejected' && (
                    <>
                    <button onClick={() => approve(u)}
                      style={{ padding:'7px 14px', background:'var(--surface2)', color:'var(--text2)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, cursor:'pointer' }}>
                      <i className="ti ti-refresh" /> {L('Re-activate','إعادة التفعيل')}
                    </button>
                    <button onClick={() => setConfirmDelete(u)}
                      style={{ padding:'7px 14px', background:'#EE334E10', color:'#EE334E', border:'1px solid #EE334E40', borderRadius:8, fontSize:12, cursor:'pointer' }}>
                      <i className="ti ti-trash" /> {L('Delete account','حذف الحساب')}
                    </button>
                    </>
                  )}
                </div>
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
