'use strict';

/**
 * Ayudante para probar la capa IPC de verdad (validación de sesión y permisos
 * de `handle()`, bitácora incluida) sin levantar una ventana de Electron.
 *
 * Sustituye el módulo `electron` por un doble que captura los handlers que
 * registra `registerIpc()`; a partir de ahí `call(canal, payload)` hace lo
 * mismo que el renderer a través del preload y devuelve `{ok, data|error}`.
 *
 * IMPORTANTE: este archivo debe requerirse ANTES que `src/main/ipc`.
 */
const Module = require('module');

const handlers = new Map();
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'electron') {
    return {
      ipcMain: { handle: (canal, fn) => handlers.set(canal, fn) },
      app: undefined,          // no se usa: BESO_DB_PATH manda en las pruebas
      BrowserWindow: class {},
    };
  }
  return origLoad.call(this, request, ...rest);
};

const session = require('../../src/main/security/session');
const { registerIpc } = require('../../src/main/ipc');

registerIpc();

/** Invoca un canal IPC igual que lo haría la interfaz. */
function call(canal, payload) {
  const fn = handlers.get(canal);
  if (!fn) throw new Error(`El canal "${canal}" no existe.`);
  return fn({}, payload || {});
}

/** Invoca y devuelve los datos; lanza si el canal respondió con error. */
async function callOk(canal, payload) {
  const r = await call(canal, payload);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

/** Entra al sistema con usuario y contraseña (deja la sesión abierta). */
async function entrar(username, password) {
  session.clear();
  return callOk('auth:login', { username, password });
}

module.exports = { call, callOk, entrar, handlers, session };
