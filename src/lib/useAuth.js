import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

export function useAuth() {
  const [user, setUser]         = useState(null)
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)  // stays true until user+profile both resolved
  // Tracks the currently-known signed-in user id in a ref (not state), so the
  // onAuthStateChange closure below can always read the true latest value
  // synchronously — some Supabase-js v2 versions re-emit SIGNED_IN (not just
  // TOKEN_REFRESHED) purely as part of session-recovery on tab focus, for
  // the SAME already-authenticated user. Comparing against this ref lets us
  // tell "genuinely new sign-in" apart from "same user, re-emitted event",
  // regardless of which exact event name the library happens to fire.
  const knownUserIdRef = useRef(null)

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
      knownUserIdRef.current = u?.id ?? null
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
      // Temporary diagnostic — remove once tab-focus state loss is confirmed
      // fully resolved. Shows exactly which auth event fires and whether it
      // was treated as a real change or a same-user no-op.
      console.log('[useAuth] event:', event, 'incoming user id:', session?.user?.id, 'known user id:', knownUserIdRef.current)

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        knownUserIdRef.current = null
        return
      }

      // TOKEN_REFRESHED fires routinely — including when the browser tab
      // regains focus/visibility and Supabase's client checks whether the
      // session token needs refreshing. It is NOT a new sign-in: the same
      // user, same profile, same everything, just a refreshed token behind
      // the scenes. Previously this branch cleared `profile` to null and
      // set `loading` to true exactly as SIGNED_IN does, which made
      // App.jsx's `if (authLoading) return (...)` swap in the loading
      // screen and unmount every page underneath it — wiping all local
      // component state (search, filters, sort, scroll position, edit
      // mode, unsaved edits) just from switching tabs and back. Only a
      // genuine SIGNED_IN should ever reset profile/loading; a token
      // refresh only needs the (unchanged) user object kept in sync.
      if (event === 'SIGNED_IN') {
        const u = session?.user ?? null
        // Some Supabase-js v2 versions re-emit SIGNED_IN purely as part of
        // session recovery when a tab regains focus/visibility — same user,
        // same session, nothing has actually changed. Only treat this as a
        // real sign-in (and reset profile/loading) if the user id is
        // genuinely different from the one we already know about; otherwise
        // just keep the user object current, exactly like TOKEN_REFRESHED.
        if (u && u.id === knownUserIdRef.current) {
          setUser(u)
          return
        }
        // Clear old profile immediately so stale role never bleeds into new session
        if (mounted) { setProfile(null); setLoading(true) }
        setUser(u)
        knownUserIdRef.current = u?.id ?? null
        if (u) {
          const p = await fetchProfile(u.id)
          if (mounted) setProfile(p)
        }
        if (mounted) setLoading(false)
        return
      }

      if (event === 'TOKEN_REFRESHED') {
        // Same session, same user — just keep the user object current
        // without touching profile/loading, so nothing above this hook
        // re-renders into a loading/auth-gate state and no page remounts.
        const u = session?.user ?? null
        if (u) setUser(u)
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
