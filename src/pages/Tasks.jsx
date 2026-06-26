import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast, ConfirmModal } from '../components/Toast'

const STATUSES = ['todo', 'in_progress', 'done']
const STATUS_META = {
  todo:        { en: 'To Do',        ar: 'للقيام به',     color: '#9aa3b2' },
  in_progress: { en: 'In Progress',  ar: 'قيد التنفيذ',   color: '#0085C7' },
  done:        { en: 'Done',         ar: 'مكتمل',         color: '#009F6B' },
}
const PRIORITY_META = {
  low:    { en: 'Low',    ar: 'منخفضة', color: '#9aa3b2' },
  normal: { en: 'Normal', ar: 'عادية',  color: '#0085C7' },
  high:   { en: 'High',   ar: 'عالية',  color: '#EE334E' },
}

function isOverdue(task) {
  if (!task.due_date || task.status === 'done') return false
  return task.due_date < new Date().toISOString().slice(0, 10)
}

function formatDue(dateStr, ar) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(ar ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'short' })
}

export default function Tasks({ profile, onNav }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'

  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [quickTitle, setQuickTitle] = useState('')
  const [adding, setAdding]     = useState(false)

  const [editing, setEditing]   = useState(null) // task object being edited, or 'new' for the full new-task modal
  const [confirmDel, setConfirmDel] = useState(null)
  const [form, setForm] = useState({ title: '', notes: '', priority: 'normal', dueDate: '', status: 'todo' })

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    if (error) { toast(error.message, 'error'); setLoading(false); return }
    setTasks(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const visible = tasks.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.notes||'').toLowerCase().includes(search.toLowerCase())
  )

  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = visible.filter(t => t.status === s).sort((a, b) => {
      // Overdue first, then by due date, then newest created.
      const aOver = isOverdue(a), bOver = isOverdue(b)
      if (aOver !== bOver) return aOver ? -1 : 1
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return b.created_at.localeCompare(a.created_at)
    })
    return acc
  }, {})

  async function quickAdd() {
    if (!quickTitle.trim()) return
    setAdding(true)
    const { error } = await supabase.from('tasks').insert({
      title: quickTitle.trim(),
      status: 'todo',
      priority: 'normal',
      created_by: profile?.id || null,
    })
    setAdding(false)
    if (error) { toast(error.message, 'error'); return }
    setQuickTitle('')
    await load()
  }

  function openEdit(task) {
    setForm({
      title: task.title,
      notes: task.notes || '',
      priority: task.priority,
      dueDate: task.due_date || '',
      status: task.status,
    })
    setEditing(task)
  }

  function openNew() {
    setForm({ title: '', notes: '', priority: 'normal', dueDate: '', status: 'todo' })
    setEditing('new')
  }

  async function handleSave() {
    if (!form.title.trim()) { toast(ar ? 'العنوان مطلوب' : 'Title is required', 'error'); return }
    const payload = {
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      priority: form.priority,
      due_date: form.dueDate || null,
      status: form.status,
      completed_at: form.status === 'done' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    let error
    if (editing === 'new') {
      ;({ error } = await supabase.from('tasks').insert({ ...payload, created_by: profile?.id || null }))
    } else {
      ;({ error } = await supabase.from('tasks').update(payload).eq('id', editing.id))
    }
    if (error) { toast(error.message, 'error'); return }
    toast(editing === 'new' ? (ar ? 'تمت إضافة المهمة' : 'Task added') : (ar ? 'تم حفظ التغييرات' : 'Task updated'))
    setEditing(null)
    await load()
  }

  async function setStatus(task, status) {
    const { error } = await supabase.from('tasks').update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', task.id)
    if (error) { toast(error.message, 'error'); return }
    await load()
  }

  async function handleDelete(task) {
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) { toast(error.message, 'error'); return }
    toast(ar ? 'تم حذف المهمة' : 'Task deleted')
    setConfirmDel(null)
    await load()
  }

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

      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder={ar ? 'بحث في المهام...' : 'Search tasks…'} value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>

      {/* Quick add — typing a title and hitting Enter is faster than opening the
          full modal for the common case of just jotting something down. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          className="form-input"
          placeholder={ar ? 'أضف مهمة سريعة واضغط Enter...' : 'Add a quick task and press Enter…'}
          value={quickTitle}
          onChange={e => setQuickTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') quickAdd() }}
          disabled={adding}
        />
        <button className="btn btn-blue" onClick={quickAdd} disabled={adding || !quickTitle.trim()}>
          <i className="ti ti-plus" />
        </button>
      </div>

      {loading && <div className="empty" style={{ padding:24 }}>{ar ? 'جارٍ التحميل...' : 'Loading…'}</div>}

      {!loading && tasks.length === 0 && (
        <div className="empty" style={{ padding:'40px 24px', textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:14, background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
            <i className="ti ti-checklist" style={{ fontSize:26, color:'var(--text3)' }} />
          </div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>{ar ? 'لا توجد مهام بعد' : 'No tasks yet'}</div>
          <div style={{ fontSize:12.5, color:'var(--text3)' }}>{ar ? 'أضف أول مهمة أعلاه.' : 'Add your first task above.'}</div>
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <div className="tasks-board">
          {STATUSES.map(status => (
            <div key={status}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${STATUS_META[status].color}30` }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_META[status].color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? STATUS_META[status].ar : STATUS_META[status].en}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: 'var(--surface2)', color: 'var(--text3)' }}>{byStatus[status].length}</span>
              </div>

              {byStatus[status].length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text3)', padding: '12px 4px', textAlign: 'center' }}>
                  {ar ? 'لا توجد مهام هنا' : 'Nothing here'}
                </div>
              )}

              <div style={{ display: 'grid', gap: 8 }}>
                {byStatus[status].map(task => {
                  const overdue = isOverdue(task)
                  return (
                    <div key={task.id} onClick={() => openEdit(task)}
                      style={{
                        background: 'var(--surface)', border: `1px solid ${overdue ? '#EE334E50' : 'var(--border)'}`,
                        borderRadius: 12, padding: '12px 14px', cursor: 'pointer', boxShadow: 'var(--shadow)',
                        transition: 'border-color .15s',
                      }}
                      onMouseEnter={e => { if (!overdue) e.currentTarget.style.borderColor = 'var(--border2)' }}
                      onMouseLeave={e => { if (!overdue) e.currentTarget.style.borderColor = 'var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, textDecoration: status === 'done' ? 'line-through' : 'none', color: status === 'done' ? 'var(--text3)' : 'var(--text)' }}>
                            {task.title}
                          </div>
                          {task.notes && (
                            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {task.notes}
                            </div>
                          )}
                        </div>
                        {task.priority === 'high' && (
                          <i className="ti ti-flag" style={{ fontSize: 13, color: '#EE334E', flexShrink: 0, marginTop: 2 }} title={ar ? 'أولوية عالية' : 'High priority'} />
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        {task.due_date && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: overdue ? '#EE334E' : 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <i className="ti ti-calendar" style={{ fontSize: 12 }} />
                            {formatDue(task.due_date, ar)}
                            {overdue && ` · ${ar ? 'متأخرة' : 'overdue'}`}
                          </span>
                        )}
                      </div>

                      {/* Quick status move — one click to advance without opening the modal. */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                        {STATUSES.filter(s => s !== status).map(s => (
                          <button key={s} onClick={() => setStatus(task, s)}
                            style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 20, border: `1px solid ${STATUS_META[s].color}40`, background: STATUS_META[s].color + '10', color: STATUS_META[s].color, cursor: 'pointer' }}>
                            → {ar ? STATUS_META[s].ar : STATUS_META[s].en}
                          </button>
                        ))}
                      </div>
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
