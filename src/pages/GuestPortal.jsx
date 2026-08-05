import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { qpcLogo as QPC_LOGO } from '../lib/logos'
import { statusDot, statusClass, DashRow, SPORT_META, SPORTS_BY_CATEGORY, SPORT_CATEGORIES, sportLabel } from '../lib/helpers'
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [a, c, e, r] = await Promise.all([
        supabase.from('athletes').select('id, name, name_ar, sport, sport_category, classification, status'),
        supabase.from('coaches').select('id, name, name_ar, sport, sport_category, status'),
        supabase.from('events').select('*'),
        supabase.from('results').select('id, athlete_id, medal, discipline, event_name, date'),
      ])
      if (cancelled) return
      setAthletes(a.data || [])
      setCoaches(c.data || [])
      setEvents(e.data || [])
      setResults(r.data || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  return { athletes, coaches, events, results, loading }
}

function GuestBanner() {
  const { lang } = useLang()
  const ar = lang === 'ar'
  return (
    <div style={{ background: '#fef3c7', borderBottom: '1px solid #fcd34d', padding: '8px 16px', textAlign: 'center', fontSize: 12.5, color: '#92400e', fontWeight: 500 }}>
      <i className="ti ti-eye" style={{ marginInlineEnd: 6 }} />
      {ar
        ? 'وضع الضيف — أنت تستخدم النسخة العامة للقراءة فقط من نظام إدارة اللجنة البارالمبية القطرية.'
        : 'Guest Mode — You are viewing a public, read-only version of the Qatar Paralympic Committee Management System.'}
    </div>
  )
}

function GuestDashboard({ athletes, coaches, events }) {
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
      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', marginBottom: 14, minHeight: 140, display: 'flex', alignItems: 'center', background: '#1a0a14' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/dashboard-banner.jpg)', backgroundSize: 'cover', backgroundPosition: 'center center' }} />
        <div style={{ position: 'absolute', inset: 0, background: ar
          ? 'linear-gradient(to left, rgba(10,5,15,0.85) 0%, rgba(10,5,15,0.55) 40%, rgba(10,5,15,0.05) 65%)'
          : 'linear-gradient(to right, rgba(10,5,15,0.80) 0%, rgba(10,5,15,0.55) 40%, rgba(10,5,15,0.05) 65%)' }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '22px 28px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-.02em', marginBottom: 4 }}>
            {L('Qatar Paralympic Committee','اللجنة البارالمبية القطرية')}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)' }}>
            {L('Public overview — athletes, sports & events','نظرة عامة عامة — الرياضيون والرياضات والفعاليات')}
          </div>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
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
          return (
            <DashRow key={ev.id}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:statusDot(evStatus), flexShrink:0 }} />
              <span style={{ flex:1, fontSize:13 }}>{ar && ev.name_ar ? ev.name_ar : ev.name}</span>
              <span style={{ fontSize:11, color:'#9aa3b2' }}>{ev.start_date}</span>
              <span className={`badge ${statusClass(evStatus)}`}>{evStatus}</span>
            </DashRow>
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
          'The Qatar Paralympic Committee (QPC) is the national body responsible for developing and supporting Para sport in Qatar, empowering athletes with disabilities to compete and excel at the highest levels.',
          'اللجنة البارالمبية القطرية هي الجهة الوطنية المسؤولة عن تطوير ودعم الرياضة البارالمبية في قطر، وتمكين الرياضيين ذوي الإعاقة من المنافسة والتميز على أعلى المستويات.'
        )}
      </Section>
      <Section icon="ti-target-arrow" title={L('Mission','الرسالة')}>
        {L(
          'To promote, develop, and support Para sport across Qatar, providing pathways for athletes with disabilities from grassroots participation to international competition.',
          'تعزيز وتطوير ودعم الرياضة البارالمبية في جميع أنحاء قطر، وتوفير مسارات للرياضيين ذوي الإعاقة من المشاركة الشعبية إلى المنافسة الدولية.'
        )}
      </Section>
      <Section icon="ti-telescope" title={L('Vision','الرؤية')}>
        {L(
          'A leading Paralympic movement recognized for excellence, inclusion, and the achievements of its athletes on the world stage.',
          'حركة بارالمبية رائدة معترف بها للتميز والشمولية وإنجازات رياضييها على الساحة العالمية.'
        )}
      </Section>
      <Section icon="ti-list-check" title={L('Objectives','الأهداف')}>
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>
          <li>{L('Develop competitive Para sport programs across multiple disciplines','تطوير برامج رياضية بارالمبية تنافسية عبر عدة تخصصات')}</li>
          <li>{L('Support athlete pathways from training to international competition','دعم مسارات الرياضيين من التدريب إلى المنافسة الدولية')}</li>
          <li>{L('Raise awareness and promote inclusion of people with disabilities in sport','رفع الوعي وتعزيز إدماج ذوي الإعاقة في الرياضة')}</li>
          <li>{L('Build partnerships with national and international sporting bodies','بناء شراكات مع الهيئات الرياضية الوطنية والدولية')}</li>
        </ul>
      </Section>
      <Section icon="ti-history" title={L('Brief History','لمحة تاريخية')}>
        {L(
          'Since its establishment, QPC has grown its athlete base and competition programs, representing Qatar at regional and international Paralympic and Special Olympics events.',
          'منذ تأسيسها، وسّعت اللجنة قاعدة رياضييها وبرامجها التنافسية، ممثلةً قطر في الفعاليات البارالمبية والأولمبياد الخاص على المستويين الإقليمي والدولي.'
        )}
      </Section>
      <Section icon="ti-sitemap" title={L('Organization','الهيكل التنظيمي')}>
        {L(
          'QPC is organized around administrative, technical, and medical departments working together to support athletes, coaches, and events throughout the season.',
          'تتكون اللجنة من إدارات إدارية وفنية وطبية تعمل معاً لدعم الرياضيين والمدربين والفعاليات على مدار الموسم.'
        )}
      </Section>

      {/* Contact Us — placeholders, easily editable later by Admin */}
      <div className="card">
        <div className="card-title"><i className="ti ti-address-book" /> {L('Contact Us','تواصل معنا')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, fontSize: 13.5, color: 'var(--text2)' }}>
          <div><i className="ti ti-map-pin" style={{ marginInlineEnd: 8, color: '#0085C7' }} />{L('Address','العنوان')}: {L('Doha, Qatar','الدوحة، قطر')}</div>
          <div><i className="ti ti-phone" style={{ marginInlineEnd: 8, color: '#009F6B' }} />{L('Phone','الهاتف')}: <span dir="ltr">+974 XXXX XXXX</span></div>
          <div><i className="ti ti-mail" style={{ marginInlineEnd: 8, color: '#EE334E' }} />{L('Email','البريد الإلكتروني')}: info@qpc.qa</div>
          <div><i className="ti ti-world" style={{ marginInlineEnd: 8, color: '#8b5cf6' }} />{L('Website','الموقع الإلكتروني')}: www.qpc.qa</div>
          <div><i className="ti ti-brand-x" style={{ marginInlineEnd: 8, color: '#f59e0b' }} />{L('Social Media','وسائل التواصل')}: @QPCQatar</div>
        </div>
      </div>
    </div>
  )
}

