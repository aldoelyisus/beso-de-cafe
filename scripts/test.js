'use strict';

/**
 * Lanza las pruebas unitarias bajo el runtime de Electron en modo Node
 * (ELECTRON_RUN_AS_NODE=1), porque better-sqlite3 está compilado para el ABI
 * de Electron y no carga con `node` a secas.
 *
 *   npm test
 */
const { spawnSync } = require('child_process');
const path = require('path');
const electron = require('electron'); // en contexto Node, exporta la ruta al binario

const res = spawnSync(
  electron,
  ['--test-reporter=spec', path.join(__dirname, 'run-tests.js')],
  { stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
);

process.exit(res.status == null ? 1 : res.status);
