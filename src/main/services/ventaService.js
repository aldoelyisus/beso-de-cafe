'use strict';

const { getDb } = require('../db/connection');
const productoService = require('./productoService');
const modificadorService = require('./modificadorService');
const promocionService = require('./promocionService');

const METODOS = ['efectivo', 'transferencia'];

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ============ Inventario (consumo / devolución) ============
function moverInventario(db, { insumoId, cantidadBase, tipo, referencia, motivo, actor }) {
  const insumo = db.prepare('SELECT stock, unidad_base, costo_unitario FROM insumos WHERE id = ?').get(insumoId);
  if (!insumo) return;
  const delta = tipo === 'consumo' ? -Math.abs(cantidadBase) : Math.abs(cantidadBase);
  const nuevo = insumo.stock + delta;
  db.prepare("UPDATE insumos SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(nuevo, insumoId);
  db.prepare(
    `INSERT INTO inventory_movements
      (insumo_id, tipo, cantidad_base, cantidad_captura, unidad_captura, costo_unitario,
       motivo, referencia, stock_resultante, user_id, username)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(insumoId, tipo, delta, Math.abs(cantidadBase), insumo.unidad_base, insumo.costo_unitario,
    motivo || (tipo === 'consumo' ? 'Venta' : 'Cancelación de venta'), referencia, nuevo,
    actor.id || null, actor.username || '');
  // Una venta NUNCA se frena por el inventario: el producto existe aunque el
  // conteo diga que no, y dejar a un cliente sin cobrar cuesta más que el
  // descuadre. Se devuelve el resultado para poder AVISAR del faltante.
  return { stock: nuevo, unidad: insumo.unidad_base };
}

/** Insumos que consume un item, ya resueltos los grupos de opción y el modo (aquí / para llevar). */
function calcularConsumo(presentacion, paraLlevar, modificadorIds, opcionesMap) {
  const modos = paraLlevar ? ['siempre', 'llevar'] : ['siempre', 'aqui'];
  const acc = new Map();
  const add = (id, c) => { if (id && c > 0) acc.set(id, (acc.get(id) || 0) + c); };

  for (const r of presentacion.receta || []) {
    if (modos.includes(r.modo)) add(r.insumo_id, r.cantidad_base);
  }
  for (const g of presentacion.grupos || []) {
    if (!modos.includes(g.modo)) continue;
    let insumoId = opcionesMap[g.id] != null ? Number(opcionesMap[g.id]) : (g.insumo_default_id || (g.opciones[0] && g.opciones[0].insumo_id));
    const valida = (g.opciones || []).some((o) => o.insumo_id === insumoId);
    if (!valida) insumoId = g.insumo_default_id || (g.opciones[0] && g.opciones[0].insumo_id);
    add(insumoId, g.cantidad_base);
  }
  for (const mid of modificadorIds || []) {
    const mod = modificadorService.getModificador(Number(mid));
    if (mod) for (const it of mod.items) add(it.insumo_id, it.cantidad_base);
  }
  return [...acc.entries()].map(([insumo_id, cantidad_base]) => ({ insumo_id, cantidad_base }));
}

// ============ Lectura ============
function itemTotal(it) {
  return round2(it.precio_unitario + (it.modificadores || []).reduce((s, m) => s + m.precio_extra, 0));
}

/** Renglones activos como los necesita el evaluador de promociones. */
function itemsParaPromo(db, ventaId) {
  return db.prepare(
    `SELECT vi.producto_id, p.categoria_id, vi.precio_unitario,
            (SELECT COALESCE(SUM(precio_extra), 0) FROM venta_item_modificadores WHERE venta_item_id = vi.id) AS extras
     FROM venta_items vi LEFT JOIN productos p ON p.id = vi.producto_id
     WHERE vi.venta_id = ? AND vi.estado = 'activo'`
  ).all(ventaId).map((r) => ({
    producto_id: r.producto_id,
    categoria_id: r.categoria_id,
    total: round2(r.precio_unitario + r.extras),
  }));
}

/** Recalcula ventas.descuento a partir de la promo aplicada. Solo si aún no hay pagos. */
function recalcularDescuento(db, ventaId) {
  const v = db.prepare('SELECT promocion_id FROM ventas WHERE id = ?').get(ventaId);
  if (!v) return;
  const hayPagos = db.prepare('SELECT COUNT(*) c FROM venta_pagos WHERE venta_id = ?').get(ventaId).c > 0;
  if (hayPagos) return; // el descuento ya quedó fijado al primer cobro
  let d = 0;
  if (v.promocion_id) {
    const promo = promocionService.getPromocion(v.promocion_id);
    if (promo && promocionService.vigenteHoy(promo)) {
      const r = promocionService.calcular(promo, itemsParaPromo(db, ventaId));
      if (r.aplica) d = r.descuento;
    }
  }
  const total = itemsParaPromo(db, ventaId).reduce((s, i) => s + i.total, 0);
  db.prepare('UPDATE ventas SET descuento = ? WHERE id = ?').run(round2(Math.min(d, total)), ventaId);
}

function getVenta(id) {
  const db = getDb();
  const v = db.prepare(
    `SELECT ve.*, m.nombre AS mesa_nombre
     FROM ventas ve LEFT JOIN mesas m ON m.id = ve.mesa_id WHERE ve.id = ?`
  ).get(id);
  if (!v) return null;

  v.items = db.prepare('SELECT * FROM venta_items WHERE venta_id = ? ORDER BY id').all(id).map((it) => {
    it.modificadores = db.prepare('SELECT id, modificador_id, nombre, precio_extra FROM venta_item_modificadores WHERE venta_item_id = ?').all(it.id);
    it.opciones = db.prepare('SELECT grupo_nombre, insumo_id, insumo_nombre FROM venta_item_opciones WHERE venta_item_id = ?').all(it.id);
    it.total = itemTotal(it);
    return it;
  });
  v.pagos = db.prepare('SELECT id, monto, metodo, etiqueta, descuento, recibido, cambio, username, datetime(created_at, \'localtime\') AS created_at FROM venta_pagos WHERE venta_id = ? ORDER BY id').all(id);

  const activos = v.items.filter((i) => i.estado === 'activo');
  v.total = round2(activos.reduce((s, i) => s + i.total, 0));
  v.descuento = round2(Math.min(v.descuento || 0, v.total));
  v.total_final = round2(v.total - v.descuento);
  v.pagado = round2(v.pagos.reduce((s, p) => s + p.monto, 0));
  v.saldo = round2(v.total_final - v.pagado);
  v.items_sin_pagar = activos.filter((i) => i.pago_id == null).map((i) => i.id);
  v.promocion_aplica = !!v.promocion_id && v.descuento > 0;
  return v;
}

function listVentasAbiertas() {
  const db = getDb();
  const rows = db.prepare(
    `SELECT ve.id, ve.tipo, ve.mesa_id, m.nombre AS mesa_nombre, ve.username,
            datetime(ve.created_at, 'localtime') AS created_at
     FROM ventas ve LEFT JOIN mesas m ON m.id = ve.mesa_id
     WHERE ve.estado = 'abierta' ORDER BY ve.created_at`
  ).all();
  for (const r of rows) {
    const v = getVenta(r.id);
    r.num_items = v.items.filter((i) => i.estado === 'activo').length;
    r.total = v.total;
    r.saldo = v.saldo;
  }
  return rows;
}

function listHistorial({ page = 1, pageSize = 15, estado = null, search = null } = {}) {
  const db = getDb();
  const { paginate } = require('./pagination');
  const where = ["ve.estado != 'abierta'"];
  const params = {};
  if (estado && ['pagada', 'cancelada'].includes(estado)) { where.push('ve.estado = @estado'); params.estado = estado; }
  if (search) { where.push('(m.nombre LIKE @like OR ve.username LIKE @like OR CAST(ve.id AS TEXT) LIKE @like)'); params.like = `%${String(search).trim()}%`; }
  const whereSql = where.join(' AND ');

  const res = paginate({
    countSql: `SELECT COUNT(*) AS n FROM ventas ve LEFT JOIN mesas m ON m.id = ve.mesa_id WHERE ${whereSql}`,
    rowsSql: `
      SELECT ve.id, ve.tipo, ve.estado, ve.motivo_cancelacion, ve.username, m.nombre AS mesa_nombre,
             datetime(ve.created_at, 'localtime') AS created_at,
             datetime(ve.closed_at, 'localtime') AS closed_at
      FROM ventas ve LEFT JOIN mesas m ON m.id = ve.mesa_id
      WHERE ${whereSql}
      ORDER BY ve.closed_at DESC, ve.id DESC
      LIMIT @limit OFFSET @offset`,
    params, page, pageSize,
  });
  for (const r of res.rows) {
    const v = getVenta(r.id);
    r.total = v.total;             // subtotal, antes de la promoción
    r.descuento = v.descuento;
    r.total_final = v.total_final; // lo que de verdad se cobró
    r.promocion_id = v.promocion_id;
    r.promocion_nombre = v.promocion_nombre;
    r.pagado = v.pagado;
    r.pagos = v.pagos;
  }
  return res;
}

// ============ Escritura ============
function abrirVenta({ tipo = 'mesa', mesaId = null }, actor = {}) {
  const db = getDb();
  tipo = tipo === 'llevar' ? 'llevar' : 'mesa';
  if (tipo === 'mesa') {
    if (!mesaId) throw new Error('Elige una mesa.');
    const mesa = db.prepare('SELECT id, is_active FROM mesas WHERE id = ?').get(mesaId);
    if (!mesa || !mesa.is_active) throw new Error('La mesa no existe o está dada de baja.');
    const abierta = db.prepare("SELECT id FROM ventas WHERE mesa_id = ? AND estado = 'abierta'").get(mesaId);
    if (abierta) return getVenta(abierta.id); // cuenta unificada: una por mesa
  }
  const info = db.prepare(
    'INSERT INTO ventas (tipo, mesa_id, user_id, username) VALUES (?, ?, ?, ?)'
  ).run(tipo, tipo === 'mesa' ? mesaId : null, actor.id || null, actor.username || '');
  return getVenta(info.lastInsertRowid);
}

function agregarItem(ventaId, data, actor = {}) {
  const db = getDb();
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId);
  if (!venta) throw new Error('La cuenta no existe.');
  if (venta.estado !== 'abierta') throw new Error('La cuenta ya está cerrada.');

  const producto = data.productoId ? productoService.getProducto(Number(data.productoId)) : null;
  const presId = Number(data.presentacionId);
  let pres = null;
  let prod = producto;
  if (!prod) {
    // buscar el producto por la presentación
    const row = db.prepare('SELECT producto_id FROM producto_presentaciones WHERE id = ?').get(presId);
    if (!row) throw new Error('El tamaño del producto no existe.');
    prod = productoService.getProducto(row.producto_id);
  }
  pres = prod && prod.presentaciones.find((p) => p.id === presId);
  if (!prod || !pres) throw new Error('El producto o tamaño no existe.');
  if (!prod.is_active) throw new Error(`"${prod.nombre}" está dado de baja.`);
  if (prod.agotado) throw new Error(`"${prod.nombre}" está marcado como agotado.`);
  if (!pres.is_active) throw new Error(`El tamaño "${pres.nombre}" está dado de baja.`);
  if (pres.agotado) throw new Error(`"${prod.nombre} ${pres.nombre}" está agotado.`);
  if (pres.precio_actual == null) throw new Error(`"${prod.nombre} ${pres.nombre}" no tiene precio.`);

  const paraLlevar = data.paraLlevar ? 1 : 0;
  const cantidad = Math.max(1, Math.min(Number(data.cantidad) || 1, 50));

  // modificadores: solo los que admite el producto
  const admitidos = new Set(prod.modificadores.map((m) => m.id));
  const modIds = [...new Set((data.modificadorIds || []).map(Number).filter((x) => admitidos.has(x)))];
  const modSnap = modIds.map((id) => {
    const m = prod.modificadores.find((x) => x.id === id);
    return { id, nombre: m.nombre, precio_extra: m.precio_extra };
  });

  // opciones elegidas por grupo: { grupoId: insumoId }
  const opcionesMap = {};
  for (const g of pres.grupos || []) {
    const chosen = data.opciones && data.opciones[g.id] != null ? Number(data.opciones[g.id]) : (g.insumo_default_id || (g.opciones[0] && g.opciones[0].insumo_id));
    const ok = (g.opciones || []).some((o) => o.insumo_id === chosen);
    opcionesMap[g.id] = ok ? chosen : (g.insumo_default_id || (g.opciones[0] && g.opciones[0].insumo_id));
  }

  const consumo = calcularConsumo(pres, paraLlevar, modIds, opcionesMap);

  // Insumos que esta venta deja en negativo: no bloquean, pero se le avisan al
  // cajero para corregirlo el mismo día y no 45 galletas después.
  const faltantes = new Map();

  const tx = db.transaction(() => {
    for (let n = 0; n < cantidad; n++) {
      const itemId = db.prepare(
        `INSERT INTO venta_items
          (venta_id, producto_id, presentacion_id, producto_nombre, presentacion_nombre, precio_unitario, para_llevar)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(ventaId, prod.id, pres.id, prod.nombre, pres.nombre, pres.precio_actual, paraLlevar).lastInsertRowid;

      const insMod = db.prepare('INSERT INTO venta_item_modificadores (venta_item_id, modificador_id, nombre, precio_extra) VALUES (?, ?, ?, ?)');
      for (const m of modSnap) insMod.run(itemId, m.id, m.nombre, m.precio_extra);

      const insOpc = db.prepare('INSERT INTO venta_item_opciones (venta_item_id, grupo_nombre, insumo_id, insumo_nombre) VALUES (?, ?, ?, ?)');
      for (const g of pres.grupos || []) {
        const insumoId = opcionesMap[g.id];
        const opt = (g.opciones || []).find((o) => o.insumo_id === insumoId);
        insOpc.run(itemId, g.nombre, insumoId || null, opt ? opt.insumo_nombre : '(sin opción)');
      }

      const insCons = db.prepare('INSERT INTO venta_item_consumo (venta_item_id, insumo_id, cantidad_base, costo_unitario) VALUES (?, ?, ?, ?)');
      for (const c of consumo) {
        const cu = (db.prepare('SELECT costo_unitario FROM insumos WHERE id = ?').get(c.insumo_id) || {}).costo_unitario || 0;
        insCons.run(itemId, c.insumo_id, c.cantidad_base, cu);
        const res = moverInventario(db, { insumoId: c.insumo_id, cantidadBase: c.cantidad_base, tipo: 'consumo', referencia: `Venta #${ventaId} · item #${itemId}`, actor });
        if (res && res.stock < 0) {
          const nom = (db.prepare('SELECT nombre FROM insumos WHERE id = ?').get(c.insumo_id) || {}).nombre || '';
          faltantes.set(c.insumo_id, { nombre: nom, stock: res.stock, unidad: res.unidad });
        }
      }
    }
    recalcularDescuento(db, ventaId);
  });
  tx();
  const v = getVenta(ventaId);
  v.faltantes = [...faltantes.values()];
  return v;
}

