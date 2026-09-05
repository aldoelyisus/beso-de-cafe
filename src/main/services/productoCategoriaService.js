'use strict';

const { getDb } = require('../db/connection');
const { paginate } = require('./pagination');

const SORTS = {
  nombre: 'c.is_active DESC, c.orden, c.nombre',
  nombre_desc: 'c.is_active DESC, c.nombre DESC',
  productos_desc: 'c.is_active DESC, producto_count DESC, c.nombre',
  productos_asc: 'c.is_active DESC, producto_count ASC, c.nombre',
};

function listCategorias({ page = 1, pageSize = 15, search = null, sort = 'nombre', includeInactive = true } = {}) {
  const where = ['1=1'];
  const params = {};
  if (!includeInactive) where.push('c.is_active = 1');
  if (search) { where.push('c.nombre LIKE @like'); params.like = `%${String(search).trim()}%`; }
  const whereSql = where.join(' AND ');

  return paginate({
    countSql: `SELECT COUNT(*) AS n FROM producto_categorias c WHERE ${whereSql}`,
    rowsSql: `
      SELECT c.id, c.nombre, c.orden, c.is_active, c.created_at,
             (SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id) AS producto_count
      FROM producto_categorias c
      WHERE ${whereSql}
      ORDER BY ${SORTS[sort] || SORTS.nombre}
      LIMIT @limit OFFSET @offset`,
    params, page, pageSize,
  });
}

function listOptions() {
  return getDb()
    .prepare('SELECT id, nombre FROM producto_categorias WHERE is_active = 1 ORDER BY orden, nombre')
    .all();
}

function getCategoria(id) {
  return getDb().prepare('SELECT * FROM producto_categorias WHERE id = ?').get(id) || null;
}

function createCategoria({ nombre }) {
  const db = getDb();
  nombre = String(nombre || '').trim();
  if (!nombre) throw new Error('El nombre de la categoría es obligatorio.');
  try {
    const orden = db.prepare('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM producto_categorias').get().n;
    const info = db.prepare('INSERT INTO producto_categorias (nombre, orden) VALUES (?, ?)').run(nombre, orden);
    return getCategoria(info.lastInsertRowid);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Ya existe una categoría con ese nombre.');
    throw e;
  }
}

function updateCategoria(id, { nombre }) {
  const db = getDb();
  if (!getCategoria(id)) throw new Error('La categoría no existe.');
  try {
    db.prepare("UPDATE producto_categorias SET nombre = COALESCE(?, nombre), updated_at = datetime('now') WHERE id = ?")
      .run(nombre != null ? String(nombre).trim() : null, id);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Ya existe una categoría con ese nombre.');
    throw e;
  }
  return getCategoria(id);
}

function deactivateCategoria(id) {
  const db = getDb();
  if (!getCategoria(id)) throw new Error('La categoría no existe.');
  db.prepare("UPDATE producto_categorias SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  return getCategoria(id);
}

function activateCategoria(id) {
  const db = getDb();
  if (!getCategoria(id)) throw new Error('La categoría no existe.');
  db.prepare("UPDATE producto_categorias SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  return getCategoria(id);
}

module.exports = {
  listCategorias, listOptions, getCategoria,
  createCategoria, updateCategoria, deactivateCategoria, activateCategoria,
};
