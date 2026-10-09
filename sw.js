/* Service worker: la app abre al instante y sin internet, y se actualiza sola.
 *  - Archivos propios: SIEMPRE desde la copia guardada (arranque instantáneo, sin pedir 15 archivos por la red).
 *    Cuando se publica una versión nueva (cambia js/version.js), el navegador baja todo de nuevo por detrás.
 *  - js/version.js: siempre por la red (es lo que avisa que hay una versión nueva).
 *  - Todo lo que no es de este sitio (Google Apps Script, etc.) NO pasa por acá: los datos siempre salen frescos. */
importScripts('js/version.js');
const CACHE = 'stocklite-' + APP_VERSION;
const NUCLEO = ['./', 'index.html', 'css/colores.css', 'css/estilos.css', 'css/tailwind.css', 'fonts/manrope-latin-wght-normal.woff2',
  'js/version.js', 'js/config.js', 'js/utils.js', 'js/teclas.js', 'js/api.js', 'js/cola.js', 'js/pwa.js', 'js/app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(NUCLEO.map(u => new Request(u, {cache: 'reload'})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('stocklite-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/js/version.js')) { // para detectar versiones nuevas: red primero
    e.respondWith(fetch(req).catch(() => caches.match(req, {ignoreSearch: true})));
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
    return r;
  }).catch(() => caches.match('index.html'))));
});
