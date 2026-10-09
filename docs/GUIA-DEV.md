# Stock Lite — Guía para desarrolladores

Sistema liviano de **stock + ventas + cobros** sobre Google Sheets, operado por una sola persona, pensado para una netbook vieja
(Atom N2600, 2 GB, 1024×600, Debian + Chromium). **Proyecto independiente**: no comparte cuentas, datos ni código con otros sistemas.

> Las credenciales y la clave de acceso **no están en este repositorio** (es público). Están en el archivo privado del dueño
> (`STOCKLITE-PRIVADO`, fuera de git). Si sos dev nuevo, pedíselo a Facundo Lazarte.

## 1. Arquitectura en una mirada

```
 Netbook (Chromium, PWA instalada)
   │  carga la app desde GitHub Pages (archivos estáticos)
   │  y habla con Google Apps Script por fetch POST (text/plain, sin preflight)
   ▼
 GitHub Pages  ──────────────►  repo público (este)         js/ css/ index.html sw.js gs/Codigo.gs
 Apps Script web app (doPost) ─►  Google Sheets de la cuenta del cliente (la "base de datos")
```

- **Frontend:** JS vanilla (sin módulos, globals entre `js/*.js`), Tailwind precompilado, íconos propios en un sprite SVG, fuente local.
  Sin librerías en runtime, sin animaciones decorativas, **0 conexiones externas**.
- **Backend:** `gs/Codigo.gs`, script *vinculado* a la planilla. Una sola web app (`doPost`) con acciones.
- **Datos:** hojas `Productos, Ventas, Pagos, Detalle, Movimientos, Config, Resumen` + `Operaciones` (oculta, la crea sola).
- **PWA:** `sw.js` cache-first versionado. Cada equipo instalado se actualiza solo cuando sube `APP_VERSION`.

## 2. Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | Estructura, sprite de íconos (entre `ICONOS:INICIO/FIN`), orden de scripts |
| `js/version.js` | `APP_VERSION` (dispara actualización en los equipos) y `SERVIDOR_MINIMO` |
| `js/config.js` | **Link de la planilla** (`CONEXION.url`). Manda en todos los equipos |
| `js/api.js` | Conexión, clave `k`, estado global `S`, caché local, `sync()`, mudanza de link |
| `js/cola.js` | **Cola sin internet** (IndexedDB + localStorage), subida en lotes |
| `js/app.js` | Pantallas Vender / Stock / Cobros / Ventas / Resumen y modales |
| `js/teclas.js` | Flechas (navegación espacial), Alt+1..5, semáforo de modales |
| `js/utils.js` | Helpers, `modal()`, `toast()`, `ic()` |
| `js/pwa.js`, `sw.js` | Registro del service worker y aviso "nueva versión" |
| `css/colores.css` | **Única fuente de colores** (variables `--c-*`) |
| `gs/Codigo.gs` | Todo el backend |
| `construir-css.bat`, `construir-iconos.bat` | Regeneran `css/tailwind.css` y el sprite de íconos |

## 3. Reglas de oro (no romper)

1. **Subir `APP_VERSION` en cada publicación**, o los equipos no se enteran. (Hay un hook `pre-commit` local que lo hace solo
   cuando el commit toca archivos de la app; en otra máquina hay que recrearlo o subirla a mano.)
2. **Pocos pedidos a Google:** 1 por acción, ninguno por reloj. Sincroniza al abrir, con ↻, al volver tras +10 min, y al volver internet.
3. **Idempotencia:** toda escritura lleva `rid`. El servidor no repite una operación ya hecha (caché 6 h + hoja `Operaciones` permanente).
4. **El servidor calcula todo** (stock, totales, costos). El frontend nunca es fuente de verdad.
5. **Si la venta ya quedó registrada y falla un paso posterior, se devuelve éxito + advertencia**, nunca error (evita reintentos que dupliquen).
6. Tras tocar clases Tailwind en HTML/JS: `npx tailwindcss@3.4.16 -c tailwind.config.js -i src/tailwind.input.css -o css/tailwind.css --minify`.
   Tras agregar un ícono nuevo: `node tools/construir-iconos.js`.

## 4. Versiones del servidor (`VERSION_SERVIDOR`)

| v | Agrega |
|---|---|
| 2 | Base: productos, ventas, pagos, anulaciones |
| 3 | Eliminar producto; ítems de ventas y resumen de hoy dentro de `cargar` |
| 4 | **Mudanza** (`redirect`): la planilla vieja avisa el link nuevo |
| 5 | **Cola sin internet**: acción `lote`, fecha real (`ts`), registro durable de `rid`, acepta lo ya vendido aunque deje stock negativo |
| 6 | **Clave de acceso**: sin la clave (`k`) el servidor rechaza todo |

La app degrada bien con servidores viejos (sin borrar productos, sin cola) y avisa que hay que actualizar el `Codigo.gs`.

## 5. Cola sin internet (`js/cola.js`)

- Cada venta/cobro/ingreso/ajuste se guarda **primero** en la compu (IndexedDB + copia en localStorage; se unen al abrir) con `rid`,
  `ts` (hora real) y orden (`seq`). Se pide `navigator.storage.persist()`.
