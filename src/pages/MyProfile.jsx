import { useState, useEffect } from 'react'
import { useLang } from '../lib/LangContext.jsx'
import { usePersonRoles, RoleBadges } from '../components/RoleBadges.jsx'
import { effectiveStatus, statusClass, Avatar, SPORT_NAMES_AR, SPORT_CATEGORY_NAMES_AR } from '../lib/helpers'
import { supabase } from '../lib/supabase'
import { classifyAthleteType, getAthleteDocumentRules, computeCompletion } from '../lib/documentEngine'

const STATUS_AR = {
  'Active':               'نشط',
  'Inactive':             'غير نشط',
  'On Leave':             'في إجازة',
  'In Competition':       'في منافسة',
  'In Training Camp':     'في معسكر تدريبي',
  'Injured':              'مصاب',
  'Under Medical Review': 'تحت المراقبة الطبية',
  'Suspended':            'موقوف',
  'Retired':              'متقاعد',
  'Pending':              'قيد الانتظار',
  'Approved':             'مقبول',
  'Rejected':             'مرفوض',
}

const DESIGNATION_AR = {
  'Coach':             'مدرب',
  'Assistant Coach':   'مدرب مساعد',
  'Technical Expert':  'خبير تقني',
  'Physiotherapist':   'معالج فيزيائي',
  'Doctor':            'طبيب',
  'Manager':           'مدير',
  'Director':          'مدير تنفيذي',
  'Administrator':     'إداري',
  'Secretary':         'أمين سر',
  'Coordinator':       'منسق',
}

