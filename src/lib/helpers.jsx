import { useState, useEffect, useRef } from 'react'

export const AV_COLORS = ['#0085C7','#EE334E','#009F6B','#8b5cf6','#e67e22','#16a085','#c0392b','#2980b9']

export const SPORT_CATEGORIES = [
  'Summer Paralympic', 'Winter Paralympic',
  'Summer Special Olympics', 'Winter Special Olympics',
  'Unified Sports',
]

export const SPORT_CATEGORY_NAMES_AR = {
  'Summer Paralympic':         'الرياضات البارالمبية الصيفية',
  'Winter Paralympic':         'الرياضات البارالمبية الشتوية',
  'Summer Special Olympics':   'الأولمبياد الخاص الصيفي',
  'Winter Special Olympics':   'الأولمبياد الخاص الشتوي',
  'Unified Sports':            'الرياضات الموحدة',
}

export const SUMMER_PARALYMPIC_SPORTS = [
  'Athletics', 'Archery', 'Badminton', 'Boccia', 'Canoe', 'Climbing',
  'Cycling', 'Equestrian', 'Blind Football', 'Goalball', 'Judo',
  'Powerlifting', 'Rowing', 'Shooting', 'Sitting Volleyball', 'Swimming',
  'Table Tennis', 'Taekwondo', 'Triathlon', 'Wheelchair Basketball',
  'Wheelchair Fencing', 'Wheelchair Rugby', 'Wheelchair Tennis',
]

export const WINTER_PARALYMPIC_SPORTS = [
  'Alpine Skiing', 'Biathlon', 'Cross-Country Skiing', 'Para Ice Hockey',
  'Snowboard', 'Wheelchair Curling',
]

export const SUMMER_SPECIAL_OLYMPICS_SPORTS = [
  'Athletics', 'Swimming', 'Archery', 'Badminton', 'Basketball', 'Bocce',
  'Bowling', 'Cycling', 'Equestrian', 'Football', 'Golf', 'Gymnastics',
  'Handball', 'Judo', 'Kayaking', 'Netball', 'Open Water Swimming',
  'Powerlifting', 'Roller Skating', 'Sailing', 'Softball', 'Table Tennis',
  'Tennis', 'Triathlon', 'Volleyball',
]

export const WINTER_SPECIAL_OLYMPICS_SPORTS = [
  'Alpine Skiing', 'Cross-Country Skiing', 'Figure Skating', 'Floorball',
  'Snowboarding', 'Snowshoeing', 'Short Track Speed Skating',
]

export const UNIFIED_SPORTS_GROUPS = {
  'Unified Team Sports': [
    'Unified Basketball', 'Unified Football', 'Unified Futsal',
    'Unified Volleyball', 'Unified Beach Volleyball', 'Unified Softball',
    'Unified Floorball', 'Unified Handball',
  ],
  'Unified Individual / Dual Sports': [
    'Unified Athletics (Relays and Team Events)', 'Unified Swimming Relays',
    'Unified Bowling', 'Unified Bocce', 'Unified Golf', 'Unified Tennis',
    'Unified Table Tennis', 'Unified Badminton', 'Unified Cycling',
    'Unified Triathlon',
  ],
  'Unified Winter Sports': [
    'Unified Alpine Skiing', 'Unified Cross-Country Skiing',
    'Unified Snowshoeing', 'Unified Snowboarding',
  ],
  'Unified Young Athletes & School Programs': [
    'Unified Athletics', 'Unified Fitness Activities',
    'Unified Recreational Games', 'Unified Physical Education',
  ],
}
export const UNIFIED_SPORTS = Object.values(UNIFIED_SPORTS_GROUPS).flat()

const LEGACY_SPORTS = ['Special Olympics']

const PARALYMPIC_NO_PREFIX = [
  'Boccia', 'Blind Football', 'Goalball', 'Sitting Volleyball',
  'Wheelchair Basketball', 'Wheelchair Fencing', 'Wheelchair Rugby',
  'Wheelchair Tennis', 'Wheelchair Curling', 'Para Ice Hockey',
]

export const SPORTS = [...new Set([
  ...SUMMER_PARALYMPIC_SPORTS, ...WINTER_PARALYMPIC_SPORTS,
  ...SUMMER_SPECIAL_OLYMPICS_SPORTS, ...WINTER_SPECIAL_OLYMPICS_SPORTS,
  ...UNIFIED_SPORTS, ...LEGACY_SPORTS,
])]

export const SPORTS_BY_CATEGORY = {
  'Summer Paralympic':        [...SUMMER_PARALYMPIC_SPORTS, 'Special Olympics'],
  'Winter Paralympic':        WINTER_PARALYMPIC_SPORTS,
  'Summer Special Olympics':  [...SUMMER_SPECIAL_OLYMPICS_SPORTS, 'Special Olympics'],
  'Winter Special Olympics':  WINTER_SPECIAL_OLYMPICS_SPORTS,
  'Unified Sports':           UNIFIED_SPORTS,
}

// Shared search normalizer — used everywhere a page filters a list by a
// free-text search box, so behavior stays identical/language-independent
// across Athletes, Employees, Coaches, Referees, Events, Results, Tasks,
// Resources, Calendar, Requests, Attendance, etc. instead of every page
// re-implementing its own ad-hoc lowercase/trim logic.
//
// Normalizes: case, leading/trailing/repeated whitespace, Arabic letter
// variants (أ/إ/آ/ٱ -> ا, ى -> ي, ة -> ه), Arabic diacritics (removed), and
// Arabic-Indic / Extended-Arabic-Indic digits -> Western digits — so a
// search for "مدرب" matches "مدرّب", "قصي" matches "قصى", and "١٢٣" matches
// records stored as "123".
const AR_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g
const AR_DIGIT_MAP = {
  '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9', // Arabic-Indic
  '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9', // Extended (Persian/Urdu)
}
export function normalizeSearch(value) {
  if (value === null || value === undefined) return ''
  let s = String(value)
  s = s.replace(AR_DIACRITICS, '')
  s = s.replace(/[٠-٩۰-۹]/g, d => AR_DIGIT_MAP[d] || d)
  s = s.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  s = s.toLowerCase()
  s = s.replace(/\s+/g, ' ').trim()
  return s
}
// Joins any number of field values into one normalized, space-separated
// search haystack for a single record.
export function buildSearchText(...fields) {
  return normalizeSearch(fields
    .map(v => {
      if (v === null || v === undefined) return ''
      if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10)
      return String(v)
    })
    .join(' '))
}
// True if every word in the (already-typed) query appears somewhere in the
// normalized haystack — use with buildSearchText/normalizeSearch together:
//   matchesSearch(buildSearchText(a.name, a.name_ar, ...), query)
export function matchesSearch(haystack, query) {
  const q = normalizeSearch(query)
  if (!q) return true
  const h = normalizeSearch(haystack)
  return q.split(' ').every(word => h.includes(word))
}