function devolverConsumoDeItem(db, itemId, actor) {
  const rows = db.prepare('SELECT id, insumo_id, cantidad_base FROM venta_item_consumo WHERE venta_item_id = ? AND devuelto = 0').all(itemId);
  for (const r of rows) {
    moverInventario(db, { insumoId: r.insumo_id, cantidadBase: r.cantidad_base, tipo: 'devolucion', referencia: `Cancelación item #${itemId}`, actor });
    db.prepare('UPDATE venta_item_consumo SET devuelto = 1 WHERE id = ?').run(r.id);
  }
}

function cancelarItem(ventaId, itemId, motivo, actor = {}) {
  const db = getDb();
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId);
  if (!venta) throw new Error('La cuenta no existe.');
  if (venta.estado !== 'abierta') throw new Error('La cuenta ya está cerrada. Usa el historial para cancelar la venta.');
  const item = db.prepare('SELECT * FROM venta_items WHERE id = ? AND venta_id = ?').get(itemId, ventaId);
  if (!item) throw new Error('El producto no existe en esta cuenta.');
  if (item.estado !== 'activo') throw new Error('Ese producto ya estaba cancelado.');
  if (item.pago_id != null) throw new Error('Ese producto ya está pagado; no se puede cancelar.');

  const tx = db.transaction(() => {
    db.prepare("UPDATE venta_items SET estado = 'cancelado', motivo_cancelacion = ? WHERE id = ?").run(String(motivo || ''), itemId);
    devolverConsumoDeItem(db, itemId, actor); // los insumos regresan (pregunta 16)
    recalcularDescuento(db, ventaId);
    cerrarSiYaNoDebeNada(db, ventaId);
  });
  tx();
  return getVenta(ventaId);
}

