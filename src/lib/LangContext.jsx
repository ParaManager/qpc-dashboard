import { createContext, useContext, useState, useEffect } from 'react'
import AR from './translations'

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('qpc-lang') || 'en')

  useEffect(() => {
    localStorage.setItem('qpc-lang', lang)
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])

  const t = (path) => {
    if (lang === 'en') return null // return null = use English default
    const keys = path.split('.')
    let val = AR
    for (const key of keys) {
      val = val?.[key]
      if (!val) return null
    }
    return val
  }

  // Helper: returns Arabic if lang=ar, else falls back to English
  const tx = (arPath, enFallback) => {
    if (lang === 'en') return enFallback
    return t(arPath) || enFallback
  }

  // Translate country name
  const COUNTRY_MAP = {
    'afghanistan':'أفغانستان','algeria':'الجزائر','argentina':'الأرجنتين',
    'armenia':'أرمينيا','australia':'أستراليا','austria':'النمسا',
    'azerbaijan':'أذربيجان','bahrain':'البحرين','bangladesh':'بنغلاديش',
    'belarus':'بيلاروسيا','belgium':'بلجيكا','brazil':'البرازيل',
    'cameroon':'الكاميرون','canada':'كندا','chile':'تشيلي','china':'الصين',
    'colombia':'كولومبيا','croatia':'كرواتيا','czech republic':'التشيك',
    'denmark':'الدنمارك','egypt':'مصر','eritrea':'إريتريا','ethiopia':'إثيوبيا',
    'finland':'فنلندا','france':'فرنسا','georgia':'جورجيا','germany':'ألمانيا',
    'ghana':'غانا','greece':'اليونان','guinea':'غينيا','hungary':'المجر',
    'india':'الهند','indonesia':'إندونيسيا','iran':'إيران','iraq':'العراق',
    'ireland':'أيرلندا','italy':'إيطاليا','japan':'اليابان','jordan':'الأردن',
    'kazakhstan':'كازاخستان','kenya':'كينيا','kuwait':'الكويت',
    'kyrgyzstan':'قيرغيزستان','lebanon':'لبنان','libya':'ليبيا',
    'malaysia':'ماليزيا','mali':'مالي','mauritania':'موريتانيا',
    'mexico':'المكسيك','mongolia':'منغوليا','morocco':'المغرب',
    'myanmar':'ميانمار','nepal':'نيبال','netherlands':'هولندا',
    'new zealand':'نيوزيلندا','nigeria':'نيجيريا','norway':'النرويج',
    'oman':'عُمان','pakistan':'باكستان','palestine':'فلسطين','peru':'بيرو',
    'philippines':'الفلبين','poland':'بولندا','portugal':'البرتغال',
    'qatar':'قطر','qatari':'قطري','romania':'رومانيا','russia':'روسيا',
    'rwanda':'رواندا','saudi arabia':'المملكة العربية السعودية',
    'ksa':'المملكة العربية السعودية','scotland':'اسكتلندا',
    'senegal':'السنغال','serbia':'صربيا','singapore':'سنغافورة',
    'slovakia':'سلوفاكيا','somalia':'الصومال','south africa':'جنوب أفريقيا',
    'south korea':'كوريا الجنوبية','spain':'إسبانيا','sri lanka':'سريلانكا',
    'sudan':'السودان','sweden':'السويد','syria':'سوريا',
    'tajikistan':'طاجيكستان','tanzania':'تنزانيا','thailand':'تايلاند',
    'tunisia':'تونس','turkey':'تركيا','türkiye':'تركيا',
    'turkmenistan':'تركمانستان','uae':'الإمارات','uganda':'أوغندا',
    'uk':'المملكة المتحدة','ukraine':'أوكرانيا','usa':'الولايات المتحدة',
    'uzbekistan':'أوزبكستان','venezuela':'فنزويلا','vietnam':'فيتنام',
    'wales':'ويلز','yemen':'اليمن','zambia':'زامبيا','zimbabwe':'زيمبابوي',
    'algeria':'الجزائر','libyan arab jamahiriya':'ليبيا',
    'syrian arab republic':'سوريا','iran, islamic republic of':'إيران',
    'korea, republic of':'كوريا الجنوبية','viet nam':'فيتنام',
  }

  const tc = (country) => {
    if (!country || lang === 'en') return country
    const key = country.toLowerCase().trim()
    return COUNTRY_MAP[key] || AR.countries?.[country] || country
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t, tx, tc }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}

export function useCountry() {
  const { tc } = useLang()
  return tc
}