// Shared by the Athlete and Employee bulk document importers: the part of
// Real-world filenames aren't always underscore-separated (e.g.
// "27378800325 NABIL MESSELMANI Photo.pdf" uses spaces). The Qatar ID is
// always the leading continuous run of digits at the very start of the
// filename, so extraction grabs exactly that — stopping at the first
// non-digit character, whatever it is (space, underscore, hyphen, letter).
// Arabic-Indic/Persian digits are converted to Western first so a QID
// typed in Arabic numerals is still recognized as a leading digit run.
// This is a strict superset of the old "before first underscore" rule
// (a pure-digit QID immediately followed by "_" already terminates the
// digit run at that underscore), so existing Athlete filenames still
// extract identically — this change is backward-compatible.
export function extractQidFromFilename(filename) {
  const base = filename.split('.').slice(0, -1).join('.') || filename
  const westernized = base.replace(/[٠-٩۰-۹]/g, d => AR_DIGIT_MAP[d] || d)
  const match = westernized.match(/^\s*(\d+)/)
  return match ? match[1] : ''
}
// Normalizes a Qatar ID / Residence number for exact-match comparison:
// strips spaces/hyphens, converts Arabic-Indic/Persian digits to Western,
// trims. Used by the Employee bulk importer (per its explicit requirement
// for more robust matching than a plain filename QID needs) — the Athlete
// importer's own plain-trim matching is untouched.
export function normalizeQid(value) {
  if (value === null || value === undefined) return ''
  let s = String(value).replace(/[\s-]/g, '')
  s = s.replace(/[٠-٩۰-۹]/g, d => AR_DIGIT_MAP[d] || d)
  return s.trim()
}

// Detects a document type from the free-text part of a filename that
// follows the Qatar ID (e.g. "27378800325 NABIL MESSELMANI Photo.pdf" ->
// 'Photo'). Matching is alias-based, case-insensitive, and ignores
// underscores/hyphens/repeated spaces/emoji so it's resilient to however
// the file was actually named. Returns null (Unknown) if no alias matches.
// More specific aliases (e.g. "original passport") are checked before
// shorter ones so longer phrases win when both could match.
const DOC_TYPE_ALIASES = [
  { type: 'Photo', words: ['photo', 'photograph', 'صورة'] },
  { type: 'Original Passport', words: ['original passport', 'passport', 'جواز السفر', 'جواز'] },
  { type: 'Qatar ID', words: ['qatar id', 'qid', 'البطاقة الشخصية', 'الرقم الشخصي', 'قطر id', 'id card', 'id'] },
  { type: 'ADEL Certificate', words: ['adel certificate', 'adel cert', 'adel', 'شهادة adel', 'شهادة اديل', 'اديل'] },
  { type: 'Residence Permit', words: ['residence permit', 'residence', 'تصريح الإقامة'] },
  { type: 'Contract', words: ['contract', 'العقد'] },
  { type: 'Certificate', words: ['certificate', 'الشهادة'] },
  { type: 'Medical Report', words: ['medical report', 'medical', 'التقرير الطبي'] },
]
export function detectDocTypeFromFilename(filename, qid) {
  const base = filename.split('.').slice(0, -1).join('.') || filename
  // Strip the leading QID digits so a QID like "123" can't accidentally
  // match the "id"/"qid" alias, then normalize separators to spaces.
  let rest = qid ? base.replace(new RegExp('^\\s*' + qid), '') : base
  rest = rest.replace(/[_\-]+/g, ' ')
  rest = rest.replace(/[^\p{L}\p{N}\s]/gu, ' ') // strip emoji/symbols
  rest = normalizeSearch(rest)
  for (const { type, words } of DOC_TYPE_ALIASES) {
    for (const w of words) {
      if (rest.includes(normalizeSearch(w))) return type
    }
  }
  return null
}
export const SUPPORTED_DOC_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
export const MAX_DOC_FILE_SIZE_BYTES = 20 * 1024 * 1024 // matches the individual-upload limit

export function sportLabel(sport, category, ar) {
  if (!sport) return ''
  const base = ar ? (SPORT_NAMES_AR[sport] || sport) : sport

  const isParalympicCategory = category === 'Summer Paralympic' || category === 'Winter Paralympic'
  const isSpecialOlympicsCategory = category === 'Summer Special Olympics' || category === 'Winter Special Olympics'
  const isUnknownCategory = !category || category === 'All' || category === 'All categories'

  if (isSpecialOlympicsCategory) {
    return ar ? `${base} (الأولمبياد الخاص)` : `SO ${base}`
  }
  if (isParalympicCategory || isUnknownCategory) {
    if (PARALYMPIC_NO_PREFIX.includes(sport) || sport === 'Special Olympics') return base
    return ar ? `${base} (بارالمبي)` : `Para ${base}`
  }
  return base
}

// Shared multi-sport breakdown — the single source of truth for "how many
// unique athletes are in each sport" across the Sports page and every
// dashboard's Sports Breakdown widget, so they can never disagree.
// Counts come from athlete_sports (the real per-sport assignment
// relationship), never athletes.sport (the legacy single-sport field).
// An athlete assigned to multiple sports counts once in each of them —
// this deliberately does not assume per-sport counts sum to the total
// unique athlete count, since that's only true for single-sport athletes.
//
// sportsCatalog: rows from the `sports` table — [{ id, name, category, ... }]
// athleteSportRows: rows from `athlete_sports` — [{ athlete_id, sport_id }]
// Returns short-name entries (catalog prefix stripped, e.g. "Para
// Swimming" -> "Swimming") so existing sportLabel()/SPORT_META lookups
// keep working unchanged for icon/color/Arabic-label purposes.
export function computeSportsBreakdown(sportsCatalog, athleteSportRows) {
  const athleteIdsBySportId = {}
  for (const row of (athleteSportRows || [])) {
    if (row.sport_id == null || row.athlete_id == null) continue
    if (!athleteIdsBySportId[row.sport_id]) athleteIdsBySportId[row.sport_id] = new Set()
    athleteIdsBySportId[row.sport_id].add(row.athlete_id)
  }
  return (sportsCatalog || [])
    .map(s => ({
      sport: (s.name || '').replace(/^(Para |SO |Unified )/, ''),
      category: s.category,
      count: athleteIdsBySportId[s.id]?.size || 0,
    }))
    .filter(e => e.sport && e.count > 0)
}

