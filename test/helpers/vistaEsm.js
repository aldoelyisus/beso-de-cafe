'use strict';

/**
 * `src/renderer/` son módulos ES nativos (import/export), cargados en la app
 * real por `<script type="module">`. El proyecto es CommonJS (sin "type":
 * "module" en package.json), así que Node no los puede `import()` tal cual
 * están: se copian una vez a una carpeta temporal con su propio
 * package.json `{"type":"module"}`, y desde ahí sí.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');

const PROY = path.join(__dirname, '..', '..');
const ESM_DIR = path.join(os.tmpdir(), `beso-test-renderer-esm-${process.pid}`);
let copiado = false;

function asegurarCopia() {
  if (copiado) return;
  fs.rmSync(ESM_DIR, { recursive: true, force: true });
  fs.cpSync(path.join(PROY, 'src/renderer'), ESM_DIR, { recursive: true });
  fs.writeFileSync(path.join(ESM_DIR, 'package.json'), '{"type":"module"}');
  copiado = true;
  process.on('exit', () => { try { fs.rmSync(ESM_DIR, { recursive: true, force: true }); } catch { /* ya no está */ } });
}

/** Importa un módulo de `src/renderer/` por su ruta relativa, ej. "views/users.js". */
function cargarVista(relPath) {
  asegurarCopia();
  return import(pathToFileURL(path.join(ESM_DIR, relPath)).href);
}

module.exports = { cargarVista };
