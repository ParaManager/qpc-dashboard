import { useState, useEffect, useRef } from 'react'
import { Badge, initials, avColor, statusClass } from '../lib/helpers'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'

const DESIGNATIONS = [
  'All designations',
  'Coach', 'Assistant Coach', 'Technical Expert',
  'Physiotherapist', 'Doctor',
  'Secretary General', 'Executive Manager', 'Administration Secretary', 'Secretary Assistant',
  'Administrative National Team', 'Administrative Youth Team', 'Administrative Center & Development',
  'Accountant', 'Public Relation Officer', 'Receptionist',
  'Board Member', 'Official', 'Delegate',
  'Employee', 'Store Keeper', 'Waiter', 'Worker', 'Driver',
]

const DESIG_COLORS = {
  'Coach': '#009F6B', 'Assistant Coach': '#009F6B', 'Technical Expert': '#009F6B',
  'Physiotherapist': '#EE334E', 'Doctor': '#EE334E',
  'Secretary General': '#0085C7', 'Executive Manager': '#0085C7',
  'Board Member': '#8b5cf6', 'Official': '#8b5cf6', 'Delegate': '#8b5cf6',
  'Administration Secretary': '#e67e22', 'Secretary Assistant': '#e67e22',
  'Administrative National Team': '#e67e22', 'Administrative Youth Team': '#e67e22',
  'Administrative Center & Development': '#e67e22',
  'Accountant': '#16a085', 'Public Relation Officer': '#16a085',
  'Receptionist': '#9aa3b2', 'Employee': '#9aa3b2',
  'Store Keeper': '#9aa3b2', 'Waiter': '#9aa3b2', 'Worker': '#9aa3b2', 'Driver': '#9aa3b2',
}

function DesigBadge({ label }) {
  const color = DESIG_COLORS[label] || '#9aa3b2'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', fontSize:11, padding:'3px 9px', borderRadius:20, fontWeight:500, background:color+'18', color }}>
      {label}
    </span>
  )
}

