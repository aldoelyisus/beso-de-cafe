'use strict';

const { getDb } = require('../db/connection');
const { verifyPassword } = require('../security/password');
const session = require('../security/session');
const permissionService = require('./permissionService');
const logService = require('./logService');
const { claveNombre } = require('./nombres');
const registry = require('../permissions/registry');

function buildSessionUser(row) {
  const isSystem = !!row.is_system;
  const permissions = isSystem
    ? registry.allPermissionKeys()
    : permissionService.effectiveKeysForUser(row.id);
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    isSystem,
    permissions,
  };
}

function login(username, password) {
  const db = getDb();
  const uname = String(username || '').trim();
  // Quien se dio de alta como "Lupita" entra tecleando "lupita" o "LUPITA".
  // Se compara con la misma regla que usa el alta (ver `nombres.js`), que sí
  // pliega acentos —COLLATE NOCASE de SQLite solo entiende el alfabeto ASCII—.
  const clave = claveNombre(uname);
  const row = db.prepare('SELECT * FROM users').all().find((u) => claveNombre(u.username) === clave);

  if (!row || !verifyPassword(String(password || ''), row.password_hash)) {
    logService.writeLog({
      userId: row ? row.id : null,
      username: uname || '(vacío)',
      action: 'auth.login.failed',
      detail: 'Usuario o contraseña incorrectos',
    });
    throw new Error('Usuario o contraseña incorrectos.');
  }
  if (!row.is_active) {
    logService.writeLog({
      userId: row.id,
      username: row.username,
      action: 'auth.login.failed',
      detail: 'Usuario desactivado',
    });
    throw new Error('Este usuario está desactivado. Contacta a un administrador.');
  }

  const sessionUser = buildSessionUser(row);
  session.setCurrentUser(sessionUser);

  logService.writeLog({
    userId: row.id,
    username: row.username,
    action: 'auth.login.success',
    detail: '',
  });

  return currentSession();
}

/**
 * ¿El usuario de la sesión abierta sigue activo en la base?
 * Se consulta en cada llamada del IPC: si a alguien lo desactivan mientras
 * tiene la sesión abierta, deja de poder operar en ese momento.
 */
function sessionUserStillActive() {
  const u = session.getCurrentUser();
  if (!u) return false;
  const row = getDb().prepare('SELECT is_active FROM users WHERE id = ?').get(u.id);
  return !!(row && row.is_active);
}

function logout() {
  const u = session.getCurrentUser();
  if (u) {
    logService.writeLog({ userId: u.id, username: u.username, action: 'auth.logout', detail: '' });
  }
  session.clear();
  return { ok: true };
}

/** Estado que necesita el renderer: usuario, permisos y árbol de menú ya filtrado. */
function currentSession() {
  const u = session.getCurrentUser();
  if (!u) return { authenticated: false };
  // Si lo desactivaron mientras la app estaba abierta, la sesión ya no vale.
  if (!sessionUserStillActive()) {
    session.clear();
    return { authenticated: false };
  }

  const can = (key) => u.isSystem || u.permissions.has(key);
  // Un grupo del menú se muestra si el usuario puede entrar a alguno de sus
  // submódulos. Antes exigía además el permiso del propio grupo, así que quien
  // tenía "insumos.view" pero no "inventory.view" no veía Inventario por ningún
  // lado, sin manera de adivinar qué le faltaba.
  const menu = permissionService
    .menuTree()
    .map((m) => ({
      ...m,
      submodules: m.submodules.filter((s) => !s.requires || can(s.requires)),
    }))
    .filter((m) => (m.submodules.length ? true : !!m.requires && can(m.requires)))
    // El grupo apunta a su primer destino visible, no a uno que el usuario no pueda abrir.
    .map((m) => (m.submodules.length ? { ...m, route: m.submodules[0].route } : m));

  return {
    authenticated: true,
    user: {
      id: u.id,
      name: u.name,
      username: u.username,
      isSystem: u.isSystem,
    },
    permissions: [...u.permissions],
    menu,
  };
}

module.exports = { login, logout, currentSession, sessionUserStillActive };
