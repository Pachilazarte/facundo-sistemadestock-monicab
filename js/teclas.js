'use strict';
/* Manejo con el teclado (mismo sistema que StockPay, versión sin librerías).
 *
 * Dos capas, porque son dos problemas distintos:
 *   1) conFlechas:  moverse EN ORDEN adentro de un grupo (menú, categorías, filas de una tabla). ↑↓ o ←→, Inicio/Fin.
 *   2) flechasEnLaPantalla: moverse por TODA la pantalla hacia donde está lo siguiente (como si fuera el mouse).
 * La capa 1 manda primero y, si resuelve la tecla, la 2 ni se entera (así una tabla se recorre en orden y, al llegar
 * al borde, la flecha "se escapa" hacia lo que haya al lado).
 * Además: Alt+1..5 salta de sección, y las ventanas (modal) frenan todo lo de atrás. */

/* ---------- Semáforo de ventanas: mientras hay una abierta, las flechas no tocan lo de atrás ---------- */
let modalAbierto = null;
const setModalActivo = el => { modalAbierto = el; };
const getModalActivo = () => modalAbierto;

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const CASTIGO_DESVIO = 3; // cuánto castiga desviarse del eje por el que se va
const GRACIA = 6;         // nada está alineado al píxel: 6 px de tolerancia

/* ---------- 1) Adentro de un grupo ordenado ---------- */
function conFlechas(contenedor, sentido = 'vertical') {
  if (!contenedor) return;
  contenedor.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const foco = document.activeElement;
    if (!foco) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(foco.tagName) || foco.isContentEditable) return; // escribir gana

    const vertical = (typeof sentido === 'function' ? sentido() : sentido) === 'vertical';
    let paso;
    if (e.key === (vertical ? 'ArrowDown' : 'ArrowRight')) paso = 1;
    else if (e.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) paso = -1;
    else if (e.key === 'Home') paso = -Infinity;
    else if (e.key === 'End') paso = Infinity;
    else return;

    const visibles = [...contenedor.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')].filter(x => x.offsetParent !== null);
    const items = visibles.filter(x => !visibles.some(y => y !== x && y.contains(x))); // una fila con botones adentro cuenta como un paso
    if (items.length < 2) return;
    const directo = items.indexOf(foco);
    const actual = directo !== -1 ? directo : items.findIndex(x => x.contains(foco));
    if (actual === -1) return;
    const destino = paso === -Infinity ? 0 : paso === Infinity ? items.length - 1 : Math.min(items.length - 1, Math.max(0, actual + paso));
    if (destino === actual) return; // no se da la vuelta, a propósito
    e.preventDefault();
    items[destino].focus();
  });
}

/* ---------- 2) Por toda la pantalla ---------- */
// No usar offsetParent para saber si se ve: un elemento "fixed" lo tiene nulo y se ve perfecto.
function esVisible(el) {
  if (!el.isConnected) return false;
  const st = getComputedStyle(el);
  return st.visibility !== 'hidden' && st.display !== 'none';
}

// ¿El cursor ya está contra el borde hacia el que se apunta? Con texto seleccionado, no: la flecha lo deshace primero.
function cursorEnLaPunta(el, dir) {
  let ini, fin;
  try { ini = el.selectionStart; fin = el.selectionEnd; } catch (e) { return false; }
  if (ini == null || fin == null) return true;
  if (ini !== fin) return false;
  return (dir === 'izquierda' || dir === 'arriba') ? ini === 0 : ini === (el.value || '').length;
}

// Un contenedor con scroll propio es dueño de la flecha mientras le quede algo para desplazar en ese sentido.
function esDesplazable(el, dir) {
  if (dir === 'izquierda' || dir === 'derecha') {
    if (el.scrollWidth <= el.clientWidth + 1) return false;
    return dir === 'izquierda' ? el.scrollLeft > 0 : el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
  }
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  return dir === 'arriba' ? el.scrollTop > 0 : el.scrollTop < el.scrollHeight - el.clientHeight - 1;
}

// ¿Esta tecla, en este control, es del control (editar texto, mover un selector) y no de la navegación?
function teclaDelControl(el, dir) {
  const vertical = dir === 'arriba' || dir === 'abajo';
  if (esDesplazable(el, dir)) return true;
  if (el.isContentEditable) return !cursorEnLaPunta(el, dir);
  const t = el.tagName;
  if (t === 'SELECT') return vertical;
  if (t === 'TEXTAREA') return !cursorEnLaPunta(el, dir);
  if (t !== 'INPUT') return false;
  const tipo = el.type;
  if (tipo === 'range') return true;
  if (tipo === 'number') return vertical || !cursorEnLaPunta(el, dir);
  if (['checkbox', 'radio', 'button', 'submit', 'reset', 'file'].includes(tipo)) return false;
  return !vertical && !cursorEnLaPunta(el, dir); // texto: solo el eje horizontal es suyo, y solo si hay cursor que mover
}

