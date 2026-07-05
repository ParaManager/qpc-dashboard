const CACHE_NAME = 'qpc-dashboard-v3'

const STATIC_ASSETS = [
  '/',
  '/index.html',
]

// Install - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch - network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip non-GET, chrome-extension, and Supabase/API requests
  if (event.request.method !== 'GET') return
  if (event.request.url.startsWith('chrome-extension://')) return
  if (event.request.url.startsWith('chrome://')) return
  if (event.request.url.includes('supabase.co')) return
  if (event.request.url.includes('anthropic.com')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

// ── Web Push ──────────────────────────────────────────────────────────────
// Everything below is new: handles real push messages arriving from the
// server (via the send-push edge function) and shows an OS-level notification
// even when the app itself isn't open. This works alongside the caching
// behavior above — same service worker, just listening for two more events.

// Fires when a push message actually arrives. This is the part that works
// with the app fully closed — the OS wakes the service worker just for this.
self.addEventListener('push', (event) => {
  let data = { title: 'QPC Dashboard', body: '', url: '/' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch (e) {
    // If the payload isn't valid JSON for some reason, fall back to plain text
    // rather than silently dropping the notification.
    if (event.data) data.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'qpc-notification',
      data: { url: data.url || '/' },
      requireInteraction: false,
    })
  )
})

// Tapping the notification focuses an existing tab if one's open, or opens a
// new one — same behavior whether the app was closed or just in the background.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})
