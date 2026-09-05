'use strict';

/**
 * Descubre y ejecuta los archivos *.test.js dentro de /test.
 * Se corre bajo el runtime de Electron (ver scripts/test.js) para que
 * better-sqlite3 cargue con el ABI correcto.
 */
const fs = require('fs');
const path = require('path');
require('node:test'); // registra el runner automático

const TEST_DIR = path.join(__dirname, '..', 'test');

function encontrar(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) encontrar(p, acc);
    else if (e.name.endsWith('.test.js')) acc.push(p);
  }
  return acc;
}

const archivos = encontrar(TEST_DIR).sort();
if (!archivos.length) {
  console.error('No se encontraron archivos *.test.js en /test');
  process.exit(1);
}
console.log(`Ejecutando ${archivos.length} archivo(s) de prueba…\n`);
for (const f of archivos) require(f);
// node:test corre las pruebas registradas al terminar y ajusta process.exitCode.
