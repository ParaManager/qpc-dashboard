// ── Centralized Role Preview permission layer ───────────────────────────
// Because Supabase RLS still sees the support account's REAL auth.uid()
// and real Admin privileges, the database will always hand back the full
// Admin-eligible dataset for anything RLS-gated (e.g. `resources`), no
// matter which role is being previewed. RLS is correct and must not be
// weakened — it reflects who is really authenticated. Role Preview instead
// needs a second, application-level filter on top of whatever RLS already
// returned, so previewing a non-admin role never displays Admin-only rows
// even though they were technically included in the query result.
//
// The one thing that already IS correctly role-aware everywhere is
// `profile` itself — useAuth() overrides `profile.role` (and the matching
// `<role>_id` link) to the previewed role while `realProfile` stays Dina's
// real, unchanged account. So:
//   - `profile.role` / `effectiveRole(profile)` — use for ALL normal page
//     permission checks, nav visibility, form/resource audience checks.
//   - `realProfile` — use ONLY to decide whether Role Preview itself is
//     available (is_support) — never for any other permission decision.

// Admin-only application features that must be fully hidden/disabled while
// previewing any non-admin role, even though the underlying account is a
// real Admin. Keyed by a short feature name so call sites read clearly.
const ADMIN_ONLY_FEATURES = new Set([
  'user_management',
  'admin_notifications',
  'create_edit_delete',
  'admin_only_resources',
  'admin_request_actions',
  'admin_event_controls',
  'admin_settings',
])

export function effectiveRole(profile) {
  return profile?.role || 'guest'
}

// True only while a support account is actively previewing a role that
// isn't its own real Admin access — i.e. the one condition under which the
// app must start hiding/filtering Admin-only content despite the
// underlying account genuinely being an Admin.
export function isPreviewMode(realProfile, previewRole) {
  return !!(realProfile?.is_support && previewRole && previewRole !== 'admin')
}

export function canPreviewAccess(feature, profile) {
  if (effectiveRole(profile) === 'admin') return true
  if (ADMIN_ONLY_FEATURES.has(feature)) return false
  return true
}

// Whether a resource/form/etc. tagged with `visible_to` should be shown to
// the given effective role. Admins always see everything (matches existing
// admin-sees-all behavior for real admins); private/empty visible_to is
// treated as hidden from everyone but admins; otherwise the role must be
// explicitly listed.
export function matchesAudience(visibleTo, role) {
  if (role === 'admin' || role === 'readonly_admin') return true
  if (!visibleTo || visibleTo.length === 0) return false
  return visibleTo.includes(role)
}
