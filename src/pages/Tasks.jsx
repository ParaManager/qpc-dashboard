import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast, ConfirmModal } from '../components/Toast'
import { Avatar, initials } from '../lib/helpers'
import { isMainAdminEmail } from '../lib/permissions'
import MultiSelectFilter from '../components/MultiSelectFilter.jsx'

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

const REPEAT_TYPES = ['None', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom']
const CUSTOM_INTERVAL_UNITS = ['days', 'weeks', 'months', 'years']
const REPEAT_END_TYPES = ['Never', 'OnDate', 'AfterCount']

// Computes the next occurrence's due_date from a completed task's own
// repeat settings. Returns null for 'None' (not recurring) or once the
// end condition (OnDate / AfterCount) has been reached.
function computeNextDueDate(task) {
  if (!task.due_date || task.repeat_type === 'None' || !task.repeat_type) return null
  const current = new Date(task.due_date + 'T00:00:00')
  const next = new Date(current)
  if (task.repeat_type === 'Daily') next.setDate(next.getDate() + 1)
  else if (task.repeat_type === 'Weekly') next.setDate(next.getDate() + 7)
  else if (task.repeat_type === 'Monthly') next.setMonth(next.getMonth() + 1)
  else if (task.repeat_type === 'Yearly') next.setFullYear(next.getFullYear() + 1)
  else if (task.repeat_type === 'Custom') {
    const n = Math.max(1, task.custom_interval_value || 1)
    if (task.custom_interval_unit === 'days') next.setDate(next.getDate() + n)
    else if (task.custom_interval_unit === 'weeks') next.setDate(next.getDate() + n * 7)
    else if (task.custom_interval_unit === 'months') next.setMonth(next.getMonth() + n)
    else if (task.custom_interval_unit === 'years') next.setFullYear(next.getFullYear() + n)
    else return null // custom selected but no unit configured — nothing to compute
  } else {
    return null
  }

  if (task.repeat_end_type === 'OnDate' && task.repeat_end_date) {
    if (localDateStr(next) > task.repeat_end_date) return null
  }
  if (task.repeat_end_type === 'AfterCount' && task.repeat_end_count) {
    const currentOccurrence = task.occurrence_number || 1
    if (currentOccurrence >= task.repeat_end_count) return null
  }
  return localDateStr(next)
}
function daysUntilDue(task) {
  if (!task.due_date) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const due = new Date(task.due_date); due.setHours(0,0,0,0)
  return Math.round((due - today) / 86400000)
}
// Combines due_date + optional due_time into a real Date for overdue
// checks. Tasks without a time keep the previous date-only behavior
// (treated as end-of-day, i.e. only overdue once the day itself has
// fully passed) — existing tasks with no due_time are unaffected.
function dueDateTime(task) {
  if (!task.due_date) return null
  return new Date(`${task.due_date}T${task.due_time || '23:59:59'}`)
}
function isOverdue(task) {
  if (!task.due_date || task.status === 'done') return false
  const dt = dueDateTime(task)
  return dt ? dt.getTime() < Date.now() : false
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

// 12/24-hour formatting follows the browser/OS locale convention (this app
// has no dedicated settings page yet, so it uses the same locale-driven
// approach already used for date formatting elsewhere) — Arabic locale
// defaults to 12-hour with AM/PM markers, matching regional convention;
// English uses the browser's own preference via undefined hour12.
function formatDueTime(timeStr, ar) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date(); d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(ar ? 'ar-QA' : undefined, { hour: 'numeric', minute: '2-digit', hour12: ar ? true : undefined })
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
  const [assigneeFilter, setAssigneeFilter] = useState([])
  const [categoryFilter, setCategoryFilter] = useState([])

  const [editing, setEditing]   = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [form, setForm] = useState({ title: '', notes: '', priority: 'moderate', category: '', dueDate: '', dueTime: '', status: 'todo', assignedTo: profile?.id || '', notifyOnComplete: false, repeatType: 'None', customIntervalUnit: 'days', customIntervalValue: 1, repeatEndType: 'Never', repeatEndDate: '', repeatEndCount: '' })

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
      .select('id, email, full_name, role, account_type, status, employee_id, person_id')
      .eq('status', 'active')
    let list = (data || []).filter(p => {
      const isMain = isMainAdminEmail(p.email)
      if (isMain) return true
      if (!['admin', 'employee', 'coach'].includes(p.account_type || p.role)) return false
      if (!p.employee_id) return false
      if (!p.full_name || !p.full_name.trim()) return false
      return true
    })
    // Enrich with Arabic name from employees table via employee_id
    const empIds = list.filter(p => p.employee_id).map(p => p.employee_id)
    if (empIds.length > 0) {
      const { data: empData } = await supabase
        .from('employees')
        .select('id, name_ar')
        .in('id', empIds)
      const empMap = Object.fromEntries((empData || []).map(e => [String(e.id), e.name_ar]))
      list = list.map(p => p.employee_id && empMap[String(p.employee_id)]
        ? { ...p, name_ar: empMap[String(p.employee_id)] }
        : p)
    }
    setEligible(list)
  }

  useEffect(() => { load(); loadEligible() }, [])

  function assigneeLabel(p) {
    if (!p) return ''
    if (ar && p.name_ar) return p.name_ar
    if (p.full_name && p.full_name.trim()) return p.full_name.trim()
    if (p.email && !/^COACH-\d+$/.test(p.email)) return p.email
    return ar ? 'مستخدم' : 'User'
  }
  function findAssignee(id) { return eligible.find(p => p.id === id) }

  const scoped = isMainAdmin
    ? (viewScope === 'all' ? tasks : tasks.filter(t => t.assigned_to === profile?.id))
    : tasks.filter(t => t.assigned_to === profile?.id)

  function passesTaskFilters(t, q, skipKey) {
    const skip = (key) => key === skipKey
    return (
      (!q || t.title.toLowerCase().includes(q) || (t.notes||'').toLowerCase().includes(q)) &&
      (skip('assignee') || !isMainAdmin || viewScope !== 'all' || assigneeFilter.length === 0 || assigneeFilter.includes(t.assigned_to)) &&
      (skip('category') || categoryFilter.length === 0 || categoryFilter.some(v => v === 'blank' ? !t.category : (t.category || '') === v))
    )
  }
  function computeTaskOptionCounts(colKey, getFieldValue, matchOption) {
    const q = search.toLowerCase()
    const base = scoped.filter(t => passesTaskFilters(t, q, colKey))
    return (value) => base.filter(t => matchOption(getFieldValue(t), value)).length
  }

  const filtered = scoped.filter(t => passesTaskFilters(t, search.toLowerCase(), null))

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
      dueTime: task.due_time || '',
      status: task.status,
      assignedTo: task.assigned_to || profile?.id || '',
      notifyOnComplete: !!task.notify_on_complete,
      repeatType: task.repeat_type || 'None',
      customIntervalUnit: task.custom_interval_unit || 'days',
      customIntervalValue: task.custom_interval_value || 1,
      repeatEndType: task.repeat_end_type || 'Never',
      repeatEndDate: task.repeat_end_date || '',
      repeatEndCount: task.repeat_end_count || '',
    })
    setEditing(task)
  }

  function openNew() {
    setForm({ title: '', notes: '', priority: 'moderate', category: '', dueDate: '', dueTime: '', status: 'todo', assignedTo: profile?.id || '', notifyOnComplete: false, repeatType: 'None', customIntervalUnit: 'days', customIntervalValue: 1, repeatEndType: 'Never', repeatEndDate: '', repeatEndCount: '' })
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
      due_time: form.dueTime || null,
      status: form.status,
      assigned_to: assignedTo,
      notify_on_complete: form.notifyOnComplete,
      completed_at: form.status === 'done' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
      repeat_type: form.repeatType,
      custom_interval_unit: form.repeatType === 'Custom' ? form.customIntervalUnit : null,
      custom_interval_value: form.repeatType === 'Custom' ? (Number(form.customIntervalValue) || 1) : null,
      repeat_end_type: form.repeatType === 'None' ? 'Never' : form.repeatEndType,
      repeat_end_date: form.repeatEndType === 'OnDate' ? (form.repeatEndDate || null) : null,
      repeat_end_count: form.repeatEndType === 'AfterCount' ? (Number(form.repeatEndCount) || null) : null,
    }
    let error
    const dueDateChanged = editing !== 'new' && editing.due_date !== payload.due_date
    const justCompleted = editing !== 'new' && editing.status !== 'done' && payload.status === 'done'
    if (editing === 'new') {
      ;({ error } = await supabase.from('tasks').insert({ ...payload, created_by: profile?.id || null, occurrence_number: payload.repeat_type !== 'None' ? 1 : null }))
    } else {
      ;({ error } = await supabase.from('tasks').update(payload).eq('id', editing.id))
    }
    if (error) { toast(error.message, 'error'); return }
    if (dueDateChanged) {
      await supabase.from('notifications').delete().eq('related_entity_type', 'task').eq('related_entity_id', editing.id)
    }
    if (justCompleted) {
      await notifyCompletionIfRequested(editing.id, payload)
      await createNextOccurrence({ ...editing, ...payload, id: editing.id })
    }
    toast(editing === 'new' ? (ar ? 'تمت إضافة المهمة' : 'Task added') : (ar ? 'تم حفظ التغييرات' : 'Task updated'))
    setEditing(null)
    await load()
  }

  // Creates the next occurrence of a completed recurring task — the
  // completed row is left exactly as-is (kept for history), a brand new
  // row is inserted for the next due date, preserving assignee, priority,
  // category, notes/title, and the same recurrence settings so the series
  // continues. A fresh notification is generated for the new occurrence
  // the same way a normal new task would notify its assignee.
  async function createNextOccurrence(completedTask) {
    const nextDueDate = computeNextDueDate(completedTask)
    if (!nextDueDate) return // series ended or not recurring

    const seriesId = completedTask.series_id || completedTask.id
    const nextOccurrenceNumber = (completedTask.occurrence_number || 1) + 1

    const { data: inserted, error } = await supabase.from('tasks').insert({
      title: completedTask.title,
      notes: completedTask.notes,
      priority: completedTask.priority,
      category: completedTask.category,
      due_date: nextDueDate,
      due_time: completedTask.due_time,
      status: 'todo',
      assigned_to: completedTask.assigned_to,
      created_by: completedTask.created_by,
      notify_on_complete: completedTask.notify_on_complete,
      repeat_type: completedTask.repeat_type,
      custom_interval_unit: completedTask.custom_interval_unit,
      custom_interval_value: completedTask.custom_interval_value,
      repeat_end_type: completedTask.repeat_end_type,
      repeat_end_date: completedTask.repeat_end_date,
      repeat_end_count: completedTask.repeat_end_count,
      series_id: seriesId,
      occurrence_number: nextOccurrenceNumber,
    }).select().maybeSingle()

    if (error) { console.error('[tasks] failed to create next occurrence:', error); return }
    if (!inserted || !inserted.assigned_to) return

    await supabase.from('notifications').insert({
      user_id: inserted.assigned_to,
      type: 'task_assigned',
      title: ar ? 'مهمة متكررة جديدة' : 'New recurring task',
      body: ar ? `تم إنشاء التكرار التالي لـ: ${inserted.title}` : `Next occurrence created for: ${inserted.title}`,
      data: {},
      read: false,
      category: 'Tasks', target_path: 'tasks', related_entity_type: 'task', related_entity_id: inserted.id,
    })
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
      if (wasNotDone) {
        await notifyCompletionIfRequested(task.id, { ...task, notify_on_complete: task.notify_on_complete })
        await createNextOccurrence(task)
      }
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

  const hasActiveFilters = search || (isMainAdmin && viewScope === 'all' && assigneeFilter.length > 0) || categoryFilter.length > 0
  function clearFilters() { setSearch(''); setAssigneeFilter([]); setCategoryFilter([]) }

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
                <div className="form-group">
                  <label>{ar ? 'وقت الاستحقاق (اختياري)' : 'Due time (optional)'}</label>
                  <input className="form-input" type="time" value={form.dueTime} onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>{ar ? 'الفئة' : 'Category'}</label>
                <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="">{ar ? '— بدون فئة —' : '— No category —'}</option>
                  {Object.keys(CATEGORY_META).map(c => <option key={c} value={c}>{ar ? CATEGORY_META[c].ar : CATEGORY_META[c].en}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{ar ? 'التكرار' : 'Repeat'}</label>
                  <select className="form-input" value={form.repeatType} onChange={e => setForm(f => ({ ...f, repeatType: e.target.value }))}>
                    {REPEAT_TYPES.map(r => <option key={r} value={r}>{
                      r === 'None' ? (ar ? 'بدون' : 'None')
                      : r === 'Daily' ? (ar ? 'يومي' : 'Daily')
                      : r === 'Weekly' ? (ar ? 'أسبوعي' : 'Weekly')
                      : r === 'Monthly' ? (ar ? 'شهري' : 'Monthly')
                      : r === 'Yearly' ? (ar ? 'سنوي' : 'Yearly')
                      : (ar ? 'مخصص' : 'Custom')
                    }</option>)}
                  </select>
                </div>
                {form.repeatType === 'Custom' && (
                  <div className="form-group">
                    <label>{ar ? 'كل' : 'Every'}</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="form-input" type="number" min="1" style={{ width: 70 }}
                        value={form.customIntervalValue} onChange={e => setForm(f => ({ ...f, customIntervalValue: e.target.value }))} />
                      <select className="form-input" value={form.customIntervalUnit} onChange={e => setForm(f => ({ ...f, customIntervalUnit: e.target.value }))}>
                        {CUSTOM_INTERVAL_UNITS.map(u => <option key={u} value={u}>{
                          u === 'days' ? (ar ? 'أيام' : 'days')
                          : u === 'weeks' ? (ar ? 'أسابيع' : 'weeks')
                          : u === 'months' ? (ar ? 'أشهر' : 'months')
                          : (ar ? 'سنوات' : 'years')
                        }</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              {form.repeatType !== 'None' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>{ar ? 'إنهاء التكرار' : 'End repeat'}</label>
                    <select className="form-input" value={form.repeatEndType} onChange={e => setForm(f => ({ ...f, repeatEndType: e.target.value }))}>
                      <option value="Never">{ar ? 'أبداً' : 'Never'}</option>
                      <option value="OnDate">{ar ? 'في تاريخ' : 'On date'}</option>
                      <option value="AfterCount">{ar ? 'بعد عدد من المرات' : 'After X occurrences'}</option>
                    </select>
                  </div>
                  {form.repeatEndType === 'OnDate' && (
                    <div className="form-group">
                      <label>{ar ? 'تاريخ الانتهاء' : 'End date'}</label>
                      <input className="form-input" type="date" value={form.repeatEndDate} onChange={e => setForm(f => ({ ...f, repeatEndDate: e.target.value }))} />
                    </div>
                  )}
                  {form.repeatEndType === 'AfterCount' && (
                    <div className="form-group">
                      <label>{ar ? 'عدد المرات' : 'Occurrences'}</label>
                      <input className="form-input" type="number" min="1" value={form.repeatEndCount} onChange={e => setForm(f => ({ ...f, repeatEndCount: e.target.value }))} />
                    </div>
                  )}
                </div>
              )}
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
              <button key={key} onClick={() => { setViewScope(key); if (key !== 'all') setAssigneeFilter([]) }}
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
        {isMainAdmin && viewScope === 'all' && (() => {
          const assigneeOptions = eligible.map(p => ({ value: p.id, label: p.id === profile?.id ? (ar ? 'نفسي' : 'Myself') : assigneeLabel(p) }))
          const assigneeCounter = computeTaskOptionCounts('assignee', t => t.assigned_to, (fv, ov) => fv === ov)
          const assigneeCounts = assigneeOptions.reduce((acc,o)=>{acc[o.value]=assigneeCounter(o.value);return acc},{})
          return (
            <MultiSelectFilter
              options={assigneeOptions}
              selected={assigneeFilter}
              allLabel={ar ? 'كل المسؤولين' : 'All assignees'}
              onChange={setAssigneeFilter}
              style={{ width: 'auto', minWidth: 140 }}
              counts={assigneeCounts}
            />
          )
        })()}
        {(() => {
          const categoryOptions = [
            ...Object.keys(CATEGORY_META).map(c => ({ value: c, label: ar ? CATEGORY_META[c].ar : CATEGORY_META[c].en })),
            { value: 'blank', label: ar ? 'فارغ' : 'Blank' },
          ]
          const categoryCounter = computeTaskOptionCounts('category', t => t.category, (fv, ov) => ov === 'blank' ? !fv : (fv || '') === ov)
          const categoryCounts2 = categoryOptions.reduce((acc,o)=>{acc[o.value]=categoryCounter(o.value);return acc},{})
          return (
            <MultiSelectFilter
              options={categoryOptions}
              selected={categoryFilter}
              allLabel={ar ? 'كل الفئات' : 'All categories'}
              onChange={setCategoryFilter}
              style={{ width: 'auto', minWidth: 140 }}
              counts={categoryCounts2}
            />
          )
        })()}
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
                            {task.due_time && ` ${formatDueTime(task.due_time, ar)}`}
                            {overdue && ` · ${ar ? 'متأخرة' : 'overdue'}`}
                          </span>
                        )}
                        {task.repeat_type && task.repeat_type !== 'None' && (
                          <span style={{ fontSize: 10.5, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <i className="ti ti-repeat" style={{ fontSize: 11 }} />
                            {ar ? 'متكرر' : 'Recurring'}
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
