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

test('no se pueden abrir dos cajas a la vez', () => {
  svc.abrirCorte({ fondo_inicial: 0 }, ACTOR);
  assert.throws(() => svc.abrirCorte({ fondo_inicial: 0 }, ACTOR), /ya está abierta/i);
});

test('rechaza un fondo inicial negativo', () => {
  assert.throws(() => svc.abrirCorte({ fondo_inicial: -1 }, ACTOR), /negativo/i);
});

// ================= movimientos =================
test('registrar un movimiento requiere la caja abierta', () => {
  assert.throws(() => svc.registrarMovimiento({ tipo: 'retiro', monto: 10, concepto: 'x' }, ACTOR), /caja está cerrada/i);
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

test('cerrar la caja requiere una abierta y un conteo válido', () => {
  assert.throws(() => svc.cerrarCorte({ efectivo_contado: 100, notas: 'cierre de prueba' }, ACTOR), /caja está cerrada/i);
  svc.abrirCorte({ fondo_inicial: 0 }, ACTOR);
  assert.throws(() => svc.cerrarCorte({ efectivo_contado: -1, notas: 'cierre de prueba' }, ACTOR), /no puede ser negativo/i);
  assert.throws(() => svc.cerrarCorte({ efectivo_contado: 'abc', notas: 'cierre de prueba' }, ACTOR), /debe ser un número/i);
});

// `Number('')` es 0 en JavaScript: dejar el campo vacío cerraba la caja con
// "conté $0" y dejaba un faltante falso a nombre del cajero, sin poder
// reabrirla. Vacío y cero tienen que ser cosas distintas.
test('cerrar la caja con el conteo VACÍO se rechaza; con 0 capturado a propósito sí cierra', () => {
  svc.abrirCorte({ fondo_inicial: 1000 }, ACTOR);
  for (const vacio of ['', '   ', null, undefined]) {
    assert.throws(() => svc.cerrarCorte({ efectivo_contado: vacio, notas: 'cierre de prueba' }, ACTOR), /falta capturar/i,
      `con ${JSON.stringify(vacio)} no debería cerrar`);
  }
  const c = svc.cerrarCorte({ efectivo_contado: 0, notas: 'cierre de prueba' }, ACTOR);
  assert.equal(c.efectivo_contado, 0);
  near(c.diferencia, -1000, 'contar 0 de verdad sí es un faltante de 1000');
});

test('el fondo inicial con texto no se guarda como 0 en silencio', () => {
  assert.throws(() => svc.abrirCorte({ fondo_inicial: 'quinientos' }, ACTOR), /debe ser un número/i);
  // vacío sí vale: el cajón empieza sin efectivo
  const c = svc.abrirCorte({ fondo_inicial: '' }, ACTOR);
  assert.equal(c.fondo_inicial, 0);
});

test('tras cerrar el turno se puede abrir otro', () => {
  svc.abrirCorte({ fondo_inicial: 0 }, ACTOR);
  svc.cerrarCorte({ efectivo_contado: 0, notas: 'cierre de prueba' }, ACTOR);
  assert.doesNotThrow(() => svc.abrirCorte({ fondo_inicial: 200 }, ACTOR));
});

test('listCortes trae el historial con esperado y contado', () => {
  svc.abrirCorte({ fondo_inicial: 50 }, ACTOR);
  vender({ precio: 30, cantidad: 1, metodo: 'efectivo' });
  svc.cerrarCorte({ efectivo_contado: 80, notas: 'cierre de prueba' }, ACTOR);
  const lista = svc.listCortes();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].efectivo_esperado, 80);
  assert.equal(lista[0].efectivo_contado, 80);
  near(lista[0].ventas_efectivo, 30, 'ventas efectivo en la fila');
});

// El comentario del cierre es obligatorio: es lo que explica el día cuando
// alguien revise ese corte después.
test('no se cierra la caja sin comentario', () => {
  svc.abrirCorte({ fondo_inicial: 100 }, ACTOR);
  for (const vacio of ['', '   ', null, undefined]) {
    assert.throws(() => svc.cerrarCorte({ efectivo_contado: 100, notas: vacio }, ACTOR), /comentario del cierre/i,
      `con notas=${JSON.stringify(vacio)} no debería cerrar`);
  }
  const c = svc.cerrarCorte({ efectivo_contado: 100, notas: 'todo normal' }, ACTOR);
  assert.equal(c.notas, 'todo normal');
});

test('el corte guarda las salidas con su concepto, para poder explicarlas después', () => {
  svc.abrirCorte({ fondo_inicial: 1000 }, ACTOR);
  svc.registrarMovimiento({ tipo: 'retiro', monto: 300, concepto: 'pago al proveedor de café' }, ACTOR);
  svc.registrarMovimiento({ tipo: 'retiro', monto: 200, concepto: 'servilletas' }, ACTOR);
  svc.registrarMovimiento({ tipo: 'ingreso', monto: 100, concepto: 'cambio que trajo la dueña' }, ACTOR);

  const c = svc.getCorte();
  near(c.retiros, 500, 'salieron 500');
  near(c.ingresos_manuales, 100, 'entraron 100');
  near(c.efectivo_esperado_calc, 600, '1000 + 100 − 500');

  const salidas = c.movimientos.filter((m) => m.tipo === 'retiro');
  assert.equal(salidas.length, 2);
  assert.deepEqual(salidas.map((m) => m.concepto).sort(), ['pago al proveedor de café', 'servilletas']);

  const cerrado = svc.cerrarCorte({ efectivo_contado: 600, notas: 'cuadró' }, ACTOR);
  assert.equal(cerrado.movimientos.length, 3, 'los movimientos se conservan en el corte cerrado');
});
