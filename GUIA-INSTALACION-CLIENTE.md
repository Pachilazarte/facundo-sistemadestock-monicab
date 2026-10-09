# Guía de instalación de Stock Lite en un cliente nuevo

Paso a paso, de cero, con todo lo que hay que hacer, dónde y en qué orden. Pensada para que la sigas con la guía abierta al lado.

---

## 0. Cómo está armado (leer una vez)

El sistema son **tres piezas**. Entender esto evita el 90% de las confusiones:

| Pieza | Dónde vive | Quién la ve | ¿Se toca por cliente? |
|---|---|---|---|
| **La app** (pantallas: Vender, Stock, Cobros…) | GitHub Pages, en `https://pachilazarte.github.io/facundo-sistemadestock-monicab/` | Todos los clientes usan la misma | **No.** Se actualiza una sola vez para todos. |
| **La planilla + el script** (`Codigo.gs`) | En la cuenta de Google **de cada cliente** | Solo ese cliente | **Sí:** una copia por cliente. |
| **El link de instalación** | Se arma con el link de la planilla del cliente | Se usa una vez en su PC | **Sí:** uno por cliente. |

### Lo más importante: NO hay que editar el código por cada cliente

El link de la planilla de cada cliente **no se escribe en ningún archivo del código ni se sube a GitHub.** Viaja dentro del *link de instalación* (`...?c=ID`) y la app lo recuerda sola en esa PC.

Por eso, en la PC del cliente **no se descarga el repositorio ni se sube nada a GitHub.** Ahí solo se hace: copiar la planilla → implementar → instalar la app desde el navegador.

| Qué | Dónde se hace |
|---|---|
| Descargar / editar el código, subirlo a GitHub | **Solo en tu PC**, y solo cuando cambia el sistema (no por cliente) |
| Copiar la planilla, implementar, instalar | **En la PC del cliente**, con la sesión de Google del cliente |

---

## 1. Datos fijos (tenelos a mano)

| Dato | Valor |
|---|---|
| Repositorio | https://github.com/Pachilazarte/facundo-sistemadestock-monicab |
| Sitio de la app | https://pachilazarte.github.io/facundo-sistemadestock-monicab/ |
| Carpeta del proyecto en tu PC | `C:\Users\PERSONAL\Documents\basura\7` |
| Archivo del servidor (`Codigo.gs`) | `C:\Users\PERSONAL\Documents\basura\7\gs\Codigo.gs` |
| Link de copia de la plantilla | *(completalo cuando la armes en la Parte A)* |

---

## 2. De dónde sale el código (si necesitás descargarlo)

Solo lo necesitás para **pegar `Codigo.gs` en Apps Script** (Parte A) o para **modificar el sistema** (Parte D). Tres formas:

1. **Ya lo tenés en tu PC:** abrí `C:\Users\PERSONAL\Documents\basura\7\gs\Codigo.gs` con cualquier editor, `Ctrl+A`, `Ctrl+C`.
2. **Desde GitHub, sin instalar nada:** entrá al repositorio → carpeta `gs` → archivo `Codigo.gs` → botón **Copy raw file** (el de los dos cuadraditos, arriba a la derecha del código).
3. **Descargar todo el repo en otra PC:** en la página del repositorio, botón verde **Code → Download ZIP** (descomprimir), o con git:
   ```
   git clone https://github.com/Pachilazarte/facundo-sistemadestock-monicab.git
   ```

---

# PARTE A — Una sola vez: preparar la plantilla (en TU cuenta de Google)

La plantilla es una planilla limpia con el script ya adentro. Cada cliente se hace una copia y listo: así no pegás el código cada vez.

