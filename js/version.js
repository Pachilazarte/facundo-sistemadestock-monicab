/* ÚNICO lugar donde se sube la versión. Lo leen: la app (avisos), el service worker (caché) y el chequeo de actualizaciones.
 * Al publicar cambios en GitHub: subí APP_VERSION y listo, los equipos instalados se actualizan solos. */
const APP_VERSION = '1.5.2';
const SERVIDOR_MINIMO = 2;   // versión mínima de gs/Codigo.gs que esta app necesita (VERSION_SERVIDOR)
