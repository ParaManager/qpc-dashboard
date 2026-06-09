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
  const tc = (country) => {
    if (!country || lang === 'en') return country
    // Try exact match first, then case-insensitive
    if (AR.countries?.[country]) return AR.countries[country]
    const lower = country.toLowerCase()
    const found = Object.keys(AR.countries || {}).find(k => k.toLowerCase() === lower)
    return found ? AR.countries[found] : country
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