/**
 * Cierra la cuenta si ya no queda nada por cobrar y algo se cobró.
 *
 * Cobrar lo hace por su cuenta, pero cancelar también puede dejar la cuenta
 * saldada: se cobra un producto, se cancelan los demás, y entonces no queda
 * ningún pendiente. Eso dejaba la cuenta abierta para siempre, sin manera de
 * sacarla: el renglón pagado no se puede cancelar, y el día no cierra mientras
 * haya cuentas abiertas. La única salida era anular una venta de verdad.
 *
 * Una cuenta sin pagos NO se cierra aquí: cancelar todo deja la cuenta vacía,
 * lista para seguir pidiendo, que es lo que se espera al borrarse un error.
 */
function cerrarSiYaNoDebeNada(db, ventaId) {
  const pendientes = db.prepare(
    "SELECT COUNT(*) c FROM venta_items WHERE venta_id = ? AND estado = 'activo' AND pago_id IS NULL"
  ).get(ventaId).c;
  if (pendientes > 0) return false;

  const pagos = db.prepare('SELECT COUNT(*) c FROM venta_pagos WHERE venta_id = ?').get(ventaId).c;
  if (pagos === 0) return false;

  db.prepare("UPDATE ventas SET estado = 'pagada', closed_at = datetime('now') WHERE id = ? AND estado = 'abierta'").run(ventaId);
  return true;
}

