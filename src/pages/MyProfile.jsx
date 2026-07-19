import { useState, useEffect } from 'react'
import { useLang } from '../lib/LangContext.jsx'
import { usePersonRoles, RoleBadges } from '../components/RoleBadges.jsx'
import { effectiveStatus, statusClass, Avatar } from '../lib/helpers'
import { supabase } from '../lib/supabase'

// Real, combined "My Profile" — one page showing every role linked to the
// logged-in person's person_id, instead of routing to whichever single
// role page happened to match first. Falls back gracefully (renders
// nothing extra) for anyone without a person_id yet (pre-migration data).
export default function MyProfile({ profile, athletes, coaches, employees, referees, onNav }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const personId = profile?.person_id

  const { roles, loading } = usePersonRoles(personId)

  const myAthlete  = athletes.find(a => a.person_id === personId)
  const myCoach    = coaches.find(c => c.person_id === personId)
  const myEmployee = employees.find(e => e.person_id === personId)
  const myReferee  = (referees || []).find(r => r.person_id === personId)

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
      // Dedupe by file_path (the actual underlying file) — a shared
      // document can legitimately be referenced once from
      // person_shared_documents; nothing else points at the same path.
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
          <div className="detail-name">{displayName}</div>
          {!loading && <RoleBadges roles={roles} lang={lang} />}
          <div className="detail-fields">
            {[
              [ar ? 'الجنسية' : 'Nationality', (myEmployee || myAthlete || myCoach || myReferee)?.nationality],
              [ar ? 'الهاتف' : 'Phone', myEmployee?.phone || myAthlete?.phone || myCoach?.phone],
              [ar ? 'البريد الإلكتروني' : 'Email', myEmployee?.email || myAthlete?.email || myCoach?.email || profile?.email],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv" style={{ fontSize: 12 }}>{v}</span></div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {myEmployee && (
            <div className="info-card">
              <div className="info-title" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{ar ? 'قسم الموظف' : 'Employee'}</span>
                <span className={`badge ${statusClass(effectiveStatus(myEmployee))}`} style={{ fontSize: 10.5 }}>{effectiveStatus(myEmployee)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 16px' }}>
                {[
                  [ar ? 'الوظيفة' : 'Designation', myEmployee.designation],
                  [ar ? 'رقم الموظف' : 'Employee #', myEmployee.employee_number],
                  [ar ? 'رقم QSS' : 'QSS #', myEmployee.qss_number],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
                ))}
              </div>
              <button onClick={() => onNav('employees', { employeeId: myEmployee.id })} style={{ marginTop: 10, fontSize: 12, color: '#0085C7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {ar ? 'عرض التفاصيل الكاملة ←' : 'View full details →'}
              </button>
            </div>
          )}

          {myAthlete && (
            <div className="info-card">
              <div className="info-title" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{ar ? 'قسم الرياضي' : 'Athlete'}</span>
                <span className={`badge ${statusClass(effectiveStatus(myAthlete))}`} style={{ fontSize: 10.5 }}>{effectiveStatus(myAthlete)}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 16px' }}>
                {[
                  [ar ? 'الرياضة' : 'Sport', myAthlete.sport],
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

          {myCoach && (
            <div className="info-card">
              <div className="info-title" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{ar ? 'قسم المدرب' : 'Coach'}{myCoach.is_historical ? (ar ? ' (سابق)' : ' (Former)') : ''}</span>
                {!myCoach.is_historical && <span className={`badge ${statusClass(effectiveStatus(myCoach))}`} style={{ fontSize: 10.5 }}>{effectiveStatus(myCoach)}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 16px' }}>
                {[[ar ? 'الرياضة' : 'Sport', myCoach.sport]].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv">{v}</span></div>
                ))}
              </div>
              <button onClick={() => onNav('coaches', { coachId: myCoach.id })} style={{ marginTop: 10, fontSize: 12, color: '#0085C7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
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

          {/* ONE combined Documents card — merges person_shared_documents
              with every linked role's own documents, deduplicated. No
              completion %/missing chips here (those stay on each role's
              own detail page). */}
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
