'use strict';

const { getDb } = require('../db/connection');
const { isModo, MODOS_AQUI, MODOS_PARA_LLEVAR } = require('../menu/constants');
const { paginate } = require('./pagination');

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

const LIST_SORTS = {
  nombre: 'p.is_active DESC, p.nombre',
  nombre_desc: 'p.is_active DESC, p.nombre DESC',
  precio_asc: 'p.is_active DESC, precio_min ASC, p.nombre',
  precio_desc: 'p.is_active DESC, precio_max DESC, p.nombre',
};

// -------- Precio vigente --------
function precioActual(presentacionId) {
  const row = getDb()
    .prepare('SELECT precio FROM presentacion_precios WHERE presentacion_id = ? AND vigente_hasta IS NULL')
    .get(presentacionId);
  return row ? row.precio : null;
}

// -------- Costo de una presentación por modo de venta --------
// Los grupos de opción usan el costo de su opción PREDETERMINADA (es lo que se
// prepara por default; en la venta el costo real refleja la opción elegida).
function costos(presentacionId) {
  const db = getDb();
  let aqui = 0;
  let llevar = 0;
  const add = (cantidad, modo, costoUnit) => {
    const linea = cantidad * costoUnit;
    if (MODOS_AQUI.includes(modo)) aqui += linea;
    if (MODOS_PARA_LLEVAR.includes(modo)) llevar += linea;
  };

  const items = db.prepare(
    `SELECT ri.cantidad_base, ri.modo, i.costo_unitario
     FROM receta_items ri JOIN insumos i ON i.id = ri.insumo_id
     WHERE ri.presentacion_id = ?`
  ).all(presentacionId);
  for (const r of items) add(r.cantidad_base, r.modo, r.costo_unitario);

  const grupos = db.prepare(
    `SELECT g.cantidad_base, g.modo,
            COALESCE(
              (SELECT i.costo_unitario FROM insumos i WHERE i.id = g.insumo_default_id),
              (SELECT MIN(i2.costo_unitario) FROM receta_grupo_opciones o JOIN insumos i2 ON i2.id = o.insumo_id WHERE o.grupo_id = g.id)
            , 0) AS costo_unitario
     FROM receta_grupos g WHERE g.presentacion_id = ?`
  ).all(presentacionId);
  for (const r of grupos) add(r.cantidad_base, r.modo, r.costo_unitario || 0);

  return { aqui, llevar };
}

// -------- Listado --------
function listProductos({
  page = 1, pageSize = 15, search = null, categoriaId = null,
  sort = 'nombre', includeInactive = true, soloAgotados = false,
} = {}) {
  const where = ['1=1'];
  const params = {};
  if (!includeInactive) where.push('p.is_active = 1');
  if (categoriaId) { where.push('p.categoria_id = @categoriaId'); params.categoriaId = Number(categoriaId); }
  if (search) { where.push('p.nombre LIKE @like'); params.like = `%${String(search).trim()}%`; }
  if (soloAgotados) where.push('p.agotado = 1');
  const whereSql = where.join(' AND ');

  const precioSub = (agg) => `
    (SELECT ${agg}(pp.precio) FROM presentacion_precios pp
       JOIN producto_presentaciones ppr ON ppr.id = pp.presentacion_id
     WHERE ppr.producto_id = p.id AND pp.vigente_hasta IS NULL AND ppr.is_active = 1)`;

  const res = paginate({
    countSql: `SELECT COUNT(*) AS n FROM productos p WHERE ${whereSql}`,
    rowsSql: `
      SELECT p.id, p.nombre, p.descripcion, p.agotado, p.is_active, p.categoria_id,
             c.nombre AS categoria_nombre,
             (SELECT COUNT(*) FROM producto_presentaciones pr WHERE pr.producto_id = p.id AND pr.is_active = 1) AS num_presentaciones,
             ${precioSub('MIN')} AS precio_min,
             ${precioSub('MAX')} AS precio_max
      FROM productos p LEFT JOIN producto_categorias c ON c.id = p.categoria_id
      WHERE ${whereSql}
      ORDER BY ${LIST_SORTS[sort] || LIST_SORTS.nombre}
      LIMIT @limit OFFSET @offset`,
    params, page, pageSize,
  });

  // señal: ¿todas las presentaciones activas tienen receta y precio?
  const db = getDb();
  for (const p of res.rows) {
    const pres = db.prepare('SELECT id FROM producto_presentaciones WHERE producto_id = ? AND is_active = 1').all(p.id);
    p.receta_completa = pres.length > 0 && pres.every((pr) => {
      const tieneItems = db.prepare('SELECT 1 FROM receta_items WHERE presentacion_id = ? LIMIT 1').get(pr.id);
      const tieneGrupos = db.prepare('SELECT 1 FROM receta_grupos WHERE presentacion_id = ? LIMIT 1').get(pr.id);
      const tienePrecio = precioActual(pr.id) != null;
      return (tieneItems || tieneGrupos) && tienePrecio;
    });
  }
  return res;
}

