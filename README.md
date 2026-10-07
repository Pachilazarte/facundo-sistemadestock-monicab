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

## 2. Alta de un cliente nuevo (≈ 10 min)

1. Hacé una copia de la planilla base (o creá una nueva) y en **Extensiones > Apps Script** pegá `gs/Codigo.gs`.
2. Ejecutá `configurarSistema` y aceptá los permisos.
3. **Implementar > Nueva implementación > Aplicación web** — Ejecutar como: *Yo* · Acceso: *Cualquier usuario*. Copiá la URL (`.../macros/s/AKfy.../exec`).
4. En la planilla: menú **🧾 Stock Lite > Activar respaldo diario**.
5. Armá el **link de instalación** con el ID del medio de esa URL:

   `https://TU-USUARIO.github.io/NOMBRE-REPO/?c=ID_DEL_SCRIPT`

6. En la PC del cliente, abrí ese link en **Chrome o Edge** y tocá **Instalar** (ícono en la barra de direcciones, o menú ⋮ > *Guardar y compartir > Instalar Stock Lite*). Queda un ícono en el escritorio y abre en su propia ventana.
   El link se guarda solo en esa PC: el cliente nunca ve ni escribe nada.

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
