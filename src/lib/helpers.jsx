export const AV_COLORS = ['#0085C7','#EE334E','#009F6B','#8b5cf6','#e67e22','#16a085','#c0392b','#2980b9']
// Paralympic sports. Existing data uses flat names (Athletics, Swimming, etc.) rather
// than "Para X" — kept that way so the 100+ existing athlete/coach records continue
// to match a SPORT_META entry without needing a data migration. "Para" is implicit
// (this whole list is the Paralympic program), matching how the data already works.
export const PARALYMPIC_SPORTS = [
  'Athletics', 'Swimming', 'Powerlifting', 'Goalball',
  'Boccia', 'Table Tennis', 'Wheelchair Basketball',
]

// Special Olympics disciplines. Named distinctly from their Paralympic counterparts
// above (e.g. "Athletics (Special Olympics)" vs "Athletics") so picking one is never
// ambiguous with the other program's version of the same sport.
export const SPECIAL_OLYMPICS_SPORTS = [
  'Athletics (Special Olympics)', 'Bocce', 'Powerlifting (Special Olympics)',
  'Badminton', 'Table Tennis (Special Olympics)', 'Skating',
]

// Legacy: many existing records simply have sport = 'Special Olympics' (the program
// as a whole, not a specific discipline) — kept selectable so those records keep
// displaying and filtering correctly. New records should pick a specific discipline
// from SPECIAL_OLYMPICS_SPORTS above instead, once it's known.
const LEGACY_SPORTS = ['Special Olympics']

export const SPORTS = [...PARALYMPIC_SPORTS, ...SPECIAL_OLYMPICS_SPORTS, ...LEGACY_SPORTS]

// The two sport categories/programs. Stored on athletes.sport_category and
// coaches.sport_category so the org structure (which program someone belongs to)
// is explicit rather than inferred from the sport name alone.
export const SPORT_CATEGORIES = ['Paralympic', 'Special Olympics']

// Which sports belong to which category — drives the sport dropdown filtering by
// category in forms, and lets filters/pages group sports under the right heading.
export const SPORTS_BY_CATEGORY = {
  'Paralympic':        [...PARALYMPIC_SPORTS, 'Special Olympics'], // legacy flat value can appear under either; shown here so it's still selectable
  'Special Olympics':  [...SPECIAL_OLYMPICS_SPORTS, 'Special Olympics'],
}

export const SPORT_CATEGORY_NAMES_AR = {
  'Paralympic':        'الرياضات البارالمبية',
  'Special Olympics':  'الأولمبياد الخاص',
}

// Arabic display names — single source of truth, used by every page/form that
// shows a sport name (Sports.jsx, Dashboard.jsx, FormModal.jsx, Coaches.jsx, etc.)
export const SPORT_NAMES_AR = {
  'Athletics':                           'ألعاب القوى',
  'Swimming':                            'السباحة',
  'Powerlifting':                        'رفع الأثقال',
  'Goalball':                            'كرة الهدف',
  'Boccia':                              'البوتشيا',
  'Table Tennis':                        'تنس الطاولة',
  'Wheelchair Basketball':               'كرة السلة على الكراسي المتحركة',
  'Athletics (Special Olympics)':        'ألعاب القوى (الأولمبياد الخاص)',
  'Bocce':                               'البوتشي',
  'Powerlifting (Special Olympics)':     'رفع الأثقال (الأولمبياد الخاص)',
  'Badminton':                           'الريشة الطائرة',
  'Table Tennis (Special Olympics)':     'تنس الطاولة (الأولمبياد الخاص)',
  'Skating':                             'التزلج',
  'Special Olympics':                    'الأولمبياد الخاص',
}

