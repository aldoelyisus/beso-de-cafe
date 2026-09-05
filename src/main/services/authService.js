'use strict';

const { getDb } = require('../db/connection');
const { verifyPassword } = require('../security/password');
const session = require('../security/session');
const permissionService = require('./permissionService');
const logService = require('./logService');
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
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(uname);

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

  const can = (key) => u.isSystem || u.permissions.has(key);
  const menu = permissionService
    .menuTree()
    .map((m) => ({
      ...m,
      submodules: m.submodules.filter((s) => !s.requires || can(s.requires)),
    }))
    .filter((m) => can(m.requires));

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

module.exports = { login, logout, currentSession };
