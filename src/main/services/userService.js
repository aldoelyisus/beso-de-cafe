'use strict';

const { getDb } = require('../db/connection');
const { hashPassword } = require('../security/password');
const { buscarChoque } = require('./nombres');

const PUBLIC_COLUMNS = `
  u.id, u.name, u.username, u.role_id, u.phone,
  u.emergency_contact_name, u.emergency_contact_phone,
  u.is_active, u.created_at, u.updated_at,
  r.name AS role_name
`;

/**
 * Lista de usuarios. Nunca incluye al usuario interno del sistema (is_system = 1).
 * Los usuarios "eliminados" siguen apareciendo con is_active = 0 (Desactivado),
 * para no perder la relación con sus ventas.
 */
function listUsers({ includeInactive = true } = {}) {
  const db = getDb();
  const where = ['u.is_system = 0'];
  if (!includeInactive) where.push('u.is_active = 1');
  return db
    .prepare(
      `SELECT ${PUBLIC_COLUMNS}
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE ${where.join(' AND ')}
       ORDER BY u.is_active DESC, u.name`
    )
    .all();
}

function getUser(id) {
  const db = getDb();
  const user = db
    .prepare(
      `SELECT ${PUBLIC_COLUMNS}
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.is_system = 0`
    )
    .get(id);
  if (!user) return null;
  user.permissions = db
    .prepare('SELECT permission_key, from_role FROM user_permissions WHERE user_id = ?')
    .all(id);
  return user;
}

/**
 * El nombre de usuario es único "como lo lee una persona": "Lupita", "LUPITA" y
 * "lupita" son la misma cuenta (ver `nombres.js`; migración 013 es la red).
 */
function assertUsernameFree(db, username, exceptId = null) {
  const filas = db.prepare('SELECT id, username AS nombre FROM users').all();
  if (buscarChoque(filas, username, exceptId)) {
    throw new Error('Ese nombre de usuario ya está en uso.');
  }
}

function copyRolePermissions(db, userId, roleId) {
  if (!roleId) return;
  const perms = db
    .prepare('SELECT permission_key FROM role_permissions WHERE role_id = ?')
    .all(roleId);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO user_permissions (user_id, permission_key, from_role) VALUES (?, ?, 1)'
  );
  for (const p of perms) insert.run(userId, p.permission_key);
}

/**
 * Crea un usuario. En este momento se toma una "foto" de los permisos del rol
 * y se copian al usuario. A partir de aquí el usuario es independiente del rol.
 */
