import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast, ConfirmModal } from '../components/Toast'
import { Avatar, initials } from '../lib/helpers'
import { isMainAdminEmail } from '../lib/permissions'

const STATUSES = ['todo', 'in_progress', 'done']
const STATUS_META = {
  todo:        { en: 'To Do',        ar: 'للقيام به',     color: '#9aa3b2' },
  in_progress: { en: 'In Progress',  ar: 'قيد التنفيذ',   color: '#0085C7' },
  done:        { en: 'Done',         ar: 'مكتمل',         color: '#009F6B' },
}
const PRIORITY_META = {
  critical: { en: 'Critical', ar: 'حرجة',    color: '#EE334E' },
  high:     { en: 'High',     ar: 'عالية',   color: '#e67e22' },
  moderate: { en: 'Moderate', ar: 'متوسطة',  color: '#f1c40f' },
  low:      { en: 'Low',      ar: 'منخفضة',  color: '#009F6B' },
  minor:    { en: 'Minor',    ar: 'طفيفة',   color: '#0085C7' },
}

const CATEGORY_META = {
  administrative: { en: 'Administrative', ar: 'إداري',      color: '#64748b', icon: 'ti-clipboard-list' },
  competition:    { en: 'Competition',    ar: 'منافسة',     color: '#d4af37', icon: 'ti-medal' },
  logistics:      { en: 'Logistics',      ar: 'لوجستيات',   color: '#0d9488', icon: 'ti-bus' },
  technical:      { en: 'Technical',      ar: 'تقني',       color: '#8b5cf6', icon: 'ti-settings' },
  meeting:        { en: 'Meeting',        ar: 'اجتماع',     color: '#0085C7', icon: 'ti-users-group' },
  report:         { en: 'Report',         ar: 'تقرير',      color: '#4f46e5', icon: 'ti-file-text' },
  email:          { en: 'Email',          ar: 'بريد إلكتروني', color: '#e11d8f', icon: 'ti-send' },
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function daysUntilDue(task) {
  if (!task.due_date) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const due = new Date(task.due_date); due.setHours(0,0,0,0)
  return Math.round((due - today) / 86400000)
}
function isOverdue(task) {
  if (!task.due_date || task.status === 'done') return false
  return task.due_date < localDateStr(new Date())
}
function isDueToday(task) {
  if (!task.due_date || task.status === 'done') return false
  return daysUntilDue(task) === 0
}
function isDueSoon(task) {
  if (!task.due_date || task.status === 'done') return false
  const d = daysUntilDue(task)
  return d === 1 || d === 2
}

function formatDue(dateStr, ar) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(ar ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'short' })
}

function idHash(str) {
  let h = 0
  for (let i = 0; i < (str || '').length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0 }
  return Math.abs(h)
}