- Se intenta subir al momento; si no hay internet, se aplica en pantalla (`EFECTOS`) y queda pendiente. **Es silencioso** para la
  usuaria: mismo mensaje que online. Solo aparece un aviso rojo si el servidor **rechaza** algo (queda visible, nunca se descarta solo).
- Sube al abrir la app, al evento `online` y cada 60 s si hay pendientes. De a 8 operaciones, en orden, una subida a la vez.
- Una operación sale de la cola **solo** cuando el servidor confirma. Reintentar es seguro por el `rid`.
- Solo funcionan sin internet: vender, cobrar, ingreso y ajuste. Crear/editar/borrar productos y anular piden conexión.

## 6. Conexión, clave y cambio de link (importante)

El repo y GitHub Pages son **públicos**, así que el link del servidor es público. Lo que protege la planilla es la **clave de acceso**:

- Servidor: menú *🧾 Stock Lite → Clave de acceso (ver / crear)* genera `CLAVE_ACCESO` (Script Properties). Con clave creada, todo pedido
  sin `k` correcta se rechaza. Sin clave creada, funciona abierto (como antes).
- Cliente: la clave llega **una vez** por el link de instalación `…/?c=ID_SCRIPT&k=CLAVE`, se guarda en `localStorage.stocklite_k` y se
  envía en cada pedido. **La clave nunca va en el repo.**
- **Link en el código:** `js/config.js → CONEXION.url`. Si cambia respecto de lo que el equipo vio la última vez, el equipo se pasa solo al nuevo.
  La clave no cambia aunque cambie el link.

### Cómo cambiar el backend (Codigo.gs) — el 90 % de los casos
1. Pegar el `Codigo.gs` en el editor de Apps Script de la planilla del cliente.
2. **Implementar → Administrar implementaciones → lápiz → Versión: Nueva versión.** *(Nunca "Nueva implementación": cambia el link.)*
3. Si cambió algo de hojas: ejecutar `configurarSistema` una vez.
Resultado: mismo link, nadie toca las compus.

### Si igual hay que cambiar de link (nueva implementación o nueva planilla)
1. Editar `url` en `js/config.js`.
2. `git commit` + `git push` (sube `APP_VERSION` solo).
3. Cada equipo se actualiza (barra verde "nueva versión") y se pasa solo al link nuevo. La clave del servidor nuevo debe ser **la misma**
   (copiar `CLAVE_ACCESO` en *Configuración del proyecto → Propiedades del script*) o cargarla en cada equipo con `&k=`.
4. Respaldo adicional: en la planilla **vieja**, menú *Mudar la app a otro link…* — los equipos que sigan apuntando a ella se pasan solos.
   No borrar la implementación vieja hasta confirmar que todos se pasaron.

## 7. Alta de un cliente nuevo (resumen)

1. Con la cuenta de Google **del cliente**: copiar la planilla plantilla, *Extensiones → Apps Script*, pegar `Codigo.gs`, ejecutar `configurarSistema`.
2. Implementar como **Aplicación web** (Ejecutar como: Yo; Acceso: Cualquier usuario). Copiar el link `/exec`.
3. Crear la clave (menú) y copiarla.
4. Poner el link en `js/config.js` (si es el mismo cliente/instalación) **o** armar el link de instalación `…github.io/…/?c=ID&k=CLAVE`.
5. Config B2: nombre del negocio. Activar respaldo diario (menú). `reiniciarParaEntrega()` borra datos de prueba (se ejecuta a mano desde el editor).
6. Abrir el link en el equipo del cliente; instalar la PWA desde el menú del navegador.

## 8. Netbook del cliente

- Debian 13 XFCE + Chromium. Ethernet funciona de fábrica; el Wi-Fi quedó sin resolver (baja prioridad).
- El pendrive tiene `ABRIR-STOCK-LITE.html` (abre el navegador ya conectado, con link y clave). Los `.sh/.desktop` perdieron el permiso de ejecución
  al pasar por Windows y se abrían en el Bloc de notas: por eso quedaron en `extras/`.
- Pantalla 1024×600: hay modo compacto (`@media (max-height:720px)`) y **Vista grande** (botón de letra A) para agrandar letra y botones.

## 9. Pruebas

Hay un simulador de Apps Script/Sheets en memoria que ejecuta el `Codigo.gs` real y un servidor local de pruebas (`/api`); la app
acepta `http://localhost:PUERTO/api` como link solo para testear. Casos a cubrir al tocar la cola o el servidor: venta sin conexión + cerrar
y reabrir, reintento del mismo `rid` días después (no duplica), fecha real, stock negativo, clave ausente/equivocada/correcta.

## 10. Cuentas y publicación

- El código se publica desde la cuenta de GitHub **Pachilazarte** (`gh auth switch --user Pachilazarte` antes de `git push` si el CLI
  quedó con otra sesión; el error 403 significa eso).
- Hacer el repo **privado apaga GitHub Pages** en cuentas gratuitas: no hacerlo. Y no serviría para ocultar el link (lo servido es público igual).
