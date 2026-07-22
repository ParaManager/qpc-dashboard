import { supabase } from './supabase'

// Shared helper so individual pages never duplicate the "log it, then tell
// both trusted admins" logic. Call this after a create/edit/delete/approve/
// import/etc. actually succeeds — never before, and never for read-only
// actions (opening pages, searching, filtering, sorting, pagination).
//
// logAdminActivity({
//   actor:        the acting user's profile (needs id, full_name, and ideally email)
//                 Arabic name is resolved automatically via actor.person_id
//   actorEmail:   optional explicit email if not reliably present on actor
//   actorNameAr:  optional explicit Arabic name override
//   action:       'created' | 'updated' | 'deleted' | 'approved' | 'rejected' | ...
//   entityType:   'athlete' | 'coach' | 'employee' | 'referee' | 'event' | 'result'
//                 | 'resource' | 'request' | 'away_status' | 'user' | 'import' | 'document'
//   entityId:     string/number id of the affected record, or null
//   entityLabel:  human-readable name, e.g. "Ahmed Ali"
//   module:       page/route this happened on, e.g. 'athletes'
//   metadata:     optional small JSON blob with extra detail (counts, before/after, etc.)
//
// This never throws — a failure here must not undo or block the caller's
// already-successful data change. Failures are logged to the console so
// they're visible during development instead of silently vanishing.
export async function logAdminActivity({ actor, actorEmail, actorNameAr, action, entityType, entityId, entityLabel, module, metadata }) {
  try {
    const actorName = actor?.full_name || actor?.email || 'Someone'
    const resolvedEmail = (actorEmail || actor?.email || '').toLowerCase()

    // Resolve Arabic name: explicit override → actor.name_ar → DB lookup via person_id
    let resolvedActorNameAr = actorNameAr || actor?.name_ar || null
    if (!resolvedActorNameAr && actor?.person_id) {
      for (const table of ['athletes', 'coaches', 'employees']) {
        const { data } = await supabase
          .from(table)
          .select('name_ar')
          .eq('person_id', actor.person_id)
          .limit(1)
          .maybeSingle()
        if (data?.name_ar) { resolvedActorNameAr = data.name_ar; break }
      }
    }

    const { data: logRow, error: logErr } = await supabase.from('activity_log').insert({
      actor_id: actor?.id || null,
      actor_name: actorName,
      actor_email: resolvedEmail || null,
      action,
      entity_type: entityType,
      entity_id: entityId != null ? String(entityId) : null,
      entity_label: entityLabel || null,
      module: module || null,
      metadata: metadata || null,
    }).select('id, created_at').single()

    if (logErr) {
      console.error('[adminActivity] failed to insert activity_log row:', logErr)
      return
    }

    await notifyTrustedAdmins({ actor, actorName, actorNameAr: resolvedActorNameAr, action, entityType, entityId, entityLabel, module, logId: logRow?.id })
  } catch (err) {
    console.error('[adminActivity] logAdminActivity failed:', err)
  }
}

// Builds a human sentence like "Mawahib updated athlete Ahmed Ali." — kept
// close to the examples in the brief rather than a generic template.
function describeActivity({ actorName, action, entityType, entityLabel }) {
  const entityPhrase = entityLabel ? `${entityType} ${entityLabel}` : entityType
  const actionWord = {
    created: 'created', updated: 'updated', deleted: 'deleted',
    approved: 'approved', rejected: 'rejected',
    imported: 'imported', import_succeeded: 'completed an import for',
    import_failed: 'had a failed import for', role_changed: 'changed the role of',
    status_changed: 'changed the status of',
  }[action] || action
  return `${actorName} ${actionWord} ${entityPhrase}.`
}

async function notifyTrustedAdmins({ actor, actorName, actorNameAr, action, entityType, entityId, entityLabel, module, logId }) {
  const { data: admins, error: adminErr } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', await trustedAdminIds())
  if (adminErr) { console.error('[adminActivity] failed to resolve trusted admins:', adminErr); return }
  if (!admins?.length) return

  const body = describeActivity({ actorName, action, entityType, entityLabel })
  const rows = admins.map(a => ({
    user_id: a.id,
    type: 'admin_activity',
    title: `${actorName} — ${action}`,
    body,
    data: {
      module,
      entity_type: entityType,
      entity_id: entityId,
      activity_log_id: logId || null,
      actor_name_ar: actorNameAr || null,
    },
    read: false,
    category: 'Admin Activity',
    target_path: module || null,
    related_entity_type: entityType,
    related_entity_id: entityId != null ? String(entityId) : null,
    // logId ties this notification to one specific activity row, so the
    // same event can never produce two notifications per admin even if
    // this helper is somehow invoked twice for the same action.
    dedup_key: logId ? `admin-activity-${logId}-${a.id}` : null,
  }))

  const { error: notifErr } = await supabase.from('notifications').insert(rows)
  if (notifErr) console.error('[adminActivity] failed to insert trusted-admin notifications:', notifErr)
}

// Resolves the two trusted-admin auth.users ids by email, via auth-backed
// profiles lookup. profiles.email is unreliable for non-admin accounts, but
// both trusted admins are real admin sign-ups whose profiles.email is their
// real address, so this lookup is safe in practice; it mirrors the same two
// addresses the SQL is_trusted_admin() function checks against auth.users.
let _cachedTrustedIds = null
let _cachedAt = 0
async function trustedAdminIds() {
  const now = Date.now()
  if (_cachedTrustedIds && now - _cachedAt < 60000) return _cachedTrustedIds
  const { data } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', ['hsinou@gmail.com', 'mawahibqpc@gmail.com'])
  _cachedTrustedIds = (data || []).map(p => p.id)
  _cachedAt = now
  return _cachedTrustedIds
}