export const SPORT_META = {
  'Athletics':                        { icon: 'ti-run',          color: '#0085C7', desc: 'Track and field events, classifications T/F 11–64.' },
  'Swimming':                         { icon: 'ti-ripple',       color: '#009F6B', desc: 'All strokes, classifications S1–S14.' },
  'Powerlifting':                     { icon: 'ti-barbell',      color: '#EE334E', desc: 'Bench press, weight categories 49kg–+107kg.' },
  'Goalball':                         { icon: 'ti-ball-football',color: '#8b5cf6', desc: 'Team sport for the blind/visually impaired, played by sound.' },
  'Boccia':                           { icon: 'ti-disc',         color: '#e67e22', desc: 'Precision ball sport, classes BC1–BC4.' },
  'Table Tennis':                     { icon: 'ti-table-tennis-bat', color: '#16a085', desc: 'Standing and wheelchair classes.' },
  'Wheelchair Basketball':            { icon: 'ti-basketball',   color: '#c0392b', desc: 'Team sport played in wheelchairs, point classification system.' },
  'Athletics (Special Olympics)':     { icon: 'ti-run',          color: '#2980b9', desc: 'Special Olympics track and field.' },
  'Bocce':                            { icon: 'ti-disc',         color: '#27ae60', desc: 'Special Olympics precision ball sport.' },
  'Powerlifting (Special Olympics)':  { icon: 'ti-barbell',      color: '#d35400', desc: 'Special Olympics powerlifting.' },
  'Badminton':                        { icon: 'ti-feather',      color: '#8e44ad', desc: 'Special Olympics badminton.' },
  'Table Tennis (Special Olympics)':  { icon: 'ti-table-tennis-bat', color: '#1abc9c', desc: 'Special Olympics table tennis.' },
  'Skating':                          { icon: 'ti-shoe',         color: '#34495e', desc: 'Special Olympics skating.' },
  'Special Olympics':                 { icon: 'ti-medal',        color: '#9b59b6', desc: 'General Special Olympics program — specific discipline not yet set.' },
}

export const avColor  = id => AV_COLORS[id % AV_COLORS.length]
export const initials = n  => n.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()

export const statusClass = s => ({
  Active:                 'badge-green',
  Inactive:               'badge-gray',
  Suspended:              'badge-red',
  'Under Medical Review': 'badge-amber',
  Injured:                'badge-amber',
  Retired:                'badge-gray',
  'On Leave':             'badge-amber',
  Upcoming:               'badge-blue',
  Completed:              'badge-green',
  'Registration Open':    'badge-purple',
  Planning:               'badge-gray',
}[s] || 'badge-gray')

export const statusDot = s => ({
  Active:                 '#009F6B',
  Inactive:               '#aaa',
  Suspended:              '#EE334E',
  'Under Medical Review': '#e67e22',
  Injured:                '#e67e22',
  Retired:                '#9aa3b2',
  'On Leave':             '#e67e22',
  Upcoming:               '#0085C7',
  Completed:              '#009F6B',
  'Registration Open':    '#8b5cf6',
  Planning:               '#aaa',
}[s] || '#aaa')

export const medalEmoji = m => ({ gold: '🥇', silver: '🥈', bronze: '🥉' }[m] || '')

export function MedalDisplay({ gold, silver, bronze }) {
  if (!gold && !silver && !bronze) return <span style={{ color: '#aaa', fontSize: 12 }}>—</span>
  return (
    <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {gold   > 0 && <span style={{ fontSize: 12 }}>🥇{gold}</span>}
      {silver > 0 && <span style={{ fontSize: 12, marginLeft: 4 }}>🥈{silver}</span>}
      {bronze > 0 && <span style={{ fontSize: 12, marginLeft: 4 }}>🥉{bronze}</span>}
    </span>
  )
}

export function Avatar({ name, id, size = 32, fs = 11 }) {
  return (
    <div className="av" style={{ width: size, height: size, fontSize: fs, background: avColor(id), flexShrink: 0 }}>
      {initials(name)}
    </div>
  )
}

export function Badge({ label, cls }) {
  return <span className={`badge ${cls || statusClass(label)}`}>{label}</span>
}

export function Loading() {
  return <div className="loading"><div className="spinner" /><span>Loading…</span></div>
}

export function DashRow({ children, onClick }) {
  return (
    <div className="dash-row" onClick={onClick}>
      {children}
      <i className="ti ti-chevron-right row-arrow" />
    </div>
  )
}
