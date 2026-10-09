/**
 * STOCK LITE — Stock + Ventas + Cobros sobre Google Sheets
 * -------------------------------------------------------
 * Script VINCULADO a la planilla (Extensiones > Apps Script).
 * 1) Ejecutá configurarSistema()  -> arma hojas, formatos, protecciones.
 * 2) Implementar > Nueva implementación > Aplicación web
 *    (Ejecutar como: Yo / Quién tiene acceso: Cualquier usuario).
 * 3) La URL va en js/config.js. No hay clave: el link de la app web es el acceso.
 * 4) Recomendado: menú 🧾 Stock Lite > Activar respaldo diario.
 *
 * Reglas de diseño (para que no se rompa ni se enlentezca):
 *  - Toda escritura pasa por LockService: nunca se pisan dos operaciones.
 *  - Stock, totales y costos los calcula SIEMPRE el servidor, no el HTML.
 *  - Cada operación lleva un "rid": si el HTML reintenta, no se duplica (se devuelve el resultado anterior).
 *  - Los IDs (productos, ventas, pagos) son autonumeración 1,2,3… con contador propio: nunca se reutilizan.
 *  - Se lee solo lo necesario (últimas filas / columnas sueltas), no las hojas enteras: sigue rápido con años de datos.
 *  - Si la venta ya quedó registrada y falla un paso posterior, se devuelve ÉXITO + advertencia (nunca un error
 *    que invite a reintentar y duplicar).
 */

const COLS = {
  Productos:   ['ID', 'Nombre', 'Categoría', 'Costo', 'Precio', 'Stock', 'Stock mínimo', 'Activo'],
  Ventas:      ['ID', 'Fecha', 'Cliente', 'Total', 'Pagado', 'Saldo', 'Estado', 'Método'],
  Detalle:     ['ID Venta', 'ID Producto', 'Producto', 'Cantidad', 'Precio', 'Subtotal', 'Costo'],
  Pagos:       ['ID Pago', 'Fecha', 'ID Venta', 'Cliente', 'Monto', 'Método', 'Nota'],
  Movimientos: ['Fecha', 'ID Producto', 'Producto', 'Tipo', 'Cantidad', 'Stock final', 'Nota']
};
// Se sube cuando cambia algo que el HTML necesita (la app avisa si el servidor del cliente quedó atrás).
const VERSION_SERVIDOR = 7;
const MONEDA = '$ #,##0.00', FECHA = 'dd/mm/yyyy hh:mm';
// [columna inicial, cantidad de columnas, formato]
const FORMATOS = {
  Productos:   [[1, 1, '0'], [4, 2, MONEDA]],
  Ventas:      [[2, 1, FECHA], [4, 3, MONEDA]],
  Detalle:     [[2, 1, '0'], [5, 3, MONEDA]],
  Pagos:       [[2, 1, FECHA], [5, 1, MONEDA]],
  Movimientos: [[1, 1, FECHA], [2, 1, '0']]
};
const MAX_FILAS = 10000;          // filas formateadas de entrada; después se extienden solas
const VENTAS_RECIENTES = 200;     // cuántas ventas viaja siempre al HTML (además de las que tienen saldo)
const METODOS_DEFAULT = 'Efectivo, Transferencia, Débito, Crédito, Mercado Pago';

/* ============================ MENÚ ============================ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🧾 Stock Lite')
    .addItem('Configurar / reparar sistema', 'configurarSistema')
    .addItem('Revisar datos', 'revisarDatosMenu')
    .addItem('Activar respaldo diario', 'activarRespaldoDiario')
    .addItem('Clave de acceso (ver / crear)', 'claveAccesoMenu')
    .addSeparator()
    .addItem('Mudar la app a otro link…', 'configurarRedireccion')
    .addItem('Quitar la mudanza', 'quitarRedireccion')
    .addToUi();
}

/* ====================== MAQUETADO (SETUP) ====================== */

function configurarSistema() {
  const ss = ss_();
  const props = PropertiesService.getScriptProperties();

  // Hojas de datos: se crean si faltan; si existen solo se reescribe el encabezado (no se tocan datos).
  Object.keys(COLS).forEach(function (nombre) {
    const h = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    const c = COLS[nombre];
    h.getRange(1, 1, 1, c.length).setValues([c])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f2937').setHorizontalAlignment('center');
    h.setFrozenRows(1);
    aplicarFormatos_(h, 2, MAX_FILAS);
    props.setProperty('FMT_' + nombre, String(MAX_FILAS + 1));
  });

  const hp = ss.getSheetByName('Productos'), hv = ss.getSheetByName('Ventas');

  // Validación: Activo = Sí / No
  hp.getRange(2, 8, MAX_FILAS, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Sí', 'No'], true).setAllowInvalid(false).build());

  // Colores condicionales
  hp.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($A2<>"",$F2<=$G2)').setBackground('#fee2e2')
      .setRanges([hp.getRange(2, 1, MAX_FILAS, 8)]).build()
  ]);
  const estados = [['Pagada', '#dcfce7'], ['Parcial', '#fef3c7'], ['Pendiente', '#fee2e2'], ['Anulada', '#e5e7eb']];
  hv.setConditionalFormatRules(estados.map(function (e) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(e[0]).setBackground(e[1])
      .setRanges([hv.getRange(2, 7, MAX_FILAS, 1)]).build();
  }));

  // Anchos
  const anchos = {
    Productos: [70, 260, 140, 100, 100, 80, 110, 70],
    Ventas: [70, 140, 200, 110, 110, 110, 100, 130],
    Detalle: [80, 100, 260, 90, 100, 110, 100],
    Pagos: [80, 140, 80, 200, 110, 130, 240],
    Movimientos: [140, 100, 260, 110, 90, 100, 240]
  };
  Object.keys(anchos).forEach(function (n) {
    anchos[n].forEach(function (w, i) { ss.getSheetByName(n).setColumnWidth(i + 1, w); });
  });

  // Config (clave/valor, editable por el dueño)
  const hc = ss.getSheetByName('Config') || ss.insertSheet('Config');
  if (hc.getLastRow() < 1) {
    hc.getRange(1, 1, 3, 2).setValues([
      ['Parámetro', 'Valor'],
      ['Negocio', 'Mi Negocio'],
      ['Métodos de pago', METODOS_DEFAULT]
    ]);
  }
  hc.getRange(1, 1, 1, 2).setFontWeight('bold').setFontColor('#fff').setBackground('#1f2937');
  hc.setColumnWidth(1, 160); hc.setColumnWidth(2, 460);

  // Resumen con fórmulas (se ve también directo en la planilla). Rangos abiertos: no tienen tope de filas.
  const hr = ss.getSheetByName('Resumen') || ss.insertSheet('Resumen');
  hr.clear();
  hr.getRange(1, 1, 6, 2).setValues([
    ['Indicador', 'Valor'],
    ['Ventas de hoy', '=SUMIFS(Ventas!D2:D,Ventas!B2:B,">="&TODAY(),Ventas!B2:B,"<"&TODAY()+1,Ventas!G2:G,"<>Anulada")'],
    ['Cobrado hoy (neto)', '=SUMIFS(Pagos!E2:E,Pagos!B2:B,">="&TODAY(),Pagos!B2:B,"<"&TODAY()+1)'],
    ['Por cobrar (total)', '=SUMIFS(Ventas!F2:F,Ventas!G2:G,"<>Anulada")'],
    ['Valor del stock (a costo)', '=SUMPRODUCT(Productos!D2:D,Productos!F2:F)'],
    ['Productos bajo el mínimo', '=SUMPRODUCT((Productos!A2:A<>"")*(Productos!F2:F<=Productos!G2:G))']
  ]);
  hr.getRange(1, 1, 1, 2).setFontWeight('bold').setFontColor('#fff').setBackground('#1f2937');
  hr.getRange(2, 2, 4, 1).setNumberFormat(MONEDA);
  hr.getRange(6, 2).setNumberFormat('0');
  hr.setColumnWidth(1, 220); hr.setColumnWidth(2, 160);

  // Protecciones: las hojas de registro avisan si alguien edita a mano (solo advertencia, no bloquea).
  Object.keys(COLS).concat(['Config', 'Resumen']).forEach(function (n) {
    const h = ss.getSheetByName(n);
    h.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) { p.remove(); });
    h.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) { p.remove(); });
    if (n === 'Productos' || n === 'Config') {
      h.getRange(1, 1, 1, h.getLastColumn() || 2).protect().setWarningOnly(true);
    } else {
      h.protect().setWarningOnly(true).setDescription('Registro automático: se escribe desde el sistema');
    }
  });

  // Orden de pestañas + borrar la hoja vacía por defecto
  ['Productos', 'Ventas', 'Pagos', 'Detalle', 'Movimientos', 'Resumen', 'Config'].forEach(function (n, i) {
    ss.setActiveSheet(ss.getSheetByName(n));
    ss.moveActiveSheet(i + 1);
  });
  ['Hoja 1', 'Sheet1', 'Hoja1'].forEach(function (n) {
    const h = ss.getSheetByName(n);
    if (h && h.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(h);
  });
  ss.setActiveSheet(ss.getSheetByName('Productos'));

  avisar_('Sistema listo ✅\n\nHojas, formatos y protecciones armados.\n' +
    'Los productos se numeran solos (1, 2, 3…).\n\n' +
    'Si cambiaste el código: Implementar > Administrar implementaciones > Nueva versión.\n' +
    'Recomendado: menú 🧾 Stock Lite > Activar respaldo diario.');
}

