import { useState, useEffect } from 'react'
import { SPORTS, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, SPORT_CATEGORY_NAMES_AR, sportLabel } from '../lib/helpers'
import { useLang } from '../lib/LangContext.jsx'

const COLORS = { athlete: '#0085C7', coach: '#009F6B', event: '#EE334E', result: '#8b5cf6' }

const COUNTRIES_EN = [
  'Afghanistan','Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahrain','Bangladesh','Belarus','Belgium','Brazil','Cameroon','Canada','Chile',
  'China','Colombia','Croatia','Czech Republic','Denmark','Egypt','Eritrea',
  'Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Guinea',
  'Hungary','India','Indonesia','Iran','Iraq','Ireland','Italy','Japan','Jordan',
  'Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Lebanon','Libya','Malaysia','Mali',
  'Mauritania','Mexico','Mongolia','Morocco','Myanmar','Nepal','Netherlands',
  'New Zealand','Nigeria','Norway','Oman','Pakistan','Palestine','Peru',
  'Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda',
  'Saudi Arabia','Scotland','Senegal','Serbia','Singapore','Slovakia',
  'Somalia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden',
  'Syria','Tajikistan','Tanzania','Thailand','Tunisia','Turkey','Turkmenistan',
  'UAE','Uganda','UK','Ukraine','USA','Uzbekistan','Venezuela','Vietnam',
  'Wales','Yemen','Zambia','Zimbabwe',
]

