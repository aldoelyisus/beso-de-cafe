'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTOR, getDb, crearInsumo, crearProducto, crearProductoCategoria, abrirCaja } = require('../helpers/setup');
const svc = require('../../src/main/services/reporteService');
const ventaSvc = require('../../src/main/services/ventaService');
const insumoSvc = require('../../src/main/services/insumoService');
const promoSvc = require('../../src/main/services/promocionService');
const cajaSvc = require('../../src/main/services/cajaService');
const cierreSvc = require('../../src/main/services/cierreService');

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m || 'valor'}: ${a} ≈ ${b}`);
const HOY = svc && new Date().toLocaleDateString('en-CA');
const AYER = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
const rangoHoy = { desde: HOY, hasta: HOY };

/** Café $40 con receta 1 insumo (10 g × 0.30 = $3 de costo). Devuelve { presId, grano }. */
function cafe(precio = 40) {
  const grano = crearInsumo({ nombre: 'Grano', unidad_base: 'g', factor_compra: 1000, costo_compra: 300, stock_inicial_compra: 20 });
  const p = crearProducto({ nombre: 'Café', precio }, { items: [{ insumo_id: grano.id, cantidad_base: 10, modo: 'siempre' }] });
  return { presId: p.presentaciones[0].id, grano, productoId: p.id };
}

function venderYCobrar(presId, cantidad, metodo = 'efectivo') {
  let v = ventaSvc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad }, ACTOR);
  return ventaSvc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo }, ACTOR);
}

// ================= validación de rango =================
test('rechaza fechas inválidas o invertidas', () => {
  assert.throws(() => svc.resumen({ desde: 'x', hasta: HOY }), /no válido/i);
  assert.throws(() => svc.resumen({ desde: '2030-05-01', hasta: '2030-04-01' }), /antes de la inicial/i);
});

// ================= resumen =================
test('rango sin ventas devuelve todo en cero', () => {
  const r = svc.resumen({ desde: '2000-01-01', hasta: '2000-01-02' });
  assert.equal(r.ventas, 0);
  assert.equal(r.ingreso_neto, 0);
  assert.equal(r.ganancia, 0);
  assert.equal(r.margen, 0);
});

test('resumen: cuadra ingreso, costo, ganancia, margen y ticket promedio', () => {
  abrirCaja();
  const { presId } = cafe(40);
  venderYCobrar(presId, 3, 'efectivo'); // venta 1: 120, costo 9
  venderYCobrar(presId, 1, 'transferencia'); // venta 2: 40, costo 3

  const r = svc.resumen(rangoHoy);
  assert.equal(r.ventas, 2);
  near(r.ingreso_bruto, 160, 'bruto');
  near(r.descuentos, 0, 'sin descuentos');
  near(r.ingreso_neto, 160, 'neto');
  near(r.costo, 12, 'inversión = 4 × 3');
  near(r.ganancia, 148, 'ganancia');
  near(r.ticket_promedio, 80, '160 / 2');
  near(r.por_metodo.efectivo, 120, 'efectivo');
  near(r.por_metodo.transferencia, 40, 'transferencia');
  assert.ok(r.margen > 90 && r.margen <= 100);
});

test('solo cuentan las ventas pagadas (abiertas y canceladas no)', () => {
  abrirCaja();
  const { presId } = cafe(40);
  venderYCobrar(presId, 1, 'efectivo');
  const cancelada = venderYCobrar(presId, 1, 'efectivo');
  ventaSvc.cancelarVenta(cancelada.id, 'x', ACTOR);
  // una cuenta abierta sin cobrar
  const abierta = ventaSvc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  ventaSvc.agregarItem(abierta.id, { presentacionId: presId, cantidad: 1 }, ACTOR);

  const r = svc.resumen(rangoHoy);
  assert.equal(r.ventas, 1);
  near(r.ingreso_neto, 40, 'solo la venta pagada y no cancelada');
});

test('un producto cancelado dentro de una venta no suma', () => {
  abrirCaja();
  const { presId } = cafe(40);
  let v = ventaSvc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad: 3 }, ACTOR);
  const item = v.items.find((i) => i.estado === 'activo').id;
  v = ventaSvc.cancelarItem(v.id, item, 'x', ACTOR); // quedan 2
  ventaSvc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);

  near(svc.resumen(rangoHoy).ingreso_neto, 80, '2 unidades, no 3');
});

test('el descuento de una promoción se refleja en el resumen', () => {
  abrirCaja();
  const { presId } = cafe(40);
  const promo = promoSvc.createPromocion({ nombre: '$15 off', tipo: 'monto_fijo', ambito: 'cuenta', valor: 15, fecha_inicio: HOY, fecha_fin: '2040-12-31' });
  let v = ventaSvc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad: 2 }, ACTOR); // 80
  v = ventaSvc.aplicarPromocion(v.id, promo.id, ACTOR);
  ventaSvc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);

  const r = svc.resumen(rangoHoy);
  near(r.ingreso_bruto, 80, 'bruto');
  near(r.descuentos, 15, 'descuento');
  near(r.ingreso_neto, 65, 'neto');
  near(r.por_metodo.efectivo, 65, 'se cobró el neto');
});

test('resumen incluye el costo de la merma del periodo', () => {
  abrirCaja();
  const { presId, grano } = cafe(40);
  venderYCobrar(presId, 1, 'efectivo');
  insumoSvc.registrarMovimiento({ insumoId: grano.id, tipo: 'merma', cantidad: 100, motivo: 'derrame' }, ACTOR); // 100 × 0.30 = 30
  near(svc.resumen(rangoHoy).merma_costo, 30, 'costo de merma');
});

test('resumen: desglose por día', () => {
  abrirCaja();
  const { presId } = cafe(40);
  venderYCobrar(presId, 2, 'efectivo');
  const r = svc.resumen(rangoHoy);
  assert.equal(r.por_dia.length, 1);
  assert.equal(r.por_dia[0].fecha, HOY);
  assert.equal(r.por_dia[0].ventas, 1);
});

// ================= porProducto =================
test('por producto: unidades, ingreso, inversión, ganancia, margen y total', () => {
  abrirCaja();
  const a = cafe(40); // costo unit 3
  const catP = crearProductoCategoria('Postres');
  const pay = crearProducto({ nombre: 'Pay', categoria_id: catP.id, precio: 55 },
    { items: [{ insumo_id: a.grano.id, cantidad_base: 5, modo: 'siempre' }] }); // costo 5 × 0.30 = 1.5
  venderYCobrar(a.presId, 3, 'efectivo'); // Café: 120, costo 9
  venderYCobrar(pay.presentaciones[0].id, 1, 'efectivo'); // Pay: 55, costo 1.5

  const r = svc.porProducto(rangoHoy);
  const cafeRow = r.filas.find((f) => f.producto === 'Café');
  const payRow = r.filas.find((f) => f.producto === 'Pay');
  assert.equal(cafeRow.unidades, 3);
  near(cafeRow.ingreso_neto, 120, 'ingreso café');
  near(cafeRow.costo, 9, 'inversión café');
  near(cafeRow.ganancia, 111, 'ganancia café');
  near(payRow.ganancia, 53.5, 'ganancia pay');
  // ordenado por ganancia desc
  assert.equal(r.filas[0].producto, 'Café');
  // total
  near(r.total.ingreso_neto, 175, 'total ingreso');
  near(r.total.ganancia, 164.5, 'total ganancia');
  assert.equal(r.total.unidades, 4);
});

test('por producto: el descuento se reparte entre los renglones', () => {
  abrirCaja();
  const a = cafe(40);
  const b = crearProducto({ nombre: 'Otro', precio: 60 }, { items: [{ insumo_id: a.grano.id, cantidad_base: 10, modo: 'siempre' }] });
  const promo = promoSvc.createPromocion({ nombre: '$20 off', tipo: 'monto_fijo', ambito: 'cuenta', valor: 20, fecha_inicio: HOY, fecha_fin: '2040-12-31' });
  let v = ventaSvc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = ventaSvc.agregarItem(v.id, { presentacionId: a.presId, cantidad: 1 }, ACTOR); // 40
  v = ventaSvc.agregarItem(v.id, { presentacionId: b.presentaciones[0].id, cantidad: 1 }, ACTOR); // 60
  v = ventaSvc.aplicarPromocion(v.id, promo.id, ACTOR);
  ventaSvc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);

  const r = svc.porProducto(rangoHoy);
  // bruto 100, descuento 20 -> Café (40/100)×20 = 8, Otro (60/100)×20 = 12
  near(r.filas.find((f) => f.producto === 'Café').ingreso_neto, 32, 'café 40 − 8');
  near(r.filas.find((f) => f.producto === 'Otro').ingreso_neto, 48, 'otro 60 − 12');
  near(r.total.ingreso_neto, 80, 'total neto = 100 − 20');
});

// ================= insumos usados =================
test('insumos usados: solo por ventas pagadas, con cantidad y costo', () => {
  abrirCaja();
  const { presId, grano } = cafe(40);
  venderYCobrar(presId, 4, 'efectivo'); // 4 × 10 g = 40 g, costo 12
  const r = svc.insumosUsados(rangoHoy);
  const row = r.filas.find((x) => x.nombre === 'Grano');
  near(row.cantidad, 40, 'gramos consumidos');
  near(row.costo, 12, 'costo del consumo');
  near(r.total_costo, 12, 'total');
});

// ================= desglose de inversión =================
test('inversión por producto: desglose de receta por producto + total por insumo', () => {
  abrirCaja();
  const grano = crearInsumo({ nombre: 'Grano', unidad_base: 'g', factor_compra: 1000, costo_compra: 300, stock_inicial_compra: 50 }); // 0.30/g
  const leche = crearInsumo({ nombre: 'Leche', unidad_base: 'ml', factor_compra: 1000, costo_compra: 25, stock_inicial_compra: 50 }); // 0.025/ml

  const frappe = crearProducto({ nombre: 'Frappé', precio: 70 }, {
    items: [
      { insumo_id: grano.id, cantidad_base: 8, modo: 'siempre' },
      { insumo_id: leche.id, cantidad_base: 100, modo: 'siempre' },
    ],
  });
  const americano = crearProducto({ nombre: 'Americano', precio: 40 }, {
    items: [{ insumo_id: grano.id, cantidad_base: 12, modo: 'siempre' }],
  });

  venderYCobrar(frappe.presentaciones[0].id, 3, 'efectivo');   // grano 24 g, leche 300 ml
  venderYCobrar(americano.presentaciones[0].id, 5, 'efectivo'); // grano 60 g

  const r = svc.inversionPorProducto(rangoHoy);
  assert.equal(r.productos.length, 2);

  const fr = r.productos.find((p) => p.producto === 'Frappé');
  assert.equal(fr.unidades, 3);
  const frGrano = fr.insumos.find((i) => i.nombre === 'Grano');
  near(frGrano.cantidad, 24, 'grano del frappé: 8 × 3');
  near(frGrano.costo, 24 * 0.30, 'costo grano del frappé');
  near(fr.insumos.find((i) => i.nombre === 'Leche').cantidad, 300, 'leche: 100 × 3');
  near(fr.costo, 24 * 0.30 + 300 * 0.025, 'inversión total del frappé');

  const am = r.productos.find((p) => p.producto === 'Americano');
  assert.equal(am.unidades, 5);
  near(am.insumos.find((i) => i.nombre === 'Grano').cantidad, 60, 'grano americano: 12 × 5');

  // total por insumo
  const totGrano = r.total_insumos.find((t) => t.nombre === 'Grano');
  near(totGrano.cantidad, 84, 'grano total del día: 24 + 60');
  near(totGrano.costo, 84 * 0.30, 'costo grano total');
  near(r.total_insumos.find((t) => t.nombre === 'Leche').cantidad, 300, 'leche total');
  near(r.total_costo, 84 * 0.30 + 300 * 0.025, 'inversión total del periodo');
});

test('inversión por producto: los productos cancelados no cuentan', () => {
  abrirCaja();
  const grano = crearInsumo({ nombre: 'Grano', unidad_base: 'g', factor_compra: 1000, costo_compra: 300, stock_inicial_compra: 50 });
  const p = crearProducto({ nombre: 'Café', precio: 40 }, { items: [{ insumo_id: grano.id, cantidad_base: 10, modo: 'siempre' }] });
  let v = ventaSvc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = ventaSvc.agregarItem(v.id, { presentacionId: p.presentaciones[0].id, cantidad: 3 }, ACTOR);
  const item = v.items.find((i) => i.estado === 'activo').id;
  v = ventaSvc.cancelarItem(v.id, item, 'x', ACTOR); // quedan 2
  ventaSvc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);

  const r = svc.inversionPorProducto(rangoHoy);
  near(r.total_insumos.find((t) => t.nombre === 'Grano').cantidad, 20, '2 unidades, no 3');
});

// ================= consistencia entre vistas (centavos) =================
test('el costo de insumos coincide en las 4 vistas aunque haya fracciones de centavo', () => {
  abrirCaja();
  // insumos con costo unitario que produce fracciones de centavo
  const leche = crearInsumo({ nombre: 'Leche', unidad_base: 'ml', factor_compra: 1000, costo_compra: 25, stock_inicial_compra: 100 });   // 0.025/ml
  const base = crearInsumo({ nombre: 'Base', unidad_base: 'g', factor_compra: 1200, costo_compra: 1000, stock_inicial_compra: 100 });     // 0.833333/g
  const soluble = crearInsumo({ nombre: 'Soluble', unidad_base: 'g', factor_compra: 1700, costo_compra: 90, stock_inicial_compra: 100 }); // 0.0529411/g

  const frappe = crearProducto({ nombre: 'Frappé Oreo', precio: 70 }, {
    items: [
      { insumo_id: leche.id, cantidad_base: 355, modo: 'siempre' }, // 8.875 (fracción)
      { insumo_id: base.id, cantidad_base: 1, modo: 'siempre' },    // 0.833333
    ],
  });
  const americano = crearProducto({ nombre: 'Americano', precio: 40 }, {
    items: [
      { insumo_id: soluble.id, cantidad_base: 20, modo: 'siempre' }, // 1.058823
      { insumo_id: leche.id, cantidad_base: 15, modo: 'siempre' },   // 0.375
    ],
  });

  venderYCobrar(frappe.presentaciones[0].id, 2, 'efectivo');
  venderYCobrar(americano.presentaciones[0].id, 5, 'efectivo');

  const esperado = Math.round((2 * (355 * 0.025 + 1 * (1000 / 1200)) + 5 * (20 * (90 / 1700) + 15 * 0.025)) * 100) / 100;

  const resumen = svc.resumen(rangoHoy);
  const porProd = svc.porProducto(rangoHoy);
  const insumos = svc.insumosUsados(rangoHoy);
  const inversion = svc.inversionPorProducto(rangoHoy);

  assert.equal(resumen.costo, esperado, 'KPI de Ganancias');
  assert.equal(resumen.por_dia[0].costo, esperado, 'tabla "Por día" del mismo reporte');
  assert.equal(porProd.total.costo, esperado, 'total de "Por producto"');
  assert.equal(insumos.total_costo, esperado, 'total de "Insumos usados"');
  assert.equal(inversion.total_costo, esperado, 'total de "Desglose de inversión"');
});

test('subir el costo a media jornada NO reescribe lo ya vendido', () => {
  abrirCaja();
  const { presId, grano } = cafe(40); // 10 g × 0.30 = $3 por café
  venderYCobrar(presId, 2, 'efectivo'); // mañana: 2 × 3 = 6

  // Llegó al mínimo, compra de emergencia más cara: el costo sube a 0.50 /g.
  insumoSvc.registrarMovimiento(
    { insumoId: grano.id, tipo: 'ajuste_costo', costo_unitario: 0.5, nota: 'compra de emergencia' }, ACTOR);

  venderYCobrar(presId, 3, 'efectivo'); // tarde: 3 × 5 = 15

  const r = svc.resumen(rangoHoy);
  near(r.costo, 21, 'los 2 de la mañana a $3 + los 3 de la tarde a $5');

  const insumos = svc.insumosUsados(rangoHoy);
  const row = insumos.filas.find((x) => x.nombre === 'Grano');
  near(row.cantidad, 50, '5 cafés × 10 g');
  near(row.costo, 21, 'no se recalcula al costo nuevo (sería 25)');
});

test('la corrección de costo no aparece como merma ni como consumo', () => {
  abrirCaja();
  const { presId, grano } = cafe(40);
  venderYCobrar(presId, 1, 'efectivo');
  insumoSvc.registrarMovimiento(
    { insumoId: grano.id, tipo: 'ajuste_costo', costo_unitario: 9, nota: 'subió' }, ACTOR);

  near(svc.merma(rangoHoy).total_costo, 0, 'no suma a merma');
  near(svc.resumen(rangoHoy).merma_costo, 0, 'no suma a la merma del resumen');
  near(svc.insumosUsados(rangoHoy).total_costo, 3, 'solo el consumo real de la venta');
});

// ================= merma =================
test('merma: agrupa por insumo y por motivo (prefijo antes de ":")', () => {
  const { grano } = cafe(40);
  insumoSvc.registrarMovimiento({ insumoId: grano.id, tipo: 'merma', cantidad: 100, motivo: 'derrame', nota: 'se cayó' }, ACTOR); // 30
  insumoSvc.registrarMovimiento({ insumoId: grano.id, tipo: 'merma', cantidad: 50, motivo: 'caducidad' }, ACTOR); // 15
  const r = svc.merma(rangoHoy);
  near(r.total_costo, 45, 'total merma');
  assert.equal(r.por_insumo[0].nombre, 'Grano');
  near(r.por_insumo[0].costo, 45, 'costo por insumo');
  const derrame = r.por_motivo.find((x) => x.motivo === 'derrame');
  assert.equal(derrame.eventos, 1);
  near(derrame.costo, 30, 'costo del motivo derrame');
});

// ================= snapshot + días abiertos =================
test('rango de varios días: suma el día cerrado (snapshot) + el día abierto (en vivo)', () => {
  abrirCaja();
  const { presId } = cafe(40);

  // venta de AYER: la creamos hoy y le movemos closed_at
  const vAyer = venderYCobrar(presId, 2, 'transferencia'); // 80, costo 6
  getDb().prepare("UPDATE ventas SET closed_at = datetime(?, '12:00:00') WHERE id = ?").run(AYER, vAyer.id);
  getDb().prepare("UPDATE venta_pagos SET created_at = datetime(?, '12:00:00') WHERE venta_id = ?").run(AYER, vAyer.id);

  // cerrar el día de AYER (requiere sin cuentas abiertas ni turno abierto)
  cajaSvc.cerrarCorte({ efectivo_contado: 0 }, ACTOR);
  cierreSvc.cerrarDia(AYER, ACTOR);

  // venta de HOY
  abrirCaja();
  venderYCobrar(presId, 1, 'efectivo'); // 40, costo 3

  const r = svc.resumen({ desde: AYER, hasta: HOY });
  assert.equal(r.dias_cerrados, 1);
  assert.equal(r.ventas, 2, '1 de ayer (snapshot) + 1 de hoy (vivo)');
  near(r.ingreso_neto, 120, '80 + 40');
  near(r.costo, 9, '6 + 3');
  near(r.ganancia, 111, '120 − 9');
  assert.equal(r.por_dia.length, 2, 'una fila por día');

  const pp = svc.porProducto({ desde: AYER, hasta: HOY });
  assert.equal(pp.filas.length, 1);
  assert.equal(pp.filas[0].unidades, 3, '2 de ayer + 1 de hoy');
});
