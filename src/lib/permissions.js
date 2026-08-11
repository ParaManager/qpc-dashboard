// Trusted-admin identification — the single place that knows the two
// trusted-admin email addresses, so no other file needs to repeat or
// hardcode an email string comparison. Mirrors the equivalent SQL
// function public.is_trusted_admin(uid) used by RLS policies, so frontend
// and database enforcement always agree.
//
// IMPORTANT: this file is a UX/consistency layer only. It does not grant
// any access by itself — actual enforcement lives in Supabase RLS. Treat
// every check here as "should the UI show this", never as "is this safe".
const TRUSTED_ADMIN_EMAILS = ['hsinou@gmail.com', 'mawahibqpc@gmail.com']
const MAIN_ADMIN_EMAIL = 'hsinou@gmail.com'

// ── admin vs readonly_admin ──────────────────────────────────────────────
// `admin` = full write access. `readonly_admin` = sees everything an Admin
// sees, can perform NO writes. These two are deliberately kept as
// separate, non-overlapping role strings everywhere (frontend AND every
// RLS write policy already checks role = 'admin' literally) rather than
// giving readonly_admin the 'admin' role with a separate flag — that way
// a bug that forgets to check the flag fails closed (denies), not open.
const ADMIN_ROLES = ['admin', 'readonly_admin']

// True for either admin-tier role — use for VIEW/navigation/page-access
// decisions ("can this account open the Admin pages"), never for deciding
// whether a write action is allowed.
export function isAdminRole(profile) {
  return ADMIN_ROLES.includes(profile?.role)
}

export function isReadOnlyAdmin(profile) {
  return profile?.role === 'readonly_admin'
}

// ── Athlete-detail visibility ────────────────────────────────────────────
// Centralized so every place that lists athletes (Athletes page, Sports,
// Sport Details, Events, Event Details, any reusable athlete row/card, the
// direct Athlete Details route) agrees on who may open a full athlete
// profile. This is deliberately NARROWER than isAdminRole() — it also
// grants Medical Staff (an ordinary Staff-tier account otherwise) and a
// Coach's own assigned athletes, neither of which should get any other
// admin-level visibility.
//
// `athlete` + `athleteSportAssignments` are optional: pass them when
// checking a Coach's access to one specific athlete (mirrors the same
// "assigned via coach_id OR athlete_sports" rule App.jsx's own myAthletes
// uses); omit them for general member lists (Sports/Events) where a Coach
// must NOT get access regardless of assignment — those lists are never the
// dedicated "My Athletes" context.
export function canViewAthleteDetails(profile, athlete = null, athleteSportAssignments = []) {
  const role = profile?.role
  if (role === 'admin' || role === 'readonly_admin' || role === 'medical_staff') return true
  if (role === 'coach' && athlete) {
    if (String(athlete.coach_id) === String(profile?.coach_id)) return true
    return athleteSportAssignments.some(as =>
      String(as.coach_id) === String(profile?.coach_id) && String(as.athlete_id) === String(athlete.id)
    )
  }
  return false
}

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