function aplicarFormatos_(h, desde, cant) {
  if (h.getMaxRows() < desde + cant) h.insertRowsAfter(h.getMaxRows(), desde + cant - h.getMaxRows());
  (FORMATOS[h.getName()] || []).forEach(function (f) { h.getRange(desde, f[0], cant, f[1]).setNumberFormat(f[2]); });
}

// Los formatos se pre-aplican a MAX_FILAS filas; cuando la hoja se acerca al final se extienden solos.
function asegurarFormato_(h, ultimaFila) {
  if (ultimaFila + 300 < MAX_FILAS) return; // camino rápido: ni se consulta nada
  const props = PropertiesService.getScriptProperties(), k = 'FMT_' + h.getName();
  const hasta = Number(props.getProperty(k)) || (MAX_FILAS + 1);
  if (ultimaFila + 300 > hasta) {
    aplicarFormatos_(h, hasta + 1, MAX_FILAS);
    props.setProperty(k, String(hasta + MAX_FILAS));
  }
}

/* ===================== RESPALDO Y REVISIÓN ===================== */

function activarRespaldoDiario() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'respaldar_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('respaldar_').timeBased().everyDays(1).atHour(3).create();
  respaldar_();
  avisar_('Respaldo diario activado ✅\n\nTodas las noches (~3 AM) se guarda una copia completa de esta planilla ' +
    'en tu Drive, carpeta "Respaldos - ' + ss_().getName() + '". Se conservan las últimas 30.\n' +
    'Ya se hizo la primera copia ahora.');
}

function respaldar_() {
  const ss = ss_();
  const nombreCarpeta = 'Respaldos - ' + ss.getName();
  const it = DriveApp.getFoldersByName(nombreCarpeta);
  const carpeta = it.hasNext() ? it.next() : DriveApp.createFolder(nombreCarpeta);
  const nombre = ss.getName() + ' — ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  if (!carpeta.getFilesByName(nombre).hasNext()) DriveApp.getFileById(ss.getId()).makeCopy(nombre, carpeta);
  const archivos = [], fi = carpeta.getFiles();
  while (fi.hasNext()) archivos.push(fi.next());
  archivos.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  archivos.slice(30).forEach(function (f) { f.setTrashed(true); });
}

// SOLO PARA ENTREGAR UN SISTEMA NUEVO: borra TODOS los datos de prueba y reinicia la numeración en 1.
// No está en el menú a propósito (para que nadie la toque por error): se ejecuta a mano desde el editor de Apps Script
// (selector de funciones > reiniciarParaEntrega > Ejecutar). Pide doble confirmación. Conserva formatos y Config.
function reiniciarParaEntrega() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('⚠️ Borrar TODOS los datos', 'Se borran productos, ventas, pagos, detalle y movimientos, y la numeración vuelve a 1.\n\nNO se puede deshacer. ¿Seguro?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const t = ui.prompt('Confirmación final', 'Escribí BORRAR (en mayúsculas) para confirmar:', ui.ButtonSet.OK_CANCEL);
  if (t.getSelectedButton() !== ui.Button.OK || t.getResponseText().trim() !== 'BORRAR') { avisar_('Cancelado. No se borró nada.'); return; }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    ['Productos', 'Ventas', 'Detalle', 'Pagos', 'Movimientos'].forEach(function (n) {
      const h = hoja_(n), f = h.getLastRow();
      if (f > 1) h.getRange(2, 1, f - 1, h.getLastColumn()).clearContent();
    });
    const props = PropertiesService.getScriptProperties();
    ['SEQ_PROD', 'SEQ_VENTA', 'SEQ_PAGO'].forEach(function (k) { props.deleteProperty(k); });
  } finally { lock.releaseLock(); }
  avisar_('Listo: todo en cero ✅\n\nAhora poné el nombre del negocio en la hoja Config (celda B2).');
}

