import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(u) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.id)
        .single()

      if (data) return data

      // No profile row yet — create one as active admin
      // (only reaches here if someone logs in without going through register)
      const newProfile = {
        id: u.id,
        full_name: u.email,
        role: 'admin',
        account_type: 'admin',
        status: 'active',
        requested_at: new Date().toISOString(),
      }
      await supabase.from('profiles').insert(newProfile)
      return newProfile
    } catch {
      return null
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const p = await fetchProfile(u)
        if (mounted) setProfile(p)
      }
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        const { data: { session: cur } } = await supabase.auth.getSession()
        if (cur?.user) return  // false sign-out, ignore
        setUser(null)
        setProfile(null)
        return
      }

      const u = session?.user ?? null
      setUser(u)
      if (u) {
        const p = await fetchProfile(u)
        if (mounted) setProfile(p)
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
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
