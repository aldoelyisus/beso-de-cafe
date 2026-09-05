'use strict';

const { getDb } = require('../db/connection');
const reporteService = require('./reporteService');

const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const hoyISO = () => new Date().toLocaleDateString('en-CA');

function getCierre(fecha) {
  const db = getDb();
  const c = db.prepare('SELECT * FROM cierres_dia WHERE fecha = ?').get(fecha);
  if (!c) return null;
  c.productos = db.prepare(
    'SELECT producto_nombre, unidades, ingreso_neto, costo, ganancia FROM cierre_dia_productos WHERE cierre_id = ? ORDER BY ganancia DESC'
  ).all(c.id);
  return c;
}

function estadoDia(fecha) {
  if (!esFecha(fecha)) throw new Error('Fecha no válida.');
  const cierre = getCierre(fecha);
  return { fecha, cerrado: !!cierre, cierre, en_vivo: cierre ? null : reporteService._diaEnVivo(fecha) };
}

/** Congela los números del día. Requiere: sin cuentas abiertas y sin turno de caja abierto. */
function cerrarDia(fecha, actor = {}) {
  const db = getDb();
  if (!esFecha(fecha)) throw new Error('Fecha no válida.');
  if (fecha > hoyISO()) throw new Error('No se puede cerrar un día futuro.');
  if (getCierre(fecha)) throw new Error('Ese día ya está cerrado.');

  const abiertas = db.prepare("SELECT COUNT(*) c FROM ventas WHERE estado = 'abierta'").get().c;
  if (abiertas > 0) throw new Error(`Hay ${abiertas} cuenta(s) abierta(s). Ciérralas o cancélalas antes de cerrar el día.`);
  const turno = db.prepare("SELECT COUNT(*) c FROM cortes_caja WHERE estado = 'abierto'").get().c;
  if (turno > 0) throw new Error('Hay un turno de caja abierto. Ciérralo antes de cerrar el día.');

  const d = reporteService._diaEnVivo(fecha);
  const tx = db.transaction(() => {
    const info = db.prepare(
      `INSERT INTO cierres_dia
        (fecha, ventas, ingreso_bruto, descuentos, ingreso_neto, costo, ganancia, efectivo, transferencia, merma_costo, cerrado_por, cerrado_username)
       VALUES (@fecha, @ventas, @ingreso_bruto, @descuentos, @ingreso_neto, @costo, @ganancia, @efectivo, @transferencia, @merma_costo, @por, @username)`
    ).run({ fecha, ...d, por: actor.id || null, username: actor.username || '' });
    const cierreId = info.lastInsertRowid;
    const insP = db.prepare(
      'INSERT INTO cierre_dia_productos (cierre_id, producto_nombre, unidades, ingreso_neto, costo, ganancia) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const p of d.productos) insP.run(cierreId, p.producto_nombre, p.unidades, p.ingreso_neto, p.costo, p.ganancia);
  });
  tx();
  return getCierre(fecha);
}

function reabrirDia(fecha, actor = {}) {
  const db = getDb();
  const c = db.prepare('SELECT id FROM cierres_dia WHERE fecha = ?').get(fecha);
  if (!c) throw new Error('Ese día no está cerrado.');
  db.prepare('DELETE FROM cierres_dia WHERE id = ?').run(c.id); // cascada borra los productos
  return { ok: true };
}

function listCierres({ limit = 60 } = {}) {
  return getDb().prepare(
    `SELECT fecha, ventas, ingreso_neto, costo, ganancia, efectivo, transferencia, merma_costo,
            cerrado_username, datetime(cerrado_at, 'localtime') AS cerrado_at
     FROM cierres_dia ORDER BY fecha DESC LIMIT ?`
  ).all(Math.min(Number(limit) || 60, 400));
}

/** ¿Está cerrado el día de hoy? (para bloquear cobros) */
function diaCerrado(fecha) {
  return !!getDb().prepare('SELECT 1 FROM cierres_dia WHERE fecha = ?').get(fecha);
}

module.exports = { getCierre, estadoDia, cerrarDia, reabrirDia, listCierres, diaCerrado, hoyISO };
