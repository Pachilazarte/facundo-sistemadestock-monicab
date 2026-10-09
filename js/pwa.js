'use strict';
/* App instalable + detección de versiones nuevas. Solo actúa por http(s). Muy liviano: 1 consulta a un archivito cada tanto. */
(function () {
  if (!/^https?:$/.test(location.protocol)) return;

  let reg = null;
  // updateViaCache:'none' -> el navegador SIEMPRE mira si hay un sw.js nuevo, sin quedarse con una copia vieja
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'}).then(r => { reg = r; }).catch(() => {});

  let avisada = false, ultima = Date.now(), nueva = '', detectada = 0;
  // ACTUALIZACIÓN AUTOMÁTICA: apenas hay versión nueva se aplica sola, pero SOLO cuando no molesta (ticket vacío, sin ventanas
  // abiertas, sin escribir). Lo guardado sin internet y el ticket abierto no se pierden al recargar. Si no se pudo aplicar solo
  // (o ya se intentó con esa versión y el navegador sigue con la vieja), recién ahí aparece el cartel para tocarlo a mano.
  function libre() {
    try {
      const a = document.activeElement;
      if (typeof cart !== 'undefined' && cart.length) return false;
      if (document.querySelector('dialog[open]')) return false;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.value) return false;
      return true;
    } catch (e) { return false; }
  }
  function aplicarSiSePuede() {
    if (!nueva) return;
    let intentos = 0; try { intentos = Number(sessionStorage.getItem('stocklite_auto_' + nueva)) || 0; } catch (e) {}
    if (intentos >= 2) return avisar();                 // ya se probó: el navegador no la tomó, que lo toque una persona
    if (libre()) { try { sessionStorage.setItem('stocklite_auto_' + nueva, String(intentos + 1)); } catch (e) {} location.reload(); return; }
    setTimeout(aplicarSiSePuede, 30000);                // está ocupada vendiendo: se reintenta en 30 s
    if (!avisada && Date.now() - detectada > 30 * 60 * 1000) avisar();
  }
  function avisar() {
    if (avisada) return; avisada = true;
    const b = $('#actualizar');
    b.innerHTML = `${ic('download', 'w-4 h-4 shrink-0')}<span>Hay una versión nueva (${esc(nueva)}). Tocá acá para actualizar.</span>`;
    b.hidden = false; b.onclick = () => location.reload();
  }
  async function revisar() {
    ultima = Date.now();
    try {
      if (reg) reg.update().catch(() => {}); // que el service worker baje la versión nueva por detrás
      const t = await (await fetch('js/version.js', {cache: 'no-store'})).text();
      const m = t.match(/APP_VERSION\s*=\s*'([^']+)'/);
      if (m && m[1] !== APP_VERSION && !nueva) { nueva = m[1]; detectada = Date.now(); aplicarSiSePuede(); }
    } catch (e) { /* sin internet: se vuelve a intentar después */ }
  }
  setTimeout(revisar, 20000);                // un rato después de abrir (que no compita con la carga)
  setInterval(revisar, 60 * 60 * 1000);      // y 1 vez por hora
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - ultima > 30 * 60 * 1000) revisar(); });
})();
