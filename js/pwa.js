'use strict';
/* App instalable + detección de versiones nuevas. Solo actúa por http(s). Muy liviano: 1 consulta a un archivito cada tanto. */
(function () {
  if (!/^https?:$/.test(location.protocol)) return;

  let reg = null;
  // updateViaCache:'none' -> el navegador SIEMPRE mira si hay un sw.js nuevo, sin quedarse con una copia vieja
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'}).then(r => { reg = r; }).catch(() => {});

  let avisada = false, ultima = Date.now();
  async function revisar() {
    ultima = Date.now();
    try {
      if (reg) reg.update().catch(() => {}); // que el service worker baje la versión nueva por detrás
      const t = await (await fetch('js/version.js', {cache: 'no-store'})).text();
      const m = t.match(/APP_VERSION\s*=\s*'([^']+)'/);
      if (m && m[1] !== APP_VERSION && !avisada) {
        avisada = true;
        const b = $('#actualizar');
        b.innerHTML = `${ic('download', 'w-4 h-4 shrink-0')}<span>Hay una versión nueva (${esc(m[1])}). Tocá acá para actualizar.</span>`;
        b.hidden = false;
        b.onclick = () => location.reload();
      }
    } catch (e) { /* sin internet: se vuelve a intentar después */ }
  }
  setTimeout(revisar, 20000);                // un rato después de abrir (que no compita con la carga)
  setInterval(revisar, 60 * 60 * 1000);      // y 1 vez por hora
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - ultima > 30 * 60 * 1000) revisar(); });
})();
