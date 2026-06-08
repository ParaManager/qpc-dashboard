import { useState, useEffect } from 'react'
import { SPORTS } from '../lib/helpers'
import { useLang } from '../lib/LangContext.jsx'

const COLORS = { athlete: '#0085C7', coach: '#009F6B', event: '#EE334E', result: '#8b5cf6' }

const DESIGNATIONS_EN = [
  'Coach', 'Assistant Coach', 'Technical Expert',
  'Physiotherapist', 'Doctor',
  'Secretary General', 'Executive Manager', 'Administration Secretary', 'Secretary Assistant',
  'Administrative National Team', 'Administrative Youth Team', 'Administrative Center & Development',
  'Accountant', 'Public Relation Officer', 'Receptionist',
  'Board Member', 'Official', 'Delegate',
  'Employee', 'Store Keeper', 'Waiter', 'Worker', 'Driver',
]

function Field({ label, name, type = 'text', placeholder, options, value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {options ? (
        <select className="form-input" value={value ?? ''} onChange={e => onChange(name, e.target.value)}>
          {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
      ) : (
        <input className="form-input" type={type} placeholder={placeholder} value={value ?? ''} onChange={e => onChange(name, e.target.value)} />
      )}
    </div>
  )
}

function Row({ children }) { return <div className="form-row">{children}</div> }
function Section({ label }) { return <div className="form-section">{label}</div> }

export default function FormModal({ type, record, coaches, athletes, onSave, onClose }) {
  const isEdit = !!record
  const { tx } = useLang()
  const [form, setForm] = useState({})

  useEffect(() => {
    if (record) { setForm({ ...record }) }
    else {
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
  const f = (name) => ({ name, value: form[name], onChange: set })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? tx('actions.edit','Edit') : tx('actions.add','New')} {type === 'athlete' ? tx('pages.athletes','Athlete') : type === 'coach' ? tx('pages.coaches','Coach') : type === 'event' ? tx('pages.events','Event') : tx('pages.results','Result')}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div className="modal-body">

          {/* ── ATHLETE FORM ── */}
          {type === 'athlete' && <>
            <Section label={tx('form.personalInfo','Personal Information')} />
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
            <Row>
              <Field label="Email" type="email" placeholder="athlete@qpc.qa" {...f('email')} />
              <Field label="Join date" type="date" {...f('joinDate')} />
            </Row>

            <Section label="Sport & Classification" />
            <Row>
              <Field label="Sport" options={SPORTS} {...f('sport')} />
              <Field label="Classification" placeholder="e.g. T54, S6, BC2" {...f('classification')} />
            </Row>
            <Row>
              <Field label="Disability type" placeholder="e.g. Spinal Cord Injury" {...f('disability')} />
              <Field label="Age category" placeholder="e.g. رجال (20+)" {...f('ageCategory')} />
            </Row>
            <Row>
              <Field label="Coach" options={[{ value:'', label:'Unassigned' }, ...(coaches||[]).map(c => ({ value: c.id, label: c.name }))]} {...f('coachId')} />
              <Field label="Status" options={['','Active','Inactive','Suspended','Under Medical Review','Injured','Retired']} {...f('status')} />
            </Row>
            <Row>
              <Field label="Medical status" placeholder="e.g. Completed" {...f('medicalStatus')} />
              <Field label="Career profile #" placeholder="e.g. 12345" {...f('careerProfile')} />
            </Row>

            <Section label={tx('form.clubRole','Club & Role')} />
            <Row>
              <Field label="Club (النادي)" placeholder="e.g. Al Wakrah SC" {...f('club')} />
              <Field label="Designation (الوظيفة)" options={['','Player','Female Player','Coach','Female Coach','Referee','Female Referee','Admin Staff','Technical Staff','Medical Staff','Board Member','Female Board Member','Member','Female Member','Employee','Female Employee','Expert']} {...f('designation')} />
            </Row>
            <Row>
              <Field label="Residency status (الصفة)" options={['','Qatari Male','Qatari Female','Resident Male','Resident Female','Professional Male','Professional Female','Born in Qatar','Qatari Mother']} {...f('residencyStatus')} />
              <Field label="QSS number" placeholder="e.g. 12345" {...f('qssNumber')} />
            </Row>

            <Section label={tx('form.passportID','Passport & ID')} />
            <Row>
              <Field label="Passport number" placeholder="e.g. A12345678" {...f('passportNumber')} />
              <Field label="Passport expiry" type="date" {...f('passportExpiry')} />
            </Row>
            <Row>
              <Field label="Qatar ID number" placeholder="e.g. 28412345678" {...f('idNumber')} />
              <Field label="ID expiry" type="date" {...f('idExpiry')} />
            </Row>

            <Section label={tx('form.emergencyContact','Emergency Contact')} />
            <Row>
              <Field label="Contact name" placeholder="e.g. Mohammed Al-Ansari" {...f('emergencyName')} />
              <Field label="Relationship" placeholder="e.g. Father, Wife" {...f('emergencyRelation')} />
            </Row>
            <Field label="Contact phone" placeholder="+974 XXXX XXXX" {...f('emergencyPhone')} />

            <Section label={tx('form.medicalInfo','Medical Information')} />
            <Row>
              <Field label="Blood type" options={['','A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown']} {...f('bloodType')} />
              <Field label="Known allergies" placeholder="e.g. Penicillin, Nuts" {...f('allergies')} />
            </Row>
            <Field label="Medical conditions" placeholder="e.g. Asthma, Diabetes — leave blank if none" {...f('medicalConditions')} />
          </>}

          {/* ── COACH FORM ── */}
          {type === 'coach' && <>
            <Section label={tx('form.personalInfo','Personal Information')} />
            <Row>
              <Field label="Full name (English)" placeholder="e.g. Carlos Mendez" {...f('name')} />
              <Field label="Full name (Arabic)" placeholder="e.g. كارلوس مينديز" {...f('nameAr')} />
            </Row>
            <Row>
              <Field label="Nationality" placeholder="e.g. Spanish" {...f('nationality')} />
              <Field label="Gender" options={['','Male','Female']} {...f('gender')} />
            </Row>
            <Row>
              <Field label="Phone" placeholder="+974 XXXX XXXX" {...f('phone')} />
              <Field label="Email" type="email" placeholder="coach@qpc.qa" {...f('email')} />
            </Row>

            <Section label={tx('form.employment','Employment')} />
            <Row>
              <Field label="Sport" options={SPORTS} {...f('sport')} />
              <Field label="Cert. level" options={['Level 1','Level 2','Level 3']} {...f('certLevel')} />
            </Row>
            <Row>
              <Field label="Employee number" placeholder="e.g. 12501" {...f('employeeNumber')} />
              <Field label="QSS number" placeholder="e.g. 50112" {...f('qssNumber')} />
            </Row>
            <Row>
              <Field label="Start date with QPC" type="date" {...f('since')} />
              <Field label="Status" options={['Active','On Leave','Inactive']} {...f('status')} />
            </Row>

            <Section label={tx('form.passportID','Passport & ID')} />
            <Row>
              <Field label="Passport number" placeholder="e.g. A12345678" {...f('passportNumber')} />
              <Field label="Passport expiry" type="date" {...f('passportExpiry')} />
            </Row>
            <Row>
              <Field label="Qatar ID / Residence number" placeholder="e.g. 28412345678" {...f('idNumber')} />
              <Field label="ID expiry" type="date" {...f('idExpiry')} />
            </Row>
          </>}

          {/* ── EVENT FORM ── */}
          {type === 'event' && <>
            <Section label={tx('form.eventDetails','Event Details')} />
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

          {/* ── RESULT FORM ── */}
          {type === 'result' && <>
            <Section label={tx('form.resultInfo','Result Information')} />
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
          <button className="btn-cancel" onClick={onClose}>{tx('actions.cancel','Cancel')}</button>
          <button className="btn" style={{ background: COLORS[type] }} onClick={() => onSave(form)}>
            {isEdit ? 'Save changes' : 'Add record'}
          </button>
        </div>
      </div>
    </div>
  )
}
