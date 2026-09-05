'use strict';

const { getDb } = require('../db/connection');
const { paginate } = require('./pagination');

const TIPOS = ['combo', 'dia', 'monto_fijo'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function num(v, def = 0) { const n = Number(v); return Number.isFinite(n) ? n : def; }
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const hoyISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

// ---------------- CRUD ----------------
function hidratar(p) {
  if (!p) return null;
  p.productos = getDb().prepare(
    `SELECT pp.producto_id, pr.nombre
     FROM promocion_productos pp JOIN productos pr ON pr.id = pp.producto_id
     WHERE pp.promocion_id = ? ORDER BY pr.nombre`
  ).all(p.id);
  p.categoria_nombre = p.categoria_id
    ? (getDb().prepare('SELECT nombre FROM producto_categorias WHERE id = ?').get(p.categoria_id) || {}).nombre || null
    : null;
  return p;
}

function getPromocion(id) {
  return hidratar(getDb().prepare('SELECT * FROM promociones WHERE id = ?').get(id));
}

function listPromociones({ page = 1, pageSize = 15, search = null, includeInactive = true, tipo = null } = {}) {
  const where = ['1=1'];
  const params = {};
  if (!includeInactive) where.push('p.is_active = 1');
  if (search) { where.push('p.nombre LIKE @like'); params.like = `%${String(search).trim()}%`; }
  if (tipo && TIPOS.includes(tipo)) { where.push('p.tipo = @tipo'); params.tipo = tipo; }
  const whereSql = where.join(' AND ');

  const res = paginate({
    countSql: `SELECT COUNT(*) AS n FROM promociones p WHERE ${whereSql}`,
    rowsSql: `SELECT p.* FROM promociones p WHERE ${whereSql}
              ORDER BY p.is_active DESC, p.fecha_fin DESC, p.nombre
              LIMIT @limit OFFSET @offset`,
    params, page, pageSize,
  });
  const hoy = hoyISO();
  res.rows = res.rows.map((p) => {
    hidratar(p);
    p.vigente = p.is_active && hoy >= p.fecha_inicio && hoy <= p.fecha_fin;
    return p;
  });
  return res;
}

function limpiar(data, { partial = false } = {}) {
  const out = {};
  const req = (k, v) => { if (!partial || data[k] !== undefined) out[k] = v; };

  if (!partial || data.nombre !== undefined) {
    out.nombre = String(data.nombre || '').trim();
    if (!out.nombre) throw new Error('El nombre de la promoción es obligatorio.');
  }
  const tipo = data.tipo !== undefined ? data.tipo : undefined;
  if (!partial || tipo !== undefined) {
    if (!TIPOS.includes(tipo)) throw new Error('Tipo de promoción no válido.');
    out.tipo = tipo;
  }
  const T = out.tipo || (partial ? null : data.tipo);

  if (!partial || data.fecha_inicio !== undefined || data.fecha_fin !== undefined) {
    const fi = data.fecha_inicio, ff = data.fecha_fin;
    if (!esFecha(fi) || !esFecha(ff)) throw new Error('La promoción necesita fecha de inicio y fin (AAAA-MM-DD).');
    if (ff < fi) throw new Error('La fecha de fin no puede ser antes de la de inicio.');
    out.fecha_inicio = fi; out.fecha_fin = ff;
  }
  if (data.descripcion !== undefined) out.descripcion = String(data.descripcion || '');

  if (T) {
    const ambito = data.ambito;
    const ambitosOk = T === 'combo' ? ['categoria', 'productos']
      : T === 'dia' ? ['categoria', 'productos']
      : ['productos', 'cuenta'];
    if (!ambitosOk.includes(ambito)) throw new Error('El alcance de la promoción no es válido para este tipo.');
    out.ambito = ambito;

    if (ambito === 'categoria') {
      out.categoria_id = Number(data.categoria_id) || null;
      if (!out.categoria_id) throw new Error('Elige la categoría de la promoción.');
    } else {
      out.categoria_id = null;
    }

    if (T === 'dia') {
      out.dia_semana = Number(data.dia_semana);
      if (!(out.dia_semana >= 0 && out.dia_semana <= 6)) throw new Error('Elige el día de la semana.');
      out.valor_tipo = 'porcentaje';
      out.valor = num(data.valor, 0);
      if (out.valor <= 0 || out.valor > 100) throw new Error('El porcentaje debe estar entre 1 y 100.');
      out.cantidad_requerida = null;
    } else {
      out.dia_semana = null;
    }

    if (T === 'combo') {
      out.valor_tipo = data.valor_tipo === 'porcentaje' ? 'porcentaje' : 'fijo';
      out.valor = num(data.valor, 0);
      if (out.valor <= 0) throw new Error('Indica el precio o el porcentaje del combo.');
      if (out.valor_tipo === 'porcentaje' && out.valor > 100) throw new Error('El porcentaje no puede pasar de 100.');
      if (ambito === 'categoria') {
        out.cantidad_requerida = Math.trunc(num(data.cantidad_requerida, 0));
        if (out.cantidad_requerida < 2) throw new Error('Un combo por categoría necesita al menos 2 productos.');
      } else {
        out.cantidad_requerida = null;
      }
    }

    if (T === 'monto_fijo') {
      out.valor_tipo = 'monto';
      out.valor = num(data.valor, 0);
      if (out.valor <= 0) throw new Error('Indica el monto a descontar.');
      out.cantidad_requerida = null;
    }
  }

  return out;
}

function guardarProductos(db, promocionId, productoIds) {
  db.prepare('DELETE FROM promocion_productos WHERE promocion_id = ?').run(promocionId);
  const ins = db.prepare('INSERT OR IGNORE INTO promocion_productos (promocion_id, producto_id) VALUES (?, ?)');
  for (const pid of productoIds || []) {
    if (db.prepare('SELECT id FROM productos WHERE id = ?').get(Number(pid))) ins.run(promocionId, Number(pid));
  }
}

function createPromocion(data) {
  const db = getDb();
  const c = limpiar(data);
  if (c.ambito === 'productos' && !(data.productoIds || []).length) {
    throw new Error('Elige al menos un producto para la promoción.');
  }
  const tx = db.transaction(() => {
    const info = db.prepare(
      `INSERT INTO promociones
        (nombre, tipo, descripcion, fecha_inicio, fecha_fin, dia_semana, ambito, categoria_id, cantidad_requerida, valor_tipo, valor)
       VALUES (@nombre, @tipo, @descripcion, @fecha_inicio, @fecha_fin, @dia_semana, @ambito, @categoria_id, @cantidad_requerida, @valor_tipo, @valor)`
    ).run({
      descripcion: '', dia_semana: null, categoria_id: null, cantidad_requerida: null, ...c,
    });
    const id = info.lastInsertRowid;
    if (c.ambito === 'productos') guardarProductos(db, id, data.productoIds);
    return id;
  });
  return getPromocion(tx());
}

function updatePromocion(id, data) {
  const db = getDb();
  const actual = db.prepare('SELECT * FROM promociones WHERE id = ?').get(id);
  if (!actual) throw new Error('La promoción no existe.');
  // para validar bien, mezclamos lo actual con lo nuevo
  const merged = { ...actual, ...data, tipo: data.tipo || actual.tipo };
  const c = limpiar(merged);
  if (c.ambito === 'productos') {
    const ids = data.productoIds !== undefined ? data.productoIds : (getPromocion(id).productos.map((p) => p.producto_id));
    if (!ids.length) throw new Error('Elige al menos un producto para la promoción.');
  }
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE promociones SET
        nombre=@nombre, tipo=@tipo, descripcion=@descripcion, fecha_inicio=@fecha_inicio, fecha_fin=@fecha_fin,
        dia_semana=@dia_semana, ambito=@ambito, categoria_id=@categoria_id, cantidad_requerida=@cantidad_requerida,
        valor_tipo=@valor_tipo, valor=@valor, updated_at=datetime('now')
       WHERE id=@id`
    ).run({ id, descripcion: '', dia_semana: null, categoria_id: null, cantidad_requerida: null, ...c });
    if (data.productoIds !== undefined) guardarProductos(db, id, data.productoIds);
  });
  tx();
  return getPromocion(id);
}

function setActive(id, activo) {
  const db = getDb();
  if (!db.prepare('SELECT id FROM promociones WHERE id = ?').get(id)) throw new Error('La promoción no existe.');
  db.prepare("UPDATE promociones SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(activo ? 1 : 0, id);
  return getPromocion(id);
}

// ---------------- Evaluación ----------------
function vigenteHoy(promo, fecha = hoyISO()) {
  if (!promo.is_active) return false;
  if (fecha < promo.fecha_inicio || fecha > promo.fecha_fin) return false;
  if (promo.tipo === 'dia') {
    const dow = new Date(fecha + 'T12:00:00').getDay();
    if (dow !== promo.dia_semana) return false;
  }
  return true;
}

/**
 * items = [{ producto_id, categoria_id, total }]  (renglones activos de la venta)
 * Devuelve { aplica, descuento, detalle }.
 */
function calcular(promo, items) {
  const prodIds = new Set((promo.productos || []).map((p) => p.producto_id));
  const desc = (n) => round2(Math.max(0, n));

  if (promo.tipo === 'combo') {
    let base;
    let cuenta = 0;
    if (promo.ambito === 'categoria') {
      const match = items.filter((i) => i.categoria_id === promo.categoria_id).sort((a, b) => b.total - a.total);
      cuenta = match.length;
      if (cuenta < promo.cantidad_requerida) return { aplica: false };
      base = match.slice(0, promo.cantidad_requerida).reduce((s, i) => s + i.total, 0);
    } else {
      // uno (el más caro) por cada producto requerido
      base = 0;
      for (const pid of prodIds) {
        const cands = items.filter((i) => i.producto_id === pid).sort((a, b) => b.total - a.total);
        if (!cands.length) return { aplica: false };
        base += cands[0].total;
      }
    }
    const d = promo.valor_tipo === 'fijo' ? base - promo.valor : base * (promo.valor / 100);
    if (d <= 0) return { aplica: false };
    return { aplica: true, descuento: desc(d), detalle: `Combo sobre ${promo.ambito === 'categoria' ? promo.cantidad_requerida + ' producto(s)' : 'los productos del combo'}` };
  }

  if (promo.tipo === 'dia') {
    const match = promo.ambito === 'categoria'
      ? items.filter((i) => i.categoria_id === promo.categoria_id)
      : items.filter((i) => prodIds.has(i.producto_id));
    if (!match.length) return { aplica: false };
    const base = match.reduce((s, i) => s + i.total, 0);
    const d = base * (promo.valor / 100);
    if (d <= 0) return { aplica: false };
    return { aplica: true, descuento: desc(d), detalle: `${promo.valor}% en ${match.length} producto(s)` };
  }

  // monto_fijo
  if (promo.ambito === 'cuenta') {
    const base = items.reduce((s, i) => s + i.total, 0);
    if (base <= 0) return { aplica: false };
    return { aplica: true, descuento: desc(Math.min(promo.valor, base)), detalle: `-$${promo.valor} a la cuenta` };
  }
  const match = items.filter((i) => prodIds.has(i.producto_id));
  if (!match.length) return { aplica: false };
  const base = match.reduce((s, i) => s + i.total, 0);
  return { aplica: true, descuento: desc(Math.min(promo.valor, base)), detalle: `-$${promo.valor} por producto de la promo` };
}

module.exports = {
  TIPOS, DIAS,
  getPromocion, listPromociones, createPromocion, updatePromocion, setActive,
  vigenteHoy, calcular, hoyISO,
};
