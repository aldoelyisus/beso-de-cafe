'use strict';

/**
 * Arma un archivo de actualización para mandarlo a la cafetería.
 *
 *   node scripts/crear-actualizacion.js <desde> "Qué arregla"
 *
 *   <desde>  una referencia de git: HEAD~1, un commit, una etiqueta…
 *            Se incluyen los archivos de `src/` que cambiaron desde ahí.
 *
 * Ejemplos:
 *   node scripts/crear-actualizacion.js HEAD~1 "Arregla el botón de cerrar caja"
 *   node scripts/crear-actualizacion.js v0.1.1 "Varios arreglos del punto de venta"
 *
 * Deja el archivo en `actualizaciones/` listo para mandar por WhatsApp.
 * Del otro lado: Administración → Actualizar el programa → abrir el archivo.
 *
 * ANTES DE MANDARLO: corre `npm test` y prueba la app. Este archivo reemplaza
 * código en una computadora a la que no puedes ir: lo que mandes, eso corre.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'actualizaciones');

const [, , desde, ...resto] = process.argv;
const descripcion = resto.join(' ').trim();

if (!desde) {
  console.error('Falta desde qué punto comparar.\n');
  console.error('  node scripts/crear-actualizacion.js HEAD~1 "Arregla el botón de cerrar caja"');
  process.exit(1);
}
if (!descripcion) {
  console.error('Falta la descripción: es lo que va a leer la dueña antes de aplicarla.\n');
  console.error('  node scripts/crear-actualizacion.js HEAD~1 "Arregla el botón de cerrar caja"');
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();

let cambiados;
try {
  cambiados = git('diff', '--name-only', `${desde}..HEAD`)
    .split('\n').map((s) => s.trim()).filter(Boolean);
} catch (e) {
  console.error(`No se pudo comparar contra "${desde}": ${e.message}`);
  process.exit(1);
}

// Solo viaja el código que el programa instalado usa. Las pruebas, los
// manuales y los scripts no van: no hacen falta allá y hacen el archivo más
// pesado de lo necesario para WhatsApp.
const incluidos = cambiados.filter((f) => f.startsWith('src/') || f === 'package.json');
const descartados = cambiados.filter((f) => !incluidos.includes(f));

if (!incluidos.length) {
  console.error(`No hay cambios de código (src/) entre ${desde} y HEAD. No hay nada que mandar.`);
  process.exit(1);
}

const faltantes = incluidos.filter((f) => !fs.existsSync(path.join(RAIZ, f)));
if (faltantes.length) {
  console.error('Estos archivos se borraron y una actualización no sabe borrar archivos:');
  faltantes.forEach((f) => console.error(`  · ${f}`));
  console.error('\nEse cambio necesita reinstalar el programa.');
  process.exit(1);
}

const version = require(path.join(RAIZ, 'package.json')).version;
const archivos = {};
for (const rel of incluidos) {
  const contenido = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  archivos[rel] = { sha256: crypto.createHash('sha256').update(contenido, 'utf8').digest('hex'), contenido };
}

const paquete = { formato: 1, version, descripcion, creado: new Date().toISOString(), archivos };

fs.mkdirSync(SALIDA, { recursive: true });
const sello = new Date().toISOString().slice(0, 10);
const destino = path.join(SALIDA, `beso-actualizacion-${version}-${sello}.json`);
fs.writeFileSync(destino, JSON.stringify(paquete, null, 2), 'utf8');

const kb = (fs.statSync(destino).size / 1024).toFixed(0);
console.log(`\n✔ Actualización lista: ${path.relative(RAIZ, destino)}  (${kb} KB)`);
console.log(`  versión     : ${version}`);
console.log(`  descripción : ${descripcion}`);
console.log(`  archivos    : ${incluidos.length}`);
incluidos.forEach((f) => console.log(`                · ${f}`));
if (descartados.length) {
  console.log(`\n  (no viajan, por no ser código del programa: ${descartados.length} archivo/s)`);
}
if (incluidos.some((f) => f.startsWith('src/main/db/migrations/'))) {
  console.log('\n  ⚠ Trae migraciones: la base se actualiza sola al reiniciar, sin borrar nada.');
}
console.log('\nMándalo por WhatsApp. Allá: Administración → Actualizar el programa.');
console.log('Antes de mandarlo, corre `npm test` y pruébalo.\n');