// MUDANZA: si algún día este servidor se reemplaza por otro (otro link /exec), acá se carga el link NUEVO.
// Las computadoras que sigan usando este link se pasan solas al nuevo la próxima vez que abran la app: nadie toca esas compus.
// Importante: no borrar este servidor viejo (la implementación) mientras haya compus apuntando a él.
function configurarRedireccion() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Mudar la app a otro link', 'Pegá el link NUEVO de la aplicación web (https://script.google.com/macros/s/.../exec).\nTodas las computadoras que usan este link se van a pasar solas al nuevo.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  let u = r.getResponseText().trim();
  if (u && u.indexOf('http') !== 0) u = 'https://script.google.com/macros/s/' + u + '/exec';
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u)) { avisar_('Ese link no es válido. Tiene que empezar con https://script.google.com/macros/s/ y terminar en /exec'); return; }
  PropertiesService.getScriptProperties().setProperty('REDIRECT_URL', u);
  avisar_('Listo ✅\n\nLas computadoras que usan ESTE link se van a pasar solas al nuevo la próxima vez que abran la app.\nNo borres esta implementación todavía.');
}
function quitarRedireccion() {
  PropertiesService.getScriptProperties().deleteProperty('REDIRECT_URL');
  avisar_('Mudanza quitada. Este link vuelve a funcionar como siempre.');
}

// CLAVE DE ACCESO: el link de la app web no alcanza para usar la planilla; hace falta también esta clave (que cada computadora
// guarda una vez y nunca cambia). Así el link puede estar escrito en el código público de la app sin que nadie pueda usarlo.
// Si todavía no se creó una clave, la planilla funciona como antes (sin clave).
function verificarClave_(req) {
  const clave = PropertiesService.getScriptProperties().getProperty('CLAVE_ACCESO');
  if (clave && String(req.k || '') !== clave) throw new Error('No autorizado: falta la clave de acceso. Abrí el link de instalación de este equipo.');
}
function claveAccesoMenu() {
  const props = PropertiesService.getScriptProperties();
  let clave = props.getProperty('CLAVE_ACCESO');
  const nueva = !clave;
  if (nueva) {
    clave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32);
    props.setProperty('CLAVE_ACCESO', clave);
  }
  avisar_((nueva ? 'Clave creada ✅' : 'Clave de acceso actual') + '\n\n' + clave + '\n\n' +
    'Se carga UNA sola vez en cada computadora (agregando &k=' + clave + ' al link de instalación) y no cambia aunque cambie el link de la app web.\n' +
    (nueva ? 'IMPORTANTE: desde ahora, las computadoras que no tengan la clave dejan de poder usar la planilla hasta abrir el link de instalación con la clave.' : 'Guardala en un lugar seguro.'));
}

function revisarDatosMenu() {
  const av = revisarDatos_(leerProductos_());
  avisar_(av.length ? 'Hay ' + av.length + ' cosas para revisar:\n\n• ' + av.join('\n• ') : 'Todo en orden ✅');
}

// Chequeos de integridad que se muestran en el sistema como aviso (para detectar a tiempo ediciones a mano).
function revisarDatos_(prods) {
  const av = [], ids = {}, nombres = {};
  prods.forEach(function (p) {
    const o = p.obj, k = clave_(o.nombre);
    if (ids[o.codigo]) av.push('ID repetido: ' + o.codigo + ' (filas ' + ids[o.codigo] + ' y ' + p.fila + ')'); else ids[o.codigo] = p.fila;
    if (!k) av.push('Fila ' + p.fila + ': el producto ' + o.codigo + ' no tiene nombre');
    else if (nombres[k]) av.push('Nombre repetido: "' + o.nombre + '" (filas ' + nombres[k] + ' y ' + p.fila + ')'); else nombres[k] = p.fila;
    if (o.revisar) av.push('"' + (o.nombre || 'ID ' + o.codigo) + '" (fila ' + p.fila + '): ' + o.revisar);
    if (o.stock < 0) av.push('"' + o.nombre + '" tiene stock negativo (' + o.stock + ')');
  });
  return av.slice(0, 30);
}

/* ========================= WEB APP ========================= */

function doGet() {
  return json_({ ok: true, msg: 'Stock Lite activo', version: VERSION_SERVIDOR });
}

function doPost(e) {
  let res;
  try {
    const req = JSON.parse(e.postData.contents);
    verificarClave_(req);
    res = despachar_(req);
  } catch (err) {
    res = { ok: false, error: err.message || String(err) };
  }
  return json_(res);
}

function despachar_(req) {
  const lecturas = { cargar: cargar_, detalleVenta: detalleVenta_, resumen: resumen_, historial: historial_ };
  const escrituras = {
    guardarProducto: guardarProducto_, ingresoStock: ingresoStock_, ajusteStock: ajusteStock_,
    registrarVenta: registrarVenta_, registrarPago: registrarPago_, anularVenta: anularVenta_, eliminarProducto: eliminarProducto_
  };
  if (req.action === 'lote') return lote_(req);
  if (lecturas[req.action]) { const o = lecturas[req.action](req); o.ok = true; return o; }
  if (escrituras[req.action]) return escribir_(escrituras[req.action], req);
  throw new Error('Acción desconocida: ' + req.action);
}

function escribir_(fn, req) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('El sistema está ocupado, probá de nuevo en unos segundos.');
  try {
    const out = ejecutarEscritura_(fn, req);
    SpreadsheetApp.flush();
    return out;
  } finally {
    lock.releaseLock();
  }
}

// Ejecuta UNA escritura (el candado ya está tomado). Cada operación lleva un "rid": si llega de nuevo (reintento por un corte,
// aunque sea días después) NO se repite: se devuelve lo que ya se había hecho. Se recuerda en caché (rápido) y en la hoja
// oculta "Operaciones" (permanente: la caché se olvida a las 6 horas, y una venta guardada sin internet puede reintentarse días después).
function ejecutarEscritura_(fn, req) {
  const cache = CacheService.getScriptCache();
  if (req.rid) {
    const previo = cache.get('rid_' + req.rid);
    if (previo) return JSON.parse(previo);
    const dur = opPrevia_(req.rid);
    if (dur) { cache.put('rid_' + req.rid, JSON.stringify(dur), 21600); return dur; }
  }
  const out = fn(req);
  out.ok = true;
  if (req.rid) {
    cache.put('rid_' + req.rid, JSON.stringify(out), 21600);
    try { opGuardar_(req.rid, req.action, out); } catch (e) { /* la operación ya se hizo: nunca devolver error por esto */ }
  }
  return out;
}

const OPS_REVISAR = 3000; // cuántas operaciones recientes se miran para detectar un reintento
function opsHoja_() {
  const ss = ss_();
  let h = ss.getSheetByName('Operaciones');
  if (!h) {
    h = ss.insertSheet('Operaciones');
    h.getRange(1, 1, 1, 4).setValues([['RID', 'Fecha', 'Acción', 'Resultado']]);
    h.getRange(1, 1, 20000, 1).setNumberFormat('@'); // texto: que un rid como "1e5" no se convierta en número
    h.setFrozenRows(1);
    h.hideSheet();
  }
  return h;
}
function opPrevia_(rid) {
  const h = ss_().getSheetByName('Operaciones');
  if (!h) return null;
  const n = h.getLastRow() - 1;
  if (n < 1) return null;
  const cant = Math.min(n, OPS_REVISAR), ini = n - cant + 2;
  const rids = h.getRange(ini, 1, cant, 1).getValues();
  for (let i = rids.length - 1; i >= 0; i--) {
    if (String(rids[i][0]) === rid) {
      try { return JSON.parse(String(h.getRange(ini + i, 4).getValue())); } catch (e) { return { ok: true, repetida: true }; }
    }
  }
  return null;
}
function opGuardar_(rid, accion, out) {
  const h = opsHoja_();
  h.getRange(h.getLastRow() + 1, 1, 1, 4).setValues([[String(rid), new Date(), accion, JSON.stringify(out).slice(0, 40000)]]);
}

