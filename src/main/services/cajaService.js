'use strict';

const { getDb } = require('../db/connection');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def; };

/**
 * En JavaScript `Number('')` y `Number(null)` son **0**, así que un campo que
 * la persona dejó vacío llegaba aquí indistinguible de un 0 capturado a
 * propósito. En el arqueo eso era grave: cerrar el turno sin escribir nada
 * lo cerraba con "conté $0" y dejaba un faltante falso a nombre del cajero,
 * sin forma de reabrirlo. Por eso "vacío" se trata aparte de "cero".
 */
const vacio = (v) => v === null || v === undefined || String(v).trim() === '';

// ---------------- Turno de caja ----------------
function corteAbiertoRow() {
  return getDb().prepare("SELECT * FROM cortes_caja WHERE estado = 'abierto' ORDER BY id DESC LIMIT 1").get() || null;
}

/**
 * El último turno que se cerró: lo que quedó contado en el cajón es, en la
 * práctica, el fondo con el que se abre el siguiente día.
 *
 * Antes no se guardaba nada de eso: cada mañana había que acordarse de cuánto
 * se había dejado y teclearlo, y el campo arrancaba en 0. Un 0 por descuido
 * desaparece el fondo de la cuenta del día y deja un sobrante falso al cerrar.
 */
function ultimoCierre() {
  const c = getDb().prepare(
    `SELECT id, efectivo_contado, cerrado_username,
            datetime(cerrado_at,'localtime') AS cerrado_at
     FROM cortes_caja WHERE estado = 'cerrado' AND efectivo_contado IS NOT NULL
     ORDER BY id DESC LIMIT 1`
  ).get();
  return c || null;
}

/** Números en vivo de un turno (o del turno abierto). */
function getCorte(id) {
  const db = getDb();
  const c = id ? db.prepare('SELECT * FROM cortes_caja WHERE id = ?').get(id) : corteAbiertoRow();
  if (!c) return null;

  c.movimientos = db.prepare(
    "SELECT id, tipo, monto, concepto, username, datetime(created_at,'localtime') AS created_at FROM caja_movimientos WHERE corte_id = ? ORDER BY id"
  ).all(c.id);
  c.ingresos_manuales = round2(c.movimientos.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0));
  c.retiros = round2(c.movimientos.filter((m) => m.tipo === 'retiro').reduce((s, m) => s + m.monto, 0));

  // ventas pagadas de este turno, por método (solo ventas que siguen 'pagada')
  const porMetodo = db.prepare(
    `SELECT p.metodo, COALESCE(SUM(p.monto), 0) AS monto, COUNT(DISTINCT p.venta_id) AS ventas
     FROM venta_pagos p JOIN ventas v ON v.id = p.venta_id
     WHERE p.corte_id = ? AND v.estado = 'pagada' GROUP BY p.metodo`
  ).all(c.id);
  c.ventas_efectivo = round2((porMetodo.find((x) => x.metodo === 'efectivo') || {}).monto || 0);
  c.ventas_transferencia = round2((porMetodo.find((x) => x.metodo === 'transferencia') || {}).monto || 0);
  c.num_ventas = new Set(db.prepare("SELECT DISTINCT venta_id FROM venta_pagos WHERE corte_id = ?").all(c.id).map((r) => r.venta_id)).size;

  c.efectivo_esperado_calc = round2(c.fondo_inicial + c.ventas_efectivo + c.ingresos_manuales - c.retiros);
  if (c.estado === 'cerrado') {
    c.diferencia = round2((c.efectivo_contado || 0) - (c.efectivo_esperado || 0));
  }
  return c;
}