function listOptions() {
  // productos activos con sus presentaciones activas y precio actual (para ventas / promos)
  const db = getDb();
  const productos = db.prepare(
    `SELECT p.id, p.nombre, p.agotado, c.nombre AS categoria_nombre
     FROM productos p LEFT JOIN producto_categorias c ON c.id = p.categoria_id
     WHERE p.is_active = 1 ORDER BY p.nombre`
  ).all();
  for (const p of productos) {
    p.presentaciones = db.prepare(
      'SELECT id, nombre, agotado FROM producto_presentaciones WHERE producto_id = ? AND is_active = 1 ORDER BY orden, nombre'
    ).all(p.id).map((pr) => ({ ...pr, precio_actual: precioActual(pr.id) }));
  }
  return productos;
}

// -------- Detalle --------
function getProducto(id) {
  const db = getDb();
  const p = db.prepare(
    `SELECT p.*, c.nombre AS categoria_nombre
     FROM productos p LEFT JOIN producto_categorias c ON c.id = p.categoria_id
     WHERE p.id = ?`
  ).get(id);
  if (!p) return null;

  p.presentaciones = db.prepare(
    'SELECT * FROM producto_presentaciones WHERE producto_id = ? ORDER BY orden, id'
  ).all(id).map((pr) => {
    const receta = db.prepare(
      `SELECT ri.id, ri.insumo_id, ri.cantidad_base, ri.modo,
              i.nombre AS insumo_nombre, i.unidad_base, i.costo_unitario, i.is_active AS insumo_activo,
              (ri.cantidad_base * i.costo_unitario) AS costo_linea
       FROM receta_items ri JOIN insumos i ON i.id = ri.insumo_id
       WHERE ri.presentacion_id = ? ORDER BY ri.modo, i.nombre`
    ).all(pr.id);

    const grupos = db.prepare(
      'SELECT * FROM receta_grupos WHERE presentacion_id = ? ORDER BY orden, id'
    ).all(pr.id).map((g) => {
      const opciones = db.prepare(
        `SELECT o.insumo_id, i.nombre AS insumo_nombre, i.unidad_base, i.costo_unitario, i.is_active AS insumo_activo
         FROM receta_grupo_opciones o JOIN insumos i ON i.id = o.insumo_id
         WHERE o.grupo_id = ? ORDER BY i.nombre`
      ).all(g.id).map((o) => ({ ...o, costo_linea: g.cantidad_base * o.costo_unitario }));
      const def = opciones.find((o) => o.insumo_id === g.insumo_default_id) || opciones[0] || null;
      return { ...g, opciones, unidad_base: def ? def.unidad_base : '', costo_default: def ? def.costo_linea : 0 };
    });

    const c = costos(pr.id);
    const precio = precioActual(pr.id);
    return {
      ...pr,
      precio_actual: precio,
      receta,
      grupos,
      receta_vacia: receta.length === 0 && grupos.length === 0,
      costo_aqui: c.aqui,
      costo_llevar: c.llevar,
      ganancia_aqui: precio != null ? precio - c.aqui : null,
      ganancia_llevar: precio != null ? precio - c.llevar : null,
    };
  });

  p.modificadores = db.prepare(
    `SELECT m.id, m.nombre, m.precio_extra
     FROM producto_modificadores pm JOIN modificadores m ON m.id = pm.modificador_id
     WHERE pm.producto_id = ? ORDER BY m.nombre`
  ).all(id);

  return p;
}