// Fecha de una operación guardada sin internet: la hora REAL en que se hizo (no la de cuando se subió).
// Solo se acepta si es razonable (hasta 60 días atrás, y no del futuro): si el reloj de la compu estaba mal, se usa la hora actual.
function tsOp_(req) {
  const t = Number(req.ts), ahora = Date.now();
  return (t && t > ahora - 60 * 864e5 && t < ahora + 36e5) ? new Date(t) : new Date();
}

// Varias operaciones guardadas sin internet, de una sola vez (un solo pedido, un solo candado). Cada una es independiente:
// si una falla, las demás igual se procesan y se informa cuál falló. Solo las operaciones que pueden hacerse sin conexión.
function lote_(req) {
  const ops = req.ops;
  if (!Array.isArray(ops) || !ops.length) throw new Error('Lote vacío.');
  if (ops.length > 25) throw new Error('Lote demasiado grande (máximo 25).');
  const permitidas = { registrarVenta: registrarVenta_, registrarPago: registrarPago_, ingresoStock: ingresoStock_, ajusteStock: ajusteStock_ };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(40000)) throw new Error('El sistema está ocupado, probá de nuevo en unos segundos.');
  const results = [];
  try {
    ops.forEach(function (op) {
      try {
        const fn = permitidas[op.action];
        if (!fn) throw new Error('Acción no permitida en lote: ' + op.action);
        if (!op.rid) throw new Error('Falta el identificador de la operación.');
        op.offline = true;
        results.push({ rid: op.rid, ok: true, r: ejecutarEscritura_(fn, op) });
      } catch (e) {
        results.push({ rid: op && op.rid, ok: false, error: e.message || String(e) });
      }
    });
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return { ok: true, results: results };
}

/* ========================= LECTURAS ========================= */

function cargar_() {
  // Se toma el mismo candado que las escrituras: así nunca se lee a mitad de una venta (datos a medias).
  const lock = LockService.getScriptLock();
  const tiene = lock.tryLock(8000);
  try { return cargarInterno_(tiene); } finally { if (tiene) lock.releaseLock(); }
}

function cargarInterno_(puedeEscribir) {
  const tz = ss_().getSpreadsheetTimeZone();
  const hoyMs = inicioPeriodo_(tz, 'hoy');

  if (puedeEscribir) asignarIdsFaltantes_(); // permite cargar productos pegándolos directo en la planilla
  const prods = leerProductos_();

  // ---- Ventas: columnas sueltas + ventana reciente (no la hoja entera) ----
  const hv = hoja_('Ventas'), nV = hv.getLastRow() - 1;
  let porCobrar = 0, ventas = [], hoy = resumenDe_([], [], [], hoyMs);
  if (nV > 0) {
    const sg = hv.getRange(2, 6, nV, 2).getValues();            // Saldo, Estado (todas las filas, 2 columnas)
    const pend = [];
    sg.forEach(function (r, i) {
      if (String(r[1]) === 'Anulada') return;
      const s = Number(r[0]) || 0;
      porCobrar += s;
      if (s > 0.009) pend.push(i);
    });
    const v = leerDesde_(hv, 8, hoyMs, VENTAS_RECIENTES);        // hoy + últimas 200
    const filas = v.filas.map(function (r, k) { return [v.ini + k, r]; });
    const viejas = filasPorIndice_(hv, pend.filter(function (i) { return i < v.ini; }), 8); // deudas antiguas
    Object.keys(viejas).forEach(function (i) { filas.push([Number(i), viejas[i]]); });

    // Ítems de las ventas de la ventana: UN solo bloque de la hoja Detalle (así el detalle se ve al instante, sin pedir nada)
    let minId = Infinity;
    v.filas.forEach(function (r) { const id = Number(r[0]); if (r[0] !== '' && id < minId) minId = id; });
    const det = detalleDesdeId_(minId);
    const items = {};
    det.forEach(function (r) {
      const id = Number(r[0]);
      if (!items[id]) items[id] = [];
      items[id].push([String(r[1]), String(r[2]), Number(r[3]) || 0, Number(r[4]) || 0, Number(r[5]) || 0]);
    });

    ventas = filas.filter(function (x) { return x[1][0] !== ''; }).map(function (x) {
      const r = x[1], id = Number(r[0]);
      const o = {
        id: id, fecha: fecha_(r[1], tz), cliente: String(r[2]), total: Number(r[3]) || 0,
        pagado: Number(r[4]) || 0, saldo: Number(r[5]) || 0, estado: String(r[6]), metodo: String(r[7])
      };
      if (items[id]) o.items = items[id];
      return o;
    }).sort(function (a, b) { return b.id - a.id; });

    // Resumen de HOY con lo que ya se leyó (más los pagos de hoy): la pantalla "Resumen" abre sin pedir nada más
    const pagosHoy = leerDesde_(hoja_('Pagos'), 7, hoyMs, 0).filas;
    hoy = resumenDe_(v.filas, pagosHoy, det, hoyMs);
  }

  return {
    productos: prods.map(function (p) { return p.obj; }),
    ventas: ventas,
    hoy: hoy,
    avisos: revisarDatos_(prods),
    metodos: cfg_('Métodos de pago', METODOS_DEFAULT).split(',').map(function (s) { return s.trim(); }).filter(String),
    negocio: cfg_('Negocio', 'Mi Negocio'),
    porCobrar: r2_(porCobrar),
    version: VERSION_SERVIDOR,
    redirect: PropertiesService.getScriptProperties().getProperty('REDIRECT_URL') || '',
    hora: fecha_(new Date(), tz)
  };
}

function detalleVenta_(req) {
  const id = Number(req.idVenta), tz = ss_().getSpreadsheetTimeZone();
  const items = bloqueDetalle_(id).map(function (r) {
    return { codigo: String(r[1]), nombre: String(r[2]), cantidad: Number(r[3]), precio: Number(r[4]), subtotal: Number(r[5]) };
  });
  const pagos = pagosDeVenta_(id).map(function (r) {
    return { fecha: fecha_(r[1], tz), monto: Number(r[4]), metodo: String(r[5]), nota: String(r[6]) };
  });
  return { items: items, pagos: pagos };
}

