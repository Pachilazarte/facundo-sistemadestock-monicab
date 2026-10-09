# Stock Lite

Stock, ventas y cobros sobre Google Sheets. Una app instalable (PWA) + un backend de Apps Script por cliente.

```
index.html, css/, js/, sw.js, manifest, icons/   → la app (se publica en GitHub Pages, igual para todos los clientes)
gs/Codigo.gs                                      → el backend (va en la planilla de CADA cliente)
```

## 1. Publicar la app (una sola vez)

1. Subí esta carpeta a un repo de GitHub.
2. **Settings > Pages > Source: Deploy from a branch > main / (root)**.
3. La app queda en `https://TU-USUARIO.github.io/NOMBRE-REPO/`.

> El link de cada cliente **no** va en el repo (es su llave de acceso). `js/config.js` queda vacío.

## 2. Alta de un cliente nuevo (≈ 10 min, con SU cuenta de Google)

**Una sola vez — preparar la plantilla (en tu cuenta):**
1. Creá una planilla limpia con `gs/Codigo.gs` pegado en Apps Script, ejecutá `configurarSistema` y, si tiene datos de prueba, `reiniciarParaEntrega`. Nombre sugerido: *Stock Lite - PLANTILLA*. **No la implementes como app web** (las copias no heredan despliegues, y así queda sin enlaces ni contadores).
2. **Compartir > Cualquier persona con el enlace > Lector**.
3. Tu link de copia es la URL de la planilla cambiando el final `/edit...` por `/copy`:
   `https://docs.google.com/spreadsheets/d/ID_PLANTILLA/copy`

**Por cada cliente — en la PC del cliente, con la sesión de Google DEL CLIENTE:**
1. Abrí el link de copia y tocá **Hacer una copia**. La planilla (con su script ya adentro) queda en el Drive del cliente.
2. Recargá la planilla → menú **🧾 Stock Lite > Configurar / reparar sistema** y aceptá los permisos (*Avanzado > Ir a… > Permitir*).
3. En la hoja **Config**, celda **B2**: nombre del negocio.
4. **Extensiones > Apps Script > Implementar > Nueva implementación > Aplicación web** — Ejecutar como: *Yo* · Acceso: *Cualquier usuario*. Copiá la URL (`.../macros/s/AKfy.../exec`).
5. Menú **🧾 Stock Lite > Activar respaldo diario**.
6. Armá el **link de instalación** con el ID del medio de esa URL:
   `https://TU-USUARIO.github.io/NOMBRE-REPO/?c=ID_DEL_SCRIPT`
7. Abrilo en **Chrome o Edge** y tocá **Instalar** (ícono en la barra de direcciones, o menú ⋮ > *Guardar y compartir > Instalar*). Queda un ícono en el escritorio. El link se guarda solo en esa PC.

> Como el cliente es el dueño de la planilla y del despliegue ("Ejecutar como: Yo"), los datos y los respaldos quedan en SU Drive.

## 3. Publicar una actualización de la app

1. Hacé los cambios. Según lo que toques, corré antes de publicar (necesitan Node e internet en TU PC):
   - **`construir-css.bat`** si tocaste clases de Tailwind en `index.html` o `js/*.js` (regenera `css/tailwind.css`).
   - **`construir-iconos.bat`** si agregaste un ícono nuevo (regenera el conjunto de íconos dentro de `index.html`; los nombres son los de lucide.dev/icons).
   Después **subí `APP_VERSION` en `js/version.js`** (es obligatorio: la app guarda sus archivos y solo baja los nuevos cuando cambia ese número) y hacé push.
2. Listo. Las PCs instaladas toman los archivos nuevos cada vez que abren la app, y si la tienen abierta todo el día, en ≤30 min muestran la barra *"Hay una versión nueva — tocá para actualizar"*.

## 4. Actualizar el backend (Codigo.gs) de un cliente

Pasa solo cuando cambia algo del servidor. Si la app necesita un servidor más nuevo, muestra un aviso amarillo arriba (*"El servidor de esta planilla está desactualizado"*).

1. Apps Script de ese cliente: reemplazá todo por el `Codigo.gs` nuevo.
2. Ejecutá `configurarSistema` (no toca los datos).
3. **Implementar > Administrar implementaciones > ✏️ > Versión: Nueva versión > Implementar** (la URL no cambia).

Cuando cambies el backend de forma que la app vieja ya no sirva: subí `VERSION_SERVIDOR` en `gs/Codigo.gs` y `SERVIDOR_MINIMO` en `js/version.js`.

## Notas

