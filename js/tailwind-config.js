/* Tailwind (CDN): los nombres de color apuntan a las variables de css/colores.css. No hay hex acá. */
const _c = n => `rgb(var(--c-${n}) / <alpha-value>)`;

tailwind.config = {
  theme: {
    extend: {
      colors: {
        fondo: _c('fondo'),
        superficie: _c('superficie'),
        hundido: _c('hundido'),
        borde: _c('borde'),
        texto: _c('texto'),
        suave: _c('suave'),
        marca: { DEFAULT: _c('marca'), osc: _c('marca-osc'), claro: _c('marca-claro'), sobre: _c('sobre-marca') },
        ok: { DEFAULT: _c('ok'), claro: _c('ok-claro') },
        aviso: { DEFAULT: _c('aviso'), claro: _c('aviso-claro') },
        peligro: { DEFAULT: _c('peligro'), claro: _c('peligro-claro') },
        lateral: { DEFAULT: _c('lateral'), texto: _c('lateral-texto'), activo: _c('lateral-activo') }
      },
      fontFamily: { sans: ['Manrope', 'system-ui', 'sans-serif'] }
    }
  }
};
