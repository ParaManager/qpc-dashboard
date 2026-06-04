import { useState, useEffect } from 'react'
import { SPORTS } from '../lib/helpers'

const COLORS = { athlete: '#0085C7', coach: '#009F6B', event: '#EE334E', result: '#8b5cf6' }

// ── These MUST be outside FormModal so React doesn't remount them on each keystroke ──

function Field({ label, name, type = 'text', placeholder, options, value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {options ? (
        <select className="form-input" value={value ?? ''} onChange={e => onChange(name, e.target.value)}>
          {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
      ) : (
        <input
          className="form-input"
          type={type}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={e => onChange(name, e.target.value)}
        />
      )}
    </div>
  )
}

function Row({ children }) {
  return <div className="form-row">{children}</div>
}

function Section({ label }) {
  return <div className="form-section">{label}</div>
}

// ── Main modal ──

export default function FormModal({ type, record, coaches, athletes, onSave, onClose }) {
  const isEdit = !!record
  const [form, setForm] = useState({})

  useEffect(() => {
    if (record) {
      setForm({ ...record })
    } else {
      const defaults = {
        athlete: { gender: 'Male', nationality: 'Qatari', sport: SPORTS[0], status: 'Active' },
        coach:   { sport: SPORTS[0], certLevel: 'Level 2', status: 'Active' },
        event:   { sport: SPORTS[0], type: 'National', status: 'Planning', maxParticipants: 30 },
        result:  { medal: 'gold', position: 1 },
      }
      setForm(defaults[type] || {})
    }
  }, [record, type])

  const set = (name, value) => setForm(f => ({ ...f, [name]: value }))

  // Helper to pass consistent props to Field
  const f = (name) => ({ name, value: form[name], onChange: set })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit' : 'New'} {type.charAt(0).toUpperCase() + type.slice(1)}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div className="modal-body">

          {type === 'athlete' && <>
            <Section label="Personal Information" />
            <Row>
              <Field label="Full name (English)" placeholder="e.g. Ahmed Al-Ansari" {...f('name')} />
              <Field label="Full name (Arabic)" placeholder="e.g. أحمد الأنصاري" {...f('nameAr')} />
            </Row>
            <Row>
              <Field label="Date of birth" type="date" {...f('dob')} />
              <Field label="Gender" options={['Male','Female']} {...f('gender')} />
            </Row>
            <Row>
              <Field label="Nationality" placeholder="e.g. Qatari" {...f('nationality')} />
              <Field label="Phone" placeholder="+974 XXXX XXXX" {...f('phone')} />
            </Row>
            <Field label="Email" type="email" placeholder="athlete@qpc.qa" {...f('email')} />
            <Section label="Sport Classification" />
            <Row>
              <Field label="Sport" options={SPORTS} {...f('sport')} />
              <Field label="Classification" placeholder="e.g. T54, S6, BC2" {...f('classification')} />
            </Row>
            <Field label="Disability type" placeholder="e.g. Spinal Cord Injury" {...f('disability')} />
            <Row>
              <Field label="Coach" options={[{ value:'', label:'Unassigned' }, ...(coaches||[]).map(c => ({ value: c.id, label: c.name }))]} {...f('coachId')} />
              <Field label="Status" options={['','Active','Inactive','Suspended','Under Medical Review','Injured','Retired']} {...f('status')} />
            </Row>
            <Field label="Join date" type="date" {...f('joinDate')} />
            <Section label="Passport & ID" />
            <Row>
              <Field label="Passport number" placeholder="e.g. A12345678" {...f('passportNumber')} />
              <Field label="Passport expiry" type="date" {...f('passportExpiry')} />
            </Row>
            <Row>
              <Field label="Qatar ID number" placeholder="e.g. 28412345678" {...f('idNumber')} />
              <Field label="ID expiry" type="date" {...f('idExpiry')} />
            </Row>
            <Section label="Emergency Contact" />
            <Row>
              <Field label="Contact name" placeholder="e.g. Mohammed Al-Ansari" {...f('emergencyName')} />
              <Field label="Relationship" placeholder="e.g. Father, Wife" {...f('emergencyRelation')} />
            </Row>
            <Field label="Contact phone" placeholder="+974 XXXX XXXX" {...f('emergencyPhone')} />
            <Section label="Medical Information" />
            <Row>
              <Field label="Blood type" options={['','A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown']} {...f('bloodType')} />
              <Field label="Known allergies" placeholder="e.g. Penicillin, Nuts" {...f('allergies')} />
            </Row>
            <Field label="Medical conditions" placeholder="e.g. Asthma, Diabetes — leave blank if none" {...f('medicalConditions')} />
          </>}

          {type === 'coach' && <>
            <Section label="Coach Information" />
            <Row>
              <Field label="Full name" placeholder="e.g. Carlos Mendez" {...f('name')} />
              <Field label="Nationality" placeholder="e.g. Spanish" {...f('nationality')} />
            </Row>
            <Row>
              <Field label="Sport" options={SPORTS} {...f('sport')} />
              <Field label="Cert. level" options={['Level 1','Level 2','Level 3']} {...f('certLevel')} />
            </Row>
            <Row>
              <Field label="License number" placeholder="e.g. IPC-ATH-2024" {...f('license')} />
              <Field label="Start date with QPC" type="date" {...f('since')} />
            </Row>
            <Row>
              <Field label="Email" type="email" placeholder="coach@qpc.qa" {...f('email')} />
              <Field label="Phone" placeholder="+974 XXXX XXXX" {...f('phone')} />
            </Row>
            <Field label="Status" options={['Active','On Leave']} {...f('status')} />
          </>}

          {type === 'event' && <>
            <Section label="Event Details" />
            <Field label="Event name" placeholder="e.g. Qatar Open Athletics Championships" {...f('name')} />
            <Row>
              <Field label="Sport" options={SPORTS} {...f('sport')} />
              <Field label="Type" options={['National','Regional','Invitational']} {...f('type')} />
            </Row>
            <Field label="Venue" placeholder="e.g. Khalifa International Stadium" {...f('venue')} />
            <Row>
              <Field label="Start date" type="date" {...f('startDate')} />
              <Field label="End date" type="date" {...f('endDate')} />
            </Row>
            <Row>
              <Field label="Max participants" type="number" placeholder="60" {...f('maxParticipants')} />
              <Field label="Status" options={['Planning','Registration Open','Upcoming','Completed']} {...f('status')} />
            </Row>
          </>}

          {type === 'result' && <>
            <Section label="Result Information" />
            <Row>
              <Field label="Athlete" options={(athletes||[]).map(a => a.name)} {...f('athleteName')} />
              <Field label="Medal" options={['gold','silver','bronze']} {...f('medal')} />
            </Row>
            <Field label="Competition name" placeholder="e.g. Para Shooting Nationals 2026" {...f('eventName')} />
            <Row>
              <Field label="Discipline / event" placeholder="e.g. 10m Air Rifle SH1" {...f('discipline')} />
              <Field label="Result / score" placeholder="e.g. 248.7 pts" {...f('result')} />
            </Row>
            <Row>
              <Field label="Position" type="number" placeholder="1" {...f('position')} />
              <Field label="Date" type="date" {...f('date')} />
            </Row>
          </>}

        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn" style={{ background: COLORS[type] }} onClick={() => onSave(form)}>
            {isEdit ? 'Save changes' : 'Add record'}
          </button>
        </div>
      </div>
    </div>
  )
}
