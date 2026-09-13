const CACHE = 'chihiro-web-v18'
const PRECACHE = [
  '/',
  '/index.html',
  '/app.css',
  '/app.js',
  '/icon.png',
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  )
})

function shouldBypass(url) {
  const path = url.pathname
  return (
    path === '/next' ||
    path.startsWith('/next/') ||
    path.startsWith('/api') ||
    path.startsWith('/i/') ||
    path.startsWith('/plugin') ||
    path.startsWith('/webui') ||
    path.startsWith('/astrbot') ||
    path.startsWith('/onebot')
  )
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (shouldBypass(url)) return

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  )
})
