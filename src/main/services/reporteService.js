'use strict';

const { getDb } = require('../db/connection');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const pct = (parte, total) => (total > 0 ? round2((parte / total) * 100) : 0);
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

function rango(desde, hasta) {
  if (!esFecha(desde) || !esFecha(hasta)) throw new Error('Rango de fechas no válido (AAAA-MM-DD).');
  if (hasta < desde) throw new Error('La fecha final no puede ser antes de la inicial.');
  return { desde, hasta };
}

// ================= Cálculo EN VIVO (para días no cerrados) =================

/** Renglones vendidos y cobrados; reparte el descuento de promo entre ellos. */
function itemsVendidos(desde, hasta, excluirFechas = new Set()) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT v.id AS venta_id, v.descuento AS venta_descuento,
            date(v.closed_at, 'localtime') AS fecha,
            vi.producto_id, vi.producto_nombre,
            vi.precio_unitario
              + COALESCE((SELECT SUM(precio_extra) FROM venta_item_modificadores WHERE venta_item_id = vi.id), 0) AS ingreso,
            COALESCE((SELECT SUM(vc.cantidad_base * vc.costo_unitario) FROM venta_item_consumo vc WHERE vc.venta_item_id = vi.id), 0) AS costo
     FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id
     WHERE v.estado = 'pagada' AND vi.estado = 'activo'
       AND date(v.closed_at, 'localtime') BETWEEN @desde AND @hasta`
  ).all({ desde, hasta }).filter((r) => !excluirFechas.has(r.fecha));

  // Valores EN CRUDO (sin redondear). El redondeo a centavos se hace una sola
  // vez, al armar cada total de salida, para que todas las vistas coincidan.
  const brutoPorVenta = new Map();
  for (const r of rows) brutoPorVenta.set(r.venta_id, (brutoPorVenta.get(r.venta_id) || 0) + r.ingreso);
  for (const r of rows) {
    const bruto = brutoPorVenta.get(r.venta_id) || 0;
    const desc = Math.min(r.venta_descuento || 0, bruto);
    r.descuento = bruto > 0 ? desc * (r.ingreso / bruto) : 0;
    r.ingreso_neto = r.ingreso - r.descuento;
    r.ganancia = r.ingreso_neto - r.costo;
  }
  return rows;
}

function mermaCosto(desde, hasta, fechas = null) {
  const db = getDb();
  if (fechas && fechas.length === 0) return 0;
  const filtroFechas = fechas ? ` AND date(created_at, 'localtime') IN (${fechas.map(() => '?').join(',')})` : '';
  return round2(db.prepare(
    `SELECT COALESCE(SUM(ABS(cantidad_base) * costo_unitario), 0) AS c
     FROM inventory_movements
     WHERE tipo = 'merma' AND date(created_at, 'localtime') BETWEEN ? AND ?${filtroFechas}`
  ).get(desde, hasta, ...(fechas || [])).c);
}

function pagosPorMetodo(desde, hasta, excluirFechas = new Set()) {
  const rows = getDb().prepare(
    `SELECT p.metodo, p.monto, date(v.closed_at, 'localtime') AS fecha
     FROM venta_pagos p JOIN ventas v ON v.id = p.venta_id
     WHERE v.estado = 'pagada' AND date(v.closed_at, 'localtime') BETWEEN ? AND ?`
  ).all(desde, hasta);
  const out = { efectivo: 0, transferencia: 0 };
  for (const r of rows) if (!excluirFechas.has(r.fecha)) out[r.metodo] = round2((out[r.metodo] || 0) + r.monto);
  return out;
}

// ================= Cierres de día (snapshots) =================
function cierresEnRango(desde, hasta) {
  return getDb().prepare('SELECT * FROM cierres_dia WHERE fecha BETWEEN ? AND ? ORDER BY fecha').all(desde, hasta);
}

// ================= Reportes públicos =================
function resumen({ desde, hasta } = {}) {
  ({ desde, hasta } = rango(desde, hasta));
  const cierres = cierresEnRango(desde, hasta);
  const cerradas = new Set(cierres.map((c) => c.fecha));

  const items = itemsVendidos(desde, hasta, cerradas);
  const pm = pagosPorMetodo(desde, hasta, cerradas);

  // agregados en vivo (días abiertos)
  const liveVentas = new Set(items.map((i) => i.venta_id)).size;
  const liveBruto = items.reduce((s, i) => s + i.ingreso, 0);
  const liveDesc = items.reduce((s, i) => s + i.descuento, 0);
  const liveCosto = items.reduce((s, i) => s + i.costo, 0);
  // días abiertos dentro del rango, para la merma en vivo
  const diasAbiertos = [...new Set(items.map((i) => i.fecha))];
  const liveMerma = mermaCosto(desde, hasta, diasAbiertos);

  // sumar snapshots de días cerrados
  const snap = cierres.reduce((t, c) => ({
    ventas: t.ventas + c.ventas,
    bruto: t.bruto + c.ingreso_bruto,
    desc: t.desc + c.descuentos,
    neto: t.neto + c.ingreso_neto,
    costo: t.costo + c.costo,
    ganancia: t.ganancia + c.ganancia,
    efectivo: t.efectivo + c.efectivo,
    transferencia: t.transferencia + c.transferencia,
    merma: t.merma + c.merma_costo,
  }), { ventas: 0, bruto: 0, desc: 0, neto: 0, costo: 0, ganancia: 0, efectivo: 0, transferencia: 0, merma: 0 });

  const ventas = snap.ventas + liveVentas;
  const ingreso_bruto = round2(snap.bruto + liveBruto);
  const descuentos = round2(snap.desc + liveDesc);
  const ingreso_neto = round2(ingreso_bruto - descuentos);
  const costo = round2(snap.costo + liveCosto);
  const ganancia = round2(ingreso_neto - costo);

  // por día: filas de cierres + agregado en vivo por fecha (acumula en crudo)
  const porDiaMap = new Map();
  for (const c of cierres) porDiaMap.set(c.fecha, { fecha: c.fecha, ventas: c.ventas, ingreso_neto: c.ingreso_neto, costo: c.costo, ganancia: c.ganancia, cerrado: true });
  for (const i of items) {
    const d = porDiaMap.get(i.fecha) || { fecha: i.fecha, ventas: new Set(), ingreso_neto: 0, costo: 0, ganancia: 0, cerrado: false };
    if (d.cerrado) continue;
    d.ingreso_neto += i.ingreso_neto;
    d.costo += i.costo;
    d.ganancia += i.ganancia;
    d.ventas.add(i.venta_id);
    porDiaMap.set(i.fecha, d);
  }
  const por_dia = [...porDiaMap.values()]
    .map((d) => ({
      fecha: d.fecha,
      ventas: d.ventas instanceof Set ? d.ventas.size : d.ventas,
      ingreso_neto: round2(d.ingreso_neto),
      costo: round2(d.costo),
      ganancia: round2(d.ganancia),
      cerrado: d.cerrado,
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    desde, hasta, ventas,
    ingreso_bruto, descuentos, ingreso_neto, costo, ganancia,
    margen: pct(ganancia, ingreso_neto),
    ticket_promedio: ventas > 0 ? round2(ingreso_neto / ventas) : 0,
    por_metodo: { efectivo: round2(snap.efectivo + pm.efectivo), transferencia: round2(snap.transferencia + pm.transferencia) },
    merma_costo: round2(snap.merma + liveMerma),
    por_dia,
    dias_cerrados: cierres.length,
  };
}

function porProducto({ desde, hasta } = {}) {
  ({ desde, hasta } = rango(desde, hasta));
  const cierres = cierresEnRango(desde, hasta);
  const cerradas = new Set(cierres.map((c) => c.fecha));
  const items = itemsVendidos(desde, hasta, cerradas);

  const map = new Map();
  const acc = (nombre, unidades, ing, ingNeto, costo, gan) => {
    const p = map.get(nombre) || { producto: nombre, unidades: 0, ingreso_bruto: 0, ingreso_neto: 0, costo: 0, ganancia: 0 };
    p.unidades += unidades;
    p.ingreso_bruto += ing;
    p.ingreso_neto += ingNeto;
    p.costo += costo;
    p.ganancia += gan;
    map.set(nombre, p);
  };
  for (const i of items) acc(i.producto_nombre, 1, i.ingreso, i.ingreso_neto, i.costo, i.ganancia);
  if (cierres.length) {
    const ids = cierres.map((c) => c.id);
    const snap = getDb().prepare(
      `SELECT producto_nombre, SUM(unidades) AS unidades, SUM(ingreso_neto) AS ingreso_neto, SUM(costo) AS costo, SUM(ganancia) AS ganancia
       FROM cierre_dia_productos WHERE cierre_id IN (${ids.map(() => '?').join(',')}) GROUP BY producto_nombre`
    ).all(...ids);
    for (const s of snap) acc(s.producto_nombre, s.unidades, s.ingreso_neto, s.ingreso_neto, s.costo, s.ganancia);
  }

  const crudos = [...map.values()];
  const filas = crudos.map((p) => ({
    producto: p.producto,
    unidades: p.unidades,
    ingreso_bruto: round2(p.ingreso_bruto),
    ingreso_neto: round2(p.ingreso_neto),
    costo: round2(p.costo),
    ganancia: round2(p.ganancia),
    precio_prom: p.unidades > 0 ? round2(p.ingreso_neto / p.unidades) : 0,
    costo_prom: p.unidades > 0 ? round2(p.costo / p.unidades) : 0,
    margen: pct(p.ganancia, p.ingreso_neto),
  })).sort((a, b) => b.ganancia - a.ganancia);

  // El total se calcula del acumulado EN CRUDO (redondeo único), no de las
  // filas ya redondeadas: así coincide con el KPI de "Ganancias".
  const crudoTotal = crudos.reduce((t, p) => ({
    unidades: t.unidades + p.unidades,
    ingreso_bruto: t.ingreso_bruto + p.ingreso_bruto,
    ingreso_neto: t.ingreso_neto + p.ingreso_neto,
    costo: t.costo + p.costo,
    ganancia: t.ganancia + p.ganancia,
  }), { unidades: 0, ingreso_bruto: 0, ingreso_neto: 0, costo: 0, ganancia: 0 });
  const total = {
    unidades: crudoTotal.unidades,
    ingreso_bruto: round2(crudoTotal.ingreso_bruto),
    ingreso_neto: round2(crudoTotal.ingreso_neto),
    costo: round2(crudoTotal.costo),
    ganancia: round2(crudoTotal.ganancia),
  };
  total.margen = pct(crudoTotal.ganancia, crudoTotal.ingreso_neto);

  return { desde, hasta, filas, total };
}

// Insumos y merma: siempre en vivo (livianos, no se congelan en detalle).
function insumosUsados({ desde, hasta } = {}) {
  ({ desde, hasta } = rango(desde, hasta));
  const crudas = getDb().prepare(
    `SELECT i.nombre, i.unidad_base,
            SUM(vc.cantidad_base) AS cantidad, SUM(vc.cantidad_base * vc.costo_unitario) AS costo
     FROM venta_item_consumo vc
     JOIN venta_items vi ON vi.id = vc.venta_item_id
     JOIN ventas v ON v.id = vi.venta_id
     JOIN insumos i ON i.id = vc.insumo_id
     WHERE v.estado = 'pagada' AND vi.estado = 'activo'
       AND date(v.closed_at, 'localtime') BETWEEN @desde AND @hasta
     GROUP BY vc.insumo_id ORDER BY costo DESC`
  ).all({ desde, hasta });
  const filas = crudas.map((r) => ({ ...r, cantidad: round2(r.cantidad), costo: round2(r.costo) }));
  // total del acumulado en crudo (no de las filas redondeadas)
  return { desde, hasta, filas, total_costo: round2(crudas.reduce((s, r) => s + r.costo, 0)) };
}

/**
 * Desglose de inversión: por cada producto vendido, qué insumos consumió su receta
 * (× unidades) y cuánto costó; al final el total de cada insumo usado en el periodo.
 * Se calcula de `venta_item_consumo` (persiste aunque el día esté cerrado).
 */
function inversionPorProducto({ desde, hasta } = {}) {
  ({ desde, hasta } = rango(desde, hasta));
  const db = getDb();

  const consumo = db.prepare(
    `SELECT vi.producto_nombre, vi.presentacion_nombre,
            i.nombre AS insumo_nombre, i.unidad_base,
            SUM(vc.cantidad_base) AS cantidad,
            SUM(vc.cantidad_base * vc.costo_unitario) AS costo
     FROM venta_item_consumo vc
     JOIN venta_items vi ON vi.id = vc.venta_item_id
     JOIN ventas v ON v.id = vi.venta_id
     JOIN insumos i ON i.id = vc.insumo_id
     WHERE v.estado = 'pagada' AND vi.estado = 'activo'
       AND date(v.closed_at, 'localtime') BETWEEN @desde AND @hasta
     GROUP BY vi.producto_nombre, vi.presentacion_nombre, vc.insumo_id
     ORDER BY vi.producto_nombre, vi.presentacion_nombre, i.nombre`
  ).all({ desde, hasta });

  const unidades = new Map();
  for (const u of db.prepare(
    `SELECT vi.producto_nombre, vi.presentacion_nombre, COUNT(*) AS n
     FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
     WHERE v.estado = 'pagada' AND vi.estado = 'activo'
       AND date(v.closed_at, 'localtime') BETWEEN @desde AND @hasta
     GROUP BY vi.producto_nombre, vi.presentacion_nombre`
  ).all({ desde, hasta })) {
    unidades.set(`${u.producto_nombre}||${u.presentacion_nombre}`, u.n);
  }

  const etiqueta = (r) => r.producto_nombre + (r.presentacion_nombre && r.presentacion_nombre !== 'Único' ? ` ${r.presentacion_nombre}` : '');
  const prodMap = new Map();
  const totalMap = new Map();
  for (const r of consumo) {
    const label = etiqueta(r);
    if (!prodMap.has(label)) {
      prodMap.set(label, { producto: label, unidades: unidades.get(`${r.producto_nombre}||${r.presentacion_nombre}`) || 0, insumos: [], costo: 0 });
    }
    const p = prodMap.get(label);
    p.insumos.push({ nombre: r.insumo_nombre, unidad_base: r.unidad_base, cantidad: round2(r.cantidad), costo: round2(r.costo) });
    p.costo += r.costo; // acumula en crudo

    const t = totalMap.get(r.insumo_nombre) || { nombre: r.insumo_nombre, unidad_base: r.unidad_base, cantidad: 0, costo: 0 };
    t.cantidad += r.cantidad;
    t.costo += r.costo;
    totalMap.set(r.insumo_nombre, t);
  }

  // redondeo único al final; el total sale del acumulado en crudo
  const totalCrudo = [...totalMap.values()].reduce((s, t) => s + t.costo, 0);
  const productos = [...prodMap.values()]
    .map((p) => ({ ...p, costo: round2(p.costo) }))
    .sort((a, b) => b.costo - a.costo);
  const total_insumos = [...totalMap.values()]
    .map((t) => ({ ...t, cantidad: round2(t.cantidad), costo: round2(t.costo) }))
    .sort((a, b) => b.costo - a.costo);
  return { desde, hasta, productos, total_insumos, total_costo: round2(totalCrudo) };
}

function merma({ desde, hasta } = {}) {
  ({ desde, hasta } = rango(desde, hasta));
  const db = getDb();
  const por_insumo = db.prepare(
    `SELECT i.nombre, i.unidad_base, SUM(ABS(m.cantidad_base)) AS cantidad, SUM(ABS(m.cantidad_base) * m.costo_unitario) AS costo
     FROM inventory_movements m JOIN insumos i ON i.id = m.insumo_id
     WHERE m.tipo = 'merma' AND date(m.created_at, 'localtime') BETWEEN @desde AND @hasta
     GROUP BY m.insumo_id ORDER BY costo DESC`
  ).all({ desde, hasta }).map((r) => ({ ...r, cantidad: round2(r.cantidad), costo: round2(r.costo) }));
  const por_motivo = db.prepare(
    `SELECT CASE WHEN INSTR(m.motivo, ':') > 0 THEN SUBSTR(m.motivo, 1, INSTR(m.motivo, ':') - 1) ELSE m.motivo END AS motivo,
            COUNT(*) AS eventos, SUM(ABS(m.cantidad_base) * m.costo_unitario) AS costo
     FROM inventory_movements m
     WHERE m.tipo = 'merma' AND date(m.created_at, 'localtime') BETWEEN @desde AND @hasta
     GROUP BY motivo ORDER BY costo DESC`
  ).all({ desde, hasta }).map((r) => ({ ...r, costo: round2(r.costo) }));
  return { desde, hasta, por_insumo, por_motivo, total_costo: round2(por_insumo.reduce((s, r) => s + r.costo, 0)) };
}

/**
 * Números EN VIVO de un solo día (para congelar en el cierre; ignora si ya está cerrado).
 * Acumula EN CRUDO y redondea una sola vez por campo, de modo que el total del día
 * queda igual a la suma de sus productos (cierres_dia.costo === Σ cierre_dia_productos.costo)
 * y coincide con lo que muestran los reportes en vivo antes de cerrar.
 */
function _diaEnVivo(fecha) {
  const items = itemsVendidos(fecha, fecha);
  const pm = pagosPorMetodo(fecha, fecha);
  const ventas = new Set(items.map((i) => i.venta_id)).size;
  const ingreso_bruto = round2(items.reduce((s, i) => s + i.ingreso, 0));
  const descuentos = round2(items.reduce((s, i) => s + i.descuento, 0));

  const prodMap = new Map();
  for (const i of items) {
    const p = prodMap.get(i.producto_nombre) || { producto_nombre: i.producto_nombre, unidades: 0, ingreso_neto: 0, costo: 0, ganancia: 0 };
    p.unidades += 1;
    p.ingreso_neto += i.ingreso_neto;
    p.costo += i.costo;
    p.ganancia += i.ganancia;
    prodMap.set(i.producto_nombre, p);
  }
  const productos = [...prodMap.values()].map((p) => ({
    producto_nombre: p.producto_nombre,
    unidades: p.unidades,
    ingreso_neto: round2(p.ingreso_neto),
    costo: round2(p.costo),
    ganancia: round2(p.ganancia),
  }));

  // Los totales del día se cuadran con la suma de sus productos (ya redondeados),
  // así el snapshot es consistente: cierres_dia.costo === Σ cierre_dia_productos.costo.
  const costo = round2(productos.reduce((s, p) => s + p.costo, 0));
  const ganancia = round2(productos.reduce((s, p) => s + p.ganancia, 0));
  const ingreso_neto = round2(productos.reduce((s, p) => s + p.ingreso_neto, 0));

  return {
    ventas, ingreso_bruto, descuentos, ingreso_neto, costo, ganancia,
    efectivo: pm.efectivo, transferencia: pm.transferencia,
    merma_costo: mermaCosto(fecha, fecha),
    productos,
  };
}

/**
 * Entradas y salidas de efectivo del cajón en el periodo, con su concepto.
 *
 * OJO: esto NO es gasto ni afecta la ganancia. Es dinero que se sacó o se
 * metió al cajón (comprar servilletas, la dueña llevándose efectivo, traer
 * cambio). Lo que se compró con ese dinero, si es insumo, entra al costo por
 * su propio lado —al registrar la entrada de inventario—, así que sumarlo
 * aquí otra vez sería contarlo dos veces. Va aparte a propósito.
 */
function movimientosCaja({ desde, hasta } = {}) {
  ({ desde, hasta } = rango(desde, hasta));
  const filas = getDb().prepare(
    `SELECT m.tipo, m.monto, m.concepto, m.username,
            date(m.created_at, 'localtime') AS fecha,
            datetime(m.created_at, 'localtime') AS cuando,
            m.corte_id
     FROM caja_movimientos m
     WHERE date(m.created_at, 'localtime') BETWEEN @desde AND @hasta
     ORDER BY m.created_at DESC`
  ).all({ desde, hasta });

  const suma = (t) => round2(filas.filter((f) => f.tipo === t).reduce((s, f) => s + f.monto, 0));
  const entradas = suma('ingreso');
  const salidas = suma('retiro');

  // también por concepto, para ver en qué se va el efectivo
  const porConcepto = new Map();
  for (const f of filas.filter((x) => x.tipo === 'retiro')) {
    const k = f.concepto.trim().toLowerCase();
    const p = porConcepto.get(k) || { concepto: f.concepto.trim(), veces: 0, monto: 0 };
    p.veces += 1;
    p.monto += f.monto;
    porConcepto.set(k, p);
  }

  return {
    desde, hasta, entradas, salidas,
    neto: round2(entradas - salidas),
    filas,
    salidas_por_concepto: [...porConcepto.values()]
      .map((p) => ({ ...p, monto: round2(p.monto) }))
      .sort((a, b) => b.monto - a.monto),
  };
}

module.exports = { resumen, porProducto, insumosUsados, inversionPorProducto, merma, movimientosCaja, _diaEnVivo };
