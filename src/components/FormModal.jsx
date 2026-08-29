import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import NationalitySelect from './NationalitySelect.jsx'
import DesignationField from './DesignationField.jsx'
import {
  SPORTS, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, SPORT_CATEGORY_NAMES_AR, sportLabel, TARGET_CATEGORY_OPTIONS, targetCategoryLabel,
} from '../lib/helpers'
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

function EventSportSelect({ label, value, onChange, ar, sports }) {
  const selected = Array.isArray(value) ? value : []

  function toggle(sportId) {
    const next = selected.includes(sportId) ? selected.filter(id => id !== sportId) : [...selected, sportId]
    onChange('sports', next)
  }

  function Group({ title, list }) {
    if (list.length === 0) return null
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {list.map(s => {
            const checked = selected.includes(s.id)
            return (
              <button key={s.id} type="button" onClick={() => toggle(s.id)}
                style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
                  border: `1.5px solid ${checked ? '#0085C7' : 'var(--border)'}`,
                  background: checked ? '#0085C7' : 'transparent',
                  color: checked ? '#fff' : 'var(--text2)', fontWeight: checked ? 600 : 400 }}>
                {s.name}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const byCategory = cat => (sports || []).filter(s => s.category === cat)

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {selected.length === 0 && (
        <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>
          {ar ? 'يجب اختيار رياضة واحدة على الأقل' : 'Select at least one sport'}
        </div>
      )}
      <div data-sports-group style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, maxHeight: 260, overflowY: 'auto' }}>
        <Group title={ar ? SPORT_CATEGORY_NAMES_AR['Summer Paralympic'] : 'Summer Paralympic'} list={byCategory('Summer Paralympic')} />
        <Group title={ar ? SPORT_CATEGORY_NAMES_AR['Winter Paralympic'] : 'Winter Paralympic'} list={byCategory('Winter Paralympic')} />
        <Group title={ar ? SPORT_CATEGORY_NAMES_AR['Summer Special Olympics'] : 'Summer Special Olympics'} list={byCategory('Summer Special Olympics')} />
        <Group title={ar ? SPORT_CATEGORY_NAMES_AR['Winter Special Olympics'] : 'Winter Special Olympics'} list={byCategory('Winter Special Olympics')} />
        <Group title={ar ? SPORT_CATEGORY_NAMES_AR['Unified Sports'] : 'Unified Sports'} list={byCategory('Unified Sports')} />
      </div>
    </div>
  )
}