export const SPORT_NAMES_AR = {
  'Athletics':                 'ألعاب القوى',
  'Archery':                   'الرماية بالقوس',
  'Badminton':                 'الريشة الطائرة',
  'Boccia':                    'البوتشيا',
  'Canoe':                     'التجديف بالكاياك',
  'Climbing':                  'تسلق الجبال',
  'Cycling':                   'الدراجات',
  'Equestrian':                'الفروسية',
  'Blind Football':            'كرة القدم للمكفوفين',
  'Goalball':                  'كرة الهدف',
  'Judo':                      'الجودو',
  'Powerlifting':               'رفع الأثقال',
  'Rowing':                    'التجديف',
  'Shooting':                  'الرماية',
  'Sitting Volleyball':        'الكرة الطائرة الجالسة',
  'Swimming':                  'السباحة',
  'Table Tennis':              'تنس الطاولة',
  'Taekwondo':                 'التايكوندو',
  'Triathlon':                 'الترايثلون',
  'Wheelchair Basketball':     'كرة السلة على الكراسي المتحركة',
  'Wheelchair Fencing':        'سلاح الشيش على الكراسي المتحركة',
  'Wheelchair Rugby':          'الرغبي على الكراسي المتحركة',
  'Wheelchair Tennis':         'التنس على الكراسي المتحركة',
  'Alpine Skiing':             'التزلج الألبي',
  'Biathlon':                  'البياثلون',
  'Cross-Country Skiing':      'التزلج الريفي',
  'Para Ice Hockey':           'هوكي الجليد البارالمبي',
  'Snowboard':                 'التزلج على الجليد',
  'Wheelchair Curling':        'الكيرلنغ على الكراسي المتحركة',
  'Basketball':                'كرة السلة',
  'Bocce':                     'البوتشي',
  'Bowling':                   'البولينغ',
  'Football':                  'كرة القدم',
  'Golf':                      'الغولف',
  'Gymnastics':                'الجمباز',
  'Handball':                  'كرة اليد',
  'Kayaking':                  'التجديف بالكاياك',
  'Netball':                   'كرة الشبكة',
  'Open Water Swimming':       'السباحة في المياه المفتوحة',
  'Roller Skating':            'التزلج بالعجلات',
  'Sailing':                   'الشراع',
  'Softball':                  'الكرة الطرية',
  'Tennis':                    'التنس',
  'Volleyball':                'الكرة الطائرة',
  'Figure Skating':            'التزلج الفني',
  'Floorball':                 'الفلوربول',
  'Snowboarding':              'التزلج على الجليد',
  'Short Track Speed Skating': 'التزلج السريع المضمار القصير',
  'Special Olympics':          'الأولمبياد الخاص',
  'Unified Basketball':        'كرة السلة الموحدة',
  'Unified Football':          'كرة القدم الموحدة',
  'Unified Futsal':            'كرة الصالات الموحدة',
  'Unified Volleyball':        'الكرة الطائرة الموحدة',
  'Unified Beach Volleyball':  'الكرة الطائرة الشاطئية الموحدة',
  'Unified Softball':          'الكرة الطرية الموحدة',
  'Unified Floorball':         'الفلوربول الموحد',
  'Unified Handball':          'كرة اليد الموحدة',
  'Unified Athletics (Relays and Team Events)': 'ألعاب القوى الموحدة (تتابع وفرق)',
  'Unified Swimming Relays':   'سباحة التتابع الموحدة',
  'Unified Bowling':           'البولينغ الموحد',
  'Unified Bocce':             'البوتشي الموحد',
  'Unified Golf':              'الغولف الموحد',
  'Unified Tennis':            'التنس الموحد',
  'Unified Table Tennis':      'تنس الطاولة الموحد',
  'Unified Badminton':         'الريشة الطائرة الموحدة',
  'Unified Cycling':           'الدراجات الموحدة',
  'Unified Triathlon':         'الترايثلون الموحد',
  'Unified Alpine Skiing':     'التزلج الألبي الموحد',
  'Unified Cross-Country Skiing': 'التزلج الريفي الموحد',
  'Unified Snowshoeing':       'المشي بأحذية الثلج الموحد',
  'Unified Snowboarding':      'التزلج على الجليد الموحد',
  'Unified Athletics':         'ألعاب القوى الموحدة',
  'Unified Fitness Activities':'أنشطة اللياقة الموحدة',
  'Unified Recreational Games':'الألعاب الترفيهية الموحدة',
  'Unified Physical Education':'التربية البدنية الموحدة',
}

