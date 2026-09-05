'use strict';

const { getDb } = require('../db/connection');
const { isUnit, MERMA_MOTIVOS } = require('../inventory/units');
const { paginate } = require('./pagination');

const COLS = `
  i.id, i.nombre, i.categoria_id, i.unidad_base,
  i.unidad_compra, i.factor_compra, i.costo_compra, i.costo_unitario,
  i.stock, i.stock_minimo, i.notas, i.is_active,
  i.created_at, i.updated_at,
  c.nombre AS categoria_nombre,
  (i.stock <= i.stock_minimo) AS bajo_stock
`;

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

const INSUMO_SORTS = {
  nombre: 'i.is_active DESC, i.nombre',
  nombre_desc: 'i.is_active DESC, i.nombre DESC',
  stock_asc: 'i.is_active DESC, i.stock ASC, i.nombre',
  stock_desc: 'i.is_active DESC, i.stock DESC, i.nombre',
  costo_asc: 'i.is_active DESC, i.costo_unitario ASC, i.nombre',
  costo_desc: 'i.is_active DESC, i.costo_unitario DESC, i.nombre',
};

function listInsumos({
  includeInactive = true,
  categoriaId = null,
  search = null,
  soloBajoStock = false,
  sort = 'nombre',
  page = 1,
  pageSize = 15,
} = {}) {
  const where = ['1=1'];
  const params = {};
  if (!includeInactive) where.push('i.is_active = 1');
  if (categoriaId) { where.push('i.categoria_id = @categoriaId'); params.categoriaId = Number(categoriaId); }
  if (search) { where.push('i.nombre LIKE @like'); params.like = `%${String(search).trim()}%`; }
  if (soloBajoStock) where.push('i.stock <= i.stock_minimo');
  const whereSql = where.join(' AND ');
  const orderSql = INSUMO_SORTS[sort] || INSUMO_SORTS.nombre;

  return paginate({
    countSql: `SELECT COUNT(*) AS n FROM insumos i WHERE ${whereSql}`,
    rowsSql: `
      SELECT ${COLS}
      FROM insumos i LEFT JOIN insumo_categorias c ON c.id = i.categoria_id
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT @limit OFFSET @offset`,
    params,
    page,
    pageSize,
  });
}

/** Insumos activos para llenar selectores (recetas, etc.). Sin paginar. */
function listInsumoOptions() {
  return getDb()
    .prepare(
      `SELECT i.id, i.nombre, i.unidad_base, i.costo_unitario, c.nombre AS categoria_nombre
       FROM insumos i LEFT JOIN insumo_categorias c ON c.id = i.categoria_id
       WHERE i.is_active = 1 ORDER BY i.nombre`
    )
    .all();
}

function getInsumo(id) {
  const insumo = getDb()
    .prepare(
      `SELECT ${COLS}
       FROM insumos i LEFT JOIN insumo_categorias c ON c.id = i.categoria_id
       WHERE i.id = ?`
    )
    .get(id);
  return insumo || null;
}

function countBajoStock() {
  return getDb()
    .prepare('SELECT COUNT(*) c FROM insumos WHERE is_active = 1 AND stock <= stock_minimo')
    .get().c;
}

