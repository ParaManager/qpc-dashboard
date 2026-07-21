export const AV_COLORS = ['#0085C7','#EE334E','#009F6B','#8b5cf6','#e67e22','#16a085','#c0392b','#2980b9']

// ============================================================================
// SPORT CATEGORIES — five programs, each with its own discipline list.
// "Sub-category" here means the season split (Summer/Winter) for Paralympic and
// Special Olympics, plus Unified Sports' own four groupings. All five share one
// flat naming convention: Paralympic disciplines get "Para " in front except a
// fixed list of exceptions (sports that already have their own distinct name,
// e.g. Boccia, Goalball, the Wheelchair-prefixed sports); every Special Olympics
// discipline gets "SO " in front, no exceptions; Unified sports keep their own
// "Unified X" naming as-is, no extra prefix.
// ============================================================================

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

// --- Summer Paralympic (23 disciplines) ------------------------------------
export const SUMMER_PARALYMPIC_SPORTS = [
  'Athletics', 'Archery', 'Badminton', 'Boccia', 'Canoe', 'Climbing',
  'Cycling', 'Equestrian', 'Blind Football', 'Goalball', 'Judo',
  'Powerlifting', 'Rowing', 'Shooting', 'Sitting Volleyball', 'Swimming',
  'Table Tennis', 'Taekwondo', 'Triathlon', 'Wheelchair Basketball',
  'Wheelchair Fencing', 'Wheelchair Rugby', 'Wheelchair Tennis',
]

// --- Winter Paralympic (6 disciplines) -------------------------------------
export const WINTER_PARALYMPIC_SPORTS = [
  'Alpine Skiing', 'Biathlon', 'Cross-Country Skiing', 'Para Ice Hockey',
  'Snowboard', 'Wheelchair Curling',
]

// --- Summer Special Olympics (25 disciplines, "Aquatics" stored as Swimming
// since that's the existing flat athlete/coach value already in use) --------
export const SUMMER_SPECIAL_OLYMPICS_SPORTS = [
  'Athletics', 'Swimming', 'Archery', 'Badminton', 'Basketball', 'Bocce',
  'Bowling', 'Cycling', 'Equestrian', 'Football', 'Golf', 'Gymnastics',
  'Handball', 'Judo', 'Kayaking', 'Netball', 'Open Water Swimming',
  'Powerlifting', 'Roller Skating', 'Sailing', 'Softball', 'Table Tennis',
  'Tennis', 'Triathlon', 'Volleyball',
]

// --- Winter Special Olympics (7 disciplines) -------------------------------
export const WINTER_SPECIAL_OLYMPICS_SPORTS = [
  'Alpine Skiing', 'Cross-Country Skiing', 'Figure Skating', 'Floorball',
  'Snowboarding', 'Snowshoeing', 'Short Track Speed Skating',
]

// --- Unified Sports, grouped into four expandable sub-sections -------------
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

// Legacy: many existing records simply have sport = 'Special Olympics' (the program
// as a whole, not a specific discipline) — kept selectable so those records keep
// displaying and filtering correctly. We deliberately never touch existing
// athlete/coach rows; any correction is made manually by an admin who knows which
// program/discipline they actually belong to.
const LEGACY_SPORTS = ['Special Olympics']

// Every Paralympic discipline (Summer + Winter) that should NOT get "Para" in
// front, because it already has its own distinct name in common use.
const PARALYMPIC_NO_PREFIX = [
  'Boccia', 'Blind Football', 'Goalball', 'Sitting Volleyball',
  'Wheelchair Basketball', 'Wheelchair Fencing', 'Wheelchair Rugby',
  'Wheelchair Tennis', 'Wheelchair Curling', 'Para Ice Hockey',
]

// Full flat list — every sport from every program, deduplicated, plus the legacy
// catch-all. Used wherever a single flat picker is needed with no category context.
// Most places should use SPORTS_BY_CATEGORY instead so the right label is shown.
export const SPORTS = [...new Set([
  ...SUMMER_PARALYMPIC_SPORTS, ...WINTER_PARALYMPIC_SPORTS,
  ...SUMMER_SPECIAL_OLYMPICS_SPORTS, ...WINTER_SPECIAL_OLYMPICS_SPORTS,
  ...UNIFIED_SPORTS, ...LEGACY_SPORTS,
])]