function aplicarPromocion(ventaId, promocionId, actor = {}) {
  const db = getDb();
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId);
  if (!venta) throw new Error('La cuenta no existe.');
  if (venta.estado !== 'abierta') throw new Error('La cuenta ya está cerrada.');
  if (db.prepare('SELECT COUNT(*) c FROM venta_pagos WHERE venta_id = ?').get(ventaId).c > 0) {
    throw new Error('La cuenta ya tiene pagos; no se puede cambiar la promoción.');
  }
  const promo = promocionService.getPromocion(promocionId);
  if (!promo) throw new Error('La promoción no existe.');
  if (!promocionService.vigenteHoy(promo)) throw new Error('La promoción no está vigente hoy.');
  const r = promocionService.calcular(promo, itemsParaPromo(db, ventaId));
  if (!r.aplica) throw new Error('Esta cuenta no cumple las condiciones de la promoción.');

  const tx = db.transaction(() => {
    db.prepare('UPDATE ventas SET promocion_id = ?, promocion_nombre = ? WHERE id = ?').run(promo.id, promo.nombre, ventaId);
    recalcularDescuento(db, ventaId);
  });
  tx();
  return getVenta(ventaId);
}

function quitarPromocion(ventaId) {
  const db = getDb();
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId);
  if (!venta) throw new Error('La cuenta no existe.');
  if (venta.estado !== 'abierta') throw new Error('La cuenta ya está cerrada.');
  if (db.prepare('SELECT COUNT(*) c FROM venta_pagos WHERE venta_id = ?').get(ventaId).c > 0) {
    throw new Error('La cuenta ya tiene pagos; no se puede quitar la promoción.');
  }
  db.prepare("UPDATE ventas SET promocion_id = NULL, promocion_nombre = '', descuento = 0 WHERE id = ?").run(ventaId);
  return getVenta(ventaId);
}