// -------- Alta --------
function createProducto(data, actor = {}) {
  const db = getDb();
  const nombre = String(data.nombre || '').trim();
  if (!nombre) throw new Error('El nombre del producto es obligatorio.');
  const categoriaId = data.categoria_id ? Number(data.categoria_id) : null;

  const presentaciones = Array.isArray(data.presentaciones) && data.presentaciones.length
    ? data.presentaciones
    : [{ nombre: 'Único', precio: data.precio }];

  const clean = presentaciones.map((pr, idx) => {
    const nom = String(pr.nombre || '').trim() || (presentaciones.length === 1 ? 'Único' : `Tamaño ${idx + 1}`);
    const precio = num(pr.precio, NaN);
    if (!Number.isFinite(precio) || precio < 0) throw new Error(`Indica un precio válido para "${nom}".`);
    return { nombre: nom, precio, orden: idx };
  });

  const tx = db.transaction(() => {
    const info = db.prepare(
      'INSERT INTO productos (nombre, categoria_id, descripcion) VALUES (?, ?, ?)'
    ).run(nombre, categoriaId, String(data.descripcion || ''));
    const productoId = info.lastInsertRowid;

    const insPres = db.prepare('INSERT INTO producto_presentaciones (producto_id, nombre, orden) VALUES (?, ?, ?)');
    const insPrecio = db.prepare(
      'INSERT INTO presentacion_precios (presentacion_id, precio, user_id, username) VALUES (?, ?, ?, ?)'
    );
    for (const pr of clean) {
      const presId = insPres.run(productoId, pr.nombre, pr.orden).lastInsertRowid;
      insPrecio.run(presId, pr.precio, actor.id || null, actor.username || '');
    }

    if (Array.isArray(data.modificadorIds)) {
      const insMod = db.prepare('INSERT OR IGNORE INTO producto_modificadores (producto_id, modificador_id) VALUES (?, ?)');
      for (const mid of data.modificadorIds) insMod.run(productoId, Number(mid));
    }
    return productoId;
  });

  return getProducto(tx());
}

