'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTOR, crearProducto } = require('../helpers/setup');
const svc = require('../../src/main/services/cajaService');
const ventaSvc = require('../../src/main/services/ventaService');

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m || 'valor'}: ${a} ≈ ${b}`);

/** Vende `cantidad` unidades de un producto de $precio y las cobra con `metodo`. */
function vender({ precio = 40, cantidad = 1, metodo = 'efectivo' } = {}) {
  const p = crearProducto({ nombre: 'Café', precio });
  let v = ventaSvc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = ventaSvc.agregarItem(v.id, { presentacionId: p.presentaciones[0].id, cantidad }, ACTOR);
  return ventaSvc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo }, ACTOR);
}

// ================= abrir turno =================
test('abrir un turno lo deja como el turno abierto', () => {
  const c = svc.abrirCorte({ fondo_inicial: 500 }, ACTOR);
  assert.equal(c.estado, 'abierto');
  assert.equal(c.fondo_inicial, 500);
  assert.equal(svc.corteAbiertoRow().id, c.id);
});

test('no se pueden abrir dos turnos a la vez', () => {
  svc.abrirCorte({ fondo_inicial: 0 }, ACTOR);
  assert.throws(() => svc.abrirCorte({ fondo_inicial: 0 }, ACTOR), /ya hay un turno/i);
});

test('rechaza un fondo inicial negativo', () => {
  assert.throws(() => svc.abrirCorte({ fondo_inicial: -1 }, ACTOR), /negativo/i);
});

// ================= movimientos =================
test('registrar un movimiento requiere un turno abierto', () => {
  assert.throws(() => svc.registrarMovimiento({ tipo: 'retiro', monto: 10, concepto: 'x' }, ACTOR), /turno de caja abierto/i);
});

test('un retiro baja y un ingreso sube el efectivo esperado', () => {
  const c = svc.abrirCorte({ fondo_inicial: 500 }, ACTOR);
  svc.registrarMovimiento({ tipo: 'retiro', monto: 80, concepto: 'servilletas' }, ACTOR);
  let full = svc.getCorte(c.id);
  near(full.efectivo_esperado_calc, 500 - 80, 'tras el retiro');
  svc.registrarMovimiento({ tipo: 'ingreso', monto: 30, concepto: 'cambio' }, ACTOR);
  full = svc.getCorte(c.id);
  near(full.efectivo_esperado_calc, 500 - 80 + 30, 'tras el ingreso');
  assert.equal(full.retiros, 80);
  assert.equal(full.ingresos_manuales, 30);
  assert.equal(full.movimientos.length, 2);
});

test('rechaza tipo inválido, monto <= 0 y concepto vacío', () => {
  svc.abrirCorte({ fondo_inicial: 0 }, ACTOR);
  assert.throws(() => svc.registrarMovimiento({ tipo: 'x', monto: 10, concepto: 'y' }, ACTOR), /no válido/i);
  assert.throws(() => svc.registrarMovimiento({ tipo: 'retiro', monto: 0, concepto: 'y' }, ACTOR), /mayor a 0/i);
  assert.throws(() => svc.registrarMovimiento({ tipo: 'retiro', monto: 10, concepto: '  ' }, ACTOR), /concepto/i);
});

// ================= ventas en el turno =================
test('las ventas en efectivo del turno cuentan para el efectivo esperado', () => {
  svc.abrirCorte({ fondo_inicial: 500 }, ACTOR);
  vender({ precio: 40, cantidad: 3, metodo: 'efectivo' }); // 120
  const c = svc.getCorte();
  near(c.ventas_efectivo, 120, 'ventas efectivo');
  near(c.efectivo_esperado_calc, 500 + 120, 'fondo + ventas efectivo');
});

test('las ventas por transferencia NO suman al efectivo esperado', () => {
  svc.abrirCorte({ fondo_inicial: 500 }, ACTOR);
  vender({ precio: 55, cantidad: 1, metodo: 'transferencia' });
  const c = svc.getCorte();
  near(c.ventas_efectivo, 0, 'nada en efectivo');
  near(c.ventas_transferencia, 55, 'sí en transferencia');
  near(c.efectivo_esperado_calc, 500, 'el esperado no cambió');
});

test('si una venta pagada en efectivo se cancela, deja de contar', () => {
  svc.abrirCorte({ fondo_inicial: 100 }, ACTOR);
  const v = vender({ precio: 40, cantidad: 1, metodo: 'efectivo' });
  near(svc.getCorte().ventas_efectivo, 40, 'contaba');
  ventaSvc.cancelarVenta(v.id, 'devolución', ACTOR);
  near(svc.getCorte().ventas_efectivo, 0, 'ya no cuenta');
  near(svc.getCorte().efectivo_esperado_calc, 100, 'esperado = solo el fondo');
});

// ================= cerrar turno (arqueo) =================
test('cerrar el turno calcula la diferencia (sobra / falta / cuadra)', () => {
  svc.abrirCorte({ fondo_inicial: 100 }, ACTOR);
  vender({ precio: 40, cantidad: 1, metodo: 'efectivo' }); // esperado 140
  const c = svc.cerrarCorte({ efectivo_contado: 135, notas: 'faltó cambio' }, ACTOR);
  assert.equal(c.estado, 'cerrado');
  assert.equal(c.efectivo_esperado, 140);
  assert.equal(c.efectivo_contado, 135);
  near(c.diferencia, -5, 'faltaron 5');
});

test('cerrar el turno requiere uno abierto y un conteo válido', () => {
  assert.throws(() => svc.cerrarCorte({ efectivo_contado: 100 }, ACTOR), /no hay un turno/i);
  svc.abrirCorte({ fondo_inicial: 0 }, ACTOR);
  assert.throws(() => svc.cerrarCorte({ efectivo_contado: -1 }, ACTOR), /cuánto efectivo/i);
});

test('tras cerrar el turno se puede abrir otro', () => {
  svc.abrirCorte({ fondo_inicial: 0 }, ACTOR);
  svc.cerrarCorte({ efectivo_contado: 0 }, ACTOR);
  assert.doesNotThrow(() => svc.abrirCorte({ fondo_inicial: 200 }, ACTOR));
});

test('listCortes trae el historial con esperado y contado', () => {
  svc.abrirCorte({ fondo_inicial: 50 }, ACTOR);
  vender({ precio: 30, cantidad: 1, metodo: 'efectivo' });
  svc.cerrarCorte({ efectivo_contado: 80 }, ACTOR);
  const lista = svc.listCortes();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].efectivo_esperado, 80);
  assert.equal(lista[0].efectivo_contado, 80);
  near(lista[0].ventas_efectivo, 30, 'ventas efectivo en la fila');
});
