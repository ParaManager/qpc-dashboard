import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      return data || null
    } catch {
      return null
    }
  }

  useEffect(() => {
    let mounted = true

    // On mount: get session, fetch profile, then stop loading
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const p = await fetchProfile(u.id)
        if (mounted) setProfile(p)
      }
      if (mounted) setLoading(false)
    })

    // On auth changes (login/logout) — update state only
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const p = await fetchProfile(u.id)
        if (mounted) setProfile(p)
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return { user, profile, loading, signOut }
}

export const isAdmin   = p => p?.role === 'admin' || p?.account_type === 'admin'
export const isCoach   = p => p?.role === 'coach' || p?.account_type === 'coach'
export const isAthlete = p => p?.role === 'athlete' || p?.account_type === 'athlete'
export const isGuest   = p => p?.role === 'guest' || p?.account_type === 'guest'
export const canEdit   = p => p?.role === 'admin' || p?.account_type === 'admin'
