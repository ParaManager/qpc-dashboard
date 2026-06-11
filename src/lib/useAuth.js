import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const signingOut            = useRef(false)  // tracks intentional sign-outs

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        // Only clear state if WE triggered the sign-out (not Supabase internally)
        if (signingOut.current) {
          setUser(null)
          setProfile(null)
          signingOut.current = false
        }
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          const p = await fetchProfile(u.id)
          if (mounted) setProfile(p)
        }
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  async function signOut() {
    signingOut.current = true
    await supabase.auth.signOut()
  }

  return { user, profile, loading, signOut }
}

export const isAdmin   = p => p?.role === 'admin' || p?.account_type === 'admin'
export const isCoach   = p => p?.role === 'coach' || p?.account_type === 'coach'
export const isAthlete = p => p?.role === 'athlete' || p?.account_type === 'athlete'
export const isGuest   = p => p?.role === 'guest'   || p?.account_type === 'guest'
export const canEdit   = p => p?.role === 'admin'   || p?.account_type === 'admin'
