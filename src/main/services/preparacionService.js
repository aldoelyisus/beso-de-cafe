'use strict';

const { getDb } = require('../db/connection');
const insumoService = require('./insumoService');

/**
 * Insumos que se preparan aquí (FASE 14).
 *
 * La base para frappé no se compra: se hace con leche en polvo, CLM y azúcar
 * glass. El flujo tiene dos momentos y NO se tocan:
 *
 *   1. Preparar una tanda → salen los componentes, entra la base.
 *   2. Vender el frappé   → sale SOLO la base.
 *
 * Si al vender también se descontaran los componentes, se contarían dos veces
 * (ya salieron en el paso 1). El costo sí viaja: la base hereda lo que costó
 * la tanda, así que el frappé carga la leche en polvo, el CLM y el azúcar
 * dentro del costo de la base, y la ganancia del reporte sigue cuadrando.
 */

const round4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function getReceta(insumoId) {
  return getDb().prepare(
    `SELECT r.componente_id, r.cantidad_base, r.orden,
            i.nombre AS componente_nombre, i.unidad_base, i.costo_unitario, i.stock, i.is_active
     FROM insumo_receta r JOIN insumos i ON i.id = r.componente_id
     WHERE r.insumo_id = ? ORDER BY r.orden, r.id`
  ).all(Number(insumoId));
}

/**
 * ¿`candidato` ya depende de `insumoId`? Evita que A lleve B mientras B lleva
 * A — directa o a través de terceros. Un ciclo así haría imposible calcular el
 * costo (se llamaría a sí mismo para siempre).
 */
function dependeDe(db, candidato, insumoId, vistos = new Set()) {
  if (Number(candidato) === Number(insumoId)) return true;
  if (vistos.has(candidato)) return false;
  vistos.add(candidato);
  const hijos = db.prepare('SELECT componente_id FROM insumo_receta WHERE insumo_id = ?').all(candidato);
  return hijos.some((h) => dependeDe(db, h.componente_id, insumoId, vistos));
}

/** Lo que cuesta preparar UNA tanda completa, con los costos de hoy. */
function costoTanda(insumoId) {
  return round4(getReceta(insumoId).reduce((s, c) => s + c.cantidad_base * c.costo_unitario, 0));
}

/** Costo por unidad base del insumo preparado (lo que cuesta 1 g de base). */
function costoPorUnidad(insumoId) {
  const insumo = getDb().prepare('SELECT rinde FROM insumos WHERE id = ?').get(insumoId);
  const rinde = insumo ? num(insumo.rinde, 0) : 0;
  return rinde > 0 ? round4(costoTanda(insumoId) / rinde) : 0;
}

/** La receta del insumo + lo que cuesta, para mostrarlo todo junto. */
function getPreparacion(insumoId) {
  const db = getDb();
  const insumo = db.prepare('SELECT id, nombre, unidad_base, se_prepara, rinde FROM insumos WHERE id = ?').get(Number(insumoId));
  if (!insumo) return null;
  const receta = getReceta(insumoId).map((c) => ({ ...c, costo: round4(c.cantidad_base * c.costo_unitario) }));
  const costo_tanda = round4(receta.reduce((s, c) => s + c.costo, 0));
  return {
    ...insumo,
    se_prepara: !!insumo.se_prepara,
    receta,
    costo_tanda,
    costo_por_unidad: insumo.rinde > 0 ? round4(costo_tanda / insumo.rinde) : 0,
    // Cuántas tandas completas alcanzan con lo que hay de cada componente.
    tandas_posibles: receta.length
      ? Math.floor(Math.min(...receta.map((c) => (c.cantidad_base > 0 ? Math.max(0, c.stock) / c.cantidad_base : Infinity))))
      : 0,
  };
}

/**
 * Define cómo se prepara un insumo: qué lleva una tanda y cuánto rinde.
 * `items` = [{ componente_id, cantidad_base }]
 */
function setPreparacion(insumoId, { rinde, items = [] } = {}, actor = {}) {
  const db = getDb();
  const id = Number(insumoId);
  const insumo = db.prepare('SELECT * FROM insumos WHERE id = ?').get(id);
  if (!insumo) throw new Error('El insumo no existe.');

  const r = num(rinde, 0);
  if (!(r > 0)) throw new Error(`Indica cuánto sale de una tanda (en ${insumo.unidad_base}).`);

  const limpios = [];
  const vistos = new Set();
  for (const it of items) {
    const compId = Number(it.componente_id);
    const cant = num(it.cantidad_base, 0);
    if (!compId) continue;
    if (compId === id) throw new Error(`"${insumo.nombre}" no puede llevarse a sí mismo.`);
    if (!(cant > 0)) {
      const c = db.prepare('SELECT nombre FROM insumos WHERE id = ?').get(compId);
      throw new Error(`Falta la cantidad de "${c ? c.nombre : 'un insumo'}".`);
    }
    const comp = db.prepare('SELECT id, nombre, is_active FROM insumos WHERE id = ?').get(compId);
    if (!comp) throw new Error('Un insumo de la receta no existe.');
    if (!comp.is_active) throw new Error(`"${comp.nombre}" está dado de baja: reactívalo o quítalo de la receta.`);
    if (vistos.has(compId)) throw new Error(`"${comp.nombre}" está repetido: súmalo en un solo renglón.`);
    if (dependeDe(db, compId, id)) {
      throw new Error(`"${comp.nombre}" ya se prepara con "${insumo.nombre}": uno no puede llevar al otro en círculo.`);
    }
    vistos.add(compId);
    limpios.push({ compId, cant });
  }
  if (!limpios.length) throw new Error('Agrega al menos un insumo a la receta.');

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM insumo_receta WHERE insumo_id = ?').run(id);
    const ins = db.prepare(
      'INSERT INTO insumo_receta (insumo_id, componente_id, cantidad_base, orden) VALUES (?, ?, ?, ?)'
    );
    limpios.forEach((x, i) => ins.run(id, x.compId, x.cant, i));
    db.prepare("UPDATE insumos SET se_prepara = 1, rinde = ?, updated_at = datetime('now') WHERE id = ?").run(r, id);
  });
  tx();
  void actor;
  return getPreparacion(id);
}