export const SPORT_META = {
  'Athletics':                 { icon: 'ti-run',           color: '#0085C7', desc: 'Track and field events.' },
  'Archery':                   { icon: 'ti-target-arrow',  color: '#8e44ad', desc: 'Precision target shooting with a bow.' },
  'Badminton':                 { icon: 'ti-feather',       color: '#8e44ad', desc: 'Racquet sport.' },
  'Boccia':                    { icon: 'ti-disc',          color: '#e67e22', desc: 'Precision ball sport, classes BC1–BC4.' },
  'Canoe':                     { icon: 'ti-anchor',        color: '#16a085', desc: 'Sprint kayak/canoe racing.' },
  'Climbing':                  { icon: 'ti-mountain',      color: '#c0392b', desc: 'Sport climbing — debut at LA 2028.' },
  'Cycling':                   { icon: 'ti-bike',          color: '#2980b9', desc: 'Road and track cycling.' },
  'Equestrian':                { icon: 'ti-horse-toy',         color: '#8e6b3d', desc: 'Dressage and equestrian events.' },
  'Blind Football':            { icon: 'ti-ball-football', color: '#34495e', desc: 'Football 5-a-side for visually impaired athletes.' },
  'Goalball':                  { icon: 'ti-ball-football', color: '#8b5cf6', desc: 'Team sport for the blind/visually impaired, played by sound.' },
  'Judo':                      { icon: 'ti-yin-yang',      color: '#2c3e50', desc: 'Combat sport for visually impaired athletes.' },
  'Powerlifting':              { icon: 'ti-barbell',       color: '#EE334E', desc: 'Bench press.' },
  'Rowing':                    { icon: 'ti-anchor',        color: '#16a085', desc: 'Indoor and water rowing events.' },
  'Shooting':                  { icon: 'ti-target',        color: '#7f8c8d', desc: 'Rifle and pistol shooting.' },
  'Sitting Volleyball':        { icon: 'ti-ball-volleyball', color: '#d35400', desc: 'Volleyball played seated on the court.' },
  'Swimming':                  { icon: 'ti-ripple',        color: '#009F6B', desc: 'All strokes, classifications S1–S14.' },
  'Table Tennis':               { icon: 'ti-ping-pong', color: '#16a085', desc: 'Standing and wheelchair classes.' },
  'Taekwondo':                 { icon: 'ti-yin-yang',      color: '#2c3e50', desc: 'Combat sport, kyorugi sparring.' },
  'Triathlon':                  { icon: 'ti-run',           color: '#27ae60', desc: 'Swim, cycle, run combined event.' },
  'Wheelchair Basketball':     { icon: 'ti-ball-basketball',    color: '#c0392b', desc: 'Team sport played in wheelchairs, point classification system.' },
  'Wheelchair Fencing':        { icon: 'ti-sword',         color: '#7f8c8d', desc: 'Fencing for wheelchair users.' },
  'Wheelchair Rugby':          { icon: 'ti-ball-american-football',    color: '#34495e', desc: 'Full-contact team sport in wheelchairs.' },
  'Wheelchair Tennis':         { icon: 'ti-ball-tennis',        color: '#16a085', desc: 'Two-bounce rule, Open & Quad divisions.' },
  'Alpine Skiing':             { icon: 'ti-snowflake',     color: '#3498db', desc: 'Downhill, slalom, and giant slalom.' },
  'Biathlon':                  { icon: 'ti-target',        color: '#7f8c8d', desc: 'Cross-country skiing combined with rifle shooting.' },
  'Cross-Country Skiing':      { icon: 'ti-snowflake',     color: '#3498db', desc: 'Endurance skiing events.' },
  'Para Ice Hockey':           { icon: 'ti-ice-skating',   color: '#2c3e50', desc: 'Sled hockey for athletes with lower-body impairments.' },
  'Snowboard':                  { icon: 'ti-snowflake',     color: '#3498db', desc: 'Snowboard cross and banked slalom.' },
  'Wheelchair Curling':        { icon: 'ti-target',        color: '#7f8c8d', desc: 'Curling for wheelchair users, no sweeping.' },
  'Basketball':                { icon: 'ti-ball-basketball',    color: '#c0392b', desc: 'Special Olympics basketball.' },
  'Bocce':                     { icon: 'ti-disc',          color: '#27ae60', desc: 'Special Olympics precision ball sport.' },
  'Bowling':                   { icon: 'ti-disc',          color: '#9b59b6', desc: 'Tenpin bowling.' },
  'Football':                  { icon: 'ti-ball-football', color: '#27ae60', desc: 'Special Olympics football/soccer.' },
  'Golf':                      { icon: 'ti-golf',          color: '#27ae60', desc: 'Special Olympics golf.' },
  'Gymnastics':                { icon: 'ti-yoga',          color: '#e84393', desc: 'Artistic and rhythmic gymnastics.' },
  'Handball':                  { icon: 'ti-ball-football', color: '#d35400', desc: 'Team handball.' },
  'Kayaking':                  { icon: 'ti-anchor',        color: '#16a085', desc: 'Kayak paddling events.' },
  'Netball':                   { icon: 'ti-ball-basketball', color: '#e67e22', desc: 'Netball.' },
  'Open Water Swimming':       { icon: 'ti-ripple',        color: '#009F6B', desc: 'Long-distance open water swimming.' },
  'Roller Skating':            { icon: 'ti-shoe',          color: '#9b59b6', desc: 'Roller skating events.' },
  'Sailing':                   { icon: 'ti-sailboat',      color: '#2980b9', desc: 'Sailing regattas.' },
  'Softball':                  { icon: 'ti-ball-baseball', color: '#d35400', desc: 'Softball.' },
  'Tennis':                    { icon: 'ti-ball-tennis',        color: '#16a085', desc: 'Tennis.' },
  'Volleyball':                { icon: 'ti-ball-volleyball', color: '#d35400', desc: 'Volleyball.' },
  'Figure Skating':            { icon: 'ti-ice-skating',   color: '#2c3e50', desc: 'Figure skating.' },
  'Floorball':                 { icon: 'ti-ball-football', color: '#34495e', desc: 'Indoor floorball.' },
  'Snowboarding':              { icon: 'ti-snowflake',     color: '#3498db', desc: 'Special Olympics snowboarding.' },
  'Snowshoeing':               { icon: 'ti-snowflake',     color: '#3498db', desc: 'Snowshoe racing.' },
  'Short Track Speed Skating': { icon: 'ti-ice-skating',   color: '#2c3e50', desc: 'Short track speed skating.' },
  'Special Olympics':          { icon: 'ti-medal',         color: '#9b59b6', desc: 'General Special Olympics program — specific discipline not yet set.' },
  'Unified Basketball':        { icon: 'ti-ball-basketball',    color: '#c0392b', desc: 'Unified Sports basketball.' },
  'Unified Football':          { icon: 'ti-ball-football', color: '#27ae60', desc: 'Unified Sports football/soccer.' },
  'Unified Futsal':            { icon: 'ti-ball-football', color: '#27ae60', desc: 'Unified Sports futsal.' },
  'Unified Volleyball':        { icon: 'ti-ball-volleyball', color: '#d35400', desc: 'Unified Sports volleyball.' },
  'Unified Beach Volleyball':  { icon: 'ti-ball-volleyball', color: '#f39c12', desc: 'Unified Sports beach volleyball.' },
  'Unified Softball':          { icon: 'ti-ball-baseball', color: '#d35400', desc: 'Unified Sports softball.' },
  'Unified Floorball':         { icon: 'ti-ball-football', color: '#34495e', desc: 'Unified Sports floorball.' },
  'Unified Handball':          { icon: 'ti-ball-football', color: '#d35400', desc: 'Unified Sports handball.' },
  'Unified Athletics (Relays and Team Events)': { icon: 'ti-run', color: '#0085C7', desc: 'Unified relays and team athletics events.' },
  'Unified Swimming Relays':   { icon: 'ti-ripple',        color: '#009F6B', desc: 'Unified swimming relay events.' },
  'Unified Bowling':           { icon: 'ti-disc',          color: '#9b59b6', desc: 'Unified Sports bowling.' },
  'Unified Bocce':             { icon: 'ti-disc',          color: '#27ae60', desc: 'Unified Sports bocce.' },
  'Unified Golf':              { icon: 'ti-golf',          color: '#27ae60', desc: 'Unified Sports golf.' },
  'Unified Tennis':            { icon: 'ti-ball-tennis',        color: '#16a085', desc: 'Unified Sports tennis.' },
  'Unified Table Tennis':      { icon: 'ti-ping-pong', color: '#16a085', desc: 'Unified Sports table tennis.' },
  'Unified Badminton':         { icon: 'ti-feather',       color: '#8e44ad', desc: 'Unified Sports badminton.' },
  'Unified Cycling':           { icon: 'ti-bike',          color: '#2980b9', desc: 'Unified Sports cycling.' },
  'Unified Triathlon':         { icon: 'ti-run',           color: '#27ae60', desc: 'Unified Sports triathlon.' },
  'Unified Alpine Skiing':     { icon: 'ti-snowflake',     color: '#3498db', desc: 'Unified Sports alpine skiing.' },
  'Unified Cross-Country Skiing': { icon: 'ti-snowflake',  color: '#3498db', desc: 'Unified Sports cross-country skiing.' },
  'Unified Snowshoeing':       { icon: 'ti-snowflake',     color: '#3498db', desc: 'Unified Sports snowshoeing.' },
  'Unified Snowboarding':      { icon: 'ti-snowflake',     color: '#3498db', desc: 'Unified Sports snowboarding.' },
  'Unified Athletics':         { icon: 'ti-run',           color: '#0085C7', desc: 'Young Athletes unified athletics program.' },
  'Unified Fitness Activities':{ icon: 'ti-stretching',    color: '#27ae60', desc: 'Young Athletes fitness activities.' },
  'Unified Recreational Games':{ icon: 'ti-ball-football', color: '#f39c12', desc: 'Young Athletes recreational games.' },
  'Unified Physical Education':{ icon: 'ti-stretching',    color: '#27ae60', desc: 'Unified physical education programming.' },
}

export const avColor  = id => AV_COLORS[id % AV_COLORS.length]

