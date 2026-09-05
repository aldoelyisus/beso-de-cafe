-- Esquema inicial: usuarios, roles y permisos.
-- SQLite. Todas las tablas viven en el archivo local de la laptop.

PRAGMA foreign_keys = ON;

-- Catálogo de permisos. Se sincroniza desde código (permissions/registry.js).
CREATE TABLE IF NOT EXISTS permissions (
  key         TEXT PRIMARY KEY,          -- ej. "users.create"
  module      TEXT NOT NULL,             -- ej. "users"
  action      TEXT NOT NULL,             -- ej. "create"
  label       TEXT NOT NULL
);

-- Roles creados por los administradores desde la interfaz.
CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  is_system   INTEGER NOT NULL DEFAULT 0,   -- rol interno, no editable/eliminable
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Plantilla de permisos por rol. Editarla NO afecta a los usuarios ya creados:
-- solo se usa como base al crear usuarios nuevos con ese rol.
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id        INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS users (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  name                     TEXT NOT NULL,
  username                 TEXT NOT NULL UNIQUE,
  password_hash            TEXT NOT NULL,
  role_id                  INTEGER REFERENCES roles(id) ON DELETE SET NULL,
  -- Área de personal
  phone                    TEXT NOT NULL DEFAULT '',
  emergency_contact_name   TEXT NOT NULL DEFAULT '',
  emergency_contact_phone  TEXT NOT NULL DEFAULT '',
  -- Estado
  is_active                INTEGER NOT NULL DEFAULT 1,   -- 0 = desactivado (baja lógica / soft delete)
  is_system                INTEGER NOT NULL DEFAULT 0,   -- 1 = usuario interno (admin), oculto en listados
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Permisos EFECTIVOS de cada usuario.
-- Al crear el usuario se copian aquí los permisos del rol (from_role = 1).
-- Los permisos individuales extra se guardan con from_role = 0.
-- A partir de este momento el usuario es independiente del rol.
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  from_role      INTEGER NOT NULL DEFAULT 0,   -- 1 = heredado del rol al crear, 0 = asignado manualmente
  PRIMARY KEY (user_id, permission_key)
);

-- Bitácora de acciones importantes (cancelaciones, descuentos, cambios, etc.).
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username    TEXT NOT NULL DEFAULT '',
  action      TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