/** Promociones vigentes hoy que además cumplen las condiciones de esta cuenta. */
function listPromocionesAplicables(ventaId) {
  const db = getDb();
  const venta = db.prepare('SELECT id FROM ventas WHERE id = ?').get(ventaId);
  if (!venta) return [];
  const items = itemsParaPromo(db, ventaId);
  const out = [];
  const promos = db.prepare("SELECT id FROM promociones WHERE is_active = 1").all();
  for (const { id } of promos) {
    const promo = promocionService.getPromocion(id);
    if (!promocionService.vigenteHoy(promo)) continue;
    const r = promocionService.calcular(promo, items);
    if (r.aplica) {
      out.push({
        id: promo.id, nombre: promo.nombre, tipo: promo.tipo, descripcion: promo.descripcion,
        descuento: r.descuento, detalle: r.detalle,
      });
    }
  }
  return out.sort((a, b) => b.descuento - a.descuento);
}

function cobrar(ventaId, { itemIds, metodo, etiqueta = '', recibido = null }, actor = {}) {
  const db = getDb();
  const cajaService = require('./cajaService');
  const cierreService = require('./cierreService');
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId);
  if (!venta) throw new Error('La cuenta no existe.');
  if (venta.estado !== 'abierta') throw new Error('La cuenta ya está cerrada.');
  if (!METODOS.includes(metodo)) throw new Error('Método de pago no válido.');

  if (cierreService.diaCerrado(cierreService.hoyISO())) {
    throw new Error('El día de hoy ya está cerrado. Reábrelo desde Corte de caja para poder cobrar.');
  }
  const corte = cajaService.corteAbiertoRow();
  if (metodo === 'efectivo' && !corte) {
    throw new Error('Abre la caja (Ventas → Corte de caja) antes de cobrar en efectivo.');
  }
  const corteId = corte ? corte.id : null;

  const ids = [...new Set((itemIds || []).map(Number).filter(Boolean))];
  if (!ids.length) throw new Error('Elige al menos un producto para cobrar.');

  const items = ids.map((id) => {
    const it = db.prepare('SELECT * FROM venta_items WHERE id = ? AND venta_id = ?').get(id, ventaId);
    if (!it) throw new Error('Un producto no pertenece a esta cuenta.');
    if (it.estado !== 'activo') throw new Error('Un producto seleccionado está cancelado.');
    if (it.pago_id != null) throw new Error('Un producto seleccionado ya estaba pagado.');
    it.modificadores = db.prepare('SELECT precio_extra FROM venta_item_modificadores WHERE venta_item_id = ?').all(it.id);
    return it;
  });
  const subtotal = round2(items.reduce((s, it) => s + itemTotal(it), 0));
  // absorber el descuento de la promoción (lo que quede pendiente), sin pasarse del subtotal
  const descUsado = round2(db.prepare('SELECT COALESCE(SUM(descuento), 0) AS d FROM venta_pagos WHERE venta_id = ?').get(ventaId).d);
  const descPendiente = round2(Math.max(0, (venta.descuento || 0) - descUsado));
  const descEstePago = round2(Math.min(descPendiente, subtotal));
  const monto = round2(subtotal - descEstePago);

  // efectivo recibido / cambio a dar
  let recibidoVal = null;
  let cambioVal = 0;
  if (metodo === 'efectivo' && recibido != null && recibido !== '') {
    recibidoVal = num(recibido, 0);
    if (recibidoVal < monto - 1e-6) {
      throw new Error(`El efectivo recibido (${recibidoVal.toFixed(2)}) no alcanza. Faltan ${round2(monto - recibidoVal).toFixed(2)}.`);
    }
    cambioVal = round2(recibidoVal - monto);
  }

  const tx = db.transaction(() => {
    const pagoId = db.prepare(
      'INSERT INTO venta_pagos (venta_id, monto, metodo, etiqueta, descuento, recibido, cambio, corte_id, user_id, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(ventaId, monto, metodo, String(etiqueta || ''), descEstePago, recibidoVal, cambioVal, corteId, actor.id || null, actor.username || '').lastInsertRowid;
    const upd = db.prepare('UPDATE venta_items SET pago_id = ? WHERE id = ?');
    for (const it of items) upd.run(pagoId, it.id);

    const quedan = db.prepare("SELECT COUNT(*) c FROM venta_items WHERE venta_id = ? AND estado = 'activo' AND pago_id IS NULL").get(ventaId).c;
    if (quedan === 0) {
      db.prepare("UPDATE ventas SET estado = 'pagada', closed_at = datetime('now') WHERE id = ?").run(ventaId);
    }
  });
  tx();
  return getVenta(ventaId);
}

