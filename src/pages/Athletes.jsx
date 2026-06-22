
import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Avatar, MedalDisplay, Badge, avColor, initials, DashRow, SPORTS, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, SPORT_CATEGORY_NAMES_AR, SPORT_NAMES_AR } from '../lib/helpers'
import FormModal from '../components/FormModal'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'
import CareerHistory from '../components/CareerHistory.jsx'
import { useLang } from '../lib/LangContext.jsx'
import AthleteCardButton from '../components/AthleteCard'

const DOC_TYPES  = [
  'Photo',
  'Original Passport',
  'Mission Passport',
  'Qatar ID',
  'Medical Certificate',
  'QSS Registration',
  'Medical Report',
  'Birth Certificate',
  'QSRSN Membership',
  'Health Card',
  'MDF',
  'IPC Athlete Eligibility Agreement',
  'SDMS License',
  'Other',
]
const DOC_TYPES_AR = {
  'Photo':'صورة', 'Original Passport':'الجواز الأصلي', 'Mission Passport':'جواز المهمة',
  'Qatar ID':'الرقم الشخصي',
  'Medical Certificate':'شهادة طبية', 'QSS Registration':'تسجيل QSS',
  'Medical Report':'تقرير طبي',
  'Birth Certificate':'شهادة ميلاد', 'QSRSN Membership':'عضوية QSRSN',
  'Health Card':'بطاقة صحية', 'MDF':'MDF',
  'IPC Athlete Eligibility Agreement':'اتفاقية أهلية IPC',
  'SDMS License':'رخصة SDMS', 'Other':'أخرى',
}

const DOC_ICONS  = {
  'Photo':                          'ti-photo',
  'Original Passport':              'ti-id',
  'Mission Passport':               'ti-id',
  'Qatar ID':                       'ti-id-badge',
  'Medical Certificate':            'ti-heart-rate-monitor',
  'QSS Registration':               'ti-clipboard-list',
  'Medical Report':                 'ti-stethoscope',
  'Birth Certificate':              'ti-certificate',
  'QSRSN Membership':               'ti-users',
  'Health Card':                    'ti-heart',
  'MDF':                            'ti-file-description',
  'IPC Athlete Eligibility Agreement': 'ti-file-check',
  'SDMS License':                   'ti-license',
  'Other':                          'ti-file',
}
const DOC_COLORS = {
  'Photo':                          '#0085C7',
  'Original Passport':              '#0085C7',
  'Mission Passport':               '#e67e22',
  'Qatar ID':                       '#009F6B',
  'Medical Certificate':            '#EE334E',
  'QSS Registration':               '#8b5cf6',
  'Medical Report':                 '#EE334E',
  'Birth Certificate':              '#e67e22',
  'QSRSN Membership':               '#8b5cf6',
  'Health Card':                    '#EE334E',
  'MDF':                            '#16a085',
  'IPC Athlete Eligibility Agreement': '#0085C7',
  'SDMS License':                   '#e67e22',
  'Other':                          '#9aa3b2',
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/(1024*1024)).toFixed(1)} MB`
}

function exportExcel(athletes, coaches, documents, visibleCols, allCols, lang) {
  const ar = lang === 'ar'
  const SPORT_AR = SPORT_NAMES_AR
  const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','Suspended':'موقوف','Under Medical Review':'تحت المراجعة الطبية','Injured':'مصاب','Retired':'متقاعد'}
  const DIS_MAP = {'visual impairment':'إعاقة بصرية','hearing impairment':'إعاقة سمعية','physical impairment':'إعاقة جسدية','intellectual disability':'إعاقة ذهنية','intellectual impairment':'إعاقة ذهنية','spinal cord injury':'إصابة الحبل الشوكي','cerebral palsy':'شلل دماغي','amputation':'بتر','down syndrome':'متلازمة داون',"down's syndrome":'متلازمة داون','downs syndrome':'متلازمة داون','down':'متلازمة داون','autism spectrum':'التوحد','autism':'التوحد','multiple disabilities':'إعاقات متعددة','limb deficiency':'نقص الأطراف','les autres':'أخرى'}
  const tDis = d => {
    if (!d || !ar) return d||''
    const key = d.toLowerCase().trim()
    if (DIS_MAP[key]) return DIS_MAP[key]
    for (const [k,v] of Object.entries(DIS_MAP)) {
      if (key.includes(k) || k.includes(key)) return v
    }
    return d
  }
  const COUNTRY_MAP = {'qatar':'قطر','egypt':'مصر','algeria':'الجزائر','morocco':'المغرب','jordan':'الأردن','saudi arabia':'المملكة العربية السعودية','uae':'الإمارات','kuwait':'الكويت','bahrain':'البحرين','oman':'عُمان','iraq':'العراق','syria':'سوريا','lebanon':'لبنان','palestine':'فلسطين','yemen':'اليمن','somalia':'الصومال','sudan':'السودان','libya':'ليبيا','tunisia':'تونس','pakistan':'باكستان','india':'الهند','iran':'إيران','turkey':'تركيا','ireland':'أيرلندا','france':'فرنسا','spain':'إسبانيا','germany':'ألمانيا','uk':'المملكة المتحدة','usa':'الولايات المتحدة','ksa':'المملكة العربية السعودية'}
  const tc = n => n ? (ar ? (COUNTRY_MAP[n.toLowerCase().trim()]||n) : n) : ''

  const L = (en, a) => ar ? a : en

  const colMap = {
    name:            a => ar && a.name_ar ? a.name_ar : a.name,
    name_ar:         a => a.name_ar || '',
    qss_number:      a => a.qss_number || '',
    id_number:       a => a.id_number || '',
    career_profile:  a => a.career_profile || '',
    sport_category:  a => a.sport_category ? (ar ? (SPORT_CATEGORY_NAMES_AR[a.sport_category]||a.sport_category) : a.sport_category) : '',
    sport:           a => ar ? (SPORT_AR[a.sport]||a.sport||'') : (a.sport||''),
    classification:  a => a.classification || '',
    disability:      a => tDis(a.disability),
    nationality:     a => tc(a.nationality),
    gender:          a => a.gender ? (ar ? (a.gender==='Male'?'ذكر':'أنثى') : a.gender) : '',
    dob:             a => a.dob || '',
    age_category:    a => a.age_category || '',
    coach_id:        a => { const c = coaches.find(c => c.id === a.coach_id); return c ? (ar && c.name_ar ? c.name_ar : c.name) : '' },
    status:          a => ar ? (STATUS_AR[a.status]||a.status||'') : (a.status||''),
    medical_status:  a => a.medical_status || '',
    phone:           a => a.phone || '',
    email:           a => a.email || '',
    join_date:       a => a.join_date || '',
    passport_number: a => a.passport_number || '',
    passport_expiry: a => a.passport_expiry || '',
    id_expiry:       a => a.id_expiry || '',
    blood_type:      a => a.blood_type || '',
    emergency_contact_name:  a => a.emergency_contact_name || '',
    emergency_contact_phone: a => a.emergency_contact_phone || '',
    medals:          a => ar ? `ذهب:${a.medals_gold||0} فضة:${a.medals_silver||0} برونز:${a.medals_bronze||0}` : `Gold:${a.medals_gold||0} Silver:${a.medals_silver||0} Bronze:${a.medals_bronze||0}`,
    docs:            a => documents.filter(d => d.athlete_id === a.id).length,
  }

  const visibleDefs = allCols.filter(c => visibleCols.includes(c.key))
  const rows = athletes.map(a => {
    const row = {}
    visibleDefs.forEach(col => { row[col.label] = colMap[col.key]?.(a) ?? '' })
    row[L('Age','العمر')] = a.dob ? calcAge(a.dob) : ''
    row[L('Years with QPC','سنوات مع QPC')] = a.join_date ? calcYearsActive(a.join_date) : ''
    return row
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  ws['!cols'] = visibleDefs.map(() => ({ wch: 20 }))
  XLSX.utils.book_append_sheet(wb, ws, ar ? 'الرياضيون' : 'Athletes')
  const date = new Date().toISOString().slice(0,10)
  XLSX.writeFile(wb, `QPC_${ar?'الرياضيون':'Athletes'}_${date}.xlsx`)
}

async function downloadDoc(url, athleteName, docType, originalName) {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    const ext  = originalName.split('.').pop()
    const filename = `${athleteName.replace(/\s+/g,'_')}_${docType.replace(/\s+/g,'_')}.${ext}`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  } catch (e) {
    window.open(url, '_blank')
  }
}

function calcAge(dob) {
  if (!dob) return null
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function calcYearsActive(joinDate) {
  if (!joinDate) return null
  const today = new Date()
  const joined = new Date(joinDate)
  const years = today.getFullYear() - joined.getFullYear()
  const months = today.getMonth() - joined.getMonth()
  const totalMonths = years * 12 + months
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y}y ${m}mo` : `${y} year${y !== 1 ? 's' : ''}`
}

function getPersonalBests(results) {
  const bests = {}
  results.forEach(r => {
    if (!r.discipline || !r.result) return
    if (!bests[r.discipline]) {
      bests[r.discipline] = r
    } else {
      // keep the one with better position, or gold over silver etc
      const medalRank = { gold: 1, silver: 2, bronze: 3, null: 4 }
      const cur = medalRank[bests[r.discipline].medal] || 4
      const next = medalRank[r.medal] || 4
      if (next < cur) bests[r.discipline] = r
    }
  })
  return Object.values(bests)
}


