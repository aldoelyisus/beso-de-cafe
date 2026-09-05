'use strict';

const { getDb } = require('../db/connection');
const registry = require('../permissions/registry');

/** Catálogo de permisos tal como está en la base (sincronizado desde el registro de código). */
function listPermissions() {
  return getDb()
    .prepare('SELECT key, module, action, label FROM permissions ORDER BY module, action')
    .all();
}

/** Permisos agrupados por módulo, para pintar listas de checkboxes. */
function listPermissionsGrouped() {
  const rows = listPermissions();
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.module)) {
      const mod = registry.MODULES.find((m) => m.key === r.module);
      groups.set(r.module, { module: r.module, label: mod ? mod.label : r.module, items: [] });
    }
    groups.get(r.module).items.push(r);
  }
  return [...groups.values()];
}

/** Claves de permiso efectivas de un usuario (heredadas del rol + manuales). */
function effectiveKeysForUser(userId) {
  return getDb()
    .prepare('SELECT permission_key FROM user_permissions WHERE user_id = ?')
    .all(userId)
    .map((r) => r.permission_key);
}

/** El árbol de menú (estructura) vive en código. */
function menuTree() {
  return registry.menuTree();
}

module.exports = {
  listPermissions,
  listPermissionsGrouped,
  effectiveKeysForUser,
  menuTree,
};
