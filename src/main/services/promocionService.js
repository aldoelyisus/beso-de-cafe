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
    `SELECT pp.producto_id, pp.grupo, pr.nombre
     FROM promocion_productos pp JOIN productos pr ON pr.id = pp.producto_id
     WHERE pp.promocion_id = ? ORDER BY pp.grupo, pr.nombre`
  ).all(p.id);
  p.grupo2_categoria_nombre = p.grupo2_categoria_id
    ? (getDb().prepare('SELECT nombre FROM producto_categorias WHERE id = ?').get(p.grupo2_categoria_id) || {}).nombre || null
    : null;
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
    const ambitosOk = T === 'combo' ? ['categoria', 'productos', 'lista', 'dos_grupos']
      : T === 'dia' ? ['categoria', 'productos']
      : ['productos', 'cuenta'];
    if (!ambitosOk.includes(ambito)) throw new Error('El alcance de la promoción no es válido para este tipo.');
    out.ambito = ambito;

    if (ambito === 'categoria') {
      out.categoria_id = Number(data.categoria_id) || null;
      if (!out.categoria_id) throw new Error('Elige la categoría de la promoción.');
    } else if (ambito === 'dos_grupos') {
      // El primer lado puede ser una categoría entera o una lista suelta.
      out.categoria_id = data.grupo1_tipo === 'categoria' ? (Number(data.categoria_id) || null) : null;
      if (data.grupo1_tipo === 'categoria' && !out.categoria_id) {
        throw new Error('Elige la categoría del primer grupo.');
      }
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
      if (ambito === 'categoria' || ambito === 'lista') {
        out.cantidad_requerida = Math.trunc(num(data.cantidad_requerida, 0));
        if (out.cantidad_requerida < 2) {
          throw new Error(ambito === 'categoria'
            ? 'Un combo por categoría necesita al menos 2 productos.'
            : 'Di cuántos productos de la lista hacen el combo (al menos 2).');
        }
      } else if (ambito === 'dos_grupos') {
        // Aquí cada lado lleva su propia cantidad, y con uno de cada lado basta.
        out.cantidad_requerida = Math.max(1, Math.trunc(num(data.cantidad_requerida, 1)));
        out.grupo2_cantidad = Math.max(1, Math.trunc(num(data.grupo2_cantidad, 1)));
        out.grupo2_tipo = data.grupo2_tipo === 'categoria' ? 'categoria' : 'productos';
        out.grupo2_categoria_id = out.grupo2_tipo === 'categoria' ? (Number(data.grupo2_categoria_id) || null) : null;
        if (out.grupo2_tipo === 'categoria' && !out.grupo2_categoria_id) {
          throw new Error('Elige la categoría del segundo grupo.');
        }
        if (out.grupo2_tipo === 'categoria' && out.grupo2_categoria_id === out.categoria_id) {
          throw new Error('Los dos grupos son la misma categoría: usa "varios de una categoría" para eso.');
        }
      } else {
        out.cantidad_requerida = null;
      }
    }

    if (ambito !== 'dos_grupos') {
      out.grupo2_tipo = null;
      out.grupo2_categoria_id = null;
      out.grupo2_cantidad = 1;
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

/**
 * Los productos marcados. `productoIds` es el grupo 1 (o el único, cuando la
 * promoción no tiene dos lados) y `productoIds2` el segundo.
 */
function guardarProductos(db, promocionId, productoIds, productoIds2) {
  db.prepare('DELETE FROM promocion_productos WHERE promocion_id = ?').run(promocionId);
  const ins = db.prepare('INSERT OR IGNORE INTO promocion_productos (promocion_id, producto_id, grupo) VALUES (?, ?, ?)');
  const existe = db.prepare('SELECT id FROM productos WHERE id = ?');
  const meter = (ids, grupo) => {
    for (const pid of ids || []) {
      if (existe.get(Number(pid))) ins.run(promocionId, Number(pid), grupo);
    }
  };
  meter(productoIds, 1);
  meter(productoIds2, 2);
}

/** Los ámbitos que se arman marcando productos a mano. */
const CON_LISTA = ['productos', 'lista', 'dos_grupos'];

/**
 * Que las listas de productos alcancen para lo que la promoción promete.
 *
 * Importa decirlo al guardar y no al cobrar: una promoción mal armada no
 * truena, simplemente nunca aplica, y eso se descubre con el cliente enfrente.
 */
function validarListas(c, ids1, ids2) {
  const n1 = (ids1 || []).length;
  const n2 = (ids2 || []).length;

  if (c.ambito === 'dos_grupos') {
    const lado1EsLista = !c.categoria_id;
    if (lado1EsLista && !n1) throw new Error('Elige los productos del primer grupo.');
    if (c.grupo2_tipo === 'productos' && !n2) throw new Error('Elige los productos del segundo grupo.');
    return;
  }

  if (!n1) throw new Error('Elige al menos un producto para la promoción.');

  if (c.ambito === 'lista' && n1 < c.cantidad_requerida) {
    throw new Error(`El combo pide ${c.cantidad_requerida} productos, pero la lista solo tiene ${n1}: nunca podría aplicar.`);
  }
}

function createPromocion(data) {
  const db = getDb();
  const c = limpiar(data);
  if (CON_LISTA.includes(c.ambito)) validarListas(c, data.productoIds, data.productoIds2);
  const tx = db.transaction(() => {
    const info = db.prepare(
      `INSERT INTO promociones
        (nombre, tipo, descripcion, fecha_inicio, fecha_fin, dia_semana, ambito, categoria_id, cantidad_requerida, valor_tipo, valor,
         grupo2_tipo, grupo2_categoria_id, grupo2_cantidad)
       VALUES (@nombre, @tipo, @descripcion, @fecha_inicio, @fecha_fin, @dia_semana, @ambito, @categoria_id, @cantidad_requerida, @valor_tipo, @valor,
         @grupo2_tipo, @grupo2_categoria_id, @grupo2_cantidad)`
    ).run({
      descripcion: '', dia_semana: null, categoria_id: null, cantidad_requerida: null,
      grupo2_tipo: null, grupo2_categoria_id: null, grupo2_cantidad: 1, ...c,
    });
    const id = info.lastInsertRowid;
    if (CON_LISTA.includes(c.ambito)) guardarProductos(db, id, data.productoIds, data.productoIds2);
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
  if (CON_LISTA.includes(c.ambito)) {
    const previos = getPromocion(id).productos;
    const ids = data.productoIds !== undefined ? data.productoIds : previos.filter((x) => (x.grupo || 1) === 1).map((x) => x.producto_id);
    const ids2 = data.productoIds2 !== undefined ? data.productoIds2 : previos.filter((x) => x.grupo === 2).map((x) => x.producto_id);
    validarListas(c, ids, ids2);
  }
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE promociones SET
        nombre=@nombre, tipo=@tipo, descripcion=@descripcion, fecha_inicio=@fecha_inicio, fecha_fin=@fecha_fin,
        dia_semana=@dia_semana, ambito=@ambito, categoria_id=@categoria_id, cantidad_requerida=@cantidad_requerida,
        valor_tipo=@valor_tipo, valor=@valor, grupo2_tipo=@grupo2_tipo, grupo2_categoria_id=@grupo2_categoria_id,
        grupo2_cantidad=@grupo2_cantidad, updated_at=datetime('now')
       WHERE id=@id`
    ).run({ id, descripcion: '', dia_semana: null, categoria_id: null, cantidad_requerida: null,
      grupo2_tipo: null, grupo2_categoria_id: null, grupo2_cantidad: 1, ...c });
    if (data.productoIds !== undefined || data.productoIds2 !== undefined) {
      const previos = getPromocion(id).productos;
      guardarProductos(db, id,
        data.productoIds !== undefined ? data.productoIds : previos.filter((x) => (x.grupo || 1) === 1).map((x) => x.producto_id),
        data.productoIds2 !== undefined ? data.productoIds2 : previos.filter((x) => x.grupo === 2).map((x) => x.producto_id));
    }
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
 * Sobre que renglones se calcula el descuento de un combo, segun como este
 * armado. Devuelve null si la venta no cumple.
 *
 * Los cuatro casos, en las palabras de quien arma la promocion:
 *   categoria    "2 frappes, del sabor que sea"
 *   productos    "este frappe Y este waffle" (los dos exactos)
 *   lista        "2 cualesquiera de estos"
 *   dos_grupos   "un postre Y un cafe" (cada lado puede ser categoria o lista)
 *
 * Siempre se toman los mas caros que califican: el descuento sale sobre lo
 * mejor que el cliente se llevo, no sobre lo mas barato.
 */
function baseDelCombo(promo, items) {
  const caros = (xs) => [...xs].sort((a, b) => b.total - a.total);
  const prodIds = new Set((promo.productos || []).map((p) => p.producto_id));

  /** Los N mas caros que cumplen, o null si no alcanzan. Marca los usados. */
  function tomar(cands, n, usados) {
    const libres = caros(cands.filter((i) => !usados.has(i)));
    if (libres.length < n) return null;
    const elegidos = libres.slice(0, n);
    for (const e of elegidos) usados.add(e);
    return elegidos.reduce((s, i) => s + i.total, 0);
  }

  /** Un lado del combo: una categoria entera, o una lista de productos. */
  function deGrupo(tipo, categoriaId, ids, cantidad, usados) {
    const cands = tipo === 'categoria'
      ? items.filter((i) => i.categoria_id === categoriaId)
      : items.filter((i) => ids.has(i.producto_id));
    return tomar(cands, cantidad, usados);
  }

  const usados = new Set();

  if (promo.ambito === 'categoria') {
    const base = tomar(items.filter((i) => i.categoria_id === promo.categoria_id), promo.cantidad_requerida, usados);
    return base == null ? null : { base, detalle: `Combo sobre ${promo.cantidad_requerida} producto(s)` };
  }

  if (promo.ambito === 'lista') {
    const base = tomar(items.filter((i) => prodIds.has(i.producto_id)), promo.cantidad_requerida, usados);
    return base == null ? null : { base, detalle: `Combo sobre ${promo.cantidad_requerida} producto(s) de la lista` };
  }

  if (promo.ambito === 'dos_grupos') {
    // El grupo 1 es la categoria si se eligio una; si no, los productos
    // marcados de ese lado. El grupo 2 lo dice `grupo2_tipo`.
    const ids1 = new Set((promo.productos || []).filter((p) => (p.grupo || 1) === 1).map((p) => p.producto_id));
    const ids2 = new Set((promo.productos || []).filter((p) => p.grupo === 2).map((p) => p.producto_id));
    const uno = deGrupo(promo.categoria_id ? 'categoria' : 'productos', promo.categoria_id, ids1,
      promo.cantidad_requerida || 1, usados);
    if (uno == null) return null;
    const dos = deGrupo(promo.grupo2_tipo === 'categoria' ? 'categoria' : 'productos', promo.grupo2_categoria_id, ids2,
      promo.grupo2_cantidad || 1, usados);
    if (dos == null) return null;
    return { base: uno + dos, detalle: 'Combo de dos grupos' };
  }

  // 'productos': el combo exacto, tienen que estar TODOS los marcados.
  let base = 0;
  for (const pid of prodIds) {
    const cands = caros(items.filter((i) => i.producto_id === pid && !usados.has(i)));
    if (!cands.length) return null;
    usados.add(cands[0]);
    base += cands[0].total;
  }
  return { base, detalle: 'Combo sobre los productos del combo' };
}

/**
 * items = [{ producto_id, categoria_id, total }]  (renglones activos de la venta)
 * Devuelve { aplica, descuento, detalle }.
 */
function calcular(promo, items) {
  const prodIds = new Set((promo.productos || []).map((p) => p.producto_id));
  const desc = (n) => round2(Math.max(0, n));

  if (promo.tipo === 'combo') {
    const r = baseDelCombo(promo, items);
    if (!r) return { aplica: false };
    const d = promo.valor_tipo === 'fijo' ? r.base - promo.valor : r.base * (promo.valor / 100);
    if (d <= 0) return { aplica: false };
    return { aplica: true, descuento: desc(d), detalle: r.detalle };
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