function updateProducto(id, data) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM productos WHERE id = ?').get(id)) throw new Error('El producto no existe.');
  db.prepare(
    `UPDATE productos SET
       nombre = COALESCE(@nombre, nombre),
       categoria_id = @categoria_id,
       descripcion = COALESCE(@descripcion, descripcion),
       updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    nombre: data.nombre != null ? String(data.nombre).trim() : null,
    categoria_id: data.categoria_id !== undefined ? (data.categoria_id ? Number(data.categoria_id) : null) : db.prepare('SELECT categoria_id FROM productos WHERE id = ?').get(id).categoria_id,
    descripcion: data.descripcion != null ? String(data.descripcion) : null,
  });
  return getProducto(id);
}

function setAgotado(id, agotado) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM productos WHERE id = ?').get(id)) throw new Error('El producto no existe.');
  db.prepare("UPDATE productos SET agotado = ?, updated_at = datetime('now') WHERE id = ?").run(agotado ? 1 : 0, id);
  return getProducto(id);
}

function deactivateProducto(id) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM productos WHERE id = ?').get(id)) throw new Error('El producto no existe.');
  db.prepare("UPDATE productos SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  return getProducto(id);
}

function activateProducto(id) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM productos WHERE id = ?').get(id)) throw new Error('El producto no existe.');
  db.prepare("UPDATE productos SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  return getProducto(id);
}

// -------- Presentaciones --------
function getPresentacion(db, presId) {
  return db.prepare('SELECT * FROM producto_presentaciones WHERE id = ?').get(presId);
}

function addPresentacion(productoId, { nombre, precio }, actor = {}) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM productos WHERE id = ?').get(productoId)) throw new Error('El producto no existe.');
  nombre = String(nombre || '').trim();
  if (!nombre) throw new Error('El nombre del tamaño es obligatorio.');
  const p = num(precio, NaN);
  if (!Number.isFinite(p) || p < 0) throw new Error('Indica un precio válido.');
  const orden = db.prepare('SELECT COALESCE(MAX(orden), -1) + 1 AS n FROM producto_presentaciones WHERE producto_id = ?').get(productoId).n;
  const tx = db.transaction(() => {
    const presId = db.prepare('INSERT INTO producto_presentaciones (producto_id, nombre, orden) VALUES (?, ?, ?)')
      .run(productoId, nombre, orden).lastInsertRowid;
    db.prepare('INSERT INTO presentacion_precios (presentacion_id, precio, user_id, username) VALUES (?, ?, ?, ?)')
      .run(presId, p, actor.id || null, actor.username || '');
  });
  tx();
  return getProducto(productoId);
}

function updatePresentacion(presId, { nombre, orden }) {
  const db = getDb();
  const pr = getPresentacion(db, presId);
  if (!pr) throw new Error('El tamaño no existe.');
  db.prepare(
    "UPDATE producto_presentaciones SET nombre = COALESCE(?, nombre), orden = COALESCE(?, orden), updated_at = datetime('now') WHERE id = ?"
  ).run(nombre != null ? String(nombre).trim() : null, orden != null ? Number(orden) : null, presId);
  return getProducto(pr.producto_id);
}

function setAgotadoPresentacion(presId, agotado) {
  const db = getDb();
  const pr = getPresentacion(db, presId);
  if (!pr) throw new Error('El tamaño no existe.');
  db.prepare("UPDATE producto_presentaciones SET agotado = ?, updated_at = datetime('now') WHERE id = ?").run(agotado ? 1 : 0, presId);
  return getProducto(pr.producto_id);
}

function deactivatePresentacion(presId) {
  const db = getDb();
  const pr = getPresentacion(db, presId);
  if (!pr) throw new Error('El tamaño no existe.');
  const activas = db.prepare('SELECT COUNT(*) c FROM producto_presentaciones WHERE producto_id = ? AND is_active = 1').get(pr.producto_id).c;
  if (activas <= 1 && pr.is_active) throw new Error('El producto necesita al menos un tamaño activo.');
  db.prepare("UPDATE producto_presentaciones SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(presId);
  return getProducto(pr.producto_id);
}

function activatePresentacion(presId) {
  const db = getDb();
  const pr = getPresentacion(db, presId);
  if (!pr) throw new Error('El tamaño no existe.');
  db.prepare("UPDATE producto_presentaciones SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(presId);
  return getProducto(pr.producto_id);
}

// -------- Precios --------
function cambiarPrecio(presId, nuevoPrecio, actor = {}) {
  const db = getDb();
  const pr = getPresentacion(db, presId);
  if (!pr) throw new Error('El tamaño no existe.');
  const p = num(nuevoPrecio, NaN);
  if (!Number.isFinite(p) || p < 0) throw new Error('Indica un precio válido.');
  const actual = db.prepare('SELECT * FROM presentacion_precios WHERE presentacion_id = ? AND vigente_hasta IS NULL').get(presId);
  if (actual && actual.precio === p) throw new Error('El precio nuevo es igual al actual.');
  const tx = db.transaction(() => {
    if (actual) db.prepare("UPDATE presentacion_precios SET vigente_hasta = datetime('now') WHERE id = ?").run(actual.id);
    db.prepare('INSERT INTO presentacion_precios (presentacion_id, precio, user_id, username) VALUES (?, ?, ?, ?)')
      .run(presId, p, actor.id || null, actor.username || '');
  });
  tx();
  return getProducto(pr.producto_id);
}

function historialPrecios(presId) {
  return getDb().prepare(
    `SELECT precio, username,
            datetime(vigente_desde, 'localtime') AS vigente_desde,
            CASE WHEN vigente_hasta IS NULL THEN NULL ELSE datetime(vigente_hasta, 'localtime') END AS vigente_hasta
     FROM presentacion_precios WHERE presentacion_id = ? ORDER BY id DESC`
  ).all(presId);
}

// -------- Receta --------
/**
 * Reemplaza la receta completa de un tamaño.
 *   payload = { items: [{insumo_id, cantidad_base, modo}],
 *               grupos: [{nombre, cantidad_base, modo, opciones:[insumo_id], insumo_default_id}] }
 * Acepta también un arreglo suelto (se trata como `items`).
 */
function setReceta(presId, payload, actor = {}) {
  const db = getDb();
  const pr = getPresentacion(db, presId);
  if (!pr) throw new Error('El tamaño no existe.');

  const items = Array.isArray(payload) ? payload : (payload && payload.items) || [];
  const grupos = (payload && !Array.isArray(payload) && payload.grupos) || [];

  // --- items fijos ---
  const seen = new Set();
  const cleanItems = [];
  for (const it of items) {
    const insumoId = Number(it.insumo_id);
    const cant = num(it.cantidad_base, 0);
    const modo = it.modo || 'siempre';
    if (!insumoId) continue;
    if (!isModo(modo)) throw new Error('Modo de receta no válido.');
    if (cant <= 0) throw new Error('Cada insumo de la receta necesita una cantidad mayor a 0.');
    const insumo = db.prepare('SELECT id, nombre FROM insumos WHERE id = ?').get(insumoId);
    if (!insumo) throw new Error('Un insumo de la receta no existe.');
    const k = `${insumoId}:${modo}`;
    if (seen.has(k)) throw new Error(`El insumo "${insumo.nombre}" está repetido con el mismo modo.`);
    seen.add(k);
    cleanItems.push({ insumoId, cant, modo });
  }

  // --- grupos de opción ---
  const cleanGrupos = [];
  grupos.forEach((g, idx) => {
    const nombre = String(g.nombre || '').trim();
    const cant = num(g.cantidad_base, 0);
    const modo = g.modo || 'siempre';
    const opcionIds = [...new Set((g.opciones || []).map(Number).filter(Boolean))];
    if (!nombre && !opcionIds.length) return; // grupo vacío, se ignora
    if (!nombre) throw new Error('Cada grupo de opción necesita un nombre.');
    if (!isModo(modo)) throw new Error('Modo de grupo no válido.');
    if (cant <= 0) throw new Error(`El grupo "${nombre}" necesita una cantidad mayor a 0.`);
    if (opcionIds.length < 2) throw new Error(`El grupo "${nombre}" necesita al menos 2 opciones.`);
    const insumos = opcionIds.map((id) => db.prepare('SELECT id, nombre, unidad_base FROM insumos WHERE id = ?').get(id));
    if (insumos.some((i) => !i)) throw new Error(`Una opción del grupo "${nombre}" no existe.`);
    const unidades = new Set(insumos.map((i) => i.unidad_base));
    if (unidades.size > 1) throw new Error(`Las opciones del grupo "${nombre}" deben usar la misma unidad.`);
    let def = Number(g.insumo_default_id) || opcionIds[0];
    if (!opcionIds.includes(def)) def = opcionIds[0];
    cleanGrupos.push({ nombre, cant, modo, opcionIds, def, orden: idx });
  });

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM receta_items WHERE presentacion_id = ?').run(presId);
    db.prepare('DELETE FROM receta_grupos WHERE presentacion_id = ?').run(presId); // cascada borra opciones

    const insItem = db.prepare('INSERT INTO receta_items (presentacion_id, insumo_id, cantidad_base, modo) VALUES (?, ?, ?, ?)');
    for (const it of cleanItems) insItem.run(presId, it.insumoId, it.cant, it.modo);

    const insGrupo = db.prepare(
      'INSERT INTO receta_grupos (presentacion_id, nombre, cantidad_base, modo, insumo_default_id, orden) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insOpcion = db.prepare('INSERT INTO receta_grupo_opciones (grupo_id, insumo_id) VALUES (?, ?)');
    for (const g of cleanGrupos) {
      const gid = insGrupo.run(presId, g.nombre, g.cant, g.modo, g.def, g.orden).lastInsertRowid;
      for (const oid of g.opcionIds) insOpcion.run(gid, oid);
    }
  });
  tx();
  return getProducto(pr.producto_id);
}

// -------- Modificadores del producto --------
function setModificadores(productoId, modificadorIds) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM productos WHERE id = ?').get(productoId)) throw new Error('El producto no existe.');
  const ids = (modificadorIds || []).map(Number).filter(Boolean);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM producto_modificadores WHERE producto_id = ?').run(productoId);
    const ins = db.prepare('INSERT OR IGNORE INTO producto_modificadores (producto_id, modificador_id) VALUES (?, ?)');
    for (const mid of ids) {
      if (db.prepare('SELECT id FROM modificadores WHERE id = ?').get(mid)) ins.run(productoId, mid);
    }
  });
  tx();
  return getProducto(productoId);
}

module.exports = {
  listProductos, listOptions, getProducto,
  createProducto, updateProducto, setAgotado, deactivateProducto, activateProducto,
  addPresentacion, updatePresentacion, setAgotadoPresentacion, deactivatePresentacion, activatePresentacion,
  cambiarPrecio, historialPrecios,
  setReceta, setModificadores,
  costos, precioActual,
};