- **Sin internet (servidor v5):** vender, cobrar, ingresar y ajustar stock siguen funcionando. Cada operación se guarda primero en la computadora (IndexedDB + copia en localStorage), con su hora real y un identificador único, y se sube sola, en orden y de a lotes, cuando vuelve internet (al abrir la app, al volver la conexión, o cada 1 minuto si hay algo pendiente). Una operación sale de la cola SOLO cuando el servidor confirma que la guardó; si el servidor rechaza una, queda visible como "con problema" (banner arriba → pantalla *Sin subir a la planilla*, con reintentar / descartar / guardar copia en archivo). El servidor no duplica nada aunque llegue días después (registro permanente en la hoja oculta `Operaciones`), acepta lo ya vendido aunque deje stock negativo (lo avisa) y respeta la fecha real de la venta. Crear/editar/borrar productos y anular ventas piden conexión. Con un servidor anterior a v5 la app se comporta como antes.
- **Uso local sin instalar:** abrí `index.html?c=ID_DEL_SCRIPT` directo desde la carpeta (sin actualizaciones automáticas).
- **Liviano a propósito:** sin animaciones decorativas, íconos propios (8 KB en vez de 358 KB), fuente propia, estilos precompilados, y pocos pedidos a Google: 1 por acción, ninguno por reloj. Se dibuja solo la pestaña visible. Pensado para netbooks de 10" (1024×600, 2 GB).
- **Teclado** (`js/teclas.js`, mismo sistema que StockPay): las flechas mueven el foco por toda la pantalla hacia donde está lo siguiente; en el menú, las categorías y las ventas se recorre en orden (Inicio/Fin al primero/último); escribir en un campo siempre gana; **Enter** abre una fila; **Alt+1…5** salta de sección (Vender, Stock, Cobros, Ventas, Resumen); con una ventana abierta, las flechas y Alt+N no tocan lo de atrás; **F2** vuelve a Vender.
- **Vista grande** (botón **Aa** del menú): letra y botones más grandes, el menú pasa arriba como botonera con el atajo Alt+N de cada sección, sin sacar ninguna opción. Se recuerda en cada equipo.
- **Cambiar el link de la planilla = editar `js/config.js` y hacer commit + push.** Cada equipo, al actualizarse (la versión sube sola con el commit), se pasa solo al link nuevo. Es seguro que el link esté en el repo público SOLO si la planilla tiene **clave de acceso** (servidor v6): menú 🧾 Stock Lite > *Clave de acceso (ver / crear)*. Con clave, el servidor rechaza cualquier pedido que no la traiga: el link solo no sirve para nada. La clave NO va en el repo: se carga una vez en cada equipo con el link de instalación `...?k=CLAVE` (queda guardada) y no cambia aunque cambie el link. Sin clave creada, la planilla funciona como antes.
- **Link puntero (el que se usa para cambiar de planilla sin tocar las compus).** Una hoja de Google, en el Drive del dueño, con el link ACTUAL de la planilla en la celda A1, publicada en la web como CSV. Su link ("link de lectura") se carga UNA vez en cada compu con `?p=LINK_PUNTERO` y no cambia nunca. Al abrir la app (y si falla la conexión con la planilla) se lee el puntero: si apunta a otro link, se prueba que responda y la app se pasa sola, conservando las operaciones guardadas sin internet. Para cambiar de planilla: editar A1. No va en el repo (público). Una compu nueva puede instalarse solo con `?p=`.
- **Mudanza de link (servidor v4):** si alguna vez hay que reemplazar el servidor por otro link /exec, NO hace falta tocar las computadoras. En la planilla VIEJA: menú 🧾 Stock Lite > *Mudar la app a otro link…* y pegar el link nuevo. Cada compu que use el link viejo se pasa sola al nuevo la próxima vez que abra la app (se prueba que el nuevo responda antes de cambiar). No borrar la implementación vieja hasta que todas se hayan pasado. Para actualizar el servidor SIN cambiar de link: Implementar > Administrar implementaciones > editar > *Nueva versión* (nunca "Nueva implementación").
- **Servidor v3+** (`VERSION_SERVIDOR = 4`): agrega *eliminar producto* y trae el detalle de ventas y el resumen de hoy en la carga inicial. Con un servidor v2 la app sigue andando (sin esas funciones).
- **Equipos viejos (netbook con Windows 7 de 32 bits):** ver la Parte F de `GUIA-INSTALACION-CLIENTE.md`. El CSS va precompilado (no se compila en el navegador) justamente para que ande liviano.
- **Marca/colores:** todo sale de `css/colores.css`. Si cambiás `--c-marca` o `--c-fondo`, actualizá también `theme_color` / `background_color` en `manifest.webmanifest` y el `<meta name="theme-color">` de `index.html` (el navegador no lee variables ahí).
- **Íconos:** `icons/icon-192.png` y `icon-512.png` (reemplazables por el logo del cliente).
