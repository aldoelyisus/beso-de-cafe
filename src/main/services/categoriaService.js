'use strict';

const { getDb } = require('../db/connection');
const { isUnit } = require('../inventory/units');
const { paginate } = require('./pagination');

const CATEGORIA_SORTS = {
  nombre: 'c.is_active DESC, c.nombre',
  nombre_desc: 'c.is_active DESC, c.nombre DESC',
  insumos_desc: 'c.is_active DESC, insumo_count DESC, c.nombre',
  insumos_asc: 'c.is_active DESC, insumo_count ASC, c.nombre',
};

/** Listado paginado para la pantalla de administración. */
function listCategorias({
  page = 1,
  pageSize = 15,
  search = null,
  unidad = null,
  sort = 'nombre',
  includeInactive = true,
} = {}) {
  const where = ['1=1'];
  const params = {};
  if (!includeInactive) where.push('c.is_active = 1');
  if (search) { where.push('c.nombre LIKE @like'); params.like = `%${String(search).trim()}%`; }
  if (unidad && isUnit(unidad)) { where.push('c.unidad_sugerida = @unidad'); params.unidad = unidad; }
  const whereSql = where.join(' AND ');
  const orderSql = CATEGORIA_SORTS[sort] || CATEGORIA_SORTS.nombre;

  return paginate({
    countSql: `SELECT COUNT(*) AS n FROM insumo_categorias c WHERE ${whereSql}`,
    rowsSql: `
      SELECT c.id, c.nombre, c.unidad_sugerida, c.is_active, c.created_at,
             (SELECT COUNT(*) FROM insumos i WHERE i.categoria_id = c.id) AS insumo_count
      FROM insumo_categorias c
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT @limit OFFSET @offset`,
    params,
    page,
    pageSize,
  });
}

/** Categorías activas (para llenar los <select>). Sin paginar. */
function listCategoriaOptions() {
  return getDb()
    .prepare('SELECT id, nombre, unidad_sugerida FROM insumo_categorias WHERE is_active = 1 ORDER BY nombre')
    .all();
}

function getCategoria(id) {
  return getDb().prepare('SELECT * FROM insumo_categorias WHERE id = ?').get(id) || null;
}

function createCategoria({ nombre, unidad_sugerida = 'pieza' }) {
  const db = getDb();
  nombre = String(nombre || '').trim();
  if (!nombre) throw new Error('El nombre de la categoría es obligatorio.');
  if (!isUnit(unidad_sugerida)) throw new Error('Unidad sugerida no válida.');
  try {
    const info = db
      .prepare('INSERT INTO insumo_categorias (nombre, unidad_sugerida) VALUES (?, ?)')
      .run(nombre, unidad_sugerida);
    return getCategoria(info.lastInsertRowid);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Ya existe una categoría con ese nombre.');
    throw e;
  }
}

function updateCategoria(id, { nombre, unidad_sugerida }) {
  const db = getDb();
  const cat = getCategoria(id);
  if (!cat) throw new Error('La categoría no existe.');
  if (unidad_sugerida !== undefined && !isUnit(unidad_sugerida)) {
    throw new Error('Unidad sugerida no válida.');
  }
  try {
    db.prepare(
      `UPDATE insumo_categorias
       SET nombre = COALESCE(?, nombre),
           unidad_sugerida = COALESCE(?, unidad_sugerida),
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(nombre != null ? String(nombre).trim() : null, unidad_sugerida ?? null, id);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Ya existe una categoría con ese nombre.');
    throw e;
  }
  return getCategoria(id);
}

/**
 * Baja lógica. Los insumos que ya tienen esta categoría la conservan;
 * solo deja de aparecer al asignar categoría a insumos nuevos.
 */
function deactivateCategoria(id) {
  const db = getDb();
  if (!getCategoria(id)) throw new Error('La categoría no existe.');
  db.prepare("UPDATE insumo_categorias SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  return getCategoria(id);
}

function activateCategoria(id) {
  const db = getDb();
  if (!getCategoria(id)) throw new Error('La categoría no existe.');
  db.prepare("UPDATE insumo_categorias SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  return getCategoria(id);
}

module.exports = {
  listCategorias,
  listCategoriaOptions,
  getCategoria,
  createCategoria,
  updateCategoria,
  deactivateCategoria,
  activateCategoria,
};
