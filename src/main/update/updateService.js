'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

/**
 * Actualización a distancia, sin servidor (FASE 13).
 *
 * La cafetería está lejos. Si reportan un fallo, hay que poder mandarles el
 * arreglo HOY sin ir, sin reinstalar y sin tocar sus datos. Un archivo de
 * actualización es un JSON con los archivos de código ya corregidos:
 * llega por WhatsApp o en una USB, la dueña lo abre desde la pantalla
 * "Actualizar", y listo.
 *
 * Por qué un JSON y no un .zip: no hace falta ninguna librería para leerlo
 * (el proyecto no tiene dependencias fuera de SQLite), se puede abrir y
 * revisar con el Bloc de notas, y viaja bien por WhatsApp.
 *
 *   {
 *     "formato": 1,
 *     "version": "0.1.2",
 *     "descripcion": "Arregla el botón de cerrar caja",
 *     "creado": "2026-10-15T18:00:00.000Z",
 *     "archivos": {
 *       "src/renderer/views/caja.js": { "sha256": "…", "contenido": "…" }
 *     }
 *   }
 *
 * LO QUE ESTE MÓDULO NO TOCA: la base de datos. El código vive en la carpeta
 * del programa y los datos en la del usuario — son carpetas distintas, así
 * que reemplazar el código jamás puede borrar una venta. Si la actualización
 * trae migraciones nuevas, corren solas al reiniciar y son aditivas.
 */

const FORMATO = 1;
const MAX_RESPALDOS = 5;

// Las rutas se pueden forzar por variable de entorno, igual que BESO_DB_PATH
// en db/connection.js: así las pruebas corren contra carpetas de mentiras y
// nunca contra el código de verdad.

/** Raíz del código instalado: …/resources/app (o el proyecto, en desarrollo). */
function raizApp() {
  return process.env.BESO_APP_PATH || app.getAppPath();
}
function carpetaDatos() {
  return process.env.BESO_DATOS_PATH || app.getPath('userData');
}