export default function Employees({ employees, onRefresh, onNav, navState, profile }) {
  const [search, setSearch]     = useState('')
  const [desigF, setDesigF]     = useState('All designations')
  const [genderF, setGenderF]   = useState('All genders')
  const [natF, setNatF]         = useState('All nationalities')
  const [sort, setSort]         = useState('name-asc')
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm]   = useState(null)
  const [uploading, setUploading] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [addModal, setAddModal] = useState(false)
  const [newEmp, setNewEmp]     = useState({})
  const photoInput = useRef(null)

  useEffect(() => {
    if (navState?.reset) {
      setSelected(null)
      setSearch('')
      setDesigF('All designations')
      setGenderF('All genders')
      setNatF('All nationalities')
      setSort('name-asc')
    }
  }, [navState])

  const nationalities = ['All nationalities', ...new Set(employees.map(e => e.nationality).filter(Boolean))].sort()
  const hasFilters    = search || desigF !== 'All designations' || genderF !== 'All genders' || natF !== 'All nationalities'

  let list = employees.filter(e =>
    (desigF  === 'All designations' || e.designation === desigF)   &&
    (genderF === 'All genders'      || e.gender      === genderF)  &&
    (natF    === 'All nationalities'|| e.nationality === natF)     &&
    (!search || e.name.toLowerCase().includes(search.toLowerCase()) ||
               (e.designation||'').toLowerCase().includes(search.toLowerCase()))
  )
  list = [...list].sort((a, b) => {
    if (sort === 'name-asc')   return a.name.localeCompare(b.name)
    if (sort === 'name-desc')  return b.name.localeCompare(a.name)
    if (sort === 'desig-asc')  return (a.designation||'').localeCompare(b.designation||'')
    if (sort === 'desig-desc') return (b.designation||'').localeCompare(a.designation||'')
    if (sort === 'nat-asc')    return (a.nationality||'').localeCompare(b.nationality||'')
    return 0
  })

  async function handleDelete(id, name) {
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} deleted`)
    setSelected(null); setConfirm(null); onRefresh()
  }

  async function handleSave(formData, isEdit) {
    const payload = {
      name: formData.name, name_ar: formData.name_ar || null,
      gender: formData.gender || null, nationality: formData.nationality || null,
      designation: formData.designation || null, designation_ar: formData.designation_ar || null,
      employee_number: formData.employee_number || null, qss_number: formData.qss_number || null,
      phone: formData.phone || null, email: formData.email || null,
      status: formData.status || 'Active', notes: formData.notes || null,
    }
    if (!payload.name) { toast('Name is required', 'error'); return }
    const { error } = isEdit
      ? await supabase.from('employees').update(payload).eq('id', formData.id)
      : await supabase.from('employees').insert(payload)
    if (error) { toast(error.message, 'error'); return }
    toast(isEdit ? `${payload.name} updated` : `${payload.name} added`)
    setEditForm(null); setAddModal(false); setNewEmp({})
    await onRefresh()
    if (isEdit) setSelected(formData.id)
  }

  async function handlePhotoUpload(empId, file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${empId}.${ext}`
      const { error: upErr } = await supabase.storage.from('coach-photos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('coach-photos').getPublicUrl(path)
      await supabase.from('employees').update({ photo_url: data.publicUrl + '?t=' + Date.now() }).eq('id', empId)
      toast('Photo updated!'); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setUploading(false) }
  }

  // ── EMPLOYEE FORM MODAL ──
  function EmpModal({ data, isEdit, onClose }) {
    const [form, setForm] = useState(data || { status: 'Active' })
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const F = ({ label, name, type = 'text', placeholder, options }) => (
      <div className="form-group">
        <label className="form-label">{label}</label>
        {options
          ? <select className="form-input" value={form[name]||''} onChange={e => set(name, e.target.value)}>{options.map(o => <option key={o}>{o}</option>)}</select>
          : <input className="form-input" type={type} placeholder={placeholder} value={form[name]||''} onChange={e => set(name, e.target.value)} />
        }
      </div>
    )
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">{isEdit ? 'Edit' : 'New'} Employee</div>
            <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
          </div>
          <div className="modal-body">
            <div className="form-section">Personal Information</div>
            <div className="form-row">
              <F label="Full name (English)" name="name" placeholder="e.g. Ahmed Al-Ansari" />
              <F label="Full name (Arabic)" name="name_ar" placeholder="أحمد الأنصاري" />
            </div>
            <div className="form-row">
              <F label="Gender" name="gender" options={['','Male','Female']} />
              <F label="Nationality" name="nationality" placeholder="e.g. Qatari" />
            </div>
            <div className="form-section">Role & Employment</div>
            <div className="form-row">
              <F label="Designation (English)" name="designation" options={['', ...DESIGNATIONS.slice(1)]} />
              <F label="Designation (Arabic)" name="designation_ar" placeholder="e.g. مدرب" />
            </div>
            <div className="form-row">
              <F label="Employee number" name="employee_number" placeholder="e.g. 12501" />
              <F label="QSS number" name="qss_number" placeholder="e.g. 50112" />
            </div>
            <div className="form-row">
              <F label="Status" name="status" options={['Active','On Leave','Inactive']} />
            </div>
            <div className="form-section">Contact</div>
            <div className="form-row">
              <F label="Phone" name="phone" placeholder="+974 XXXX XXXX" />
              <F label="Email" name="email" type="email" placeholder="name@qpc.qa" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={3} placeholder="Optional notes…" value={form.notes||''} onChange={e => set('notes', e.target.value)} style={{ resize:'vertical' }} />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button className="btn btn-blue" onClick={() => handleSave(form, isEdit)}>
              {isEdit ? 'Save changes' : 'Add employee'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── DETAIL VIEW ──
  if (selected) {
    const emp = employees.find(x => x.id === selected)
    if (!emp) { setSelected(null); return null }
    const color = DESIG_COLORS[emp.designation] || '#9aa3b2'

    return (
      <div>
        {editForm && <EmpModal data={editForm} isEdit={true} onClose={() => setEditForm(null)} />}
        {confirm && (
          <ConfirmModal title="Delete employee" message={`Delete ${emp.name}? This cannot be undone.`}
            onConfirm={() => handleDelete(emp.id, emp.name)} onCancel={() => setConfirm(null)} />
        )}

        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> Back to employees</button>
        {canEdit(profile) && (
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            <button className="action-btn action-btn-edit" onClick={() => setEditForm({ ...emp })}><i className="ti ti-pencil" /> Edit</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> Delete</button>
          </div>
        )}

        <div className="detail-grid">
          <div className="detail-profile">
            {/* Photo */}
            <div style={{ position:'relative', width:90, height:90, margin:'0 auto 14px' }}>
              {emp.photo_url
                ? <img src={emp.photo_url} alt={emp.name} style={{ width:90, height:90, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--border)' }} />
                : <div style={{ width:90, height:90, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:600, color:'#fff' }}>{initials(emp.name)}</div>
              }
              {canEdit(profile) && (
                <div style={{ position:'absolute', bottom:0, right:0, display:'flex', gap:3 }}>
                  <button onClick={() => photoInput.current.click()} disabled={uploading} title="Upload photo"
                    style={{ width:26, height:26, borderRadius:'50%', background:color, border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                    {uploading ? <div style={{ width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> : <i className="ti ti-camera" style={{ fontSize:12 }} />}
                  </button>
                  {emp.photo_url && (
                    <button onClick={async () => { await supabase.from('employees').update({ photo_url: null }).eq('id', emp.id); await onRefresh() }}
                      style={{ width:26, height:26, borderRadius:'50%', background:'#dc2626', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                      <i className="ti ti-x" style={{ fontSize:12 }} />
                    </button>
                  )}
                </div>
              )}
              <input ref={photoInput} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { if(e.target.files[0]) handlePhotoUpload(emp.id, e.target.files[0]) }} />
            </div>

            <div className="detail-name">{emp.name}</div>
            {emp.name_ar && <div className="detail-sub">{emp.name_ar}</div>}
            <div style={{ margin:'10px 0' }}><DesigBadge label={emp.designation} /></div>

            <div className="detail-fields">
              {[
                ['Employee #', emp.employee_number],
                ['QSS #', emp.qss_number],
                ['Gender', emp.gender],
                ['Nationality', emp.nationality],
                ['Phone', emp.phone],
                ['Email', emp.email],
                ['Status', emp.status],
              ].map(([k,v]) => (
                <div key={k} className="detail-row">
                  <span className="dk">{k}</span>
                  <span className="dv" style={{ fontSize:12 }}>{v||'—'}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            {emp.designation_ar && (
              <div className="info-card" style={{ marginBottom:12 }}>
                <div className="info-title">Arabic designation</div>
                <div style={{ fontSize:16, fontWeight:600, direction:'rtl', color:'var(--text)' }}>{emp.designation_ar}</div>
              </div>
            )}
            {emp.notes && (
              <div className="info-card">
                <div className="info-title">Notes</div>
                <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{emp.notes}</p>
              </div>
            )}
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div>
      {addModal && <EmpModal data={newEmp} isEdit={false} onClose={() => { setAddModal(false); setNewEmp({}) }} />}

      <div className="page-header">
        <div><div className="page-title">Employees</div><div className="page-sub">{list.length} of {employees.length} employees</div></div>
        <div style={{ display:'flex', gap:8 }}>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setDesigF('All designations'); setGenderF('All genders'); setNatF('All nationalities') }}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:9, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
              <i className="ti ti-x" style={{ fontSize:13 }} /> Reset filters
            </button>
          )}
          {canEdit(profile) && (
            <button className="btn btn-blue" onClick={() => setAddModal(true)}><i className="ti ti-plus" /> Add employee</button>
          )}
        </div>
      </div>

      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder="Search by name, designation…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="filter" value={desigF} onChange={e => setDesigF(e.target.value)}>
          {DESIGNATIONS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="filter" value={genderF} onChange={e => setGenderF(e.target.value)}>
          {['All genders','Male','Female'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="filter" value={natF} onChange={e => setNatF(e.target.value)}>
          {nationalities.map(n => <option key={n}>{n}</option>)}
        </select>
        <select className="filter" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="name-asc">Name A→Z</option>
          <option value="name-desc">Name Z→A</option>
          <option value="desig-asc">Designation A→Z</option>
          <option value="nat-asc">Nationality A→Z</option>
        </select>
      </div>

      {/* Stats row */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        {[
          { label:'Total', val:employees.length, color:'#0085C7' },
          { label:'Male', val:employees.filter(e=>e.gender==='Male').length, color:'#0085C7' },
          { label:'Female', val:employees.filter(e=>e.gender==='Female').length, color:'#EE334E' },
          { label:'Coaches', val:employees.filter(e=>e.designation?.includes('Coach')).length, color:'#009F6B' },
          { label:'Admin', val:employees.filter(e=>e.designation?.includes('Admin')).length, color:'#e67e22' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 16px', display:'flex', gap:8, alignItems:'center', boxShadow:'var(--shadow)' }}>
            <span style={{ fontSize:20, fontWeight:700, color }}>{val}</span>
            <span style={{ fontSize:12, color:'var(--text2)' }}>{label}</span>
          </div>
        ))}
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Designation</th>
              <th>Nationality</th>
              <th>Gender</th>
              <th>Employee #</th>
              <th>QSS #</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map(emp => (
              <tr key={emp.id} onClick={() => setSelected(emp.id)} style={{ cursor:'pointer' }}>
                <td>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {emp.photo_url
                      ? <img src={emp.photo_url} alt={emp.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                      : <div className="av" style={{ width:32, height:32, fontSize:11, background: DESIG_COLORS[emp.designation]||'#9aa3b2', flexShrink:0 }}>{initials(emp.name)}</div>
                    }
                    <div>
                      <div style={{ fontWeight:500, fontSize:13 }}>{emp.name}</div>
                      {emp.name_ar && <div style={{ fontSize:11, color:'#9aa3b2' }}>{emp.name_ar}</div>}
                    </div>
                  </div>
                </td>
                <td><DesigBadge label={emp.designation} /></td>
                <td style={{ fontSize:13, color:'#5a6272' }}>{emp.nationality || '—'}</td>
                <td style={{ fontSize:13, color:'#5a6272' }}>{emp.gender || '—'}</td>
                <td style={{ fontSize:12, color:'#5a6272', fontFamily:'monospace' }}>{emp.employee_number || '—'}</td>
                <td style={{ fontSize:12, color:'#5a6272', fontFamily:'monospace' }}>{emp.qss_number || '—'}</td>
                <td><span className={`badge ${emp.status==='Active'?'badge-green':emp.status==='On Leave'?'badge-amber':'badge-gray'}`}>{emp.status}</span></td>
                <td><i className="ti ti-chevron-right" style={{ color:'#ccc', fontSize:16 }} /></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8}><div className="empty">No employees match</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
