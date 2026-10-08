/* Solo se usa AL CONSTRUIR el CSS (construir-css.bat). El navegador ya no compila nada.
 * Los nombres de color apuntan a las variables de css/colores.css (única fuente de colores). */
const c = n => `rgb(var(--c-${n}) / <alpha-value>)`;

module.exports = {
  content: ['./index.html', './js/app.js', './js/utils.js', './js/api.js', './js/pwa.js'],
  theme: {
    extend: {
      colors: {
        fondo: c('fondo'), superficie: c('superficie'), hundido: c('hundido'), borde: c('borde'), texto: c('texto'), suave: c('suave'),
        marca: { DEFAULT: c('marca'), osc: c('marca-osc'), claro: c('marca-claro'), sobre: c('sobre-marca') },
        ok: { DEFAULT: c('ok'), claro: c('ok-claro') },
        aviso: { DEFAULT: c('aviso'), claro: c('aviso-claro') },
        peligro: { DEFAULT: c('peligro'), claro: c('peligro-claro') },
        lateral: { DEFAULT: c('lateral'), texto: c('lateral-texto'), activo: c('lateral-activo') }
      },
      fontFamily: { sans: ['Manrope', 'system-ui', 'sans-serif'] }
    }
  }
};
