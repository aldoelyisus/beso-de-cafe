'use strict';

const { getDb } = require('../db/connection');

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function listModificadores({ includeInactive = true } = {}) {
  const db = getDb();
  const where = includeInactive ? '1=1' : 'm.is_active = 1';
  const mods = db.prepare(
    `SELECT m.id, m.nombre, m.precio_extra, m.is_active,
            (SELECT COUNT(*) FROM modificador_items mi WHERE mi.modificador_id = m.id) AS item_count,
            (SELECT COUNT(*) FROM producto_modificadores pm WHERE pm.modificador_id = m.id) AS producto_count
     FROM modificadores m WHERE ${where} ORDER BY m.is_active DESC, m.nombre`
  ).all();
  // costo del modificador (suma de insumos)
  for (const m of mods) m.costo = costoModificador(m.id);
  return mods;
}

function getModificador(id) {
  const db = getDb();
  const m = db.prepare('SELECT * FROM modificadores WHERE id = ?').get(id);
  if (!m) return null;
  m.items = db.prepare(
    `SELECT mi.insumo_id, mi.cantidad_base, i.nombre AS insumo_nombre, i.unidad_base, i.costo_unitario,
            (mi.cantidad_base * i.costo_unitario) AS costo_linea
     FROM modificador_items mi JOIN insumos i ON i.id = mi.insumo_id
     WHERE mi.modificador_id = ? ORDER BY i.nombre`
  ).all(id);
  m.costo = m.items.reduce((s, it) => s + it.costo_linea, 0);
  return m;
}

function costoModificador(id) {
  return getDb().prepare(
    `SELECT COALESCE(SUM(mi.cantidad_base * i.costo_unitario), 0) AS c
     FROM modificador_items mi JOIN insumos i ON i.id = mi.insumo_id
     WHERE mi.modificador_id = ?`
  ).get(id).c;
}

function createModificador({ nombre, precio_extra = 0 }) {
  const db = getDb();
  nombre = String(nombre || '').trim();
  if (!nombre) throw new Error('El nombre del modificador es obligatorio.');
  const p = num(precio_extra, 0);
  if (p < 0) throw new Error('El precio extra no puede ser negativo.');
  try {
    const info = db.prepare('INSERT INTO modificadores (nombre, precio_extra) VALUES (?, ?)').run(nombre, p);
    return getModificador(info.lastInsertRowid);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Ya existe un modificador con ese nombre.');
    throw e;
  }
}

function updateModificador(id, { nombre, precio_extra }) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM modificadores WHERE id = ?').get(id)) throw new Error('El modificador no existe.');
  if (precio_extra !== undefined && num(precio_extra, -1) < 0) throw new Error('El precio extra no puede ser negativo.');
  try {
    db.prepare(
      `UPDATE modificadores SET nombre = COALESCE(?, nombre),
       precio_extra = COALESCE(?, precio_extra), updated_at = datetime('now') WHERE id = ?`
    ).run(
      nombre != null ? String(nombre).trim() : null,
      precio_extra !== undefined ? num(precio_extra, 0) : null,
      id
    );
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Ya existe un modificador con ese nombre.');
    throw e;
  }
  return getModificador(id);
}

/** Reemplaza la mini-receta del modificador. items = [{ insumo_id, cantidad_base }] */
function setItems(id, items) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM modificadores WHERE id = ?').get(id)) throw new Error('El modificador no existe.');
  const clean = [];
  for (const it of items || []) {
    const insumoId = Number(it.insumo_id);
    const cant = num(it.cantidad_base, 0);
    if (!insumoId) continue;
    if (cant <= 0) throw new Error('Las cantidades de la receta deben ser mayores a 0.');
    if (!db.prepare('SELECT id FROM insumos WHERE id = ?').get(insumoId)) throw new Error('Un insumo de la receta no existe.');
    clean.push({ insumoId, cant });
  }
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM modificador_items WHERE modificador_id = ?').run(id);
    const ins = db.prepare('INSERT INTO modificador_items (modificador_id, insumo_id, cantidad_base) VALUES (?, ?, ?)');
    for (const it of clean) ins.run(id, it.insumoId, it.cant);
  });
  tx();
  return getModificador(id);
}

function deactivateModificador(id) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM modificadores WHERE id = ?').get(id)) throw new Error('El modificador no existe.');
  db.prepare("UPDATE modificadores SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  return getModificador(id);
}

function activateModificador(id) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM modificadores WHERE id = ?').get(id)) throw new Error('El modificador no existe.');
  db.prepare("UPDATE modificadores SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  return getModificador(id);
}

function listOptions() {
  return getDb()
    .prepare('SELECT id, nombre, precio_extra FROM modificadores WHERE is_active = 1 ORDER BY nombre')
    .all();
}

module.exports = {
  listModificadores, getModificador, createModificador, updateModificador,
  setItems, deactivateModificador, activateModificador, listOptions, costoModificador,
};
