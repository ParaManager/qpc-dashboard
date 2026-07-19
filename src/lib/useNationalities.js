import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Single source of truth for nationalities across the whole app — filters,
// create/edit forms, search. Reads from the nationalities table (never a
// hardcoded list) and sorts alphabetically by English name.
let cache = null
let cacheListeners = []

async function fetchNationalities() {
  const { data } = await supabase.from('nationalities').select('*').order('name_en')
  cache = data || []
  cacheListeners.forEach(fn => fn(cache))
  return cache
}

export function useNationalities() {
  const [list, setList] = useState(cache || [])
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    const listener = (data) => setList(data)
    cacheListeners.push(listener)
    if (!cache) {
      fetchNationalities().then(() => setLoading(false))
    } else {
      setLoading(false)
    }
    return () => { cacheListeners = cacheListeners.filter(fn => fn !== listener) }
  }, [])

  // Adds a new nationality (case-insensitive, both-language duplicate
  // check) and refreshes every subscriber immediately — so it's available
  // everywhere (forms, filters, search) without a page reload.
  async function addNationality(nameEn, nameAr) {
    const trimmedEn = (nameEn || '').trim()
    const trimmedAr = (nameAr || '').trim() || null
    if (!trimmedEn) return { error: 'English name is required' }

    const existing = (cache || []).find(n =>
      n.name_en.toLowerCase() === trimmedEn.toLowerCase() ||
      (trimmedAr && n.name_ar && n.name_ar.toLowerCase() === trimmedAr.toLowerCase())
    )
    if (existing) return { error: 'This nationality already exists', existing }

    const { data, error } = await supabase.from('nationalities')
      .insert({ name_en: trimmedEn, name_ar: trimmedAr })
      .select().maybeSingle()
    if (error) {
      // Race-condition duplicate caught by the DB's own unique index.
      if (error.code === '23505') return { error: 'This nationality already exists' }
      return { error: error.message }
    }
    await fetchNationalities()
    return { data }
  }

  return { nationalities: list, loading, addNationality, refresh: fetchNationalities }
}