// Which sports belong to which category — drives the sport dropdown filtering by
// category in forms, and lets the Sports page group disciplines under the right tab.
// Every sport appears here even if no athlete/coach currently uses it, so a brand
// new discipline is always pickable as soon as someone joins under it.
export const SPORTS_BY_CATEGORY = {
  'Summer Paralympic':        [...SUMMER_PARALYMPIC_SPORTS, 'Special Olympics'],
  'Winter Paralympic':        WINTER_PARALYMPIC_SPORTS,
  'Summer Special Olympics':  [...SUMMER_SPECIAL_OLYMPICS_SPORTS, 'Special Olympics'],
  'Winter Special Olympics':  WINTER_SPECIAL_OLYMPICS_SPORTS,
  'Unified Sports':           UNIFIED_SPORTS,
}

// Returns the correct display label for a sport, given which category it's being
// shown under. Paralympic disciplines (Summer or Winter) get "Para " in front
// unless they're in the no-prefix exception list. Special Olympics disciplines
// (Summer or Winter) always get "SO " in front. Unified sports and the legacy
// catch-all are shown as-is. Falls back to the Paralympic convention when no
// category is known, since that's the organization's primary program.
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
  // Unified Sports (and anything else): shown as-is.
  return base
}

// Arabic display names for the plain/underlying sport words — single source of
// truth. sportLabel() above adds the Para/SO/بارالمبي qualifier on top of these
// where needed; don't add per-category variants here.
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
  'Snowshoeing':               'المشي بأحذية الثلج',
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

// Arabic translations of each sport's description (the SPORT_META.desc text) and
// of the four Unified Sports sub-group headers — kept as separate maps from
// SPORT_META itself so the English source descriptions above stay untouched and
// easy to diff/update independently.
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

// Maps a status label (athlete/coach/event/session status) to a badge CSS class
// suffix (badge-green, badge-red, etc. — see index.css for the actual colors).
// Recovered mapping: matches the local copies several pages kept of this same
// logic (e.g. Athletes.jsx's own status-color map), so this stays consistent
// with how statuses have always been colored across the app.
export function statusClass(status) {
  return {
    // People statuses
    'Active':              'badge-green',   // green  — good, normal
    'Inactive':            'badge-gray',    // gray   — neutral/off
    'On Leave':            'badge-amber',   // amber  — away temporarily
    'In Competition':      'badge-blue',    // blue   — representing QPC
    'In Training Camp':    'badge-teal',    // teal   — training/development
    'Injured':             'badge-orange',  // orange — medical concern
    'Under Medical Review':'badge-purple',  // purple — under review
    'Suspended':           'badge-red',     // red    — disciplinary
    'Retired':             'badge-gray',    // gray   — no longer active
    // Request/submission statuses
    'Pending':             'badge-amber',
    'Approved':            'badge-green',
    'Rejected':            'badge-red',
    'In Review':           'badge-blue',
    // Event statuses
    'Upcoming':            'badge-blue',
    'Registration Open':   'badge-green',
    'Planning':            'badge-amber',
    'Completed':           'badge-gray',
    'Cancelled':           'badge-red',
  }[status] || 'badge-gray'
}

// Maps a status label to an actual color value (not a class name) — used directly
// as a CSS background/color, e.g. for progress bars and small status dots where a
// full badge class isn't appropriate.
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

// Designations that make an employee record also count as a coach for
// status purposes — kept here as the shared definition so Employees.jsx and
// Dashboard.jsx (and anything else that needs it later) can't drift out of
// sync with each other about who counts as "coach-type".
export const COACH_DESIGNATIONS = ['Coach', 'Assistant Coach', 'Technical Expert', 'Physiotherapist', 'Doctor']

// Returns the effective status for today, respecting status_start dates.
// If status_start is in the future, the person is still 'Active' until that date.
export function effectiveStatus(person) {
  const DATED = ['On Leave', 'In Competition', 'In Training Camp']
  if (!DATED.includes(person.status)) return person.status
  if (!person.status_start) return person.status
  const today = new Date(); today.setHours(0,0,0,0)
  const start = new Date(person.status_start); start.setHours(0,0,0,0)
  if (today < start) return 'Active'  // not yet started — still active
  // Check if past end date
  if (person.status_end) {
    const end = new Date(person.status_end); end.setHours(0,0,0,0)
    if (today > end) return 'Active'  // returned — revert to active
  }
  return person.status
}

