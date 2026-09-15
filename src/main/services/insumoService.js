'use strict';

const { getDb } = require('../db/connection');
const { isUnit, MERMA_MOTIVOS } = require('../inventory/units');
const { paginate } = require('./pagination');
const { buscarChoque } = require('./nombres');

const COLS = `
  i.id, i.nombre, i.categoria_id, i.unidad_base,
  i.unidad_compra, i.factor_compra, i.costo_compra, i.costo_unitario,
  i.stock, i.stock_minimo, i.notas, i.is_active,
  i.created_at, i.updated_at,
  c.nombre AS categoria_nombre,
  (i.stock <= i.stock_minimo) AS bajo_stock,
  -- Faltante: se vendió más de lo que había registrado. No es lo mismo que
  -- "por acabarse" y no debe confundirse con ello en la pantalla.
  (i.stock < 0) AS faltante
`;

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * Igual que `num`, pero avisa en vez de tragarse la basura: si el campo trae
 * texto (pasa al pegar de WhatsApp) antes quedaba en 0 o 1 sin decir nada y el
 * insumo terminaba valiendo $0 en el reporte de inversión.
 */
function numCampo(v, campo, def = 0) {
  if (v === undefined || v === null || String(v).trim() === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`"${campo}" debe ser un número.`);
  return n;
}

/**
 * El nombre del insumo es único "como lo lee una persona": "Café en grano",
 * "café en grano" y "CAFÉ EN GRANO" son el mismo insumo. Con dos fichas iguales
 * la existencia se parte: las recetas descuentan de una y las compras entran a
 * la otra. Ver `nombres.js` (el índice de la migración 014 es la red).
 */
function assertNombreLibre(db, nombre, exceptId = null) {
  const choque = buscarChoque(db.prepare('SELECT id, nombre, is_active FROM insumos').all(), nombre, exceptId);
  if (choque) {
    throw new Error(choque.is_active
      ? 'Ya existe un insumo con ese nombre.'
      : 'Ya existe un insumo con ese nombre, dado de baja. Reactívalo en vez de crear otro.');
  }
}

/** La categoría debe existir; si no, el mensaje lo explica (antes salía el error de la BD). */
function assertCategoria(db, categoriaId) {
  if (!categoriaId) return;
  if (!db.prepare('SELECT id FROM insumo_categorias WHERE id = ?').get(categoriaId)) {
    throw new Error('La categoría seleccionada no existe.');
  }
}

/**
 * Lista, en lenguaje llano, por qué un insumo ya no está "en blanco".
 * Se usa para no dejar cambiarle la unidad base a medio camino.
 */