const COUNTRIES_AR = {
  'Afghanistan':'أفغانستان','Algeria':'الجزائر','Argentina':'الأرجنتين',
  'Armenia':'أرمينيا','Australia':'أستراليا','Austria':'النمسا',
  'Azerbaijan':'أذربيجان','Bahrain':'البحرين','Bangladesh':'بنغلاديش',
  'Belarus':'بيلاروسيا','Belgium':'بلجيكا','Brazil':'البرازيل',
  'Cameroon':'الكاميرون','Canada':'كندا','Chile':'تشيلي','China':'الصين',
  'Colombia':'كولومبيا','Croatia':'كرواتيا','Czech Republic':'التشيك',
  'Denmark':'الدنمارك','Egypt':'مصر','Eritrea':'إريتريا','Ethiopia':'إثيوبيا',
  'Finland':'فنلندا','France':'فرنسا','Georgia':'جورجيا','Germany':'ألمانيا',
  'Ghana':'غانا','Greece':'اليونان','Guinea':'غينيا','Hungary':'المجر',
  'India':'الهند','Indonesia':'إندونيسيا','Iran':'إيران','Iraq':'العراق',
  'Ireland':'أيرلندا','Italy':'إيطاليا','Japan':'اليابان','Jordan':'الأردن',
  'Kazakhstan':'كازاخستان','Kenya':'كينيا','Kuwait':'الكويت',
  'Kyrgyzstan':'قيرغيزستان','Lebanon':'لبنان','Libya':'ليبيا',
  'Malaysia':'ماليزيا','Mali':'مالي','Mauritania':'موريتانيا','Mexico':'المكسيك',
  'Mongolia':'منغوليا','Morocco':'المغرب','Myanmar':'ميانمار','Nepal':'نيبال',
  'Netherlands':'هولندا','New Zealand':'نيوزيلندا','Nigeria':'نيجيريا',
  'Norway':'النرويج','Oman':'عُمان','Pakistan':'باكستان','Palestine':'فلسطين',
  'Peru':'بيرو','Philippines':'الفلبين','Poland':'بولندا','Portugal':'البرتغال',
  'Qatar':'قطر','Romania':'رومانيا','Russia':'روسيا','Rwanda':'رواندا',
  'Saudi Arabia':'المملكة العربية السعودية','Scotland':'اسكتلندا',
  'Senegal':'السنغال','Serbia':'صربيا','Singapore':'سنغافورة',
  'Slovakia':'سلوفاكيا','Somalia':'الصومال','South Africa':'جنوب أفريقيا',
  'South Korea':'كوريا الجنوبية','Spain':'إسبانيا','Sri Lanka':'سريلانكا',
  'Sudan':'السودان','Sweden':'السويد','Syria':'سوريا','Tajikistan':'طاجيكستان',
  'Tanzania':'تنزانيا','Thailand':'تايلاند','Tunisia':'تونس','Turkey':'تركيا',
  'Turkmenistan':'تركمانستان','UAE':'الإمارات','Uganda':'أوغندا',
  'UK':'المملكة المتحدة','Ukraine':'أوكرانيا','USA':'الولايات المتحدة',
  'Uzbekistan':'أوزبكستان','Venezuela':'فنزويلا','Vietnam':'فيتنام',
  'Wales':'ويلز','Yemen':'اليمن','Zambia':'زامبيا','Zimbabwe':'زيمبابوي',
}

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

  // Country options
  const countryOpts = [
    { value:'', label:'' },
    ...COUNTRIES_EN.map(c => ({ value: c, label: ar ? (COUNTRIES_AR[c]||c) : c }))
  ]

  // Category options (Paralympic / Special Olympics)
  const categoryOpts = SPORT_CATEGORIES.map(c => ({
    value: c,
    label: ar ? (SPORT_CATEGORY_NAMES_AR[c]||c) : c
  }))

  // Sport options with Arabic labels — scoped to whichever category is currently
  // selected in the form, so picking "Special Olympics" only shows its disciplines
  // (plus the legacy flat value). Falls back to every sport if no category is set yet.
  const sportOpts = (SPORTS_BY_CATEGORY[form?.sportCategory] || SPORTS).map(s => ({
    value: s,
    label: sportLabel(s, form?.sportCategory, ar)
  }))

  // Athlete designation options
  const athDesigOpts = ['','Player','Female Player','Coach','Female Coach','Referee','Female Referee','Admin Staff','Technical Staff','Medical Staff','Board Member','Female Board Member','Member','Female Member','Employee','Female Employee','Expert'].map(s => ({
    value: s,
    label: ar && s ? ({'Player':'لاعب','Female Player':'لاعبة','Coach':'مدرب','Female Coach':'مدربة','Referee':'حكم','Female Referee':'حكمة','Admin Staff':'جهاز إداري','Technical Staff':'جهاز في','Medical Staff':'جهاز طبي','Board Member':'عضو مجلس إدارة','Female Board Member':'عضوة مجلس إدارة','Member':'عضو','Female Member':'عضوة','Employee':'موظف','Female Employee':'موظفة','Expert':'خبير في'}[s]||s) : s
  }))

  // Residency status options
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
    sportCategory:    ar ? 'فئة الرياضة'                       : 'Sport Category',
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
              <Field label={T.nameEn} placeholder={ar?"مثال: أحمد الأنصاري":"e.g. Ahmed Al-Ansari"} {...f('name')} />
              <Field label={T.nameAr} placeholder="e.g. أحمد الأنصاري" {...f('nameAr')} />
            </Row>
            <Row>
              <Field label={T.dob} type="date" {...f('dob')} />
              <Field label={T.gender} options={genderOpts} {...f('gender')} />
            </Row>
            <Row>
              <Field label={T.nationality} options={countryOpts} {...f('nationality')} />
              <Field label={T.phone} placeholder="+974 XXXX XXXX" {...f('phone')} />
            </Row>
            <Row>
              <Field label={T.email} type="email" placeholder={ar?"رياضي@qpc.qa":"athlete@qpc.qa"} {...f('email')} />
              <Field label={T.joinDate} type="date" {...f('joinDate')} />
            </Row>

            <Section label={T.sportClass} />
            <Row>
              <Field label={T.sportCategory} options={categoryOpts} {...f('sportCategory')} />
              <Field label={T.sport} options={sportOpts} {...f('sport')} />
            </Row>
            <Row>
              <Field label={T.classification} placeholder={ar?"مثال: T54, S6, BC2":"e.g. T54, S6, BC2"} {...f('classification')} />
            </Row>
            <Row>
              <Field label={T.disability} placeholder={ar?"مثال: إصابة الحبل الشوكي":"e.g. Spinal Cord Injury"} {...f('disability')} />
              <Field label={T.ageCategory} placeholder="e.g. رجال (20+)" {...f('ageCategory')} />
            </Row>
            <Row>
              <Field label={T.coach} options={[{ value:'', label: T.unassigned }, ...(coaches||[]).map(c => ({ value: c.id, label: ar && c.name_ar ? c.name_ar : c.name }))]} {...f('coachId')} />
              <Field label={T.status} options={statusOptsAthlete} {...f('status')} />
            </Row>
            <Row>
              <Field label={T.medicalStatus} placeholder={ar?"مثال: مكتمل":"e.g. Completed"} {...f('medicalStatus')} />
              <Field label={T.careerProfile} placeholder="e.g. 12345" {...f('careerProfile')} />
            </Row>

            <Section label={T.clubRole} />
            <Row>
              <Field label={`${T.club} (النادي)`} placeholder={ar?"مثال: نادي الوكرة":"e.g. Al Wakrah SC"} {...f('club')} />
              <Field label={`${T.designation} (الوظيفة)`} options={athDesigOpts} {...f('designation')} />
            </Row>
            <Row>
              <Field label={`${T.residency} (الصفة)`} options={residencyOpts} {...f('residencyStatus')} />
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


          </>}

          {/* ── COACH ── */}
          {type === 'coach' && <>
            <Section label={T.personalInfo} />
            <Row>
              <Field label={T.nameEn} placeholder={ar?"مثال: كارلوس مينديز":"e.g. Carlos Mendez"} {...f('name')} />
              <Field label={T.nameAr} placeholder="e.g. كارلوس مينديز" {...f('nameAr')} />
            </Row>
            <Row>
              <Field label={T.nationality} options={countryOpts} {...f('nationality')} />
              <Field label={T.gender} options={genderOptsEmpty} {...f('gender')} />
            </Row>
            <Row>
              <Field label={T.phone} placeholder="+974 XXXX XXXX" {...f('phone')} />
              <Field label={T.email} type="email" placeholder={ar?"مدرب@qpc.qa":"coach@qpc.qa"} {...f('email')} />
            </Row>

            <Section label={T.employment} />
            <Row>
              <Field label={T.sportCategory} options={categoryOpts} {...f('sportCategory')} />
              <Field label={T.sport} options={sportOpts} {...f('sport')} />
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
            <Field label={T.eventName} placeholder={ar?"مثال: بطولة قطر المفتوحة":"e.g. Qatar Open Athletics Championships"} {...f('name')} />
            <Row>
              <Field label={T.sport} options={sportOpts} {...f('sport')} />
              <Field label={T.eventType} options={['National','Regional','Invitational']} {...f('type')} />
            </Row>
            <Field label={T.venue} placeholder={ar?"مثال: استاد خليفة الدولي":"e.g. Khalifa International Stadium"} {...f('venue')} />
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
          <button className="btn-cancel" onClick={onClose}>{T.cancel}</button>
          <button className="btn" style={{ background: COLORS[type] }} onClick={() => onSave(form)}>
            {isEdit ? T.save : T.add}
          </button>
        </div>
      </div>
    </div>
  )
}