export const SPORT_DESC_AR = {
  'Athletics':                 'فعاليات ألعاب القوى الميدانية والمضمار.',
  'Archery':                   'الرماية الدقيقة بالقوس على الهدف.',
  'Badminton':                 'رياضة الريشة الطائرة.',
  'Boccia':                    'رياضة الكرة الدقيقة، فئات BC1–BC4.',
  'Canoe':                     'سباقات التجديف بالكاياك/الكانو.',
  'Climbing':                  'تسلق رياضي — سيُعرض لأول مرة في لوس أنجلوس 2028.',
  'Cycling':                   'سباقات الدراجات على الطريق والمضمار.',
  'Equestrian':                'فعاليات الدريساج والفروسية.',
  'Blind Football':            'كرة القدم لخمسة لاعبين للمكفوفين.',
  'Goalball':                  'رياضة جماعية للمكفوفين وضعاف البصر، تُلعب بالاستدلال الصوتي.',
  'Judo':                      'رياضة قتالية لضعاف البصر.',
  'Powerlifting':              'رفع الأثقال بطريقة بنش برس.',
  'Rowing':                    'فعاليات التجديف الداخلي والمائي.',
  'Shooting':                  'الرماية بالبندقية والمسدس.',
  'Sitting Volleyball':        'الكرة الطائرة تُلعب جلوسًا على الملعب.',
  'Swimming':                  'جميع الأنماط، فئات S1–S14.',
  'Table Tennis':              'فئات الوقوف والكراسي المتحركة.',
  'Taekwondo':                 'رياضة قتالية، مباريات كيوروجي.',
  'Triathlon':                 'فعالية مشتركة من السباحة والدراجات والجري.',
  'Wheelchair Basketball':     'رياضة جماعية تُلعب على الكراسي المتحركة، نظام تصنيف بالنقاط.',
  'Wheelchair Fencing':        'سلاح الشيش لمستخدمي الكراسي المتحركة.',
  'Wheelchair Rugby':          'رياضة جماعية كاملة الاحتكاك على الكراسي المتحركة.',
  'Wheelchair Tennis':         'قاعدة الارتدادين، فئتا فردي وكوادز.',
  'Alpine Skiing':             'النزول، السلالوم، والسلالوم العملاق.',
  'Biathlon':                  'التزلج الريفي مع الرماية بالبندقية.',
  'Cross-Country Skiing':      'فعاليات التزلج الريفي على المسافات الطويلة.',
  'Para Ice Hockey':           'هوكي الجليد للرياضيين ذوي إعاقات الجزء السفلي من الجسم.',
  'Snowboard':                 'سباق سنوبورد كروس وسلالوم البنوك.',
  'Wheelchair Curling':        'الكيرلنغ لمستخدمي الكراسي المتحركة، بدون تنظيف الجليد.',
  'Basketball':                'كرة السلة في الأولمبياد الخاص.',
  'Bocce':                     'رياضة الكرة الدقيقة في الأولمبياد الخاص.',
  'Bowling':                   'البولينغ (عشر قوارير).',
  'Football':                  'كرة القدم في الأولمبياد الخاص.',
  'Golf':                      'الغولف في الأولمبياد الخاص.',
  'Gymnastics':                'الجمباز الفني والإيقاعي.',
  'Handball':                  'كرة اليد الجماعية.',
  'Kayaking':                  'فعاليات التجديف بالكاياك.',
  'Netball':                   'كرة الشبكة.',
  'Open Water Swimming':       'السباحة لمسافات طويلة في المياه المفتوحة.',
  'Roller Skating':            'فعاليات التزلج بالعجلات.',
  'Sailing':                   'سباقات الشراع.',
  'Softball':                  'الكرة الطرية.',
  'Tennis':                    'التنس.',
  'Volleyball':                'الكرة الطائرة.',
  'Figure Skating':            'التزلج الفني على الجليد.',
  'Floorball':                 'الفلوربول الداخلي.',
  'Snowboarding':              'التزلج على الجليد في الأولمبياد الخاص.',
  'Snowshoeing':                'سباق المشي بأحذية الثلج.',
  'Short Track Speed Skating': 'التزلج السريع على المضمار القصير.',
  'Special Olympics':          'برنامج الأولمبياد الخاص العام — لم يتم تحديد الرياضة بعد.',
  'Unified Basketball':        'كرة السلة الموحدة.',
  'Unified Football':          'كرة القدم الموحدة.',
  'Unified Futsal':            'كرة الصالات الموحدة.',
  'Unified Volleyball':        'الكرة الطائرة الموحدة.',
  'Unified Beach Volleyball':  'الكرة الطائرة الشاطئية الموحدة.',
  'Unified Softball':          'الكرة الطرية الموحدة.',
  'Unified Floorball':         'الفلوربول الموحد.',
  'Unified Handball':          'كرة اليد الموحدة.',
  'Unified Athletics (Relays and Team Events)': 'فعاليات التتابع والفرق الموحدة في ألعاب القوى.',
  'Unified Swimming Relays':   'فعاليات سباحة التتابع الموحدة.',
  'Unified Bowling':           'البولينغ الموحد.',
  'Unified Bocce':             'البوتشي الموحد.',
  'Unified Golf':              'الغولف الموحد.',
  'Unified Tennis':            'التنس الموحد.',
  'Unified Table Tennis':      'تنس الطاولة الموحد.',
  'Unified Badminton':         'الريشة الطائرة الموحدة.',
  'Unified Cycling':           'الدراجات الموحدة.',
  'Unified Triathlon':         'الترايثلون الموحد.',
  'Unified Alpine Skiing':     'التزلج الألبي الموحد.',
  'Unified Cross-Country Skiing': 'التزلج الريفي الموحد.',
  'Unified Snowshoeing':       'المشي بأحذية الثلج الموحد.',
  'Unified Snowboarding':      'التزلج على الجليد الموحد.',
  'Unified Athletics':         'برنامج ألعاب القوى الموحد للرياضيين الصغار.',
  'Unified Fitness Activities':'أنشطة اللياقة الموحدة للرياضيين الصغار.',
  'Unified Recreational Games':'الألعاب الترفيهية الموحدة للرياضيين الصغار.',
  'Unified Physical Education':'برمجة التربية البدنية الموحدة.',
}

export const UNIFIED_GROUP_NAMES_AR = {
  'Unified Team Sports':                       'الرياضات الجماعية الموحدة',
  'Unified Individual / Dual Sports':          'الرياضات الفردية / الثنائية الموحدة',
  'Unified Winter Sports':                     'الرياضات الشتوية الموحدة',
  'Unified Young Athletes & School Programs':  'برامج الرياضيين الصغار والمدارس الموحدة',
}
export const initials = n  => n.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()

export function statusClass(status) {
  return {
    'Active':              'badge-green',
    'Inactive':            'badge-gray',
    'On Leave':            'badge-amber',
    'In Competition':      'badge-blue',
    'In Training Camp':    'badge-teal',
    'Injured':             'badge-orange',
    'Under Medical Review':'badge-purple',
    'Suspended':           'badge-red',
    'Retired':             'badge-gray',
    'Pending':             'badge-amber',
    'Approved':            'badge-green',
    'Rejected':            'badge-red',
    'In Review':           'badge-blue',
    'Upcoming':            'badge-blue',
    'Registration Open':   'badge-green',
    'Planning':            'badge-amber',
    'Completed':           'badge-gray',
    'Cancelled':           'badge-red',
  }[status] || 'badge-gray'
}

export function statusDot(status) {
  return {
    'Active':              '#009F6B',
    'Inactive':            '#9aa3b2',
    'On Leave':            '#f59e0b',
    'In Competition':      '#0085C7',
    'In Training Camp':    '#0d9488',
    'Injured':             '#f97316',
    'Under Medical Review':'#8b5cf6',
    'Suspended':           '#EE334E',
    'Retired':             '#9aa3b2',
    'Pending':             '#f59e0b',
    'Approved':            '#009F6B',
    'Rejected':            '#EE334E',
    'In Review':           '#0085C7',
    'Upcoming':            '#0085C7',
    'Registration Open':   '#009F6B',
    'Planning':            '#f59e0b',
    'Completed':           '#9aa3b2',
    'Cancelled':           '#EE334E',
  }[status] || '#9aa3b2'
}

// الفئات المستهدفة — allowed values only, no free text. Single shared
// source used by the Add/Edit form dropdown, the table column filter, and
// exports, so nothing hardcodes this list a second time.
export const TARGET_CATEGORY_OPTIONS = ['اللاعب الواعد', 'اللاعب الأمل', 'اللاعب المميز', 'اللاعب النخبة', 'غير مصنف', 'لا ينطبق']