/** Normaliza y valida los campos comunes de un insumo. */
function cleanInsumoData(data, { partial = false } = {}) {
  const out = {};
  if (data.nombre !== undefined || !partial) {
    out.nombre = String(data.nombre || '').trim();
    if (!out.nombre) throw new Error('El nombre del insumo es obligatorio.');
  }
  if (data.unidad_base !== undefined || !partial) {
    out.unidad_base = data.unidad_base || 'pieza';
    if (!isUnit(out.unidad_base)) throw new Error('Unidad base no válida.');
  }
  if (data.categoria_id !== undefined || !partial) {
    out.categoria_id = data.categoria_id ? Number(data.categoria_id) : null;
  }
  if (data.unidad_compra !== undefined || !partial) out.unidad_compra = String(data.unidad_compra || '').trim();
  if (data.factor_compra !== undefined || !partial) {
    out.factor_compra = num(data.factor_compra, 1);
    if (out.factor_compra <= 0) throw new Error('El factor de compra debe ser mayor a 0.');
  }
  if (data.costo_compra !== undefined || !partial) {
    out.costo_compra = num(data.costo_compra, 0);
    if (out.costo_compra < 0) throw new Error('El costo de compra no puede ser negativo.');
  }
  if (data.stock_minimo !== undefined || !partial) {
    out.stock_minimo = num(data.stock_minimo, 0);
    if (out.stock_minimo < 0) throw new Error('El stock mínimo no puede ser negativo.');
  }
  if (data.notas !== undefined) out.notas = String(data.notas || '');
  return out;
}

/**
 * Crea un insumo. Opcionalmente con existencia inicial (en unidad de compra).
 * El costo por unidad base arranca = costo_compra / factor_compra.
 */
function createInsumo(data, actor = {}) {
  const db = getDb();
  const c = cleanInsumoData(data);
  const stockInicialCompra = num(data.stock_inicial_compra, 0);
  if (stockInicialCompra < 0) throw new Error('La existencia inicial no puede ser negativa.');

  const costoBase = c.costo_compra > 0 && c.factor_compra > 0 ? c.costo_compra / c.factor_compra : 0;
  const stockBase = stockInicialCompra * c.factor_compra;

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO insumos
          (nombre, categoria_id, unidad_base, unidad_compra, factor_compra,
           costo_compra, costo_unitario, stock, stock_minimo, notas)
         VALUES (@nombre, @categoria_id, @unidad_base, @unidad_compra, @factor_compra,
           @costo_compra, @costo_unitario, @stock, @stock_minimo, @notas)`
      )
      .run({
        nombre: c.nombre,
        categoria_id: c.categoria_id,
        unidad_base: c.unidad_base,
        unidad_compra: c.unidad_compra,
        factor_compra: c.factor_compra,
        costo_compra: c.costo_compra,
        costo_unitario: costoBase,
        stock: stockBase,
        stock_minimo: c.stock_minimo,
        notas: c.notas || '',
      });
    const id = info.lastInsertRowid;
    if (stockBase > 0) {
      db.prepare(
        `INSERT INTO inventory_movements
          (insumo_id, tipo, cantidad_base, cantidad_captura, unidad_captura,
           costo_unitario, motivo, stock_resultante, user_id, username)
         VALUES (?, 'entrada', ?, ?, ?, ?, 'Existencia inicial', ?, ?, ?)`
      ).run(id, stockBase, stockInicialCompra, c.unidad_compra || c.unidad_base, costoBase, stockBase,
        actor.id || null, actor.username || '');
    }
    return id;
  });

  return getInsumo(tx());
}

function updateInsumo(id, data) {
  const db = getDb();
  const insumo = db.prepare('SELECT * FROM insumos WHERE id = ?').get(id);
  if (!insumo) throw new Error('El insumo no existe.');
  const c = cleanInsumoData(data, { partial: true });

  // Si cambia costo_compra o factor y no hay stock, recalculamos el costo base.
  let costo_unitario = insumo.costo_unitario;
  const factor = c.factor_compra ?? insumo.factor_compra;
  const costoCompra = c.costo_compra ?? insumo.costo_compra;
  if ((c.costo_compra !== undefined || c.factor_compra !== undefined) && insumo.stock <= 0) {
    costo_unitario = costoCompra > 0 && factor > 0 ? costoCompra / factor : 0;
  }

  db.prepare(
    `UPDATE insumos SET
       nombre = COALESCE(@nombre, nombre),
       categoria_id = @categoria_id,
       unidad_base = COALESCE(@unidad_base, unidad_base),
       unidad_compra = COALESCE(@unidad_compra, unidad_compra),
       factor_compra = COALESCE(@factor_compra, factor_compra),
       costo_compra = COALESCE(@costo_compra, costo_compra),
       costo_unitario = @costo_unitario,
       stock_minimo = COALESCE(@stock_minimo, stock_minimo),
       notas = COALESCE(@notas, notas),
       updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    nombre: c.nombre ?? null,
    categoria_id: c.categoria_id !== undefined ? c.categoria_id : insumo.categoria_id,
    unidad_base: c.unidad_base ?? null,
    unidad_compra: c.unidad_compra ?? null,
    factor_compra: c.factor_compra ?? null,
    costo_compra: c.costo_compra ?? null,
    costo_unitario,
    stock_minimo: c.stock_minimo ?? null,
    notas: c.notas ?? null,
  });
  return getInsumo(id);
}

