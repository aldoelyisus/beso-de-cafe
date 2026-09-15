'use strict';

/**
 * Existencia en NEGATIVO.
 *
 * Regla de negocio: una venta nunca se frena por el inventario — el producto
 * existe aunque el conteo diga que no, y dejar a un cliente sin cobrar cuesta
 * más que el descuadre. Pero el negativo tiene que verse y no debe corromper
 * el costo de la siguiente compra.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTOR, crearInsumo, crearProducto } = require('../helpers/setup');
const svc = require('../../src/main/services/insumoService');
const ventaSvc = require('../../src/main/services/ventaService');
const mesaSvc = require('../../src/main/services/mesaService');

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m || 'valor'}: ${a} ≈ ${b}`);

/** Galleta Oreo: paquete de 24 a $30 ($1.25/pza) y un waffle que gasta 3. */
function oreo({ paquetes = 1 } = {}) {
  const galleta = crearInsumo({
    nombre: 'Oreo', unidad_base: 'pieza', unidad_compra: 'pza (×24)',
    factor_compra: 24, costo_compra: 30, stock_inicial_compra: paquetes, stock_minimo: 10,
  });
  const waffle = crearProducto({ nombre: 'Waffle Oreo', precio: 95 }, {
    items: [{ insumo_id: galleta.id, cantidad_base: 3, modo: 'siempre' }],
  });
  return { galleta, presId: waffle.presentaciones[0].id };
}

// ═══════════ la venta no se frena ═══════════
test('vender sin existencia NO se bloquea: la caja nunca se frena', () => {
  const { galleta, presId } = oreo();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = ventaSvc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);

  const r = ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad: 23 }, ACTOR);
  assert.equal(r.items.length, 23, 'se vendieron los 23');
  assert.equal(svc.getInsumo(galleta.id).stock, -45, '24 − 69 = −45');
});

test('pero la venta AVISA qué quedó en negativo', () => {
  const { galleta, presId } = oreo();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = ventaSvc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);

  const ok = ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad: 5 }, ACTOR);
  assert.deepEqual(ok.faltantes, [], '15 de 24: todavía alcanza, no avisa');

  const r = ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad: 5 }, ACTOR);
  assert.equal(r.faltantes.length, 1, 'ahora sí avisa');
  assert.equal(r.faltantes[0].nombre, 'Oreo');
  assert.equal(r.faltantes[0].stock, -6);
  assert.equal(r.faltantes[0].unidad, 'pieza');
  assert.equal(svc.getInsumo(galleta.id).stock, -6);
});

// ═══════════ el negativo se ve distinto de "por acabarse" ═══════════
test('el faltante se marca aparte del "bajo stock"', () => {
  const bajo = crearInsumo({ nombre: 'Casi', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 5, stock_minimo: 100 });
  const { galleta, presId } = oreo();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = ventaSvc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad: 23 }, ACTOR);

  const enFalta = svc.getInsumo(galleta.id);
  const porAcabarse = svc.getInsumo(bajo.id);
  assert.ok(enFalta.faltante, 'el que está en −45 se marca como faltante');
  assert.ok(!porAcabarse.faltante, 'el que tiene 5 g NO es faltante, solo va bajo');
  assert.ok(porAcabarse.bajo_stock, 'pero sí está por acabarse');
  assert.equal(svc.countFaltantes(), 1, 'se cuentan aparte');
  assert.equal(svc.countBajoStock(), 2, 'ambos cuentan como por acabarse');
});

// ═══════════ el negativo NO corrompe el costo promedio ═══════════
test('comprar estando en negativo no infla el costo promedio', () => {
  const { galleta, presId } = oreo();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = ventaSvc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad: 23 }, ACTOR);
  assert.equal(svc.getInsumo(galleta.id).stock, -45);

  // 4 paquetes (96 pzas) a $31.20 el paquete = $1.30 por galleta.
  const r = svc.registrarMovimiento({ insumoId: galleta.id, tipo: 'entrada', cantidad: 4, costo_compra: 31.20 }, ACTOR);

  assert.equal(r.insumo.stock, 51, 'la existencia sí arrastra el faltante');
  near(r.insumo.costo_unitario, 1.30,
    'TODA la existencia real se compró a $1.30; el −45 no debe meterse al promedio');
});

test('con existencia positiva el promedio ponderado sigue igual', () => {
  const i = crearInsumo({ nombre: 'Café', unidad_base: 'g', unidad_compra: 'kg', factor_compra: 1000, costo_compra: 200, stock_inicial_compra: 2 });
  // 2000 g @ 0.20 + 2000 g @ 0.40 -> 0.30
  const r = svc.registrarMovimiento({ insumoId: i.id, tipo: 'entrada', cantidad: 2, costo_compra: 400 }, ACTOR);
  near(r.insumo.costo_unitario, 0.30, 'no se rompió el caso normal');
});

// ═══════════ la merma explica qué hacer ═══════════
test('la merma estando en negativo dice cómo arreglarlo', () => {
  const { galleta, presId } = oreo();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = ventaSvc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad: 23 }, ACTOR);

  try {
    svc.registrarMovimiento({ insumoId: galleta.id, tipo: 'merma', cantidad: 1, motivo: 'derrame' }, ACTOR);
    assert.fail('debería haber lanzado');
  } catch (e) {
    assert.match(e.message, /faltante sin registrar/i);
    assert.match(e.message, /conteo físico|registra la compra/i, 'dice qué hacer');
  }
});

test('con existencia positiva la merma conserva su mensaje de siempre', () => {
  const i = crearInsumo({ nombre: 'Café', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 5 });
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'merma', cantidad: 99, motivo: 'caducidad' }, ACTOR),
    /No hay suficiente existencia/i);
});

// ═══════════ el conteo físico es la salida ═══════════
test('el conteo físico deja la existencia en la realidad', () => {
  const { galleta, presId } = oreo();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = ventaSvc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad: 23 }, ACTOR);

  const r = svc.registrarMovimiento({ insumoId: galleta.id, tipo: 'ajuste', conteo: 12, nota: 'recuento de alacena' }, ACTOR);
  assert.equal(r.insumo.stock, 12);
  assert.ok(!svc.getInsumo(galleta.id).faltante, 'ya no está en falta');
  assert.equal(svc.countFaltantes(), 0);
});
