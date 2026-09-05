'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTOR, crearProducto, abrirCaja } = require('../helpers/setup');
const svc = require('../../src/main/services/mesaService');
const ventaSvc = require('../../src/main/services/ventaService');

test('crea una mesa con orden incremental', () => {
  const a = svc.createMesa({ nombre: '  Mesa 1  ' });
  const b = svc.createMesa({ nombre: 'Terraza' });
  assert.equal(a.nombre, 'Mesa 1');
  assert.equal(a.is_active, 1);
  assert.ok(b.orden > a.orden);
});

test('rechaza nombre vacío y duplicado', () => {
  assert.throws(() => svc.createMesa({ nombre: '  ' }), /obligatorio/i);
  svc.createMesa({ nombre: 'Barra' });
  assert.throws(() => svc.createMesa({ nombre: 'Barra' }), /ya existe/i);
});

test('agregarVarias crea "Mesa N+1"… sin chocar con las existentes', () => {
  svc.createMesa({ nombre: 'Mesa 1' });
  const r = svc.agregarVarias(3);
  assert.equal(r.creadas, 3);
  const nombres = svc.listMesas().map((m) => m.nombre);
  assert.deepEqual(nombres.sort(), ['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4']);
});

test('renombra una mesa', () => {
  const m = svc.createMesa({ nombre: 'Vieja' });
  assert.equal(svc.updateMesa(m.id, { nombre: 'Nueva' }).nombre, 'Nueva');
});

test('deactivate / activate cambian is_active', () => {
  const m = svc.createMesa({ nombre: 'Mesa 1' });
  assert.equal(svc.deactivateMesa(m.id).is_active, 0);
  assert.equal(svc.activateMesa(m.id).is_active, 1);
});

test('no se puede dar de baja una mesa con cuenta abierta', () => {
  const m = svc.createMesa({ nombre: 'Mesa 1' });
  ventaSvc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  assert.throws(() => svc.deactivateMesa(m.id), /cuenta abierta/i);
});

test('listMesas marca las ocupadas', () => {
  const libre = svc.createMesa({ nombre: 'Libre' });
  const ocupada = svc.createMesa({ nombre: 'Ocupada' });
  ventaSvc.abrirVenta({ tipo: 'mesa', mesaId: ocupada.id }, ACTOR);
  const filas = svc.listMesas();
  assert.equal(filas.find((m) => m.id === libre.id).cuentas_abiertas, 0);
  assert.equal(filas.find((m) => m.id === ocupada.id).cuentas_abiertas, 1);
});

test('tras cobrar la cuenta, la mesa vuelve a poder darse de baja', () => {
  abrirCaja();
  const p = crearProducto({ nombre: 'Café', precio: 40 });
  const m = svc.createMesa({ nombre: 'Mesa 1' });
  let v = ventaSvc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  v = ventaSvc.agregarItem(v.id, { presentacionId: p.presentaciones[0].id, cantidad: 1 }, ACTOR);
  ventaSvc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);
  assert.doesNotThrow(() => svc.deactivateMesa(m.id));
});
