'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { app } = require('electron');

let db = null;

/** Ruta del archivo de base de datos (dentro de los datos de la app en la laptop). */
function dbPath() {
  // En desarrollo, permite forzar una ruta con BESO_DB_PATH.
  if (process.env.BESO_DB_PATH) return process.env.BESO_DB_PATH;
  const dir = app.getPath('userData');
  return path.join(dir, 'beso-de-cafe.db');
}

function getDb() {
  if (db) return db;
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb, dbPath };
