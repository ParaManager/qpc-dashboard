import { useState, useEffect } from 'react'
import { useLang } from '../lib/LangContext.jsx'
import { usePersonRoles, RoleBadges } from '../components/RoleBadges.jsx'
import { effectiveStatus, statusClass, Avatar, SPORT_NAMES_AR, SPORT_CATEGORY_NAMES_AR } from '../lib/helpers'
import { supabase } from '../lib/supabase'

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

// Real, combined "My Profile" — one page showing every role linked to the
// logged-in person's person_id, instead of routing to whichever single
// role page happened to match first. Falls back gracefully (renders
// nothing extra) for anyone without a person_id yet (pre-migration data).
export default function MyProfile({ profile, athletes, coaches, employees, referees, onNav }) {
  const { lang, tx } = useLang()
  const ar = lang === 'ar'
  const personId = profile?.person_id

  const { roles, loading } = usePersonRoles(personId)

  const myAthlete  = athletes.find(a => a.person_id === personId)
  const myCoach    = coaches.find(c => c.person_id === personId)
  const myEmployee = employees.find(e => e.person_id === personId)
  const myReferee  = (referees || []).find(r => r.person_id === personId)

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

  // One combined Documents list — every role linked to this person_id
  // contributes its documents into a single fetch/list, deduplicated by
  // file path so a shared document referenced from multiple places never
  // appears twice.
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
    : ar && myAthlete?.name_ar ? myAthlete.name_ar
    : ar && myCoach?.name_ar ? myCoach.name_ar
    : (myEmployee || myAthlete || myCoach || myReferee)?.name || profile?.full_name

  const photoUrl = myEmployee?.photo_url || myAthlete?.photo_url || myCoach?.photo_url || myReferee?.photo_url

  const nationality = (myEmployee || myAthlete || myCoach || myReferee)?.nationality

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
          {myCoach ? (
            <>
              <div className="detail-name">{ar && myCoach.name_ar ? myCoach.name_ar : myCoach.name}</div>
              <div className="detail-sub">{ar ? myCoach.name : (myCoach.name_ar || '')}</div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{ar ? 'مدرب' : 'Coach'}</span>
                <span className={`badge ${statusClass(effectiveStatus(myCoach))}`} style={{ fontSize: 10.5 }}>{statusLabel(myCoach)}</span>
              </div>
              <div className="detail-fields" style={{ marginTop: 10 }}>
                {[
                  [ar ? 'الرياضة' : 'Sport', sportLabel(myCoach.sport)],
                  [ar ? 'فئة الرياضة' : 'Sport category', myCoach.sport_category ? (ar ? (SPORT_CATEGORY_NAMES_AR[myCoach.sport_category]||myCoach.sport_category) : myCoach.sport_category) : null],
                  [ar ? 'الجنسية' : 'Nationality', nationalityLabel(myCoach.nationality)],
                  [ar ? 'الجنس' : 'Gender', myCoach.gender ? (ar ? (myCoach.gender==='Male'?'ذكر':'أنثى') : myCoach.gender) : null],
                  [ar ? 'الهاتف' : 'Phone', myCoach.phone || myEmployee?.phone],
                  [ar ? 'البريد الإلكتروني' : 'Email', myCoach.email || myEmployee?.email || profile?.email],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv" style={{ fontSize: 12 }}>{v}</span></div>
                ))}
              </div>
            </>
          ) : myEmployee ? (
            <>
              <div className="detail-name">{ar && myEmployee.name_ar ? myEmployee.name_ar : myEmployee.name}</div>
              <div className="detail-sub">{ar ? myEmployee.name : (myEmployee.name_ar || '')}</div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{ar ? 'عضو كادر' : 'Staff Member'}</span>
                <span className={`badge ${statusClass(effectiveStatus(myEmployee))}`} style={{ fontSize: 10.5 }}>{statusLabel(myEmployee)}</span>
              </div>
              <div className="detail-fields" style={{ marginTop: 10 }}>
                {[
                  [ar ? 'الجنسية' : 'Nationality', nationalityLabel(myEmployee.nationality)],
                  [ar ? 'الجنس' : 'Gender', myEmployee.gender ? (ar ? (myEmployee.gender==='Male'?'ذكر':'أنثى') : myEmployee.gender) : null],
                  [ar ? 'الهاتف' : 'Phone', myEmployee.phone],
                  [ar ? 'البريد الإلكتروني' : 'Email', myEmployee.email || profile?.email],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv" style={{ fontSize: 12 }}>{v}</span></div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="detail-name">{displayName}</div>
              {!loading && <RoleBadges roles={roles} lang={lang} />}
              <div className="detail-fields">
                {[
                  [ar ? 'الجنسية' : 'Nationality', nationalityLabel(nationality)],
                  [ar ? 'الهاتف' : 'Phone', myEmployee?.phone || myAthlete?.phone || myCoach?.phone],
                  [ar ? 'البريد الإلكتروني' : 'Email', myEmployee?.email || myAthlete?.email || myCoach?.email || profile?.email],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv" style={{ fontSize: 12 }}>{v}</span></div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {myCoach ? (
            <>
              {(() => {
                const yearsOfService = (() => {
                  const startDate = myEmployee?.created_at || myCoach.created_at
                  if (!startDate) return null
                  const start = new Date(startDate)
                  const now = new Date()
                  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
                  if (months < 12) return ar ? `${months} شهر` : `${months} mo`
                  const y = Math.floor(months / 12), m = months % 12
                  return m > 0 ? `${y}y ${m}mo` : (ar ? `${y} سنة` : `${y} yr${y!==1?'s':''}`)
                })()
                const statusDates = (myCoach.status_start || myCoach.status_end) && !(myCoach.status_end && new Date(myCoach.status_end) < new Date(new Date().toDateString()))
                  ? [myCoach.status_start, myCoach.status_end].filter(Boolean).join(' → ') : null
                const infoFields = [
                  [ar ? 'المسمى الوظيفي' : 'Designation', ar ? (DESIGNATION_AR[myCoach.designation || myEmployee?.designation] || myCoach.designation || myEmployee?.designation) : (myCoach.designation || myEmployee?.designation)],
                  [ar ? 'رقم الكادر' : 'Staff Number', myCoach.employee_number || myEmployee?.employee_number],
                  [ar ? 'رقم QSS' : 'QSS #', myCoach.qss_number || myEmployee?.qss_number],
                  [ar ? 'الرياضة' : 'Sport', sportLabel(myCoach.sport)],
                  [ar ? 'فئة الرياضة' : 'Sport category', myCoach.sport_category ? (ar ? (SPORT_CATEGORY_NAMES_AR[myCoach.sport_category]||myCoach.sport_category) : myCoach.sport_category) : null],
                  [ar ? 'تاريخ الانضمام' : 'Join date', myEmployee?.created_at ? new Date(myEmployee.created_at).toISOString().slice(0,10) : null],
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

              {(() => {
                const isExpired = d => d && new Date(d) < new Date()
                const idFields = [
                  [ar ? 'تاريخ الميلاد' : 'Date of birth', myEmployee?.dob],
                  [ar ? 'الرقم الشخصي / رقم الهوية' : 'Qatar ID / Residence #', myCoach.id_number || myEmployee?.id_number],
                  [ar ? 'تاريخ انتهاء الهوية' : 'ID expiry', myCoach.id_expiry || myEmployee?.id_expiry],
                  [ar ? 'رقم جواز السفر' : 'Passport number', myCoach.passport_number || myEmployee?.passport_number],
                  [ar ? 'تاريخ انتهاء الجواز' : 'Passport expiry', myCoach.passport_expiry || myEmployee?.passport_expiry],
                  [ar ? 'الجنسية' : 'Nationality', nationalityLabel(myCoach.nationality)],
                  [ar ? 'الجنس' : 'Gender', myCoach.gender ? (ar ? (myCoach.gender==='Male'?'ذكر':'أنثى') : myCoach.gender) : null],
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

              <button onClick={() => onNav('coaches', { coachId: myCoach.id })}
                className="info-card"
                style={{ textAlign: ar ? 'right' : 'left', cursor: 'pointer', background: 'none', border: '1px solid var(--border)', fontSize: 12, color: '#0085C7', padding: '10px 14px', fontFamily: 'DM Sans, sans-serif' }}>
                {ar ? 'عرض ملف المدرب الكامل ←' : 'View full coach profile →'}
              </button>
            </>
          ) : myEmployee ? (
            <>
              {(() => {
                const yearsOfService = (() => {
                  if (!myEmployee.created_at) return null
                  const start = new Date(myEmployee.created_at)
                  const now = new Date()
                  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
                  if (months < 12) return ar ? `${months} شهر` : `${months} mo`
                  const y = Math.floor(months / 12), m = months % 12
                  return m > 0 ? `${y}y ${m}mo` : (ar ? `${y} سنة` : `${y} yr${y!==1?'s':''}`)
                })()
                const infoFields = [
                  [ar ? 'المسمى الوظيفي' : 'Designation', ar ? (myEmployee.designation_ar || DESIGNATION_AR[myEmployee.designation] || myEmployee.designation) : myEmployee.designation],
                  [ar ? 'رقم الكادر' : 'Staff Number', myEmployee.employee_number],
                  [ar ? 'رقم QSS' : 'QSS #', myEmployee.qss_number],
                  [ar ? 'تاريخ الانضمام' : 'Join date', myEmployee.created_at ? new Date(myEmployee.created_at).toISOString().slice(0,10) : null],
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

              {(() => {
                const isExpired = d => d && new Date(d) < new Date()
                const idFields = [
                  [ar ? 'تاريخ الميلاد' : 'Date of birth', myEmployee.dob],
                  [ar ? 'الرقم الشخصي / رقم الهوية' : 'Qatar ID / Residence #', myEmployee.id_number],
                  [ar ? 'تاريخ انتهاء الهوية' : 'ID expiry', myEmployee.id_expiry],
                  [ar ? 'رقم جواز السفر' : 'Passport number', myEmployee.passport_number],
                  [ar ? 'تاريخ انتهاء الجواز' : 'Passport expiry', myEmployee.passport_expiry],
                  [ar ? 'الجنسية' : 'Nationality', nationalityLabel(myEmployee.nationality)],
                  [ar ? 'الجنس' : 'Gender', myEmployee.gender ? (ar ? (myEmployee.gender==='Male'?'ذكر':'أنثى') : myEmployee.gender) : null],
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
            </>
          ) : (
            <>

          {myAthlete && (
            <div className="info-card">
              <div className="info-title" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{ar ? 'قسم الرياضي' : 'Athlete'}</span>
                <span className={`badge ${statusClass(effectiveStatus(myAthlete))}`} style={{ fontSize: 10.5 }}>{statusLabel(myAthlete)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 16px' }}>
                {[
                  [ar ? 'الرياضة' : 'Sport', sportLabel(myAthlete.sport)],
                  [ar ? 'التصنيف' : 'Classification', myAthlete.classification],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
                ))}
              </div>
              <button onClick={() => onNav('athletes', { athleteId: myAthlete.id })} style={{ marginTop: 10, fontSize: 12, color: '#0085C7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {ar ? 'عرض التفاصيل الكاملة ←' : 'View full details →'}
              </button>
            </div>
          )}

          {myReferee && (
            <div className="info-card">
              <div className="info-title" style={{ marginBottom: 10 }}>{ar ? 'قسم الحكم' : 'Referee'}</div>
              <button onClick={() => onNav('referees', { refereeId: myReferee.id })} style={{ fontSize: 12, color: '#0085C7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {ar ? 'عرض التفاصيل الكاملة ←' : 'View full details →'}
              </button>
            </div>
          )}
            </>
          )}

          <div className="info-card">
            <div className="info-title" style={{ marginBottom: 10 }}>
              {ar ? 'الوثائق' : 'Documents'} <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--text3)', textTransform: 'none', letterSpacing: 0 }}>{allDocs.length} {ar ? 'ملف' : `file${allDocs.length !== 1 ? 's' : ''}`}</span>
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
