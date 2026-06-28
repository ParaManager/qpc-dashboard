// Web Push notifications helper. Unlike a plain in-page Notification (which
// only works while this tab/app is open and running), this registers a
// service worker and subscribes the device to real push delivery — so
// notifications can arrive even when the app is fully closed. The actual
// sending happens server-side: a Postgres trigger calls the send-push edge
// function the moment a new row lands in the notifications table, which then
// pushes to every device subscribed for that user.

import { supabase } from './supabase'

// Public key only — safe to ship to the browser. The matching private key
// lives only on the server (Supabase Edge Function secret), never here.
const VAPID_PUBLIC_KEY = 'BI0q0uhSEmw9cDF6rGEzkj6mn54RSZb9UoXGTw7npsTjH7nHYlRmBWTE6VuXNosvY4tqofTn8lRn9PtDfTjZYoc'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission // 'granted', 'denied', 'default'
}

// Registers the service worker, asks for permission, subscribes to push, and
// saves that subscription to the database so the server can find it later.
// Returns true only if every step actually succeeded — callers should treat
// anything else as "notifications are not active" rather than assume success.
export async function requestNotificationPermission(userId) {
  if (!isPushSupported()) return false

  if (Notification.permission === 'denied') return false
  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission()
    if (result !== 'granted') return false
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    if (userId) await saveSubscription(userId, subscription)
    return true
  } catch (err) {
    console.error('Push subscription failed:', err)
    return false
  }
}

// Persists the push subscription so the server-side send-push function can
// find it. Upserts on endpoint, since the same device re-subscribing
// shouldn't create a duplicate row.
async function saveSubscription(userId, subscription) {
  const json = subscription.toJSON()
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  }, { onConflict: 'endpoint' })
}

// Removes this device's subscription, both from the browser and the database,
// so the person stops receiving pushes on it specifically.
export async function disablePushNotifications() {
  if (!isPushSupported()) return
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
      await subscription.unsubscribe()
    }
  } catch (err) {
    console.error('Failed to disable push notifications:', err)
  }
}

// Whether this exact device currently has an active push subscription —
// the only reliable source of truth for "are notifications actually on,"
// since OS-level permission alone doesn't mean a subscription exists.
export async function hasActivePushSubscription() {
  if (!isPushSupported()) return false
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    return !!subscription
  } catch {
    return false
  }
}

// Shows a local, in-page notification immediately — used only for the
// one-time "notifications enabled" confirmation message right after enabling,
// since that moment is always while the page is open anyway. Real ongoing
// notifications come through the service worker's push handler instead.
export function sendNotification(title, body, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const n = new Notification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: options.tag || 'qpc',
    requireInteraction: options.requireInteraction || false,
    ...options,
  })
  n.onclick = () => {
    window.focus()
    n.close()
    if (options.url) window.location.href = options.url
  }
}

export function saveNotificationPreference(enabled) {
  localStorage.setItem('qpc_notifications', enabled ? 'enabled' : 'disabled')
}

export function getNotificationPreference() {
  return localStorage.getItem('qpc_notifications')
}
