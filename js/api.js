'use strict';
/* Conexión con Apps Script + estado global + caché local + sincronización.
 *
 * Regla de oro (equipo lento + Google tarda 2 a 8 s por pedido): se le pide algo al servidor SOLO cuando hace falta.
 *   - Al abrir:      1 pedido ("cargar"), y mientras tanto se muestra lo último que se vio (caché).
 *   - Al guardar algo: 1 pedido (el de la acción). La respuesta ya trae lo que cambió: NO se vuelve a pedir todo.
 *   - Al volver a la ventana tras 10+ minutos, o al tocar ↻, o al volver internet: 1 pedido ("cargar").
 *   - NO hay recargas automáticas por reloj. */

// Link del servidor (Apps Script). Orden: ?c= en la dirección (link de instalación) > guardado en este equipo > js/config.js
const URL_OK = /^(https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec|http:\/\/localhost:\d+\/api)$/; // localhost: solo para pruebas
function aUrl(c) { c = String(c || '').trim(); return c.startsWith('http') ? c : (c ? 'https://script.google.com/macros/s/' + c + '/exec' : ''); }
function resolverUrl() {
  try {
    const c = aUrl(new URLSearchParams(location.search).get('c'));
    if (URL_OK.test(c)) { localStorage.setItem('stocklite_url', c); history.replaceState(null, '', location.pathname); return c; }
    const g = localStorage.getItem('stocklite_url') || '';
    if (URL_OK.test(g)) return g;
  } catch (e) {}
  const f = aUrl(CONEXION.url);
  return URL_OK.test(f) ? f : '';
}
const CFG = {url: resolverUrl()};

// Si la respuesta de Google viene rota (pasa de vez en cuando), se reintenta 1 vez. Es seguro: las lecturas no cambian nada
// y las escrituras llevan "rid", así el servidor nunca las aplica dos veces.
async function api(action, data = {}, rid, ms) {
  try { return await apiUna(action, data, rid, ms); }
  catch (e) { if (e.reintentable) return apiUna(action, data, rid, ms); throw e; }
}

// POST con text/plain: es una "petición simple", así el navegador no hace preflight CORS.
async function apiUna(action, data, rid, ms = 45000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  let r;
  try {
    r = await fetch(CFG.url, {
      method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({action, rid, ...data}), signal: ctl.signal
    });
  } catch (e) {
    clearTimeout(t);
    if (e.name === 'AbortError') throw new Error('Tardó demasiado en responder. Reintentá sin cambiar nada: no se duplica.');
    const x = new Error('No hay conexión con Google. Revisá el cable de internet y que la fecha y hora de la computadora sean correctas.');
    x.reintentable = true; throw x;
  }
  try {
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Error desconocido');
    return j;
  } catch (e) {
    if (e instanceof SyntaxError) { // llegó algo que no es de la planilla: casi siempre el código del link está incompleto o mal copiado
      const x = new Error('La planilla no respondió como se esperaba. Revisá que el link de instalación esté completo y bien copiado.');
      x.reintentable = true; throw x;
    }
    throw e;
  } finally { clearTimeout(t); }
}

/* ---------- Estado ---------- */
let S = {productos: [], ventas: [], metodos: ['Efectivo'], avisos: [], negocio: 'Stock Lite', hoy: null, hoySucio: false, version: 0,
         cargado: false, error: '', desdeCache: 0};

// Clave de búsqueda precalculada: buscar no recalcula acentos/minúsculas de todos los productos en cada tecla.
function indexar() { S.productos.forEach(p => { p.k = plain(p.nombre + ' ' + p.codigo + ' ' + p.categoria); }); }

function upsertProducto(p) {
  const i = S.productos.findIndex(x => x.codigo === p.codigo);
  if (i >= 0) S.productos[i] = p; else S.productos.push(p);
  indexar(); guardarCache();
}

