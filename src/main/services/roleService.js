'use strict';

const { getDb } = require('../db/connection');

function listRoles() {
  const db = getDb();
  const roles = db
    .prepare(
      `SELECT r.id, r.name, r.description, r.is_system, r.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
       FROM roles r
       ORDER BY r.name`
    )
    .all();
  return roles;
}

function getRole(id) {
  const db = getDb();
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  if (!role) return null;
  role.permissions = db
    .prepare('SELECT permission_key FROM role_permissions WHERE role_id = ?')
    .all(id)
    .map((r) => r.permission_key);
  return role;
}

function createRole({ name, description = '', permissions = [] }) {
  const db = getDb();
  name = String(name || '').trim();
  if (!name) throw new Error('El nombre del rol es obligatorio.');

  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO roles (name, description) VALUES (?, ?)')
      .run(name, String(description || ''));
    const roleId = info.lastInsertRowid;
    setRolePermissions(roleId, permissions);
    return roleId;
  });

  try {
    return getRole(tx());
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Ya existe un rol con ese nombre.');
    throw e;
  }
}

/**
 * Actualiza nombre, descripción y plantilla de permisos del rol.
 * IMPORTANTE: cambiar los permisos aquí NO modifica a los usuarios ya creados.
 * Solo afecta a los usuarios que se creen a partir de ahora con este rol.
 */
function updateRole(id, { name, description, permissions }) {
  const db = getDb();
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  if (!role) throw new Error('El rol no existe.');
  if (role.is_system) throw new Error('El rol del sistema no se puede modificar.');

  const tx = db.transaction(() => {
    if (name !== undefined || description !== undefined) {
      db.prepare(
        `UPDATE roles SET name = COALESCE(?, name), description = COALESCE(?, description),
         updated_at = datetime('now') WHERE id = ?`
      ).run(name != null ? String(name).trim() : null, description != null ? String(description) : null, id);
    }
    if (Array.isArray(permissions)) setRolePermissions(id, permissions);
  });

  try {
    tx();
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Ya existe un rol con ese nombre.');
    throw e;
  }
  return getRole(id);
}

function setRolePermissions(roleId, keys) {
  const db = getDb();
  db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO role_permissions (role_id, permission_key) VALUES (?, ?)'
  );
  for (const key of keys || []) insert.run(roleId, key);
}

function deleteRole(id) {
  const db = getDb();
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  if (!role) throw new Error('El rol no existe.');
  if (role.is_system) throw new Error('El rol del sistema no se puede eliminar.');
  const inUse = db.prepare('SELECT COUNT(*) c FROM users WHERE role_id = ?').get(id).c;
  if (inUse > 0) {
    throw new Error(
      `No se puede eliminar: ${inUse} usuario(s) tienen este rol. Reasigna esos usuarios primero.`
    );
  }
  db.prepare('DELETE FROM roles WHERE id = ?').run(id);
  return { ok: true };
}

module.exports = { listRoles, getRole, createRole, updateRole, deleteRole };
