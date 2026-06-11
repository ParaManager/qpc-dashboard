// Browser Push Notifications helper

const VAPID_PUBLIC_KEY = null // We'll use basic browser notifications (no server push needed)

// Request permission and return true if granted
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission // 'granted', 'denied', 'default'
}

// Send a browser notification
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

// Save subscription to localStorage for persistence
export function saveNotificationPreference(enabled) {
  localStorage.setItem('qpc_notifications', enabled ? 'enabled' : 'disabled')
}

export function getNotificationPreference() {
  return localStorage.getItem('qpc_notifications')
}