// English labels for the Targeted Athlete category — only the two newest
// options have one, since the original four have "(no English translation
// provided yet)" by established design (see FormModal.jsx) and must keep
// displaying exactly as before. The canonical stored value stays the
// Arabic string for every option (existing convention); this map only
// controls what English UI shows for it.
export const TARGET_CATEGORY_LABELS_EN = {
  'غير مصنف': 'Unclassified',
  'لا ينطبق': 'Not Applicable (N/A)',
}

export function targetCategoryLabel(value, lang) {
  if (!value) return ''
  return lang === 'ar' ? value : (TARGET_CATEGORY_LABELS_EN[value] || value)
}

export const COACH_DESIGNATIONS = ['Coach', 'Assistant Coach', 'Technical Expert', 'Physiotherapist', 'Doctor']

export function effectiveStatus(person) {
  const DATED = ['On Leave', 'In Competition', 'In Training Camp']
  if (!DATED.includes(person.status)) return person.status
  if (!person.status_start) return person.status
  const today = new Date(); today.setHours(0,0,0,0)
  const start = new Date(person.status_start); start.setHours(0,0,0,0)
  if (today < start) return 'Active'
  if (person.status_end) {
    const end = new Date(person.status_end); end.setHours(0,0,0,0)
    if (today > end) return 'Active'
  }
  return person.status
}

export const AWAY_STATUSES = ['On Leave', 'In Competition', 'In Training Camp']

export function computeAwayPeople(athletes, coaches, employees, lang) {
  const ar = lang === 'ar'

  const awayAthletes = (athletes || []).filter(a => AWAY_STATUSES.includes(effectiveStatus(a)))

  function employeeStatusSource(emp) {
    if (!COACH_DESIGNATIONS.includes(emp.designation)) return emp
    const coachRec = coaches?.find(c => c.status !== 'Inactive' && (
      (emp.qss_number && c.qss_number && c.qss_number === emp.qss_number) ||
      (emp.name && c.name && c.name.trim().toLowerCase() === emp.name.trim().toLowerCase())
    ))
    return coachRec || emp
  }

  const matchedCoachIds = new Set()
  const awayEmployeeResults = (employees || [])
    .map(e => {
      const src = employeeStatusSource(e)
      if (src !== e) matchedCoachIds.add(src.id)
      return { emp: e, src, isCoachType: src !== e }
    })
    .filter(({ src }) => AWAY_STATUSES.includes(effectiveStatus(src)))
    .map(({ emp, src, isCoachType }) => ({
      person: isCoachType ? { ...src, name: src.name, name_ar: src.name_ar } : emp,
      isCoachType,
    }))

  const awayEmployees = awayEmployeeResults.filter(r => !r.isCoachType).map(r => r.person)
  const awayEmployeesAsCoaches = awayEmployeeResults.filter(r => r.isCoachType).map(r => r.person)

  const awayCoaches = (coaches || []).filter(c => !matchedCoachIds.has(c.id) && AWAY_STATUSES.includes(effectiveStatus(c)))

  const allAway = [
    ...awayAthletes.map(a => ({ ...a, _type: ar ? 'رياضي' : 'Athlete' })),
    ...awayCoaches.map(c  => ({ ...c, _type: ar ? 'مدرب' : 'Coach', _isCoach: true })),
    ...awayEmployeesAsCoaches.map(c => ({ ...c, _type: ar ? 'مدرب' : 'Coach', _isCoach: true })),
    ...awayEmployees.map(e => ({ ...e, _type: ar ? 'عضو كادر' : 'Staff Member', _isEmployee: true })),
  ]

  return { allAway, awayAthletes, awayCoaches, awayEmployees }
}

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

// ── Centralized profile-photo resolution ──────────────────────────────
// Single source of truth for "what photo does this person's account show",
// used everywhere an avatar is rendered (sidebar, topbar, dashboard hero,
// My Profile, lists/cards). Priority, checked in order, first match wins:
//   1. The role record already resolved for what's being displayed
//      (e.g. the exact athlete/coach/employee/referee row in view)
//   2. Any linked role record sharing the same person_id (multi-role
//      accounts — Coach+Staff, Athlete+Referee, etc.)
//   3. The single role-id link on the profile itself
//      (profile.athlete_id / coach_id / employee_id / referee_id)
//   4. profile.avatar_url — the only photo source for accounts with no
//      linked role record at all (pure Admin/Support accounts)
// Falls back to null (never a guess) so callers render the initials
// Avatar instead — never a broken image.
export function resolveUserPhoto(profile, { athletes = [], coaches = [], employees = [], referees = [] } = {}, preferredRecord = null) {
  if (preferredRecord?.photo_url) return preferredRecord.photo_url

  if (profile?.person_id) {
    const byPerson = [athletes, coaches, employees, referees]
      .map(list => list.find(r => r.person_id === profile.person_id))
      .find(r => r?.photo_url)
    if (byPerson) return byPerson.photo_url
  }

  const byRoleId =
    (profile?.athlete_id  && athletes.find(a => String(a.id) === String(profile.athlete_id)))  ||
    (profile?.coach_id    && coaches.find(c => String(c.id) === String(profile.coach_id)))      ||
    (profile?.employee_id && employees.find(e => String(e.id) === String(profile.employee_id))) ||
    (profile?.referee_id  && referees.find(r => String(r.id) === String(profile.referee_id)))
  if (byRoleId?.photo_url) return byRoleId.photo_url

  return profile?.avatar_url || null
}