function primerVisible() {
  let mejor = null, mejorPuntaje = Infinity;
  (getModalActivo() || document).querySelectorAll(ENFOCABLES).forEach(el => {
    if (!esVisible(el)) return;
    const c = el.getBoundingClientRect();
    if (!c.width || !c.height || c.bottom < 0 || c.top > innerHeight || c.right < 0 || c.left > innerWidth) return;
    const p = Math.max(0, c.top) + Math.max(0, c.left);
    if (p < mejorPuntaje) { mejorPuntaje = p; mejor = el; }
  });
  return mejor;
}

function candidatos(desde, soloALaVista) {
  const lista = [];
  (getModalActivo() || document).querySelectorAll(ENFOCABLES).forEach(el => { // con una ventana abierta, ni se busca afuera
    if (el === desde || !esVisible(el)) return;
    const c = el.getBoundingClientRect();
    if (!c.width || !c.height) return;
    if (soloALaVista && (c.bottom < 0 || c.top > innerHeight || c.right < 0 || c.left > innerWidth)) return;
    if (el.contains(desde) || desde.contains(el)) return; // lo que rodea al foco no es destino
    lista.push({el, x: c.left + c.width / 2, y: c.top + c.height / 2, caja: c});
  });
  return lista;
}

function mejorDe(lista, o, dir) {
  const ox = o.left + o.width / 2, oy = o.top + o.height / 2;
  const vertical = dir === 'arriba' || dir === 'abajo';
  let enLinea = null, pEnLinea = Infinity, suelto = null, pSuelto = Infinity;
  for (const c of lista) {
    const avance = dir === 'abajo' ? c.caja.top - o.bottom : dir === 'arriba' ? o.top - c.caja.bottom
                 : dir === 'derecha' ? c.caja.left - o.right : o.left - c.caja.right;
    if (avance < -GRACIA) continue;
    const desvio = vertical ? Math.abs(c.x - ox) : Math.abs(c.y - oy);
    // "En línea" = se solapa con el foco en el eje que no es el del avance. Gana siempre sobre "suelto":
    // bajar en una grilla de tarjetas tiene que bajar recto, no saltar en diagonal.
    const solapa = vertical ? c.caja.right - GRACIA > o.left && c.caja.left + GRACIA < o.right
                            : c.caja.bottom - GRACIA > o.top && c.caja.top + GRACIA < o.bottom;
    if (solapa) { const p = Math.max(0, avance) + desvio * 0.1; if (p < pEnLinea) { pEnLinea = p; enLinea = c.el; } }
    else { const p = Math.max(0, avance) + desvio * CASTIGO_DESVIO; if (p < pSuelto) { pSuelto = p; suelto = c.el; } }
  }
  return enLinea || suelto;
}

function buscarDestino(desde, dir) {
  const o = desde.getBoundingClientRect();
  return mejorDe(candidatos(desde, true), o, dir) || mejorDe(candidatos(desde, false), o, dir);
}

window.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const dir = {ArrowUp: 'arriba', ArrowDown: 'abajo', ArrowLeft: 'izquierda', ArrowRight: 'derecha'}[e.key];
  if (!dir) return;

  const modal = getModalActivo();
  if (modal && !modal.contains(document.activeElement)) { // el foco se escapó de la ventana: se lo trae de vuelta
    e.preventDefault();
    (modal.querySelector(ENFOCABLES) || modal).focus();
    return;
  }

  const foco = document.activeElement;
  if (!foco || foco === document.body) {
    const p = primerVisible();
    if (!p) return;
    e.preventDefault(); p.focus(); p.scrollIntoView({block: 'nearest', inline: 'nearest'});
    return;
  }
  if (teclaDelControl(foco, dir)) return;
  const destino = buscarDestino(foco, dir);
  if (!destino) return;
  e.preventDefault(); destino.focus(); destino.scrollIntoView({block: 'nearest', inline: 'nearest'});
});

/* ---------- Enter sobre una fila/nombre enfocado = tocarlo (no son botones de verdad) ---------- */
window.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target;
  if (t && t.matches && t.matches('tr[tabindex], div[tabindex="0"]')) { e.preventDefault(); t.click(); }
});

/* ---------- Alt+1..5: saltar de sección. Con `e.code` y no `e.key`: con Alt apretado, `key` puede venir distinto ---------- */
window.addEventListener('keydown', e => {
  if (!e.altKey || e.ctrlKey || e.metaKey || getModalActivo()) return; // con una ventana encima no se cambia de sección
  const m = /^Digit([1-9])$/.exec(e.code);
  const b = m && $$('#nav [data-tab]')[Number(m[1]) - 1];
  if (!b) return;
  e.preventDefault();
  const tab = b.dataset.tab;
  irA(tab);
  const buscador = {stock: '#qs', cobros: '#qc', ventas: '#qv'}[tab];
  if (buscador) $(buscador).focus(); else if (tab !== 'vender') b.focus();
});

/* ---------- Dónde se aplica ---------- */
conFlechas($('#nav'), () => document.documentElement.classList.contains('vg') ? 'horizontal' : 'vertical');
conFlechas($('#cats'), 'horizontal');
conFlechas($('#metodos'), 'horizontal');
conFlechas($('#periodos'), 'horizontal');
conFlechas($('#ventasBody'), 'vertical');
