// Centralized trusted-admin identification — the single place that knows
// the two trusted-admin email addresses, so no other file needs to repeat
// or hardcode an email string comparison. Mirrors the equivalent SQL
// function public.is_trusted_admin(uid) used by RLS policies, so frontend
// and database enforcement always agree.
//
// IMPORTANT: this file is a UX/consistency layer only. It does not grant
// any access by itself — actual enforcement lives in Supabase RLS. Treat
// every check here as "should the UI show this", never as "is this safe".
const TRUSTED_ADMIN_EMAILS = ['hsinou@gmail.com', 'mawahibqpc@gmail.com']
const MAIN_ADMIN_EMAIL = 'hsinou@gmail.com'

function normalizedEmail(profile, user) {
  // Trusted-admin distinctions only ever make sense for an actually-admin
  // effective role. This also closes a Role Preview leak: `user` (the raw
  // Supabase auth object) is Dina's real, unchanged login and always
  // carries her real email — intentionally never swapped, since faking
  // that would mean actually authenticating as someone else. Gating on
  // profile.role first means previewing Athlete/Coach/Staff/Referee can
  // never inherit her real trusted-admin status just because her real
  // email happens to match, while a real admin (or Admin preview, where
  // profile.role is genuinely 'admin') is unaffected.
  if (profile?.role !== 'admin') return ''
  // profiles.email is sometimes a QID or synthetic value (e.g. "COACH-32")
  // for non-admin accounts — auth.users.email (via the `user` object from
  // useAuth) is the authoritative address. Prefer it, fall back to
  // profile.email for callers that only have the profile at hand.
  return (user?.email || profile?.email || '').trim().toLowerCase()
}

// Either trusted admin — full access everywhere except the Tasks
// assignment controls.
export function isTrustedAdmin(profile, user) {
  return TRUSTED_ADMIN_EMAILS.includes(normalizedEmail(profile, user))
}

// The one admin who can assign tasks to others / see All Tasks.
export function isMainAdmin(profile, user) {
  return normalizedEmail(profile, user) === MAIN_ADMIN_EMAIL
}

// The other trusted admin — full access everywhere, but restricted to their
// own tasks only, same as any other non-main user in the Tasks model.
export function isFullAdmin(profile, user) {
  return isTrustedAdmin(profile, user) && !isMainAdmin(profile, user)
}

// Any admin-role account that is NOT one of the two trusted admins. A
// future third role='admin' profile falls here by default — it must not
// be treated as having trusted-admin-level access anywhere new code adds.
export function isLimitedAdmin(profile, user) {
  return profile?.role === 'admin' && !isTrustedAdmin(profile, user)
}

// For the rarer case of checking an arbitrary record's email field (e.g.
// classifying a row in a list of candidate profiles) rather than the
// current session — same normalized comparison, just given a raw string.
export function isMainAdminEmail(email) {
  return (email || '').trim().toLowerCase() === MAIN_ADMIN_EMAIL
}
export function isTrustedAdminEmail(email) {
  return TRUSTED_ADMIN_EMAILS.includes((email || '').trim().toLowerCase())
}