/** Deja de ser un insumo preparado (vuelve a ser uno que solo se compra). */
function quitarPreparacion(insumoId) {
  const db = getDb();
  const id = Number(insumoId);
  if (!db.prepare('SELECT id FROM insumos WHERE id = ?').get(id)) throw new Error('El insumo no existe.');
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM insumo_receta WHERE insumo_id = ?').run(id);
    db.prepare("UPDATE insumos SET se_prepara = 0, rinde = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  });
  tx();
  return getPreparacion(id);
}

/**
 * Prepara una tanda (o la fracción que sea): salen los componentes, entra el
 * insumo preparado, y su costo promedio se recalcula con lo que costó ESTA
 * tanda — igual que una compra.
 *
 * `tandas` puede ser fraccionario (media tanda = 0.5).
 */
function producir(insumoId, { tandas = 1, nota = '' } = {}, actor = {}) {
  const db = getDb();
  const id = Number(insumoId);
  const insumo = db.prepare('SELECT * FROM insumos WHERE id = ?').get(id);
  if (!insumo) throw new Error('El insumo no existe.');
  if (!insumo.is_active) throw new Error(`"${insumo.nombre}" está dado de baja. Reactívalo para poder prepararlo.`);
  if (!insumo.se_prepara) throw new Error(`"${insumo.nombre}" no está marcado como un insumo que se prepara aquí.`);

  const factor = num(tandas, 0);
  if (!(factor > 0)) throw new Error('Indica cuántas tandas se prepararon (mayor a 0).');
  const rinde = num(insumo.rinde, 0);
  if (!(rinde > 0)) throw new Error(`Falta decir cuánto sale de una tanda de "${insumo.nombre}".`);

  const receta = getReceta(id);
  if (!receta.length) throw new Error(`"${insumo.nombre}" no tiene receta: dile primero con qué se prepara.`);
  const deBaja = receta.find((c) => !c.is_active);
  if (deBaja) throw new Error(`"${deBaja.componente_nombre}" está dado de baja: reactívalo para poder preparar.`);

  const producido = round4(rinde * factor);
  const motivo = String(nota || '').trim() || `Preparación de ${insumo.nombre}`;
  const referencia = `Preparación de "${insumo.nombre}"`;

  // Costo de lo que se va a gastar, con los costos de HOY.
  const costoTotal = round4(receta.reduce((s, c) => s + c.cantidad_base * factor * c.costo_unitario, 0));
  const costoInBase = producido > 0 ? costoTotal / producido : 0;

  const faltantes = [];
  const tx = db.transaction(() => {
    // 1. Salen los componentes.
    for (const c of receta) {
      const usado = round4(c.cantidad_base * factor);
      const comp = db.prepare('SELECT stock, unidad_base, costo_unitario FROM insumos WHERE id = ?').get(c.componente_id);
      const nuevo = round4(comp.stock - usado);
      db.prepare("UPDATE insumos SET stock = ?, updated_at = datetime('now') WHERE id = ?").run(nuevo, c.componente_id);
      db.prepare(
        `INSERT INTO inventory_movements
          (insumo_id, tipo, cantidad_base, cantidad_captura, unidad_captura, costo_unitario,
           motivo, referencia, stock_resultante, user_id, username)
         VALUES (?, 'consumo_prep', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(c.componente_id, -usado, usado, comp.unidad_base, comp.costo_unitario,
        motivo, referencia, nuevo, actor.id || null, actor.username || '');
      if (nuevo < 0) faltantes.push({ nombre: c.componente_nombre, stock: nuevo, unidad: comp.unidad_base });
    }

    // 2. Entra lo preparado, con el costo de esta tanda.
    //    Un stock negativo no es existencia (es un faltante sin registrar), así
    //    que para el promedio cuenta como cero — misma regla que en las compras.
    const stockPrev = Math.max(0, insumo.stock);
    const nuevoStock = round4(insumo.stock + producido);
    const costoUnitario = stockPrev + producido > 0
      ? round4((stockPrev * insumo.costo_unitario + producido * costoInBase) / (stockPrev + producido))
      : round4(costoInBase);
    db.prepare("UPDATE insumos SET stock = ?, costo_unitario = ?, updated_at = datetime('now') WHERE id = ?")
      .run(nuevoStock, costoUnitario, id);
    db.prepare(
      `INSERT INTO inventory_movements
        (insumo_id, tipo, cantidad_base, cantidad_captura, unidad_captura, costo_unitario,
         motivo, referencia, stock_resultante, user_id, username)
       VALUES (?, 'produccion', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, producido, factor, 'tanda(s)', costoUnitario,
      motivo, `${factor} tanda(s) · ${producido} ${insumo.unidad_base}`, nuevoStock,
      actor.id || null, actor.username || '');
  });
  tx();

  return {
    insumo: insumoService.getInsumo(id),
    producido,
    tandas: factor,
    costo_tanda: round4(costoTotal / (factor || 1)),
    costo_por_unidad: round4(costoInBase),
    // Si un componente quedó en negativo hay que avisarlo en el momento:
    // significa que se preparó con algo que el sistema no sabía que existía.
    faltantes,
  };
}

module.exports = {
  getReceta, getPreparacion, setPreparacion, quitarPreparacion,
  producir, costoTanda, costoPorUnidad, dependeDe,
};
