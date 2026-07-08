import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function useAuth() {
  const [user, setUser]         = useState(null)
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)  // stays true until user+profile both resolved

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    return data || null
  }

  useEffect(() => {
    let mounted = true

    // Safety net: on a cold load (fresh service worker install, flaky first
    // network request, etc.) getSession() has been observed to occasionally
    // never resolve, leaving the app stuck on the loading screen until a
    // manual refresh. A hard timeout guarantees we always leave the loading
    // state even in that worst case, instead of hanging forever.
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 8000)

    // On mount: get session → fetch profile → THEN stop loading
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const p = await fetchProfile(u.id)
        if (mounted) setProfile(p)
      }
      if (mounted) setLoading(false)  // only stop loading AFTER profile fetch
      clearTimeout(safetyTimer)
    }).catch(() => {
      // If getSession() itself rejects, don't hang — show the sign-in screen
      // instead of an infinite loading state.
      if (mounted) setLoading(false)
      clearTimeout(safetyTimer)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const u = session?.user ?? null
        // Clear old profile immediately so stale role never bleeds into new session
        if (mounted) { setProfile(null); setLoading(true) }
        setUser(u)
        if (u) {
          const p = await fetchProfile(u.id)
          if (mounted) setProfile(p)
        }
        if (mounted) setLoading(false)
      }
    })

    return () => { mounted = false; clearTimeout(safetyTimer); subscription.unsubscribe() }
  }, [])

  // Supabase's default signOut() ends every session on every device at once.
  // Scoping to 'local' means signing out on one device (e.g. a laptop) only
  // ends that session — a phone logged in separately stays logged in.
  async function signOut() {
    await supabase.auth.signOut({ scope: 'local' })
  }

  return { user, profile, loading, signOut }
}

export const isAdmin   = p => p?.role === 'admin'
export const isCoach   = p => p?.role === 'coach'
export const isAthlete = p => p?.role === 'athlete'
export const isGuest   = p => p?.role === 'guest'
export const canEdit   = p => p?.role === 'admin'
