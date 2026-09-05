'use strict';

const fs = require('fs');
const path = require('path');
const { getDb } = require('./connection');

/**
 * Migraciones simples basadas en archivos .sql numerados dentro de ./migrations.
 * Cada archivo se ejecuta una sola vez y queda registrado en la tabla _migrations.
 * Para cambiar el esquema: agrega 002_xxx.sql, 003_xxx.sql, etc. Nunca edites uno ya aplicado.
 */
function runMigrations() {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);

  const dir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = new Set(db.prepare('SELECT name FROM _migrations').all().map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    });
    tx();
    console.log(`[db] migración aplicada: ${file}`);
  }
}

module.exports = { runMigrations };
