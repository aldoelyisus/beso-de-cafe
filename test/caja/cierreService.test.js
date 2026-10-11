'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTOR, crearInsumo, crearProducto, abrirCaja } = require('../helpers/setup');
const svc = require('../../src/main/services/cierreService');
const cajaSvc = require('../../src/main/services/cajaService');
const ventaSvc = require('../../src/main/services/ventaService');
const insumoSvc = require('../../src/main/services/insumoService');
const reporteSvc = require('../../src/main/services/reporteService');

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m || 'valor'}: ${a} ≈ ${b}`);
const HOY = svc.hoyISO();

/** Producto "Café" $40 con receta de 1 insumo (10 g × 0.30 = $3 de costo). */
function cafe() {
  const grano = crearInsumo({ nombre: 'Grano', unidad_base: 'g', factor_compra: 1000, costo_compra: 300, stock_inicial_compra: 5 });
  const p = crearProducto({ nombre: 'Café', precio: 40 }, { items: [{ insumo_id: grano.id, cantidad_base: 10, modo: 'siempre' }] });
  return { grano, presId: p.presentaciones[0].id };
}

function venderYCobrar(presId, cantidad, metodo = 'efectivo') {
  let v = ventaSvc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad }, ACTOR);
  return ventaSvc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo }, ACTOR);
}

// ================= estadoDia =================
test('estadoDia de hoy: no cerrado, con números en vivo', () => {
  abrirCaja();
  const { presId } = cafe();
  venderYCobrar(presId, 2);
  const est = svc.estadoDia(HOY);
  assert.equal(est.cerrado, false);
  assert.equal(est.en_vivo.ventas, 1);
  near(est.en_vivo.ingreso_neto, 80, '2 × 40');
});

// ================= bloqueos =================
test('no se cierra el día con cuentas abiertas', () => {
  abrirCaja();
  const { presId } = cafe();
  const v = ventaSvc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  assert.throws(() => svc.cerrarDia(HOY, ACTOR), /cuenta\(s\) abierta/i);
});

test('no se cierra el día con la caja abierta', () => {
  abrirCaja();
  assert.throws(() => svc.cerrarDia(HOY, ACTOR), /caja está abierta/i);
});

test('no se cierra un día futuro ni uno ya cerrado', () => {
  cajaSvc.abrirCorte({ fondo_inicial: 0 }, ACTOR);
  cajaSvc.cerrarCorte({ efectivo_contado: 0 }, ACTOR);
  assert.throws(() => svc.cerrarDia('2099-01-01', ACTOR), /futuro/i);
  svc.cerrarDia(HOY, ACTOR);
  assert.throws(() => svc.cerrarDia(HOY, ACTOR), /ya está cerrado/i);
});

// ================= cerrar el día =================
test('cerrar el día congela los totales y el desglose por producto', () => {
  abrirCaja();
  const { presId } = cafe();
  venderYCobrar(presId, 3, 'efectivo');   // 120, costo 3×3 = 9
  cajaSvc.cerrarCorte({ efectivo_contado: 120 }, ACTOR);

  const c = svc.cerrarDia(HOY, ACTOR);
  assert.equal(c.ventas, 1);
  near(c.ingreso_neto, 120, 'ingreso');
  near(c.costo, 9, 'inversión = 3 × 10g × 0.30');
  near(c.ganancia, 111, 'ganancia');
  near(c.efectivo, 120, 'efectivo');
  near(c.transferencia, 0, 'transferencia');
  assert.equal(c.productos.length, 1);
  assert.equal(c.productos[0].producto_nombre, 'Café');
  assert.equal(c.productos[0].unidades, 3);
  assert.equal(svc.diaCerrado(HOY), true);
});

test('resumen: el día cerrado se lee del snapshot y da el mismo total', () => {
  abrirCaja();
  const { presId } = cafe();
  venderYCobrar(presId, 2, 'transferencia'); // 80
  const enVivo = reporteSvc.resumen({ desde: HOY, hasta: HOY });

  cajaSvc.cerrarCorte({ efectivo_contado: 0 }, ACTOR);
  svc.cerrarDia(HOY, ACTOR);

  const post = reporteSvc.resumen({ desde: HOY, hasta: HOY });
  near(post.ingreso_neto, enVivo.ingreso_neto, 'mismo ingreso');
  near(post.ganancia, enVivo.ganancia, 'misma ganancia');
  assert.equal(post.dias_cerrados, 1);

  const pp = reporteSvc.porProducto({ desde: HOY, hasta: HOY });
  assert.equal(pp.filas.length, 1);
  assert.equal(pp.filas[0].unidades, 2);
});

// ================= reabrir =================
test('reabrir el día lo quita y permite volver a cobrar', () => {
  abrirCaja();
  const { presId } = cafe();
  venderYCobrar(presId, 1, 'transferencia');
  cajaSvc.cerrarCorte({ efectivo_contado: 0 }, ACTOR);
  svc.cerrarDia(HOY, ACTOR);
  assert.equal(svc.diaCerrado(HOY), true);

  svc.reabrirDia(HOY, ACTOR);
  assert.equal(svc.diaCerrado(HOY), false);

  // ahora sí se puede cobrar de nuevo
  const v = ventaSvc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  assert.doesNotThrow(() => ventaSvc.cobrar(v.id, { itemIds: ventaSvc.getVenta(v.id).items_sin_pagar, metodo: 'transferencia' }, ACTOR));
});

test('reabrir un día que no está cerrado lanza error', () => {
  assert.throws(() => svc.reabrirDia(HOY, ACTOR), /no está cerrado/i);
});

test('listCierres trae los días cerrados', () => {
  abrirCaja();
  const { presId } = cafe();
  venderYCobrar(presId, 1, 'transferencia');
  cajaSvc.cerrarCorte({ efectivo_contado: 0 }, ACTOR);
  svc.cerrarDia(HOY, ACTOR);
  const lista = svc.listCierres();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].fecha, HOY);
  assert.equal(lista[0].ventas, 1);
});