function cancelarVenta(ventaId, motivo, actor = {}) {
  const db = getDb();
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId);
  if (!venta) throw new Error('La cuenta no existe.');
  if (venta.estado === 'cancelada') throw new Error('La venta ya está cancelada.');

  const pagos = db.prepare('SELECT COUNT(*) c FROM venta_pagos WHERE venta_id = ?').get(ventaId).c;
  if (venta.estado === 'abierta' && pagos > 0) {
    throw new Error('La cuenta tiene pagos parciales. Cancela producto por producto o termina de cobrarla.');
  }

  const tx = db.transaction(() => {
    const items = db.prepare("SELECT id FROM venta_items WHERE venta_id = ? AND estado = 'activo'").all(ventaId);
    for (const it of items) {
      db.prepare("UPDATE venta_items SET estado = 'cancelado', motivo_cancelacion = ? WHERE id = ?").run(String(motivo || ''), it.id);
      devolverConsumoDeItem(db, it.id, actor);
    }
    db.prepare("UPDATE ventas SET estado = 'cancelada', motivo_cancelacion = ?, closed_at = datetime('now') WHERE id = ?")
      .run(String(motivo || ''), ventaId);
  });
  tx();
  return getVenta(ventaId);
}

/**
 * Aplica a UN renglón la diferencia de receta entre "aquí" y "para llevar".
 *
 * No se recalcula el consumo entero: se aplica solo la DIFERENCIA entre los dos
 * modos, así los renglones de modo `siempre` y los modificadores no se tocan.
 * Devuelve true si además del cambio de marca hubo movimiento de inventario.
 */
