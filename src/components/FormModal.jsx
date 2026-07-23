import { useState, useEffect, useRef } from 'react'
import NationalitySelect from './NationalitySelect.jsx'
import { SPORTS, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, SPORT_CATEGORY_NAMES_AR, sportLabel } from '../lib/helpers'
import { useLang } from '../lib/LangContext.jsx'

const COLORS = { athlete: '#0085C7', coach: '#009F6B', event: '#EE334E', result: '#8b5cf6' }

function computeEventStatus(startDate, endDate, deadline) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = startDate ? new Date(startDate) : null
  const effectiveEnd = endDate ? new Date(endDate) : (start ? new Date(startDate) : null)
  const dead = deadline ? new Date(deadline) : null

  if (!start) return 'Planning'

  if (dead) {
    if (today <= dead) return 'Planning'
    if (today < start) return 'Upcoming'
  } else {
    if (today < start) return 'Upcoming'
  }

  if (effectiveEnd && today > effectiveEnd) return 'Completed'
  return 'In Progress'
}

function Field({ label, name, type = 'text', placeholder, options, value, onChange, required, invalid }) {
  return (
    <div className="form-group" data-field={name}>
      <label className="form-label">
        {label}{required && <span style={{ color:'#dc2626' }}> *</span>}
      </label>
      {options ? (
        <select className="form-input" value={value ?? ''} onChange={e => onChange(name, e.target.value)}
          style={invalid ? { borderColor:'#dc2626' } : undefined}>
          {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
      ) : (
        <input className="form-input" type={type} placeholder={placeholder} value={value ?? ''} onChange={e => onChange(name, e.target.value)}
          style={invalid ? { borderColor:'#dc2626' } : undefined} />
      )}
    </div>
  )
}

function Row({ children }) { return <div className="form-row">{children}</div> }

function Section({ label, collapsible, open, onToggle }) {
  if (!collapsible) return <div className="form-section">{label}</div>
  return (
    <div className="form-section" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }} onClick={onToggle}>
      <span>{label}</span>
      <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ fontSize:14 }} />
    </div>
  )
}