export default function Tasks({ profile, isMainAdmin, onNav }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'

  const [tasks, setTasks]       = useState([])
  const [eligible, setEligible] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [viewScope, setViewScope] = useState('mine')
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [archivedTasks, setArchivedTasks] = useState([])
  const [archivedLoading, setArchivedLoading] = useState(false)
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [editing, setEditing]   = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [form, setForm] = useState({ title: '', notes: '', priority: 'moderate', category: '', dueDate: '', status: 'todo', assignedTo: profile?.id || '', notifyOnComplete: false })

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('tasks').select('*').eq('archived', false).order('created_at', { ascending: false })
    if (error) { toast(error.message, 'error'); setLoading(false); return }
    setTasks(data || [])
    setLoading(false)
  }

  async function archiveTask(id) {
    const { error } = await supabase.from('tasks').update({ archived: true }).eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    setTasks(prev => prev.filter(t => t.id !== id))
    toast(ar ? 'تمت الأرشفة' : 'Archived')
  }

  async function archiveAllDone() {
    const doneIds = scoped.filter(t => t.status === 'done').map(t => t.id)
    if (doneIds.length === 0) return
    const { error } = await supabase.from('tasks').update({ archived: true }).in('id', doneIds)
    if (error) { toast(error.message, 'error'); return }
    setTasks(prev => prev.filter(t => !doneIds.includes(t.id)))
    toast(ar ? `تمت أرشفة ${doneIds.length}` : `Archived ${doneIds.length}`)
  }

  async function loadArchived() {
    setArchivedLoading(true)
    let q = supabase.from('tasks').select('*').eq('archived', true).order('updated_at', { ascending: false })
    if (!isMainAdmin) q = q.eq('assigned_to', profile?.id)
    const { data, error } = await q
    if (error) { toast(error.message, 'error'); setArchivedLoading(false); return }
    setArchivedTasks(data || [])
    setArchivedLoading(false)
  }

  async function unarchiveTask(id) {
    const { error } = await supabase.from('tasks').update({ archived: false }).eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    setArchivedTasks(prev => prev.filter(t => t.id !== id))
    toast(ar ? 'تم إلغاء الأرشفة' : 'Unarchived')
    await load()
  }

  async function loadEligible() {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, account_type, status, employee_id')
      .eq('status', 'active')
    const list = (data || []).filter(p => {
      const isMain = isMainAdminEmail(p.email)
      if (isMain) return true
      if (!['admin', 'employee', 'coach'].includes(p.account_type || p.role)) return false
      if (!p.employee_id) return false
      if (!p.full_name || !p.full_name.trim()) return false
      return true
    })
    setEligible(list)
  }

  useEffect(() => { load(); loadEligible() }, [])

  function assigneeLabel(p) {
    if (!p) return ''
    if (p.full_name && p.full_name.trim()) return p.full_name.trim()
    if (p.email && !/^COACH-\d+$/.test(p.email)) return p.email
    return ar ? 'مستخدم' : 'User'
  }
  function findAssignee(id) { return eligible.find(p => p.id === id) }

  const scoped = isMainAdmin
    ? (viewScope === 'all' ? tasks : tasks.filter(t => t.assigned_to === profile?.id))
    : tasks.filter(t => t.assigned_to === profile?.id)

  const filtered = scoped.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !(t.notes||'').toLowerCase().includes(search.toLowerCase())) return false
    if (isMainAdmin && viewScope === 'all' && assigneeFilter !== 'all' && t.assigned_to !== assigneeFilter) return false
    if (categoryFilter !== 'all' && (t.category || '') !== categoryFilter) return false
    return true
  })

  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = filtered.filter(t => t.status === s).sort((a, b) => {
      const aOver = isOverdue(a), bOver = isOverdue(b)
      if (aOver !== bOver) return aOver ? -1 : 1
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return b.created_at.localeCompare(a.created_at)
    })
    return acc
  }, {})

  const summary = {
    todo: scoped.filter(t => t.status === 'todo').length,
    in_progress: scoped.filter(t => t.status === 'in_progress').length,
    done: scoped.filter(t => t.status === 'done').length,
    overdue: scoped.filter(isOverdue).length,
  }

  function openEdit(task) {
    setForm({
      title: task.title,
      notes: task.notes || '',
      priority: task.priority,
      category: task.category || '',
      dueDate: task.due_date || '',
      status: task.status,
      assignedTo: task.assigned_to || profile?.id || '',
      notifyOnComplete: !!task.notify_on_complete,
    })
    setEditing(task)
  }

  function openNew() {
    setForm({ title: '', notes: '', priority: 'moderate', category: '', dueDate: '', status: 'todo', assignedTo: profile?.id || '', notifyOnComplete: false })
    setEditing('new')
  }

  async function handleSave() {
    if (!form.title.trim()) { toast(ar ? 'العنوان مطلوب' : 'Title is required', 'error'); return }
    const assignedTo = isMainAdmin ? (form.assignedTo || profile?.id) : profile?.id
    const payload = {
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      priority: form.priority,
      category: form.category || null,
      due_date: form.dueDate || null,
      status: form.status,
      assigned_to: assignedTo,
      notify_on_complete: form.notifyOnComplete,
      completed_at: form.status === 'done' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    let error
    const dueDateChanged = editing !== 'new' && editing.due_date !== payload.due_date
    const justCompleted = editing !== 'new' && editing.status !== 'done' && payload.status === 'done'
    if (editing === 'new') {
      ;({ error } = await supabase.from('tasks').insert({ ...payload, created_by: profile?.id || null }))
    } else {
      ;({ error } = await supabase.from('tasks').update(payload).eq('id', editing.id))
    }
    if (error) { toast(error.message, 'error'); return }
    if (dueDateChanged) {
      await supabase.from('notifications').delete().eq('related_entity_type', 'task').eq('related_entity_id', editing.id)
    }
    if (justCompleted) await notifyCompletionIfRequested(editing.id, payload)
    toast(editing === 'new' ? (ar ? 'تمت إضافة المهمة' : 'Task added') : (ar ? 'تم حفظ التغييرات' : 'Task updated'))
    setEditing(null)
    await load()
  }

  async function notifyCompletionIfRequested(taskId, payload) {
    if (!payload.notify_on_complete) return
    // Uses the same centralized main-admin identification as everywhere
    // else, rather than a locally hardcoded email literal.
    const { data: allActive } = await supabase.from('profiles').select('id, email').eq('status', 'active')
    const mainAdmins = (allActive || []).filter(p => isMainAdminEmail(p.email))
    const mainAdminId = mainAdmins?.[0]?.id
    if (!mainAdminId || mainAdminId === profile?.id) return
    const { error } = await supabase.from('notifications').insert({
      user_id: mainAdminId,
      type: 'task_completed',
      title: ar ? 'اكتملت المهمة' : 'Task completed',
      body: ar ? `${profile?.full_name || ''} أكمل: ${payload.title}` : `${profile?.full_name || 'A user'} completed: ${payload.title}`,
      data: {},
      read: false,
      category: 'Tasks', target_path: 'tasks', related_entity_type: 'task', related_entity_id: taskId,
    })
    if (error) console.error('[notifications] failed to insert task_completed:', error)
  }

  async function setStatus(task, status) {
    const wasNotDone = task.status !== 'done'
    const { error } = await supabase.from('tasks').update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', task.id)
    if (error) { toast(error.message, 'error'); return }
    if (status === 'done') {
      await supabase.from('notifications').delete().eq('related_entity_type', 'task').eq('related_entity_id', task.id)
      if (wasNotDone) await notifyCompletionIfRequested(task.id, { ...task, notify_on_complete: task.notify_on_complete })
    }
    await load()
  }

  async function handleDelete(task) {
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) { toast(error.message, 'error'); return }
    toast(ar ? 'تم حذف المهمة' : 'Task deleted')
    setConfirmDel(null)
    await load()
  }

  const hasActiveFilters = search || (isMainAdmin && viewScope === 'all' && assigneeFilter !== 'all') || categoryFilter !== 'all'
  function clearFilters() { setSearch(''); setAssigneeFilter('all'); setCategoryFilter('all') }

  return (
    <div>
      {confirmDel && (
        <ConfirmModal
          title={ar ? 'حذف المهمة' : 'Delete task'}
          message={`${ar ? 'حذف' : 'Delete'} "${confirmDel.title}"?`}
          onConfirm={() => handleDelete(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editing === 'new' ? (ar ? 'مهمة جديدة' : 'New Task') : (ar ? 'تعديل المهمة' : 'Edit Task')}</div>
              <button className="modal-close" onClick={() => setEditing(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{ar ? 'العنوان' : 'Title'} *</label>
                <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label>{ar ? 'ملاحظات' : 'Notes'}</label>
                <textarea className="form-input" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>

              {isMainAdmin && (
                <div className="form-group">
                  <label>{ar ? 'مُسندة إلى' : 'Assigned To'}</label>
                  <select className="form-input" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}>
                    {eligible.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.id === profile?.id ? (ar ? `نفسي (${assigneeLabel(p)})` : `Myself (${assigneeLabel(p)})`) : assigneeLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.assignedTo && form.assignedTo !== profile?.id && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text2)', marginBottom: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.notifyOnComplete} onChange={e => setForm(f => ({ ...f, notifyOnComplete: e.target.checked }))} />
                  {ar ? 'إعلام المسؤول الرئيسي عند إكمال هذه المهمة' : 'Let the main admin know when this task is completed'}
                </label>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>{ar ? 'الأولوية' : 'Priority'}</label>
                  <select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {Object.keys(PRIORITY_META).map(p => <option key={p} value={p}>{ar ? PRIORITY_META[p].ar : PRIORITY_META[p].en}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{ar ? 'تاريخ الاستحقاق' : 'Due date'}</label>
                  <input className="form-input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>{ar ? 'الفئة' : 'Category'}</label>
                <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="">{ar ? '— بدون فئة —' : '— No category —'}</option>
                  {Object.keys(CATEGORY_META).map(c => <option key={c} value={c}>{ar ? CATEGORY_META[c].ar : CATEGORY_META[c].en}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>{ar ? 'الحالة' : 'Status'}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {STATUSES.map(s => {
                    const active = form.status === s
                    return (
                      <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                        style={{
                          flex: 1, padding: '8px 10px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${active ? STATUS_META[s].color : 'var(--border)'}`,
                          background: active ? STATUS_META[s].color + '15' : 'var(--surface)',
                          color: active ? STATUS_META[s].color : 'var(--text2)',
                        }}>
                        {ar ? STATUS_META[s].ar : STATUS_META[s].en}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {editing !== 'new' && (
                <button className="btn-cancel" onClick={() => { setConfirmDel(editing); setEditing(null) }} style={{ color: '#dc2626', marginRight: 'auto' }}>
                  {ar ? 'حذف' : 'Delete'}
                </button>
              )}
              <button className="btn-cancel" onClick={() => setEditing(null)}>{tx('actions.cancel','Cancel')}</button>
              <button className="btn btn-blue" onClick={handleSave}>{ar ? 'حفظ' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">{tx('nav.tasks','Tasks')}</div>
          <div className="page-sub">{ar ? 'تتبع كل ما يحتاج إلى متابعة' : 'Track what needs follow-up'}</div>
        </div>
        <button className="btn btn-blue" onClick={openNew}>
          <i className="ti ti-plus" /> {ar ? 'مهمة جديدة' : 'New Task'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {isMainAdmin && (
          <div style={{ display: 'flex', gap: 6, background: 'var(--surface2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {[['mine', ar ? 'مهامي' : 'My Tasks'], ['all', ar ? 'كل المهام' : 'All Tasks']].map(([key, label]) => (
              <button key={key} onClick={() => { setViewScope(key); if (key !== 'all') setAssigneeFilter('all') }}
                style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: viewScope === key ? 'var(--surface)' : 'transparent',
                  color: viewScope === key ? 'var(--text)' : 'var(--text3)',
                  boxShadow: viewScope === key ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
                {label}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => { setArchivedOpen(true); loadArchived() }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <i className="ti ti-archive" style={{ fontSize: 13 }} /> {ar ? 'الأرشيف' : 'Archived'}
        </button>
      </div>

      {archivedOpen && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setArchivedOpen(false) }}>
          <div className="modal-box" style={{ width: 560 }}>
            <div className="modal-header">
              <div className="modal-title">{ar ? 'المهام المؤرشفة' : 'Archived Tasks'}</div>
              <button className="modal-close" onClick={() => setArchivedOpen(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              {archivedLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{ar ? 'جارٍ التحميل…' : 'Loading…'}</div>
              ) : archivedTasks.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{ar ? 'لا توجد مهام مؤرشفة' : 'No archived tasks'}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {archivedTasks.map(task => (
                    <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{task.category || ''}</div>
                      </div>
                      <button onClick={() => unarchiveTask(task.id)}
                        style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, padding: '5px 12px', borderRadius: 20, border: '1px solid #0085C7', background: 'rgba(0,133,199,.08)', color: '#0085C7', cursor: 'pointer' }}>
                        {ar ? 'إلغاء الأرشفة' : 'Unarchive'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          ['todo', STATUS_META.todo.color, summary.todo],
          ['in_progress', STATUS_META.in_progress.color, summary.in_progress],
          ['done', STATUS_META.done.color, summary.done],
          ['overdue', '#EE334E', summary.overdue],
        ].map(([key, color, count]) => (
          <div key={key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.03em' }}>
              {key === 'overdue' ? (ar ? 'متأخرة' : 'Overdue') : (ar ? STATUS_META[key].ar : STATUS_META[key].en)}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{count}</div>
          </div>
        ))}
      </div>

      <div className="filters" style={{ flexWrap: 'wrap' }}>
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder={ar ? 'بحث في المهام...' : 'Search tasks…'} value={search} onChange={e => setSearch(e.target.value)} /></div>
        {isMainAdmin && viewScope === 'all' && (
          <select className="form-input" style={{ width: 'auto' }} value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}>
            <option value="all">{ar ? 'كل المسؤولين' : 'All assignees'}</option>
            {eligible.map(p => <option key={p.id} value={p.id}>{p.id === profile?.id ? (ar ? 'نفسي' : 'Myself') : assigneeLabel(p)}</option>)}
          </select>
        )}
        <select className="form-input" style={{ width: 'auto' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="all">{ar ? 'كل الفئات' : 'All categories'}</option>
          {Object.keys(CATEGORY_META).map(c => <option key={c} value={c}>{ar ? CATEGORY_META[c].ar : CATEGORY_META[c].en}</option>)}
        </select>
        {hasActiveFilters && (
          <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 9, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <i className="ti ti-x" style={{ fontSize: 13 }} /> {ar ? 'مسح الفلاتر' : 'Clear Filters'}
          </button>
        )}
      </div>

      {loading && <div className="empty" style={{ padding:24 }}>{ar ? 'جارٍ التحميل...' : 'Loading…'}</div>}

      {!loading && scoped.length === 0 && (
        <div className="empty" style={{ padding:'40px 24px', textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:14, background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
            <i className="ti ti-checklist" style={{ fontSize:26, color:'var(--text3)' }} />
          </div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>{ar ? 'لا توجد مهام بعد' : 'No tasks yet'}</div>
          <div style={{ fontSize:12.5, color:'var(--text3)' }}>{ar ? 'أضف أول مهمة أعلاه.' : 'Add your first task above.'}</div>
        </div>
      )}

      {!loading && scoped.length > 0 && filtered.length === 0 && (
        <div className="empty" style={{ padding:'40px 24px', textAlign:'center' }}>
          {ar ? 'لا توجد نتائج مطابقة للفلاتر المحددة.' : 'No results match the selected filters.'}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="tasks-board">
          {STATUSES.map(status => (
            <div key={status}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${STATUS_META[status].color}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_META[status].color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? STATUS_META[status].ar : STATUS_META[status].en}</span>
                </div>
                {status === 'done' && byStatus[status].length > 0 && (
                  <button onClick={archiveAllDone}
                    style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
                    {ar ? 'أرشفة الكل' : 'Archive All Done'}
                  </button>
                )}
              </div>

              {byStatus[status].length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text3)', padding: '12px 4px', textAlign: 'center' }}>
                  {ar ? 'لا توجد مهام هنا' : 'Nothing here'}
                </div>
              )}

              <div style={{ display: 'grid', gap: 6 }}>
                {byStatus[status].map(task => {
                  const overdue = isOverdue(task)
                  const dueToday = isDueToday(task)
                  const dueSoon = isDueSoon(task)
                  const frameColor = overdue ? '#EE334E' : dueToday ? '#009F6B' : dueSoon ? '#f59e0b' : null
                  const frameBg = overdue ? '#FFF5F5' : dueToday ? '#F0FBF6' : dueSoon ? '#FFFBEB' : 'var(--surface)'
                  const assignee = findAssignee(task.assigned_to)
                  return (
                    <div key={task.id} onClick={() => openEdit(task)}
                      style={{
                        background: frameBg, border: `2px solid ${frameColor || 'var(--border)'}`,
                        borderRadius: 11, padding: '9px 11px', cursor: 'pointer', boxShadow: 'var(--shadow)',
                        transition: 'border-color .15s',
                      }}
                      onMouseEnter={e => { if (!frameColor) e.currentTarget.style.borderColor = 'var(--border2)' }}
                      onMouseLeave={e => { if (!frameColor) e.currentTarget.style.borderColor = 'var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, textDecoration: status === 'done' ? 'line-through' : 'none', color: status === 'done' ? 'var(--text3)' : 'var(--text)' }}>
                            {task.title}
                          </div>
                          {task.notes && (
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                              {task.notes}
                            </div>
                          )}
                        </div>
                        {task.priority && PRIORITY_META[task.priority] && (
                          <i className="ti ti-flag" style={{ fontSize: 12, color: PRIORITY_META[task.priority].color, flexShrink: 0, marginTop: 2 }} title={ar ? PRIORITY_META[task.priority].ar : PRIORITY_META[task.priority].en} />
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        {task.category && CATEGORY_META[task.category] && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: CATEGORY_META[task.category].color, background: CATEGORY_META[task.category].color + '15', padding: '1px 6px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <i className={`ti ${CATEGORY_META[task.category].icon}`} style={{ fontSize: 10 }} />
                            {ar ? CATEGORY_META[task.category].ar : CATEGORY_META[task.category].en}
                          </span>
                        )}
                        {task.due_date && (
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: frameColor || 'var(--text3)', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <i className="ti ti-calendar" style={{ fontSize: 11 }} />
                            {formatDue(task.due_date, ar)}
                            {overdue && ` · ${ar ? 'متأخرة' : 'overdue'}`}
                          </span>
                        )}
                        {assignee && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--text3)', marginLeft: 'auto' }}>
                            <Avatar name={assigneeLabel(assignee)} id={idHash(assignee.id)} size={16} fs={7} />
                            <span style={{ maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assigneeLabel(assignee)}</span>
                          </span>
                        )}
                      </div>

                      {/* Quick status-move buttons only make sense for whoever is
                          actually doing the work — the Main Admin viewing a task
                          assigned to someone else can still change status via the
                          edit modal if truly needed, but shouldn't get a one-click
                          shortcut for work that isn't theirs. */}
                      {task.assigned_to === profile?.id && (
                        <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                          {STATUSES.filter(s => s !== status).map(s => (
                            <button key={s} onClick={() => setStatus(task, s)}
                              style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, border: `1px solid ${STATUS_META[s].color}40`, background: STATUS_META[s].color + '10', color: STATUS_META[s].color, cursor: 'pointer' }}>
                              → {ar ? STATUS_META[s].ar : STATUS_META[s].en}
                            </button>
                          ))}
                          {status === 'done' && (
                            <button onClick={() => archiveTask(task.id)}
                              style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text3)', cursor: 'pointer' }}>
                              <i className="ti ti-archive" style={{ fontSize: 10 }} /> {ar ? 'أرشفة' : 'Archive'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