**A1.** Abrí tu planilla de pruebas (o creá una nueva en https://sheets.new).

**A2.** Menú **Extensiones → Apps Script**. Se abre el editor.

**A3.** Reemplazá **todo** el código que haya por el de `Codigo.gs` (ver Parte 2): seleccioná todo, borrá, pegá, y `Ctrl+S` para guardar.

**A4.** Arriba, en el selector de funciones elegí **`configurarSistema`** y tocá **Ejecutar**.
- La primera vez Google pide permisos: *Revisar permisos → elegí tu cuenta → "Google no verificó esta aplicación" → **Avanzado** → **Ir a (nombre del proyecto) (no seguro)** → **Permitir***. Es normal: el script es tuyo.
- Tarda cerca de 1 minuto (prepara 10.000 filas por hoja). Al terminar aparece un cartel "Sistema listo".

**A5.** Si la planilla tiene datos de prueba, borralos: en el selector elegí **`reiniciarParaEntrega`** → **Ejecutar** → **Sí** → escribí `BORRAR` → Aceptar.

**A6.** Archivo → **Hacer una copia**. Nombre: `Stock Lite - PLANTILLA`.
- **No implementes la plantilla como aplicación web.** Las copias no heredan implementaciones, y así queda limpia.

**A7.** En la copia (la plantilla): botón **Compartir** → *Acceso general* → **Cualquier persona con el enlace** → rol **Lector** → Listo.

**A8.** Armá el **link de copia**: tomá la URL de la plantilla, que se ve así
`https://docs.google.com/spreadsheets/d/ID_LARGO/edit?gid=0#gid=0`
y cambiá todo lo que viene después del ID por `/copy`:
`https://docs.google.com/spreadsheets/d/ID_LARGO/copy`
Guardalo en la tabla de la Parte 1.

**A9. Verificación (hacela una vez):** abrí el link de copia en una **ventana de incógnito**. Tiene que ofrecerte **Hacer una copia**. Después de copiarla, abrí **Extensiones → Apps Script** en esa copia: tiene que aparecer `Codigo.gs`. Si apareciera vacío, pegalo a mano (paso A3) y avisá, porque cambia el método.

---

# PARTE B — Por cada cliente (en la PC del cliente, con su Gmail)

## B0. Antes de salir de tu casa

- [ ] Link de copia de la plantilla (Parte A8).
- [ ] Link del sitio de la app (Parte 1).
- [ ] Que la clienta sepa **su usuario y clave de Gmail** y tenga el **celular** a mano (por si tiene verificación en dos pasos).
- [ ] Chrome o Edge en su PC. Si la PC quedó recién formateada: Edge ya viene instalado; Chrome se descarga de https://www.google.com/chrome.
- [ ] Internet en el lugar.

> **No necesitás que te pase su clave.** Ella inicia sesión sola. Si hacés el trámite a distancia, mirá la Parte B-remoto al final.

## B1. Iniciar sesión con su cuenta

1. Abrí Chrome o Edge.
2. Entrá a https://accounts.google.com y que **ella** inicie sesión con su Gmail.

## B2. Hacer su copia de la planilla

1. Abrí el **link de copia** (el que termina en `/copy`).
2. Tocá **Hacer una copia**. Se abre su planilla, que ahora vive en **su** Drive.
3. Renombrala (arriba a la izquierda): `Stock Lite - Nombre del negocio`.

## B3. Confirmar que trajo el script

**Extensiones → Apps Script** → tiene que estar `Codigo.gs` con el código. (Si estuviera vacío: pegá el código, `Ctrl+S`.)

## B4. Configurar el sistema

1. Volvé a la planilla y recargá (`F5`). Después de unos segundos aparece el menú **🧾 Stock Lite** (a la derecha de "Ayuda").
2. **🧾 Stock Lite → Configurar / reparar sistema**.
3. Permisos (solo la primera vez): *Revisar permisos → su cuenta → **Avanzado → Ir a… (no seguro) → Permitir***. Si después de dar permisos no pasa nada, volvé a tocar la opción del menú.
4. Esperá ~1 minuto hasta que diga **"Sistema listo"**.

## B5. Datos del negocio

Hoja **Config**:
- Celda **B2**: nombre del negocio (aparece arriba a la izquierda en la app).
- Celda **B3**: métodos de pago separados por coma (opcional; viene `Efectivo, Transferencia, Débito, Crédito, Mercado Pago`).

## B6. Implementar como aplicación web (el paso clave)

1. Menú **Extensiones → Apps Script**.
2. Arriba a la derecha: **Implementar → Nueva implementación**.
3. Al lado de "Seleccionar tipo" tocá el engranaje ⚙ → **Aplicación web**.
4. Completá:
   - Descripción: `v1`
   - **Ejecutar como: Yo** (es su mail)
   - **Quién tiene acceso: Cualquier usuario**
5. **Implementar** (autorizá de nuevo si lo pide).
6. Copiá la **URL de la aplicación web**. Se ve así:
   `https://script.google.com/macros/s/AKfycbx...muy-largo.../exec`

> **Esa URL es la "llave" de su planilla.** No la publiques, no la subas a GitHub, no la pegues en el código. Guardala solo en tu ficha privada del cliente (ver Anexo).

## B7. Respaldo diario

En la planilla: **🧾 Stock Lite → Activar respaldo diario**. Acepta un permiso extra (Drive). Crea en su Drive una carpeta `Respaldos - Stock Lite - …` con una copia cada noche (se conservan las últimas 30). Ya hace la primera copia en el momento.

## B8. Armar el link de instalación

1. Del link del paso B6, tomá **solo el ID**: lo que está entre `/s/` y `/exec`.
   Ejemplo: `https://script.google.com/macros/s/`**`AKfycbxEJEMPLO123`**`/exec` → el ID es `AKfycbxEJEMPLO123`.
2. Pegalo después de `?c=` en el link del sitio:

   `https://pachilazarte.github.io/facundo-sistemadestock-monicab/?c=AKfycbxEJEMPLO123`

## B9. Instalar la app en su PC

1. Abrí el link de instalación (B8) en **Chrome o Edge**. Esperá a que cargue: arriba a la izquierda tiene que aparecer el nombre de su negocio.
2. Instalar:
   - **Chrome:** ícono de instalar a la derecha de la barra de direcciones (un monitor con una flecha), o menú ⋮ → *Transmitir, guardar y compartir → Instalar Stock Lite*.
   - **Edge:** menú ⋯ → *Aplicaciones → Instalar este sitio como una aplicación*.
3. Marcá **crear acceso directo en el escritorio** y **anclar a la barra de tareas**.
4. Cerrá el navegador y abrí la app desde el ícono del escritorio para comprobar que abre sola, con su nombre de negocio y sin pedir nada.

## B10. Prueba antes de cargar los productos reales

1. En la app: **Stock → Nuevo producto** → nombre `PRUEBA`, precio 100, stock 5.
2. **Vender**: tocá el producto → **Cobrar**. Tiene que aparecer "Venta #1 guardada".
3. Mirá la planilla: la venta en **Ventas**, el pago en **Pagos**, el descuento en **Movimientos**.
4. Probá un fiado: vendé otra vez, tocá **A cuenta**, poné un nombre de cliente → debe aparecer en **Cobros**. Cobralo.
5. En **Ventas**: tocá una venta → **Anular** → comprobá que el stock vuelve.

## B11. Dejar todo en cero para que ella empiece limpia

1. Planilla → **Extensiones → Apps Script**.
2. Selector de funciones → **`reiniciarParaEntrega`** → **Ejecutar** → **Sí** → escribí `BORRAR` → Aceptar.
3. Recargá la app (`F5`): tiene que estar todo vacío. La numeración vuelve a 1.

## B12. Cargar los productos reales

Dos formas, las dos valen:
- **Uno por uno:** en la app, **Stock → Nuevo producto**.
- **En masa:** pegá en la hoja **Productos** las columnas `Nombre`, `Categoría`, `Costo`, `Precio`, `Stock`, `Stock mínimo`, `Activo` (poné `Sí`). **Dejá la columna ID vacía:** el sistema les asigna el número solo la próxima vez que abre la app. Mirá que los precios y costos queden como número (no como texto).

## B13. Mostrarle cómo se usa (10 minutos)

1. **Vender:** tocar el producto (o escribir el N° y Enter) → elegir método → **Cobrar**.
2. **Fiado:** botón **A cuenta** + nombre del cliente → después **Cobros → Cobrar**.
3. **Ingreso de mercadería:** Stock → **+ Ingreso**.
4. **Corregir stock por conteo:** Stock → ícono de ajuste.
5. **Resumen:** ventas, ganancia, más vendidos, stock bajo.
6. **Si dice "Sin conexión":** el ticket queda guardado; cuando vuelva internet, **Cobrar** de nuevo (no se duplica).
7. **Regla de oro:** si necesita corregir algo de la planilla a mano, solo la hoja **Productos** y **Config**. Las demás son registro.

## B14. Guardar tu ficha del cliente

Anotá en un lugar **privado** (no en el repo): nombre del cliente, mail de la cuenta de Google, link `/exec`, link de instalación, fecha, versión instalada (app `1.0.0`, servidor `2`). Ver plantilla en el Anexo.

---

## B-remoto. Si no podés ir (instalación a distancia)

No hace falta que te pase accesos.

1. Le mandás el **link de copia** y una lista corta con los pasos B2 a B7.
2. Ella los hace con su sesión y te manda **solo la URL que termina en `/exec`**.
3. Vos armás el link de instalación (B8), se lo mandás, y ella hace B9.
4. Si querés mirar su planilla: que la comparta con tu mail como **Editor**. **Pero la implementación (B6) tiene que hacerla ella**: "Ejecutar como: Yo" usa la cuenta de quien implementa, y tiene que ser la suya.

---

# PARTE C — Si formatea la PC, cambia de PC o se rompe algo del lado de ella

**Los datos nunca están en la PC: están en su planilla de Google.** Reinstalar no pierde nada.

1. Abrir Chrome/Edge, iniciar sesión con su Gmail (solo si hace falta).
2. Abrir **su link de instalación** (el de tu ficha, B8).
3. Instalar (B9). Listo: mismo negocio, mismos datos.

Si abrió la app sin el link de instalación, le va a mostrar una pantalla **"Conectar con la planilla"**: pegá ahí el link `/exec` completo.

---

# PARTE D — Mantenimiento: actualizar el sistema

## D1. Actualizar la app (pantallas, mejoras) — para TODOS los clientes a la vez

1. Hacé los cambios en `C:\Users\PERSONAL\Documents\basura\7`.
2. Si tocaste clases de Tailwind (en `index.html` o `js\*.js`), ejecutá **`construir-css.bat`** (doble clic en esa carpeta): regenera `css\tailwind.css`. Si agregaste un ícono nuevo, ejecutá **`construir-iconos.bat`**. Necesitan Node.js e internet en TU PC. Si solo cambiaste textos o lógica, no hace falta ninguno.
3. **Subí el número `APP_VERSION`** en `js\version.js` (por ejemplo de `'1.2.0'` a `'1.2.1'`). Es **obligatorio**: la app guarda sus archivos para abrir al instante y solo baja los nuevos cuando ese número cambia.
4. Subir a GitHub (en una terminal dentro de esa carpeta):
   ```
   git add -A
   git commit -m "Descripción corta del cambio"
   git push
   ```
5. Esperá 1 o 2 minutos (GitHub publica solo).
6. En las PCs instaladas se actualiza solo: al abrir la app toma los archivos nuevos, y si la tienen abierta todo el día aparece una barra verde **"Hay una versión nueva — tocá acá para actualizar"** en menos de 30 minutos.

> Si preferís no usar la terminal: pedile a Claude que haga el commit y el push.

## D2. Actualizar el servidor (`Codigo.gs`) — cliente por cliente

Solo hace falta cuando cambia algo de `gs/Codigo.gs`. La app te avisa con una **franja amarilla**: *"El servidor de esta planilla está desactualizado"*.

1. Abrí el Apps Script de **esa** planilla (con la sesión del cliente, o que te la comparta como Editor).
2. Reemplazá todo por el `Codigo.gs` nuevo → `Ctrl+S`.
3. Ejecutá `configurarSistema` (no borra datos).
4. **Implementar → Administrar implementaciones → ✏️ (editar) → Versión: Nueva versión → Implementar.** La URL no cambia.
5. Recargá la app: la franja amarilla desaparece.

Cuando cambies el servidor de forma que la app vieja ya no sirva, subí `VERSION_SERVIDOR` en `gs\Codigo.gs` y `SERVIDOR_MINIMO` en `js\version.js` (así la app avisa sola).

## D3. Actualizar la plantilla

Cada vez que cambies `Codigo.gs`: repetí A3 y A4 en la plantilla (y A5 si quedaron datos), para que los clientes nuevos arranquen con la última versión.

---

# PARTE E — Problemas frecuentes

| Qué ves | Qué significa | Qué hacer |
|---|---|---|
| "No se pudo conectar" y no carga nada | Sin internet, o el link `/exec` está mal | Revisar internet. Si persiste: ¿la implementación quedó en **Cualquier usuario**? ¿el link es el de la **Aplicación web** (termina en `/exec`)? |
| Pantalla "Conectar con la planilla" | Se abrió la app sin el link de instalación | Pegar el link `/exec` completo, o abrir de nuevo el link de instalación |
| Franja amarilla "servidor desactualizado" | La planilla tiene un `Codigo.gs` más viejo que el que pide la app | Parte D2 |
| Franja amarilla "N datos para revisar" | Alguien tocó la planilla y quedó un dato mal (precio con texto, producto repetido, ID repetido) | Tocá **Ver**, corregí en la hoja Productos |
| Un producto dice "Revisar datos" y no se puede vender | Precio, costo o stock con formato inválido | Corregir ese dato en la hoja Productos |
| No aparece el menú 🧾 Stock Lite | La planilla no terminó de cargar | Recargar (`F5`). Si sigue: Apps Script → ejecutar `onOpen` |
| "Google no verificó esta aplicación" | Normal: el script es de ella y no pasó por revisión de Google | Avanzado → Ir a… → Permitir |
| No aparece el botón de instalar | Navegador viejo, o se abrió desde un archivo local | Usar Chrome/Edge actualizados, abrir el link `https://…github.io…`; probar menú ⋮ |
| Barra verde "Hay una versión nueva" | Se publicó una actualización de la app | Tocarla |
| La primera venta del día tarda 3 a 5 segundos | Google "despierta" el servidor | Normal; las siguientes son rápidas |
| Se cortó la luz o se cerró en medio de una venta | — | Al reabrir, el ticket se recupera solo. Mirá en **Ventas** si ya se había guardado antes de reintentar |

---

# PARTE F — Equipos viejos: netbook con Windows 7 de 32 bits (caso Positivo BGH / Conectar Igualdad)

Ficha de la netbook de la primera clienta: Intel Atom N2600 1,6 GHz · 2 GB de RAM · disco Toshiba de 320 GB · Windows 7 MiniOS Pro (32 bits) · pantalla chica (típicamente 1024×600).

## F1. Lo primero: sin internet NO funciona

Las ventas se guardan en la planilla de Google, así que la netbook **necesita internet siempre** (cable o Wi-Fi). Una vez que tenga conexión, la app y el sistema se actualizan solos: **no hace falta pendrive para el sistema**. El pendrive solo sirve para los drivers de red, si hace falta.

## F2. Conseguir internet si faltan los drivers de red

Orden de lo más rápido a lo más lento:

1. **Administrador de dispositivos** (clic derecho en *Equipo* → Administrar → Administrador de dispositivos): fijate qué tiene el triángulo amarillo y anotá el modelo del adaptador (Propiedades → Detalles → *Id. de hardware*).
2. **Celular como módem por cable USB** (sin pendrive): en el celular, *Módem USB / Anclaje USB*. En Windows 7 a veces no lo reconoce solo: Administrador de dispositivos → el dispositivo "RNDIS" desconocido → *Actualizar controlador → Buscar software en el equipo → Elegir de una lista → Adaptadores de red → Microsoft → Remote NDIS based Internet Sharing Device*. Probá otro cable y un puerto USB 2.0.
3. **Driver LAN desde otra PC con pendrive:** buscalo en el sitio del fabricante por **marca y modelo de la netbook** (etiqueta de abajo) o por el Id. de hardware, versión **Windows 7 de 32 bits**. Copialo al pendrive y ejecutalo en la netbook.
4. **Automático:** *Snappy Driver Installer Origin* (sitio oficial https://www.snappy-driver-installer.org o SourceForge). En una PC con internet bajás el programa y los paquetes (los de red alcanzan) a una carpeta del pendrive; en la netbook lo ejecutás y detecta e instala lo que falta. **Solo desde el sitio oficial** (hay clones con virus).
5. Con internet ya andando: drivers de video (Intel GMA 3600, Windows 7 **32 bits**) y Wi-Fi. Evitá instaladores "automáticos" con publicidad; si usás Driver Booster, destildá todo lo opcional y no actualices drivers que ya funcionan.

> Tip para la próxima vez que formatees un equipo: *antes* de formatear, guardá los drivers con `dism /online /export-driver /destination:D:\Drivers` (D: = pendrive) y después de formatear instalalos con `pnputil /add-driver D:\Drivers\*.inf /subdirs /install`.

## F3. Navegador en Windows 7

- La última versión de **Chrome y Edge que funciona en Windows 7 es la 109** (el instalador oficial de Chrome instala esa en Windows 7). **No se va a actualizar más**: usá la netbook solo para el sistema (no para navegar por cualquier sitio).
- Lo comprobé: el código del sistema no usa nada más nuevo que Chrome 109, y el CSS va **precompilado** (css/tailwind.css) para no cargar de trabajo a un Atom con 2 GB. Lo que NO pude probar es esa netbook en sí: probala antes de dar el trabajo por terminado.
- **Fecha y hora correctas:** con la fecha mal (pila de la BIOS agotada) los sitios seguros fallan. Poné la hora y "Sincronizar con un servidor de hora de Internet".
- **Si no aparece "Instalar":** hacé un acceso directo en el escritorio (clic derecho → Nuevo → Acceso directo) con este destino y nombralo "Stock Lite":
  ```
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=https://pachilazarte.github.io/facundo-sistemadestock-monicab/?c=ID_DEL_SCRIPT
  ```
  Abre la app en su propia ventana, sin barra del navegador. La primera vez usa el `?c=ID`; después el equipo ya lo recuerda.

## F4. Pantalla chica y poca memoria

- La app se adapta sola a 1024×600: el menú lateral queda en íconos y el ticket se compacta para que **Cobrar** siempre se vea.
- Si querés ver más cosas a la vez: `Ctrl` y `-` (zoom 90%).
- Con 2 GB: dejá abierta solo la app, sin otras pestañas ni programas pesados.

---

# Checklist final (para imprimir)

**Antes de ir**
- [ ] Plantilla armada y probada (Parte A)
- [ ] Link de copia y link del sitio a mano

**En la PC del cliente**
- [ ] Sesión iniciada con SU Gmail (la inició ella)
- [ ] Copia hecha de la plantilla y renombrada
- [ ] Menú 🧾 Stock Lite visible → *Configurar / reparar sistema* → "Sistema listo"
- [ ] Config B2 con el nombre del negocio
- [ ] Implementado como aplicación web (Yo / Cualquier usuario) y URL `/exec` copiada
- [ ] Respaldo diario activado
- [ ] Link de instalación armado con el ID
- [ ] App instalada, ícono en el escritorio, abre sola con el nombre del negocio
- [ ] Venta de prueba, fiado de prueba y anulación OK
- [ ] `reiniciarParaEntrega` ejecutada (todo en cero)
- [ ] Productos reales cargados
- [ ] Capacitación de 10 minutos hecha
- [ ] Ficha del cliente guardada en lugar privado

---

# Anexo — Ficha del cliente (copiá y completá, en un lugar PRIVADO)

```
Cliente:                 ____________________
Mail de la cuenta Google: ____________________
Fecha de instalación:    ____ / ____ / ______
Link /exec:              ____________________________________________
Link de instalación:     https://pachilazarte.github.io/facundo-sistemadestock-monicab/?c=__________
Versión app instalada:   1.0.0
Versión servidor:        2
Respaldo diario:         [ ] activado
Notas:                   ____________________
```

> El link `/exec` es la llave de acceso a esa planilla: guardalo solo acá, nunca en el repositorio ni en el código.