function deactivateInsumo(id) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM insumos WHERE id = ?').get(id)) throw new Error('El insumo no existe.');
  db.prepare("UPDATE insumos SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  return getInsumo(id);
}

function activateInsumo(id) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM insumos WHERE id = ?').get(id)) throw new Error('El insumo no existe.');
  db.prepare("UPDATE insumos SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  return getInsumo(id);
}

/**
 * Registra un movimiento de existencias y actualiza el stock del insumo.
 *
 *  tipo = 'entrada'      -> cantidad en unidad de COMPRA. Recalcula costo promedio ponderado.
 *                          `proveedor` (opcional) guarda dónde se compró esta vez.
 *  tipo = 'merma'        -> cantidad en unidad BASE. Requiere motivo. No permite dejar stock negativo.
 *  tipo = 'ajuste'       -> `conteo` es el stock real contado (unidad BASE). Registra la diferencia.
 *  tipo = 'ajuste_costo' -> `costo_unitario` es el nuevo costo por unidad BASE. NO toca la
 *                          existencia; solo corrige el costo hacia adelante. Requiere `nota`.
 */
function registrarMovimiento(payload, actor = {}) {
  const db = getDb();
  const insumo = db.prepare('SELECT * FROM insumos WHERE id = ?').get(payload.insumoId);
  if (!insumo) throw new Error('El insumo no existe.');

  const tipo = payload.tipo;
  let cantidadBase;
  let cantidadCaptura;
  let unidadCaptura;
  let motivo = String(payload.motivo || '').trim();
  let costoUnitario = insumo.costo_unitario;
  const proveedor = String(payload.proveedor || '').trim();

  if (tipo === 'entrada') {
    cantidadCaptura = num(payload.cantidad, 0);
    if (cantidadCaptura <= 0) throw new Error('La cantidad de la entrada debe ser mayor a 0.');
    unidadCaptura = insumo.unidad_compra || insumo.unidad_base;
    cantidadBase = cantidadCaptura * insumo.factor_compra;

    // Costo de esta compra (por unidad de compra); si no se indica, usa el último.
    const costoCompra = payload.costo_compra != null ? num(payload.costo_compra, insumo.costo_compra) : insumo.costo_compra;
    const costoInBase = insumo.factor_compra > 0 ? costoCompra / insumo.factor_compra : 0;

    // Promedio ponderado.
    const stockPrev = insumo.stock;
    if (stockPrev + cantidadBase > 0 && costoInBase > 0) {
      costoUnitario = (stockPrev * insumo.costo_unitario + cantidadBase * costoInBase) / (stockPrev + cantidadBase);
    } else if (costoInBase > 0) {
      costoUnitario = costoInBase;
    }
    if (!motivo) motivo = 'Compra / recepción';

    db.prepare("UPDATE insumos SET costo_compra = ?, costo_unitario = ? WHERE id = ?")
      .run(costoCompra, costoUnitario, insumo.id);
  } else if (tipo === 'merma') {
    cantidadCaptura = num(payload.cantidad, 0);
    if (cantidadCaptura <= 0) throw new Error('La cantidad de merma debe ser mayor a 0.');
    if (!MERMA_MOTIVOS.some((m) => m.key === motivo)) {
      throw new Error('Selecciona un motivo de merma.');
    }
    unidadCaptura = insumo.unidad_base;
    cantidadBase = -cantidadCaptura;
    if (insumo.stock + cantidadBase < 0) {
      throw new Error(`No hay suficiente existencia. Stock actual: ${insumo.stock} ${insumo.unidad_base}.`);
    }
    if (payload.nota) motivo = `${motivo}: ${String(payload.nota).trim()}`;
  } else if (tipo === 'ajuste') {
    const conteo = num(payload.conteo, NaN);
    if (!Number.isFinite(conteo) || conteo < 0) throw new Error('Indica el conteo físico (0 o más).');
    unidadCaptura = insumo.unidad_base;
    cantidadCaptura = conteo;
    cantidadBase = conteo - insumo.stock; // diferencia con signo
    motivo = payload.nota ? `Conteo físico: ${String(payload.nota).trim()}` : 'Conteo físico';
  } else if (tipo === 'ajuste_costo') {
    const nuevoCosto = num(payload.costo_unitario, NaN);
    if (!Number.isFinite(nuevoCosto) || nuevoCosto <= 0) {
      throw new Error('Indica el nuevo costo por unidad base (mayor a 0).');
    }
    const nota = String(payload.nota || '').trim();
    if (!nota) throw new Error('Escribe el motivo de la corrección de costo.');
    unidadCaptura = `$/${insumo.unidad_base}`;
    cantidadCaptura = nuevoCosto;
    cantidadBase = 0; // no toca la existencia
    costoUnitario = nuevoCosto;
    motivo = `Corrección de costo: ${nota}`;
    db.prepare("UPDATE insumos SET costo_unitario = ?, updated_at = datetime('now') WHERE id = ?")
      .run(nuevoCosto, insumo.id);
  } else {
    throw new Error('Tipo de movimiento no válido.');
  }

  const stockResultante = insumo.stock + cantidadBase;

  const tx = db.transaction(() => {
    db.prepare("UPDATE insumos SET stock = ?, updated_at = datetime('now') WHERE id = ?")
      .run(stockResultante, insumo.id);
    db.prepare(
      `INSERT INTO inventory_movements
        (insumo_id, tipo, cantidad_base, cantidad_captura, unidad_captura,
         costo_unitario, motivo, referencia, proveedor, stock_resultante, user_id, username)
       VALUES (@insumo_id, @tipo, @cantidad_base, @cantidad_captura, @unidad_captura,
         @costo_unitario, @motivo, @referencia, @proveedor, @stock_resultante, @user_id, @username)`
    ).run({
      insumo_id: insumo.id,
      tipo,
      cantidad_base: cantidadBase,
      cantidad_captura: cantidadCaptura,
      unidad_captura: unidadCaptura,
      costo_unitario: costoUnitario,
      motivo,
      referencia: String(payload.referencia || ''),
      proveedor: tipo === 'entrada' ? proveedor : '',
      stock_resultante: stockResultante,
      user_id: actor.id || null,
      username: actor.username || '',
    });
  });
  tx();

  return { insumo: getInsumo(insumo.id), cantidadBase, stockResultante };
}

function listMovimientos({ insumoId, limit = 100 }) {
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  return getDb()
    .prepare(
      `SELECT id, tipo, cantidad_base, cantidad_captura, unidad_captura,
              costo_unitario, motivo, referencia, proveedor, stock_resultante, username,
              datetime(created_at, 'localtime') AS created_at
       FROM inventory_movements
       WHERE insumo_id = @insumoId
       ORDER BY id DESC
       LIMIT @limit`
    )
    .all({ insumoId: Number(insumoId), limit: lim });
}

module.exports = {
  listInsumos,
  listInsumoOptions,
  getInsumo,
  countBajoStock,
  createInsumo,
  updateInsumo,
  deactivateInsumo,
  activateInsumo,
  registrarMovimiento,
  listMovimientos,
};
