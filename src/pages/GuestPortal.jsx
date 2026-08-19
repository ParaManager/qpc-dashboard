import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { qpcLogo as QPC_LOGO } from '../lib/logos'
import { statusDot, statusClass, DashRow, SPORT_META, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, sportLabel, BackButton, SUPPORTED_DOC_FILE_TYPES } from '../lib/helpers'
import { computeEventStatus } from './Events'
import Calendar from './Calendar'
import Events from './Events'
import Sports from './Sports'

function getEventStatus(ev) {
  if (ev.approval_status === 'Rejected') return 'Canceled'
  if (ev.status === 'Canceled') return 'Canceled'
  return computeEventStatus(ev.start_date, ev.end_date, ev.deadline)
}

const GUEST_NAV = [
  { id: 'dashboard', icon: 'ti-layout-dashboard', en: 'Dashboard', ar: 'لوحة التحكم' },
  { id: 'calendar', icon: 'ti-calendar', en: 'Calendar', ar: 'التقويم' },
  { id: 'events', icon: 'ti-calendar-event', en: 'Events', ar: 'الفعاليات' },
  { id: 'sports', icon: 'ti-ball-football', en: 'Sports', ar: 'الرياضات' },
  { id: 'requests', icon: 'ti-clipboard-text', en: 'Requests', ar: 'الطلبات' },
  { id: 'about', icon: 'ti-info-circle', en: 'About QPC', ar: 'عن اللجنة' },
]