// Cálculo del resumen a partir de filas ya leídas (lo usan "cargar" para HOY y "resumen" para 7 días / mes).
function resumenDe_(filasVentas, filasPagos, filasDetalle, desde, hasta) {
  const tope = hasta || Infinity; // sin tope: hasta hoy
  const enPeriodo = function (r) { return r[0] !== '' && r[1] instanceof Date && r[1].getTime() >= desde && r[1].getTime() < tope; };
  let total = 0, cantidad = 0;
  const validas = {};
  filasVentas.filter(enPeriodo).forEach(function (r) {
    if (String(r[6]) === 'Anulada') return;
    total += Number(r[3]) || 0; cantidad++; validas[Number(r[0])] = true;
  });
  let cobrado = 0;
  const porMetodo = {};
  filasPagos.filter(enPeriodo).forEach(function (r) {
    const m = Number(r[4]) || 0, k = String(r[5]) || 'Otro';
    cobrado += m; porMetodo[k] = r2_((porMetodo[k] || 0) + m);
  });
  let ganancia = 0;
  const top = {};
  filasDetalle.forEach(function (r) {
    if (!validas[Number(r[0])]) return;
    const c = Number(r[3]) || 0, sub = Number(r[5]) || 0, costo = Number(r[6]) || 0, nom = String(r[2]);
    ganancia += sub - costo * c;
    const t = top[nom] || (top[nom] = { nombre: nom, cantidad: 0, total: 0 });
    t.cantidad = r3_(t.cantidad + c); t.total = r2_(t.total + sub);
  });
  return {
    ventas: r2_(total), cantidad: cantidad, ticket: cantidad ? r2_(total / cantidad) : 0,
    cobrado: r2_(cobrado), porMetodo: porMetodo, ganancia: r2_(ganancia),
    top: Object.keys(top).map(function (k) { return top[k]; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 8)
  };
}

// Resumen por período (hoy | semana | mes), o de un mes puntual (req.mes = 'AAAA-MM'), leyendo solo lo necesario.
function resumen_(req) {
  const tz = ss_().getSpreadsheetTimeZone();
  let desde, hasta = 0, periodo;
  if (/^\d{4}-\d{2}$/.test(String(req.mes || ''))) {
    const a = Number(req.mes.slice(0, 4)), m = Number(req.mes.slice(5, 7));
    desde = Utilities.parseDate(req.mes.replace('-', '') + '01', tz, 'yyyyMMdd').getTime();
    const sig = m === 12 ? (a + 1) + '01' : a + ('0' + (m + 1)).slice(-2);
    hasta = Utilities.parseDate(sig + '01', tz, 'yyyyMMdd').getTime();
    periodo = req.mes;
  } else {
    periodo = ['hoy', 'semana', 'mes'].indexOf(req.periodo) >= 0 ? req.periodo : 'hoy';
    desde = inicioPeriodo_(tz, periodo);
  }
  const ventas = leerDesde_(hoja_('Ventas'), 8, desde, 0).filas;
  let minId = Infinity;
  ventas.forEach(function (r) {
    const id = Number(r[0]), t = r[1] instanceof Date ? r[1].getTime() : 0;
    if (r[0] !== '' && String(r[6]) !== 'Anulada' && id < minId && (!hasta || t < hasta)) minId = id;
  });
  const r = resumenDe_(ventas, leerDesde_(hoja_('Pagos'), 7, desde, 0).filas, detalleDesdeId_(minId), desde, hasta);
  r.periodo = periodo;
  return r;
}

// HISTORIAL: un renglón por mes (ventas, cobrado, ganancia), del más nuevo al más viejo. Últimos 36 meses.
function historial_() {
  const tz = ss_().getSpreadsheetTimeZone();
  const mesDe = function (d) { return d instanceof Date ? Utilities.formatDate(d, tz, 'yyyyMMdd').slice(0, 6) : ''; };
  const meses = {}, ventaMes = {};
  const get = function (k) { return meses[k] || (meses[k] = { mes: k.slice(0, 4) + '-' + k.slice(4), ventas: 0, cantidad: 0, cobrado: 0, ganancia: 0 }); };
  const hv = hoja_('Ventas'), nV = hv.getLastRow() - 1;
  if (nV > 0) hv.getRange(2, 1, nV, 7).getValues().forEach(function (r) {
    const k = mesDe(r[1]);
    if (r[0] === '' || !k || String(r[6]) === 'Anulada') return;
    const m = get(k); m.ventas += Number(r[3]) || 0; m.cantidad++; ventaMes[Number(r[0])] = k;
  });
  const hg = hoja_('Pagos'), nP = hg.getLastRow() - 1;
  if (nP > 0) hg.getRange(2, 1, nP, 5).getValues().forEach(function (r) {
    const k = mesDe(r[1]);
    if (r[0] === '' || !k) return;
    get(k).cobrado += Number(r[4]) || 0;
  });
  const hd = hoja_('Detalle'), nD = hd.getLastRow() - 1;
  if (nD > 0) hd.getRange(2, 1, nD, 7).getValues().forEach(function (r) {
    const k = ventaMes[Number(r[0])];
    if (!k) return;
    get(k).ganancia += (Number(r[5]) || 0) - (Number(r[6]) || 0) * (Number(r[3]) || 0);
  });
  const lista = Object.keys(meses).sort().reverse().slice(0, 36).map(function (k) {
    const m = meses[k]; m.ventas = r2_(m.ventas); m.cobrado = r2_(m.cobrado); m.ganancia = r2_(m.ganancia); return m;
  });
  return { meses: lista };
}

/* ========================= ESCRITURAS ========================= */

function guardarProducto_(req) {
  const nombre = String(req.nombre || '').trim();
  if (!nombre) throw new Error('El producto necesita un nombre.');
  const costo = num_(req.costo || 0, 'Costo'), precio = num_(req.precio, 'Precio');
  const minimo = num_(req.minimo || 0, 'Stock mínimo');
  if (costo < 0 || precio < 0 || minimo < 0) throw new Error('No se admiten valores negativos.');
  const categoria = String(req.categoria || '').trim();

  const hp = hoja_('Productos');
  const prods = leerProductos_();
  const k = clave_(nombre);
  const idPropio = req.nuevo ? '' : norm_(req.codigo);
  prods.forEach(function (p) {
    if (clave_(p.obj.nombre) === k && p.obj.codigo !== idPropio) throw new Error('Ya existe un producto llamado "' + p.obj.nombre + '".');
  });

  let fila, obj;
  if (req.nuevo) {
    const stock = num_(req.stock || 0, 'Stock inicial');
    if (stock < 0) throw new Error('El stock inicial no puede ser negativo.');
    let maxId = 0;
    prods.forEach(function (p) { const n = Number(p.obj.codigo); if (n > maxId) maxId = n; });
    const id = siguiente_('SEQ_PROD', maxId);
    agregar_(hp, [[id, nombre, categoria, costo, precio, stock, minimo, 'Sí']]);
    if (stock > 0) agregar_(hoja_('Movimientos'), [[new Date(), id, nombre, 'Stock inicial', stock, stock, 'Alta de producto']]);
    obj = { codigo: String(id), nombre: nombre, categoria: categoria, costo: costo, precio: precio, stock: stock, minimo: minimo, activo: true, revisar: '' };
  } else {
    const p = prods.filter(function (x) { return x.obj.codigo === idPropio; })[0];
    if (!p) throw new Error('No existe el producto ' + idPropio + '.');
    fila = p.fila;
    const activo = req.activo !== false;
    hp.getRange(fila, 2, 1, 4).setValues([[nombre, categoria, costo, precio]]);
    hp.getRange(fila, 7, 1, 2).setValues([[minimo, activo ? 'Sí' : 'No']]);
    obj = { codigo: p.obj.codigo, nombre: nombre, categoria: categoria, costo: costo, precio: precio, stock: p.obj.stock, minimo: minimo, activo: activo, revisar: '' };
  }
  return { producto: obj };
}

function ingresoStock_(req) {
  const cant = num_(req.cantidad, 'Cantidad');
  if (cant <= 0) throw new Error('La cantidad debe ser mayor a 0.');
  const hp = hoja_('Productos');
  const p = buscarProducto_(norm_(req.codigo));
  const nuevo = r3_(p.obj.stock + cant);
  hp.getRange(p.fila, 6).setValue(nuevo);
  p.obj.stock = nuevo;
  if (req.costo !== undefined && req.costo !== null && req.costo !== '') {
    const costo = num_(req.costo, 'Costo');
    if (costo < 0) throw new Error('El costo no puede ser negativo.');
    hp.getRange(p.fila, 4).setValue(costo);
    p.obj.costo = costo;
  }
  agregar_(hoja_('Movimientos'), [[tsOp_(req), Number(p.obj.codigo) || p.obj.codigo, p.obj.nombre, 'Ingreso', cant, nuevo, String(req.nota || '')]]);
  return { producto: p.obj };
}

function ajusteStock_(req) {
  const nuevo = num_(req.nuevoStock, 'Stock');
  if (nuevo < 0) throw new Error('El stock no puede ser negativo.');
  const p = buscarProducto_(norm_(req.codigo));
  const dif = r3_(nuevo - p.obj.stock);
  hoja_('Productos').getRange(p.fila, 6).setValue(nuevo);
  p.obj.stock = nuevo;
  agregar_(hoja_('Movimientos'), [[tsOp_(req), Number(p.obj.codigo) || p.obj.codigo, p.obj.nombre, 'Ajuste', dif, nuevo, String(req.nota || 'Ajuste manual')]]);
  return { producto: p.obj };
}

function eliminarProducto_(req) {
  const p = buscarProducto_(norm_(req.codigo));
  hoja_('Productos').deleteRow(p.fila);   // las ventas ya hechas guardan el nombre y el precio: no se pierde historial
  let advertencia = '';
  try {
    agregar_(hoja_('Movimientos'), [[new Date(), Number(p.obj.codigo) || p.obj.codigo, p.obj.nombre, 'Eliminación', -p.obj.stock, 0,
      'Producto eliminado' + (req.nota ? ': ' + req.nota : '')]]);
  } catch (e) { advertencia = 'El producto se eliminó pero no se pudo anotar en Movimientos.'; }
  return { codigo: p.obj.codigo, nombre: p.obj.nombre, advertencia: advertencia };
}

function registrarVenta_(req) {
  const items = req.items;
  if (!Array.isArray(items) || !items.length) throw new Error('La venta no tiene productos.');

  const prods = leerProductos_();
  const idx = {};
  prods.forEach(function (p, i) { idx[p.obj.codigo] = i; });

  const ahora = tsOp_(req), off = req.offline === true; // off = viene de la cola sin internet: la venta YA ocurrió, no se rechaza
  const demanda = {}, lineas = [], negativos = [];
  let total = 0;

  items.forEach(function (it) {
    const c = norm_(it.codigo), i = idx[c];
    if (i === undefined) {
      if (!off) throw new Error('Producto inexistente (ID ' + c + '). Actualizá el sistema.');
      const cantX = num_(it.cantidad, 'Cantidad'), precioX = num_(it.precio, 'Precio'), subX = r2_(cantX * precioX);
      total += subX; // producto borrado mientras no había internet: la venta se registra igual, sin tocar stock
      lineas.push([Number(c) || c, String(it.nombre || '(producto eliminado)'), cantX, precioX, subX, 0]);
      negativos.push('"' + String(it.nombre || c) + '" ya no existe en la planilla');
      return;
    }
    const p = prods[i].obj;
    if (!p.activo && !off) throw new Error(p.nombre + ' está inactivo.');
    if (p.revisar && !off) throw new Error('"' + p.nombre + '" tiene datos inválidos en la planilla (' + p.revisar + '). Corregilo antes de venderlo.');
    const cant = num_(it.cantidad, 'Cantidad');
    if (cant <= 0) throw new Error('Cantidad inválida en ' + p.nombre + '.');
    const precio = (it.precio === undefined || it.precio === null || it.precio === '') ? p.precio : num_(it.precio, 'Precio');
    if (precio < 0) throw new Error('Precio inválido en ' + p.nombre + '.');
    demanda[c] = (demanda[c] || 0) + cant;
    const sub = r2_(cant * precio);
    total += sub;
    lineas.push([Number(c) || c, p.nombre, cant, precio, sub, p.costo]);
  });
  total = r2_(total);

  Object.keys(demanda).forEach(function (c) {
    const o = prods[idx[c]].obj;
    if (demanda[c] > o.stock + 1e-9) {
      if (!off) throw new Error('Stock insuficiente de ' + o.nombre + ' (hay ' + o.stock + ').');
      negativos.push('"' + o.nombre + '" quedó con stock negativo (había ' + o.stock + ', se vendieron ' + demanda[c] + ')');
    }
  });

  const pago = r2_(num_(req.pagoMonto || 0, 'Pago'));
  if (pago < 0) throw new Error('El pago no puede ser negativo.');
  if (pago > total + 0.001) throw new Error('El pago supera el total de la venta.');
  const saldo = r2_(total - pago);
  const cliente = String(req.cliente || '').trim() || 'Mostrador';
  if (saldo > 0.009 && cliente === 'Mostrador') throw new Error('Para dejar saldo a cuenta, poné el nombre del cliente.');
  const metodo = String(req.metodo || 'Efectivo');
  const estado = estado_(total, pago);

  const hv = hoja_('Ventas'), hg = hoja_('Pagos');
  const id = siguiente_('SEQ_VENTA', ultimoId_(hv));

  // 1) Lo importante primero: la venta y su dinero. Desde acá la venta YA EXISTE.
  agregar_(hv, [[id, ahora, cliente, total, pago, saldo, estado, metodo]]);
  agregar_(hoja_('Detalle'), lineas.map(function (l) { return [id].concat(l); }));
  if (pago > 0) agregar_(hg, [[siguiente_('SEQ_PAGO', ultimoId_(hg)), ahora, id, cliente, pago, metodo, 'Pago inicial']]);

  // 2) Stock y movimientos. Si algo falla acá NO se devuelve error (el cliente reintentaría y duplicaría la venta).
  const stockNuevo = {};
  let advertencia = negativos.length ? 'Venta #' + id + ': revisá el stock → ' + negativos.join('; ') + '.' : '';
  try {
    const cambios = {}, movs = [];
    Object.keys(demanda).forEach(function (c) {
      const p = prods[idx[c]];
      const nuevo = r3_(p.obj.stock - demanda[c]);
      cambios[p.fila] = nuevo; stockNuevo[p.obj.codigo] = nuevo;
      movs.push([ahora, Number(c) || c, p.obj.nombre, 'Venta', -demanda[c], nuevo, 'Venta #' + id]);
    });
    escribirStock_(hoja_('Productos'), cambios);
    agregar_(hoja_('Movimientos'), movs);
  } catch (e) {
    advertencia += ' La venta #' + id + ' se guardó, pero no se pudo actualizar el stock (' + e.message + '). Corregilo con "Ajustar".';
  }

  return {
    id: id, total: total, pagado: pago, saldo: saldo, estado: estado, stock: stockNuevo, advertencia: advertencia,
    venta: { id: id, fecha: fecha_(ahora, ss_().getSpreadsheetTimeZone()), cliente: cliente, total: total, pagado: pago, saldo: saldo, estado: estado, metodo: metodo }
  };
}

function registrarPago_(req) {
  const id = Number(req.idVenta);
  const monto = r2_(num_(req.monto, 'Monto'));
  if (monto <= 0) throw new Error('El monto debe ser mayor a 0.');
  const hv = hoja_('Ventas');
  const f = filaVenta_(hv, id);
  const r = hv.getRange(f, 1, 1, 8).getValues()[0];
  if (String(r[6]) === 'Anulada') throw new Error('La venta #' + id + ' está anulada.');
  const total = Number(r[3]) || 0, pagado = Number(r[4]) || 0;
  const saldo = r2_(total - pagado);
  if (monto > saldo + 0.001) throw new Error('El monto supera el saldo pendiente (' + saldo + ').');

  const nuevoPagado = r2_(pagado + monto), nuevoSaldo = r2_(total - nuevoPagado), estado = estado_(total, nuevoPagado);
  const hg = hoja_('Pagos');
  // Primero el pago (queda el rastro del dinero), después el saldo de la venta.
  agregar_(hg, [[siguiente_('SEQ_PAGO', ultimoId_(hg)), tsOp_(req), id, String(r[2]), monto, String(req.metodo || 'Efectivo'), String(req.nota || 'Cobro')]]);
  hv.getRange(f, 5, 1, 3).setValues([[nuevoPagado, nuevoSaldo, estado]]);
  return { id: id, pagado: nuevoPagado, saldo: nuevoSaldo, estado: estado };
}

function anularVenta_(req) {
  const id = Number(req.idVenta);
  const hv = hoja_('Ventas');
  const f = filaVenta_(hv, id);
  const r = hv.getRange(f, 1, 1, 8).getValues()[0];
  if (String(r[6]) === 'Anulada') throw new Error('La venta #' + id + ' ya estaba anulada.');
  const ahora = new Date();

  // 1) Dinero y estado primero (desde acá la anulación YA EXISTE).
  const pagado = Number(r[4]) || 0;
  if (pagado > 0) {
    const hg = hoja_('Pagos');
    agregar_(hg, [[siguiente_('SEQ_PAGO', ultimoId_(hg)), ahora, id, String(r[2]), -pagado, String(r[7]), 'Devolución por anulación' + (req.nota ? ': ' + req.nota : '')]]);
  }
  hv.getRange(f, 5, 1, 3).setValues([[0, 0, 'Anulada']]);

  // 2) Devolver stock (si falla, se avisa pero no se pide reintentar).
  const stockNuevo = {};
  let advertencia = '';
  try {
    const prods = leerProductos_(), idx = {};
    prods.forEach(function (p, i) { idx[p.obj.codigo] = i; });
    const cambios = {}, movs = [];
    bloqueDetalle_(id).forEach(function (d) {
      const i = idx[String(d[1])];
      if (i === undefined) return; // producto borrado a mano: no hay a dónde devolver
      const p = prods[i];
      p.obj.stock = r3_(p.obj.stock + Number(d[3]));
      cambios[p.fila] = p.obj.stock; stockNuevo[p.obj.codigo] = p.obj.stock;
      movs.push([ahora, d[1], p.obj.nombre, 'Anulación', Number(d[3]), p.obj.stock, 'Anulación venta #' + id]);
    });
    escribirStock_(hoja_('Productos'), cambios);
    agregar_(hoja_('Movimientos'), movs);
  } catch (e) {
    advertencia = 'La venta #' + id + ' se anuló, pero no se pudo devolver el stock (' + e.message + '). Corregilo con "Ajustar".';
  }
  return { id: id, stock: stockNuevo, advertencia: advertencia };
}

/* ========================= UTILIDADES ========================= */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function hoja_(n) {
  const h = ss_().getSheetByName(n);
  if (!h) throw new Error('Falta la hoja "' + n + '". Ejecutá "Configurar / reparar sistema".');
  return h;
}

function agregar_(h, rows) {
  if (!rows.length) return;
  const fila = h.getLastRow() + 1;
  h.getRange(fila, 1, rows.length, rows[0].length).setValues(rows);
  asegurarFormato_(h, fila + rows.length);
}

// Lee de la fila (índice 0 = primera de datos) donde empieza el período, o las últimas minUltimas filas (lo que sea más).
// Solo lee la columna de fechas completa (1 columna) y luego un bloque: no la hoja entera.
function leerDesde_(h, ncols, desdeMs, minUltimas) {
  const n = h.getLastRow() - 1;
  if (n < 1) return { filas: [], ini: 0, n: 0 };
  const f = h.getRange(2, 2, n, 1).getValues();
  let ini = n;
  for (let i = 0; i < n; i++) {
    const d = f[i][0];
    if (d instanceof Date && d.getTime() >= desdeMs) { ini = i; break; }
  }
  if (minUltimas) ini = Math.min(ini, Math.max(0, n - minUltimas));
  if (ini >= n) return { filas: [], ini: n, n: n };
  return { filas: h.getRange(2 + ini, 1, n - ini, ncols).getValues(), ini: ini, n: n };
}

// Lee filas sueltas (índices ordenados) juntando las cercanas en un mismo bloque: pocas llamadas a la API.
function filasPorIndice_(h, idxs, ncols) {
  const out = {};
  idxs.sort(function (a, b) { return a - b; });
  let i = 0;
  while (i < idxs.length) {
    let j = i;
    while (j + 1 < idxs.length && idxs[j + 1] - idxs[j] <= 30) j++;
    const a = idxs[i], b = idxs[j];
    const vals = h.getRange(2 + a, 1, b - a + 1, ncols).getValues();
    for (let k = i; k <= j; k++) out[idxs[k]] = vals[idxs[k] - a];
    i = j + 1;
  }
  return out;
}

// Filas del Detalle de todas las ventas con ID >= minId (un solo bloque: el Detalle está ordenado por venta).
function detalleDesdeId_(minId) {
  const hd = hoja_('Detalle'), n = hd.getLastRow() - 1;
  if (n < 1 || !isFinite(minId)) return [];
  const ids = hd.getRange(2, 1, n, 1).getValues();
  let ini = n;
  for (let i = 0; i < n; i++) if (Number(ids[i][0]) >= minId) { ini = i; break; }
  return ini < n ? hd.getRange(2 + ini, 1, n - ini, 7).getValues() : [];
}

function bloqueDetalle_(id) {
  const hd = hoja_('Detalle'), n = hd.getLastRow() - 1;
  if (n < 1) return [];
  const ids = hd.getRange(2, 1, n, 1).getValues();
  let a = -1, b = -1;
  for (let i = 0; i < n; i++) if (Number(ids[i][0]) === id) { if (a < 0) a = i; b = i; }
  if (a < 0) return [];
  return hd.getRange(2 + a, 1, b - a + 1, 7).getValues().filter(function (r) { return Number(r[0]) === id; });
}

function pagosDeVenta_(id) {
  const hg = hoja_('Pagos'), n = hg.getLastRow() - 1;
  if (n < 1) return [];
  const ids = hg.getRange(2, 3, n, 1).getValues(), idxs = [];
  for (let i = 0; i < n; i++) if (Number(ids[i][0]) === id) idxs.push(i);
  const filas = filasPorIndice_(hg, idxs, 7);
  return idxs.map(function (i) { return filas[i]; });
}

function escribirStock_(hp, cambios) {
  const filas = Object.keys(cambios).map(Number);
  if (!filas.length) return;
  const min = Math.min.apply(null, filas), max = Math.max.apply(null, filas);
  const rango = hp.getRange(min, 6, max - min + 1, 1), vals = rango.getValues();
  filas.forEach(function (f) { vals[f - min][0] = cambios[f]; });
  rango.setValues(vals); // una lectura + una escritura, sin importar cuántos productos tenga la venta
}

function leerProductos_() {
  const h = hoja_('Productos'), n = h.getLastRow() - 1;
  if (n < 1) return [];
  const out = [];
  h.getRange(2, 1, n, 8).getValues().forEach(function (r, i) {
    const id = String(r[0]).trim();
    if (id === '') return;
    const errores = [];
    const precio = String(r[4]).trim() === '' ? (errores.push('precio vacío'), 0) : numCelda_(r[4], 'precio', errores);
    out.push({
      fila: 2 + i,
      obj: {
        codigo: id, nombre: String(r[1]).trim(), categoria: String(r[2]).trim(),
        costo: numCelda_(r[3], 'costo', errores), precio: precio, stock: numCelda_(r[5], 'stock', errores),
        minimo: numCelda_(r[6], 'stock mínimo', errores), activo: String(r[7]).trim().toLowerCase() !== 'no',
        revisar: errores.join(', ')
      }
    });
  });
  return out;
}

// Un número escrito como texto raro ("1.500,5x") NO se convierte en silencio en 0: se marca para revisar.
function numCelda_(v, campo, errores) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (s === '') return 0;
  try { return num_(s, campo); } catch (e) { errores.push(campo + ' inválido ("' + s + '")'); return 0; }
}

