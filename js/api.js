'use strict';
/* Conexión con Apps Script + estado global + caché local + sincronización. */

// Link del servidor (Apps Script). Orden: ?c= en la dirección (link de instalación) > guardado en este equipo > js/config.js
const URL_OK = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
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
async function api(action, data = {}, rid) {
  try { return await apiUna(action, data, rid); }
  catch (e) { if (e.reintentable) return apiUna(action, data, rid); throw e; }
}

// POST con text/plain: es una "petición simple", así el navegador no hace preflight CORS y funciona abriendo el HTML desde el disco.
async function apiUna(action, data, rid) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(CFG.url, {
      method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({action, rid, ...data}), signal: ctl.signal
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Error desconocido');
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Tardó demasiado. Reintentá sin cambiar nada: no se duplica.');
    if (e instanceof TypeError || e instanceof SyntaxError) {
      const x = new Error('No se pudo conectar. Revisá internet.');
      x.reintentable = true; throw x;
    }
    throw e;
  } finally { clearTimeout(t); }
}

/* ---------- Estado ---------- */
let S = {productos: [], ventas: [], metodos: ['Efectivo'], avisos: [], negocio: 'Stock Lite', cargado: false, error: '', desdeCache: 0};

// Clave de búsqueda precalculada: buscar no recalcula acentos/minúsculas de todos los productos en cada tecla.
function indexar() { S.productos.forEach(p => { p.k = plain(p.nombre + ' ' + p.codigo + ' ' + p.categoria); }); }

function upsertProducto(p) {
  const i = S.productos.findIndex(x => x.codigo === p.codigo);
  if (i >= 0) S.productos[i] = p; else S.productos.push(p);
  indexar(); guardarCache();
}

/* ---------- Caché local: la app abre al instante con lo último que se vio y se actualiza por detrás ---------- */
const CACHE_KEY = 'stocklite_cache_v2';
function guardarCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ts: S.ts || Date.now(), d: {
      productos: S.productos.map(({k, ...p}) => p), ventas: S.ventas.slice(0, 400), metodos: S.metodos, negocio: S.negocio, avisos: S.avisos
    }}));
  } catch (e) {}
}
function cargarCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!c?.d?.productos) return false;
    S = {...S, ...c.d, cargado: true, desdeCache: c.ts, ts: c.ts};
    indexar();
    return true;
  } catch (e) { return false; }
}

/* ---------- Sincronización ---------- */
let syncSeq = 0, ultimaSync = 0, syncTimer = null;
const horaCorta = ts => new Date(ts).toLocaleTimeString('es-AR', {hour: '2-digit', minute: '2-digit'});

async function sync(silencioso) {
  const mi = ++syncSeq; // si hay dos sincronizaciones en vuelo, solo vale la última
  $('#btnSync').classList.add('girando');
  try {
    const j = await api('cargar');
    if (mi !== syncSeq) return;
    const avisos = j.avisos || [];
    if ((j.version || 1) < SERVIDOR_MINIMO) avisos.unshift(`El servidor de esta planilla (Codigo.gs) está desactualizado (versión ${j.version || 1}, se necesita ${SERVIDOR_MINIMO}). Pegá el Codigo.gs nuevo en Apps Script y publicá "Nueva versión".`);
    S = {...S, productos: j.productos, ventas: j.ventas, metodos: j.metodos, negocio: j.negocio, avisos,
         cargado: true, error: '', desdeCache: 0, ts: Date.now()};
    indexar(); ultimaSync = Date.now(); guardarCache();
    estadoSync();
    renderAll();
  } catch (e) {
    if (mi !== syncSeq) return;
    S.error = e.message; estadoSync();
    if (!silencioso || !S.cargado) renderAll();
    if (!silencioso) toast(e.message, 'err');
  } finally { if (mi === syncSeq) $('#btnSync').classList.remove('girando'); }
}

// Después de una operación NO se recarga todo al instante (la respuesta ya trae lo que cambió): se agrupa en una sola
// sincronización unos segundos después, por si hay varias ventas seguidas.
function programarSync(ms = 6000) { clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(true), ms); }

function estadoSync() {
  const el = $('#syncTxt');
  if (S.error) { el.innerHTML = `<span class="text-peligro-claro font-bold">Sin conexión</span>${S.ts ? ' · datos de ' + horaCorta(S.ts) : ''}`; return; }
  el.textContent = S.ts ? 'Actualizado ' + horaCorta(S.ts) : '—';
}

// Si la planilla se tocó a mano o pasó un rato, al volver a la pestaña se actualiza sola.
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - ultimaSync > 120000) sync(true); });
setInterval(() => { if (!document.hidden && Date.now() - ultimaSync > 300000 && !document.querySelector('dialog[open]')) sync(true); }, 60000);