// The statuses that count as a temporary "away" absence — used consistently
// wherever the app needs to decide who's currently away.
export const AWAY_STATUSES = ['On Leave', 'In Competition', 'In Training Camp']

// Single source of truth for "who is currently away" across athletes,
// coaches, and employees. Originally built inline in Dashboard.jsx for the
// Away KPI card; extracted here so the Away Management page (and anything
// else that needs this later) reuses the exact same computation instead of
// a second, potentially-drifting copy.
//
// Coach-type employees (Coach, Assistant Coach, Technical Expert,
// Physiotherapist, Doctor) are resolved to their linked coaches-table record
// when one exists — that record is authoritative for their status — and
// fall back to their own employee record when no match is found, so they're
// never silently dropped. Matched coaches are counted once, through the
// employee entry, and excluded from the separate coaches list to avoid
// double-counting.
//
// Returns { allAway, awayAthletes, awayCoaches, awayEmployees }. Every
// person in the returned arrays is spread with a `_type` label (localized
// via `lang`) and, for coaches/employees, a `_isCoach`/`_isEmployee` flag —
// exactly the shape Dashboard.jsx already produced.
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
  // For a coach-type employee resolved to a linked coach record, that coach
  // record is where the real status/status_start/status_end actually live —
  // so the object carried forward must be the resolved record, not the
  // original employee shell (which may still hold stale/unrelated status
  // fields on the employees table). This only changes which record's data
  // is displayed for someone already correctly determined to be away — the
  // away/not-away determination itself is unchanged.
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

  // A coach-type employee is classified and displayed as a Coach (not an
  // Employee), since that is their true role — only genuinely regular
  // employee records are counted/displayed as Employee.
  const awayEmployees = awayEmployeeResults.filter(r => !r.isCoachType).map(r => r.person)
  const awayEmployeesAsCoaches = awayEmployeeResults.filter(r => r.isCoachType).map(r => r.person)

  const awayCoaches = (coaches || []).filter(c => !matchedCoachIds.has(c.id) && AWAY_STATUSES.includes(effectiveStatus(c)))

  const allAway = [
    ...awayAthletes.map(a => ({ ...a, _type: ar ? 'رياضي' : 'Athlete' })),
    ...awayCoaches.map(c  => ({ ...c, _type: ar ? 'مدرب' : 'Coach', _isCoach: true })),
    ...awayEmployeesAsCoaches.map(c => ({ ...c, _type: ar ? 'مدرب' : 'Coach', _isCoach: true })),
    ...awayEmployees.map(e => ({ ...e, _type: ar ? 'موظف' : 'Employee', _isEmployee: true })),
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

// MANUALLY PINNED to "2026-2027" ahead of the calendar-based rollover
// below, because the organization has already switched seasons early and
// hasn't told us their actual cutover date/rule yet. Once they confirm the
// real date the season changes each year, replace this early return with
// that rule (or restore the September 1 default below if that's actually
// it) and delete this comment.
export function getCurrentSeason() {
  return '2026-2027'

  // Previous automatic logic, kept for reference — the sporting season was
  // assumed to run September–August: before September, still the season
  // that started last calendar year; from September onward, a new season.
  // E.g. June 2026 → "2025-2026"; September 2026 → "2026-2027".
  // eslint-disable-next-line no-unreachable
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed: August = 7, September = 8
  const startYear = month >= 8 ? year : year - 1
  return `${startYear}-${startYear + 1}`
}

// Renders a system-generated notification's title/body live, from its
// stored `type` + `data` (structured fields only — task title, person
// name, document type, dates, etc.), using the same tx()/L() pattern as
// everywhere else in the app. Never reads the notification's own stored
// title/body for these known types, since that text gets permanently
// fixed in whichever language the admin session that generated it was
// using. `tx` and `L` are passed in from the caller's own useLang()/local
// helper — this function holds no translation data of its own beyond what
// already lives in translations.js's notifTypes section.
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

    default:
      // Not a known system-generated type — user-authored content (excuse
      // requests, sign-up requests, etc.) or an older row with no `data`
      // yet: show whatever is actually stored, unchanged.
      return { title: n?.title || '', body: n?.body || '' }
  }
}