// ── Shared PDF-export image helpers (jsPDF) ─────────────────────────────
// Used by every PDF export that embeds photos/logos (Athletes list export,
// Special Olympics report, etc.) — centralized here so each export doesn't
// reimplement the same fetch/format/embed logic.
// Loads an image URL into a base64 data URL for embedding in a PDF.
// Silently resolves to null on any failure (missing/broken photo, CORS,
// network, non-image response) so one bad photo never blocks the whole
// export.
export async function loadImageAsDataURL(url) {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    // Guard against a "successful" fetch that isn't actually image bytes
    // (e.g. an HTML error page returned with a 200 status, or a CORS
    // opaque response) — feeding that into jsPDF is what produces hard-to-
    // trace internal errors, so we bail out to null here instead.
    if (!blob || !blob.type || !blob.type.startsWith('image/') || blob.size === 0) return null
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// jsPDF's addImage() accepts an explicit format, but auto-detection can be
// unreliable for some data URLs it doesn't recognize — since we already
// know the MIME type from the fetched blob (encoded in the data URL
// itself), we extract it directly rather than relying on sniffing.
export function getImageFormatFromDataUrl(dataUrl) {
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,/.exec(dataUrl || '')
  if (!match) return null
  const ext = match[1].toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'JPEG'
  if (ext === 'png') return 'PNG'
  if (ext === 'webp') return 'WEBP'
  if (ext === 'gif') return 'GIF'
  if (ext === 'bmp') return 'BMP'
  return null // unsupported/unrecognized type — caller skips the image
}

// Single choke point for every doc.addImage() call in a PDF export: never
// calls addImage with missing/invalid data, and any failure inside jsPDF
// itself (corrupt image bytes, etc.) is swallowed so one bad image can't
// abort the whole export.
export function safeAddImage(doc, dataUrl, x, y, w, h) {
  if (!dataUrl || typeof dataUrl !== 'string') return
  const format = getImageFormatFromDataUrl(dataUrl)
  if (!format) return
  if ([x, y, w, h].some(n => typeof n !== 'number' || isNaN(n))) return
  try {
    doc.addImage(dataUrl, format, x, y, w, h)
  } catch (err) {
    console.error('PDF export: skipped an image that failed to embed', err)
  }
}

// ── Shared Back navigation button ──────────────────────────────────────
// One consistent, reusable outlined "Back" control used on every detail
// page (Athletes, Coaches, Staff, Referees, Sports, Events, Requests,
// Results, etc.) instead of each page styling its own text link. Behavior
// (onClick → same navigation it always called) is untouched — this only
// standardizes the visual: left arrow icon, outlined compact button, clear
// hover state. Visual details (colors/hover/mobile sizing) live in the
// `.back-btn` CSS class.
export function BackButton({ onClick, label, style }) {
  return (
    <button type="button" className="back-btn" onClick={onClick} style={style}>
      <i className="ti ti-arrow-left" />
      <span>{label}</span>
    </button>
  )
}

// ── Reusable document preview (PDF modal / image lightbox / new tab) ──
// Single source of truth for what preview to open, plus one button that
// works everywhere document rows expose a Download control — Athletes,
// Coaches, Employees (Staff), Referees, My Profile, and any shared
// document component. Deliberately does not gate on permissions itself:
// each caller only renders this next to a Download control it already
// decided the current profile may see, so preview access always matches
// existing download access exactly.
export function getDocPreviewKind(name) {
  const ext = (name || '').split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (['txt', 'csv', 'html', 'htm', 'json'].includes(ext)) return 'newtab'
  // doc/docx/xls/xlsx/ppt/pptx/zip and anything unrecognized: no browser-
  // safe inline preview — caller keeps Download as the only action.
  return null
}

// Signature capture — mouse/touch/stylus via pointer events (one handler
// covers all three, no separate touch/mouse code paths). `onSave(blob)`
// receives a PNG Blob once the person confirms; `onClear` resets. A
// filled/checked canvas region is required before Save is enabled so an
// empty signature can't be "saved" as if it were real.
export function SignaturePad({ onSave, ar, height = 160 }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const hasInkRef = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  function start(e) {
    e.preventDefault()
    const canvas = canvasRef.current
    canvas.setPointerCapture?.(e.pointerId)
    const ctx = canvas.getContext('2d')
    const { x, y } = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(x, y)
    drawingRef.current = true
  }
  function move(e) {
    if (!drawingRef.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { x, y } = getPos(e, canvas)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111827'
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasInkRef.current) { hasInkRef.current = true; setHasInk(true) }
  }
  function end(e) { drawingRef.current = false }

  function clear() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    hasInkRef.current = false
    setHasInk(false)
  }

  function save() {
    const canvas = canvasRef.current
    canvas.toBlob(blob => { if (blob) onSave(blob) }, 'image/png')
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={560} height={height}
        style={{ width:'100%', height, touchAction:'none', border:'1px dashed var(--border)', borderRadius:8, background:'#fff', cursor:'crosshair' }}
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} onPointerCancel={end}
      />
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        <button type="button" onClick={clear} className="btn-cancel" style={{ fontSize:12 }}>
          <i className="ti ti-eraser" /> {ar ? 'مسح' : 'Clear'}
        </button>
        <button type="button" onClick={save} disabled={!hasInk} className="btn btn-blue" style={{ fontSize:12 }}>
          <i className="ti ti-check" /> {ar ? 'حفظ التوقيع' : 'Save Signature'}
        </button>
      </div>
    </div>
  )
}

export function PdfPreviewModal({ src, onClose }) {
  useEffect(() => {
    function handleKeyDown(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(10,10,14,.78)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute', top: 18, right: 18, width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.25)', color: '#fff',
          fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
        }}>
        <i className="ti ti-x" />
      </button>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '94vw', maxWidth: 900, height: '90vh', maxHeight: 900,
          background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.5)',
        }}>
        <iframe src={src} title="Document preview" style={{ width: '100%', height: '100%', border: 'none' }} />
      </div>
    </div>
  )
}

// Drop-in preview button — render immediately next to an existing Download
// control. Renders nothing when the file type has no safe inline preview
// (e.g. .doc/.docx), leaving Download as the only, already-correct action.
export function DocPreviewButton({ url, name, size = 28, iconSize = 14, style }) {
  const [open, setOpen] = useState(false)
  const kind = getDocPreviewKind(name)
  if (!kind || !url) return null

  function handleClick() {
    if (kind === 'newtab') { window.open(url, '_blank', 'noopener,noreferrer'); return }
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Preview"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size,
          borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)',
          cursor: 'pointer', fontSize: iconSize, ...style,
        }}>
        <i className="ti ti-eye" />
      </button>
      {open && kind === 'pdf' && <PdfPreviewModal src={url} onClose={() => setOpen(false)} />}
      {open && kind === 'image' && <PhotoLightbox src={url} alt={name} onClose={() => setOpen(false)} />}
    </>
  )
}

// ── Reusable profile-photo preview (lightbox) ─────────────────────────
// Single centralized modal used by every clickable profile picture in the
// app, so opening/closing behavior (backdrop click, Escape, X button,
// aspect-ratio-preserving fit) is identical everywhere instead of being
// reimplemented per page.
export function PhotoLightbox({ src, alt, onClose }) {
  useEffect(() => {
    function handleKeyDown(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(10,10,14,.78)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute', top: 18, right: 18, width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.25)', color: '#fff',
          fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        <i className="ti ti-x" />
      </button>
      <img
        src={src}
        alt={alt || ''}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          maxWidth: '92vw', maxHeight: '88vh', width: 'auto', height: 'auto',
          objectFit: 'contain', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,.5)',
        }} />
    </div>
  )
}

// Wraps any rendered photo (an <img>, an avatar div, etc.) so clicking it
// opens the shared PhotoLightbox. No-ops (renders children unchanged, no
// click handler, no cursor change) when there is no real photoUrl — so
// initials/default-avatar fallbacks are never clickable.
export function ClickablePhoto({ photoUrl, alt, children }) {
  const [open, setOpen] = useState(false)
  if (!photoUrl) return children

  return (
    <>
      <span
        onClick={() => setOpen(true)}
        style={{ cursor: 'pointer', display: 'contents' }}>
        {children}
      </span>
      {open && <PhotoLightbox src={photoUrl} alt={alt} onClose={() => setOpen(false)} />}
    </>
  )
}

// Single reusable avatar element — photo when one resolves, otherwise the
// same initials fallback everywhere, so every avatar in the app shares
// identical crop/fit/shape regardless of role or page. When a real photo
// is shown, it's wrapped in the shared ClickablePhoto lightbox; initials
// fallbacks are never clickable.
export function ProfileAvatar({ photoUrl, name, id, size = 32, fs = 11, style }) {
  if (photoUrl) {
    return (
      <ClickablePhoto photoUrl={photoUrl} alt={name}>
        <img src={photoUrl} alt={name || ''}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center', flexShrink: 0, cursor: 'pointer', ...style }} />
      </ClickablePhoto>
    )
  }
  return <Avatar name={name} id={id} size={size} fs={fs} />
}

export function Badge({ label, cls }) {
  return <span className={`badge ${cls || statusClass(label)}`}>{label}</span>
}

export function Loading() {
  return <div className="loading"><div className="spinner" /><span>Loading…</span></div>
}