// Si alguien pega productos directo en la planilla (con nombre pero sin ID), se les asigna el ID automáticamente.
function asignarIdsFaltantes_() {
  const h = hoja_('Productos'), n = h.getLastRow() - 1;
  if (n < 1) return;
  const rango = h.getRange(2, 1, n, 2), vals = rango.getValues();
  let maxId = 0, faltan = false;
  vals.forEach(function (r) {
    const id = Number(r[0]);
    if (id > maxId) maxId = id;
    if (String(r[0]).trim() === '' && String(r[1]).trim() !== '') faltan = true;
  });
  if (!faltan) return;
  vals.forEach(function (r) {
    if (String(r[0]).trim() === '' && String(r[1]).trim() !== '') { r[0] = siguiente_('SEQ_PROD', maxId); maxId = r[0]; }
  });
  h.getRange(2, 1, n, 1).setValues(vals.map(function (r) { return [r[0]]; }));
}

function buscarProducto_(id) {
  const lista = leerProductos_();
  for (let i = 0; i < lista.length; i++) if (lista[i].obj.codigo === id) return lista[i];
  throw new Error('No existe el producto ' + id + '.');
}

function filaVenta_(hv, id) {
  const probable = id + 1; // las ventas se agregan en orden: la venta N casi siempre está en la fila N+1
  if (probable >= 2 && probable <= hv.getLastRow() && Number(hv.getRange(probable, 1).getValue()) === id) return probable;
  const ids = hv.getLastRow() > 1 ? hv.getRange(2, 1, hv.getLastRow() - 1, 1).getValues() : [];
  for (let i = 0; i < ids.length; i++) if (Number(ids[i][0]) === id) return 2 + i;
  throw new Error('No existe la venta #' + id + '.');
}