/* ---------- Caché local: la app abre al instante con lo último que se vio y se actualiza por detrás ---------- */
const CACHE_KEY = 'stocklite_cache_v3';
let cacheTimer = null;
function guardarCache() { // se agrupa: escribir en el disco local es lento en equipos viejos
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ts: S.ts || Date.now(), d: {
        productos: S.productos.map(({k, ...p}) => p), ventas: S.ventas.slice(0, 300), metodos: S.metodos, negocio: S.negocio,
        avisos: S.avisos, hoy: S.hoy, version: S.version
      }, ap: typeof aplicadas !== 'undefined' ? [...aplicadas] : []}));
    } catch (e) {}
  }, 400);
}
function cargarCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!c?.d?.productos) return false;
    S = {...S, ...c.d, cargado: true, desdeCache: c.ts, ts: c.ts, hoySucio: false};
    if (typeof aplicadas !== 'undefined') (c.ap || []).forEach(r => aplicadas.add(r));
    indexar();
    return true;
  } catch (e) { return false; }
}

/* ---------- Sincronización ---------- */
let syncSeq = 0, ultimaSync = 0;
const horaCorta = ts => new Date(ts).toLocaleTimeString('es-AR', {hour: '2-digit', minute: '2-digit'});

async function sync(silencioso) {
  const mi = ++syncSeq; // si hay dos sincronizaciones en vuelo, solo vale la última
  $('#btnSync').classList.add('girando');
  try {
    if (typeof pendientes === 'function' && colaActiva() && pendientes().length) await subirCola(); // primero lo guardado sin internet
    const j = await api('cargar');
    if (mi !== syncSeq) return;
    if (j.redirect && j.redirect !== CFG.url && URL_OK.test(j.redirect) && !sessionStorage.getItem('stocklite_mudado')) { await mudarse(j.redirect); if (mi !== syncSeq) return; }
    const avisos = j.avisos || [];
    if ((j.version || 1) >= SERVIDOR_MINIMO && (j.version || 1) < 5) avisos.unshift('Para que las ventas hechas sin internet se guarden y se suban solas, actualizá el servidor: pegá el Codigo.gs nuevo (versión 5) y publicá "Nueva versión".');
    if ((j.version || 1) < SERVIDOR_MINIMO) avisos.unshift(`El servidor de esta planilla (Codigo.gs) está desactualizado (versión ${j.version || 1}, se necesita ${SERVIDOR_MINIMO}). Pegá el Codigo.gs nuevo en Apps Script y publicá "Nueva versión".`);
    S = {...S, productos: j.productos, ventas: j.ventas, metodos: j.metodos, negocio: j.negocio, avisos,
         hoy: j.hoy || null, hoySucio: false, version: j.version || 1,
         cargado: true, error: '', desdeCache: 0, ts: Date.now()};
    indexar(); ultimaSync = Date.now();
    if (typeof reaplicarCola === 'function' && colaActiva()) reaplicarCola(); // lo que todavía no se subió se vuelve a poner encima
    guardarCache();
    estadoSync();
    renderAll();
    if (typeof actualizarAvisoCola === 'function') actualizarAvisoCola();
  } catch (e) {
    if (mi !== syncSeq) return;
    S.error = e.message; estadoSync();
    if (!silencioso || !S.cargado) renderAll();
    if (!silencioso) toast(e.message, 'err');
  } finally { if (mi === syncSeq) $('#btnSync').classList.remove('girando'); }
}

// El servidor avisó que se mudó a otro link: se prueba el nuevo y, si responde, la app se pasa sola (sin tocar la compu).
async function mudarse(nueva) {
  const vieja = CFG.url;
  try {
    sessionStorage.setItem('stocklite_mudado', '1'); // evita vueltas infinitas si dos links se apuntan entre sí
    CFG.url = nueva;
    await api('cargar');
    localStorage.setItem('stocklite_url', nueva);
    localStorage.removeItem(CACHE_KEY); localStorage.removeItem('stocklite_ticket_v1'); // eran datos de la planilla anterior
    location.reload();
    await new Promise(() => {}); // la página se recarga: no seguir
  } catch (e) { CFG.url = vieja; }
}

function estadoSync() {
  const el = $('#syncTxt');
  if (S.error) { el.innerHTML = `<span class="text-peligro-claro font-bold">Sin conexión</span>${S.ts ? ' · datos de ' + horaCorta(S.ts) : ''}`; return; }
  el.textContent = S.ts ? 'Actualizado ' + horaCorta(S.ts) : '—';
}

// Por si se tocó la planilla a mano: al volver a la ventana después de 10+ minutos se actualiza. Y si volvió internet tras un corte.
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - ultimaSync > 600000) sync(true); });
window.addEventListener('online', () => { if (S.error) sync(true); });
