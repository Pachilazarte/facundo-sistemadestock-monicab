'use strict';
/* COLA SIN INTERNET: lo que se hace sin conexión NUNCA se pierde. Se guarda en la computadora y se sube solo cuando vuelve internet.
 *
 * Cómo funciona (pensado para que no se pierda ni se duplique nada, aunque pasen días sin conexión):
 *   1. Cada venta / cobro / ingreso / ajuste se guarda PRIMERO en la computadora (IndexedDB + una copia en localStorage), con un
 *      identificador único (rid) y la hora real en que se hizo.
 *   2. Se intenta subir en el momento. Si no hay internet, se aplica igual en pantalla (el stock baja, la venta aparece como
 *      "Sin subir") y la operación queda esperando en la cola.
 *   3. Cuando vuelve internet (al abrir la app, al volver la conexión, o cada 1 minuto si hay algo pendiente) se sube en orden,
 *      de a lotes. El servidor reconoce el rid: si algo ya se había subido, no se repite.
 *   4. Una operación solo sale de la cola cuando el servidor confirma que la guardó. Si el servidor rechaza una, queda visible
 *      como "con problema": nunca se descarta sola.
 * Solo las operaciones del día a día funcionan sin internet (vender, cobrar, ingresar y ajustar stock). Crear/editar/borrar
 * productos y anular ventas piden conexión (y avisan claro). */

const COLA_LOTE = 8;                       // operaciones por pedido
const COLA_LS = 'stocklite_cola_v1';       // copia de seguridad en localStorage
let COLA = [], colaLista = null, ultimaSeq = 0, avisoUltimoError = '';
const aplicadas = new Set();               // operaciones cuyo efecto ya está reflejado en pantalla (S)

// La cola solo se usa si el servidor la entiende (Codigo.gs versión 5 o más).
const colaActiva = () => (S.version || 0) >= 5;
const pendientes = () => COLA.filter(o => o.estado === 'pendiente');
const conProblema = () => COLA.filter(o => o.estado === 'problema');