export function DashRow({ children, onClick, clickable = true }) {
  // `clickable=false` renders a plain, static row: no onClick handler, no
  // chevron arrow, no pointer cursor/hover shift — used for member-list
  // rows that must be read-only for Staff/Coach/Athlete (Sports, Events)
  // while staying fully interactive for Admin/Read-Only Admin elsewhere.
  return (
    <div className={clickable ? 'dash-row' : 'dash-row dash-row--static'} onClick={clickable ? onClick : undefined}>
      {children}
      {clickable && <i className="ti ti-chevron-right row-arrow" />}
    </div>
  )
}

export function getCurrentSeason() {
  return '2026-2027'
}

export function renderNotificationText(n, tx, L) {
  const d = n?.data || {}
  const docLabel = (type) => type === 'passport' ? tx('notifTypes.docPassport', 'Passport')
    : type === 'id' ? tx('notifTypes.docId', 'Qatar ID')
    : (type || tx('notifTypes.docId', 'Document'))

  switch (n?.type) {
    case 'task_due_tomorrow':
      return { title: tx('notifTypes.taskDueTomorrow', 'Task due tomorrow'), body: `${d.task_title || n.body || ''}${d.due_time ? ' ' + d.due_time : ''}` }
    case 'task_due_today':
      return { title: tx('notifTypes.taskDueToday', 'Task due today'), body: `${d.task_title || n.body || ''}${d.due_time ? ' ' + d.due_time : ''}` }
    case 'task_overdue':
      return { title: tx('notifTypes.taskOverdue', 'Task overdue'), body: `${d.task_title || n.body || ''}${d.due_time ? ' ' + d.due_time : ''}` }

    case 'away_start': {
      const name = L(d.name || '', d.name_ar || d.name || '')
      const status = d.status || ''
      const phrase = tx('notifTypes.awayStartsToday', `${status.toLowerCase()} starts today`)
      return {
        title: tx('notifTypes.awayStartTitle', 'Temporary status started'),
        body: L(`${name}'s ${phrase}`, `${name} — ${status} ${phrase}`),
      }
    }
    case 'away_end': {
      const name = L(d.name || '', d.name_ar || d.name || '')
      const status = d.status || ''
      const phrase = tx('notifTypes.awayEndsToday', `${status.toLowerCase()} ends today`)
      return {
        title: tx('notifTypes.awayEndTitle', 'Temporary status ending'),
        body: L(`${name}'s ${phrase}`, `${name} — ${status} ${phrase}`),
      }
    }

    case 'document_expiring': {
      const name = L(d.name || '', d.name_ar || d.name || '')
      const label = docLabel(d.doc_type)
      const suffix = d.days_until === 60 ? tx('notifTypes.docExpiringWarning60', '60-day warning')
        : d.days_until === 30 ? tx('notifTypes.docExpiringWarning30', '30-day warning')
        : tx('notifTypes.docExpiringSoon', 'expiring soon')
      return {
        title: `${label} — ${suffix}`,
        body: `${name} — ${label} ${tx('notifTypes.docExpiresOn', 'expires on')} ${d.expiry_date || ''}`,
      }
    }
    case 'document_expired': {
      const name = L(d.name || '', d.name_ar || d.name || '')
      const label = docLabel(d.doc_type)
      return {
        title: `${label} ${tx('notifTypes.docExpired', 'expired')}`,
        body: `${name} — ${label} ${tx('notifTypes.docExpiredSince', 'expired on')} ${d.expiry_date || ''}`,
      }
    }

    case 'admin_activity': {
      // title format: "Admin Name — action" (e.g. "Ahcene Bouteldja — deleted")
      const dashIdx = (n?.title || '').lastIndexOf(' — ')
      const adminName = dashIdx >= 0 ? (n?.title || '').slice(0, dashIdx) : (n?.title || '')
      // Use stored Arabic name if available, otherwise fall back to English name
      const adminNameAr = d.actor_name_ar || adminName
      const actionEn = dashIdx >= 0 ? (n?.title || '').slice(dashIdx + 3).toLowerCase() : ''
      const entityType = d.entity_type || ''
      const actionAr = {
        deleted:       tx('notifTypes.adminActivityDeleted',  'deleted'),
        updated:       tx('notifTypes.adminActivityUpdated',  'updated'),
        approved:      tx('notifTypes.adminActivityApproved', 'approved'),
        rejected:      tx('notifTypes.adminActivityRejected', 'rejected'),
        created:       tx('notifTypes.adminActivityCreated',  'created'),
        added:         tx('notifTypes.adminActivityAdded',    'added'),
        imported:      tx('notifTypes.adminActivityUpdated',  'imported'),
        role_changed:  tx('notifTypes.adminActivityUpdated',  'updated'),
        status_changed:tx('notifTypes.adminActivityUpdated',  'updated'),
      }[actionEn] || actionEn
      const entityAr = {
        employee: tx('notifTypes.adminEntityEmployee', 'employee'),
        coach:    tx('notifTypes.adminEntityCoach',    'coach'),
        athlete:  tx('notifTypes.adminEntityAthlete',  'athlete'),
        user:     tx('notifTypes.adminEntityUser',     'user'),
        referee:  tx('notifTypes.adminEntityReferee',  'referee'),
      }[entityType] || entityType
      // Extract entity name: body = "AdminName action entityType EntityName."
      const bodyStr = n?.body || ''
      const marker = ` ${actionEn} ${entityType} `
      const markerIdx = bodyStr.indexOf(marker)
      const entityName = markerIdx >= 0 ? bodyStr.slice(markerIdx + marker.length).replace(/\.$/, '') : ''
      return {
        title: L(n?.title || '', `${adminNameAr} — ${actionAr}`),
        body: L(bodyStr, entityName ? `${adminNameAr} ${actionAr} ${entityAr} ${entityName}` : bodyStr),
      }
    }

    case 'account_approved':
      return {
        title: tx('notifTypes.accountApproved', 'Access request approved'),
        body: tx('notifTypes.accountApprovedBody', 'Your account has been activated — you can now sign in.'),
      }

    case 'account_rejected':
      return {
        title: tx('notifTypes.accountRejected', 'Access request rejected'),
        body: tx('notifTypes.accountRejectedBody', 'Your account request was not approved.'),
      }

    case 'access_request': {
      const bodyStr = n?.body || ''
      const nameOnly = bodyStr.replace(/ is requesting access$/, '')
      return {
        title: tx('notifTypes.accessRequest', 'New access request'),
        body: L(bodyStr, `${nameOnly} ${tx('notifTypes.accessRequestingAccess', 'is requesting access')}`),
      }
    }

    case 'request_approved':
      return {
        title: tx('notifTypes.requestApproved', 'Request approved'),
        body: n?.body || '',
      }

    case 'request_rejected':
      return {
        title: tx('notifTypes.requestRejected', 'Request rejected'),
        body: n?.body || '',
      }

    case 'resource_added':
      return {
        title: tx('notifTypes.resourceAdded', 'New resource added'),
        body: n?.body || '',
      }

    case 'import_succeeded':
      return {
        title: tx('notifTypes.importSucceeded', 'Import succeeded'),
        body: n?.body || '',
      }

    case 'import_failed':
      return {
        title: tx('notifTypes.importFailed', 'Import failed'),
        body: n?.body || '',
      }

    default:
      return { title: n?.title || '', body: n?.body || '' }
  }
}