export default function FormModal({ type, record, coaches, athletes, onSave, onClose, eventCategories, sportsList = [], employees = [], customDesignations = [], onDesignationAdded }) {
  const isEdit = !!record
  const { lang } = useLang()
  const ar = lang === 'ar'
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [invalidFields, setInvalidFields] = useState({})
  const [openSections, setOpenSections] = useState({ personal:true, sport:false, club:false, id:false })
  function toggleSection(key) { setOpenSections(s => ({ ...s, [key]: !s[key] })) }
  const modalBodyRef = useRef(null)

  // Multi-sport assignments (athlete_sports) — replaces the legacy single
  // Sport/Coach fields for the athlete form. Each row: { rowId (existing
  // athlete_sports.id, or null for a not-yet-saved row), sportId, coachId }.
  // rowId is how save-time diffing tells inserts/updates/deletes apart.
  const [sportAssignments, setSportAssignments] = useState([])
  const [origSportAssignments, setOrigSportAssignments] = useState([])
  useEffect(() => {
    if (type !== 'athlete' || !record?.id) { setSportAssignments([]); setOrigSportAssignments([]); return }
    let cancelled = false
    supabase.from('athlete_sports').select('id, sport_id, coach_id').eq('athlete_id', record.id).order('id')
      .then(({ data, error }) => {
        if (cancelled || error) return
        const rows = (data || []).map(r => ({ rowId: r.id, sportId: r.sport_id, coachId: r.coach_id }))
        setSportAssignments(rows)
        setOrigSportAssignments(rows)
      })
    return () => { cancelled = true }
  }, [type, record?.id])

  const categoryOpts = SPORT_CATEGORIES.map(c => ({ value: c, label: ar ? (SPORT_CATEGORY_NAMES_AR[c]||c) : c }))
  const sportOpts = (SPORTS_BY_CATEGORY[form?.sportCategory] || SPORTS).map(s => ({
    value: s, label: sportLabel(s, form?.sportCategory, ar)
  }))

  const athDesigOpts = ['','Player','Female Player','Coach','Female Coach','Referee','Female Referee','Admin Staff','Technical Staff','Medical Staff','Board Member','Female Board Member','Member','Female Member','Employee','Female Employee','Expert'].map(s => ({
    value: s,
    label: ar && s ? ({'Player':'لاعب','Female Player':'لاعبة','Coach':'مدرب','Female Coach':'مدربة','Referee':'حكم','Female Referee':'حكمة','Admin Staff':'جهاز إداري','Technical Staff':'جهاز في','Medical Staff':'جهاز طبي','Board Member':'عضو مجلس إدارة','Female Board Member':'عضوة مجلس إدارة','Member':'عضو','Female Member':'عضوة','Employee':'عضو كادر','Female Employee':'عضوة كادر','Expert':'خبير في'}[s]||s) : s
  }))

  const residencyOpts = ['','Qatari Male','Qatari Female','Resident Male','Resident Female','Professional Male','Professional Female','Born in Qatar','Qatari Mother'].map(s => ({
    value: s,
    label: ar && s ? ({'Qatari Male':'قطري','Qatari Female':'قطرية','Resident Male':'مقيم','Resident Female':'مقيمة','Professional Male':'محترف','Professional Female':'محترفة','Born in Qatar':'مواليد قطر','Qatari Mother':'أم قطرية'}[s]||s) : s
  }))

  // الفئات المستهدفة — canonical stored values are the Arabic strings for
  // every option; English UI shows an English label where one exists
  // (currently just the two newest options), and falls back to the
  // Arabic text otherwise, unchanged from before.
  const targetCategoryOpts = ['', ...TARGET_CATEGORY_OPTIONS].map(s => ({ value: s, label: s ? targetCategoryLabel(s, ar ? 'ar' : 'en') : '' }))

  useEffect(() => {
    if (record) { setForm({ ...record }) }
    else {
      const defaults = {
        // Athletes no longer have a scalar Sport/Sport Category field in
        // this form at all — only the "Assigned Sports" multi-sport
        // editor (sportAssignments state) below, which is the sole
        // source of truth via athlete_sports. Defaulting sport/
        // sportCategory here was a leftover from before that editor
        // existed: since nothing in the athlete UI ever changes them,
        // every new athlete silently got this exact stale value written
        // to athletes.sport/sport_category regardless of what was
        // actually picked in Assigned Sports.
        athlete: { gender: 'Male', nationality: 'Qatari', status: 'Active' },
        coach:   { sportCategory: 'Summer Paralympic', sport: SPORTS[0], status: 'Active' },
        event:   { status: 'Planning', approvalStatus: 'TBC', sports: [] },
        result:  { medal: 'gold', position: 1 },
      }
      setForm(defaults[type] || {})
    }
  }, [record, type])

  useEffect(() => {
    if (type !== 'event') return
    const s = computeEventStatus(form.startDate, form.endDate, form.deadline)
    setForm(f => ({ ...f, status: s }))
  }, [form.startDate, form.endDate, form.deadline, type])

  const set = (name, value) => setForm(f => ({ ...f, [name]: value }))
  const f = (name) => ({ name, value: form[name], onChange: set })

  const T = {
    personalInfo:   ar ? 'المعلومات الشخصية'    : 'Personal Information',
    sportClass:     ar ? 'الرياضة والتصنيف'     : 'Sport & Classification',
    clubRole:       ar ? 'النادي والدور'         : 'Club & Role',
    passportID:     ar ? 'الجواز والهوية'        : 'Passport & ID',
    employment:     ar ? 'التوظيف'               : 'Employment',
    eventDetails:   ar ? 'تفاصيل الفعالية'       : 'Event Details',
    resultInfo:     ar ? 'معلومات النتيجة'       : 'Result Information',
    nameEn:         ar ? 'الاسم الكامل (إنجليزي)': 'Full name (English)',
    nameAr:         ar ? 'الاسم الكامل (عربي)'   : 'Full name (Arabic)',
    dob:            ar ? 'تاريخ الميلاد'         : 'Date of birth',
    gender:         ar ? 'الجنس'                 : 'Gender',
    nationality:    ar ? 'الجنسية'               : 'Nationality',
    phone:          ar ? 'الهاتف'                : 'Phone',
    email:          ar ? 'البريد الإلكتروني'     : 'Email',
    joinDate:       ar ? 'تاريخ الانضمام'        : 'Join date',
    sportCategory:  ar ? 'فئة الرياضة'           : 'Sport Category',
    sport:          ar ? 'الرياضة'               : 'Sport',
    eventSports:    ar ? 'الرياضات'              : 'Sports',
    classification: ar ? 'التصنيف'               : 'Classification',
    disability:     ar ? 'نوع الإعاقة'           : 'Disability type',
    coach:          ar ? 'المدرب'                : 'Coach',
    status:         ar ? 'الحالة'                : 'Status',
    medicalStatus:  ar ? 'الحالة الطبية'         : 'Medical status',
    careerProfile:  ar ? 'رقم المسار'            : 'Career profile #',
    club:           ar ? 'النادي'                : 'Club',
    designation:    ar ? 'الوظيفة'               : 'Designation',
    residency:      ar ? 'الصفة'                 : 'Residency status',
    qss:            ar ? 'رقم QSS'               : 'QSS number',
    passportNum:    ar ? 'رقم الجواز'            : 'Passport number',
    passportExp:    ar ? 'تاريخ انتهاء الجواز'   : 'Passport expiry',
    idNum:          ar ? 'الرقم الشخصي'          : 'Qatar ID number',
    idExp:          ar ? 'تاريخ انتهاء الهوية'   : 'ID expiry',
    idResNum:       ar ? 'الرقم الشخصي'  : 'Qatar ID Number',
    empNum:         ar ? 'رقم الكادر'            : 'Staff Number',
    since:          ar ? 'تاريخ الانضمام إلى QPC': 'Start date with QPC',
    eventName:      ar ? 'اسم الفعالية'          : 'Event name',
    eventNameAr:    ar ? 'اسم الفعالية (عربي)'   : 'Arabic name',
    category:       ar ? 'التصنيف'               : 'Category',
    approvalStatus: ar ? 'حالة الموافقة'         : 'Approval status',
    venue:          ar ? 'المكان'                : 'Venue / place',
    startDate:      ar ? 'تاريخ البداية'         : 'Start date',
    endDate:        ar ? 'تاريخ النهاية'         : 'End date',
    deadline:       ar ? 'الموعد النهائي'        : 'Deadline',
    notes:          ar ? 'ملاحظات'               : 'Notes',
    athlete:        ar ? 'الرياضي'               : 'Athlete',
    medal:          ar ? 'الميدالية'             : 'Medal',
    compName:       ar ? 'اسم المنافسة'          : 'Competition name',
    discipline:     ar ? 'التخصص'               : 'Discipline / event',
    result:         ar ? 'النتيجة'               : 'Result / score',
    position:       ar ? 'الترتيب'              : 'Position',
    date:           ar ? 'التاريخ'              : 'Date',
    unassigned:     ar ? 'غير معين'             : 'Unassigned',
    save:           ar ? 'حفظ التغييرات'        : 'Save changes',
    add:            ar ? 'إضافة'                : 'Add record',
    cancel:         ar ? 'إلغاء'               : 'Cancel',
    male:           ar ? 'ذكر'                 : 'Male',
    female:         ar ? 'أنثى'               : 'Female',
  }

  const typeLabel = { athlete: ar?'رياضي':'Athlete', coach: ar?'مدرب':'Coach', event: ar?'فعالية':'Event', result: ar?'نتيجة':'Result' }
  const genderOpts      = [{ value:'Male', label: T.male }, { value:'Female', label: T.female }]
  const genderOptsEmpty = [{ value:'', label:'' }, ...genderOpts]
  const DATE_STATUSES   = ['On Leave','In Competition','In Training Camp']

  const statusOptsAthlete = ['','Active','On Leave','In Competition','In Training Camp','Inactive','Injured','Under Medical Review','Suspended','Retired'].map(s => ({
    value: s, label: s===''?'': ar?({'Active':'نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Inactive':'غير نشط','Injured':'مصاب','Under Medical Review':'تحت المراجعة الطبية','Suspended':'موقوف','Retired':'متقاعد'}[s]||s):s
  }))
  const statusOptsCoach = ['Active','On Leave','In Competition','In Training Camp','When needed','External','Inactive','Retired'].map(s => ({
    value: s, label: ar?({'Active':'نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','When needed':'عند الحاجة','External':'خارجي','Inactive':'غير نشط','Retired':'متقاعد'}[s]||s):s
  }))
  const statusOptsEvent = ['Planning','Upcoming','In Progress','Completed','Canceled'].map(s => ({
    value: s, label: ar?({'Planning':'قيد التخطيط','Upcoming':'قادم','In Progress':'جارٍ','Completed':'مكتمل','Canceled':'ملغى'}[s]||s):s
  }))
  const approvalOpts = ['TBC','Approved','Rejected'].map(s => ({
    value: s, label: ar?({'TBC':'تحت المراجعة','Approved':'معتمد','Rejected':'مرفوض'}[s]||s):s
  }))
  const eventCatOpts = [
    { value: '', label: ar ? '— اختر تصنيفاً —' : '— Select category —' },
    ...(eventCategories||[]).filter(c=>c.is_active).map(c => ({ value: String(c.id), label: ar&&c.name_ar?c.name_ar:c.name })),
  ]
  const medalOpts = ['gold','silver','bronze'].map(s => ({ value:s, label: ar?{'gold':'ذهب','silver':'فضة','bronze':'برونز'}[s]:s }))

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target===e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">{isEdit?(ar?'تعديل':'Edit'):(ar?'إضافة':'New')} {typeLabel[type]}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div className="modal-body" ref={modalBodyRef} style={{ paddingBottom:24 }}>

          {/* ── ATHLETE ── */}
          {type==='athlete' && <>
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
                  <NationalitySelect value={form.nationality} onChange={v => set('nationality',v)} lang={lang} />
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
              {/* Multi-sport assignment editor — athlete_sports is the sole
                  source of truth. Each row: Sport (from the sports catalog
                  table) + Coach. Sport Category is shown read-only, derived
                  from the selected sport — never a separate input. */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>{ar ? 'الرياضات المعينة' : 'Assigned Sports'}</label>
                {sportAssignments.length === 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '8px 0' }}>{ar ? 'لم يتم تعيين أي رياضة بعد' : 'No sports assigned yet'}</div>
                )}
                {sportAssignments.map((row, i) => {
                  const sport = sportsList.find(s => s.id === row.sportId)
                  const usedSportIds = new Set(sportAssignments.filter((_, j) => j !== i).map(r => r.sportId))
                  const availableSports = sportsList.filter(s => s.id === row.sportId || !usedSportIds.has(s.id))
                  const coachesForSport = sport ? (coaches||[]).filter(c => !c.sport || c.sport === sport.name || `Para ${c.sport}` === sport.name || `SO ${c.sport}` === sport.name || `Unified ${c.sport}` === sport.name) : (coaches||[])
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <select className="form-input" style={{ flex: 1 }} value={row.sportId || ''}
                        onChange={e => setSportAssignments(rows => rows.map((r, j) => j === i ? { ...r, sportId: Number(e.target.value) || null, coachId: null } : r))}>
                        <option value="">{ar ? '— اختر الرياضة —' : '— Select sport —'}</option>
                        {availableSports.map(s => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
                      </select>
                      <select className="form-input" style={{ flex: 1 }} value={row.coachId || ''} disabled={!row.sportId}
                        onChange={e => setSportAssignments(rows => rows.map((r, j) => j === i ? { ...r, coachId: Number(e.target.value) || null } : r))}>
                        <option value="">{ar ? '— بدون مدرب —' : '— No coach —'}</option>
                        {coachesForSport.map(c => <option key={c.id} value={c.id}>{ar && c.name_ar ? c.name_ar : c.name}</option>)}
                      </select>
                      <div style={{ fontSize: 11, color: 'var(--text3)', width: 90, flexShrink: 0 }}>{sport?.category || ''}</div>
                      <button type="button" onClick={() => setSportAssignments(rows => rows.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', flexShrink: 0 }}>
                        <i className="ti ti-trash" />
                      </button>
                    </div>
                  )
                })}
                <button type="button" onClick={() => setSportAssignments(rows => [...rows, { rowId: null, sportId: null, coachId: null }])}
                  style={{ fontSize: 12.5, color: '#0085C7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <i className="ti ti-plus" /> {ar ? 'إضافة رياضة' : 'Add sport'}
                </button>
              </div>
              <Row>
                <Field label={T.classification} placeholder={ar?"مثال: T54, S6, BC2":"e.g. T54, S6, BC2"} {...f('classification')} />
              </Row>
              <Row>
                <Field label={T.disability} placeholder={ar?"مثال: إصابة الحبل الشوكي":"e.g. Spinal Cord Injury"} {...f('disability')} />
                <div className="form-group">
                  <label className="form-label">{ar?'الإعاقة الإحصائية':'Statistics Disability'}</label>
                  <select className="form-input" value={form.statistics_disability||''} onChange={e=>setForm(p=>({...p,statistics_disability:e.target.value||null}))}>
                    <option value="">{ar?'— اختر —':'— Select —'}</option>
                    {[['Physical Disability','الإعاقات الجسدية / الحركية'],['Intellectual Disability','الإعاقة الذهنية'],['Visual Disability','الإعاقة البصرية'],['Hearing Disability','الإعاقة السمعية'],['Speech & Language Disorders','اضطرابات النطق واللغة'],['Psychosocial Disability','الإعاقة النفسية والاجتماعية'],['Multiple Disability','الإعاقات المتعددة'],['Developmental Disability','الإعاقات النمائية'],['Down Syndrome','متلازمة داون'],['Autism','اضطراب التوحد']].map(([en,arL])=>(
                      <option key={en} value={en}>{ar?arL:en}</option>
                    ))}
                  </select>
                </div>
              </Row>
              <div style={{ fontSize:11.5, color:'var(--text3)', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 10px', margin:'2px 0 14px', display:'flex', gap:14, flexWrap:'wrap' }}>
                <span>{ar?'الفئة العمرية: تُحسب تلقائياً':'Age category: auto-computed'}</span>
                <span>{ar?'الفئة العمرية الرياضية: تُحسب تلقائياً':'Sport age category: auto-computed'}</span>
              </div>
              <Row>
                <Field label={T.status} required invalid={invalidFields.status} options={statusOptsAthlete} {...f('status')} onChange={(name,v)=>{ set(name,v); if(!DATE_STATUSES.includes(v)){set('statusStart',null);set('statusEnd',null)} }} />
                {DATE_STATUSES.includes(form.status) && <div className="form-group"><label className="form-label">{ar?'تاريخ البداية':'Start date'}</label><input type="date" className="form-input" value={form.statusStart||''} onChange={e=>setForm(p=>({...p,statusStart:e.target.value||null}))} /></div>}
                {DATE_STATUSES.includes(form.status) && <div className="form-group"><label className="form-label">{ar?'تاريخ الرجوع':'Return date'}</label><input type="date" className="form-input" value={form.statusEnd||''} onChange={e=>setForm(p=>({...p,statusEnd:e.target.value||null}))} /></div>}
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
              <Row>
                <Field label="الفئات المستهدفة" options={targetCategoryOpts} {...f('targetCategory')} />
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
          {type==='coach' && <>
            <Section label={T.personalInfo} />
            <Row>
              <Field label={T.nameEn} placeholder={ar?"مثال: كارلوس مينديز":"e.g. Carlos Mendez"} {...f('name')} />
              <Field label={T.nameAr} placeholder="e.g. كارلوس مينديز" {...f('nameAr')} />
            </Row>
            <Row>
              <div className="form-group"><label className="form-label">{T.nationality}</label><NationalitySelect value={form.nationality} onChange={v=>set('nationality',v)} lang={lang} /></div>
              <Field label={T.gender} options={genderOptsEmpty} {...f('gender')} />
            </Row>
            <Row>
              <Field label={T.phone} placeholder="+974 XXXX XXXX" {...f('phone')} />
              <Field label={T.email} type="email" placeholder={ar?"مدرب@qpc.qa":"coach@qpc.qa"} {...f('email')} />
            </Row>
            <Section label={T.employment} />
            <Row>
              <div className="form-group">
                <label className="form-label">{ar?'المسمى الوظيفي':'Designation'}</label>
                <DesignationField
                  employees={employees}
                  customDesignations={customDesignations}
                  onDesignationAdded={onDesignationAdded}
                  value={form.designation}
                  valueAr={form.designationAr}
                  onSelect={(label, labelAr) => setForm(p => ({ ...p, designation: label, designationAr: labelAr || p.designationAr }))}
                  ar={ar}
                />
              </div>
            </Row>
            <Row>
              <Field label={T.sportCategory} options={categoryOpts} {...f('sportCategory')}
                onChange={(name,v)=>{ const vs=SPORTS_BY_CATEGORY[v]||SPORTS; setForm(p=>({...p,sportCategory:v,sport:vs.includes(p.sport)?p.sport:(vs[0]||'')})) }} />
              <Field label={T.sport} options={sportOpts} {...f('sport')} />
            </Row>
            <Row>
              <Field label={T.empNum} placeholder="e.g. 12501" {...f('employeeNumber')} />
              <Field label={T.qss} placeholder="e.g. 50112" {...f('qssNumber')} />
            </Row>
            <Row>
              <Field label={T.since} type="date" {...f('since')} />
              <Field label={T.status} options={statusOptsCoach} {...f('status')} onChange={(name,v)=>{ set(name,v); if(!DATE_STATUSES.includes(v)){set('statusStart',null);set('statusEnd',null)} }} />
              {DATE_STATUSES.includes(form.status) && <div className="form-group"><label className="form-label">{ar?'تاريخ البداية':'Start date'}</label><input type="date" className="form-input" value={form.statusStart||''} onChange={e=>setForm(p=>({...p,statusStart:e.target.value||null}))} /></div>}
              {DATE_STATUSES.includes(form.status) && <div className="form-group"><label className="form-label">{ar?'تاريخ الرجوع':'Return date'}</label><input type="date" className="form-input" value={form.statusEnd||''} onChange={e=>setForm(p=>({...p,statusEnd:e.target.value||null}))} /></div>}
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
          {type==='event' && <>
            <Section label={T.eventDetails} />
            <Row>
              <Field label={T.eventName} placeholder={ar?"مثال: بطولة قطر المفتوحة":"e.g. Qatar Open Athletics Championships"} {...f('name')} />
              <Field label={T.eventNameAr} placeholder="e.g. بطولة قطر المفتوحة" {...f('nameAr')} />
            </Row>
            <Row>
              <Field label={T.category} options={eventCatOpts} {...f('categoryId')} />
              <Field label={T.approvalStatus} options={approvalOpts} {...f('approvalStatus')} />
            </Row>
            <EventSportSelect label={T.eventSports} value={form.sports} onChange={set} ar={ar} sports={sportsList} />
            <Field label={T.venue} placeholder={ar?"مثال: استاد خليفة الدولي":"e.g. Khalifa International Stadium"} {...f('venue')} />
            <Row>
              <Field label={T.startDate} type="date" {...f('startDate')} />
              <Field label={T.endDate} type="date" {...f('endDate')} />
            </Row>
            <Row>
              <Field label={T.deadline} type="date" {...f('deadline')} />
              <Field label={T.status} options={statusOptsEvent} {...f('status')} />
            </Row>
            <div className="form-group">
              <label className="form-label">{T.notes}</label>
              <textarea className="form-input" rows={3} placeholder={ar?'ملاحظات إضافية…':'Additional notes…'} value={form.notes??''} onChange={e=>set('notes',e.target.value)} style={{ resize:'vertical', minHeight:72 }} />
            </div>
          </>}

          {/* ── RESULT ── */}
          {type==='result' && <>
            <Section label={T.resultInfo} />
            <Row>
              <Field label={T.athlete} options={(athletes||[]).map(a=>({value:a.name,label:ar&&a.name_ar?a.name_ar:a.name}))} {...f('athleteName')} />
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
          <button className="btn" style={{ background:COLORS[type], opacity:saving?.7:1, cursor:saving?'default':'pointer', display:'flex', alignItems:'center', gap:6 }}
            disabled={saving}
            onClick={async () => {
              if (saving) return
              if (type==='athlete') {
                const req = { name:form.name, gender:form.gender, nationality:form.nationality, status:form.status }
                const bad = {}
                for (const [k,v] of Object.entries(req)) { if (!v||!String(v).trim()) bad[k]=true }
                setInvalidFields(bad)
                const firstBad = Object.keys(bad)[0]
                if (firstBad) {
                  const el = modalBodyRef.current?.querySelector(`[data-field="${firstBad}"]`)
                  if (el) {
                    if (['name','gender','nationality'].includes(firstBad)) setOpenSections(s=>({...s,personal:true}))
                    if (['status'].includes(firstBad)) setOpenSections(s=>({...s,sport:true}))
                    setTimeout(()=>{ el.scrollIntoView({behavior:'smooth',block:'center'}); el.querySelector('input,select')?.focus() },50)
                  }
                  return
                }
              }
              if (type==='event') {
                if (!form.sports || form.sports.length === 0) {
                  const el = modalBodyRef.current?.querySelector('[data-sports-group]')
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  return
                }
              }
              setSaving(true)
              try {
                if (type === 'athlete') {
                  const origById = new Map(origSportAssignments.filter(r => r.rowId).map(r => [r.rowId, r]))
                  const currentIds = new Set(sportAssignments.filter(r => r.rowId).map(r => r.rowId))
                  const toInsert = sportAssignments.filter(r => !r.rowId && r.sportId)
                  const toUpdate = sportAssignments.filter(r => r.rowId && r.sportId && origById.get(r.rowId)?.coachId !== r.coachId)
                  const toDelete = [...origById.keys()].filter(id => !currentIds.has(id))
                  await onSave(form, { insert: toInsert, update: toUpdate, delete: toDelete })
                } else {
                  await onSave(form)
                }
              } finally { setSaving(false) }
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