/** Dónde van las copias del código. `crear` solo cuando de verdad se va a escribir. */
function carpetaRespaldos({ crear = false } = {}) {
  const dir = path.join(carpetaDatos(), 'respaldos-codigo');
  if (crear) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Las copias que hay, de la más nueva a la más vieja. Nunca crea nada. */
function copiasGuardadas() {
  try {
    const dir = carpetaRespaldos();
    return fs.readdirSync(dir)
      .filter((n) => fs.statSync(path.join(dir, n)).isDirectory())
      .sort().reverse();
  } catch { return []; }
}
function archivoHistorial() { return path.join(carpetaDatos(), 'actualizaciones.json'); }

const sha256 = (texto) => crypto.createHash('sha256').update(texto, 'utf8').digest('hex');

function historial() {
  try { return JSON.parse(fs.readFileSync(archivoHistorial(), 'utf8')); }
  catch { return []; }
}
function anotarEnHistorial(entrada) {
  const h = historial();
  h.unshift(entrada);
  fs.writeFileSync(archivoHistorial(), JSON.stringify(h.slice(0, 50), null, 2), 'utf8');
}

/**
 * Rutas permitidas dentro del paquete. Solo código: nada de salirse de la
 * carpeta del programa ni escribir donde viven los datos.
 */
function rutaSegura(rel) {
  if (typeof rel !== 'string' || !rel.trim()) return null;
  const limpia = rel.replace(/\\/g, '/').trim();
  if (limpia.startsWith('/') || /^[a-zA-Z]:/.test(limpia)) return null; // absoluta
  if (limpia.split('/').includes('..')) return null;                    // sale de la carpeta
  if (limpia !== 'package.json' && !limpia.startsWith('src/')) return null;
  return limpia;
}

/**
 * Lee y revisa un archivo de actualización SIN aplicar nada, para poder
 * enseñar qué trae antes de tocar el programa.
 */
function leerActualizacion(rutaArchivo) {
  let crudo;
  try { crudo = fs.readFileSync(rutaArchivo, 'utf8'); }
  catch { throw new Error('No se pudo leer el archivo. ¿Sigue ahí?'); }

  let datos;
  try { datos = JSON.parse(crudo); }
  catch { throw new Error('Ese archivo no es una actualización de Beso de Café (no se entiende su contenido).'); }

  if (!datos || datos.formato !== FORMATO) {
    throw new Error('Ese archivo no es una actualización de Beso de Café, o es de una versión más nueva del programa.');
  }
  if (!datos.version || typeof datos.version !== 'string') throw new Error('A la actualización le falta la versión.');
  const archivos = datos.archivos && typeof datos.archivos === 'object' ? datos.archivos : null;
  const rutas = archivos ? Object.keys(archivos) : [];
  if (!rutas.length) throw new Error('La actualización no trae ningún archivo.');

  for (const rel of rutas) {
    if (!rutaSegura(rel)) throw new Error(`La actualización quiere escribir en un lugar no permitido: ${rel}`);
    const a = archivos[rel];
    if (!a || typeof a.contenido !== 'string') throw new Error(`El archivo "${rel}" viene vacío o dañado.`);
    // El sha confirma que no se corrompió en el camino (WhatsApp, USB, correo).
    if (a.sha256 && sha256(a.contenido) !== a.sha256) {
      throw new Error(`El archivo "${rel}" llegó incompleto o dañado. Pide que te lo manden otra vez.`);
    }
  }

  return {
    version: datos.version,
    descripcion: String(datos.descripcion || ''),
    creado: datos.creado || null,
    archivos: rutas,
    ruta: rutaArchivo,
  };
}

/** Copia a la carpeta de respaldos los archivos que la actualización va a pisar. */
function respaldarAntes(raiz, rutas) {
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const destino = path.join(carpetaRespaldos({ crear: true }), sello);
  try {
    for (const rel of rutas) {
      const origen = path.join(raiz, rel);
      // Lo que no sea un archivo normal (no existe, o es una carpeta) no se
      // respalda: o es un archivo nuevo que trae la actualización, o es algo
      // raro que de todos modos la escritura va a rechazar.
      let st = null;
      try { st = fs.statSync(origen); } catch { st = null; }
      if (!st || !st.isFile()) continue;
      const final = path.join(destino, rel);
      fs.mkdirSync(path.dirname(final), { recursive: true });
      fs.copyFileSync(origen, final);
    }
    fs.mkdirSync(destino, { recursive: true });
    fs.writeFileSync(path.join(destino, 'archivos.json'), JSON.stringify(rutas, null, 2), 'utf8');
  } catch (e) {
    throw new Error(`No se pudo guardar una copia del programa actual, así que no se aplicó nada (${e.message}).`);
  }
  podarRespaldos();
  return destino;
}

function podarRespaldos() {
  const dir = carpetaRespaldos();
  const sobran = copiasGuardadas().slice(MAX_RESPALDOS);
  for (const n of sobran) {
    try { fs.rmSync(path.join(dir, n), { recursive: true, force: true }); } catch { /* ya no está */ }
  }
}

/**
 * Aplica la actualización. Si algo falla a media escritura, deshace lo que
 * alcanzó a escribir: el programa nunca queda mitad viejo y mitad nuevo.
 */
function aplicar(rutaArchivo, { raiz = raizApp() } = {}) {
  const info = leerActualizacion(rutaArchivo);
  const datos = JSON.parse(fs.readFileSync(rutaArchivo, 'utf8'));
  const respaldo = respaldarAntes(raiz, info.archivos);

  const escritos = [];
  try {
    for (const rel of info.archivos) {
      const destino = path.join(raiz, rel);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, datos.archivos[rel].contenido, 'utf8');
      escritos.push(rel);
    }
  } catch (e) {
    // Deshacer: devolver cada archivo escrito a como estaba.
    for (const rel of escritos) {
      const copia = path.join(respaldo, rel);
      try {
        if (fs.existsSync(copia)) fs.copyFileSync(copia, path.join(raiz, rel));
        else fs.rmSync(path.join(raiz, rel), { force: true }); // era nuevo: se quita
      } catch { /* mejor esfuerzo */ }
    }
    throw new Error(`No se pudo aplicar la actualización: ${e.message}. El programa quedó como estaba.`);
  }

  anotarEnHistorial({
    version: info.version,
    descripcion: info.descripcion,
    archivos: info.archivos.length,
    aplicado_en: new Date().toISOString(),
    respaldo: path.basename(respaldo),
  });
  return { ...info, respaldo: path.basename(respaldo) };
}

/** Deshace la última actualización, dejando el código como estaba antes. */
function revertir({ raiz = raizApp() } = {}) {
  const dir = carpetaRespaldos();
  const copias = copiasGuardadas();
  if (!copias.length) throw new Error('No hay ninguna actualización que deshacer.');

  const ultima = path.join(dir, copias[0]);
  let rutas;
  try { rutas = JSON.parse(fs.readFileSync(path.join(ultima, 'archivos.json'), 'utf8')); }
  catch { throw new Error('El respaldo de la última actualización está dañado.'); }

  for (const rel of rutas) {
    const copia = path.join(ultima, rel);
    const destino = path.join(raiz, rel);
    try {
      if (fs.existsSync(copia)) { fs.mkdirSync(path.dirname(destino), { recursive: true }); fs.copyFileSync(copia, destino); }
      else fs.rmSync(destino, { force: true }); // el archivo no existía antes
    } catch (e) { throw new Error(`No se pudo restaurar "${rel}": ${e.message}`); }
  }
  fs.rmSync(ultima, { recursive: true, force: true });
  anotarEnHistorial({
    version: '(deshecha)',
    descripcion: `Se deshizo la actualización ${copias[0]}`,
    archivos: rutas.length,
    aplicado_en: new Date().toISOString(),
  });
  return { archivos: rutas.length };
}

function estado() {
  return {
    version: app && app.getVersion ? app.getVersion() : require('../../../package.json').version,
    // En desarrollo la "carpeta del programa" es el repositorio: aplicar una
    // actualización ahí pisaría el código fuente de verdad.
    instalada: !!(app && app.isPackaged),
    sePuedeDeshacer: copiasGuardadas().length > 0,
    historial: historial().slice(0, 10),
  };
}

module.exports = { FORMATO, leerActualizacion, aplicar, revertir, estado, historial, rutaSegura, sha256 };
