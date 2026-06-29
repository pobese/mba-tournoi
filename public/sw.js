/*
 * Service worker minimal — RacketClub PWA.
 * Stratégie :
 *  - navigations : network-first (jamais de page authentifiée servie périmée),
 *    avec repli sur le cache puis sur "/" si hors-ligne ;
 *  - assets statiques (_next/static, images, fonts, css, js) : cache-first ;
 *  - API / auth / méthodes non-GET / cross-origin : jamais touchés.
 */
const CACHE = 'racketclub-v2'
const PRECACHE = ['/', '/manifest.json', '/icon-192.svg', '/icon-512.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) return

  // Navigations : network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/'))
      )
    )
    return
  }

  // Assets statiques : cache-first, puis mise en cache au passage
  const isStatic =
    url.pathname.startsWith('/_next/static') ||
    ['style', 'script', 'image', 'font'].includes(request.destination)

  if (!isStatic) return

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
    )
  )
})