function GuestPortalInner({ onExit }) {
  const { lang, setLang } = useLang()
  const ar = lang === 'ar'
  const [page, setPage] = useState('dashboard')
  const { athletes, coaches, events, results, loading } = useGuestData()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', direction: ar ? 'rtl' : 'ltr' }}>
      <GuestBanner />
      <div style={{ display: 'flex' }}>
        <div style={{ width: 220, minHeight: 'calc(100vh - 37px)', background: '#0d0d14', flexShrink: 0, padding: '18px 12px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 18px' }}>
            <img src={QPC_LOGO} alt="QPC" style={{ height: 28 }} />
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{ar ? 'اللجنة البارالمبية' : 'Qatar Paralympic'}</span>
          </div>
          <div style={{ flex: 1 }}>
            {GUEST_NAV.map(item => (
              <div key={item.id} onClick={() => setPage(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', marginBottom: 2,
                  background: page === item.id ? 'rgba(255,255,255,.08)' : 'transparent', color: page === item.id ? '#fff' : 'rgba(255,255,255,.6)' }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{ar ? item.ar : item.en}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => setLang(ar ? 'en' : 'ar')} style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 8, padding: '8px', color: 'rgba(255,255,255,.7)', fontSize: 12, cursor: 'pointer' }}>
              {ar ? 'EN' : 'عربي'}
            </button>
            <button onClick={onExit} style={{ background: '#0085C7', border: 'none', borderRadius: 8, padding: '9px', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <i className="ti ti-login" style={{ marginInlineEnd: 6 }} /> {ar ? 'تسجيل الدخول' : 'Sign In'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: 20, maxWidth: 1400, overflow: 'hidden' }}>
          {loading ? (
            <div className="empty" style={{ padding: 60 }}>{ar ? 'جارٍ التحميل…' : 'Loading…'}</div>
          ) : (
            <>
              {page === 'dashboard' && <GuestDashboard athletes={athletes} coaches={coaches} events={events} />}
              {page === 'calendar' && <Calendar profile={null} events={events} employees={[]} onNav={(p) => setPage(p === 'events' ? 'events' : page)} readOnly />}
              {page === 'events' && <Events events={events} athletes={athletes} employees={[]} results={results} registrations={[]} onRefresh={() => {}} onNav={() => {}} profile={null} eventCategories={[]} sportsList={[]} />}
              {page === 'sports' && <Sports athletes={athletes} coaches={coaches} events={events} results={results} onNav={(p) => setPage(p === 'sports' ? 'sports' : page)} profile={null} />}
              {page === 'about' && <AboutQPC />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function GuestPortal({ onExit }) {
  return <GuestPortalInner onExit={onExit} />
}
