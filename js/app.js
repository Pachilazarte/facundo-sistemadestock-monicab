'use strict';
/* Vistas y acciones: Vender, Stock, Cobros, Ventas, Resumen.
 * Se dibuja SOLO la pestaña que se ve (las otras se dibujan al entrar): en una PC lenta es lo que más se nota. */

let cart = [], cartNonce = null, montoEdit = false, metodoSel = null, fiado = false, otrosAbierto = false, catSel = '', soloBajo = false;
let tabActual = 'vender', limiteGrid = 48, periodoSel = 'hoy', resCache = {}, resSeq = 0;
const LIM_GRID = 48, LIM_STOCK = 200, LIM_VENTAS = 120;
const servidorNuevo = () => (S.version || 1) >= 3; // v3: permite borrar productos y trae el detalle de ventas en la carga

/* =====================  NAVEGACIÓN  ===================== */
function irA(tab) {
  tabActual = tab;
  $$('#nav .nav-item').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $$('.tab').forEach(s => s.classList.toggle('hidden', s.id !== 't-' + tab));
  renderVista(tab);
  if (tab === 'vender') $('#q').focus();
}
$('#nav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) irA(b.dataset.tab); });
window.addEventListener('keydown', e => { if (e.key === 'F2' && !getModalActivo()) { e.preventDefault(); irA('vender'); } });

/* Pantalla completa (botón; F11 del navegador hace lo mismo). Si el navegador no lo permite, el botón se oculta. */
if (!document.documentElement.requestFullscreen) $('#btnPantalla').hidden = true;
$('#btnPantalla').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => toast('Tu navegador no permitió la pantalla completa. Probá con F11.', 'err'));
});
document.addEventListener('fullscreenchange', () => {
  const full = !!document.fullscreenElement;
  $('#btnPantalla use').setAttribute('href', '#i-' + (full ? 'minimize' : 'maximize'));
  $('#btnPantalla').title = full ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa (F11)';
});

/* Vista grande: letra y botones más grandes, el menú pasa arriba en una botonera. No saca ninguna opción. Se recuerda en este equipo. */
function vistaGrande(on, guardar) {
  document.documentElement.classList.toggle('vg', on);
  const b = $('#btnVG'); b.setAttribute('aria-checked', on); b.classList.toggle('on', on);
  if (guardar) try { localStorage.setItem('stocklite_vg', on ? '1' : '0'); } catch (e) {}
}
$('#btnVG').addEventListener('click', () => vistaGrande(!document.documentElement.classList.contains('vg'), true));
vistaGrande(document.documentElement.classList.contains('vg'));

function renderVista(tab = tabActual) {
  if (tab === 'vender') {
    renderMetodos(); renderCats(); renderGrid();
    if (!document.activeElement?.closest('#cart')) renderCart(); // no se redibuja el ticket mientras se escribe en él
  } else if (tab === 'stock') renderStock();
  else if (tab === 'cobros') renderCobros();
  else if (tab === 'ventas') renderVentas();
  else if (tab === 'resumen') cargarResumen();
}

// Tras guardar algo: el resumen de "hoy" queda desactualizado (se vuelve a pedir SOLO si abren esa pestaña) y se guarda la caché.
// NO se vuelve a pedir toda la planilla: la respuesta de cada acción ya trae lo que cambió.
function tras() { resCache = {}; S.hoySucio = true; guardarCache(); }

/* =====================  VENDER  ===================== */
const activos = () => S.productos.filter(p => p.activo);
const enCarro = codigo => cart.find(l => l.codigo === codigo)?.cantidad || 0;
const totalCart = () => r2(cart.reduce((a, l) => a + l.cantidad * l.precio, 0));