function createUser(data) {
  const db = getDb();
  const name = String(data.name || '').trim();
  const username = String(data.username || '').trim();
  const password = String(data.password || '');
  if (!name) throw new Error('El nombre es obligatorio.');
  if (!username) throw new Error('El nombre de usuario es obligatorio.');
  if (password.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.');

  const roleId = data.roleId ? Number(data.roleId) : null;

  const tx = db.transaction(() => {
    assertUsernameFree(db, username);
    const info = db
      .prepare(
        `INSERT INTO users
          (name, username, password_hash, role_id, phone,
           emergency_contact_name, emergency_contact_phone)
         VALUES (@name, @username, @hash, @roleId, @phone, @ecName, @ecPhone)`
      )
      .run({
        name,
        username,
        hash: hashPassword(password),
        roleId,
        phone: String(data.phone || ''),
        ecName: String(data.emergencyContactName || ''),
        ecPhone: String(data.emergencyContactPhone || ''),
      });
    const userId = info.lastInsertRowid;
    copyRolePermissions(db, userId, roleId);
    // Permisos individuales extra marcados al crear
    if (Array.isArray(data.extraPermissions)) {
      const ins = db.prepare(
        'INSERT OR IGNORE INTO user_permissions (user_id, permission_key, from_role) VALUES (?, ?, 0)'
      );
      for (const k of data.extraPermissions) ins.run(userId, k);
    }
    return userId;
  });

  return getUser(tx());
}

/** Edita datos generales (nombre, rol, área de personal). No toca la contraseña. */
function updateUser(id, data) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_system = 0').get(id);
  if (!user) throw new Error('El usuario no existe.');

  const roleChanged =
    data.roleId !== undefined && Number(data.roleId || 0) !== Number(user.role_id || 0);

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE users SET
        name = COALESCE(@name, name),
        role_id = @roleId,
        phone = COALESCE(@phone, phone),
        emergency_contact_name = COALESCE(@ecName, emergency_contact_name),
        emergency_contact_phone = COALESCE(@ecPhone, emergency_contact_phone),
        updated_at = datetime('now')
       WHERE id = @id`
    ).run({
      id,
      name: data.name != null ? String(data.name).trim() : null,
      roleId: data.roleId !== undefined ? (data.roleId ? Number(data.roleId) : null) : user.role_id,
      phone: data.phone != null ? String(data.phone) : null,
      ecName: data.emergencyContactName != null ? String(data.emergencyContactName) : null,
      ecPhone: data.emergencyContactPhone != null ? String(data.emergencyContactPhone) : null,
    });

    // Si se cambia el rol de forma explícita, se vuelve a tomar la foto de los
    // permisos heredados (from_role = 1); los permisos manuales (from_role = 0) se conservan.
    if (roleChanged) {
      db.prepare('DELETE FROM user_permissions WHERE user_id = ? AND from_role = 1').run(id);
      copyRolePermissions(db, id, data.roleId ? Number(data.roleId) : null);
    }
  });
  tx();
  return getUser(id);
}

function changeUsername(id, newUsername) {
  const db = getDb();
  newUsername = String(newUsername || '').trim();
  if (!newUsername) throw new Error('El nombre de usuario es obligatorio.');
  const user = db.prepare('SELECT id FROM users WHERE id = ? AND is_system = 0').get(id);
  if (!user) throw new Error('El usuario no existe.');
  assertUsernameFree(db, newUsername, id);
  db.prepare("UPDATE users SET username = ?, updated_at = datetime('now') WHERE id = ?").run(
    newUsername,
    id
  );
  return getUser(id);
}

function resetPassword(id, newPassword) {
  const db = getDb();
  newPassword = String(newPassword || '');
  if (newPassword.length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.');
  const user = db.prepare('SELECT id FROM users WHERE id = ? AND is_system = 0').get(id);
  if (!user) throw new Error('El usuario no existe.');
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    hashPassword(newPassword),
    id
  );
  return { ok: true };
}

/** Baja lógica: el usuario sigue existiendo pero queda "Desactivado". */
function deactivateUser(id, currentUserId) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_system = 0').get(id);
  if (!user) throw new Error('El usuario no existe.');
  if (Number(id) === Number(currentUserId)) throw new Error('No puedes desactivar tu propio usuario.');
  db.prepare("UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  return getUser(id);
}

function activateUser(id) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_system = 0').get(id);
  if (!user) throw new Error('El usuario no existe.');
  db.prepare("UPDATE users SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  return getUser(id);
}

/**
 * Define el conjunto completo de permisos individuales del usuario.
 * `keys` = todos los permisos que debe tener el usuario (heredados + manuales).
 * Lo que ya no esté en la lista se quita; lo nuevo se agrega como manual (from_role = 0).
 */
function setUserPermissions(id, keys) {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ? AND is_system = 0').get(id);
  if (!user) throw new Error('El usuario no existe.');
  const want = new Set(keys || []);
  const tx = db.transaction(() => {
    const current = db
      .prepare('SELECT permission_key, from_role FROM user_permissions WHERE user_id = ?')
      .all(id);
    const currentKeys = new Set(current.map((r) => r.permission_key));
    // quitar
    const del = db.prepare('DELETE FROM user_permissions WHERE user_id = ? AND permission_key = ?');
    for (const row of current) if (!want.has(row.permission_key)) del.run(id, row.permission_key);
    // agregar (manual)
    const ins = db.prepare(
      'INSERT OR IGNORE INTO user_permissions (user_id, permission_key, from_role) VALUES (?, ?, 0)'
    );
    for (const k of want) if (!currentKeys.has(k)) ins.run(id, k);
  });
  tx();
  return getUser(id);
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changeUsername,
  resetPassword,
  deactivateUser,
  activateUser,
  setUserPermissions,
};
