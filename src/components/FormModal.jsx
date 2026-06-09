import { useState, useEffect } from 'react'
import { SPORTS } from '../lib/helpers'
import { useLang } from '../lib/LangContext.jsx'

const COLORS = { athlete: '#0085C7', coach: '#009F6B', event: '#EE334E', result: '#8b5cf6' }

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
  const { lang } = useLang()
  const ar = lang === 'ar'
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

  const T = {
    // Section titles
    personalInfo:     ar ? 'المعلومات الشخصية'              : 'Personal Information',
    sportClass:       ar ? 'الرياضة والتصنيف'               : 'Sport & Classification',
    clubRole:         ar ? 'النادي والدور'                   : 'Club & Role',
    passportID:       ar ? 'الجواز والهوية'                  : 'Passport & ID',
    emergency:        ar ? 'جهة الاتصال في حالات الطوارئ'   : 'Emergency Contact',
    medical:          ar ? 'المعلومات الطبية'                : 'Medical Information',
    employment:       ar ? 'التوظيف'                         : 'Employment',
    eventDetails:     ar ? 'تفاصيل الفعالية'                 : 'Event Details',
    resultInfo:       ar ? 'معلومات النتيجة'                 : 'Result Information',
    // Field labels
    nameEn:           ar ? 'الاسم الكامل (إنجليزي)'          : 'Full name (English)',
    nameAr:           ar ? 'الاسم الكامل (عربي)'             : 'Full name (Arabic)',
    dob:              ar ? 'تاريخ الميلاد'                   : 'Date of birth',
    gender:           ar ? 'الجنس'                           : 'Gender',
    nationality:      ar ? 'الجنسية'                         : 'Nationality',
    phone:            ar ? 'الهاتف'                          : 'Phone',
    email:            ar ? 'البريد الإلكتروني'               : 'Email',
    joinDate:         ar ? 'تاريخ الانضمام'                  : 'Join date',
    sport:            ar ? 'الرياضة'                         : 'Sport',
    classification:   ar ? 'التصنيف'                         : 'Classification',
    disability:       ar ? 'نوع الإعاقة'                     : 'Disability type',
    ageCategory:      ar ? 'الفئة العمرية'                   : 'Age category',
    coach:            ar ? 'المدرب'                          : 'Coach',
    status:           ar ? 'الحالة'                          : 'Status',
    medicalStatus:    ar ? 'الحالة الطبية'                   : 'Medical status',
    careerProfile:    ar ? 'رقم المسار'                      : 'Career profile #',
    club:             ar ? 'النادي'                          : 'Club',
    designation:      ar ? 'الوظيفة'                         : 'Designation',
    residency:        ar ? 'الصفة'                           : 'Residency status',
    qss:              ar ? 'رقم QSS'                         : 'QSS number',
    passportNum:      ar ? 'رقم الجواز'                      : 'Passport number',
    passportExp:      ar ? 'تاريخ انتهاء الجواز'             : 'Passport expiry',
    idNum:            ar ? 'الرقم الشخصي'                    : 'Qatar ID number',
    idExp:            ar ? 'تاريخ انتهاء الهوية'             : 'ID expiry',
    idResNum:         ar ? 'رقم الهوية / الإقامة'            : 'Qatar ID / Residence number',
    contactName:      ar ? 'اسم جهة الاتصال'                 : 'Contact name',
    relationship:     ar ? 'صلة القرابة'                     : 'Relationship',
    contactPhone:     ar ? 'هاتف الاتصال'                    : 'Contact phone',
    bloodType:        ar ? 'فصيلة الدم'                      : 'Blood type',
    allergies:        ar ? 'الحساسية'                        : 'Known allergies',
    conditions:       ar ? 'الحالات الطبية'                  : 'Medical conditions',
    certLevel:        ar ? 'مستوى الشهادة'                   : 'Cert. level',
    empNum:           ar ? 'رقم الموظف'                      : 'Employee number',
    since:            ar ? 'تاريخ الانضمام إلى QPC'          : 'Start date with QPC',
    eventName:        ar ? 'اسم الفعالية'                    : 'Event name',
    eventType:        ar ? 'النوع'                           : 'Type',
    venue:            ar ? 'المكان'                          : 'Venue',
    startDate:        ar ? 'تاريخ البداية'                   : 'Start date',
    endDate:          ar ? 'تاريخ النهاية'                   : 'End date',
    maxPart:          ar ? 'الحد الأقصى للمشاركين'           : 'Max participants',
    athlete:          ar ? 'الرياضي'                         : 'Athlete',
    medal:            ar ? 'الميدالية'                       : 'Medal',
    compName:         ar ? 'اسم المنافسة'                    : 'Competition name',
    discipline:       ar ? 'التخصص'                          : 'Discipline / event',
    result:           ar ? 'النتيجة'                         : 'Result / score',
    position:         ar ? 'الترتيب'                         : 'Position',
    date:             ar ? 'التاريخ'                         : 'Date',
    unassigned:       ar ? 'غير معين'                        : 'Unassigned',
    save:             ar ? 'حفظ التغييرات'                   : 'Save changes',
    add:              ar ? 'إضافة'                           : 'Add record',
    cancel:           ar ? 'إلغاء'                           : 'Cancel',
    // Dropdown options
    male:             ar ? 'ذكر'   : 'Male',
    female:           ar ? 'أنثى' : 'Female',
  }

  const typeLabel = {
    athlete: ar ? 'رياضي'  : 'Athlete',
    coach:   ar ? 'مدرب'   : 'Coach',
    event:   ar ? 'فعالية' : 'Event',
    result:  ar ? 'نتيجة'  : 'Result',
  }

  const genderOpts = [
    { value:'Male',   label: T.male },
    { value:'Female', label: T.female },
  ]
  const genderOptsEmpty = [{ value:'', label:'' }, ...genderOpts]

  const statusOptsAthlete = ['','Active','Inactive','Suspended','Under Medical Review','Injured','Retired'].map(s => ({
    value: s,
    label: s === '' ? '' : ar ? {'Active':'نشط','Inactive':'غير نشط','Suspended':'موقوف','Under Medical Review':'تحت المراجعة الطبية','Injured':'مصاب','Retired':'متقاعد'}[s]||s : s
  }))

  const statusOptsCoach = ['Active','On Leave','Inactive'].map(s => ({
    value: s, label: ar ? {'Active':'نشط','On Leave':'في إجازة','Inactive':'غير نشط'}[s]||s : s
  }))

  const statusOptsEvent = ['Planning','Registration Open','Upcoming','Completed'].map(s => ({
    value: s, label: ar ? {'Planning':'قيد التخطيط','Registration Open':'التسجيل مفتوح','Upcoming':'قادم','Completed':'مكتمل'}[s]||s : s
  }))

  const medalOpts = ['gold','silver','bronze'].map(s => ({
    value: s, label: ar ? {'gold':'ذهب','silver':'فضة','bronze':'برونز'}[s] : s
  }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? (ar?'تعديل':'Edit') : (ar?'إضافة':'New')} {typeLabel[type]}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div className="modal-body">

          {/* ── ATHLETE ── */}
          {type === 'athlete' && <>
            <Section label={T.personalInfo} />
            <Row>
              <Field label={T.nameEn} placeholder="e.g. Ahmed Al-Ansari" {...f('name')} />
              <Field label={T.nameAr} placeholder="e.g. أحمد الأنصاري" {...f('nameAr')} />
            </Row>
            <Row>
              <Field label={T.dob} type="date" {...f('dob')} />
              <Field label={T.gender} options={genderOpts} {...f('gender')} />
            </Row>
            <Row>
              <Field label={T.nationality} placeholder="e.g. Qatari" {...f('nationality')} />
              <Field label={T.phone} placeholder="+974 XXXX XXXX" {...f('phone')} />
            </Row>
            <Row>
              <Field label={T.email} type="email" placeholder="athlete@qpc.qa" {...f('email')} />
              <Field label={T.joinDate} type="date" {...f('joinDate')} />
            </Row>

            <Section label={T.sportClass} />
            <Row>
              <Field label={T.sport} options={SPORTS} {...f('sport')} />
              <Field label={T.classification} placeholder="e.g. T54, S6, BC2" {...f('classification')} />
            </Row>
            <Row>
              <Field label={T.disability} placeholder="e.g. Spinal Cord Injury" {...f('disability')} />
              <Field label={T.ageCategory} placeholder="e.g. رجال (20+)" {...f('ageCategory')} />
            </Row>
            <Row>
              <Field label={T.coach} options={[{ value:'', label: T.unassigned }, ...(coaches||[]).map(c => ({ value: c.id, label: ar && c.name_ar ? c.name_ar : c.name }))]} {...f('coachId')} />
              <Field label={T.status} options={statusOptsAthlete} {...f('status')} />
            </Row>
            <Row>
              <Field label={T.medicalStatus} placeholder="e.g. Completed" {...f('medicalStatus')} />
              <Field label={T.careerProfile} placeholder="e.g. 12345" {...f('careerProfile')} />
            </Row>

            <Section label={T.clubRole} />
            <Row>
              <Field label={`${T.club} (النادي)`} placeholder="e.g. Al Wakrah SC" {...f('club')} />
              <Field label={`${T.designation} (الوظيفة)`} options={['','Player','Female Player','Coach','Female Coach','Referee','Female Referee','Admin Staff','Technical Staff','Medical Staff','Board Member','Female Board Member','Member','Female Member','Employee','Female Employee','Expert']} {...f('designation')} />
            </Row>
            <Row>
              <Field label={`${T.residency} (الصفة)`} options={['','Qatari Male','Qatari Female','Resident Male','Resident Female','Professional Male','Professional Female','Born in Qatar','Qatari Mother']} {...f('residencyStatus')} />
              <Field label={T.qss} placeholder="e.g. 12345" {...f('qssNumber')} />
            </Row>

            <Section label={T.passportID} />
            <Row>
              <Field label={T.passportNum} placeholder="e.g. A12345678" {...f('passportNumber')} />
              <Field label={T.passportExp} type="date" {...f('passportExpiry')} />
            </Row>
            <Row>
              <Field label={T.idNum} placeholder="e.g. 28412345678" {...f('idNumber')} />
              <Field label={T.idExp} type="date" {...f('idExpiry')} />
            </Row>

            <Section label={T.emergency} />
            <Row>
              <Field label={T.contactName} placeholder="e.g. Mohammed Al-Ansari" {...f('emergencyName')} />
              <Field label={T.relationship} placeholder="e.g. Father" {...f('emergencyRelation')} />
            </Row>
            <Field label={T.contactPhone} placeholder="+974 XXXX XXXX" {...f('emergencyPhone')} />

            <Section label={T.medical} />
            <Row>
              <Field label={T.bloodType} options={['','A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown']} {...f('bloodType')} />
              <Field label={T.allergies} placeholder="e.g. Penicillin, Nuts" {...f('allergies')} />
            </Row>
            <Field label={T.conditions} placeholder="e.g. Asthma, Diabetes" {...f('medicalConditions')} />
          </>}

          {/* ── COACH ── */}
          {type === 'coach' && <>
            <Section label={T.personalInfo} />
            <Row>
              <Field label={T.nameEn} placeholder="e.g. Carlos Mendez" {...f('name')} />
              <Field label={T.nameAr} placeholder="e.g. كارلوس مينديز" {...f('nameAr')} />
            </Row>
            <Row>
              <Field label={T.nationality} placeholder="e.g. Spanish" {...f('nationality')} />
              <Field label={T.gender} options={genderOptsEmpty} {...f('gender')} />
            </Row>
            <Row>
              <Field label={T.phone} placeholder="+974 XXXX XXXX" {...f('phone')} />
              <Field label={T.email} type="email" placeholder="coach@qpc.qa" {...f('email')} />
            </Row>

            <Section label={T.employment} />
            <Row>
              <Field label={T.sport} options={SPORTS} {...f('sport')} />
              <Field label={T.certLevel} options={['Level 1','Level 2','Level 3']} {...f('certLevel')} />
            </Row>
            <Row>
              <Field label={T.empNum} placeholder="e.g. 12501" {...f('employeeNumber')} />
              <Field label={T.qss} placeholder="e.g. 50112" {...f('qssNumber')} />
            </Row>
            <Row>
              <Field label={T.since} type="date" {...f('since')} />
              <Field label={T.status} options={statusOptsCoach} {...f('status')} />
            </Row>

            <Section label={T.passportID} />
            <Row>
              <Field label={T.passportNum} placeholder="e.g. A12345678" {...f('passportNumber')} />
              <Field label={T.passportExp} type="date" {...f('passportExpiry')} />
            </Row>
            <Row>
              <Field label={T.idResNum} placeholder="e.g. 28412345678" {...f('idNumber')} />
              <Field label={T.idExp} type="date" {...f('idExpiry')} />
            </Row>
          </>}

          {/* ── EVENT ── */}
          {type === 'event' && <>
            <Section label={T.eventDetails} />
            <Field label={T.eventName} placeholder="e.g. Qatar Open Athletics Championships" {...f('name')} />
            <Row>
              <Field label={T.sport} options={SPORTS} {...f('sport')} />
              <Field label={T.eventType} options={['National','Regional','Invitational']} {...f('type')} />
            </Row>
            <Field label={T.venue} placeholder="e.g. Khalifa International Stadium" {...f('venue')} />
            <Row>
              <Field label={T.startDate} type="date" {...f('startDate')} />
              <Field label={T.endDate} type="date" {...f('endDate')} />
            </Row>
            <Row>
              <Field label={T.maxPart} type="number" placeholder="60" {...f('maxParticipants')} />
              <Field label={T.status} options={statusOptsEvent} {...f('status')} />
            </Row>
          </>}

          {/* ── RESULT ── */}
          {type === 'result' && <>
            <Section label={T.resultInfo} />
            <Row>
              <Field label={T.athlete} options={(athletes||[]).map(a => ({ value: a.name, label: ar && a.name_ar ? a.name_ar : a.name }))} {...f('athleteName')} />
              <Field label={T.medal} options={medalOpts} {...f('medal')} />
            </Row>
            <Field label={T.compName} placeholder="e.g. Para Shooting Nationals 2026" {...f('eventName')} />
            <Row>
              <Field label={T.discipline} placeholder="e.g. 10m Air Rifle SH1" {...f('discipline')} />
              <Field label={T.result} placeholder="e.g. 248.7 pts" {...f('result')} />
            </Row>
            <Row>
              <Field label={T.position} type="number" placeholder="1" {...f('position')} />
              <Field label={T.date} type="date" {...f('date')} />
            </Row>
          </>}

        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{T.cancel}</button>
          <button className="btn" style={{ background: COLORS[type] }} onClick={() => onSave(form)}>
            {isEdit ? T.save : T.add}
          </button>
        </div>
      </div>
    </div>
  )
}
