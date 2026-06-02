export const AV_COLORS = ['#0085C7','#EE334E','#009F6B','#8b5cf6','#e67e22','#16a085','#c0392b','#2980b9']
export const SPORTS = ['Athletics','Swimming','Powerlifting','Boccia','Shooting','Wheelchair Tennis']
export const SPORT_META = {
  Athletics:        { icon: 'ti-run',          color: '#0085C7', desc: 'Track and field events, classifications T/F 11–64.' },
  Swimming:         { icon: 'ti-ripple',        color: '#009F6B', desc: 'All strokes, classifications S1–S14.' },
  Powerlifting:     { icon: 'ti-barbell',       color: '#EE334E', desc: 'Bench press, weight categories 49kg–+107kg.' },
  Boccia:           { icon: 'ti-ball-football', color: '#8b5cf6', desc: 'Precision ball sport, classes BC1–BC4.' },
  Shooting:         { icon: 'ti-target',        color: '#e67e22', desc: 'Rifle & pistol disciplines, SH1/SH2.' },
  'Wheelchair Tennis': { icon: 'ti-tennis',     color: '#16a085', desc: 'Two-bounce rule, Open & Quad divisions.' },
}

export const avColor  = id => AV_COLORS[id % AV_COLORS.length]
export const initials = n  => n.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()

export const statusClass = s => ({
  Active: 'badge-green', 'In Training': 'badge-blue', Inactive: 'badge-gray',
  'On Leave': 'badge-amber', Upcoming: 'badge-blue', Completed: 'badge-green',
  'Registration Open': 'badge-purple', Planning: 'badge-gray',
}[s] || 'badge-gray')

export const statusDot = s => ({
  Active: '#009F6B', 'In Training': '#0085C7', Inactive: '#aaa',
  'On Leave': '#e67e22', Upcoming: '#0085C7', Completed: '#009F6B',
  'Registration Open': '#8b5cf6', Planning: '#aaa',
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