function filtrados() {
  const q = plain($('#q').value.trim());
  return activos()
    .filter(p => (!catSel || p.categoria === catSel) && (!q || p.k.includes(q)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function renderCats() {
  const cats = [...new Set(activos().map(p => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  if (catSel && !cats.includes(catSel)) catSel = '';
  $('#cats').innerHTML = cats.length
    ? [''].concat(cats).map(c => `<button class="chip ${c === catSel ? 'on' : ''}" data-cat="${esc(c)}">${c ? esc(c) : 'Todos'}</button>`).join('')
    : '';
  $('#cats').classList.toggle('hidden', !cats.length);
}

function renderGrid() {
  const g = $('#grid');
  if (!S.cargado) {
    g.innerHTML = S.error
      ? `<div class="col-span-full text-center py-12"><span class="grid place-items-center w-14 h-14 rounded-2xl bg-peligro-claro text-peligro mx-auto mb-3">${ic('wifi-off', 'w-7 h-7')}</span>
         <p class="font-extrabold text-lg">No se pudo conectar</p><p class="text-suave mb-4">${esc(S.error)}</p><button class="btn btn-marca" data-retry>${ic('refresh-cw', 'w-4 h-4')}Reintentar</button></div>`
      : `<div class="col-span-full text-center text-suave py-12">Conectando con la planilla…</div>`;
    return;
  }
  if (!activos().length) {
    g.innerHTML = `<div class="col-span-full text-center py-12">
      <span class="grid place-items-center w-14 h-14 rounded-2xl bg-marca-claro text-marca mx-auto mb-3">${ic('package-plus', 'w-7 h-7')}</span>
      <p class="font-extrabold text-lg">Todavía no hay productos</p><p class="text-suave mb-4">Cargá el primero para empezar a vender.</p>
      <button class="btn btn-marca" data-nuevo>${ic('plus', 'w-4 h-4')}Nuevo producto</button></div>`;
    return;
  }
  const l = filtrados(), ver = l.slice(0, limiteGrid);
  g.innerHTML = l.length ? ver.map(p => {
    const n = enCarro(p.codigo), agot = p.stock <= 0, bajo = !agot && p.stock <= p.minimo, malo = !!p.revisar;
    const est = malo ? `<span class="text-peligro">Revisar datos</span>` : agot ? `<span class="text-peligro">Agotado</span>` : bajo ? `<span class="text-aviso">Quedan ${num(p.stock)}</span>` : `<span class="text-suave">${num(p.stock)} en stock</span>`;
    return `<button data-c="${esc(p.codigo)}" title="N° ${esc(p.codigo)}" class="relative text-left flex flex-col gap-0.5 rounded-xl border bg-superficie px-3 py-2.5 hover:border-marca ${n ? 'border-marca' : 'border-borde'} ${agot || malo ? 'opacity-50' : ''}">
      ${n ? `<span class="absolute -top-1.5 -right-1.5 grid place-items-center min-w-5 h-5 px-1 rounded-full bg-marca text-marca-sobre text-[11px] font-extrabold">${num(n)}</span>` : ''}
      <span class="font-bold text-[15px] leading-tight line-clamp-2 min-h-[2.1em]">${esc(p.nombre)}</span>
      <span class="text-xl font-extrabold num leading-tight">${money(p.precio)}</span>
      <span class="text-xs font-semibold leading-tight">${est}</span></button>`;
  }).join('') + (l.length > ver.length ? `<div class="col-span-full text-center py-2"><button class="btn btn-sm" data-mas>Mostrar más (${l.length - ver.length} restantes)</button></div>` : '')
    : `<div class="col-span-full text-center text-suave py-12">${ic('search-x', 'w-8 h-8 mx-auto mb-2')}Sin resultados para esa búsqueda</div>`;
}

function buscar() { limiteGrid = LIM_GRID; renderGrid(); }
$('#q').addEventListener('input', debounce(buscar)); // espera a que termine de escribir
$('#q').addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#q').value = ''; buscar(); return; }
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const t = $('#q').value.trim();
  if (!t) return;
  const p = activos().find(x => x.codigo === t) || filtrados()[0]; // N° exacto (atajo) o el primero de la lista
  if (p) agregar(p.codigo); else toast('No existe ese producto', 'err');
});
$('#grid').addEventListener('click', e => {
  if (e.target.closest('[data-retry]')) return sync();
  if (e.target.closest('[data-nuevo]')) return modalProducto();
  if (e.target.closest('[data-mas]')) { limiteGrid += LIM_GRID; return renderGrid(); }
  const b = e.target.closest('[data-c]'); if (b) agregar(b.dataset.c);
});
$('#cats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { catSel = b.dataset.cat; limiteGrid = LIM_GRID; renderCats(); renderGrid(); } });

function agregar(codigo) {
  const p = S.productos.find(x => x.codigo === codigo); if (!p) return;
  if (p.revisar) return toast(`"${p.nombre}" tiene datos inválidos en la planilla (${p.revisar}). Corregilo para poder venderlo.`, 'err');
  if (enCarro(codigo) + 1 > p.stock) return toast(p.stock <= 0 ? `${p.nombre} está agotado` : `Stock insuficiente de ${p.nombre} (hay ${num(p.stock)})`, 'err');
  const l = cart.find(x => x.codigo === codigo);
  if (l) l.cantidad++; else cart.push({codigo: p.codigo, nombre: p.nombre, precio: p.precio, cantidad: 1});
  cartNonce = cartNonce || uid();
  if ($('#q').value) { $('#q').value = ''; limiteGrid = LIM_GRID; }
  renderGrid(); renderCart(); $('#q').focus();
}

function renderCart() {
  const total = totalCart();
  $('#cartCount').textContent = cart.length ? `· ${cart.length} ${cart.length === 1 ? 'producto' : 'productos'}` : '';
  $('#cart').innerHTML = cart.length ? cart.map((l, i) => `
    <div class="py-3 border-b border-borde/70" data-i="${i}">
      <div class="flex items-start justify-between gap-2">
        <span class="font-bold leading-snug">${esc(l.nombre)}</span>
        <button data-del class="btn btn-ico btn-peligro !p-1" title="Quitar" aria-label="Quitar">${ic('x', 'w-4 h-4')}</button>
      </div>
      <div class="flex items-center gap-2 mt-2">
        <div class="flex items-center rounded-lg border border-borde overflow-hidden">
          <button data-act="dec" class="px-2.5 py-1.5 hover:bg-hundido" aria-label="Menos">${ic('minus', 'w-3.5 h-3.5')}</button>
          <input data-f="cantidad" value="${l.cantidad}" inputmode="decimal" aria-label="Cantidad" class="w-12 text-center font-bold bg-transparent py-1 focus:outline-none num">
          <button data-act="inc" class="px-2.5 py-1.5 hover:bg-hundido" aria-label="Más">${ic('plus', 'w-3.5 h-3.5')}</button>
        </div>
        <span class="text-suave text-sm">×</span>
        <input data-f="precio" value="${l.precio}" inputmode="decimal" aria-label="Precio" class="campo !w-24 !py-1.5 text-right num">
        <span class="ml-auto font-extrabold num" data-sub>${money(l.cantidad * l.precio)}</span>
      </div>
    </div>`).join('')
    : `<div class="h-full grid place-items-center text-center text-suave py-8"><div>
        <span class="grid place-items-center w-14 h-14 rounded-2xl bg-hundido mx-auto mb-3">${ic('shopping-cart', 'w-7 h-7')}</span>
        <p class="font-bold text-texto">El ticket está vacío</p><p class="text-sm">Tocá un producto o escribí su N° y Enter.</p></div></div>`;
  $('#total').textContent = money(total);
  $('#cobrarTotal').textContent = cart.length ? '· ' + money(total) : '';
  if (!montoEdit && !fiado) $('#monto').value = total ? String(total).replace('.', ',') : '';
  actualizarSaldo();
  $('#btnCobrar').disabled = !cart.length;
  $('#btnVaciar').classList.toggle('invisible', !cart.length);
  guardarBorrador();
}

function actualizarSaldo() {
  const total = totalCart(), m = parseNum($('#monto').value), saldo = r2(total - (isNaN(m) ? 0 : m));
  let html = '';
  if (cart.length && fiado) {
    if (saldo > 0.009) html = `<span class="inline-flex items-center gap-1.5 rounded-lg bg-aviso-claro text-aviso text-sm font-bold px-2.5 py-1">${ic('clock', 'w-4 h-4')}Queda a cuenta: ${money(saldo)}</span>`;
    else if (saldo < -0.009) html = `<span class="inline-flex items-center gap-1.5 rounded-lg bg-peligro-claro text-peligro text-sm font-bold px-2.5 py-1">${ic('circle-alert', 'w-4 h-4')}El pago supera el total</span>`;
    else html = `<span class="inline-flex items-center gap-1.5 rounded-lg bg-ok-claro text-ok text-sm font-bold px-2.5 py-1">${ic('circle-check', 'w-4 h-4')}Pago completo</span>`;
  }
  $('#saldoInfo').innerHTML = html;
}

/* ---- Ticket abierto: sobrevive a recargas, cortes de luz o cierres por accidente ---- */
const DRAFT_KEY = 'stocklite_ticket_v1';
let borradorListo = false;
function guardarBorrador() {
  try {
    if (!cart.length) return localStorage.removeItem(DRAFT_KEY);
    localStorage.setItem(DRAFT_KEY, JSON.stringify({cart, nonce: cartNonce, cliente: $('#cliente').value, metodo: metodoSel, fiado, monto: $('#monto').value, montoEdit}));
  } catch (e) {}
}
function restaurarBorrador() {
  if (borradorListo || !S.cargado) return;
  borradorListo = true;
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!d?.cart?.length) return;
    cart = d.cart.filter(l => S.productos.some(p => p.codigo === l.codigo && p.activo));
    if (!cart.length) return localStorage.removeItem(DRAFT_KEY);
    cartNonce = d.nonce || uid(); montoEdit = !!d.montoEdit;
    if (d.metodo && S.metodos.includes(d.metodo)) metodoSel = d.metodo;
    $('#cliente').value = d.cliente || ''; fiado = !!d.fiado;
    renderMetodos(); renderCart();
    if (montoEdit) { $('#monto').value = d.monto; actualizarSaldo(); }
    infoCliente();
    toast('Se recuperó el ticket que había quedado abierto', 'info');
  } catch (e) {}
}
$('#cliente').addEventListener('input', debounce(guardarBorrador, 300));

// Edición en vivo: solo se actualizan textos (no se redibuja, así no se pierde el foco al tipear)
$('#cart').addEventListener('input', e => {
  const f = e.target.dataset.f, fila = e.target.closest('[data-i]'); if (!f || !fila) return;
  const n = parseNum(e.target.value); if (isNaN(n) || n < 0) return;
  const l = cart[fila.dataset.i]; l[f] = n;
  $('[data-sub]', fila).textContent = money(l.cantidad * l.precio);
  $('#total').textContent = money(totalCart()); $('#cobrarTotal').textContent = '· ' + money(totalCart());
  if (!montoEdit && !fiado) $('#monto').value = String(totalCart()).replace('.', ',');
  actualizarSaldo(); guardarBorrador();
});
$('#cart').addEventListener('change', e => {
  const f = e.target.dataset.f, fila = e.target.closest('[data-i]'); if (!f || !fila) return;
  const l = cart[fila.dataset.i], p = S.productos.find(x => x.codigo === l.codigo);
  if (f === 'cantidad') {
    if (!(l.cantidad > 0)) l.cantidad = 1;
    if (p && l.cantidad > p.stock) { l.cantidad = p.stock; toast(`Máximo en stock: ${num(p.stock)}`, 'err'); }
  }
  renderCart(); renderGrid();
});
$('#cart').addEventListener('click', e => {
  const fila = e.target.closest('[data-i]'); if (!fila) return;
  const i = Number(fila.dataset.i), l = cart[i], act = e.target.closest('[data-act]')?.dataset.act;
  if (e.target.closest('[data-del]')) { cart.splice(i, 1); if (!cart.length) { cartNonce = null; montoEdit = false; } }
  else if (act === 'inc') return agregar(l.codigo);
  else if (act === 'dec') { if (l.cantidad > 1) l.cantidad--; else return; }
  else return;
  renderCart(); renderGrid();
});

function renderMetodos() {
  const ms = S.metodos;
  const ef = ms.find(m => plain(m).includes('efectivo')) || ms[0], tr = ms.find(m => plain(m).includes('transf'));
  const fijos = [...new Set([ef, tr].filter(Boolean))], otros = ms.filter(m => !fijos.includes(m));
  if (!ms.includes(metodoSel)) metodoSel = ef;
  const enOtros = otros.includes(metodoSel);
  if (enOtros && !fiado) otrosAbierto = true;
  const chip = (m) => `<button class="chip ${!fiado && m === metodoSel ? 'on' : ''}" data-metodo="${esc(m)}" title="${esc(m)}">${m === 'Transferencia' ? 'Transf.' : esc(m)}</button>`; // "Transf." para que entren los 4 en una fila
  $('#metodos').innerHTML = fijos.map(chip).join('')
    + `<button class="chip ${fiado ? 'on' : ''}" data-fiado title="Queda debiendo: se anota a nombre de un cliente">Pendiente</button>`
    + (otros.length ? `<button class="chip ${!fiado && enOtros ? 'on' : ''}" data-otros aria-expanded="${otrosAbierto}">Otros</button>` : '');
  $('#metodosOtros').hidden = !(otros.length && otrosAbierto);
  $('#metodosOtros').innerHTML = otros.map(chip).join('');
  $('#bloqueFiado').hidden = !fiado;
  $('#clientes').innerHTML = [...new Set(S.ventas.map(x => x.cliente).filter(c => c && c !== 'Mostrador'))].map(c => `<option value="${esc(c)}">`).join('');
}
function infoCliente() {
  const c = $('#cliente').value.trim(), el = $('#clienteInfo');
  if (!c) { el.textContent = ''; return; }
  const k = plain(c), ventas = S.ventas.filter(x => plain(x.cliente) === k);
  if (!ventas.length) { el.innerHTML = `<span class="text-marca">Cliente nuevo: se crea al cobrar</span>`; return; }
  const deuda = r2(ventas.reduce((a, x) => a + (x.estado !== 'Anulada' ? x.saldo : 0), 0));
  el.innerHTML = deuda > 0.009 ? `<span class="text-aviso">Ya existe · hoy debe ${money(deuda)}</span>` : 'Ya existe · no debe nada';
}
$('#cliente').addEventListener('input', debounce(infoCliente, 200));
function modoFiado(on) {
  fiado = on; montoEdit = on;
  $('#monto').value = on ? '' : (totalCart() ? String(totalCart()).replace('.', ',') : '');
  renderMetodos(); actualizarSaldo(); infoCliente(); guardarBorrador();
  if (on) $('#cliente').focus();
}
$('#metodos').addEventListener('click', e => {
  if (e.target.closest('[data-fiado]')) return modoFiado(!fiado);
  if (e.target.closest('[data-otros]')) { otrosAbierto = !otrosAbierto; return renderMetodos(); }
  const b = e.target.closest('[data-metodo]'); if (b) elegirMetodo(b.dataset.metodo);
});
$('#metodosOtros').addEventListener('click', e => { const b = e.target.closest('[data-metodo]'); if (b) elegirMetodo(b.dataset.metodo); });
function elegirMetodo(m) {
  metodoSel = m;
  if (fiado) return modoFiado(false); // elegir cómo paga = deja de ser pendiente
  renderMetodos(); guardarBorrador();
}
$('#monto').addEventListener('input', () => { montoEdit = true; actualizarSaldo(); guardarBorrador(); });
function vaciarTicket() { cart = []; cartNonce = null; montoEdit = false; fiado = false; $('#cliente').value = ''; $('#clienteInfo').textContent = ''; renderMetodos(); renderCart(); renderGrid(); }
$('#btnVaciar').addEventListener('click', () => { vaciarTicket(); $('#q').focus(); });

['#monto', '#cliente'].forEach(s => $(s).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#btnCobrar').click(); } }));
$('#btnCobrar').addEventListener('click', async () => {
  const b = $('#btnCobrar'); if (b.disabled || !cart.length) return;
  const total = totalCart();
  const monto = !fiado ? total : $('#monto').value.trim() === '' ? 0 : parseNum($('#monto').value);
  if (isNaN(monto) || monto < 0) return toast('El monto no es válido', 'err');
  if (monto > total + 0.001) return toast('El pago supera el total', 'err');
  const saldo = r2(total - monto);
  let cliente = fiado ? $('#cliente').value.trim() : '';
  if (fiado && !cliente) { $('#cliente').focus(); return toast('Elegí o escribí el nombre del cliente que queda debiendo', 'err'); }
  const previo = cliente && S.ventas.find(x => plain(x.cliente) === plain(cliente)); // si ya existe, se usa tal cual está escrito en la planilla
  if (previo) cliente = previo.cliente;
  const payload = {cliente, metodo: metodoSel, pagoMonto: monto, items: cart.map(l => ({codigo: l.codigo, cantidad: l.cantidad, precio: l.precio, nombre: l.nombre}))};
  const lineas = cart.map(l => [l.codigo, l.nombre, l.cantidad, l.precio, r2(l.cantidad * l.precio)]); // para mostrar el detalle sin pedirlo
  b.disabled = true; $('span', b).textContent = 'Guardando…';
  try {
    const o = await ejecutar('registrarVenta', payload, ridDe(cartNonce, payload), {lineas, resumen: `${cliente || 'Mostrador'} · ${money(total)}`});
    if (o.confirmada) {
      const r = o.r;
      S.productos.forEach(p => { if (r.stock[p.codigo] !== undefined) p.stock = r.stock[p.codigo]; });
      r.venta.items = lineas; S.ventas.unshift(r.venta);
      toast(`Venta #${r.id} guardada en la planilla · ${money(r.total)}${r.saldo > 0 ? ' · debe ' + money(r.saldo) : ''}`, 'ok');
      if (r.advertencia) toast(r.advertencia, 'err');
    } else toast(`Venta guardada en esta computadora · ${money(total)}. No se pudo subir ahora: se sube sola cuando haya internet.`, 'ok');
    tras(); vaciarTicket(); actualizarBadge(); $('#q').focus();
  } catch (e) { toast(e.message, 'err'); b.disabled = false; }
  finally { $('span', b).textContent = 'Cobrar'; b.disabled = !cart.length; }
});

/* =====================  STOCK  ===================== */
function renderStock() {
  const q = plain($('#qs').value.trim());
  const bajos = S.productos.filter(p => p.activo && p.stock <= p.minimo).length;
  $('#stockSub').textContent = `${S.productos.length} productos · ${bajos} con stock bajo`;
  $('#chipBajo').classList.toggle('on', soloBajo);
  const todos = S.productos.filter(p => (!soloBajo || (p.activo && p.stock <= p.minimo)) && (!q || p.k.includes(q)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const l = todos.slice(0, LIM_STOCK);
  $('#stockBody').innerHTML = l.length ? l.map(p => {
    const margen = p.precio > 0 ? Math.round((p.precio - p.costo) / p.precio * 100) : 0;
    const pill = p.stock <= 0 ? ['bg-peligro-claro text-peligro', 'Agotado'] : p.stock <= p.minimo ? ['bg-aviso-claro text-aviso', 'Bajo'] : null;
    return `<tr class="${p.activo ? '' : 'opacity-50'}">
      <td><div class="font-bold cursor-pointer rounded" tabindex="0" data-a="ed" data-c="${esc(p.codigo)}" title="Editar">${esc(p.nombre)}${p.activo ? '' : ' <span class="text-xs text-suave font-semibold">(inactivo)</span>'}${p.revisar ? ` <span class="ml-1 rounded-full px-2 py-0.5 text-xs font-bold bg-peligro-claro text-peligro" title="${esc(p.revisar)}">Revisar</span>` : ''}</div>
        <div class="text-xs text-suave"><span class="font-mono">N° ${esc(p.codigo)}</span>${p.categoria ? ' · ' + esc(p.categoria) : ''}</div></td>
      <td class="r num text-suave">${money(p.costo)}</td>
      <td class="r num font-bold">${money(p.precio)}</td>
      <td class="r num text-suave">${p.costo > 0 ? margen + '%' : '—'}</td>
      <td class="r"><span class="num font-extrabold">${num(p.stock)}</span>${pill ? ` <span class="ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${pill[0]}">${pill[1]}</span>` : ''}</td>
      <td class="r whitespace-nowrap">
        <button class="btn btn-sm" data-a="ing" data-c="${esc(p.codigo)}" title="Ingreso de mercadería">${ic('plus', 'w-3.5 h-3.5')}Ingreso</button>
        <button class="btn btn-sm btn-ico" data-a="aj" data-c="${esc(p.codigo)}" title="Ajustar por conteo" aria-label="Ajustar">${ic('sliders-horizontal', 'w-4 h-4')}</button>
        <button class="btn btn-sm btn-ico" data-a="ed" data-c="${esc(p.codigo)}" title="Editar" aria-label="Editar">${ic('pencil', 'w-4 h-4')}</button>
        <button class="btn btn-sm btn-ico btn-peligro" data-a="del" data-c="${esc(p.codigo)}" title="Eliminar producto" aria-label="Eliminar">${ic('trash-2', 'w-4 h-4')}</button>
      </td></tr>`;
  }).join('') + (todos.length > l.length ? `<tr><td colspan="6" class="text-center text-sm text-suave">Mostrando ${l.length} de ${todos.length}. Usá el buscador para encontrar el resto.</td></tr>` : '')
    : `<tr><td colspan="6"><div class="text-center text-suave py-10">${ic('package-open', 'w-9 h-9 mx-auto mb-2')}<p class="font-bold text-texto">${soloBajo ? 'Nada con stock bajo' : 'No hay productos'}</p><p class="text-sm">${soloBajo ? 'Todo está por encima del mínimo.' : 'Creá el primero con “Nuevo producto”.'}</p></div></td></tr>`;
}
$('#qs').addEventListener('input', debounce(renderStock));
$('#chipBajo').addEventListener('click', () => { soloBajo = !soloBajo; renderStock(); });
$('#stockBody').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  ({ing: () => modalIngreso(b.dataset.c), aj: () => modalAjuste(b.dataset.c), ed: () => modalProducto(b.dataset.c), del: () => modalEliminar(b.dataset.c)})[b.dataset.a]();
});
$('#btnNuevoProd').addEventListener('click', () => modalProducto());
$('#btnIngreso').addEventListener('click', () => modalIngreso());

// Tras guardar: se aplica lo que devolvió el servidor (sin recargar todo).
function aplicarProducto(r) { if (r.producto) upsertProducto(r.producto); tras(); renderVista(); }

function modalProducto(codigo) {
  const p = codigo ? S.productos.find(x => x.codigo === codigo) : null, nonce = uid();
  const d = modal({titulo: p ? `Editar producto · N° ${p.codigo}` : 'Nuevo producto', icono: p ? 'pencil' : 'package-plus', body: `
    <label class="etiqueta">Nombre</label><input name="nombre" class="campo" value="${esc(p?.nombre || '')}" required autocomplete="off">
    <label class="etiqueta">Categoría</label><input name="categoria" class="campo" list="dlCat" value="${esc(p?.categoria || '')}" autocomplete="off"><datalist id="dlCat">${[...new Set(S.productos.map(x => x.categoria).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <div class="grid grid-cols-2 gap-3"><div><label class="etiqueta">Costo</label><input name="costo" class="campo num" inputmode="decimal" value="${p?.costo ?? ''}"></div><div><label class="etiqueta">Precio de venta</label><input name="precio" class="campo num" inputmode="decimal" value="${p?.precio ?? ''}"></div></div>
    <p data-margen class="text-xs font-semibold text-suave mt-1.5 min-h-4"></p>
    <div class="grid grid-cols-2 gap-3"><div><label class="etiqueta">Stock mínimo <span class="font-medium">(avisa abajo de este número)</span></label><input name="minimo" class="campo num" inputmode="decimal" value="${p?.minimo ?? 0}"></div>
    ${p ? `<div><label class="etiqueta">Activo</label><select name="activo" class="campo"><option value="1" ${p.activo ? 'selected' : ''}>Sí</option><option value="0" ${p.activo ? '' : 'selected'}>No (no se vende)</option></select></div>` : `<div><label class="etiqueta">Stock inicial</label><input name="stock" class="campo num" inputmode="decimal" value="0"></div>`}</div>
    ${p ? `<div class="mt-3"><button type="button" data-del class="btn btn-sm btn-peligro">${ic('trash-2', 'w-3.5 h-3.5')}Eliminar este producto</button></div>` : ''}`,
    onOk: async d => {
      const precio = parseNum(v(d, 'precio')); if (isNaN(precio) || precio < 0) throw new Error('Poné un precio válido.');
      const payload = {nuevo: !p, codigo: p?.codigo, nombre: v(d, 'nombre'), categoria: v(d, 'categoria'), costo: parseNum(v(d, 'costo')) || 0, precio, minimo: parseNum(v(d, 'minimo')) || 0, ...(p ? {activo: v(d, 'activo') === '1'} : {stock: parseNum(v(d, 'stock')) || 0})};
      const r = await api('guardarProducto', payload, ridDe(nonce, payload));
      toast(p ? 'Producto guardado en la planilla' : `Producto creado en la planilla · N° ${r.producto.codigo}`, 'ok'); aplicarProducto(r);
    }});
  const margen = () => {
    const c = parseNum(v(d, 'costo')), pr = parseNum(v(d, 'precio')), el = $('[data-margen]', d);
    el.textContent = pr > 0 && c >= 0 && !isNaN(c) ? `Ganás ${money(pr - c)} por unidad (${Math.round((pr - c) / pr * 100)}% de margen)` : '';
    el.className = 'text-xs font-semibold mt-1.5 min-h-4 ' + (pr > 0 && c > pr ? 'text-peligro' : 'text-suave');
    if (pr > 0 && c > pr) el.textContent = 'Ojo: el costo es mayor al precio, vas a perder plata';
  };
  ['costo', 'precio'].forEach(n => $(`[name=${n}]`, d).addEventListener('input', margen)); margen();
  $('[data-del]', d)?.addEventListener('click', () => { d.close(); modalEliminar(codigo); });
}

function modalEliminar(codigo) {
  const p = S.productos.find(x => x.codigo === codigo); if (!p) return;
  if (!servidorNuevo()) return toast('Para eliminar productos hay que actualizar el servidor (Codigo.gs). Mientras tanto podés usar Editar → Activo: No, y deja de venderse.', 'err');
  const nonce = uid();
  modal({titulo: 'Eliminar producto', icono: 'trash-2', ok: 'Sí, eliminar', okIcono: 'trash-2', peligro: true, body: `
    <p class="text-sm">Vas a eliminar <b>${esc(p.nombre)}</b> (N° ${esc(p.codigo)})${p.stock > 0 ? `, que tiene <b>${num(p.stock)}</b> en stock` : ''}.</p>
    <p class="text-sm text-suave mt-2">Se borra de la lista y de la planilla. <b class="text-texto">Las ventas que ya hiciste no cambian</b>: siguen mostrando lo que se vendió. Si solo querés que deje de venderse, es mejor <b class="text-texto">Editar → Activo: No</b>.</p>
    <p class="text-sm font-bold text-peligro mt-2">No se puede deshacer.</p>`,
    onOk: async () => {
      const payload = {codigo};
      const r = await api('eliminarProducto', payload, ridDe(nonce, payload));
      S.productos = S.productos.filter(x => x.codigo !== codigo);
      cart = cart.filter(l => l.codigo !== codigo); if (!cart.length) { cartNonce = null; montoEdit = false; }
      indexar(); tras();
      toast(`"${r.nombre}" eliminado de la planilla`, 'ok'); if (r.advertencia) toast(r.advertencia, 'err');
      renderVista();
    }});
}

function modalIngreso(codigo) {
  const nonce = uid(), pre = codigo ? S.productos.find(x => x.codigo === codigo) : null;
  modal({titulo: 'Ingreso de stock', icono: 'package-plus', ok: 'Cargar', body: `
    <label class="etiqueta">Producto</label><input name="producto" class="campo" list="dl" value="${esc(pre?.nombre || '')}" autocomplete="off" placeholder="Empezá a escribir el nombre"><datalist id="dl">${S.productos.map(p => `<option value="${esc(p.nombre)}">`).join('')}</datalist>
    <div class="grid grid-cols-2 gap-3"><div><label class="etiqueta">Cantidad que entra</label><input name="cantidad" class="campo num" inputmode="decimal"></div><div><label class="etiqueta">Nuevo costo <span class="font-medium">(opcional)</span></label><input name="costo" class="campo num" inputmode="decimal"></div></div>
    <label class="etiqueta">Nota</label><input name="nota" class="campo" placeholder="Ej: compra a proveedor">`,
    onOk: async d => {
      const cantidad = parseNum(v(d, 'cantidad')); if (isNaN(cantidad) || cantidad <= 0) throw new Error('Poné una cantidad mayor a 0.');
      const nom = plain(v(d, 'producto').trim());
      const p = S.productos.find(x => plain(x.nombre) === nom) || S.productos.find(x => x.codigo === v(d, 'producto').trim());
      if (!p) throw new Error('No encuentro ese producto. Elegilo de la lista, o creá uno nuevo.');
      const costo = v(d, 'costo').trim() === '' ? undefined : parseNum(v(d, 'costo'));
      if (costo !== undefined && isNaN(costo)) throw new Error('El costo no es válido.');
      const payload = {codigo: p.codigo, cantidad, costo, nota: v(d, 'nota')};
      const o = await ejecutar('ingresoStock', payload, ridDe(nonce, payload), {resumen: `${p.nombre} +${num(cantidad)}`});
      if (o.confirmada) { toast(`${o.r.producto.nombre}: ahora hay ${num(o.r.producto.stock)} (guardado en la planilla)`, 'ok'); aplicarProducto(o.r); }
      else { toast(`${p.nombre}: ingreso guardado en esta computadora, se sube solo cuando haya internet`, 'ok'); tras(); renderVista(); }
    }});
}
function modalAjuste(codigo) {
  const p = S.productos.find(x => x.codigo === codigo), nonce = uid();
  modal({titulo: 'Ajustar stock', icono: 'sliders-horizontal', ok: 'Ajustar', body: `
    <p class="text-suave text-sm mb-1"><b class="text-texto">${esc(p.nombre)}</b> · en sistema hay <b class="text-texto">${num(p.stock)}</b>. Usalo para corregir por conteo real, rotura o pérdida.</p>
    <label class="etiqueta">Stock real</label><input name="n" class="campo num" inputmode="decimal" value="${p.stock}">
    <label class="etiqueta">Motivo</label><input name="nota" class="campo" placeholder="Ej: conteo físico">`,
    onOk: async d => {
      const n = parseNum(v(d, 'n')); if (isNaN(n) || n < 0) throw new Error('Poné un stock válido (0 o más).');
      const payload = {codigo, nuevoStock: n, nota: v(d, 'nota') || 'Ajuste manual'};
      const o = await ejecutar('ajusteStock', payload, ridDe(nonce, payload), {resumen: `${p.nombre} → ${num(n)}`});
      if (o.confirmada) { toast('Stock ajustado y guardado en la planilla', 'ok'); aplicarProducto(o.r); }
      else { toast('Ajuste guardado en esta computadora, se sube solo cuando haya internet', 'ok'); tras(); renderVista(); }
    }});
}

/* =====================  COBROS  ===================== */
const deudas = () => S.ventas.filter(x => x.saldo > 0.009 && x.estado !== 'Anulada').sort((a, b) => a.id - b.id);
function actualizarBadge() { const n = deudas().length; $('#nDeuda').hidden = !n; $('#nDeuda').textContent = n; }
function renderCobros() {
  const q = plain($('#qc').value.trim());
  const todas = deudas(), l = todas.filter(x => !q || plain(x.cliente).includes(q) || String(x.id) === q);
  const suma = l.reduce((a, x) => a + x.saldo, 0);
  $('#cobrosSub').textContent = todas.length ? `${l.length} ${l.length === 1 ? 'venta' : 'ventas'} · ${money(suma)} por cobrar` : 'Al día';
  $('#cobrosBody').innerHTML = l.length ? l.map(x => {
    const dias = diasDesde(x.fecha);
    return `<tr>
      <td><div class="flex items-center gap-3 cursor-pointer rounded" tabindex="0" data-pay="${x.id}"><span class="grid place-items-center w-9 h-9 rounded-full bg-marca-claro text-marca text-xs font-extrabold shrink-0">${esc(iniciales(x.cliente))}</span><b>${esc(x.cliente)}</b></div></td>
      <td><span class="font-bold">${x.pendiente ? 'Sin subir' : '#' + x.id}</span><div class="text-xs ${dias > 7 ? 'text-aviso font-bold' : 'text-suave'}">${hace(dias)}</div></td>
      <td class="r num">${money(x.total)}</td><td class="r num text-suave">${money(x.pagado)}</td>
      <td class="r num font-extrabold text-peligro">${money(x.saldo)}</td>
      <td class="r"><button class="btn btn-sm btn-marca" data-pay="${x.id}">${ic('wallet', 'w-3.5 h-3.5')}Cobrar</button></td></tr>`;
  }).join('') : `<tr><td colspan="6"><div class="text-center text-suave py-10">${ic('party-popper', 'w-9 h-9 mx-auto mb-2')}<p class="font-bold text-texto">${q ? 'Sin resultados' : 'No hay deudas pendientes'}</p><p class="text-sm">${q ? 'Probá con otro nombre o número.' : 'Todos los clientes están al día.'}</p></div></td></tr>`;
}
$('#qc').addEventListener('input', debounce(renderCobros));
$('#cobrosBody').addEventListener('click', e => { const b = e.target.closest('[data-pay]'); if (b) modalPago(Number(b.dataset.pay)); });

function modalPago(id) {
  const x = S.ventas.find(s => s.id === id), nonce = uid();
  if (!x) return;
  if (x.pendiente) return toast('Esa venta todavía no se subió a la planilla. Cuando suba (apenas haya internet) vas a poder cobrarle el saldo.', 'err');
  modal({titulo: `Cobrar venta #${id}`, icono: 'wallet', ok: 'Registrar cobro', body: `
    <p class="text-sm text-suave">${esc(x.cliente)} · total ${money(x.total)} · pagado ${money(x.pagado)}</p>
    <p class="mt-1">Debe <b class="text-peligro text-xl num">${money(x.saldo)}</b></p>
    <div class="grid grid-cols-2 gap-3"><div><label class="etiqueta">Monto</label><input name="monto" class="campo num font-bold" inputmode="decimal" value="${String(x.saldo).replace('.', ',')}"></div>
    <div><label class="etiqueta">Método</label><select name="metodo" class="campo">${S.metodos.map(m => `<option>${esc(m)}</option>`).join('')}</select></div></div>
    <label class="etiqueta">Nota</label><input name="nota" class="campo">`,
    onOk: async d => {
      const monto = parseNum(v(d, 'monto')); if (isNaN(monto) || monto <= 0) throw new Error('Poné un monto mayor a 0.');
      if (monto > x.saldo + 0.001) throw new Error('El monto supera lo que debe (' + money(x.saldo) + ').');
      const payload = {idVenta: id, monto, metodo: v(d, 'metodo'), nota: v(d, 'nota')};
      const o = await ejecutar('registrarPago', payload, ridDe(nonce, payload), {resumen: `Venta #${id} · ${x.cliente} · ${money(monto)}`});
      if (o.confirmada) {
        const r = o.r;
        Object.assign(x, {pagado: r.pagado, saldo: r.saldo, estado: r.estado});
        toast(r.saldo > 0.009 ? `Cobro guardado en la planilla · todavía debe ${money(r.saldo)}` : 'Venta saldada y guardada en la planilla', 'ok');
      } else toast('Cobro guardado en esta computadora, se sube solo cuando haya internet', 'ok');
      tras(); actualizarBadge(); renderVista();
    }});
}

/* =====================  VENTAS  ===================== */
// Resumen de lo comprado, para verlo sin abrir la venta: "2× Coca-Cola, 1× Agua +1"
const compro = x => !x.items ? '' : x.items.slice(0, 2).map(i => `${num(i[2])}× ${i[1]}`).join(', ') + (x.items.length > 2 ? ` +${x.items.length - 2}` : '');

function renderVentas() {
  const q = plain($('#qv').value.trim());
  const l = S.ventas.filter(x => !q || plain(x.cliente).includes(q) || String(x.id) === q).slice(0, LIM_VENTAS);
  $('#ventasBody').innerHTML = l.length ? l.map(x => `<tr class="fila-click" tabindex="0" data-v="${x.id}">
      <td class="font-bold">${x.pendiente ? '<span class="text-aviso text-xs">Sin subir</span>' : '#' + x.id}</td><td class="text-suave whitespace-nowrap">${fdateCorta(x.fecha)}</td><td class="whitespace-nowrap">${esc(x.cliente)}</td>
      <td class="text-suave text-sm max-w-[13rem] truncate">${x.items ? esc(compro(x)) : '<span class="text-marca font-bold">Ver detalle</span>'}</td>
      <td class="r num font-bold">${money(x.total)}</td><td class="r num ${x.saldo > 0.009 ? 'text-peligro font-bold' : 'text-suave'}">${x.saldo > 0.009 ? money(x.saldo) : '—'}</td><td>${x.pendiente ? '<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-aviso-claro text-aviso">' + ic('clock', 'w-3 h-3') + 'Sin subir</span>' : badge(x.estado)}</td>
      <td class="text-suave">${ic('chevron-right', 'w-4 h-4')}</td></tr>`).join('')
    : `<tr><td colspan="8"><div class="text-center text-suave py-10">${ic('receipt', 'w-9 h-9 mx-auto mb-2')}<p class="font-bold text-texto">${q ? 'Sin resultados' : 'Todavía no hay ventas'}</p><p class="text-sm">${q ? 'Probá con otro nombre o número.' : 'Las ventas que hagas van a aparecer acá.'}</p></div></td></tr>`;
}
$('#qv').addEventListener('input', debounce(renderVentas));
$('#ventasBody').addEventListener('click', e => { const tr = e.target.closest('tr[data-v]'); if (tr) abrirVenta(Number(tr.dataset.v)); });

// El detalle (qué se compró) aparece AL INSTANTE desde los datos ya cargados; solo la lista de pagos se pide aparte.
function abrirVenta(id) {
  const x = S.ventas.find(s => s.id === id); if (!x) return;
  const local = x.items?.length ? x.items.map(i => ({codigo: i[0], nombre: i[1], cantidad: i[2], precio: i[3], subtotal: i[4]})) : null;
  const d = modal({titulo: x.pendiente ? `Venta sin subir · ${x.cliente}` : `Venta #${id} · ${x.cliente}`, icono: 'receipt', cancel: 'Cerrar', body: '<div data-det></div>'});
  const det = $('[data-det]', d);
  const pintar = (items, pagos, error) => {
    det.innerHTML = `
      <div class="flex items-center gap-2 text-sm text-suave mb-2">${fdate(x.fecha)} ${badge(x.estado)}</div>
      <div class="rounded-xl border border-borde divide-y divide-borde/70">
        ${items ? items.map(i => `<div class="flex justify-between gap-3 px-3 py-2"><div><div class="font-bold">${esc(i.nombre)}</div><div class="text-xs text-suave num">${num(i.cantidad)} × ${money(i.precio)}</div></div><div class="font-bold num">${money(i.subtotal)}</div></div>`).join('') : `<div class="px-3 py-3 text-sm text-suave">${error ? `<span class="text-peligro font-bold">${esc(error)}</span>` : 'Cargando lo que se compró…'}</div>`}
        <div class="flex justify-between px-3 py-2 bg-hundido/60"><b>Total</b><b class="num">${money(x.total)}</b></div>
        <div class="flex justify-between px-3 py-2 text-sm"><span class="text-suave">Pagado</span><b class="num">${money(x.pagado)}</b></div>
        ${x.saldo > 0.009 ? `<div class="flex justify-between px-3 py-2 text-sm"><span class="text-suave">Debe</span><b class="num text-peligro">${money(x.saldo)}</b></div>` : ''}
      </div>
      <h4 class="font-extrabold mt-3 mb-1.5 flex items-center gap-2 text-sm">${ic('banknote', 'w-4 h-4 text-marca')}Pagos</h4>
      ${pagos ? (pagos.length ? `<div class="rounded-xl border border-borde divide-y divide-borde/70">${pagos.map(p => `<div class="flex justify-between gap-3 px-3 py-2"><div><div class="font-bold">${esc(p.metodo)}</div><div class="text-xs text-suave">${fdate(p.fecha)}${p.nota ? ' · ' + esc(p.nota) : ''}</div></div><div class="font-bold num ${p.monto < 0 ? 'text-peligro' : ''}">${money(p.monto)}</div></div>`).join('')}</div>` : '<p class="text-sm text-suave">Sin pagos registrados.</p>') : '<p class="text-sm text-suave">Cargando pagos…</p>'}
      ${x.estado !== 'Anulada' && !x.pendiente ? `<div class="flex gap-2 mt-3">${x.saldo > 0.009 ? `<button type="button" class="btn btn-marca" data-p>${ic('wallet', 'w-4 h-4')}Cobrar saldo (${money(x.saldo)})</button>` : ''}<button type="button" class="btn btn-peligro" data-an>${ic('ban', 'w-4 h-4')}Anular venta</button></div>` : ''}`;
  };
  det.addEventListener('click', e => {
    if (e.target.closest('[data-p]')) { d.close(); modalPago(id); }
    else if (e.target.closest('[data-an]')) { d.close(); modalAnular(id); }
  });
  pintar(local, null);
  if (x.pendiente) return pintar(local, []);
  api('detalleVenta', {idVenta: id})
    .then(r => pintar(local || r.items, r.pagos))
    .catch(err => pintar(local, [], local ? '' : err.message));
}

function modalAnular(id) {
  const nonce = uid();
  if (id < 0) return toast('Esa venta todavía no se subió a la planilla. Anulala cuando suba (apenas haya internet).', 'err');
  modal({titulo: `Anular venta #${id}`, icono: 'ban', ok: 'Sí, anular', okIcono: 'ban', peligro: true, body: `
    <p class="text-sm">Se <b>devuelve el stock</b> y se registra la devolución del dinero cobrado. <b class="text-peligro">No se puede deshacer.</b></p>
    <label class="etiqueta">Motivo</label><input name="nota" class="campo">`,
    onOk: async d => {
      const payload = {idVenta: id, nota: v(d, 'nota')};
      const r = await api('anularVenta', payload, ridDe(nonce, payload));
      S.productos.forEach(p => { if (r.stock[p.codigo] !== undefined) p.stock = r.stock[p.codigo]; });
      const x = S.ventas.find(s => s.id === id); if (x) Object.assign(x, {estado: 'Anulada', pagado: 0, saldo: 0});
      toast('Venta anulada y guardada en la planilla', 'ok'); if (r.advertencia) toast(r.advertencia, 'err');
      tras(); actualizarBadge(); renderVista();
    }});
}

/* =====================  RESUMEN  ===================== */
const kpi = (i, l, val, tono, sub = '') => `<div class="kpi bg-superficie border border-borde rounded-2xl p-5">
  <span class="kpi-ico grid place-items-center w-10 h-10 rounded-xl ${tono}">${ic(i, 'w-5 h-5')}</span>
  <div class="text-xs font-bold uppercase tracking-wide text-suave mt-3">${l}</div><div class="kpi-val text-2xl font-extrabold num mt-0.5">${val}</div>
  ${sub ? `<div class="text-xs text-suave mt-0.5">${sub}</div>` : ''}</div>`;
const vacioMsg = (i, t) => `<div class="text-center text-suave py-6">${ic(i, 'w-8 h-8 mx-auto mb-2')}<p class="text-sm">${t}</p></div>`;

// "Hoy" ya viene en la carga inicial (sin pedir nada). 7 días y mes se piden al entrar y se recuerdan 10 minutos.
function datosResumen() {
  if (periodoSel === 'hoy' && S.hoy && !S.hoySucio) return S.hoy;
  const c = resCache[periodoSel]; return c && Date.now() - c.ts < 600000 ? c.r : null;
}
async function cargarResumen(forzar) {
  if (!forzar && datosResumen()) return renderResumen();
  const mi = ++resSeq;
  renderResumen(); // muestra "calculando" mientras llega
  try {
    const r = await api('resumen', {periodo: periodoSel});
    if (mi !== resSeq) return;
    resCache[periodoSel] = {ts: Date.now(), r};
    if (periodoSel === 'hoy') { S.hoy = r; S.hoySucio = false; guardarCache(); }
  } catch (e) { if (mi === resSeq) toast(e.message, 'err'); }
  if (mi === resSeq) renderResumen();
}
$('#periodos').addEventListener('click', e => {
  const b = e.target.closest('[data-p]'); if (!b) return;
  periodoSel = b.dataset.p; $$('#periodos .chip').forEach(x => x.classList.toggle('on', x === b)); cargarResumen();
});

function renderResumen() {
  const r = datosResumen();
  const cargando = `<div class="col-span-full text-center text-suave py-6">Calculando…</div>`;
  $('#kpis').innerHTML = r ? [
    kpi('shopping-bag', 'Ventas', money(r.ventas), 'bg-marca-claro text-marca', `${r.cantidad} ${r.cantidad === 1 ? 'venta' : 'ventas'}`),
    kpi('banknote', 'Cobrado (neto)', money(r.cobrado), 'bg-ok-claro text-ok', 'Incluye cobros de deudas viejas'),
    kpi('trending-up', 'Ganancia estimada', money(r.ganancia), 'bg-ok-claro text-ok', 'Precio menos costo de cada producto'),
    kpi('receipt', 'Ticket promedio', money(r.ticket), 'bg-hundido text-suave')
  ].join('') : cargando;

  const pend = deudas(), porCobrar = pend.reduce((a, x) => a + x.saldo, 0);
  const valor = S.productos.reduce((a, p) => a + p.costo * p.stock, 0);
  const bajo = S.productos.filter(p => p.activo && p.stock <= p.minimo).sort((a, b) => a.stock - b.stock);
  $('#kpis2').innerHTML = [
    kpi('wallet', 'Por cobrar (total)', money(porCobrar), 'bg-peligro-claro text-peligro', `${pend.length} ${pend.length === 1 ? 'venta' : 'ventas'} con saldo`),
    kpi('boxes', 'Valor del stock (costo)', money(valor), 'bg-hundido text-suave'),
    kpi('triangle-alert', 'Productos con stock bajo', bajo.length, 'bg-aviso-claro text-aviso')
  ].join('');

  const pm = Object.entries(r?.porMetodo || {}).sort((a, b) => b[1] - a[1]), max = Math.max(1, ...pm.map(x => Math.abs(x[1])));
  $('#caja').innerHTML = !r ? cargando : pm.length ? pm.map(([m, t]) => `<div>
      <div class="flex justify-between text-sm mb-1.5"><b>${esc(m)}</b><b class="num">${money(t)}</b></div>
      <div class="h-2 rounded-full bg-hundido overflow-hidden"><div class="h-full rounded-full bg-marca" style="width:${Math.max(0, t) / max * 100}%"></div></div></div>`).join('')
    : vacioMsg('banknote', 'No se cobró nada en este período.');

  $('#top').innerHTML = !r ? cargando : r.top.length ? r.top.map((t, i) => `<div class="flex items-center gap-3 py-2 border-b border-borde/70 last:border-0">
      <span class="grid place-items-center w-7 h-7 rounded-lg bg-hundido text-suave text-xs font-extrabold">${i + 1}</span>
      <span class="font-bold truncate flex-1">${esc(t.nombre)}</span>
      <span class="text-sm text-suave whitespace-nowrap">${num(t.cantidad)} u.</span><b class="num w-28 text-right">${money(t.total)}</b></div>`).join('')
    : vacioMsg('shopping-bag', 'Todavía no hay ventas en este período.');

  $('#bajo').innerHTML = bajo.length ? bajo.map(p => `<div class="flex items-center justify-between gap-3 py-2 border-b border-borde/70 last:border-0">
      <span class="font-bold truncate">${esc(p.nombre)}</span>
      <span class="text-sm whitespace-nowrap"><b class="num ${p.stock <= 0 ? 'text-peligro' : 'text-aviso'}">${num(p.stock)}</b> <span class="text-suave">de ${num(p.minimo)} mín.</span></span></div>`).join('')
    : vacioMsg('circle-check', 'Todo el stock está por encima del mínimo.');
}

/* =====================  AVISOS DE DATOS  ===================== */
function renderAvisos() {
  const n = S.avisos?.length || 0, b = $('#avisos');
  b.hidden = !n;
  if (n) b.innerHTML = `${ic('triangle-alert', 'w-4 h-4 shrink-0')}<span>${n} ${n === 1 ? 'dato' : 'datos'} para revisar en la planilla</span><span class="ml-auto underline">Ver</span>`;
}
$('#avisos').addEventListener('click', () => modal({titulo: 'Datos para revisar', icono: 'triangle-alert', cancel: 'Cerrar', body: `
  <p class="text-sm text-suave mb-3">Esto se ve cuando alguien edita la planilla a mano. Corregilo ahí mismo (hoja Productos) y tocá ↻ para actualizar.</p>
  <ul class="flex flex-col gap-2">${(S.avisos || []).map(a => `<li class="rounded-lg bg-aviso-claro text-aviso text-sm font-semibold px-3 py-2">${esc(a)}</li>`).join('')}</ul>`}));

/* =====================  GENERAL  ===================== */
function renderAll() {
  $('#negocio').textContent = S.negocio || 'Stock Lite'; document.title = S.negocio || 'Stock Lite';
  renderAvisos(); actualizarBadge();
  restaurarBorrador();
  renderVista();
}

$('#btnSync').addEventListener('click', () => { resCache = {}; sync(); });

// Equipo sin link todavía (solo pasa si se abrió la app sin el link de instalación): se pide una única vez.
function pedirLink() {
  modal({titulo: 'Conectar con la planilla', icono: 'link', ok: 'Conectar', okIcono: 'plug-zap', cancel: '', forzado: true, body: `
    <p class="text-sm text-suave">Este equipo todavía no está vinculado. Pegá el link de la aplicación web (termina en <b>/exec</b>) o usá el link de instalación que te pasó Escencial.</p>
    <label class="etiqueta">Link</label><input name="url" class="campo" placeholder="https://script.google.com/macros/s/.../exec" autocomplete="off">`,
    onOk: async d => {
      const u = aUrl(v(d, 'url'));
      if (!URL_OK.test(u)) throw new Error('El link debe empezar con https://script.google.com/macros/s/ y terminar en /exec');
      CFG.url = u;
      try { await api('cargar'); } catch (e) { CFG.url = ''; throw e; }
      try { localStorage.setItem('stocklite_url', u); } catch (e) {}
      location.reload();
    }});
}

// Arranque: se muestra al instante lo último que se vio (si hay) y se actualiza por detrás.
$('#ver').textContent = 'Versión ' + APP_VERSION;
if (cargarCache()) $('#syncTxt').textContent = 'Datos de ' + horaCorta(S.ts) + ' · actualizando…';
renderAll();
colaLista.then(() => { reaplicarFaltantes(); actualizarAvisoCola(); renderVista(); }); // lo guardado sin internet reaparece al abrir
if (CFG.url) sync(true); else pedirLink();