export default function FormModal({ type, record, coaches, athletes, onSave, onClose, eventCategories }) {
  const isEdit = !!record
  const { lang } = useLang()
  const ar = lang === 'ar'
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [invalidFields, setInvalidFields] = useState({})
  const [openSections, setOpenSections] = useState({ personal:true, sport:false, club:false, id:false })
  function toggleSection(key) { setOpenSections(s => ({ ...s, [key]: !s[key] })) }
  const modalBodyRef = useRef(null)

  const categoryOpts = SPORT_CATEGORIES.map(c => ({
    value: c,
    label: ar ? (SPORT_CATEGORY_NAMES_AR[c]||c) : c
  }))

  const sportOpts = (SPORTS_BY_CATEGORY[form?.sportCategory] || SPORTS).map(s => ({
    value: s,
    label: sportLabel(s, form?.sportCategory, ar)
  }))

  const athDesigOpts = ['','Player','Female Player','Coach','Female Coach','Referee','Female Referee','Admin Staff','Technical Staff','Medical Staff','Board Member','Female Board Member','Member','Female Member','Employee','Female Employee','Expert'].map(s => ({
    value: s,
    label: ar && s ? ({'Player':'لاعب','Female Player':'لاعبة','Coach':'مدرب','Female Coach':'مدربة','Referee':'حكم','Female Referee':'حكمة','Admin Staff':'جهاز إداري','Technical Staff':'جهاز في','Medical Staff':'جهاز طبي','Board Member':'عضو مجلس إدارة','Female Board Member':'عضوة مجلس إدارة','Member':'عضو','Female Member':'عضوة','Employee':'موظف','Female Employee':'موظفة','Expert':'خبير في'}[s]||s) : s
  }))

  const residencyOpts = ['','Qatari Male','Qatari Female','Resident Male','Resident Female','Professional Male','Professional Female','Born in Qatar','Qatari Mother'].map(s => ({
    value: s,
    label: ar && s ? ({'Qatari Male':'قطري','Qatari Female':'قطرية','Resident Male':'مقيم','Resident Female':'مقيمة','Professional Male':'محترف','Professional Female':'محترفة','Born in Qatar':'مواليد قطر','Qatari Mother':'أم قطرية'}[s]||s) : s
  }))

  useEffect(() => {
    if (record) { setForm({ ...record }) }
    else {
      const defaults = {
        athlete: { gender: 'Male', nationality: 'Qatari', sportCategory: 'Summer Paralympic', sport: SPORTS[0], status: 'Active' },
        coach:   { sportCategory: 'Summer Paralympic', sport: SPORTS[0], status: 'Active' },
        event:   { sport: SPORTS[0], status: 'Planning', approvalStatus: 'TBC', maxParticipants: 30 },
        result:  { medal: 'gold', position: 1 },
      }
      setForm(defaults[type] || {})
    }
  }, [record, type])

  // Auto-compute event status when dates change
  useEffect(() => {
    if (type !== 'event') return
    const s = computeEventStatus(form.startDate, form.endDate, form.deadline)
    setForm(f => ({ ...f, status: s }))
  }, [form.startDate, form.endDate, form.deadline, type])

  const set = (name, value) => setForm(f => ({ ...f, [name]: value }))
  const f = (name) => ({ name, value: form[name], onChange: set })

  const T = {
    personalInfo:     ar ? 'المعلومات الشخصية'              : 'Personal Information',
    sportClass:       ar ? 'الرياضة والتصنيف'               : 'Sport & Classification',
    clubRole:         ar ? 'النادي والدور'                   : 'Club & Role',
    passportID:       ar ? 'الجواز والهوية'                  : 'Passport & ID',
    emergency:        ar ? 'جهة الاتصال في حالات الطوارئ'   : 'Emergency Contact',
    medical:          ar ? 'المعلومات الطبية'                : 'Medical Information',
    employment:       ar ? 'التوظيف'                         : 'Employment',
    eventDetails:     ar ? 'تفاصيل الفعالية'                 : 'Event Details',
    resultInfo:       ar ? 'معلومات النتيجة'                 : 'Result Information',
    nameEn:           ar ? 'الاسم الكامل (إنجليزي)'          : 'Full name (English)',
    nameAr:           ar ? 'الاسم الكامل (عربي)'             : 'Full name (Arabic)',
    dob:              ar ? 'تاريخ الميلاد'                   : 'Date of birth',
    gender:           ar ? 'الجنس'                           : 'Gender',
    nationality:      ar ? 'الجنسية'                         : 'Nationality',
    phone:            ar ? 'الهاتف'                          : 'Phone',
    email:            ar ? 'البريد الإلكتروني'               : 'Email',
    joinDate:         ar ? 'تاريخ الانضمام'                  : 'Join date',
    sportCategory:    ar ? 'فئة الرياضة'                     : 'Sport Category',
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
    empNum:           ar ? 'رقم الموظف'                      : 'Employee number',
    since:            ar ? 'تاريخ الانضمام إلى QPC'          : 'Start date with QPC',
    eventName:        ar ? 'اسم الفعالية'                    : 'Event name',
    eventNameAr:      ar ? 'اسم الفعالية (عربي)'             : 'Arabic name',
    category:         ar ? 'التصنيف'                         : 'Category',
    approvalStatus:   ar ? 'حالة الموافقة'                   : 'Approval status',
    venue:            ar ? 'المكان'                          : 'Venue / place',
    startDate:        ar ? 'تاريخ البداية'                   : 'Start date',
    endDate:          ar ? 'تاريخ النهاية'                   : 'End date',
    deadline:         ar ? 'الموعد النهائي'                  : 'Deadline',
    maxPart:          ar ? 'الحد الأقصى للمشاركين'           : 'Max participants',
    notes:            ar ? 'ملاحظات'                         : 'Notes',
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

  const DATE_STATUSES = ['On Leave','In Competition','In Training Camp']
  const statusOptsAthlete = ['','Active','On Leave','In Competition','In Training Camp','Inactive','Injured','Under Medical Review','Suspended','Retired'].map(s => ({
    value: s,
    label: s === '' ? '' : ar ? {'Active':'نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Inactive':'غير نشط','Injured':'مصاب','Under Medical Review':'تحت المراجعة الطبية','Suspended':'موقوف','Retired':'متقاعد'}[s]||s : s
  }))

  const statusOptsCoach = ['Active','On Leave','In Competition','In Training Camp','Inactive','Retired'].map(s => ({
    value: s, label: ar ? {'Active':'نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Inactive':'غير نشط','Retired':'متقاعد'}[s]||s : s
  }))

  const statusOptsEvent = ['Planning','Upcoming','In Progress','Completed','Canceled'].map(s => ({
    value: s, label: ar ? {'Planning':'قيد التخطيط','Upcoming':'قادم','In Progress':'جارٍ','Completed':'مكتمل','Canceled':'ملغى'}[s]||s : s
  }))

  const approvalOpts = ['TBC','Approved','Rejected'].map(s => ({
    value: s, label: ar ? {'TBC':'تحت المراجعة','Approved':'معتمد','Rejected':'مرفوض'}[s]||s : s
  }))

  const eventCatOpts = [
    { value: '', label: ar ? '— اختر تصنيفاً —' : '— Select category —' },
    ...(eventCategories || []).filter(c => c.is_active).map(c => ({
      value: String(c.id),
      label: ar && c.name_ar ? c.name_ar : c.name,
    })),
  ]

  const medalOpts = ['gold','silver','bronze'].map(s => ({
    value: s, label: ar ? {'gold':'ذهب','silver':'فضة','bronze':'برونز'}[s] : s
  }))

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? (ar?'تعديل':'Edit') : (ar?'إضافة':'New')} {typeLabel[type]}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div className="modal-body" ref={modalBodyRef} style={{ paddingBottom: 24 }}>

          {/* ── ATHLETE ── */}
          {type === 'athlete' && <>
            <Section label={T.personalInfo} collapsible open={openSections.personal} onToggle={() => toggleSection('personal')} />
            {openSections.personal && <>
              <Row>
                <Field label={T.nameEn} required invalid={invalidFields.name} placeholder={ar?"مثال: أحمد الأنصاري":"e.g. Ahmed Al-Ansari"} {...f('name')} />
                <Field label={T.nameAr} placeholder="e.g. أحمد الأنصاري" {...f('nameAr')} />
              </Row>
              <Row>
                <Field label={T.dob} type="date" {...f('dob')} />
                <Field label={T.gender} required invalid={invalidFields.gender} options={genderOpts} {...f('gender')} />
              </Row>
              <Row>
                <div className="form-group">
                <label className="form-label">{T.nationality}<span style={{ color:'#dc2626' }}> *</span></label>
                <NationalitySelect value={form.nationality} onChange={v => set('nationality', v)} lang={lang} />
              </div>
                <Field label={T.phone} placeholder="+974 XXXX XXXX" {...f('phone')} />
              </Row>
              <Row>
                <Field label={T.email} type="email" placeholder={ar?"رياضي@qpc.qa":"athlete@qpc.qa"} {...f('email')} />
                <Field label={T.joinDate} type="date" {...f('joinDate')} />
              </Row>
            </>}

            <Section label={T.sportClass} collapsible open={openSections.sport} onToggle={() => toggleSection('sport')} />
            {openSections.sport && <>
              <Row>
                <Field label={T.sportCategory} required invalid={invalidFields.sportCategory} options={categoryOpts} {...f('sportCategory')}
                  onChange={(name, v) => {
                    const validSports = SPORTS_BY_CATEGORY[v] || SPORTS
                    setForm(p => ({ ...p, sportCategory: v, sport: validSports.includes(p.sport) ? p.sport : (validSports[0] || '') }))
                  }} />
                <Field label={T.sport} required invalid={invalidFields.sport} options={sportOpts} {...f('sport')} />
              </Row>
              <Row>
                <Field label={T.classification} placeholder={ar?"مثال: T54, S6, BC2":"e.g. T54, S6, BC2"} {...f('classification')} />
              </Row>
              <Row>
                <Field label={T.disability} placeholder={ar?"مثال: إصابة الحبل الشوكي":"e.g. Spinal Cord Injury"} {...f('disability')} />
                <div className="form-group">
                  <label className="form-label">{ar ? 'الإعاقة الإحصائية' : 'Statistics Disability'}</label>
                  <select className="form-input" value={form.statistics_disability||''} onChange={e=>setForm(p=>({...p,statistics_disability:e.target.value||null}))}>
                    <option value="">{ar ? '— اختر —' : '— Select —'}</option>
                    {[
                      ['Physical Disability',        'الإعاقات الجسدية / الحركية'],
                      ['Intellectual Disability',    'الإعاقة الذهنية'],
                      ['Visual Disability',          'الإعاقة البصرية'],
                      ['Hearing Disability',         'الإعاقة السمعية'],
                      ['Speech & Language Disorders','اضطرابات النطق واللغة'],
                      ['Psychosocial Disability',    'الإعاقة النفسية والاجتماعية'],
                      ['Multiple Disability',        'الإعاقات المتعددة'],
                      ['Developmental Disability',   'الإعاقات النمائية'],
                      ['Down Syndrome',              'متلازمة داون'],
                      ['Autism',                     'اضطراب التوحد'],
                    ].map(([en, arLabel]) => (
                      <option key={en} value={en}>{ar ? arLabel : en}</option>
                    ))}
                  </select>
                </div>
              </Row>
              <div style={{ fontSize:11.5, color:'var(--text3)', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 10px', margin:'2px 0 14px', display:'flex', gap:14, flexWrap:'wrap' }}>
                <span>{ar ? 'الفئة العمرية: تُحسب تلقائياً' : 'Age category: auto-computed'}</span>
                <span>{ar ? 'الفئة العمرية الرياضية: تُحسب تلقائياً' : 'Sport age category: auto-computed'}</span>
              </div>
              <Row>
                <Field label={T.coach} options={[{ value:'', label: T.unassigned }, ...(coaches||[]).map(c => ({ value: c.id, label: ar && c.name_ar ? c.name_ar : c.name }))]} {...f('coachId')} />
                <Field label={T.status} required invalid={invalidFields.status} options={statusOptsAthlete} {...f('status')} onChange={(name, v) => { set(name, v); if (!DATE_STATUSES.includes(v)) { set('statusStart', null); set('statusEnd', null) } }} />
                {DATE_STATUSES.includes(form.status) && (
                  <div className="form-group">
                    <label className="form-label">{ar ? 'تاريخ البداية' : 'Start date'}</label>
                    <input type="date" className="form-input" value={form.statusStart||''} onChange={e=>setForm(p=>({...p,statusStart:e.target.value||null}))} />
                  </div>
                )}
                {DATE_STATUSES.includes(form.status) && (
                  <div className="form-group">
                    <label className="form-label">{ar ? 'تاريخ الرجوع' : 'Return date'}</label>
                    <input type="date" className="form-input" value={form.statusEnd||''} onChange={e=>setForm(p=>({...p,statusEnd:e.target.value||null}))} />
                  </div>
                )}
              </Row>
              <Row>
                <Field label={T.medicalStatus} placeholder={ar?"مثال: مكتمل":"e.g. Completed"} {...f('medicalStatus')} />
                <Field label={T.careerProfile} placeholder="e.g. 12345" {...f('careerProfile')} />
              </Row>
            </>}

            <Section label={T.clubRole} collapsible open={openSections.club} onToggle={() => toggleSection('club')} />
            {openSections.club && <>
              <Row>
                <Field label={T.club} placeholder={ar?"مثال: نادي الوكرة":"e.g. Al Wakrah SC"} {...f('club')} />
                <Field label={T.designation} options={athDesigOpts} {...f('designation')} />
              </Row>
              <Row>
                <Field label={T.residency} options={residencyOpts} {...f('residencyStatus')} />
                <Field label={T.qss} placeholder="e.g. 12345" {...f('qssNumber')} />
              </Row>
            </>}

            <Section label={T.passportID} collapsible open={openSections.id} onToggle={() => toggleSection('id')} />
            {openSections.id && <>
              <Row>
                <Field label={T.passportNum} placeholder="e.g. A12345678" {...f('passportNumber')} />
                <Field label={T.passportExp} type="date" {...f('passportExpiry')} />
              </Row>
              <Row>
                <Field label={T.idNum} placeholder="e.g. 28412345678" {...f('idNumber')} />
                <Field label={T.idExp} type="date" {...f('idExpiry')} />
              </Row>
            </>}
          </>}

          {/* ── COACH ── */}
          {type === 'coach' && <>
            <Section label={T.personalInfo} />
            <Row>
              <Field label={T.nameEn} placeholder={ar?"مثال: كارلوس مينديز":"e.g. Carlos Mendez"} {...f('name')} />
              <Field label={T.nameAr} placeholder="e.g. كارلوس مينديز" {...f('nameAr')} />
            </Row>
            <Row>
              <div className="form-group">
                <label className="form-label">{T.nationality}</label>
                <NationalitySelect value={form.nationality} onChange={v => set('nationality', v)} lang={lang} />
              </div>
              <Field label={T.gender} options={genderOptsEmpty} {...f('gender')} />
            </Row>
            <Row>
              <Field label={T.phone} placeholder="+974 XXXX XXXX" {...f('phone')} />
              <Field label={T.email} type="email" placeholder={ar?"مدرب@qpc.qa":"coach@qpc.qa"} {...f('email')} />
            </Row>

            <Section label={T.employment} />
            <Row>
              <Field label={T.sportCategory} options={categoryOpts} {...f('sportCategory')}
                onChange={(name, v) => {
                  const validSports = SPORTS_BY_CATEGORY[v] || SPORTS
                  setForm(p => ({ ...p, sportCategory: v, sport: validSports.includes(p.sport) ? p.sport : (validSports[0] || '') }))
                }} />
              <Field label={T.sport} options={sportOpts} {...f('sport')} />
            </Row>
            <Row>
              <Field label={T.empNum} placeholder="e.g. 12501" {...f('employeeNumber')} />
              <Field label={T.qss} placeholder="e.g. 50112" {...f('qssNumber')} />
            </Row>
            <Row>
              <Field label={T.since} type="date" {...f('since')} />
              <Field label={T.status} options={statusOptsCoach} {...f('status')} onChange={(name, v) => { set(name, v); if (!DATE_STATUSES.includes(v)) { set('statusStart', null); set('statusEnd', null) } }} />
              {DATE_STATUSES.includes(form.status) && (
                <div className="form-group">
                  <label className="form-label">{ar ? 'تاريخ البداية' : 'Start date'}</label>
                  <input type="date" className="form-input" value={form.statusStart||''} onChange={e=>setForm(p=>({...p,statusStart:e.target.value||null}))} />
                </div>
              )}
              {DATE_STATUSES.includes(form.status) && (
                <div className="form-group">
                  <label className="form-label">{ar ? 'تاريخ الرجوع' : 'Return date'}</label>
                  <input type="date" className="form-input" value={form.statusEnd||''} onChange={e=>setForm(p=>({...p,statusEnd:e.target.value||null}))} />
                </div>
              )}
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
            <Row>
              <Field label={T.eventName} placeholder={ar?"مثال: بطولة قطر المفتوحة":"e.g. Qatar Open Athletics Championships"} {...f('name')} />
              <Field label={T.eventNameAr} placeholder="e.g. بطولة قطر المفتوحة" {...f('nameAr')} />
            </Row>
            <Row>
              <Field label={T.category} options={eventCatOpts} {...f('categoryId')} />
              <Field label={T.approvalStatus} options={approvalOpts} {...f('approvalStatus')} />
            </Row>
            <Field label={T.sport} options={[{ value:'', label: ar ? '— اختر رياضة —' : '— Select sport —' }, ...SPORTS.map(s => ({ value: s, label: s }))]} {...f('sport')} />
            <Field label={T.venue} placeholder={ar?"مثال: استاد خليفة الدولي":"e.g. Khalifa International Stadium"} {...f('venue')} />
            <Row>
              <Field label={T.startDate} type="date" {...f('startDate')} />
              <Field label={T.endDate} type="date" {...f('endDate')} />
            </Row>
            <Row>
              <Field label={T.deadline} type="date" {...f('deadline')} />
              <Field label={T.status} options={statusOptsEvent} {...f('status')} />
            </Row>
            <Field label={T.maxPart} type="number" placeholder="30" {...f('maxParticipants')} />
            <div className="form-group">
              <label className="form-label">{T.notes}</label>
              <textarea className="form-input" rows={3} placeholder={ar ? 'ملاحظات إضافية…' : 'Additional notes…'} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical', minHeight: 72 }} />
            </div>
          </>}

          {/* ── RESULT ── */}
          {type === 'result' && <>
            <Section label={T.resultInfo} />
            <Row>
              <Field label={T.athlete} options={(athletes||[]).map(a => ({ value: a.name, label: ar && a.name_ar ? a.name_ar : a.name }))} {...f('athleteName')} />
              <Field label={T.medal} options={medalOpts} {...f('medal')} />
            </Row>
            <Field label={T.compName} placeholder={ar?"مثال: بطولة الرماية 2026":"e.g. Para Shooting Nationals 2026"} {...f('eventName')} />
            <Row>
              <Field label={T.discipline} placeholder={ar?"مثال: 10م بندقية هواء SH1":"e.g. 10m Air Rifle SH1"} {...f('discipline')} />
              <Field label={T.result} placeholder={ar?"مثال: 248.7 نقطة":"e.g. 248.7 pts"} {...f('result')} />
            </Row>
            <Row>
              <Field label={T.position} type="number" placeholder="1" {...f('position')} />
              <Field label={T.date} type="date" {...f('date')} />
            </Row>
          </>}

        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={saving}>{T.cancel}</button>
          <button className="btn" style={{ background: COLORS[type], opacity: saving ? .7 : 1, cursor: saving ? 'default' : 'pointer', display:'flex', alignItems:'center', gap:6 }}
            disabled={saving}
            onClick={async () => {
              if (saving) return
              if (type === 'athlete') {
                const requiredMap = { name: form.name, gender: form.gender, nationality: form.nationality, sportCategory: form.sportCategory, sport: form.sport, status: form.status }
                const bad = {}
                for (const [key, val] of Object.entries(requiredMap)) { if (!val || !String(val).trim()) bad[key] = true }
                setInvalidFields(bad)
                const firstBadKey = Object.keys(bad)[0]
                if (firstBadKey) {
                  const el = modalBodyRef.current?.querySelector(`[data-field="${firstBadKey}"]`)
                  if (el) {
                    if (['name','gender','nationality'].includes(firstBadKey)) setOpenSections(s => ({ ...s, personal: true }))
                    if (['sportCategory','sport','status'].includes(firstBadKey)) setOpenSections(s => ({ ...s, sport: true }))
                    setTimeout(() => {
                      el.scrollIntoView({ behavior:'smooth', block:'center' })
                      el.querySelector('input,select')?.focus()
                    }, 50)
                  }
                  return
                }
              }
              setSaving(true)
              try {
                await onSave(form)
              } finally {
                setSaving(false)
              }
            }}>
            {saving && <span style={{ width:12, height:12, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' }} />}
            {isEdit ? T.save : T.add}
          </button>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
