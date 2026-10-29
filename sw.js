// Service worker de GM Gestión (versión web / PWA).
// - La app (HTML, JS, CSS, íconos) queda en caché para abrir rápido y sin señal.
// - Los datos (Supabase) nunca se cachean acá: siempre van a la red.
// - Muestra los avisos y, al tocarlos, abre la pantalla correspondiente.
const CACHE = 'gm-app-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icons/icon-192.png'])))
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const claves = await caches.keys()
    await Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

// La app avisa cuando el usuario acepta actualizar
self.addEventListener('message', (e) => {
  if (e.data === 'actualizar') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  // Páginas: primero la red (para tomar la última versión), si no hay señal, la copia
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => {
      const copia = r.clone()
      caches.open(CACHE).then((c) => c.put('./index.html', copia))
      return r
    }).catch(() => caches.match('./index.html')))
    return
  }

  // Archivos con hash en el nombre: nunca cambian, primero la caché
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)) }
    return r
  })))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const ruta = (e.notification.data && e.notification.data.ruta) || '/'
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const v of ventanas) {
      if ('focus' in v) {
        await v.focus()
        v.postMessage({ tipo: 'navegar', ruta })
        return
      }
    }
    await self.clients.openWindow(`./#${ruta}`)
  })())
})