// Real, combined "My Profile" — built from every CURRENT role linked to the
// logged-in person's person_id, not from profiles.role (the login/
// permission role) and not from whichever single role happened to match
// first. A person can genuinely hold more than one current role at once
// (e.g. Coach + Staff) — all of them are shown, each as its own card.
// Historical/inactive role records are surfaced only as a small "Former X"
// note, never as a current role or as the page's primary identity.
export default function MyProfile({ profile, athletes, coaches, employees, referees, onNav }) {
  const { lang, tx } = useLang()
  const ar = lang === 'ar'
  const personId = profile?.person_id

  const { roles, loading } = usePersonRoles(personId)

  // Current (non-historical) role records — the actual source of truth for
  // "what is this person right now", independent of profiles.role.
  const myAthlete  = athletes.find(a => a.person_id === personId && !a.is_historical)
  const myCoach    = coaches.find(c => c.person_id === personId && !c.is_historical)
  const myEmployee = employees.find(e => e.person_id === personId && !e.is_historical)
  const myReferee  = (referees || []).find(r => r.person_id === personId && !r.is_historical)

  // My Sports (athlete_sports) — every assigned sport with its category
  // (derived from the sport) and coach, for the Athlete role card below.
  const [mySports, setMySports] = useState([])
  useEffect(() => {
    if (!myAthlete?.id) { setMySports([]); return }
    supabase.from('athlete_sports')
      .select('id, sport_id, coach_id, sports(name, category), coaches(name, name_ar)')
      .eq('athlete_id', myAthlete.id)
      .then(({ data, error }) => { if (!error) setMySports(data || []) })
  }, [myAthlete?.id])

  // Historical/former matches — only used for the small "Former X" note,
  // and only shown when there's no CURRENT record of that same role.
  const myFormerCoach    = !myCoach    ? coaches.find(c => c.person_id === personId && c.is_historical) : null
  const myFormerEmployee = !myEmployee ? employees.find(e => e.person_id === personId && e.is_historical) : null

  const hasAnyCurrentRole = !!(myAthlete || myCoach || myEmployee || myReferee)

  const statusLabel = (record) => {
    const s = effectiveStatus(record)
    return ar ? (STATUS_AR[s] || s) : s
  }

  const sportLabel = (sport) => {
    if (!sport) return ''
    return ar ? (SPORT_NAMES_AR[sport] || sport) : sport
  }

  const nationalityLabel = (nat) => {
    if (!nat) return ''
    if (!ar) return nat
    return tx('countries.' + nat, nat)
  }

  const yearsOfServiceFrom = (dateStr) => {
    if (!dateStr) return null
    const start = new Date(dateStr)
    const now = new Date()
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    if (months < 12) return ar ? `${months} شهر` : `${months} mo`
    const y = Math.floor(months / 12), m = months % 12
    return m > 0 ? `${y}y ${m}mo` : (ar ? `${y} سنة` : `${y} yr${y!==1?'s':''}`)
  }

  // One combined Documents list — every CURRENT role linked to this
  // person_id contributes its documents into a single fetch/list,
  // deduplicated by file path so a shared document never appears twice.
  const [allDocs, setAllDocs] = useState([])
  const [docsLoaded, setDocsLoaded] = useState(false)
  useEffect(() => {
    if (!personId) { setAllDocs([]); setDocsLoaded(true); return }
    let cancelled = false
    setDocsLoaded(false)

    const queries = [
      supabase.from('person_shared_documents').select('*').eq('person_id', personId),
    ]
    if (myAthlete)  queries.push(supabase.from('athlete_documents').select('*').eq('athlete_id', myAthlete.id))
    if (myEmployee) queries.push(supabase.from('person_documents').select('*').eq('person_id', myEmployee.id).eq('person_type', 'employee'))
    if (myCoach)    queries.push(supabase.from('person_documents').select('*').eq('person_id', myCoach.id).eq('person_type', 'coach'))
    if (myReferee)  queries.push(supabase.from('referee_documents').select('*').eq('referee_id', myReferee.id))

    Promise.all(queries).then(results => {
      if (cancelled) return
      const merged = results.flatMap(r => r.data || [])
      const seen = new Set()
      const deduped = merged.filter(d => {
        const key = d.file_path || `${d.type}-${d.name}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      deduped.sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0))
      setAllDocs(deduped)
      setDocsLoaded(true)
    })
    return () => { cancelled = true }
  }, [personId, myAthlete?.id, myEmployee?.id, myCoach?.id, myReferee?.id])

  if (!personId) {
    return (
      <div className="empty" style={{ padding: 40, textAlign: 'center' }}>
        {ar ? 'لا يوجد سجل شخصي مرتبط بحسابك بعد.' : 'No linked person record for your account yet.'}
      </div>
    )
  }

  const displayName = ar && myEmployee?.name_ar ? myEmployee.name_ar
    : ar && myCoach?.name_ar ? myCoach.name_ar
    : ar && myAthlete?.name_ar ? myAthlete.name_ar
    : ar && myReferee?.name_ar ? myReferee.name_ar
    : (myEmployee || myCoach || myAthlete || myReferee)?.name || profile?.full_name

  const displayNameAlt = ar
    ? (myEmployee || myCoach || myAthlete || myReferee)?.name
    : (myEmployee?.name_ar || myCoach?.name_ar || myAthlete?.name_ar || myReferee?.name_ar)

  const photoUrl = myEmployee?.photo_url || myCoach?.photo_url || myAthlete?.photo_url || myReferee?.photo_url

  const nationality = (myEmployee || myCoach || myAthlete || myReferee)?.nationality
  const phone = myEmployee?.phone || myCoach?.phone || myAthlete?.phone
  const email = myEmployee?.email || myCoach?.email || myAthlete?.email || profile?.email

  // Current-role labels for the badge row — e.g. "Coach" + "Staff — Technical Expert".
  const roleBadgeLabels = [
    myCoach && (ar ? 'مدرب' : 'Coach'),
    myEmployee && (ar
      ? `الكادر${myEmployee.designation_ar || myEmployee.designation ? ' — ' + (myEmployee.designation_ar || DESIGNATION_AR[myEmployee.designation] || myEmployee.designation) : ''}`
      : `Staff${myEmployee.designation ? ' — ' + myEmployee.designation : ''}`),
    myAthlete && (ar ? 'رياضي' : 'Athlete'),
    myReferee && (ar ? 'حكم' : 'Referee'),
  ].filter(Boolean)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{ar ? 'ملفي الشخصي' : 'My Profile'}</div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-profile">
          {photoUrl
            ? <img src={photoUrl} alt={displayName} style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border)', margin: '0 auto 14px' }} />
            : <div style={{ width: 90, height: 90, margin: '0 auto 14px' }}><Avatar name={displayName || '?'} id={Math.abs([...String(personId||'')].reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0))} size={90} fs={26} /></div>
          }
          {hasAnyCurrentRole ? (
            <>
              <div className="detail-name">{displayName}</div>
              <div className="detail-sub">{displayNameAlt || ''}</div>
              {/* One badge per current role — a multi-role person (e.g.
                  Coach + Staff) shows every role here, never collapsed
                  into a single one. */}
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {roleBadgeLabels.map(label => (
                    <span key={label} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', background: 'var(--surface2)', padding: '2px 9px', borderRadius: 20 }}>{label}</span>
                  ))}
                </div>
                {(myFormerCoach || myFormerEmployee) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                    {myFormerCoach && <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{ar ? 'مدرب سابق' : 'Former Coach'}</span>}
                    {myFormerEmployee && <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{ar ? 'كادر سابق' : 'Former Staff'}</span>}
                  </div>
                )}
              </div>
              <div className="detail-fields" style={{ marginTop: 10 }}>
                {[
                  [ar ? 'الجنسية' : 'Nationality', nationalityLabel(nationality)],
                  [ar ? 'الهاتف' : 'Phone', phone],
                  [ar ? 'البريد الإلكتروني' : 'Email', email],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv" style={{ fontSize: 12 }}>{v}</span></div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="detail-name">{displayName}</div>
              {!loading && <RoleBadges roles={roles} lang={lang} />}
              {(myFormerCoach || myFormerEmployee) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 6 }}>
                  {myFormerCoach && <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{ar ? 'مدرب سابق' : 'Former Coach'}</span>}
                  {myFormerEmployee && <span style={{ fontSize: 10.5, color: 'var(--text3)' }}>{ar ? 'كادر سابق' : 'Former Staff'}</span>}
                </div>
              )}
              <div className="detail-fields">
                {[
                  [ar ? 'الجنسية' : 'Nationality', nationalityLabel(nationality)],
                  [ar ? 'الهاتف' : 'Phone', phone],
                  [ar ? 'البريد الإلكتروني' : 'Email', email],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv" style={{ fontSize: 12 }}>{v}</span></div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── IDENTITY INFORMATION — shown once only, regardless of how
              many roles this person currently holds. Shared personal/
              identity fields (DOB, Qatar ID, expiries, gender, nationality)
              are never repeated per-role below. */}
          {(() => {
            const isExpired = d => d && new Date(d) < new Date()
            // First non-null value per field, checked in a fixed priority
            // order across every current role record for this person.
            const pick = (field) => myEmployee?.[field] ?? myCoach?.[field] ?? myAthlete?.[field] ?? myReferee?.[field] ?? null
            const idFields = [
              [ar ? 'تاريخ الميلاد' : 'Date of birth', pick('dob')],
              [ar ? 'الرقم الشخصي' : 'Qatar ID Number', pick('id_number')],
              [ar ? 'تاريخ انتهاء الهوية' : 'ID expiry', pick('id_expiry')],
              [ar ? 'رقم جواز السفر' : 'Passport number', pick('passport_number')],
              [ar ? 'تاريخ انتهاء الجواز' : 'Passport expiry', pick('passport_expiry')],
              [ar ? 'الجنس' : 'Gender', (() => { const g = pick('gender'); return g ? (ar ? (g==='Male'?'ذكر':'أنثى') : g) : null })()],
              [ar ? 'الجنسية' : 'Nationality', nationalityLabel(pick('nationality'))],
            ].filter(([, v]) => v)
            if (idFields.length === 0) return null
            return (
              <div className="info-card">
                <div className="info-title" style={{ marginBottom: 10 }}>{ar ? 'معلومات الهوية' : 'Identity Information'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 16px' }}>
                  {idFields.map(([k, v]) => (
                    <div key={k} className="detail-row" style={{ minWidth: 0 }}>
                      <span className="dk">{k}</span>
                      <span className="dv" style={{ color: k.toLowerCase().includes('expiry') && isExpired(v) ? '#dc2626' : undefined }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* ── COACH — only rendered if this person currently holds a
              non-historical coach record. ── */}
          {myCoach && (
            <>
              {(() => {
                const yearsOfService = yearsOfServiceFrom(myCoach.since)
                const statusDates = (myCoach.status_start || myCoach.status_end) && !(myCoach.status_end && new Date(myCoach.status_end) < new Date(new Date().toDateString()))
                  ? [myCoach.status_start, myCoach.status_end].filter(Boolean).join(' → ') : null
                const infoFields = [
                  [ar ? 'المسمى الوظيفي' : 'Designation', ar ? (DESIGNATION_AR[myCoach.designation] || myCoach.designation) : myCoach.designation],
                  [ar ? 'رقم الكادر' : 'Staff Number', myCoach.employee_number],
                  [ar ? 'رقم QSS' : 'QSS #', myCoach.qss_number],
                  [ar ? 'الرياضة' : 'Sport', sportLabel(myCoach.sport)],
                  [ar ? 'فئة الرياضة' : 'Sport category', myCoach.sport_category ? (ar ? (SPORT_CATEGORY_NAMES_AR[myCoach.sport_category]||myCoach.sport_category) : myCoach.sport_category) : null],
                  [ar ? 'تاريخ الانضمام' : 'Join date', myCoach.since || null],
                  [ar ? 'سنوات الخدمة' : 'Years of Service', yearsOfService],
                  [ar ? 'الحالة' : 'Status', statusLabel(myCoach)],
                  [ar ? 'تواريخ الحالة' : 'Status dates', statusDates],
                ].filter(([, v]) => v)
                return (
                  <div className="info-card">
                    <div className="info-title" style={{ marginBottom: 10 }}>{ar ? 'معلومات المدرب' : 'Coach Information'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 16px' }}>
                      {infoFields.map(([k, v]) => (
                        <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <button onClick={() => onNav('coaches', { coachId: myCoach.id })}
                className="info-card"
                style={{ textAlign: ar ? 'right' : 'left', cursor: 'pointer', background: 'none', border: '1px solid var(--border)', fontSize: 12, color: '#0085C7', padding: '10px 14px', fontFamily: 'DM Sans, sans-serif' }}>
                {ar ? 'عرض ملف المدرب الكامل ←' : 'View full coach profile →'}
              </button>
            </>
          )}

          {/* ── STAFF — only rendered if this person currently holds a
              non-historical employee record. Shown alongside Coach above
              when both are current, never instead of it. ── */}
          {myEmployee && (
            <>
              {(() => {
                const yearsOfService = yearsOfServiceFrom(myEmployee.join_date)
                const infoFields = [
                  [ar ? 'المسمى الوظيفي' : 'Designation', ar ? (myEmployee.designation_ar || DESIGNATION_AR[myEmployee.designation] || myEmployee.designation) : myEmployee.designation],
                  [ar ? 'رقم الكادر' : 'Staff Number', myEmployee.employee_number],
                  [ar ? 'رقم QSS' : 'QSS #', myEmployee.qss_number],
                  [ar ? 'تاريخ الانضمام' : 'Join date', myEmployee.join_date || null],
                  [ar ? 'سنوات الخدمة' : 'Years of Service', yearsOfService],
                  [ar ? 'الحالة' : 'Status', statusLabel(myEmployee)],
                ].filter(([, v]) => v)
                return (
                  <div className="info-card">
                    <div className="info-title" style={{ marginBottom: 10 }}>{ar ? 'معلومات الكادر' : 'Staff Information'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 16px' }}>
                      {infoFields.map(([k, v]) => (
                        <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {!myCoach && (
                <button onClick={() => onNav('employees', { employeeId: myEmployee.id })}
                  className="info-card"
                  style={{ textAlign: ar ? 'right' : 'left', cursor: 'pointer', background: 'none', border: '1px solid var(--border)', fontSize: 12, color: '#0085C7', padding: '10px 14px', fontFamily: 'DM Sans, sans-serif' }}>
                  {ar ? 'عرض ملف الكادر الكامل ←' : 'View full staff profile →'}
                </button>
              )}
            </>
          )}

          {/* ── ATHLETE ── */}
          {myAthlete && (
            <>
              {(() => {
                const statusDates = (myAthlete.status_start || myAthlete.status_end) && !(myAthlete.status_end && new Date(myAthlete.status_end) < new Date(new Date().toDateString()))
                  ? [myAthlete.status_start, myAthlete.status_end].filter(Boolean).join(' → ') : null
                const age = myAthlete.dob ? Math.floor((Date.now() - new Date(myAthlete.dob)) / (365.25*24*3600*1000)) : null
                const infoFields = [
                  [ar ? 'العمر' : 'Age', age],
                  [ar ? 'رقم QSS' : 'QSS #', myAthlete.qss_number],
                  [ar ? 'تاريخ الانضمام إلى QPC' : 'QPC Join Date', myAthlete.join_date || null],
                  [ar ? 'التصنيف' : 'Classification', myAthlete.classification],
                  [ar ? 'الإعاقة' : 'Disability', myAthlete.disability],
                  [ar ? 'الحالة' : 'Status', statusLabel(myAthlete)],
                  [ar ? 'تواريخ الحالة' : 'Status dates', statusDates],
                ].filter(([, v]) => v)
                return (
                  <div className="info-card">
                    <div className="info-title" style={{ marginBottom: 10 }}>{ar ? 'معلومات الرياضي' : 'Athlete Information'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 16px' }}>
                      {infoFields.map(([k, v]) => (
                        <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* My Sports — athlete_sports is the sole source of truth for
                  sport/coach assignments; every assigned sport shown, with
                  its category (derived from the sport) and coach(es). */}
              <div className="info-card">
                <div className="info-title" style={{ marginBottom: 10 }}>{ar ? 'رياضاتي' : 'My Sports'} ({mySports.length})</div>
                {mySports.map(row => (
                  <div key={row.id} className="detail-row">
                    <span className="dk">{row.sports?.name || '—'} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({row.sports?.category || '—'})</span></span>
                    <span className="dv">
                      {row.coach_id ? (ar && row.coaches?.name_ar ? row.coaches.name_ar : (row.coaches?.name || '—')) : (ar ? 'بدون مدرب' : 'No coach')}
                    </span>
                  </div>
                ))}
                {mySports.length === 0 && <div className="empty" style={{ padding: '8px 0', fontSize: 12 }}>{ar ? 'لا توجد رياضات معينة' : 'No sports assigned'}</div>}
              </div>

              <button onClick={() => onNav('athletes', { athleteId: myAthlete.id })}
                className="info-card"
                style={{ textAlign: ar ? 'right' : 'left', cursor: 'pointer', background: 'none', border: '1px solid var(--border)', fontSize: 12, color: '#0085C7', padding: '10px 14px', fontFamily: 'DM Sans, sans-serif' }}>
                {ar ? 'عرض الملف الكامل للرياضي ←' : 'View full athlete profile →'}
              </button>
            </>
          )}

          {/* ── REFEREE ── */}
          {myReferee && (
            <div className="info-card">
              <div className="info-title" style={{ marginBottom: 10 }}>{ar ? 'قسم الحكم' : 'Referee'}</div>
              <button onClick={() => onNav('referees', { refereeId: myReferee.id })} style={{ fontSize: 12, color: '#0085C7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {ar ? 'عرض التفاصيل الكاملة ←' : 'View full details →'}
              </button>
            </div>
          )}

          <div className="info-card">
            <div className="info-title" style={{ marginBottom: 10 }}>
              {ar ? 'الوثائق' : 'Documents'} <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--text3)', textTransform: 'none', letterSpacing: 0 }}>{allDocs.length} {ar ? 'ملف' : `file${allDocs.length !== 1 ? 's' : ''}`}</span>
              {myAthlete && (() => {
                const athleteType = classifyAthleteType(myAthlete)
                const hasMissionPassport = allDocs.some(d => d.type === 'Mission Passport')
                const rules = getAthleteDocumentRules(athleteType, hasMissionPassport)
                const completion = computeCompletion(allDocs, rules)
                if (!completion) return null
                const isComplete = completion.key === 'complete'
                return (
                  <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: isComplete ? '#009F6B18' : '#f59e0b18', color: isComplete ? '#009F6B' : '#f59e0b' }}>
                    {isComplete ? (ar ? 'مكتمل' : 'Complete') : (ar ? `${completion.missing} ناقص` : `${completion.missing} missing`)}
                  </span>
                )
              })()}
            </div>
            {!docsLoaded ? (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{ar ? 'جارٍ التحميل…' : 'Loading…'}</div>
            ) : allDocs.length === 0 ? (
              <div className="empty" style={{ padding: '8px 0', fontSize: 12 }}>{ar ? 'لا توجد وثائق.' : 'No documents.'}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {allDocs.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <i className="ti ti-file-text" style={{ fontSize: 14, color: '#0085C7' }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{doc.type}</div>
                      </div>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text2)' }}>
                      <i className="ti ti-download" style={{ fontSize: 12 }} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
