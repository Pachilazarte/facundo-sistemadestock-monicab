/* Service worker: la app abre sin internet y se actualiza sola.
 *  - Archivos propios: primero la red (siempre la última versión de GitHub), y si no hay internet, la copia guardada.
 *  - Librerías externas (solo la fuente de Google): primero la copia guardada (son versiones fijas).
 *  - Las llamadas a Google Apps Script NUNCA pasan por acá: los datos siempre salen frescos del servidor. */
importScripts('js/version.js');
const CACHE = 'stocklite-' + APP_VERSION;
const NUCLEO = ['./', 'index.html', 'css/colores.css', 'css/estilos.css', 'css/tailwind.css', 'js/vendor/lucide-0.468.0.min.js', 'js/version.js', 'js/config.js',
  'js/utils.js', 'js/api.js', 'js/pwa.js', 'js/app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(NUCLEO.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('stocklite-') && k !== CACHE && k !== 'stocklite-libs').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  if (url.origin === location.origin) {
    e.respondWith(fetch(req, {cache: 'no-cache'}).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match('index.html'))));
    return;
  }

  e.respondWith(caches.open('stocklite-libs').then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') c.put(req, r.clone());
    return r;
  }))));
});