/* ---------- Almacenamiento: IndexedDB + copia en localStorage ---------- */
function abrirIDB() {
  return new Promise((ok, no) => {
    try {
      const q = indexedDB.open('stocklite', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('cola', {keyPath: 'rid'});
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
    } catch (e) { no(e); }
  });
}
let idbP = null;
const idb = () => idbP || (idbP = abrirIDB().catch(() => null));

async function idbEscribir(op) { const db = await idb(); if (!db) return; await new Promise(r => { const t = db.transaction('cola', 'readwrite'); t.objectStore('cola').put(op); t.oncomplete = t.onerror = t.onabort = () => r(); }); }
async function idbBorrar(rid) { const db = await idb(); if (!db) return; await new Promise(r => { const t = db.transaction('cola', 'readwrite'); t.objectStore('cola').delete(rid); t.oncomplete = t.onerror = t.onabort = () => r(); }); }
async function idbLeer() { const db = await idb(); if (!db) return []; return new Promise(r => { const q = db.transaction('cola').objectStore('cola').getAll(); q.onsuccess = () => r(q.result || []); q.onerror = () => r([]); }); }
const espejo = () => { try { localStorage.setItem(COLA_LS, JSON.stringify(COLA)); } catch (e) {} };

async function colaIniciar() {
  try { navigator.storage?.persist?.(); } catch (e) {} // pide al navegador que NO borre estos datos si falta espacio
  let ls = []; try { ls = JSON.parse(localStorage.getItem(COLA_LS) || '[]'); } catch (e) {}
  const por = {};
  [...ls, ...await idbLeer()].forEach(o => { if (o && o.rid) por[o.rid] = o; }); // unión de las dos copias: si una se perdió, queda la otra
  COLA = Object.values(por).sort((a, b) => a.seq - b.seq);
  ultimaSeq = COLA.reduce((m, o) => Math.max(m, o.seq), 0);
  espejo();
  for (const o of COLA) await idbEscribir(o); // re-completa la copia que faltara
}
colaLista = colaIniciar();

async function guardarOp(op) { await idbEscribir(op); espejo(); }
async function quitarOp(rid) { COLA = COLA.filter(o => o.rid !== rid); aplicadas.delete(rid); await idbBorrar(rid); espejo(); }

/* ---------- Efecto en pantalla de lo que todavía no se subió ---------- */
const isoLocal = ts => { const d = new Date(ts), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const estadoDe = (total, pagado) => total - pagado <= 0.009 ? 'Pagada' : pagado > 0 ? 'Parcial' : 'Pendiente';
const r3 = n => Math.round(n * 1000) / 1000;
const prod = c => S.productos.find(p => p.codigo === String(c));

const EFECTOS = {
  registrarVenta(op) {
    const d = op.data, lineas = op.meta?.lineas || [];
    const total = r2(lineas.reduce((a, l) => a + l[4], 0)), pagado = d.pagoMonto || 0;
    S.ventas.unshift({id: -op.seq, fecha: isoLocal(op.ts), cliente: d.cliente || 'Mostrador', total, pagado, saldo: r2(total - pagado),
      estado: estadoDe(total, pagado), metodo: d.metodo, items: lineas, pendiente: true});
    lineas.forEach(l => { const p = prod(l[0]); if (p) p.stock = r3(p.stock - l[2]); });
  },
  registrarPago(op) {
    const x = S.ventas.find(v => v.id === op.data.idVenta); if (!x) return;
    x.pagado = r2(x.pagado + op.data.monto); x.saldo = r2(x.total - x.pagado); x.estado = estadoDe(x.total, x.pagado);
  },
  ingresoStock(op) {
    const p = prod(op.data.codigo); if (!p) return;
    p.stock = r3(p.stock + op.data.cantidad);
    if (op.data.costo !== undefined && op.data.costo !== null) p.costo = op.data.costo;
  },
  ajusteStock(op) { const p = prod(op.data.codigo); if (p) p.stock = op.data.nuevoStock; }
};

function aplicarEfecto(op) {
  if (aplicadas.has(op.rid) || !EFECTOS[op.action]) return;
  EFECTOS[op.action](op); aplicadas.add(op.rid);
  indexar(); guardarCache();
}
// Tras una sincronización S se reemplaza con lo del servidor: se vuelve a poner encima lo que todavía no se subió.
function reaplicarCola() { aplicadas.clear(); pendientes().forEach(aplicarEfecto); }
// Al abrir la app con la copia local: solo lo que esa copia todavía no reflejaba.
function reaplicarFaltantes() { pendientes().forEach(aplicarEfecto); }

/* ---------- Subida ---------- */
let cadena = Promise.resolve();
const enFila = fn => { const p = cadena.then(fn, fn); cadena = p.catch(() => {}); return p; }; // de a una: nunca dos subidas a la vez

// Intenta subir lo pendiente. Devuelve el resultado de la operación `rid` si se pidió (null = no se pudo subir ahora).
function subirCola(rid) { return enFila(() => subirInterno(rid)); }
async function subirInterno(rid) {
  await colaLista;
  let mio = null, huboCambios = false;
  while (true) {
    const lote = pendientes().slice(0, COLA_LOTE);
    if (!lote.length) break;
    let j;
    try {
      j = await api('lote', {ops: lote.map(o => ({action: o.action, rid: o.rid, ts: o.ts, ...o.data}))}, undefined, 90000);
      avisoUltimoError = '';
    } catch (e) { avisoUltimoError = e.message; break; } // sin conexión (o el servidor ocupado): todo queda guardado para el próximo intento
    for (const r of j.results || []) {
      const op = COLA.find(o => o.rid === r.rid); if (!op) continue;
      if (r.ok) {
        if (r.rid === rid) mio = {ok: true, r: r.r}; else if (aplicadas.has(r.rid)) huboCambios = true;
        await quitarOp(r.rid);
      } else if (r.rid === rid) {      // la acaba de pedir el usuario: se le muestra el error para que lo corrija, y no queda en la cola
        mio = {ok: false, error: r.error}; await quitarOp(r.rid);
      } else {                         // una vieja que el servidor rechazó: NO se descarta, queda visible para revisar
        op.estado = 'problema'; op.error = r.error; aplicadas.delete(op.rid); huboCambios = true; await guardarOp(op);
      }
    }
  }
  actualizarAvisoCola();
  if (huboCambios) setTimeout(() => sync(true), 300); // se alinea la pantalla con lo que quedó realmente en la planilla
  return mio;
}

// Lo que usa la pantalla. Sin cola (servidor viejo) se comporta como siempre.
async function ejecutar(action, data, rid, meta) {
  if (!colaActiva()) return {confirmada: true, r: await api(action, data, rid)};
  await colaLista;
  let op = COLA.find(o => o.rid === rid);
  if (!op) {
    ultimaSeq = Math.max(Date.now(), ultimaSeq + 1);
    op = {rid, seq: ultimaSeq, action, data, meta, ts: Date.now(), estado: 'pendiente'};
    COLA.push(op);
    await guardarOp(op); // PRIMERO queda guardada en la computadora
  }
  const res = await subirCola(rid);
  if (res && res.ok) return {confirmada: true, r: res.r};
  if (res && res.ok === false) throw new Error(res.error);
  aplicarEfecto(op); actualizarAvisoCola(); // no se pudo subir ahora: queda guardada y se ve en pantalla
  return {confirmada: false, op};
}

// Reintento automático: al abrir, al volver internet y cada 1 minuto SOLO si hay algo pendiente.
async function intentarSubir() {
  await colaLista;
  const n = pendientes().length; if (!n) return;
  await subirCola();
  if (pendientes().length < n) sync(true);
}
setInterval(() => { if (!document.hidden && COLA.length && pendientes().length) intentarSubir(); }, 60000);
window.addEventListener('online', () => { if (COLA.length) intentarSubir(); });

/* ---------- Aviso y pantalla de pendientes ---------- */
function actualizarAvisoCola() {
  const b = $('#pendientes'); if (!b) return;
  const p = pendientes().length, x = conProblema().length;
  b.hidden = !(p || x);
  if (b.hidden) return;
  b.className = 'shrink-0 flex items-center gap-2 font-bold text-sm px-6 py-2.5 text-left hover:brightness-95 ' + (x ? 'bg-peligro-claro text-peligro' : 'bg-aviso-claro text-aviso');
  b.innerHTML = `${ic(x ? 'triangle-alert' : 'clock', 'w-4 h-4')}<span>${p ? `${p} ${p === 1 ? 'operación guardada' : 'operaciones guardadas'} en esta computadora, sin subir a la planilla (se suben solas cuando haya internet).` : ''}${x ? ` ${x} con problema: tocá para revisar.` : ' Tocá para ver.'}</span>`;
}

const TIPOS = {registrarVenta: 'Venta', registrarPago: 'Cobro', ingresoStock: 'Ingreso de stock', ajusteStock: 'Ajuste de stock'};
function modalPendientes() {
  const lista = () => COLA.map(o => `<div class="flex items-start gap-3 px-3 py-2.5 ${o.estado === 'problema' ? 'bg-peligro-claro/60' : ''}" data-rid="${esc(o.rid)}">
      <div class="min-w-0 flex-1"><div class="font-bold">${TIPOS[o.action] || o.action} <span class="font-medium text-suave text-sm">· ${fdate(new Date(o.ts).toISOString())}</span></div>
        <div class="text-sm text-suave truncate">${esc(o.meta?.resumen || '')}</div>
        <div class="text-xs font-bold ${o.estado === 'problema' ? 'text-peligro' : 'text-aviso'}">${o.estado === 'problema' ? 'Problema: ' + esc(o.error || '') : 'Esperando internet'}</div></div>
      ${o.estado === 'problema' ? `<button type="button" class="btn btn-sm" data-r>Reintentar</button><button type="button" class="btn btn-sm btn-peligro" data-d>Descartar</button>` : ''}</div>`).join('') || '<p class="text-sm text-suave py-3">No hay nada pendiente. Todo está subido a la planilla ✅</p>';
  const d = modal({titulo: 'Sin subir a la planilla', icono: 'clock', cancel: 'Cerrar', body: `
    <p class="text-sm text-suave mb-2">Esto está guardado en esta computadora y se sube solo cuando hay internet. <b class="text-texto">No se pierde</b> aunque se apague la compu o pasen días.</p>
    <div class="rounded-xl border border-borde divide-y divide-borde/70" data-lista>${lista()}</div>
    <div class="flex flex-wrap gap-2 mt-3"><button type="button" class="btn btn-marca" data-subir>${ic('refresh-cw', 'w-4 h-4')}Subir ahora</button><button type="button" class="btn" data-copia>${ic('download', 'w-4 h-4')}Guardar una copia (archivo)</button></div>`});
  const repintar = () => { $('[data-lista]', d).innerHTML = lista(); actualizarAvisoCola(); };
  d.addEventListener('click', async e => {
    const fila = e.target.closest('[data-rid]'), op = fila && COLA.find(o => o.rid === fila.dataset.rid);
    if (e.target.closest('[data-subir]')) {
      const b = e.target.closest('button'); b.disabled = true;
      const n = COLA.length; await subirCola(); repintar(); b.disabled = false;
      toast(COLA.length < n ? 'Se subió a la planilla' : (pendientes().length ? 'Todavía no hay conexión: sigue guardado en esta computadora' : 'Listo'), COLA.length < n ? 'ok' : 'info');
    } else if (e.target.closest('[data-copia]')) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify({exportado: new Date().toISOString(), operaciones: COLA}, null, 1)], {type: 'application/json'}));
      a.download = 'stocklite-pendientes-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } else if (op && e.target.closest('[data-r]')) {
      op.estado = 'pendiente'; op.error = ''; await guardarOp(op); reaplicarCola(); renderVista(); repintar(); intentarSubir().then(repintar);
    } else if (op && e.target.closest('[data-d]')) {
      if (confirm('¿Descartar esta operación? No se va a subir a la planilla y no se puede deshacer.')) { await quitarOp(op.rid); repintar(); }
    }
  });
}
$('#pendientes')?.addEventListener('click', modalPendientes);