function ajustarModoItem(db, item, paraLlevar, actor) {
  db.prepare('UPDATE venta_items SET para_llevar = ? WHERE id = ?').run(paraLlevar, item.id);

  const prod = item.producto_id ? productoService.getProducto(item.producto_id) : null;
  const pres = prod && prod.presentaciones.find((p) => p.id === item.presentacion_id);
  if (!pres) return false; // sin receta que consultar: solo queda el cambio de marca

  const modIds = db.prepare('SELECT modificador_id FROM venta_item_modificadores WHERE venta_item_id = ?')
    .all(item.id).map((r) => r.modificador_id).filter(Boolean);

  // La opción que se eligió en cada grupo quedó guardada en el renglón: se
  // respeta, para no cambiarle la leche al cliente al pasar la cuenta a llevar.
  const elegidas = db.prepare('SELECT grupo_nombre, insumo_id FROM venta_item_opciones WHERE venta_item_id = ?').all(item.id);
  const opcionesMap = {};
  for (const g of pres.grupos || []) {
    const e = elegidas.find((x) => x.grupo_nombre === g.nombre);
    if (e && e.insumo_id) opcionesMap[g.id] = e.insumo_id;
  }

  const mapa = (pl) => new Map(calcularConsumo(pres, pl, modIds, opcionesMap).map((c) => [c.insumo_id, c.cantidad_base]));
  const antes = mapa(item.para_llevar ? 1 : 0);
  const despues = mapa(paraLlevar);

  const referencia = `Cuenta #${item.venta_id} · item #${item.id}`;
  const motivo = paraLlevar ? 'Pasó a para llevar' : 'Pasó a servir aquí';
  let hubo = false;

  for (const insumoId of new Set([...antes.keys(), ...despues.keys()])) {
    const delta = (despues.get(insumoId) || 0) - (antes.get(insumoId) || 0);
    if (Math.abs(delta) < 1e-9) continue;
    hubo = true;
    const fila = db.prepare(
      'SELECT id, cantidad_base FROM venta_item_consumo WHERE venta_item_id = ? AND insumo_id = ? AND devuelto = 0'
    ).get(item.id, insumoId);

    if (delta > 0) {
      // Lo que pide el modo nuevo (el vaso desechable) sale del inventario.
      moverInventario(db, { insumoId, cantidadBase: delta, tipo: 'consumo', motivo, referencia, actor });
      if (fila) {
        db.prepare('UPDATE venta_item_consumo SET cantidad_base = ? WHERE id = ?').run(fila.cantidad_base + delta, fila.id);
      } else {
        const cu = (db.prepare('SELECT costo_unitario FROM insumos WHERE id = ?').get(insumoId) || {}).costo_unitario || 0;
        db.prepare('INSERT INTO venta_item_consumo (venta_item_id, insumo_id, cantidad_base, costo_unitario) VALUES (?, ?, ?, ?)')
          .run(item.id, insumoId, delta, cu);
      }
    } else {
      // Lo que solo pedía el modo viejo (la taza, el plato) regresa.
      const devuelto = -delta;
      moverInventario(db, { insumoId, cantidadBase: devuelto, tipo: 'devolucion', motivo, referencia, actor });
      if (fila) {
        const resto = fila.cantidad_base - devuelto;
        if (resto > 1e-9) db.prepare('UPDATE venta_item_consumo SET cantidad_base = ? WHERE id = ?').run(resto, fila.id);
        else db.prepare('DELETE FROM venta_item_consumo WHERE id = ?').run(fila.id);
      }
    }
  }
  return hubo;
}