function enUso(db, id) {
  const uno = (sql) => db.prepare(sql).get(id).n;
  const razones = [];
  const insumo = db.prepare('SELECT stock FROM insumos WHERE id = ?').get(id);
  if (insumo && insumo.stock !== 0) razones.push(`tiene existencia (${insumo.stock})`);
  if (uno('SELECT COUNT(*) n FROM inventory_movements WHERE insumo_id = ?')) razones.push('ya tiene movimientos registrados');
  const recetas =
    uno('SELECT COUNT(*) n FROM receta_items WHERE insumo_id = ?') +
    uno('SELECT COUNT(*) n FROM modificador_items WHERE insumo_id = ?') +
    uno('SELECT COUNT(*) n FROM receta_grupo_opciones WHERE insumo_id = ?');
  if (recetas) razones.push(`se usa en ${recetas} receta(s)`);
  return razones;
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

/** Insumos con existencia negativa: salió más de lo que se había registrado. */
function countFaltantes() {
  return getDb()
    .prepare('SELECT COUNT(*) c FROM insumos WHERE is_active = 1 AND stock < 0')
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
    out.factor_compra = numCampo(data.factor_compra, 'Rinde (en unidad base)', 1);
    if (out.factor_compra <= 0) throw new Error('El factor de compra debe ser mayor a 0.');
  }
  if (data.costo_compra !== undefined || !partial) {
    out.costo_compra = numCampo(data.costo_compra, 'Costo de compra', 0);
    if (out.costo_compra < 0) throw new Error('El costo de compra no puede ser negativo.');
  }
  if (data.stock_minimo !== undefined || !partial) {
    out.stock_minimo = numCampo(data.stock_minimo, 'Stock mínimo', 0);
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
  const stockInicialCompra = numCampo(data.stock_inicial_compra, 'Existencia inicial', 0);
  if (stockInicialCompra < 0) throw new Error('La existencia inicial no puede ser negativa.');
  assertNombreLibre(db, c.nombre);
  assertCategoria(db, c.categoria_id);

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
  if (c.nombre !== undefined) assertNombreLibre(db, c.nombre, Number(id));
  if (c.categoria_id !== undefined) assertCategoria(db, c.categoria_id);

  // La unidad base es la moneda del insumo: el stock, las recetas y los
  // movimientos ya registrados están en ella. Cambiarla no convierte nada
  // (2000 g se volverían 2000 ml), así que solo se permite mientras el insumo
  // esté "en blanco": sin existencia, sin movimientos y sin usarse en recetas.
  if (c.unidad_base !== undefined && c.unidad_base !== insumo.unidad_base) {
    const usos = enUso(db, id);
    if (usos.length) {
      throw new Error(
        `No se puede cambiar la unidad de "${insumo.nombre}" (${insumo.unidad_base} → ${c.unidad_base}) porque ${usos.join(' y ')}. ` +
        'La existencia y las recetas quedarían en la unidad equivocada. Da de baja este insumo y crea uno nuevo con la unidad correcta.'
      );
    }
  }

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
 *  tipo = 'ajuste_costo' -> `costo_compra` es el nuevo precio de UNA presentación de compra
 *                          (el kilo, el paquete, la botella de 1.2 L); el costo por unidad base
 *                          se calcula dividiendo entre lo que rinde. NO toca la
 *                          existencia; solo corrige el costo hacia adelante. Requiere `nota`.
 */
function registrarMovimiento(payload, actor = {}) {
  const db = getDb();
  const insumo = db.prepare('SELECT * FROM insumos WHERE id = ?').get(payload.insumoId);
  if (!insumo) throw new Error('El insumo no existe.');
  // Un insumo de baja ya no se ofrece en recetas: lo que entre aquí nunca sale.
  if (!insumo.is_active) {
    throw new Error(`"${insumo.nombre}" está dado de baja. Reactívalo para poder mover su existencia.`);
  }

  const tipo = payload.tipo;
  let cantidadBase;
  let cantidadCaptura;
  let unidadCaptura;
  let motivo = String(payload.motivo || '').trim();
  let costoUnitario = insumo.costo_unitario;
  const proveedor = String(payload.proveedor || '').trim();

  if (tipo === 'entrada') {
    cantidadCaptura = numCampo(payload.cantidad, 'Cantidad', 0);
    if (cantidadCaptura <= 0) throw new Error('La cantidad de la entrada debe ser mayor a 0.');
    unidadCaptura = insumo.unidad_compra || insumo.unidad_base;
    cantidadBase = cantidadCaptura * insumo.factor_compra;

    // Costo de ESTA compra (por unidad de compra). Si el campo viene vacío se
    // conserva el último costo conocido; si viene capturado se usa tal cual,
    // incluido el 0 (mercancía de regalo), que sí debe bajar el promedio.
    const capturado = payload.costo_compra !== undefined && payload.costo_compra !== null
      && String(payload.costo_compra).trim() !== '';
    const costoCompra = capturado ? numCampo(payload.costo_compra, 'Costo de compra') : insumo.costo_compra;
    if (costoCompra < 0) throw new Error('El costo de compra no puede ser negativo.');
    const costoInBase = insumo.factor_compra > 0 ? costoCompra / insumo.factor_compra : 0;

    // Promedio ponderado. Un stock NEGATIVO no es existencia: es un faltante sin
    // registrar. Si entrara al promedio se comería parte del valor de lo que se
    // acaba de comprar e inflaría el costo de todo (con -45 galletas, comprar a
    // $1.30 daba $1.3441). Para el promedio cuenta como cero.
    const stockPrev = Math.max(0, insumo.stock);
    if (stockPrev + cantidadBase > 0) {
      costoUnitario = (stockPrev * insumo.costo_unitario + cantidadBase * costoInBase) / (stockPrev + cantidadBase);
    } else {
      costoUnitario = costoInBase;
    }
    if (!motivo) motivo = 'Compra / recepción';

    db.prepare("UPDATE insumos SET costo_compra = ?, costo_unitario = ? WHERE id = ?")
      .run(costoCompra, costoUnitario, insumo.id);
  } else if (tipo === 'merma') {
    cantidadCaptura = numCampo(payload.cantidad, 'Cantidad perdida', 0);
    if (cantidadCaptura <= 0) throw new Error('La cantidad de merma debe ser mayor a 0.');
    if (!MERMA_MOTIVOS.some((m) => m.key === motivo)) {
      throw new Error('Selecciona un motivo de merma.');
    }
    unidadCaptura = insumo.unidad_base;
    cantidadBase = -cantidadCaptura;
    if (insumo.stock + cantidadBase < 0) {
      throw new Error(insumo.stock < 0
        ? `"${insumo.nombre}" está en ${insumo.stock} ${insumo.unidad_base}: hay un faltante sin registrar. `
          + 'Haz un conteo físico o registra la compra que falta antes de capturar la merma.'
        : `No hay suficiente existencia. Stock actual: ${insumo.stock} ${insumo.unidad_base}.`);
    }
    if (payload.nota) motivo = `${motivo}: ${String(payload.nota).trim()}`;
  } else if (tipo === 'ajuste') {
    const conteo = numCampo(payload.conteo, 'Conteo físico', NaN);
    if (!Number.isFinite(conteo) || conteo < 0) throw new Error('Indica el conteo físico (0 o más).');
    unidadCaptura = insumo.unidad_base;
    cantidadCaptura = conteo;
    cantidadBase = conteo - insumo.stock; // diferencia con signo
    motivo = payload.nota ? `Conteo físico: ${String(payload.nota).trim()}` : 'Conteo físico';
  } else if (tipo === 'ajuste_costo') {
    // Se captura el precio de la PRESENTACIÓN, igual que en una entrada: pedir
    // "cuánto cuesta un gramo" obligaba a dividir entre 1000 de cabeza, y un 400
    // escrito en vez de 0.40 multiplicaba por mil el costo de todo el menú.
    const precio = numCampo(payload.costo_compra, 'Nuevo precio', NaN);
    if (!Number.isFinite(precio) || precio <= 0) {
      throw new Error('Indica el nuevo precio de compra (mayor a 0).');
    }
    const nota = String(payload.nota || '').trim();
    if (!nota) throw new Error('Escribe el motivo de la corrección de costo.');
    const nuevoCosto = precio / (insumo.factor_compra > 0 ? insumo.factor_compra : 1);
    unidadCaptura = insumo.unidad_compra || insumo.unidad_base;
    cantidadCaptura = precio;
    cantidadBase = 0; // no toca la existencia
    costoUnitario = nuevoCosto;
    motivo = `Corrección de costo: ${nota}`;
    // También queda como el precio vigente de la presentación: la próxima
    // entrada ya viene prellenada con él.
    db.prepare("UPDATE insumos SET costo_compra = ?, costo_unitario = ?, updated_at = datetime('now') WHERE id = ?")
      .run(precio, nuevoCosto, insumo.id);
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
  countFaltantes,
  createInsumo,
  updateInsumo,
  deactivateInsumo,
  activateInsumo,
  registrarMovimiento,
  listMovimientos,
};
