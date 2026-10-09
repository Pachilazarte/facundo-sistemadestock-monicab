'use strict';
/* Helpers compartidos: formato, íconos, avisos y ventanas modales. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const fmt = new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS'});
const money = n => fmt.format(Number(n) || 0);
const num = n => new Intl.NumberFormat('es-AR', {maximumFractionDigits: 3}).format(n);
const r2 = n => Math.round(n * 100) / 100;
const plain = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// ID de operación = identificador de la pantalla + huella del contenido.
// Reintentar lo MISMO (por un corte) repite el ID y el servidor no duplica nada.
// Si el contenido cambió entre intentos, el ID cambia y no se devuelve por error una operación vieja.
const huella = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const ridDe = (nonce, payload) => nonce + '-' + huella(JSON.stringify(payload));

// Acepta "1.500,50" y "1500.50"
const parseNum = v => {
  v = String(v ?? '').trim();
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  const n = Number(v);
  return v === '' || isNaN(n) ? NaN : n;
};

const fdate = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', {hour: '2-digit', minute: '2-digit'});
};
// Para tablas: "9/10 13:26" (el año y los segundos sobran y ocupan lugar)
const fdateCorta = iso => { if (!iso) return ''; const d = new Date(iso); return d.getDate() + '/' + (d.getMonth() + 1) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const diasDesde = iso => Math.floor((Date.now() - new Date(iso)) / 864e5);
const hace = n => n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`;
const iniciales = s => String(s).trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/* ---------- Íconos: conjunto propio incrustado en index.html (se regenera con construir-iconos.bat) ----------
 * Un <svg> que apunta al símbolo: no hay que "recorrer la pantalla" después de dibujar, y pesa miles de veces menos. */
const ic = (nombre, cls = 'w-4 h-4') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${nombre}"/></svg>`;

// Ejecuta la función recién cuando el usuario deja de escribir (en una PC lenta evita dibujar en cada tecla).
const debounce = (fn, ms = 140) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- Estados de venta: un solo lugar para sus colores/íconos ---------- */
const ESTADOS = {
  Pagada:    ['bg-ok-claro text-ok', 'circle-check'],
  Parcial:   ['bg-aviso-claro text-aviso', 'clock'],
  Pendiente: ['bg-peligro-claro text-peligro', 'circle-alert'],
  Anulada:   ['bg-hundido text-suave', 'ban']
};
const badge = e => {
  const [cls, ico] = ESTADOS[e] || ESTADOS.Anulada;
  return `<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}">${ic(ico, 'w-3 h-3')}${esc(e)}</span>`;
};

/* ---------- Avisos ---------- */
function toast(msg, tipo = 'info') {
  const [ico, color] = {ok: ['circle-check', 'text-ok'], err: ['circle-alert', 'text-peligro'], info: ['info', 'text-marca']}[tipo] || ['info', 'text-marca'];
  const d = document.createElement('div');
  d.className = 'flex items-start gap-2.5 bg-superficie border border-borde rounded-xl px-4 py-3 text-sm font-semibold max-w-sm';
  d.innerHTML = `<span class="${color} mt-px">${ic(ico, 'w-5 h-5')}</span><span>${esc(msg)}</span>`;
  $('#toast').append(d);
  setTimeout(() => d.remove(), tipo === 'err' ? 6000 : 2800);
}

/* ---------- Modal ----------
 * onOk(d) puede lanzar Error: el mensaje se muestra dentro del modal y no se cierra.
 * Sin onOk: modal informativo (solo "Cerrar"). */
function modal({titulo, icono = 'circle', body, ok = 'Guardar', okIcono = 'check', onOk, cancel = 'Cancelar', forzado, peligro}) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form class="flex flex-col">
    <div class="flex items-center gap-3 px-6 pt-5 pb-2">
      <span class="grid place-items-center w-10 h-10 rounded-xl bg-marca-claro text-marca shrink-0">${ic(icono, 'w-5 h-5')}</span>
      <h3 class="font-extrabold text-lg flex-1 min-w-0">${esc(titulo)}</h3>
      ${forzado ? '' : `<button type="button" data-close class="btn btn-ico" aria-label="Cerrar">${ic('x', 'w-5 h-5')}</button>`}
    </div>
    <div class="px-6 pb-2 overflow-y-auto" data-body>${body}</div>
    <p data-err class="mx-6 mt-2 rounded-lg bg-peligro-claro text-peligro text-sm font-bold px-3 py-2" hidden></p>
    <div class="flex justify-end gap-2 px-6 py-4">
      ${cancel ? `<button type="button" class="btn" data-close>${cancel}</button>` : ''}
      ${onOk ? `<button class="btn ${peligro ? 'btn-rojo' : 'btn-marca'}" data-ok>${ic(okIcono, 'w-4 h-4')}${ok}</button>` : ''}
    </div></form>`;
  const antes = document.activeElement; // al cerrar, el foco vuelve a quien abrió la ventana
  document.body.append(d);
  d.showModal();
  setModalActivo(d);
  d.addEventListener('close', () => {
    d.remove();
    setModalActivo($$('dialog[open]').pop() || null);
    if (antes && antes.isConnected && !$$('dialog[open]').length) antes.focus();
  });
  if (forzado) d.addEventListener('cancel', e => e.preventDefault());
  $$('[data-close]', d).forEach(b => b.addEventListener('click', () => d.close()));
  $('form', d).addEventListener('submit', async e => {
    e.preventDefault();
    if (!onOk) return;
    const b = $('[data-ok]', d), er = $('[data-err]', d);
    b.disabled = true; er.hidden = true;
    try { await onOk(d); d.close(); }
    catch (x) { er.textContent = x.message; er.hidden = false; b.disabled = false; }
  });
  $('input:not([readonly]),select', d)?.focus();
  return d;
}
const v = (d, n) => $(`[name=${n}]`, d).value;