// Public-safe subset of data only — no confidential fields (documents,
// contact info, medical/identity data, internal notes, etc). This is
// fetched anonymously (no auth session), so it also depends on RLS
// permitting anonymous SELECT on these tables/columns.
function useGuestData() {
  const [athletes, setAthletes] = useState([])
  const [coaches, setCoaches] = useState([])
  const [events, setEvents] = useState([])
  const [results, setResults] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [a, c, e, r, reg] = await Promise.all([
        // Same is_test_record filter as the canonical fetch in App.jsx
        // (fetchAll) — without it, the guest dashboard's counts include
        // internal test records the real Athletes/Coaches pages exclude,
        // so the two never agree.
        supabase.from('athletes').select('id, name, name_ar, sport, sport_category, classification, status').eq('is_test_record', false),
        supabase.from('coaches').select('id, name, name_ar, sport, sport_category, status').eq('is_test_record', false),
        supabase.from('events').select('*'),
        supabase.from('results').select('id, athlete_id, medal, discipline, event_name, date'),
        supabase.from('event_registrations').select('event_id, athlete_id'),
      ])
      if (cancelled) return
      setAthletes(a.data || [])
      setCoaches(c.data || [])
      setEvents(e.data || [])
      setResults(r.data || [])
      setRegistrations(reg.data || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  return { athletes, coaches, events, results, registrations, loading }
}

function GuestBanner() {
  const { lang } = useLang()
  const ar = lang === 'ar'
  return (
    <div className="guest-banner" style={{ background: '#fef3c7', borderBottom: '1px solid #fcd34d', padding: '8px 16px', textAlign: 'center', fontSize: 12.5, color: '#92400e', fontWeight: 500 }}>
      <i className="ti ti-eye" style={{ marginInlineEnd: 6 }} />
      {ar
        ? 'وضع الضيف — أنت تستخدم النسخة العامة للقراءة فقط من نظام إدارة اللجنة البارالمبية القطرية.'
        : 'Guest Mode — You are viewing a public, read-only version of the Qatar Paralympic Committee Management System.'}
    </div>
  )
}

const STATUS_TX = { Planning: 'planning', Upcoming: 'upcoming', 'In Progress': 'inProgress', Completed: 'completed', Canceled: 'canceled' }

function GuestDashboard({ athletes, coaches, events, registrations }) {
  const { lang, tx } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const sportEntries = SPORT_CATEGORIES.flatMap(category =>
    ((category === 'Summer Paralympic' ? SPORTS_BY_CATEGORY[category].filter(s => s !== 'Special Olympics') : SPORTS_BY_CATEGORY[category]) || []).map(s => ({
      sport: s, category,
      count: athletes.filter(a => a.sport === s && a.sport_category === category).length,
    }))
  ).filter(e => e.count > 0)

  const activeEventsCount = (events||[]).filter(e => {
    const st = getEventStatus(e)
    return e.approval_status === 'Approved' && (st === 'Upcoming' || st === 'In Progress')
  }).length
  const upcomingEvents = (events||[])
    .filter(e => { const st = getEventStatus(e); return e.approval_status === 'Approved' && st === 'Upcoming' })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 6)

  const kpiCards = [
    { label: L('Total Athletes','إجمالي الرياضيين'), val: athletes.length, color:'#0085C7', icon:'ti-users' },
    { label: tx('nav.coaches','Coaches'), val: coaches.length, color:'#009F6B', icon:'ti-user-star' },
    { label: L('Total Sports','إجمالي الرياضات'), val: sportEntries.length, color:'#EE334E', icon:'ti-ball-football' },
    { label: tx('dashboard.activeEvents','Active Events'), val: activeEventsCount, color:'#0085C7', icon:'ti-calendar-event' },
  ]

  return (
    <div>
      <div className="guest-hero" style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', marginBottom: 14, minHeight: 140, display: 'flex', alignItems: 'center', background: '#1a0a14' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/dashboard-banner.jpg)', backgroundSize: 'cover', backgroundPosition: 'center center' }} />
        <div style={{ position: 'absolute', inset: 0, background: ar
          ? 'linear-gradient(to left, rgba(10,5,15,0.85) 0%, rgba(10,5,15,0.55) 40%, rgba(10,5,15,0.05) 65%)'
          : 'linear-gradient(to right, rgba(10,5,15,0.80) 0%, rgba(10,5,15,0.55) 40%, rgba(10,5,15,0.05) 65%)' }} />
        <div className="guest-hero-inner" style={{ position: 'relative', zIndex: 1, padding: '22px 28px' }}>
          <div className="guest-hero-title" style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>
            {L('Qatar Paralympic Committee','اللجنة البارالمبية القطرية')}
          </div>
          <div className="guest-hero-sub" style={{ fontSize: 13, color: 'rgba(255,255,255,.65)' }}>
            {L('Public overview — athletes, sports & events','نظرة عامة عامة — الرياضيون والرياضات والفعاليات')}
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        {kpiCards.map(({ label, val, color, icon }) => (
          <div key={label} className="kpi-card" style={{ cursor: 'default' }}>
            <div className="kpi-icon" style={{ background: color + '18' }}><i className={`ti ${icon}`} style={{ color, fontSize: 16 }} /></div>
            <div className="kpi-body">
              <div className="kpi-label">{label}</div>
              <div className="kpi-val" style={{ color }}>{val}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-title"><i className="ti ti-calendar-event" /> {tx('dashboard.upcomingEvents','Upcoming events')}</div>
        {upcomingEvents.map(ev => {
          const evStatus = getEventStatus(ev)
          const statusLabel = STATUS_TX[evStatus] ? tx(`events.${STATUS_TX[evStatus]}`, evStatus) : evStatus
          const regCount = registrations.filter(r => r.event_id === ev.id).length
          return (
            <div key={ev.id} className="guest-event-row">
              <div style={{ width:8, height:8, borderRadius:'50%', background:statusDot(evStatus), flexShrink:0 }} />
              <span className="guest-event-title">{ar && ev.name_ar ? ev.name_ar : ev.name}</span>
              <span className="guest-event-meta" style={{ color:'#9aa3b2' }}>
                <i className="ti ti-users" style={{ fontSize:12 }} /> {regCount}
              </span>
              <span className="guest-event-meta" style={{ color:'#9aa3b2' }}>{ev.start_date}</span>
              <span className={`badge ${statusClass(evStatus)}`} style={{ flexShrink:0 }}>{statusLabel}</span>
            </div>
          )
        })}
        {upcomingEvents.length === 0 && <div className="empty">{tx('dashboard.noUpcomingEvents','No upcoming events')}</div>}
      </div>

      <div className="card">
        <div className="card-title"><i className="ti ti-ball-football" /> {tx('dashboard.sportsBreakdown','Sports breakdown')}</div>
        {sportEntries.length === 0
          ? <div className="empty" style={{ padding:16 }}>{tx('dashboard.noSportsYet','No athletes assigned to a sport yet')}</div>
          : (
            <div className="sports-grid">
              {[...sportEntries].sort((a,b)=>b.count-a.count).slice(0,8).map(({ sport: s, category, count }) => {
                const meta = SPORT_META[s] || { icon:'ti-ball-football', color:'#0085C7' }
                const pct = athletes.length > 0 ? Math.round((count / athletes.length) * 100) : 0
                return (
                  <div key={`${category}-${s}`} className="sport-chip">
                    <div style={{ fontSize:18 }}><i className={`ti ${meta.icon}`} style={{ color:meta.color }} /></div>
                    <div className="sport-label">{sportLabel(s, category, ar)}</div>
                    <div className="sport-stat">{count} {ar ? 'رياضي' : 'athletes'} · {pct}%</div>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>
    </div>
  )
}

// Compact, self-contained contact card — consistent height/spacing/
// typography/hover regardless of how long the label or value is. Defined
// at module scope (not inside AboutQPC's render) so it isn't recreated as
// a "new" component type on every render, which would otherwise force
// React to unmount/remount every card (and its link) unnecessarily.
function ContactCard({ icon, color, label, valueNode, href, external, copyValue }) {
  const [copied, setCopied] = useState(false)
  const inner = (
    <div className="guest-contact-card">
      <div className="guest-contact-icon" style={{ background: color + '18' }}>
        <i className={`ti ${icon}`} style={{ color, fontSize: 18 }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="guest-contact-label">{label}</div>
        <div className="guest-contact-value">{valueNode}</div>
      </div>
      {copyValue && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault(); e.stopPropagation()
            navigator.clipboard?.writeText(copyValue)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          title={copied ? 'Copied' : 'Copy'}
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#009F6B' : 'var(--text3)', padding: 4 }}
        >
          <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} style={{ fontSize: 15 }} />
        </button>
      )}
    </div>
  )
  if (!href) return inner
  return (
    <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      {inner}
    </a>
  )
}

function AboutQPC() {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en
  const Section = ({ icon, title, children }) => (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-title"><i className={`ti ${icon}`} /> {title}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.8 }}>{children}</div>
    </div>
  )

  return (
    <div>
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <img src={QPC_LOGO} alt="QPC" style={{ height: 80, marginBottom: 12 }} />
        <div style={{ fontSize: 22, fontWeight: 700 }}>{L('Qatar Paralympic Committee','اللجنة البارالمبية القطرية')}</div>
      </div>

      <Section icon="ti-flag" title={L('Overview','نظرة عامة')}>
        {L(
          'The Qatar Paralympic Committee (QPC) is the national organization responsible for developing Para sport in Qatar and managing Special Olympics programs for athletes with intellectual disabilities. QPC supports athletes and participants from grassroots and community activities through to national representation and international competition.',
          'اللجنة البارالمبية القطرية هي الجهة الوطنية المسؤولة عن تطوير الرياضة البارالمبية في قطر وإدارة برامج الأولمبياد الخاص للرياضيين ذوي الإعاقة الذهنية. تدعم اللجنة الرياضيين والمشاركين ابتداءً من الأنشطة الشعبية والمجتمعية وصولاً إلى التمثيل الوطني والمنافسة الدولية.'
        )}
      </Section>
      <Section icon="ti-target-arrow" title={L('Mission','الرسالة')}>
        {L(
          'To develop an inclusive and structured sport system for persons with disabilities in Qatar, providing quality pathways in both Paralympic sport and Special Olympics programs, from community participation to international competition.',
          'تطوير نظام رياضي شامل ومنظّم لذوي الإعاقة في قطر، وتوفير مسارات نوعية في كل من الرياضة البارالمبية وبرامج الأولمبياد الخاص، ابتداءً من المشاركة المجتمعية وصولاً إلى المنافسة الدولية.'
        )}
      </Section>
      <Section icon="ti-telescope" title={L('Vision','الرؤية')}>
        {L(
          'To build a leading and inclusive disability sport system in Qatar, recognized for sporting excellence, athlete development, community participation and positive social impact.',
          'بناء نظام رياضي رائد وشامل لذوي الإعاقة في قطر، معترف به للتميز الرياضي وتطوير الرياضيين والمشاركة المجتمعية والأثر الاجتماعي الإيجابي.'
        )}
      </Section>
      <Section icon="ti-list-check" title={L('Objectives','الأهداف')}>
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>
          <li>{L('Develop competitive Paralympic sports and Special Olympics programs across Qatar.','تطوير الرياضات البارالمبية التنافسية وبرامج الأولمبياد الخاص في جميع أنحاء قطر.')}</li>
          <li>{L('Identify, develop and support athletes through structured sporting pathways.','اكتشاف الرياضيين وتطويرهم ودعمهم من خلال مسارات رياضية منظمة.')}</li>
          <li>{L('Increase grassroots and community participation among persons with disabilities.','زيادة المشاركة الشعبية والمجتمعية لذوي الإعاقة.')}</li>
          <li>{L('Provide appropriate technical, medical and administrative support to athletes and teams.','تقديم الدعم الفني والطبي والإداري المناسب للرياضيين والفرق.')}</li>
          <li>{L('Develop coaches, officials, volunteers and other sport personnel.','تطوير المدربين والحكام والمتطوعين والكوادر الرياضية الأخرى.')}</li>
          <li>{L('Strengthen cooperation with national, regional and international sport organizations.','تعزيز التعاون مع المنظمات الرياضية الوطنية والإقليمية والدولية.')}</li>
          <li>{L('Represent Qatar successfully in Paralympic and Special Olympics competitions.','تمثيل قطر بنجاح في منافسات الألعاب البارالمبية والأولمبياد الخاص.')}</li>
        </ul>
      </Section>
      <Section icon="ti-history" title={L('Brief History','لمحة تاريخية')}>
        {L(
          'Since its establishment, the Qatar Paralympic Committee has expanded its athlete base, sports programs, and institutional support, representing Qatar in regional and international Paralympic and Special Olympics competitions. Today, QPC oversees the development of Paralympic sport and Special Olympics programs in Qatar, including athlete development, national team preparation, competition participation, technical support, community programs, and cooperation with national and international sports organizations.',
          'منذ تأسيسها، وسّعت اللجنة البارالمبية القطرية قاعدة رياضييها وبرامجها الرياضية ودعمها المؤسسي، ممثلةً قطر في المنافسات البارالمبية ومنافسات الأولمبياد الخاص على المستويين الإقليمي والدولي. وتشرف اللجنة اليوم على تطوير الرياضة البارالمبية وبرامج الأولمبياد الخاص في قطر، بما يشمل تطوير الرياضيين، وإعداد المنتخبات الوطنية، والمشاركة في المنافسات، والدعم الفني، والبرامج المجتمعية، والتعاون مع المنظمات الرياضية الوطنية والدولية.'
        )}
      </Section>
      <Section icon="ti-sitemap" title={L('Organization','الهيكل التنظيمي')}>
        {L(
          'QPC is organized around administrative, technical, medical, and sports classification functions, working together to support athletes, coaches, teams, programs, and events across Paralympic sport and Special Olympics.',
          'تتكون اللجنة من وظائف إدارية وفنية وطبية وتصنيف رياضي تعمل معاً لدعم الرياضيين والمدربين والفرق والبرامج والفعاليات عبر الرياضة البارالمبية والأولمبياد الخاص.'
        )}
      </Section>

      {/* Contact Us — clean responsive card grid: 3 cols desktop, 2 tablet, 1 mobile */}
      <div className="card">
        <div className="card-title"><i className="ti ti-address-book" /> {L('Contact Us','تواصل معنا')}</div>
        <div className="guest-contact-grid">
          <ContactCard icon="ti-mail" color="#EE334E" label={L('Email','البريد الإلكتروني')}
            valueNode={<span dir="ltr">npcqatar@olympic.qa</span>} href="mailto:npcqatar@olympic.qa" copyValue="npcqatar@olympic.qa" />
          <ContactCard icon="ti-phone" color="#009F6B" label={L('Phone','الهاتف')}
            valueNode={<span dir="ltr">+974 4041 0410</span>} href="tel:+97440410410" copyValue="+974 4041 0410" />
          <ContactCard icon="ti-map-pin" color="#0085C7" label={L('Address','العنوان')}
            valueNode={<><span dir="ltr">9F2G+4QP</span>, {L('Doha, Qatar','الدوحة، قطر')}</>} />
          <ContactCard icon="ti-mailbox" color="#f59e0b" label={L('P.O. Box','صندوق البريد')}
            valueNode={<span dir="ltr">21515</span>} />
          <ContactCard icon="ti-world" color="#8b5cf6" label={L('Qatar Paralympic Committee Website','الموقع الإلكتروني للجنة البارالمبية القطرية')}
            valueNode="qatarparalympic.org" href="https://qatarparalympic.org/" external />
          <ContactCard icon="ti-world" color="#8b5cf6" label={L('Special Olympics Qatar Website','الموقع الإلكتروني للأولمبياد الخاص قطر')}
            valueNode="specialolympicsqatar.org" href="https://www.specialolympicsqatar.org/" external />
          <ContactCard icon="ti-brand-instagram" color="#e1306c" label={L('Instagram','إنستغرام')}
            valueNode={<span dir="ltr">@qatar_paralympic_committee</span>} href="https://www.instagram.com/qatar_paralympic_committee/" external />
          <ContactCard icon="ti-brand-facebook" color="#1877f2" label={L('Facebook','فيسبوك')}
            valueNode={L('Qatar Paralympic Committee','اللجنة البارالمبية القطرية')} href="https://www.facebook.com/QatarParalympicCommittee" external />
          <ContactCard icon="ti-brand-x" color="var(--text)" label={L('X (Twitter)','إكس (تويتر)')}
            valueNode={<span dir="ltr">@qatarparalympic</span>} href="https://x.com/qatarparalympic" external />
        </div>
      </div>
    </div>
  )
}

function GuestRequestField({ field, value, onChange, ar, onFileChange, uploading, pendingFile }) {
  const set = v => onChange(field.id, v)
  switch (field.field_type) {
    case 'textarea': return <textarea className="form-input" rows={3} value={value||''} onChange={e=>set(e.target.value)} style={{resize:'vertical'}} />
    case 'number':   return <input type="number" className="form-input" value={value||''} onChange={e=>set(e.target.value)} />
    case 'date':     return <input type="date" className="form-input" value={value||''} onChange={e=>set(e.target.value)} />
    case 'email':    return <input type="email" className="form-input" value={value||''} onChange={e=>set(e.target.value)} />
    case 'phone':    return <input type="tel" className="form-input" value={value||''} onChange={e=>set(e.target.value)} />
    case 'yes_no':   return <div style={{display:'flex',gap:12}}>{['Yes','No'].map(o=><label key={o} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:14}}><input type="radio" name={field.id} value={o} checked={value===o} onChange={()=>set(o)} />{ar?(o==='Yes'?'نعم':'لا'):o}</label>)}</div>
    case 'dropdown': return <select className="form-input" value={value||''} onChange={e=>set(e.target.value)}><option value="">{ar?'— اختر —':'— Select —'}</option>{(field.options||[]).map((o,i)=><option key={i} value={o.label}>{ar?(o.label_ar||o.label):o.label}</option>)}</select>
    case 'radio':    return <div style={{display:'flex',flexDirection:'column',gap:8}}>{(field.options||[]).map((o,i)=><label key={i} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14}}><input type="radio" name={field.id} value={o.label} checked={value===o.label} onChange={()=>set(o.label)}/>{ar?(o.label_ar||o.label):o.label}</label>)}</div>
    case 'checkbox': {
      const sel = Array.isArray(value)?value:[], tog=v=>set(sel.includes(v)?sel.filter(x=>x!==v):[...sel,v])
      return <div style={{display:'flex',flexDirection:'column',gap:8}}>{(field.options||[]).map((o,i)=><label key={i} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14}}><input type="checkbox" checked={sel.includes(o.label)} onChange={()=>tog(o.label)}/>{ar?(o.label_ar||o.label):o.label}</label>)}</div>
    }
    case 'file':
      return (
        <div>
          <input type="file" className="form-input" disabled={uploading} onChange={e=>onFileChange?.(field, e.target.files[0])} />
          {uploading && <div style={{fontSize:12,color:'var(--text3)',marginTop:6}}><i className="ti ti-loader ti-spin"/> {ar?'جارٍ الرفع…':'Uploading…'}</div>}
          {!uploading && pendingFile && (
            <div style={{fontSize:12,color:'#009F6B',marginTop:6}}><i className="ti ti-circle-check"/> {pendingFile.name}</div>
          )}
        </div>
      )
    default: return <input type="text" className="form-input" value={value||''} onChange={e=>set(e.target.value)} />
  }
}

function GuestRequests() {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedForm, setSelectedForm] = useState(null)
  const [answers, setAnswers] = useState({})
  const [guestName, setGuestName] = useState('')
  const [guestContact, setGuestContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [refNumber, setRefNumber] = useState(null)
  const [emailGateForm, setEmailGateForm] = useState(null) // form pending the "enter your email" step, before it actually opens
  const [emailGateValue, setEmailGateValue] = useState('')
  const [emailGateError, setEmailGateError] = useState('')
  const [draftId, setDraftId] = useState(null) // storage folder for this fill session's uploads, until a real submission_id exists
  const [pendingFiles, setPendingFiles] = useState({}) // { [fieldId]: { name, path, type, size } }
  const [fileUploading, setFileUploading] = useState({}) // { [fieldId]: true } while an upload is in flight
  const [tracking, setTracking] = useState(false)
  const [trackRef, setTrackRef] = useState('')
  const [trackResult, setTrackResult] = useState(null) // 'not_found' | 'rate_limited' | { ...found fields }
  // Secure guest edit link (from a "Returned" status email):
  // /?guest_edit=<submission_id>&token=<edit_token> — loaded via a
  // SECURITY DEFINER RPC that validates the token server-side (matches
  // this exact submission, status is still 'returned', not expired).
  // Never trusts the submission id alone.
  const [editLoadState, setEditLoadState] = useState(null) // null | 'loading' | 'invalid' | 'ready' | 'done'
  const [editData, setEditData] = useState(null) // { submissionId, token, form, answers, files }
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editPendingFiles, setEditPendingFiles] = useState({}) // { [fieldId]: { name, path, type, size } } — newly-uploaded replacement/added files, not yet linked
  const [editFileUploading, setEditFileUploading] = useState({})
  const [trackLoading, setTrackLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const submissionId = params.get('guest_edit')
    const token = params.get('token')
    if (!submissionId || !token) return
    setEditLoadState('loading')
    ;(async () => {
      const { data, error } = await supabase.rpc('get_returned_submission_for_edit', {
        p_submission_id: submissionId, p_token: token,
      })
      if (error || data?.status !== 'ok') { setEditLoadState('invalid'); return }
      setEditData({
        submissionId, token,
        form: { id: data.form.id, title: data.form.title, title_ar: data.form.title_ar, request_form_fields: data.form.fields || [] },
        answers: data.submission.answers || {},
        referenceNumber: data.submission.reference_number,
        files: data.files || [], // existing attachments, kept unless explicitly removed
      })
      setEditLoadState('ready')
    })()
  }, [])

  async function handleEditFieldFileUpload(field, file) {
    if (!file) return
    if (file.size > 25 * 1024 * 1024) return alert(ar?'حجم الملف يتجاوز الحد المسموح 25 ميجابايت':'File exceeds the 25 MB limit')
    if (!SUPPORTED_DOC_FILE_TYPES.includes(file.type)) return alert(ar?'نوع الملف غير مدعوم. الرجاء رفع PDF أو JPG أو PNG.':'Unsupported file type. Please upload a PDF, JPG, or PNG.')
    setEditFileUploading(p => ({ ...p, [field.id]: true }))
    try {
      const ext = file.name.split('.').pop()
      const path = `${editData.submissionId}/${field.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('request-attachments').upload(path, file, { upsert: false })
      if (error) throw error
      setEditPendingFiles(p => ({ ...p, [field.id]: { name: file.name, path, type: file.type, size: file.size } }))
    } catch (err) {
      console.error('Attachment upload failed', err)
      alert(ar?'فشل الرفع. يرجى المحاولة مرة أخرى.':'Upload failed. Please try again.')
    } finally {
      setEditFileUploading(p => ({ ...p, [field.id]: false }))
    }
  }

  // Existing attachment stays untouched unless explicitly removed here —
  // this is the only path that deletes one, always through the
  // token-gated RPC (never a direct client-side table/storage delete).
  async function removeEditExistingFile(fileRow) {
    const { data, error } = await supabase.rpc('remove_returned_submission_file', {
      p_submission_id: editData.submissionId, p_file_id: fileRow.id, p_token: editData.token,
    })
    if (error || data?.status !== 'ok') { alert(ar?'تعذر إزالة الملف':'Could not remove the file'); return }
    if (data.file_path) {
      // Best-effort — guests don't have Storage delete permission on this
      // bucket, so this silently no-ops for them; the DB row (the source
      // of truth for "is this file attached") is already gone either way.
      supabase.storage.from('request-attachments').remove([data.file_path]).catch(() => {})
    }
    setEditData(p => ({ ...p, files: p.files.filter(f => f.id !== fileRow.id) }))
  }

  async function submitEdit() {
    if (!editData) return
    if (Object.values(editFileUploading).some(Boolean)) return alert(ar?'يرجى الانتظار حتى انتهاء رفع الملف':'Please wait for the file upload to finish')
    const missing = (editData.form.request_form_fields||[]).filter(f => {
      if (!f.is_required) return false
      if (f.field_type === 'file') {
        // A required file field counts as satisfied by a kept existing
        // attachment OR a newly-uploaded replacement — not text answers.
        const hasExisting = editData.files.some(fl => fl.field_id === f.id)
        const hasNew = !!editPendingFiles[f.id]
        return !hasExisting && !hasNew
      }
      return !editData.answers[f.id]?.toString().trim()
    })
    if (missing.length) return alert((ar?'الحقول المطلوبة: ':'Required: ')+missing.map(f=>ar?(f.label_ar||f.label):f.label).join(', '))
    setEditSubmitting(true)
    // File metadata (already-uploaded Storage paths) is passed straight
    // into the RPC, which links it in the SAME transaction as the
    // status/action update — atomic: either everything commits together,
    // or a failure rolls all of it back and nothing is left half-linked.
    // A retry after a genuine failure safely resends the same list
    // without creating duplicate rows, since nothing from the failed
    // attempt was ever committed.
    const newFiles = Object.entries(editPendingFiles).map(([fieldId, f]) => ({
      field_id: fieldId, file_name: f.name, file_path: f.path, file_type: f.type, file_size: f.size,
    }))
    const { data, error } = await supabase.rpc('resubmit_guest_submission', {
      p_submission_id: editData.submissionId, p_token: editData.token, p_answers: editData.answers, p_new_files: newFiles,
    })
    setEditSubmitting(false)
    if (error || data?.status !== 'ok') {
      alert(data?.status === 'invalid_or_expired' ? (ar?'انتهت صلاحية رابط التعديل أو أنه غير صالح':'This edit link is invalid or has expired') : (ar?'تعذر إعادة الإرسال':'Could not resubmit'))
      return
    }
    setEditPendingFiles({})
    setEditLoadState('done')
  }

  async function handleTrackSubmission() {
    if (!trackRef.trim()) return
    setTrackLoading(true)
    setTrackResult(null)
    // Secure server-side lookup by reference number only — the RPC only
    // ever exposes status/dates/title, never admin notes, answers,
    // attachments, or approver identities.
    const { data, error } = await supabase.rpc('track_guest_submission', {
      p_reference_number: trackRef.trim(),
    })
    setTrackLoading(false)
    if (error) { setTrackResult('not_found'); return }
    setTrackResult(data?.status === 'found' ? data : (data?.status || 'not_found'))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('request_forms').select('*, request_form_fields(*)').eq('is_active', true)
      if (cancelled) return
      if (data) data.forEach(f => f.request_form_fields?.sort((a,b)=>a.sort_order-b.sort_order))
      setForms(data||[])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // Uploads immediately (while the guest is still filling the form) into
  // request-attachments/{draftId}/{fieldId}/{filename} — draftId is a
  // fresh UUID generated when a form is opened, isolating this guest's
  // fill session's files from anyone else's. The real link to the
  // eventual submission row is created in submit(), once
  // submit_guest_request returns the actual submission_id.
  async function handleFieldFileUpload(field, file) {
    if (!file) return
    if (file.size > 25 * 1024 * 1024) return alert(ar?'حجم الملف يتجاوز الحد المسموح 25 ميجابايت':'File exceeds the 25 MB limit')
    if (!SUPPORTED_DOC_FILE_TYPES.includes(file.type)) return alert(ar?'نوع الملف غير مدعوم. الرجاء رفع PDF أو JPG أو PNG.':'Unsupported file type. Please upload a PDF, JPG, or PNG.')
    setFileUploading(p => ({ ...p, [field.id]: true }))
    try {
      const ext = file.name.split('.').pop()
      const path = `${draftId}/${field.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('request-attachments').upload(path, file, { upsert: false })
      if (error) throw error
      setPendingFiles(p => ({ ...p, [field.id]: { name: file.name, path, type: file.type, size: file.size } }))
      setAnswers(p => ({ ...p, [field.id]: file.name }))
    } catch (err) {
      // Full detail stays in the console for debugging — the guest only
      // ever sees a plain, non-technical message, never a raw DB/storage
      // error string.
      console.error('Attachment upload failed', err)
      alert(ar?'فشل الرفع. يرجى المحاولة مرة أخرى.':'Upload failed. Please try again.')
    } finally {
      setFileUploading(p => ({ ...p, [field.id]: false }))
    }
  }

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

  // Opens the actual form only after a valid email is captured — this is
  // the guest notification address saved as guest_contact, and prefilled
  // into the form's own email-type field (if it has one) so the guest
  // doesn't have to type it twice.
  function confirmEmailGate() {
    const email = emailGateValue.trim()
    if (!EMAIL_RE.test(email)) { setEmailGateError(ar?'يرجى إدخال بريد إلكتروني صحيح':'Please enter a valid email address'); return }
    const f = emailGateForm
    setGuestContact(email)
    setAnswers(() => {
      const emailField = (f.request_form_fields||[]).find(fl => fl.field_type === 'email')
      return emailField ? { [emailField.id]: email } : {}
    })
    setSelectedForm(f)
    setDraftId(crypto.randomUUID())
    setPendingFiles({})
    setEmailGateForm(null)
  }

  async function submit() {
    const missing = (selectedForm.request_form_fields||[]).filter(f=>f.is_required && !answers[f.id]?.toString().trim())
    if (!guestName.trim()) return alert(ar?'الاسم مطلوب':'Name is required')
    if (missing.length) return alert((ar?'الحقول المطلوبة: ':'Required: ')+missing.map(f=>ar?(f.label_ar||f.label):f.label).join(', '))
    if (Object.values(fileUploading).some(Boolean)) return alert(ar?'يرجى الانتظار حتى انتهاء رفع الملف':'Please wait for the file upload to finish')
    setSubmitting(true)
    const { data, error } = await supabase.rpc('submit_guest_request', {
      p_form_id: selectedForm.id, p_answers: answers, p_guest_name: guestName.trim(), p_guest_contact: guestContact.trim()||null, p_lang: lang,
    })
    if (error || data?.status !== 'created') { setSubmitting(false); return alert(ar?'تعذر الإرسال':'Submission failed') }

    // Link any files uploaded during this fill session to the real
    // submission row that now exists.
    const pendingEntries = Object.entries(pendingFiles)
    if (pendingEntries.length && data.submission_id) {
      const fileRows = pendingEntries.map(([fieldId, f]) => ({
        submission_id: data.submission_id, field_id: fieldId,
        file_name: f.name, file_path: f.path, file_type: f.type, file_size: f.size,
      }))
      const { error: fileErr } = await supabase.from('request_submission_files').insert(fileRows)
      if (fileErr) console.error('Failed to link uploaded files to submission', fileErr)
    }

    setSubmitting(false)
    setRefNumber(data.reference_number)
  }

  if (loading) return <div className="empty" style={{ padding: 60 }}>{ar?'جارٍ التحميل…':'Loading…'}</div>

  // Secure guest edit flow (Returned submission via emailed edit link) —
  // takes over the whole page since it's reached from an external email
  // link, not normal in-app navigation.
  if (editLoadState) {
    if (editLoadState === 'loading') return (
      <div className="card" style={{maxWidth:480,margin:'40px auto',padding:32,textAlign:'center'}}>{L('Loading…','جارٍ التحميل…')}</div>
    )
    if (editLoadState === 'invalid') return (
      <div className="card" style={{maxWidth:480,margin:'40px auto',padding:32,textAlign:'center'}}>
        <i className="ti ti-link-off" style={{fontSize:32,color:'#EE334E'}}/>
        <div style={{fontWeight:700,fontSize:15,margin:'12px 0 6px'}}>{L('This link is invalid or has expired','هذا الرابط غير صالح أو منتهي الصلاحية')}</div>
        <div style={{color:'var(--text2)',fontSize:13}}>{L('Please contact us for a new link, or check your latest status email.','يرجى التواصل معنا للحصول على رابط جديد، أو مراجعة أحدث بريد إلكتروني للحالة.')}</div>
      </div>
    )
    if (editLoadState === 'done') return (
      <div className="card" style={{maxWidth:480,margin:'40px auto',padding:32,textAlign:'center'}}>
        <i className="ti ti-circle-check" style={{fontSize:40,color:'#009F6B'}}/>
        <div style={{fontWeight:700,fontSize:16,margin:'12px 0 6px'}}>{L('Resubmitted','تم إعادة الإرسال')}</div>
        <div style={{color:'var(--text2)',fontSize:13}}>{L('Your request has been updated and is back in the review queue.','تم تحديث طلبك وهو الآن مجددًا ضمن قائمة المراجعة.')}</div>
      </div>
    )
    // 'ready'
    return (
      <div className="card" style={{maxWidth:640,margin:'24px auto',padding:28}}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>{ar?(editData.form.title_ar||editData.form.title):editData.form.title}</div>
        <div style={{color:'var(--text3)',fontSize:12,marginBottom:18}}>{L('Reference','المرجع')}: {editData.referenceNumber} — {L('Edit and resubmit your returned request below.','عدّل طلبك المُعاد أدناه ثم أعد إرساله.')}</div>
        {editData.form.request_form_fields.map(field => {
          if (field.field_type === 'file') {
            const existing = editData.files.filter(f => f.field_id === field.id)
            const uploading = !!editFileUploading[field.id]
            const pending = editPendingFiles[field.id]
            return (
              <div key={field.id} className="form-group" style={{marginBottom:16}}>
                <label className="form-label">
                  {ar?(field.label_ar||field.label):field.label}{field.is_required && <span style={{color:'#EE334E'}}> *</span>}
                </label>
                {existing.length > 0 && (
                  <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:8}}>
                    {existing.map(f => (
                      <div key={f.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',border:'1px solid var(--border)',borderRadius:8,fontSize:12.5}}>
                        <i className="ti ti-paperclip" style={{color:'var(--text3)'}}/>
                        <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.file_name}</span>
                        <span style={{fontSize:10,color:'#009F6B',fontWeight:600}}>{L('Kept','محتفظ به')}</span>
                        <button type="button" onClick={()=>removeEditExistingFile(f)}
                          style={{background:'none',border:'none',color:'#EE334E',cursor:'pointer',fontSize:12}}>
                          {L('Remove','إزالة')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input type="file" className="form-input" disabled={uploading} onChange={e=>handleEditFieldFileUpload(field, e.target.files[0])} />
                <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                  {L('Uploading a new file adds it alongside any kept file above.','رفع ملف جديد يضيفه إلى جانب الملف المحتفظ به أعلاه.')}
                </div>
                {uploading && <div style={{fontSize:12,color:'var(--text3)',marginTop:6}}><i className="ti ti-loader ti-spin"/> {L('Uploading…','جارٍ الرفع…')}</div>}
                {!uploading && pending && (
                  <div style={{fontSize:12,color:'#009F6B',marginTop:6}}><i className="ti ti-circle-check"/> {pending.name}</div>
                )}
              </div>
            )
          }
          return (
            <div key={field.id} className="form-group" style={{marginBottom:16}}>
              <label className="form-label">
                {ar?(field.label_ar||field.label):field.label}{field.is_required && <span style={{color:'#EE334E'}}> *</span>}
              </label>
              <GuestRequestField field={field} value={editData.answers[field.id]} ar={ar}
                onChange={(id,v)=>setEditData(p=>({...p, answers:{...p.answers,[id]:v}}))} />
            </div>
          )
        })}
        <button className="btn btn-blue" onClick={submitEdit} disabled={editSubmitting}>
          <i className="ti ti-send"/> {editSubmitting?L('Resubmitting…','جارٍ إعادة الإرسال…'):L('Resubmit','إعادة الإرسال')}
        </button>
      </div>
    )
  }

  if (tracking) return (
    <div className="card guest-auth-card" style={{maxWidth:480,margin:'40px auto',padding:32}}>
      <BackButton onClick={()=>{setTracking(false);setTrackResult(null);setTrackRef('')}} label={L('Back','رجوع')} style={{marginBottom:14}} />
      <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>{L('Track Submission','متابعة الطلب')}</div>
      <div style={{color:'var(--text2)',fontSize:13,marginBottom:18}}>{L('Enter your reference number.','أدخل رقم المرجع الخاص بك.')}</div>
      <div className="form-group" style={{marginBottom:18}}>
        <label className="form-label">{L('Reference Number','رقم المرجع')}</label>
        <input className="form-input" value={trackRef} onChange={e=>setTrackRef(e.target.value)} placeholder="QPC-20260817-K7M4X9P2" />
      </div>
      <button className="btn btn-blue" disabled={trackLoading || !trackRef.trim()} onClick={handleTrackSubmission}>
        <i className="ti ti-search"/> {trackLoading?L('Checking…','جارٍ التحقق…'):L('Check Status','التحقق من الحالة')}
      </button>

      {trackResult === 'not_found' && (
        <div style={{marginTop:18,padding:'12px 14px',background:'#fef2f4',borderRadius:8,color:'#EE334E',fontSize:13}}>
          {L('No submission found with that reference number.','لم يتم العثور على طلب بهذا الرقم المرجعي.')}
        </div>
      )}
      {trackResult === 'rate_limited' && (
        <div style={{marginTop:18,padding:'12px 14px',background:'#fff7ed',borderRadius:8,color:'#d97706',fontSize:13}}>
          {L('Too many attempts. Please try again later.','عدد محاولات كبير جدًا. يرجى المحاولة لاحقًا.')}
        </div>
      )}
      {trackResult && trackResult !== 'not_found' && trackResult !== 'rate_limited' && (
        <div style={{marginTop:18,padding:'14px 16px',background:'var(--surface2)',borderRadius:10}}>
          <div style={{fontSize:12,color:'var(--text3)',marginBottom:4}}>{L('Form','النموذج')}</div>
          <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>{ar?(trackResult.form_title_ar||trackResult.form_title):trackResult.form_title}</div>
          <div style={{fontSize:12,color:'var(--text3)',marginBottom:4}}>{L('Status','الحالة')}</div>
          <div style={{fontWeight:700,fontSize:15,color:'#0085C7',marginBottom:12}}>{trackResult.submission_status}</div>
          <div style={{fontSize:12,color:'var(--text3)'}}>
            {L('Submitted','تاريخ الإرسال')}: {new Date(trackResult.submitted_at).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  )

  if (refNumber) return (
    <div className="card guest-auth-card" style={{maxWidth:480,margin:'40px auto',textAlign:'center',padding:32}}>
      <i className="ti ti-circle-check" style={{fontSize:40,color:'#009F6B'}}/>
      <div style={{fontWeight:700,fontSize:16,margin:'12px 0 6px'}}>{L('Request Submitted','تم إرسال الطلب')}</div>
      <div style={{color:'var(--text2)',fontSize:13,marginBottom:14}}>{L('Please save this reference number — you\'ll need it to track your request.','يرجى حفظ رقم المرجع هذا — ستحتاجه لمتابعة طلبك.')}</div>
      <div style={{fontWeight:700,fontSize:18,letterSpacing:'.03em',color:'#0085C7'}}>{refNumber}</div>
      <div style={{color:'var(--text3)',fontSize:12,marginTop:14}}>{L('A confirmation email has also been sent to you.','تم أيضًا إرسال بريد إلكتروني للتأكيد.')}</div>
      <button className="btn btn-blue" style={{marginTop:20}} onClick={()=>{setRefNumber(null);setSelectedForm(null);setAnswers({});setGuestName('');setGuestContact('');setPendingFiles({})}}>
        {L('Submit another request','إرسال طلب آخر')}
      </button>
    </div>
  )

  if (selectedForm) {
    const clr = selectedForm.color||'#0085C7'
    return (
      <div>
        <BackButton onClick={()=>setSelectedForm(null)} label={L('Back','رجوع')} style={{marginBottom:14}} />
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
          <div style={{width:44,height:44,borderRadius:12,background:clr+'18',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <i className={`ti ${selectedForm.icon||'ti-clipboard-text'}`} style={{fontSize:22,color:clr}}/>
          </div>
          <div className="page-title">{ar?(selectedForm.title_ar||selectedForm.title):selectedForm.title}</div>
        </div>
        <div className="card" style={{maxWidth:640}}>
          <div className="form-group" style={{marginBottom:18}}>
            <label className="form-label">{L('Your Name','الاسم')} <span style={{color:'#EE334E'}}>*</span></label>
            <input className="form-input" value={guestName} onChange={e=>setGuestName(e.target.value)} />
          </div>
          <div className="form-group" style={{marginBottom:18}}>
            <label className="form-label">{L('Contact (email or phone)','التواصل (بريد أو هاتف)')}</label>
            <input className="form-input" value={guestContact} onChange={e=>setGuestContact(e.target.value)} />
          </div>
          {(selectedForm.request_form_fields||[]).map(field=>(
            <div key={field.id} className="form-group" style={{marginBottom:18}}>
              <label className="form-label">{ar?(field.label_ar||field.label):field.label}{field.is_required && <span style={{color:'#EE334E',marginLeft:4}}>*</span>}</label>
              <GuestRequestField field={field} value={answers[field.id]} onChange={(id,v)=>setAnswers(p=>({...p,[id]:v}))} ar={ar}
                onFileChange={handleFieldFileUpload} uploading={!!fileUploading[field.id]} pendingFile={pendingFiles[field.id]} />
            </div>
          ))}
          <button className="btn btn-blue" disabled={submitting} onClick={submit}>
            <i className="ti ti-send"/> {submitting?L('Submitting…','جارٍ الإرسال…'):L('Submit','إرسال')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{marginBottom:20}}>
        <div>
          <div className="page-title">{L('Requests','الطلبات')}</div>
          <div className="page-sub">{L('Public request forms','نماذج الطلبات العامة')}</div>
        </div>
        <button className="action-btn action-btn-edit" onClick={()=>setTracking(true)}>
          <i className="ti ti-search"/> {L('Track Submission','متابعة الطلب')}
        </button>
      </div>
      {forms.length===0
        ? <div className="empty">{L('No request forms available','لا توجد نماذج متاحة')}</div>
        : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
            {forms.map(f=>{
              const clr = f.color||'#0085C7'
              return (
                <div key={f.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:18,cursor:'pointer',boxShadow:'var(--shadow)'}}
                  onClick={()=>{setEmailGateForm(f);setEmailGateValue(guestContact||'');setEmailGateError('')}}>
                  <div style={{width:42,height:42,borderRadius:11,background:clr+'15',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
                    <i className={`ti ${f.icon||'ti-clipboard-text'}`} style={{fontSize:20,color:clr}}/>
                  </div>
                  <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{ar?(f.title_ar||f.title):f.title}</div>
                  {(ar?(f.description_ar||f.description):f.description) && <div style={{fontSize:12,color:'var(--text2)'}}>{ar?(f.description_ar||f.description):f.description}</div>}
                </div>
              )
            })}
          </div>
      }
      {emailGateForm && (
        <div onMouseDown={e=>{if(e.target===e.currentTarget) setEmailGateForm(null)}}
          style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(10,10,14,.5)',backdropFilter:'blur(3px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div className="guest-modal-card" onMouseDown={e=>e.stopPropagation()} style={{width:'100%',maxWidth:400,background:'var(--surface)',borderRadius:14,boxShadow:'0 20px 60px rgba(0,0,0,.35)',padding:24}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>{L('Enter your email to continue','أدخل بريدك الإلكتروني للمتابعة')}</div>
            <div style={{color:'var(--text2)',fontSize:13,marginBottom:16}}>{L("We'll send your request confirmation and status updates to this address.",'سنرسل تأكيد طلبك وتحديثات الحالة إلى هذا البريد.')}</div>
            <input className="form-input" type="email" autoFocus value={emailGateValue}
              onChange={e=>{setEmailGateValue(e.target.value);setEmailGateError('')}}
              onKeyDown={e=>{if(e.key==='Enter') confirmEmailGate()}}
              placeholder="you@example.com" />
            {emailGateError && <div style={{color:'#EE334E',fontSize:12,marginTop:8}}>{emailGateError}</div>}
            <div style={{display:'flex',gap:10,marginTop:18}}>
              <button className="action-btn action-btn-edit" style={{flex:1,justifyContent:'center'}} onClick={()=>setEmailGateForm(null)}>
                {L('Cancel','إلغاء')}
              </button>
              <button className="btn btn-blue" style={{flex:1}} onClick={confirmEmailGate}>
                {L('Continue','متابعة')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GuestPortalInner({ onExit }) {
  const { lang, setLang } = useLang()
  const ar = lang === 'ar'
  const [page, setPage] = useState(() => new URLSearchParams(window.location.search).has('guest_edit') ? 'requests' : 'dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { athletes, coaches, events, results, registrations, loading } = useGuestData()

  function goToPage(id) { setPage(id); setMobileMenuOpen(false) }

  return (
    <div style={{ height: '100vh', background: 'var(--bg)', direction: ar ? 'rtl' : 'ltr', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <GuestBanner />
      {/* Mobile-only compact header: hamburger + logo. Hidden on desktop via
          the shared .hide-desktop-only rule (mirrors the authenticated
          app's .topbar/.menu-btn pattern) so desktop layout/behavior is
          completely unchanged. */}
      <div className="guest-mobile-topbar">
        <button className="menu-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Menu">
          <i className="ti ti-menu-2" />
        </button>
        <img src={QPC_LOGO} alt="QPC" style={{ height: 22 }} />
        <span style={{ color: '#fff', fontSize: 12.5, fontWeight: 700 }}>{ar ? 'اللجنة البارالمبية' : 'Qatar Paralympic'}</span>
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div className={`sb-overlay${mobileMenuOpen ? ' open' : ''}`} onClick={() => setMobileMenuOpen(false)} />
        <div className={`sidebar guest-sidebar${mobileMenuOpen ? ' open' : ''}`} style={{ width: 220, flexShrink: 0, background: '#0d0d14', padding: '18px 12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 18px', flexShrink: 0 }}>
            <img src={QPC_LOGO} alt="QPC" style={{ height: 28 }} />
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{ar ? 'اللجنة البارالمبية' : 'Qatar Paralympic'}</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {GUEST_NAV.map(item => (
              <div key={item.id} onClick={() => goToPage(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', marginBottom: 2,
                  background: page === item.id ? 'rgba(255,255,255,.08)' : 'transparent', color: page === item.id ? '#fff' : 'rgba(255,255,255,.6)' }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{ar ? item.ar : item.en}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, paddingTop: 8 }}>
            <button onClick={() => setLang(ar ? 'en' : 'ar')} style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 8, padding: '8px', color: 'rgba(255,255,255,.7)', fontSize: 12, cursor: 'pointer' }}>
              {ar ? 'EN' : 'عربي'}
            </button>
            <button onClick={onExit} style={{ background: '#0085C7', border: 'none', borderRadius: 8, padding: '9px', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <i className="ti ti-login" style={{ marginInlineEnd: 6 }} /> {ar ? 'تسجيل الدخول' : 'Sign In'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, padding: 20, overflowY: 'auto', overflowX: 'hidden' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {loading ? (
              <div className="empty" style={{ padding: 60 }}>{ar ? 'جارٍ التحميل…' : 'Loading…'}</div>
            ) : (
              <>
                {page === 'dashboard' && <GuestDashboard athletes={athletes} coaches={coaches} events={events} registrations={registrations} />}
                {page === 'calendar' && <Calendar profile={null} events={events} employees={[]} onNav={(p) => setPage(p === 'events' ? 'events' : page)} readOnly guestMode />}
                {page === 'events' && <Events events={events} athletes={athletes} employees={[]} results={results} registrations={registrations} onRefresh={() => {}} onNav={() => {}} profile={null} eventCategories={[]} sportsList={[]} guestMode />}
                {page === 'sports' && <Sports athletes={athletes} coaches={coaches} events={events} results={results} onNav={(p) => setPage(p === 'sports' ? 'sports' : page)} profile={null} />}
                {page === 'requests' && <GuestRequests />}
                {page === 'about' && <AboutQPC />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GuestPortal({ onExit }) {
  return <GuestPortalInner onExit={onExit} />
}