function abrirCorte({ fondo_inicial }, actor = {}) {
  const db = getDb();
  if (corteAbiertoRow()) throw new Error('La caja ya está abierta. Ciérrala antes de abrir otra.');
  // Vacío = el cajón empieza sin efectivo (pasa seguido y no tiene nada de
  // malo). Texto sí es error: un "quinientos" pegado no puede guardarse
  // como $0 en silencio y descuadrar el arqueo al cerrar.
  if (!vacio(fondo_inicial) && !Number.isFinite(Number(fondo_inicial))) {
    throw new Error('El efectivo inicial debe ser un número.');
  }
  // Sin capturar nada se hereda lo que quedó en el cajón al cerrar: es el
  // caso normal (el dinero no se movió de un día a otro) y así no depende de
  // que alguien se acuerde. Con un 0 escrito a propósito se respeta el 0.
  const previo = ultimoCierre();
  const f = vacio(fondo_inicial)
    ? num(previo && previo.efectivo_contado, 0)
    : num(fondo_inicial, 0);
  if (f < 0) throw new Error('El fondo inicial no puede ser negativo.');
  const info = db.prepare(
    'INSERT INTO cortes_caja (fondo_inicial, abierto_por, abierto_username) VALUES (?, ?, ?)'
  ).run(f, actor.id || null, actor.username || '');
  return getCorte(info.lastInsertRowid);
}

function registrarMovimiento({ tipo, monto, concepto }, actor = {}) {
  const db = getDb();
  const c = corteAbiertoRow();
  if (!c) throw new Error('La caja está cerrada. Ábrela primero.');
  if (!['ingreso', 'retiro'].includes(tipo)) throw new Error('Tipo de movimiento no válido.');
  if (vacio(monto)) throw new Error('Falta capturar el monto.');
  if (!Number.isFinite(Number(monto))) throw new Error('El monto debe ser un número.');
  const m = num(monto, 0);
  if (m <= 0) throw new Error('El monto debe ser mayor a 0.');
  const cpt = String(concepto || '').trim();
  if (!cpt) throw new Error('Escribe el concepto del movimiento.');
  db.prepare(
    'INSERT INTO caja_movimientos (corte_id, tipo, monto, concepto, user_id, username) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(c.id, tipo, m, cpt, actor.id || null, actor.username || '');
  return getCorte(c.id);
}

function cerrarCorte({ efectivo_contado, notas }, actor = {}) {
  const db = getDb();
  const c = getCorte();
  if (!c) throw new Error('La caja está cerrada. Ábrela primero.');
  // Dejarlo vacío NO es "conté cero": cerrar así dejaba un faltante falso.
  if (vacio(efectivo_contado)) throw new Error('Falta capturar cuánto efectivo contaste.');
  const contado = Number(efectivo_contado);
  if (!Number.isFinite(contado)) throw new Error('El efectivo contado debe ser un número.');
  if (contado < 0) throw new Error('El efectivo contado no puede ser negativo.');
  // El comentario del cierre es obligatorio: es lo que explica el día cuando
  // alguien revise este corte después (sobró, faltó, o todo normal).
  if (vacio(notas)) throw new Error('Escribe un comentario del cierre: cómo estuvo el día o por qué no cuadró.');
  const esperado = c.efectivo_esperado_calc;
  db.prepare(
    `UPDATE cortes_caja SET estado = 'cerrado', cerrado_por = ?, cerrado_username = ?,
       cerrado_at = datetime('now'), efectivo_esperado = ?, efectivo_contado = ?, diferencia = ?, notas = ?
     WHERE id = ?`
  ).run(actor.id || null, actor.username || '', esperado, contado, round2(contado - esperado), String(notas || ''), c.id);
  return getCorte(c.id);
}

function listCortes({ limit = 30 } = {}) {
  return getDb().prepare(
    `SELECT c.*, datetime(c.abierto_at,'localtime') AS abierto_at_l, datetime(c.cerrado_at,'localtime') AS cerrado_at_l
     FROM cortes_caja c ORDER BY c.id DESC LIMIT ?`
  ).all(Math.min(Number(limit) || 30, 200)).map((c) => {
    const full = getCorte(c.id);
    return { ...c, abierto_at: c.abierto_at_l, cerrado_at: c.cerrado_at_l,
      ventas_efectivo: full.ventas_efectivo, ventas_transferencia: full.ventas_transferencia,
      retiros: full.retiros, ingresos_manuales: full.ingresos_manuales,
      efectivo_esperado: c.efectivo_esperado != null ? c.efectivo_esperado : full.efectivo_esperado_calc };
  });
}

module.exports = { corteAbiertoRow, getCorte, abrirCorte, registrarMovimiento, cerrarCorte, listCortes, ultimoCierre };