/**
 * Cambia el destino de una cuenta ABIERTA: de mesa a "para llevar", de vuelta a
 * una mesa, o de una mesa a otra.
 *
 * El caso real es el primero: la mesa se tiene que retirar y lo que ya se
 * preparó se pasa a vasos desechables. No basta con cambiar la bandera, porque
 * los renglones ya descontaron inventario con la receta de "aquí" (que no gasta
 * vaso): hay que aplicarles la diferencia. La mesa queda libre en el mapa.
 */
function cambiarTipoVenta(ventaId, { tipo, mesaId = null }, actor = {}) {
  const db = getDb();
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId);
  if (!venta) throw new Error('La cuenta no existe.');
  if (venta.estado !== 'abierta') {
    throw new Error('Esta cuenta ya está cerrada. Solo se puede mover una cuenta abierta.');
  }

  const nuevoTipo = tipo === 'llevar' ? 'llevar' : 'mesa';
  let nuevaMesaId = null;
  if (nuevoTipo === 'mesa') {
    nuevaMesaId = Number(mesaId) || null;
    if (!nuevaMesaId) throw new Error('Elige la mesa a la que pasa la cuenta.');
    const mesa = db.prepare('SELECT id, nombre, is_active FROM mesas WHERE id = ?').get(nuevaMesaId);
    if (!mesa || !mesa.is_active) throw new Error('La mesa no existe o está dada de baja.');
    // Una mesa lleva una sola cuenta (cuenta unificada, pregunta 13).
    const ocupada = db.prepare("SELECT id FROM ventas WHERE mesa_id = ? AND estado = 'abierta' AND id <> ?").get(nuevaMesaId, ventaId);
    if (ocupada) {
      throw new Error(`La mesa "${mesa.nombre}" ya tiene abierta la cuenta #${ocupada.id}. Cóbrala primero o elige otra mesa.`);
    }
  }

  if (nuevoTipo === venta.tipo && Number(nuevaMesaId || 0) === Number(venta.mesa_id || 0)) {
    throw new Error(nuevoTipo === 'llevar'
      ? 'Esta cuenta ya es para llevar.'
      : 'La cuenta ya está en esa mesa.');
  }

  // Los renglones se preparan según el destino de la cuenta. Los cancelados no:
  // ya devolvieron sus insumos y no se van a servir.
  const paraLlevar = nuevoTipo === 'llevar' ? 1 : 0;
  const porConvertir = db.prepare(
    "SELECT * FROM venta_items WHERE venta_id = ? AND estado = 'activo' AND para_llevar <> ? ORDER BY id"
  ).all(ventaId, paraLlevar);

  const tx = db.transaction(() => {
    let conMovimiento = 0;
    for (const it of porConvertir) if (ajustarModoItem(db, it, paraLlevar, actor)) conMovimiento++;
    db.prepare("UPDATE ventas SET tipo = ?, mesa_id = ? WHERE id = ?")
      .run(nuevoTipo, nuevoTipo === 'mesa' ? nuevaMesaId : null, ventaId);
    return conMovimiento;
  });
  const conMovimiento = tx();

  const v = getVenta(ventaId);
  v.items_convertidos = porConvertir.length;
  v.items_con_movimiento = conMovimiento;
  v.desde = { tipo: venta.tipo, mesa_id: venta.mesa_id };
  return v;
}

module.exports = {
  METODOS,
  getVenta, listVentasAbiertas, listHistorial,
  abrirVenta, agregarItem, cancelarItem, cobrar, cancelarVenta, cambiarTipoVenta,
  aplicarPromocion, quitarPromocion, listPromocionesAplicables,
};
