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

1. Hacé los cambios, **subí `APP_VERSION` en `js/version.js`** y hacé push.
2. Listo. Las PCs instaladas toman los archivos nuevos cada vez que abren la app, y si la tienen abierta todo el día, en ≤30 min muestran la barra *"Hay una versión nueva — tocá para actualizar"*.

## 4. Actualizar el backend (Codigo.gs) de un cliente

Pasa solo cuando cambia algo del servidor. Si la app necesita un servidor más nuevo, muestra un aviso amarillo arriba (*"El servidor de esta planilla está desactualizado"*).

1. Apps Script de ese cliente: reemplazá todo por el `Codigo.gs` nuevo.
2. Ejecutá `configurarSistema` (no toca los datos).
3. **Implementar > Administrar implementaciones > ✏️ > Versión: Nueva versión > Implementar** (la URL no cambia).

Cuando cambies el backend de forma que la app vieja ya no sirva: subí `VERSION_SERVIDOR` en `gs/Codigo.gs` y `SERVIDOR_MINIMO` en `js/version.js`.

## Notas

- **Sin internet:** la app abre igual (copia guardada), pero las ventas necesitan conexión. Si se corta a mitad de una venta, el ticket queda guardado y se reintenta sin duplicar.
- **Uso local sin instalar:** abrí `index.html?c=ID_DEL_SCRIPT` directo desde la carpeta (sin actualizaciones automáticas).
- **Marca/colores:** todo sale de `css/colores.css`. Si cambiás `--c-marca` o `--c-fondo`, actualizá también `theme_color` / `background_color` en `manifest.webmanifest` y el `<meta name="theme-color">` de `index.html` (el navegador no lee variables ahí).
- **Íconos:** `icons/icon-192.png` y `icon-512.png` (reemplazables por el logo del cliente).
