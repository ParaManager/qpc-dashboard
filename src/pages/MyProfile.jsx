import { useState, useEffect } from 'react'
import { useLang } from '../lib/LangContext.jsx'
import { usePersonRoles, RoleBadges } from '../components/RoleBadges.jsx'
import SharedDocuments from '../components/SharedDocuments.jsx'
import { effectiveStatus, statusClass, Avatar } from '../lib/helpers'
import { supabase } from '../lib/supabase'

// Compact read-only list of a person's role-specific documents (not the
// shared identity ones, which live in SharedDocuments). Only shown when at
// least one document actually exists — no empty-state clutter here since
// this is a secondary aggregation view, not the primary place to manage
// these documents (that stays on each role's own detail page).
// Types already promoted to person_shared_documents (Passport/QID/Photo
// equivalents) — excluded here so a document doesn't visually appear
// twice, once under Shared Documents and again under a role's own list.
const SHARED_TYPE_EQUIVALENTS = ['Original Passport', 'Qatar ID', 'Photo']

function RoleDocumentsList({ title, table, filterCol, filterVal, personType, lang }) {
  const ar = lang === 'ar'
  const [docs, setDocs] = useState([])
  useEffect(() => {
    let cancelled = false
    let q = supabase.from(table).select('*').eq(filterCol, filterVal)
    if (personType) q = q.eq('person_type', personType)
    q.order('uploaded_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) setDocs((data || []).filter(d => !SHARED_TYPE_EQUIVALENTS.includes(d.type))) })
    return () => { cancelled = true }
  }, [table, filterCol, filterVal, personType])

  if (docs.length === 0) return null
  return (
    <div className="info-card">
      <div className="info-title" style={{ marginBottom: 10 }}>
        {title} <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: 'var(--text3)', textTransform: 'none', letterSpacing: 0 }}>{docs.length} {ar ? 'ملف' : `file${docs.length !== 1 ? 's' : ''}`}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {docs.map(doc => (
          <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <i className="ti ti-file-text" style={{ fontSize: 14, color: '#0085C7' }} />
              <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
            </div>
            <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text2)' }}>
              <i className="ti ti-download" style={{ fontSize: 12 }} />
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

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
          <SharedDocuments personId={personId} profile={profile} />

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
          {myEmployee && (
            <RoleDocumentsList title={ar ? 'وثائق الموظف' : 'Employee Documents'} table="person_documents" filterCol="person_id" filterVal={myEmployee.id} personType="employee" lang={lang} />
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
          {myAthlete && (
            <RoleDocumentsList title={ar ? 'وثائق الرياضي' : 'Athlete Documents'} table="athlete_documents" filterCol="athlete_id" filterVal={myAthlete.id} lang={lang} />
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
          {myCoach && (
            <RoleDocumentsList title={ar ? 'وثائق المدرب' : 'Coach Documents'} table="person_documents" filterCol="person_id" filterVal={myCoach.id} personType="coach" lang={lang} />
          )}

          {myReferee && (
            <div className="info-card">
              <div className="info-title" style={{ marginBottom: 10 }}>{ar ? 'قسم الحكم' : 'Referee'}</div>
              <button onClick={() => onNav('referees', { refereeId: myReferee.id })} style={{ fontSize: 12, color: '#0085C7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {ar ? 'عرض التفاصيل الكاملة ←' : 'View full details →'}
              </button>
            </div>
          )}
          {myReferee && (
            <RoleDocumentsList title={ar ? 'وثائق الحكم' : 'Referee Documents'} table="referee_documents" filterCol="referee_id" filterVal={myReferee.id} lang={lang} />
          )}
        </div>
      </div>
    </div>
  )
}
