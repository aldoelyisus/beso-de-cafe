'use strict';

const { getDb } = require('../db/connection');

function listMesas({ includeInactive = true } = {}) {
  const db = getDb();
  const where = includeInactive ? '1=1' : 'm.is_active = 1';
  return db.prepare(
    `SELECT m.id, m.nombre, m.orden, m.is_active,
            (SELECT v.id FROM ventas v WHERE v.mesa_id = m.id AND v.estado = 'abierta' ORDER BY v.id LIMIT 1) AS venta_abierta_id,
            (SELECT COUNT(*) FROM ventas v WHERE v.mesa_id = m.id AND v.estado = 'abierta') AS cuentas_abiertas
     FROM mesas m WHERE ${where} ORDER BY m.orden, m.nombre`
  ).all();
}

function getMesa(id) {
  return getDb().prepare('SELECT * FROM mesas WHERE id = ?').get(id) || null;
}

function createMesa({ nombre }) {
  const db = getDb();
  nombre = String(nombre || '').trim();
  if (!nombre) throw new Error('El nombre de la mesa es obligatorio.');
  const orden = db.prepare('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM mesas').get().n;
  try {
    const info = db.prepare('INSERT INTO mesas (nombre, orden) VALUES (?, ?)').run(nombre, orden);
    return getMesa(info.lastInsertRowid);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Ya existe una mesa con ese nombre.');
    throw e;
  }
}

/** Crea varias mesas de golpe: "Mesa N+1" … "Mesa N+cantidad". */
function agregarVarias(cantidad) {
  const db = getDb();
  const n = Math.max(1, Math.min(Number(cantidad) || 0, 50));
  const base = db.prepare('SELECT COUNT(*) c FROM mesas').get().c;
  const maxOrden = db.prepare('SELECT COALESCE(MAX(orden), 0) AS n FROM mesas').get().n;
  const ins = db.prepare('INSERT INTO mesas (nombre, orden) VALUES (?, ?)');
  let creadas = 0;
  const tx = db.transaction(() => {
    for (let i = 1; i <= n; i++) {
      const nombre = `Mesa ${base + i}`;
      if (db.prepare('SELECT id FROM mesas WHERE nombre = ?').get(nombre)) continue;
      ins.run(nombre, maxOrden + i);
      creadas++;
    }
  });
  tx();
  return { creadas };
}

function updateMesa(id, { nombre, orden }) {
  const db = getDb();
  if (!getMesa(id)) throw new Error('La mesa no existe.');
  try {
    db.prepare("UPDATE mesas SET nombre = COALESCE(?, nombre), orden = COALESCE(?, orden), updated_at = datetime('now') WHERE id = ?")
      .run(nombre != null ? String(nombre).trim() : null, orden != null ? Number(orden) : null, id);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Ya existe una mesa con ese nombre.');
    throw e;
  }
  return getMesa(id);
}

function deactivateMesa(id) {
  const db = getDb();
  if (!getMesa(id)) throw new Error('La mesa no existe.');
  const abierta = db.prepare("SELECT COUNT(*) c FROM ventas WHERE mesa_id = ? AND estado = 'abierta'").get(id).c;
  if (abierta > 0) throw new Error('La mesa tiene una cuenta abierta. Ciérrala primero.');
  db.prepare("UPDATE mesas SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  return getMesa(id);
}

function activateMesa(id) {
  const db = getDb();
  if (!getMesa(id)) throw new Error('La mesa no existe.');
  db.prepare("UPDATE mesas SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  return getMesa(id);
}

module.exports = {
  listMesas, getMesa, createMesa, agregarVarias, updateMesa, deactivateMesa, activateMesa,
};