// Autonumeración 1,2,3… con contador propio: aunque se borre o reordene algo a mano, un ID nunca se repite.
function siguiente_(clave, maxActual) {
  const props = PropertiesService.getScriptProperties();
  const n = Math.max(Number(props.getProperty(clave)) || 0, maxActual || 0) + 1;
  props.setProperty(clave, String(n));
  return n;
}

function ultimoId_(h) {
  const n = h.getLastRow();
  return n >= 2 ? (Number(h.getRange(n, 1).getValue()) || 0) : 0;
}

function inicioPeriodo_(tz, periodo) {
  const hoy = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  let ymd = hoy;
  if (periodo === 'semana') { const d = new Date(); d.setDate(d.getDate() - 6); ymd = Utilities.formatDate(d, tz, 'yyyyMMdd'); }
  else if (periodo === 'mes') ymd = hoy.slice(0, 6) + '01';
  return Utilities.parseDate(ymd, tz, 'yyyyMMdd').getTime();
}

function cfg_(clave, def) {
  const h = ss_().getSheetByName('Config');
  if (!h || h.getLastRow() < 2) return def;
  const filas = h.getRange(2, 1, h.getLastRow() - 1, 2).getValues();
  for (let i = 0; i < filas.length; i++) if (String(filas[i][0]).trim() === clave && String(filas[i][1]).trim() !== '') return String(filas[i][1]);
  return def;
}

function estado_(total, pagado) {
  if (total - pagado <= 0.009) return 'Pagada';
  return pagado > 0 ? 'Parcial' : 'Pendiente';
}

function norm_(c) { return String(c === undefined || c === null ? '' : c).trim(); }
function clave_(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }

function num_(v, etiqueta) {
  let s = String(v === undefined || v === null ? '' : v).trim();
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  if (s === '' || isNaN(n) || !isFinite(n)) throw new Error('"' + (etiqueta || 'Valor') + '" no es un número válido.');
  return n;
}

function r2_(n) { return Math.round(n * 100) / 100; }
function r3_(n) { return Math.round(n * 1000) / 1000; }

function fecha_(d, tz) {
  const f = d instanceof Date ? d : new Date(d);
  return isNaN(f.getTime()) ? '' : Utilities.formatDate(f, tz, "yyyy-MM-dd'T'HH:mm:ss");
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function avisar_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}
