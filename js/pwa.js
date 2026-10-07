'use strict';
/* App instalable + detección de versiones nuevas. Solo actúa por http(s) (en el HTML local abierto desde disco no aplica). */
(function () {
  if (!/^https?:$/.test(location.protocol)) return;

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  let avisada = false, ultima = Date.now();
  async function revisar() {
    ultima = Date.now();
    try {
      const t = await (await fetch('js/version.js', {cache: 'no-store'})).text();
      const m = t.match(/APP_VERSION\s*=\s*'([^']+)'/);
      if (m && m[1] !== APP_VERSION && !avisada) {
        avisada = true;
        const b = $('#actualizar');
        b.innerHTML = `${ic('download', 'w-4 h-4 shrink-0')}<span>Hay una versión nueva (${esc(m[1])}). Tocá acá para actualizar.</span>`;
        b.hidden = false; refreshIcons();
        b.onclick = () => location.reload();
      }
    } catch (e) { /* sin internet: se vuelve a intentar después */ }
  }
  revisar();
  setInterval(revisar, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - ultima > 10 * 60 * 1000) revisar(); });
})();