function AthleteCoachHistory({ athleteId, coaches, employees, lang }) {
  const [history, setHistory] = useState([])
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  useEffect(() => {
    if (!athleteId) return
    supabase.from('athlete_coach_history')
      .select('*')
      .eq('athlete_id', String(athleteId))
      .eq('is_current', false)
      .order('start_date', { ascending: false })
      .then(({ data }) => setHistory(data || []))
  }, [athleteId])

  if (!history.length) return null

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        {L('Previous coaches', 'المدربون السابقون')}
      </div>
      {history.map(h => {
        // Look in both coaches and employees
        const pc = [...(coaches||[]), ...(employees||[])].find(c => String(c.id) === String(h.coach_id))
        if (!pc) return null
        return (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
            <span style={{ fontWeight: 500 }}>{ar && pc.name_ar ? pc.name_ar : pc.name}</span>
            {(h.start_date || h.end_date) && (
              <span style={{ color: 'var(--text3)' }}>
                {h.start_date ? h.start_date.slice(0,7) : ''}{h.end_date ? ' → ' + h.end_date.slice(0,7) : ''}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Athletes({ athletes, coaches, employees, results, documents, events, registrations, onRefresh, onNav, initAthleteId, initStatusFilter, navState, profile }) {
  const { tx, lang, tc } = useLang()
  const SPORT_NAMES = lang === 'ar' ? SPORT_NAMES_AR : {}
  // Case-insensitive disability translation
  const DIS_MAP = {
    'visual impairment':'إعاقة بصرية', 'visual':'إعاقة بصرية',
    'hearing impairment':'إعاقة سمعية', 'hearing':'إعاقة سمعية',
    'physical impairment':'إعاقة جسدية', 'physical':'إعاقة جسدية',
    'intellectual disability':'إعاقة ذهنية', 'intellectual impairment':'إعاقة ذهنية',
    'intellectual':'إعاقة ذهنية',
    'spinal cord injury':'إصابة الحبل الشوكي', 'spinal cord':'إصابة الحبل الشوكي',
    'cerebral palsy':'شلل دماغي', 'cerebral':'شلل دماغي',
    'amputation':'بتر',
    'limb deficiency':'نقص الأطراف', 'limb':'نقص الأطراف',
    'les autres':'أخرى', 'other':'أخرى',
    'down syndrome':'متلازمة داون', "down's syndrome":'متلازمة داون',
    'downs syndrome':'متلازمة داون', 'down':'متلازمة داون',
    'autism spectrum disorder':'التوحد', 'autism spectrum':'التوحد', 'autism':'التوحد',
    'multiple disabilities':'إعاقات متعددة', 'multiple':'إعاقات متعددة',
  }
  const tDis = (d) => {
    if (!d || lang==='en') return d
    const key = d.toLowerCase().trim()
    if (DIS_MAP[key]) return DIS_MAP[key]
    // partial match
    for (const [k, v] of Object.entries(DIS_MAP)) {
      if (key.includes(k) || k.includes(key)) return v
    }
    return d
  }

  const [search, setSearch]         = useState('')
  const [sport, setSport]           = useState('All sports')
  const [sportCategory, setSportCategory] = useState('All categories')
  const [status, setStatus]         = useState('All statuses')
  const [gender, setGender]         = useState('All genders')
  const [sort, setSort]             = useState('name-asc')
  const [selected, setSelected]     = useState(initAthleteId ?? null)
  const [form, setForm]             = useState(null)
  const [confirm, setConfirm]       = useState(null)
  const [medalModal, setMedalModal] = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [docUploading, setDocUploading] = useState(false)
  const [docType, setDocType]       = useState('Original Passport')
  const [docDropOpen, setDocDropOpen] = useState(false)
  const [docConfirm, setDocConfirm] = useState(null)
  const [notes, setNotes]           = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesChanged, setNotesChanged] = useState(false)
  const [editMode, setEditMode]     = useState(false)
  const [edits, setEdits]           = useState({})
  const [savingAll, setSavingAll]   = useState(false)
  const [visibleCols, setVisibleCols] = useState(['name','sport_category','sport','classification','nationality','coach_id','status','medals','docs'])
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const [colFilters, setColFilters] = useState({})
  const photoInput = useRef(null)
  const docInput   = useRef(null)

  useEffect(() => {
    if (initAthleteId != null) setSelected(initAthleteId)
    if (initStatusFilter)      setStatus(initStatusFilter)
  }, [initAthleteId, initStatusFilter])

  // reset everything when nav clicked while already on athletes page
  useEffect(() => {
    if (navState?.reset) {
      setSelected(null)
      setSearch('')
      setSport('All sports')
      setSportCategory('All categories')
      setStatus('All statuses')
      setGender('All genders')
      setSort('name-asc')
      setColFilters({})
    }
  }, [navState])

  // Close doc dropdown on outside click
  useEffect(() => {
    if (!docDropOpen) return
    const close = () => setDocDropOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [docDropOpen])

  // sync notes when selected athlete changes
  useEffect(() => {
    if (selected) {
      const a = athletes.find(x => String(x.id) === String(selected))
      setNotes(a?.notes || '')
      setNotesChanged(false)
    }
  }, [selected, athletes])

  function resetFilters() {
    setSearch('')
    setSport('All sports')
    setSportCategory('All categories')
    setStatus('All statuses')
    setGender('All genders')
    setSort('name-asc')
    setColFilters({})
  }

  const hasActiveFilters = search || sport !== 'All sports' || sportCategory !== 'All categories' || status !== 'All statuses' || gender !== 'All genders' || sort !== 'name-asc' || Object.values(colFilters).some(v => v && v !== 'All')

  // Show every known sport (Paralympic + Special Olympics), not just ones currently
  // in use — so a sport with zero athletes today is still findable once someone new
  // is added under it.
  const sportsInData = new Set(athletes.map(a => a.sport).filter(Boolean))
  const sports = ['All sports', ...SPORTS, ...[...sportsInData].filter(s => !SPORTS.includes(s))]
  const sportCategories = ['All categories', ...SPORT_CATEGORIES]

  let list = athletes.filter(a =>
    (sport  === 'All sports'   || a.sport  === sport)  &&
    (sportCategory === 'All categories' || a.sport_category === sportCategory) &&
    (status === 'All statuses' || a.status === status) &&
    (gender === 'All genders'  || a.gender === gender) &&
    a.name && // exclude blank names
    (a.name.toLowerCase().includes(search.toLowerCase()) || (a.sport||'').toLowerCase().includes(search.toLowerCase())) &&
    // column-level filters
    (!colFilters.sport_category || colFilters.sport_category === 'All' || a.sport_category === colFilters.sport_category) &&
    (!colFilters.sport        || colFilters.sport === 'All'        || a.sport === colFilters.sport) &&
    (!colFilters.status       || colFilters.status === 'All'       || a.status === colFilters.status) &&
    (!colFilters.gender       || colFilters.gender === 'All'       || a.gender === colFilters.gender) &&
    (!colFilters.nationality  || colFilters.nationality === 'All'  || a.nationality === colFilters.nationality) &&
    (!colFilters.disability   || colFilters.disability === 'All'   || a.disability === colFilters.disability) &&
    (!colFilters.age_category || colFilters.age_category === 'All' || a.age_category === colFilters.age_category) &&
    (!colFilters.medical_status || colFilters.medical_status === 'All' || (colFilters.medical_status === 'None' ? !a.medical_status || a.medical_status === 'None' : a.medical_status === colFilters.medical_status)) &&
    (!colFilters.coachName    || colFilters.coachName === 'All'    || coaches.find(c => c.id === a.coach_id)?.name === colFilters.coachName)
  )
  list = [...list].sort((a, b) => {
    if (sort === 'name-asc')         return a.name.localeCompare(b.name)
    if (sort === 'name-desc')        return b.name.localeCompare(a.name)
    if (sort === 'name_ar-asc')      return (a.name_ar||'').localeCompare(b.name_ar||'')
    if (sort === 'name_ar-desc')     return (b.name_ar||'').localeCompare(a.name_ar||'')
    if (sort === 'sport_category-asc')  return (a.sport_category||'').localeCompare(b.sport_category||'')
    if (sort === 'sport_category-desc') return (b.sport_category||'').localeCompare(a.sport_category||'')
    if (sort === 'sport-asc')        return (a.sport||'').localeCompare(b.sport||'')
    if (sort === 'sport-desc')       return (b.sport||'').localeCompare(a.sport||'')
    if (sort === 'status-asc')       return (a.status||'').localeCompare(b.status||'')
    if (sort === 'status-desc')      return (b.status||'').localeCompare(a.status||'')
    if (sort === 'nationality-asc')  return (a.nationality||'').localeCompare(b.nationality||'')
    if (sort === 'nationality-desc') return (b.nationality||'').localeCompare(a.nationality||'')
    if (sort === 'disability-asc')   return (a.disability||'').localeCompare(b.disability||'')
    if (sort === 'disability-desc')  return (b.disability||'').localeCompare(a.disability||'')
    if (sort === 'coach_id-asc')     return (coaches.find(c=>c.id===a.coach_id)?.name||'').localeCompare(coaches.find(c=>c.id===b.coach_id)?.name||'')
    if (sort === 'coach_id-desc')    return (coaches.find(c=>c.id===b.coach_id)?.name||'').localeCompare(coaches.find(c=>c.id===a.coach_id)?.name||'')
    if (sort === 'gender-asc')       return (a.gender||'').localeCompare(b.gender||'')
    if (sort === 'gender-desc')      return (b.gender||'').localeCompare(a.gender||'')
    if (sort === 'dob-asc')          return new Date(a.dob||0) - new Date(b.dob||0)
    if (sort === 'dob-desc')         return new Date(b.dob||0) - new Date(a.dob||0)
    if (sort === 'medals-desc')      return (b.medals_gold+b.medals_silver+b.medals_bronze)-(a.medals_gold+a.medals_silver+a.medals_bronze)
    if (sort === 'gold-desc')        return b.medals_gold - a.medals_gold
    if (sort === 'join_date-asc')    return new Date(a.join_date||0) - new Date(b.join_date||0)
    if (sort === 'join_date-desc')   return new Date(b.join_date||0) - new Date(a.join_date||0)
    if (sort === 'join-desc')        return new Date(b.join_date) - new Date(a.join_date)
    if (sort === 'join-asc')         return new Date(a.join_date) - new Date(b.join_date)
    return 0
  })

  async function handleSave(formData) {
    const isEdit = !!formData.id
    const payload = {
      name: formData.name, name_ar: formData.nameAr, dob: formData.dob || null,
      gender: formData.gender, nationality: formData.nationality,
      sport: formData.sport, classification: formData.classification,
      disability: formData.disability, coach_id: formData.coachId || null,
      status: formData.status, phone: formData.phone, email: formData.email,
      join_date: formData.joinDate || null,
      passport_number: formData.passportNumber || null,
      passport_expiry: formData.passportExpiry || null,
      id_number: formData.idNumber || null,
      id_expiry: formData.idExpiry || null,
      emergency_contact_name: formData.emergencyName || null,
      emergency_contact_relation: formData.emergencyRelation || null,
      emergency_contact_phone: formData.emergencyPhone || null,
      blood_type: formData.bloodType || null,
      allergies: formData.allergies || null,
      medical_conditions: formData.medicalConditions || null,
    }
    if (!payload.name) { toast('Name is required', 'error'); return }
    const { error } = isEdit
      ? await supabase.from('athletes').update(payload).eq('id', formData.id)
      : await supabase.from('athletes').insert(payload)
    if (error) { toast(error.message, 'error'); return }
    toast(isEdit ? `${payload.name} updated` : `${payload.name} added`)
    setForm(null); await onRefresh()
    if (isEdit) setSelected(formData.id)
  }

  async function handleDelete(id, name) {
    const { error } = await supabase.from('athletes').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} deleted`)
    setSelected(null); setConfirm(null); onRefresh()
  }

  async function handlePhotoUpload(athleteId, file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${athleteId}.${ext}`
      // Remove any existing photos first
      await supabase.storage.from('athlete-photos').remove([
        `${athleteId}.jpg`, `${athleteId}.jpeg`, `${athleteId}.png`, `${athleteId}.webp`
      ])
      const { error: upErr } = await supabase.storage.from('athlete-photos').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('athlete-photos').getPublicUrl(path)
      const photoUrl = data.publicUrl + '?t=' + Date.now()
      const { error: dbErr } = await supabase.from('athletes').update({ photo_url: photoUrl }).eq('id', athleteId)
      if (dbErr) throw dbErr
      toast('Photo updated!'); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setUploading(false) }
  }

  async function handlePhotoRemove(athleteId) {
    const { error } = await supabase.from('athletes').update({ photo_url: null }).eq('id', athleteId)
    if (error) { toast(error.message, 'error'); return }
    toast('Photo removed'); await onRefresh()
  }

  async function handleDocUpload(athleteId, file) {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { toast('File must be under 20MB', 'error'); return }
    setDocUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${athleteId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('athlete-documents').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('athlete-documents').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('athlete_documents').insert({
        athlete_id: athleteId, name: file.name, type: docType,
        file_url: data.publicUrl, file_path: path, file_size: file.size,
      })
      if (dbErr) throw dbErr
      toast(`${docType} uploaded!`); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setDocUploading(false); if (docInput.current) docInput.current.value = '' }
  }

  async function handleDocDelete(doc) {
    await supabase.storage.from('athlete-documents').remove([doc.file_path])
    const { error } = await supabase.from('athlete_documents').delete().eq('id', doc.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Document deleted'); setDocConfirm(null); await onRefresh()
  }

  async function saveNotes(athleteId) {
    setSavingNotes(true)
    const { error } = await supabase.from('athletes').update({ notes }).eq('id', athleteId)
    if (error) { toast(error.message, 'error') }
    else { toast('Notes saved'); setNotesChanged(false); await onRefresh() }
    setSavingNotes(false)
  }

  // ── PDF EXPORT ──
  function exportPDF(a, coach, myResults, myDocs, myEvents) {
    const age = calcAge(a.dob)
    const yearsActive = calcYearsActive(a.join_date)
    const bests = getPersonalBests(myResults)
    const isAr = lang === 'ar'
    const dir = isAr ? 'rtl' : 'ltr'

    const SPORT_AR = SPORT_NAMES_AR
    const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','Suspended':'موقوف','Under Medical Review':'تحت المراجعة الطبية','Injured':'مصاب','Retired':'متقاعد'}
    const DIS_AR = {'Visual Impairment':'إعاقة بصرية','Hearing Impairment':'إعاقة سمعية','Physical Impairment':'إعاقة جسدية','Intellectual Disability':'إعاقة ذهنية','Spinal Cord Injury':'إصابة الحبل الشوكي','Cerebral Palsy':'شلل دماغي','Amputation':'بتر','Down Syndrome':'متلازمة داون','Autism':'التوحد','Multiple Disabilities':'إعاقات متعددة'}
    const COUNTRY_AR = {'Qatar':'قطر','Egypt':'مصر','Algeria':'الجزائر','Morocco':'المغرب','Jordan':'الأردن','Saudi Arabia':'المملكة العربية السعودية','UAE':'الإمارات','Iraq':'العراق','Syria':'سوريا','Yemen':'اليمن','Somalia':'الصومال','Sudan':'السودان','Libya':'ليبيا','Tunisia':'تونس','Pakistan':'باكستان','India':'الهند','Iran':'إيران','Turkey':'تركيا','Azerbaijan':'أذربيجان','Ireland':'أيرلندا','France':'فرنسا','Spain':'إسبانيا','Germany':'ألمانيا','UK':'المملكة المتحدة','USA':'الولايات المتحدة'}
    const MEDAL_AR = {'gold':'ذهب','silver':'فضة','bronze':'برونز'}
    const DESIG_AR = {'Player':'لاعب','Female Player':'لاعبة','Coach':'مدرب','Female Coach':'مدربة','Referee':'حكم','Admin Staff':'جهاز إداري'}
    const RESID_AR = {'Qatari Male':'قطري','Qatari Female':'قطرية','Resident Male':'مقيم','Resident Female':'مقيمة','Professional Male':'محترف','Professional Female':'محترفة','Born in Qatar':'مواليد قطر','Qatari Mother':'أم قطرية'}

    const t = (en, arObj, val) => val ? (isAr ? (arObj[val] || (COUNTRY_AR[val]) || val) : val) : '—'
    const L = (en, ar) => isAr ? ar : en
    const field = (k, v) => {
      const clean = (v === null || v === undefined || v === 'null' || v === 'undefined' || v === '') ? null : v
      return clean ? `<div class="field"><span class="k">${k}</span><span class="v">${clean}</span></div>` : ''
    }
    const expiredLabel = isAr ? '⚠ منتهية' : '⚠ EXPIRED'

    const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr?'ar':'en'}"><head><meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #1a1d23; padding: 32px; font-size: 13px; direction: ${dir}; }
  .header { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 3px solid #0085C7; }
  .dot { width: 14px; height: 14px; border-radius: 50%; }
  .header-text h1 { font-size: 20px; font-weight: 700; color: #0a1628; }
  .header-text p { font-size: 12px; color: #9aa3b2; margin-top: 2px; }
  .profile-header { display: flex; gap: 20px; margin-bottom: 24px; }
  .photo { width: 80px; height: 80px; border-radius: 50%; background: #0085C7; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 28px; font-weight: 700; flex-shrink: 0; overflow: hidden; }
  .photo img { width: 100%; height: 100%; object-fit: cover; }
  .profile-info h2 { font-size: 22px; font-weight: 700; }
  .profile-info .sub { font-size: 13px; color: #5a6272; margin-top: 3px; }
  .badges { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-blue { background: #e8f3fb; color: #1565a0; }
  .badge-green { background: #e6f4ee; color: #0d6e42; }
  .badge-gray { background: #f0f1f3; color: #555e70; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: 700; color: #9aa3b2; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e5ea; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  .field { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f1f3; font-size: 12px; }
  .field .k { color: #5a6272; }
  .field .v { font-weight: 600; text-align: ${isAr?'left':'right'}; }
  .medal-row { display: flex; gap: 24px; }
  .medal-item { text-align: center; }
  .medal-num { font-size: 24px; font-weight: 700; }
  .result-row { display: flex; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0f1f3; font-size: 12px; }
  .doc-row { padding: 6px 0; border-bottom: 1px solid #f0f1f3; font-size: 12px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e5ea; font-size: 10px; color: #9aa3b2; text-align: center; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="no-print" style="position:fixed;top:16px;left:16px;z-index:999">
  <button onclick="if(window.opener||window.history.length<=1){window.close()}else{history.back()}"
    style="display:flex;align-items:center;gap:6px;padding:9px 18px;background:#0a1628;color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer;font-family:Arial;box-shadow:0 2px 12px rgba(0,0,0,.3)">
    &#8592; Back
  </button>
</div>

<div class="header">
  <div class="header-logo" style="display:flex;gap:5px">
    <div class="dot" style="background:#EE334E"></div>
    <div class="dot" style="background:#0085C7"></div>
    <div class="dot" style="background:#009F6B"></div>
  </div>
  <div class="header-text">
    <h1>${isAr ? 'الاتحاد القطري لذوي الاحتياجات الخاصة' : 'Qatar Paralympic Committee'}</h1>
    <p>${isAr ? `ملف الرياضي الرسمي · تم الإنشاء ${new Date().toLocaleDateString('ar-QA')}` : `Official Athlete Profile · Generated ${new Date().toLocaleDateString()}`}</p>
  </div>
</div>

<div class="profile-header">
  <div class="photo">${a.photo_url ? `<img src="${a.photo_url}" />` : initials(a.name)}</div>
  <div class="profile-info">
    <h2>${isAr && a.name_ar ? a.name_ar : a.name}</h2>
    <p class="sub">${isAr && a.name_ar ? a.name : (a.name_ar || '')}</p>
    <div class="badges">
      ${a.sport ? `<span class="badge badge-blue">${isAr ? (SPORT_AR[a.sport]||a.sport) : a.sport}</span>` : `<span class="badge badge-gray">${L('No Sport Assigned','لم يتم تحديد الرياضة')}</span>`}
      ${a.classification ? `<span class="badge badge-blue">${a.classification}</span>` : ''}
      <span class="badge badge-${a.status==='Active'?'green':'gray'}">${isAr ? (STATUS_AR[a.status]||a.status||L('Unknown','غير محدد')) : (a.status||'Unknown')}</span>
    </div>
    <p style="margin-top:8px;color:#9aa3b2;font-size:11px">
      ${age ? (isAr ? `${age} ${L('years old','سنة')}` : `Age ${age}`) : ''}
      ${age && yearsActive ? ' · ' : ''}
      ${yearsActive ? (isAr ? `${yearsActive} ${L('years with QPC','سنوات مع QPC')}` : `${yearsActive} years with QPC`) : ''}
    </p>
  </div>
</div>

<div class="section">
  <div class="section-title">${L('Personal Information','المعلومات الشخصية')}</div>
  <div class="grid-2">
    ${field(L('Date of birth','تاريخ الميلاد'), a.dob)}
    ${field(L('Gender','الجنس'), a.gender ? (isAr ? (a.gender==='Male'?'ذكر':'أنثى') : a.gender) : null)}
    ${field(L('Nationality','الجنسية'), isAr ? (COUNTRY_AR[a.nationality]||a.nationality) : a.nationality)}
    ${field(L('Phone','الهاتف'), a.phone)}
    ${field(L('Email','البريد الإلكتروني'), a.email)}
    ${field(L('Joined QPC','تاريخ الانضمام'), a.join_date)}
    ${field(L('Age category','الفئة العمرية'), a.age_category)}
    ${field(L('QSS Number','رقم QSS'), a.qss_number)}
  </div>
</div>

<div class="section">
  <div class="section-title">${L('Sport & Classification','الرياضة والتصنيف')}</div>
  <div class="grid-2">
    ${field(L('Sport','الرياضة'), isAr ? (SPORT_AR[a.sport]||a.sport) : a.sport)}
    ${field(L('Classification','التصنيف'), a.classification)}
    ${field(L('Disability type','نوع الإعاقة'), isAr ? (DIS_AR[a.disability]||a.disability) : a.disability)}
    ${field(L('Head coach','المدرب الرئيسي'), coach ? (isAr && coach.name_ar ? coach.name_ar : coach.name) : L('Unassigned','غير معين'))}
    ${field(L('Medical status','الحالة الطبية'), a.medical_status)}
    ${field(L('Career profile #','رقم المسار'), a.career_profile)}
  </div>
</div>

<div class="section">
  <div class="section-title">${L('Club & Role','النادي والدور')}</div>
  <div class="grid-2">
    ${field(L('Club','النادي'), a.club)}
    ${field(L('Designation','الوظيفة'), isAr ? (DESIG_AR[a.designation]||a.designation) : a.designation)}
    ${field(L('Residency status','الصفة'), isAr ? (RESID_AR[a.residency_status]||a.residency_status) : a.residency_status)}
  </div>
</div>

${(a.passport_number || a.id_number || a.passport_expiry || a.id_expiry) ? `<div class="section">
  <div class="section-title">${L('Passport & ID','الجواز والهوية')}</div>
  <div class="grid-2">
    ${field(L('Passport number','رقم الجواز'), a.passport_number)}
    ${a.passport_expiry ? `<div class="field"><span class="k">${L('Passport expiry','انتهاء الجواز')}</span><span class="v" style="${new Date(a.passport_expiry)<new Date()?'color:#dc2626':''}">${a.passport_expiry}${new Date(a.passport_expiry)<new Date()?' '+expiredLabel:''}</span></div>` : ''}
    ${field(L('Qatar ID number','الرقم الشخصي'), a.id_number)}
    ${a.id_expiry ? `<div class="field"><span class="k">${L('ID expiry','انتهاء الهوية')}</span><span class="v" style="${new Date(a.id_expiry)<new Date()?'color:#dc2626':''}">${a.id_expiry}${new Date(a.id_expiry)<new Date()?' '+expiredLabel:''}</span></div>` : ''}
  </div>
</div>` : ''}





<div class="section">
  <div class="section-title">${L('Medals','الميداليات')}</div>
  <div class="medal-row">
    <div class="medal-item"><div class="medal-num" style="color:#f1c40f">${a.medals_gold||0}</div><div style="font-size:11px;color:#9aa3b2">${L('Gold','ذهب')}</div></div>
    <div class="medal-item"><div class="medal-num" style="color:#aaa">${a.medals_silver||0}</div><div style="font-size:11px;color:#9aa3b2">${L('Silver','فضة')}</div></div>
    <div class="medal-item"><div class="medal-num" style="color:#cd7f32">${a.medals_bronze||0}</div><div style="font-size:11px;color:#9aa3b2">${L('Bronze','برونز')}</div></div>
  </div>
</div>

${myResults.length > 0 ? `<div class="section">
  <div class="section-title">${L('Competition Results','سجل النتائج')}</div>
  ${myResults.map(r => `<div class="result-row">
    <span style="font-size:18px">${r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'}</span>
    <div style="flex:1"><div style="font-weight:500">${r.event_name}</div><div style="color:#9aa3b2">${r.discipline||''}</div></div>
    <span style="font-weight:600;color:#0085C7">${r.result||''}</span>
    <span style="color:#9aa3b2">${r.date||''}</span>
  </div>`).join('')}
</div>` : ''}

${myEvents.length > 0 ? `<div class="section">
  <div class="section-title">${L('Competition History','سجل المنافسات')}</div>
  ${myEvents.map(ev => `<div class="doc-row">
    <span style="font-weight:500">${ev.name}</span>
    <span style="color:#9aa3b2;margin-${isAr?'right':'left'}:10px">${ev.start_date||''}</span>
  </div>`).join('')}
</div>` : ''}

${myDocs.length > 0 ? `<div class="section">
  <div class="section-title">${L('Documents','الوثائق')}</div>
  ${myDocs.map(d => `<div class="doc-row"><span style="font-weight:500">${d.type}</span> — <span style="color:#9aa3b2">${d.name}</span></div>`).join('')}
</div>` : ''}

<div class="footer">${isAr ? 'الاتحاد القطري لذوي الاحتياجات الخاصة · سري · ' : 'Qatar Paralympic Committee · Confidential · '}${new Date().getFullYear()}</div>
</body></html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  // ── DETAIL VIEW ──
  if (selected) {
    const a = athletes.find(x => String(x.id) === String(selected))
    if (!a) { setSelected(null); return null }
    const coach      = coaches.find(c => c.id === a.coach_id)
    const myResults  = (results || []).filter(r => r.athlete_id === a.id)
    const myDocs     = (documents || []).filter(d => d.athlete_id === a.id)
    const myEventIds = (registrations || []).filter(r => r.athlete_id === a.id).map(r => r.event_id)
    const myEvents   = (events || []).filter(e => myEventIds.includes(e.id)).sort((a,b) => new Date(b.start_date) - new Date(a.start_date))
    const docsByType = DOC_TYPES.reduce((acc, t) => { acc[t] = myDocs.filter(d => d.type === t); return acc }, {})
    const bests      = getPersonalBests(myResults)
    const age        = calcAge(a.dob)
    const yearsActive = calcYearsActive(a.join_date)

    return (
      <div>
        {form && (
          <FormModal type="athlete"
            record={form==='edit' ? {
              id:a.id, name:a.name, nameAr:a.name_ar, dob:a.dob,
              gender:a.gender, nationality:a.nationality, sport:a.sport,
              classification:a.classification, disability:a.disability,
              coachId:a.coach_id, status:a.status, phone:a.phone,
              email:a.email, joinDate:a.join_date,
              club:a.club, designation:a.designation,
              residencyStatus:a.residency_status, qssNumber:a.qss_number,
              passportNumber:a.passport_number, passportExpiry:a.passport_expiry,
              idNumber:a.id_number, idExpiry:a.id_expiry,
              emergencyName:a.emergency_contact_name,
              emergencyRelation:a.emergency_contact_relation,
              emergencyPhone:a.emergency_contact_phone,
              bloodType:a.blood_type, allergies:a.allergies,
              medicalConditions:a.medical_conditions,
            } : null}
            coaches={coaches} onSave={handleSave} onClose={() => setForm(null)} />
        )}
        {confirm && <ConfirmModal title="Delete athlete" message={`Delete ${a.name}? This cannot be undone.`} onConfirm={() => handleDelete(a.id, a.name)} onCancel={() => setConfirm(null)} />}
        {docConfirm && <ConfirmModal title="Delete document" message={`Delete "${docConfirm.name}"?`} onConfirm={() => handleDocDelete(docConfirm)} onCancel={() => setDocConfirm(null)} />}
        {medalModal && (
          <div className="modal-overlay" onClick={() => setMedalModal(null)}>
            <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">{medalModal.type==='gold'?'🥇':medalModal.type==='silver'?'🥈':'🥉'} {medalModal.label} Medals — {medalModal.athleteName}</div>
                <button className="modal-close" onClick={() => setMedalModal(null)}><i className="ti ti-x" /></button>
              </div>
              <div className="modal-body">
                {medalModal.results.length === 0
                  ? <div className="empty">No {medalModal.label.toLowerCase()} medals recorded yet.</div>
                  : medalModal.results.map(r => (
                    <div key={r.id} style={{ display:'flex', gap:14, alignItems:'flex-start', padding:'14px 0', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ width:44, height:44, borderRadius:'50%', background:medalModal.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                        {medalModal.type==='gold'?'🥇':medalModal.type==='silver'?'🥈':'🥉'}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>{r.discipline}</div>
                        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:8 }}>{r.event_name}</div>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                          <span className="badge badge-blue">{r.result}</span>
                          <span className="badge badge-gray"><i className="ti ti-calendar" style={{ fontSize:11, verticalAlign:-1, marginRight:3 }} />{r.date}</span>
                          <span className="badge" style={{ background:medalModal.color+'18', color:medalModal.color }}>Position #{r.position}</span>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> {tx('actions.back','Back')}</button>
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          {canEdit(profile) && <>
            <button className="action-btn action-btn-edit" onClick={() => setForm('edit')}><i className="ti ti-pencil" /> {tx('actions.edit','Edit')}</button>
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> {tx('actions.delete','Delete')}</button>
          </>}
          <button className="action-btn action-btn-edit" onClick={() => exportPDF(a, coach, myResults, myDocs, myEvents)}
            style={{ borderColor:'#009F6B', color:'#009F6B' }}
            onMouseEnter={e => { e.currentTarget.style.background='#e6f4ee' }}
            onMouseLeave={e => { e.currentTarget.style.background='' }}>
            <i className="ti ti-printer" /> {tx('actions.exportPDF','Export PDF')}
          </button>
          <AthleteCardButton athlete={a} />
        </div>

        <div className="detail-grid">
          <div>
            {/* PROFILE CARD */}
            <div className="detail-profile">
              <div style={{ position:'relative', width:90, height:90, margin:'0 auto 14px' }}>
                {a.photo_url
                  ? <img src={a.photo_url} alt={a.name} style={{ width:90, height:90, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--border)' }} />
                  : <div style={{ width:90, height:90, borderRadius:'50%', background:avColor(a.id), display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:600, color:'#fff' }}>{initials(a.name)}</div>
                }
                {canEdit(profile) && (
                  <div style={{ position:'absolute', bottom:0, right:0, display:'flex', gap:3 }}>
                    <button onClick={() => photoInput.current.click()} disabled={uploading} title="Upload photo"
                      style={{ width:26, height:26, borderRadius:'50%', background:'#0085C7', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                      {uploading ? <div style={{ width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> : <i className="ti ti-camera" style={{ fontSize:12 }} />}
                    </button>
                    {a.photo_url && (
                      <button onClick={() => handlePhotoRemove(a.id)} title="Remove photo"
                        style={{ width:26, height:26, borderRadius:'50%', background:'#dc2626', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                        <i className="ti ti-x" style={{ fontSize:12 }} />
                      </button>
                    )}
                  </div>
                )}
                <input ref={photoInput} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { if(e.target.files[0]) handlePhotoUpload(a.id, e.target.files[0]) }} />
              </div>
              <div className="detail-name">{lang==='ar' && a.name_ar ? a.name_ar : a.name}</div>
              {(lang==='ar' && a.name_ar ? a.name : a.name_ar) && <div className="detail-sub">{lang==='ar' && a.name_ar ? a.name : a.name_ar}</div>}
              <div className="detail-badges">
                <Badge label={{'Active':lang==='ar'?'نشط':'Active','Inactive':lang==='ar'?'غير نشط':'Inactive','Suspended':lang==='ar'?'موقوف':'Suspended','Under Medical Review':lang==='ar'?'تحت المراجعة الطبية':'Under Medical Review','Injured':lang==='ar'?'مصاب':'Injured','Retired':lang==='ar'?'متقاعد':'Retired'}[a.status]||a.status} />
                <span className="badge badge-blue">{SPORT_NAMES[a.sport]||a.sport}</span>
              </div>

              {/* AGE & YEARS ACTIVE */}
              {(age || yearsActive) && (
                <div style={{ display:'flex', justifyContent:'center', gap:16, margin:'12px 0', padding:'10px', background:'var(--surface2)', borderRadius:10 }}>
                  {age && <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:600, color:'#0085C7' }}>{age}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{lang==='ar'?'سنة':'years old'}</div>
                  </div>}
                  {age && yearsActive && <div style={{ width:1, background:'var(--border)' }} />}
                  {yearsActive && <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:16, fontWeight:600, color:'#009F6B' }}>{yearsActive}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{lang==='ar'?'مع QPC':'with QPC'}</div>
                  </div>}
                </div>
              )}

              <div className="detail-fields">
                {[[tx('profile.dateOfBirth','Date of birth'),a.dob],[tx('profile.gender','Gender'), a.gender ? (lang==='ar' ? (a.gender==='Male'?'ذكر':'أنثى') : a.gender) : null],[tx('profile.nationality','Nationality'),tc(a.nationality)],[tx('profile.phone','Phone'),a.phone],[tx('profile.email','Email'),a.email],[tx('athletes.joinedQPC','Joined QPC'),a.join_date]].map(([k,v]) => (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v||'—'}</span></div>
                ))}
              </div>
            </div>

            {/* MEDALS */}
            <div className="info-card" style={{ marginTop:12 }}>
              <div className="info-title">{lang==='ar'?'عدد الميداليات':'Medal count'} <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>({lang==='ar'?'انقر للتفاصيل':'click to see details'})</span></div>
              <div className="medal-row">
                {[['gold','#f1c40f',lang==='ar'?'ذهب':'Gold'],['silver','#aaa',lang==='ar'?'فضة':'Silver'],['bronze','#cd7f32',lang==='ar'?'برونز':'Bronze']].map(([type,color,label]) => {
                  const count   = a[`medals_${type}`] || 0
                  const typeRes = myResults.filter(r => r.medal === type)
                  return (
                    <div key={type} className="medal-item"
                      style={{ cursor:count>0?'pointer':'default', borderRadius:10, padding:'8px 4px', transition:'background .15s' }}
                      onMouseEnter={e => { if(count>0) e.currentTarget.style.background='#f4f6f9' }}
                      onMouseLeave={e => { e.currentTarget.style.background='' }}
                      onClick={() => { if(count>0) setMedalModal({ athleteName:a.name, type, color, label, results:typeRes }) }}>
                      <div className="medal-num" style={{ color }}>{count}</div>
                      <div className="medal-lbl">{label}</div>
                      {count>0 && <div style={{ fontSize:9, color, marginTop:2, opacity:.8 }}>{lang==='ar'?'عرض ↗':'view ↗'}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* SPORT */}
            <div className="info-card">
              <div className="info-title">{lang==='ar'?'الرياضة والتصنيف':'Sport & classification'}</div>
              {[[tx('form.sport','Sport'),SPORT_NAMES[a.sport]||a.sport],[tx('form.classification','Classification'),a.classification],[tx('form.disability','Disability type'), tDis(a.disability)],[tx('form.club','Club'),a.club],[lang==='ar'?'الوظيفة':'Designation', {'Player':'لاعب','Female Player':'لاعبة','Coach':'مدرب','Female Coach':'مدربة','Referee':'حكم','Admin Staff':'جهاز إداري','Technical Staff':'جهاز في','Medical Staff':'جهاز طبي'}[a.designation]||a.designation],[tx('form.residencyStatus','Residency status'),a.residency_status]].map(([k,v]) => (
                <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v||'—'}</span></div>
              ))}
            </div>

            {/* COACH */}
            <div className="info-card">
              <div className="info-title">{lang==='ar'?'المدرب الرئيسي':'Head coach'} <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}>— {lang==='ar'?'انقر للعرض':'click to view'}</span></div>
              {coach ? (
                <DashRow onClick={() => onNav('coaches', { coachId: coach.id })}>
                  <div className="av" style={{ width:28, height:28, fontSize:10, background:'#009F6B', flexShrink:0 }}>{initials(coach.name)}</div>
                  <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:500 }}>{lang==='ar'&&coach.name_ar?coach.name_ar:coach.name}</div><div style={{ fontSize:11, color:'#9aa3b2' }}>{coach.sport} · {coach.cert_level}</div></div>
                </DashRow>
              ) : <div style={{ padding:'8px 0', fontSize:13, color:'var(--text3)' }}>{lang==='ar'?'لم يتم تعيين مدرب':'No coach assigned'}</div>}
              <AthleteCoachHistory athleteId={String(a.id)} coaches={coaches} employees={employees} lang={lang} />
            </div>

            {/* PASSPORT & ID */}
            {(a.passport_number || a.id_number) && (
              <div className="info-card">
                <div className="info-title">{tx('profile.passportID','Passport & ID')}</div>
                {a.passport_number && (
                  <>
                    {[[tx('form.passportNumber','Passport number'), a.passport_number], [tx('form.passportExpiry','Passport expiry'), a.passport_expiry]].map(([k,v]) => (
                      <div key={k} className="detail-row">
                        <span className="dk">{k}</span>
                        <span className="dv" style={{ color: v && new Date(v) < new Date() ? '#dc2626' : 'inherit' }}>
                          {v || '—'}
                          {v && new Date(v) < new Date() && <span style={{ marginLeft:6, fontSize:10, color:'#dc2626' }}>{lang==='ar'?'منتهية':'EXPIRED'}</span>}
                        </span>
                      </div>
                    ))}
                  </>
                )}
                {a.id_number && (
                  <>
                    {[[lang==='ar'?'الرقم الشخصي':'Qatar ID number', a.id_number], [lang==='ar'?'انتهاء الهوية':'ID expiry', a.id_expiry]].map(([k,v]) => (
                      <div key={k} className="detail-row">
                        <span className="dk">{k}</span>
                        <span className="dv" style={{ color: v && new Date(v) < new Date() ? '#dc2626' : 'inherit' }}>
                          {v || '—'}
                          {v && new Date(v) < new Date() && <span style={{ marginLeft:6, fontSize:10, color:'#dc2626' }}>{lang==='ar'?'منتهية':'EXPIRED'}</span>}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* EMERGENCY CONTACT */}
            {(a.emergency_contact_name || a.emergency_contact_phone) && (
              <div className="info-card">
                <div className="info-title">{tx('profile.emergencyContact','Emergency contact')}</div>
                {[
                  [lang==='ar'?'الاسم':'Name', a.emergency_contact_name],
                  [lang==='ar'?'صلة القرابة':'Relationship', a.emergency_contact_relation],
                  [tx('form.contactPhone','Phone'), a.emergency_contact_phone],
                ].map(([k,v]) => v ? (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
                ) : null)}
              </div>
            )}

            {/* MEDICAL INFO */}
            {(a.blood_type || a.allergies || a.medical_conditions) && (
              <div className="info-card">
                <div className="info-title" style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <i className="ti ti-heart-rate-monitor" style={{ fontSize:13, color:'#EE334E' }} />
                  </div>
                {[
                ].map(([k,v]) => v ? (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
                ) : null)}
              </div>
            )}

            {/* PERSONAL BESTS */}
            {bests.length > 0 && (
              <div className="info-card">
                <div className="info-title">{tx('profile.personalBests','Personal bests')}</div>
                {bests.map(r => (
                  <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':r.medal==='bronze'?'🥉':'📋'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{r.discipline}</div>
                      <div style={{ fontSize:11, color:'var(--text2)' }}>{r.event_name}</div>
                    </div>
                    <span style={{ fontSize:13, fontWeight:600, color:'#0085C7' }}>{r.result}</span>
                  </div>
                ))}
              </div>
            )}

            {/* COMPETITION HISTORY */}
            <div className="info-card">
              <div className="info-title" style={{ marginBottom:14 }}>
                {lang==='ar'?'سجل المنافسات':'Competition history'}
                <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>{myEvents.length}</span>
              </div>
              {myEvents.length === 0
                ? <div className="empty" style={{ padding:'16px 0' }}>{lang==='ar'?'لم يتم التسجيل في أي فعاليات بعد.':'Not registered in any events yet.'}</div>
                : <div style={{ position:'relative' }}>
                    <div style={{ position:'absolute', left:15, top:6, bottom:6, width:2, background:'var(--border)', borderRadius:2 }} />
                    {myEvents.map(ev => {
                      const evResults = (results||[]).filter(r => r.athlete_id === a.id && r.event_name === ev.name)
                      const medals    = evResults.filter(r => r.medal)
                      const dotColor  = ev.status==='Completed' ? medals.length>0 ? '#f1c40f' : '#009F6B' : ev.status==='Upcoming' ? '#0085C7' : ev.status==='Registration Open' ? '#8b5cf6' : '#9aa3b2'
                      return (
                        <div key={ev.id} style={{ display:'flex', gap:14, marginBottom:16, position:'relative' }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background:dotColor+'20', border:`2px solid ${dotColor}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1 }}>
                            {ev.status==='Completed' && medals.length>0
                              ? <span style={{ fontSize:14 }}>{medals[0].medal==='gold'?'🥇':medals[0].medal==='silver'?'🥈':'🥉'}</span>
                              : <i className={`ti ${ev.status==='Completed'?'ti-check':'ti-calendar'}`} style={{ fontSize:13, color:dotColor }} />
                            }
                          </div>
                          <div style={{ flex:1, paddingTop:4 }}>
                            <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{ev.name}</div>
                            <div style={{ fontSize:11, color:'var(--text2)', marginBottom:4, display:'flex', gap:10, flexWrap:'wrap' }}>
                              <span><i className="ti ti-map-pin" style={{ fontSize:11, marginRight:3 }} />{ev.venue}</span>
                              <span><i className="ti ti-calendar" style={{ fontSize:11, marginRight:3 }} />{ev.start_date}</span>
                            </div>
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                              <span className="badge badge-blue" style={{ fontSize:10 }}>{ev.sport}</span>
                              <span className="badge" style={{ fontSize:10, background:dotColor+'15', color:dotColor }}>{ev.status}</span>
                              {medals.map(r => <span key={r.id} style={{ fontSize:11 }}>{r.medal==='gold'?'🥇':r.medal==='silver'?'🥈':'🥉'} {r.discipline} — {r.result}</span>)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
            </div>

            {/* NOTES */}
            <div className="info-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div className="info-title" style={{ margin:0 }}>
                  {lang==='ar'?'ملاحظات':'Notes'}
                  <span style={{ marginLeft:6, fontSize:10, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>— {lang==='ar'?'خاص، يظهر للمسؤولين فقط':'private, visible to admins only'}</span>
                </div>
                {notesChanged && canEdit(profile) && (
                  <button onClick={() => saveNotes(a.id)} disabled={savingNotes}
                    style={{ padding:'4px 12px', background:'#0085C7', color:'#fff', border:'none', borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'DM Sans, sans-serif' }}>
                    {savingNotes ? (lang==='ar'?'جارٍ الحفظ…':'Saving…') : <><i className="ti ti-device-floppy" style={{ fontSize:13 }} /> {lang==='ar'?'حفظ':'Save'}</>}
                  </button>
                )}
              </div>
              {canEdit(profile)
                ? <textarea
                    value={notes}
                    onChange={e => { setNotes(e.target.value); setNotesChanged(true) }}
                    placeholder={lang==='ar'?'أضف ملاحظات عن هذا الرياضي…':'Add notes about this athlete…'}
                    style={{ width:'100%', minHeight:100, padding:'10px 12px', borderRadius:9, border:'1px solid var(--border)', background:'var(--surface)', fontSize:13, color:'var(--text)', outline:'none', resize:'vertical', fontFamily:'DM Sans, sans-serif', lineHeight:1.6, transition:'border .15s' }}
                    onFocus={e => e.target.style.borderColor='#0085C7'}
                    onBlur={e => e.target.style.borderColor='var(--border)'}
                  />
                : a.notes
                  ? <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{a.notes}</p>
                  : <div style={{ fontSize:13, color:'var(--text3)', fontStyle:'italic' }}>{lang==='ar'?'لا توجد ملاحظات بعد.':'No notes added yet.'}</div>
              }
            </div>

            {/* CAREER HISTORY */}
            <CareerHistory personId={a.id} personType="athlete" personName={lang==='ar'&&a.name_ar?a.name_ar:a.name} />

            {/* DOCUMENTS */}
            <div className="info-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div className="info-title" style={{ margin:0 }}>{lang==='ar'?'الوثائق':'Documents'} <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text3)', textTransform:'none', letterSpacing:0 }}>{myDocs.length} {lang==='ar'?'ملف':`file${myDocs.length!==1?'s':''}`}</span></div>
              </div>
              {canEdit(profile) && (
                <div style={{ display:'flex', gap:8, marginBottom:16, padding:'10px 12px', background:'var(--surface2)', borderRadius:10, alignItems:'center', direction:'ltr' }}>
                  <div style={{ flex:1, position:'relative' }}>
                    <button onClick={() => setDocDropOpen(v=>!v)}
                      style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', fontSize:12, color:'var(--text)', cursor:'pointer', fontFamily:'DM Sans, sans-serif', direction: lang==='ar'?'rtl':'ltr' }}>
                      <span>{lang==='ar'?(DOC_TYPES_AR[docType]||docType):docType}</span>
                      <i className="ti ti-chevron-down" style={{ fontSize:12, color:'var(--text3)' }} />
                    </button>
                    {docDropOpen && (
                      <div onMouseDown={e => e.stopPropagation()} style={{ position:'fixed', zIndex:9999, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.15)', minWidth:200, maxHeight:280, overflowY:'auto', direction: lang==='ar'?'rtl':'ltr' }}
                        ref={el => {
                          if (el) {
                            const btn = el.previousSibling
                            const rect = btn?.getBoundingClientRect()
                            if (rect) {
                              const spaceBelow = window.innerHeight - rect.bottom
                              const dropH = Math.min(280, DOC_TYPES.length * 38)
                              if (spaceBelow < dropH + 8) {
                                el.style.top = 'auto'; el.style.bottom = (window.innerHeight - rect.top + 4) + 'px'
                              } else {
                                el.style.top = (rect.bottom+4)+'px'; el.style.bottom = 'auto'
                              }
                              el.style.left=rect.left+'px'; el.style.width=rect.width+'px'
                            }
                          }
                        }}>
                        {DOC_TYPES.map(t => (
                          <div key={t} onClick={() => { setDocType(t); setDocDropOpen(false) }}
                            style={{ padding:'9px 14px', fontSize:12, cursor:'pointer', background: t===docType?'var(--surface2)':'transparent', fontWeight: t===docType?600:400, color: t===docType?'#0085C7':'var(--text)' }}
                            onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                            onMouseLeave={e => e.currentTarget.style.background=t===docType?'var(--surface2)':'transparent'}>
                            {lang==='ar'?(DOC_TYPES_AR[t]||t):t}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => docInput.current.click()} disabled={docUploading}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'#0085C7', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', flexShrink:0, fontFamily:'DM Sans, sans-serif' }}>
                    {docUploading ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />{lang==='ar'?'جارٍ الرفع…':'Uploading…'}</> : <><i className="ti ti-upload" style={{ fontSize:14 }} />{lang==='ar'?'رفع':'Upload'}</>}
                  </button>
                  <input ref={docInput} type="file" style={{ display:'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => { if(e.target.files[0]) handleDocUpload(a.id, e.target.files[0]) }} />
                </div>
              )}
              {myDocs.length === 0
                ? <div className="empty" style={{ padding:'20px 0' }}>{lang==='ar'?'لم يتم رفع وثائق بعد.':'No documents uploaded yet.'}</div>
                : DOC_TYPES.map(type => {
                    const typeDocs = docsByType[type]
                    if (typeDocs.length === 0) return null
                    if (!canEdit(profile) && type === 'Mission Passport') return null
                    const color = DOC_COLORS[type]
                    const icon  = DOC_ICONS[type]
                    return (
                      <div key={type} style={{ marginBottom:14 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                          <i className={`ti ${icon}`} style={{ fontSize:13, color }} />
                          <span style={{ fontSize:11, fontWeight:600, color }}>{lang==='ar' ? (DOC_TYPES_AR[type]||type) : type}</span>
                        </div>
                        {typeDocs.map(doc => (
                          <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', background:'var(--surface2)', borderRadius:9, marginBottom:6, border:'1px solid var(--border)' }}>
                            <div style={{ width:34, height:34, borderRadius:8, background:color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <i className={`ti ${icon}`} style={{ fontSize:16, color }} />
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.name}</div>
                              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{formatFileSize(doc.file_size)} · {doc.uploaded_at?.slice(0,10)}</div>
                            </div>
                            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                              {(canEdit(profile) || doc.type !== 'Mission Passport') && (
                                <button
                                  onClick={() => downloadDoc(doc.file_url, a.name, doc.type, doc.name)}
                                  style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text2)', cursor:'pointer', fontSize:14 }} title={lang==='ar'?'تحميل':'Download'}>
                                  <i className="ti ti-download" />
                                </button>
                              )}
                              {canEdit(profile) && (
                                <button onClick={() => setDocConfirm(doc)}
                                  style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626', cursor:'pointer' }} title={lang==='ar'?'حذف':'Delete'}>
                                  <i className="ti ti-trash" style={{ fontSize:14 }} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })
              }
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── LIST VIEW ──
  function startEdit() { setEditMode(true); setEdits({}) }
  function cancelEdit() { setEditMode(false); setEdits({}) }
  function setEdit(id, field, value) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }
  function getVal(a, field) {
    return edits[a.id]?.[field] !== undefined ? edits[a.id][field] : a[field]
  }

  async function saveAllEdits() {
    const changed = Object.entries(edits)
    if (changed.length === 0) { setEditMode(false); return }
    setSavingAll(true)
    try {
      await Promise.all(changed.map(([id, fields]) =>
        supabase.from('athletes').update(fields).eq('id', parseInt(id))
      ))
      toast(`${changed.length} athlete${changed.length > 1 ? 's' : ''} updated`)
      setEditMode(false); setEdits({}); await onRefresh()
    } catch (err) { toast('Save failed: ' + err.message, 'error') }
    finally { setSavingAll(false) }
  }

  // ── COLUMN DEFINITIONS ──
  const ALL_COLS = [
    { key:'name',            label:tx('athletes.athlete','Athlete'),          default:true,  editable:true  },
    { key:'name_ar',         label:lang==='ar' ? tx('athletes.athlete','الاسم بالإنجليزي') : tx('athletes.arabicName','Arabic Name'),   default:false, editable:false },
    { key:'qss_number',      label:tx('athletes.qssNumber','QSS #'),          default:false, editable:false },
    { key:'id_number',       label:tx('athletes.qatarID','Qatar ID'),         default:false, editable:false },
    { key:'career_profile',  label:tx('athletes.careerProfile','Career Profile #'), default:false, editable:false },
    { key:'sport_category',  label:tx('athletes.sportCategory','Sport Category'), default:true,  editable:true  },
    { key:'sport',           label:tx('athletes.sport','Sport'),              default:true,  editable:true  },
    { key:'classification',  label:tx('athletes.classification','Classification'), default:true, editable:true },
    { key:'disability',      label:tx('athletes.disability','Disability'),    default:false, editable:false },
    { key:'nationality',     label:tx('athletes.nationality','Nationality'),  default:true,  editable:true  },
    { key:'gender',          label:tx('athletes.gender','Gender'),            default:false, editable:false },
    { key:'dob',             label:tx('athletes.dob','Date of Birth'),        default:false, editable:false },
    { key:'age_category',    label:tx('athletes.ageCategory','Age Category'), default:false, editable:false },
    { key:'coach_id',        label:tx('athletes.coach','Coach'),              default:true,  editable:true  },
    { key:'status',          label:tx('athletes.status','Status'),            default:true,  editable:true  },
    { key:'medical_status',  label:tx('athletes.medicalStatus','Medical Status'), default:true,  editable:false },
    { key:'phone',           label:tx('athletes.phone','Phone'),              default:false, editable:false },
    { key:'email',           label:tx('athletes.email','Email'),              default:false, editable:false },
    { key:'join_date',       label:tx('athletes.joinedQPC','Joined QPC'),     default:false, editable:false },
    { key:'passport_number', label:tx('athletes.passportNo','Passport No'),   default:false, editable:false },
    { key:'passport_expiry', label:tx('athletes.passportExpiry','Passport Expiry'), default:false, editable:false },
    { key:'id_expiry',       label:tx('athletes.idExpiry','ID Expiry'),       default:false, editable:false },
    { key:'blood_type',      label:tx('athletes.bloodType','Blood Type'),     default:false, editable:false },
    { key:'emergency_contact_name',  label:tx('athletes.emergencyContact','Emergency Contact'), default:false, editable:false },
    { key:'emergency_contact_phone', label:tx('athletes.emergencyPhone','Emergency Phone'),     default:false, editable:false },
    { key:'medals',          label:tx('athletes.medals','Medals'),            default:true,  editable:false },
    { key:'docs',            label:tx('athletes.documents','Documents'),      default:false,  editable:false, hidden:true },
  ]

  function toggleCol(key) {
    if (key === 'name') return // always visible
    setVisibleCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  const isVisible = key => visibleCols.includes(key)

  const changedCount = Object.keys(edits).length
  const inlineInput  = { padding:'5px 8px', borderRadius:7, border:'1px solid var(--border)', fontSize:12, background:'var(--surface)', color:'var(--text)', outline:'none', width:'100%', fontFamily:'DM Sans, sans-serif' }
  const inlineSelect = { ...inlineInput, cursor:'pointer' }

  // Render a cell value in view mode
  function renderCell(a, key) {
    const docCount = (documents || []).filter(d => d.athlete_id === a.id).length
    const expired = v => v && new Date(v) < new Date()
    switch(key) {
      case 'name': return (
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {a.photo_url ? <img src={a.photo_url} alt={a.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} /> : <Avatar name={a.name} id={a.id} />}
          <div>
            <div style={{ fontWeight:500 }}>{lang==='ar' && a.name_ar ? a.name_ar : a.name}</div>
            <div style={{ fontSize:11, color:'#9aa3b2' }}>{tc(a.nationality)}</div>
          </div>
        </div>
      )
      case 'name_ar':          return <span style={{ color:'var(--text2)', direction: lang==='ar'?'ltr':'rtl' }}>{lang==='ar' ? (a.name||'—') : (a.name_ar||'—')}</span>
      case 'qss_number':       return <span style={{ color:'var(--text2)', fontFamily:'monospace', fontSize:12 }}>{a.qss_number || '—'}</span>
      case 'career_profile':   return <span style={{ color:'var(--text2)', fontFamily:'monospace', fontSize:12 }}>{a.career_profile || '—'}</span>
      case 'sport_category':   return a.sport_category ? <Badge label={lang==='ar' ? (SPORT_CATEGORY_NAMES_AR[a.sport_category]||a.sport_category) : a.sport_category} /> : <span style={{ color:'var(--text3)' }}>—</span>
      case 'sport':            return <span style={{ color:'var(--text2)' }}>{SPORT_NAMES[a.sport] || a.sport || '—'}</span>
      case 'classification':   return a.classification ? <span className="badge badge-blue">{a.classification}</span> : '—'
      case 'disability':      return <span style={{ color:'var(--text2)' }}>{tDis(a.disability) || '—'}</span>
      case 'nationality':      return <span style={{ color:'var(--text2)' }}>{tc(a.nationality) || '—'}</span>
      case 'gender':           return <span style={{ color:'var(--text2)' }}>{a.gender ? (lang==='ar' ? (a.gender==='Male'?'ذكر':'أنثى') : a.gender) : '—'}</span>
      case 'dob':              return <span style={{ color:'var(--text2)' }}>{a.dob || '—'}</span>
      case 'age_category':     return <span style={{ color:'var(--text2)' }}>{a.age_category || '—'}</span>
      case 'coach_id': {
        const coach = coaches.find(co => co.id === a.coach_id)
        if (!coach) return <span style={{ color:'var(--text3)' }}>—</span>
        return <span style={{ color:'var(--text2)' }}>{lang==='ar' && coach.name_ar ? coach.name_ar : coach.name}</span>
      }
      case 'status': {
        const STATUS_AR = {'Active':tx('status.active','Active'),'Inactive':tx('status.inactive','Inactive'),'Suspended':tx('status.suspended','Suspended'),'Under Medical Review':tx('status.underMedicalReview','Under Medical Review'),'Injured':tx('status.injured','Injured'),'Retired':tx('status.retired','Retired')}
        const sc = {Active:'badge-green',Inactive:'badge-gray',Suspended:'badge-red','Under Medical Review':'badge-amber',Injured:'badge-amber',Retired:'badge-gray'}
        return a.status ? <span className={`badge ${sc[a.status]||'badge-gray'}`}>{STATUS_AR[a.status]||a.status}</span> : <span style={{ color:'var(--text3)' }}>—</span>
      }
      case 'medical_status': {
        const ms = a.medical_status || 'None'
        const msColor = ms === 'None' ? '#EE334E' : ms === 'Screening' ? '#009F6B' : '#0085C7'
        const msLabel = lang==='ar' ? {'None':'لا يوجد','Screening':'فحص','Medical Certificate':'شهادة طبية'}[ms]||ms : ms
        return <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:msColor+'20', color:msColor }}>{msLabel}</span>
      }
      case 'phone':            return <span style={{ color:'var(--text2)' }}>{a.phone || '—'}</span>
      case 'email':            return <span style={{ color:'var(--text2)', fontSize:12, wordBreak:'break-all' }}>{a.email || '—'}</span>
      case 'join_date':        return <span style={{ color:'var(--text2)' }}>{a.join_date || '—'}</span>
      case 'passport_number':  return <span style={{ color:'var(--text2)', fontFamily:'monospace', fontSize:12 }}>{a.passport_number || '—'}</span>
      case 'passport_expiry':  return <span style={{ color: expired(a.passport_expiry) ? '#dc2626' : 'var(--text2)' }}>{a.passport_expiry || '—'}{expired(a.passport_expiry) && <span style={{ marginLeft:4, fontSize:10, color:'#dc2626' }}>⚠</span>}</span>
      case 'id_number':        return <span style={{ color:'var(--text2)', fontFamily:'monospace', fontSize:12 }}>{a.id_number || '—'}</span>
      case 'id_expiry':        return <span style={{ color: expired(a.id_expiry) ? '#dc2626' : 'var(--text2)' }}>{a.id_expiry || '—'}{expired(a.id_expiry) && <span style={{ marginLeft:4, fontSize:10, color:'#dc2626' }}>⚠</span>}</span>
      case 'blood_type':       return <span style={{ color:'var(--text2)' }}>{a.blood_type || '—'}</span>
      case 'emergency_contact_name':  return <span style={{ color:'var(--text2)' }}>{a.emergency_contact_name || '—'}</span>
      case 'emergency_contact_phone': return <span style={{ color:'var(--text2)' }}>{a.emergency_contact_phone || '—'}</span>
      case 'medals':           return <MedalDisplay gold={a.medals_gold} silver={a.medals_silver} bronze={a.medals_bronze} />
      case 'docs':             return docCount > 0 ? <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#0085C7', fontWeight:500 }}><i className="ti ti-files" style={{ fontSize:14 }} />{docCount}</span> : <span style={{ fontSize:12, color:'var(--text3)' }}>—</span>
      default: return '—'
    }
  }

  // Render editable cell in edit mode
  function renderEditCell(a, key) {
    switch(key) {
      case 'name':         return <input style={{ ...inlineInput, minWidth:140 }} value={getVal(a,'name')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'name',e.target.value)} />
      case 'name_ar':      return <input style={{ ...inlineInput, direction:'rtl' }} value={getVal(a,'name_ar')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'name_ar',e.target.value)} />
      case 'sport_category': return <select style={inlineSelect} value={getVal(a,'sport_category')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'sport_category',e.target.value)}>
          <option value="">{tx('athletes.selectCategory','Select category')}</option>
          {SPORT_CATEGORIES.map(c => <option key={c} value={c}>{lang==='ar' ? (SPORT_CATEGORY_NAMES_AR[c]||c) : c}</option>)}
        </select>
      case 'sport':        return <select style={inlineSelect} value={getVal(a,'sport')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'sport',e.target.value)}>
          <option value="">{tx('athletes.selectSport','Select sport')}</option>
          {(SPORTS_BY_CATEGORY[getVal(a,'sport_category')] || SPORTS).map(s=><option key={s} value={s}>{lang==='ar' ? (SPORT_NAMES_AR[s]||s) : s}</option>)}
        </select>
      case 'classification': return <input style={{ ...inlineInput, width:100 }} value={getVal(a,'classification')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'classification',e.target.value)} />
      case 'disability':   return <input style={inlineInput} value={getVal(a,'disability')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'disability',e.target.value)} />
      case 'nationality':  return <input style={{ ...inlineInput, width:100 }} value={getVal(a,'nationality')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'nationality',e.target.value)} />
      case 'gender':       return <select style={inlineSelect} value={getVal(a,'gender')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'gender',e.target.value)}>{['','Male','Female'].map(s=><option key={s} value={s}>{s||'—'}</option>)}</select>
      case 'dob':          return <input style={inlineInput} type="date" value={getVal(a,'dob')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'dob',e.target.value)} />
      case 'age_category': return <input style={inlineInput} value={getVal(a,'age_category')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'age_category',e.target.value)} />
      case 'coach_id':     return <select style={inlineSelect} value={getVal(a,'coach_id')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'coach_id',e.target.value?parseInt(e.target.value):null)}><option value="">Unassigned</option>{coaches.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      case 'status':       return <select style={inlineSelect} value={getVal(a,'status')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'status',e.target.value)}>{['','Active','Inactive','Suspended','Under Medical Review','Injured','Retired'].map(s=><option key={s} value={s}>{s||'— None —'}</option>)}</select>
      case 'medical_status': return <input style={inlineInput} value={getVal(a,'medical_status')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'medical_status',e.target.value)} />
      case 'phone':        return <input style={inlineInput} value={getVal(a,'phone')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'phone',e.target.value)} />
      case 'email':        return <input style={inlineInput} type="email" value={getVal(a,'email')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'email',e.target.value)} />
      case 'join_date':    return <input style={inlineInput} type="date" value={getVal(a,'join_date')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'join_date',e.target.value)} />
      case 'passport_number': return <input style={inlineInput} value={getVal(a,'passport_number')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'passport_number',e.target.value)} />
      case 'passport_expiry': return <input style={inlineInput} type="date" value={getVal(a,'passport_expiry')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'passport_expiry',e.target.value)} />
      case 'id_number':    return <input style={inlineInput} value={getVal(a,'id_number')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'id_number',e.target.value)} />
      case 'id_expiry':    return <input style={inlineInput} type="date" value={getVal(a,'id_expiry')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'id_expiry',e.target.value)} />
      case 'blood_type':   return <select style={inlineSelect} value={getVal(a,'blood_type')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'blood_type',e.target.value)}>{['','A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'].map(s=><option key={s} value={s}>{s||'—'}</option>)}</select>
      case 'qss_number':   return <input style={inlineInput} value={getVal(a,'qss_number')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'qss_number',e.target.value)} />
      case 'career_profile': return <input style={inlineInput} value={getVal(a,'career_profile')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'career_profile',e.target.value)} />
      case 'emergency_contact_name':  return <input style={inlineInput} value={getVal(a,'emergency_contact_name')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'emergency_contact_name',e.target.value)} />
      case 'emergency_contact_phone': return <input style={inlineInput} value={getVal(a,'emergency_contact_phone')||''} onClick={e=>e.stopPropagation()} onChange={e=>setEdit(a.id,'emergency_contact_phone',e.target.value)} />
      // read-only in edit mode
      case 'medals': return renderCell(a, key)
      case 'docs':   return renderCell(a, key)
      default:       return renderCell(a, key)
    }
  }

  return (
    <div>
      {form && <FormModal type="athlete" record={null} coaches={coaches} onSave={handleSave} onClose={() => setForm(null)} />}

      <div className="page-header">
        <div><div className="page-title">{tx('pages.athletes','Athletes')}</div><div className="page-sub">{list.length} of {athletes.length} {tx('pages.athletes','athletes')}</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {!editMode && (
            <button className="btn" style={{ background:'#009F6B' }} onClick={() => exportExcel(list, coaches, documents||[], visibleCols, ALL_COLS, lang)}>
              <i className="ti ti-table-export" /> {tx('actions.exportExcel','Export Excel')}
            </button>
          )}

          {/* COLUMN PICKER */}
          {!editMode && (
            <div style={{ position:'relative' }}>
              <button className="action-btn action-btn-edit" style={{ padding:'8px 14px', fontSize:13 }} onClick={() => setColPickerOpen(o => !o)}>
                <i className="ti ti-columns" /> {lang==='ar' ? 'أعمدة' : 'Columns'} {visibleCols.length !== ALL_COLS.length && `(${visibleCols.length})`}
              </button>
              {colPickerOpen && (
                <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 4px', zIndex:200, boxShadow:'0 8px 24px rgba(0,0,0,.12)', minWidth:200, maxHeight:420, overflowY:'auto' }}
                  onMouseLeave={() => setColPickerOpen(false)}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', padding:'0 12px 8px' }}>{tx('actions.columns','Show / hide columns')}</div>
                  {ALL_COLS.map(col => (
                    <label key={col.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', cursor:col.key==='name'?'not-allowed':'pointer', borderRadius:8, transition:'background .1s' }}
                      onMouseEnter={e => { if(col.key!=='name') e.currentTarget.style.background='var(--surface2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background='' }}>
                      <input type="checkbox" checked={isVisible(col.key)} disabled={col.key==='name'} onChange={() => toggleCol(col.key)}
                        style={{ width:14, height:14, cursor:col.key==='name'?'not-allowed':'pointer', accentColor:'#0085C7' }} />
                      <span style={{ fontSize:13, color:col.key==='name'?'var(--text3)':'var(--text)' }}>{col.label}</span>
                      {col.key==='name' && <span style={{ fontSize:10, color:'var(--text3)', marginLeft:'auto' }}>{tx('filters.always','always')}</span>}
                    </label>
                  ))}
                  <div style={{ padding:'8px 12px 0', borderTop:'1px solid var(--border)', marginTop:4, display:'flex', gap:6, flexWrap:'wrap' }}>
                    <button onClick={() => setVisibleCols(ALL_COLS.map(c=>c.key))} style={{ flex:1, padding:'5px', fontSize:11, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', color:'var(--text2)' }}>{tx('filters.all','All')}</button>
                    <button onClick={() => setVisibleCols(ALL_COLS.filter(c=>c.default).map(c=>c.key))} style={{ flex:1, padding:'5px', fontSize:11, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', color:'var(--text2)' }}>{tx('filters.default','Default')}</button>
                    <button onClick={() => setVisibleCols(['name'])} style={{ flex:1, padding:'5px', fontSize:11, background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:7, cursor:'pointer', color:'#dc2626' }}>{tx('filters.none','None')}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {canEdit(profile) && !editMode && (
            <button className="action-btn action-btn-edit" style={{ padding:'8px 14px', fontSize:13 }} onClick={startEdit}>
              <i className="ti ti-table-options" /> {tx('actions.editList','Edit list')}
            </button>
          )}
          {editMode && (
            <>
              <button className="btn-cancel" onClick={cancelEdit} style={{ padding:'8px 14px' }}>Cancel</button>
              <button className="btn btn-blue" onClick={saveAllEdits} disabled={savingAll}>
                {savingAll
                  ? <><div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> Saving…</>
                  : <><i className="ti ti-device-floppy" /> Save {changedCount > 0 ? `${changedCount} change${changedCount>1?'s':''}` : 'all'}</>
                }
              </button>
            </>
          )}
          {canEdit(profile) && !editMode && (
            <button className="btn btn-blue" onClick={() => setForm('new')}><i className="ti ti-plus" /> {tx('athletes.addAthlete','Add athlete')}</button>
          )}
        </div>
      </div>

      {editMode && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#e8f3fb', border:'1px solid #bdd8f0', borderRadius:10, marginBottom:14, fontSize:13 }}>
          <i className="ti ti-pencil" style={{ color:'#0085C7', fontSize:16 }} />
          <span style={{ color:'#1565a0' }}><strong>{tx('athletes.editMode','Edit mode on')}</strong> — {tx('athletes.editModeDesc','click any cell to edit.')}</span>
          {changedCount > 0 && <span style={{ marginLeft:'auto', background:'#0085C7', color:'#fff', padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:600 }}>{changedCount} unsaved change{changedCount>1?'s':''}</span>}
        </div>
      )}

      <div className="filters">
        <div className="search-wrap"><i className="ti ti-search" /><input placeholder={tx('athletes.searchAthletes','Search by name, sport…')} value={search} onChange={e => setSearch(e.target.value)} /></div>
        {hasActiveFilters && (
          <button onClick={resetFilters}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:9, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer', fontFamily:'DM Sans, sans-serif', whiteSpace:'nowrap' }}>
            <i className="ti ti-x" style={{ fontSize:13 }} /> {tx('actions.resetFilters','Reset filters')}
          </button>
        )}
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              {ALL_COLS.filter(c => isVisible(c.key)).map(c => {
                const isSortable = ['name','name_ar','sport_category','sport','classification','nationality','status','dob','join_date','age_category','disability','coach_id','gender','blood_type'].includes(c.key)
                const isAsc  = sort === `${c.key}-asc`
                const isDesc = sort === `${c.key}-desc`
                const active = isAsc || isDesc
                return (
                  <th key={c.key}
                    onClick={() => isSortable && (isAsc ? setSort(`${c.key}-desc`) : setSort(`${c.key}-asc`))}
                    style={{ cursor: isSortable ? 'pointer' : 'default', userSelect:'none', whiteSpace:'nowrap' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      {c.label}
                      {isSortable && (
                        <span style={{ fontSize:9, color: active ? '#0085C7' : '#ccc' }}>
                          {isAsc ? '▲' : isDesc ? '▼' : '▲▼'}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
              {!editMode && <th />}
              {editMode && <th style={{ color:'#0085C7' }}>Changed</th>}
            </tr>
            {/* INLINE FILTER ROW */}
            {!editMode && (
              <tr style={{ background:'#f8f9fb' }}>
                {ALL_COLS.filter(col => isVisible(col.key)).map(col => {
                  const filterOpts = {
                    sport_category: ['All', ...SPORT_CATEGORIES],
                    sport:          sports.filter(s => s !== 'All sports').length ? ['All', ...sports.filter(s => s !== 'All sports')] : ['All'],
                    status:         ['All','Active','Inactive','Suspended','Under Medical Review','Injured','Retired'],
                    gender:         ['All','Male','Female'],
                    nationality:    ['All', ...['Afghanistan', 'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Belarus', 'Belgium', 'Brazil', 'Cameroon', 'Canada', 'Chile', 'China', 'Colombia', 'Croatia', 'Czech Republic', 'Denmark', 'Egypt', 'Eritrea', 'Ethiopia', 'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Guinea', 'Hungary', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Kyrgyzstan', 'Lebanon', 'Libya', 'Malaysia', 'Mali', 'Mauritania', 'Mexico', 'Mongolia', 'Morocco', 'Myanmar', 'Nepal', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Palestine', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saudi Arabia', 'Scotland', 'Senegal', 'Serbia', 'Singapore', 'Slovakia', 'Somalia', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sudan', 'Sweden', 'Syria', 'Tajikistan', 'Tanzania', 'Thailand', 'Tunisia', 'Turkey', 'Turkmenistan', 'UAE', 'Uganda', 'UK', 'Ukraine', 'USA', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Wales', 'Yemen', 'Zambia', 'Zimbabwe']],
                    coach_id:       ['All', ...coaches.map(co => co.name)],
                    disability:     ['All', ...new Set(athletes.map(a => a.disability).filter(Boolean))],
                    age_category:   ['All', ...new Set(athletes.map(a => a.age_category).filter(Boolean))],
                    medical_status: ['All', 'None', 'Screening', 'Medical Certificate'],
                  }
                  const opts = filterOpts[col.key]
                  if (!opts) return <th key={col.key} />
                  const filterKey = col.key === 'coach_id' ? 'coachName' : col.key
                  const filterVal = col.key === 'coach_id'
                    ? (colFilters.coachName || 'All')
                    : (colFilters[col.key] || 'All')
                  return (
                    <th key={col.key} style={{ padding:'4px 8px' }}>
                      <select
                        value={filterVal}
                        onChange={e => {
                          const val = e.target.value
                          if (col.key === 'coach_id') {
                            setColFilters(f => ({ ...f, coachName: val }))
                          } else {
                            setColFilters(f => ({ ...f, [col.key]: val }))
                          }
                        }}
                        style={{ fontSize:11, border:'1px solid var(--border)', borderRadius:6, padding:'3px 4px', background:'var(--surface)', color: filterVal !== 'All' ? '#0085C7' : 'var(--text3)', cursor:'pointer', outline:'none', fontWeight: filterVal !== 'All' ? 600 : 400, maxWidth:120 }}>
                        {opts.map(o => {
                          const allLabel = lang==='ar' ? 'الكل' : 'All'
                          const LABELS = {
                            sport:       { 'All':allLabel, ...Object.fromEntries(Object.entries(SPORT_NAMES)) },
                            status:      { 'All':allLabel, 'Active':tx('status.active','Active'), 'Inactive':tx('status.inactive','Inactive'), 'Suspended':tx('status.suspended','Suspended'), 'Under Medical Review':tx('status.underMedicalReview','Under Medical Review'), 'Injured':tx('status.injured','Injured'), 'Retired':tx('status.retired','Retired') },
                            gender:      { 'All':allLabel, 'Male':tx('form.male','Male'), 'Female':tx('form.female','Female') },
                            nationality: { 'All':allLabel, ...Object.fromEntries(['Afghanistan','Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Brazil','Cameroon','Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt','Eritrea','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Guinea','Hungary','India','Indonesia','Iran','Iraq','Ireland','Italy','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Lebanon','Libya','Malaysia','Mali','Mauritania','Mexico','Mongolia','Morocco','Myanmar','Nepal','Netherlands','New Zealand','Nigeria','Norway','Oman','Pakistan','Palestine','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Scotland','Senegal','Serbia','Singapore','Slovakia','Somalia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden','Syria','Tajikistan','Tanzania','Thailand','Tunisia','Turkey','Turkmenistan','UAE','Uganda','UK','Ukraine','USA','Uzbekistan','Venezuela','Vietnam','Wales','Yemen','Zambia','Zimbabwe'].map(n => [n, tc(n)])) },
                            disability:  { 'All':allLabel, ...Object.fromEntries(athletes.map(a=>a.disability).filter(Boolean).map(d=>[d, lang==='ar' ? (tDis(d)||d) : d])) },
                            coach_id:    { 'All':allLabel, ...Object.fromEntries(coaches.map(co => [co.name, lang==='ar' && co.name_ar ? co.name_ar : co.name])) },
                            sport_category: { 'All':allLabel, ...Object.fromEntries(SPORT_CATEGORIES.map(c => [c, lang==='ar' ? (SPORT_CATEGORY_NAMES_AR[c]||c) : c])) },
                            age_category:{ 'All':allLabel },
                          }
                          return <option key={o} value={o}>{LABELS[col.key]?.[o] || o}</option>
                        })}
                      </select>
                    </th>
                  )
                })}
                <th />
              </tr>
            )}
          </thead>
          <tbody>
            {list.map(a => {
              const isChanged = !!edits[a.id]
              const cols = ALL_COLS.filter(c => isVisible(c.key))
              return (
                <tr key={a.id} onClick={() => !editMode && setSelected(a.id)}
                  style={{ cursor:editMode?'default':'pointer', background:isChanged?'#f0f7ff':'' }}>
                  {cols.map(c => (
                    <td key={c.key}>
                      {editMode ? renderEditCell(a, c.key) : renderCell(a, c.key)}
                    </td>
                  ))}
                  {!editMode && <td><i className="ti ti-chevron-right" style={{ color:'#ccc', fontSize:16 }} /></td>}
                  {editMode && (
                    <td>{isChanged
                      ? <span style={{ display:'flex', alignItems:'center', gap:4, color:'#0085C7', fontSize:12, fontWeight:500 }}><i className="ti ti-check" style={{ fontSize:14 }} />{tx('athletes.modified','Modified')}</span>
                      : <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>
                    }</td>
                  )}
                </tr>
              )
            })}
            {(() => {
              const cols = ALL_COLS.filter(c => isVisible(c.key))
              return list.length === 0 && <tr><td colSpan={cols.length + 1}><div className="empty">{tx('athletes.noAthletesMatch','No athletes match')}</div></td></tr>
            })()}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
