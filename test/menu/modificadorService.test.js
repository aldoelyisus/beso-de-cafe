'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { crearInsumo } = require('../helpers/setup');
const svc = require('../../src/main/services/modificadorService');

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m || 'valor'}: ${a} ≈ ${b}`);

// ---------------- crear / editar ----------------
test('crea un modificador con precio extra', () => {
  const m = svc.createModificador({ nombre: '  Extra shot  ', precio_extra: 20 });
  assert.equal(m.nombre, 'Extra shot');
  assert.equal(m.precio_extra, 20);
  assert.equal(m.is_active, 1);
  assert.deepEqual(m.items, []);
});

test('precio extra por defecto es 0', () => {
  assert.equal(svc.createModificador({ nombre: 'X' }).precio_extra, 0);
});

test('rechaza nombre vacío y duplicado', () => {
  assert.throws(() => svc.createModificador({ nombre: '  ' }), /obligatorio/i);
  svc.createModificador({ nombre: 'Shot' });
  assert.throws(() => svc.createModificador({ nombre: 'Shot' }), /ya existe/i);
});

test('rechaza precio extra negativo (crear y editar)', () => {
  assert.throws(() => svc.createModificador({ nombre: 'X', precio_extra: -1 }), /negativo/i);
  const m = svc.createModificador({ nombre: 'Y' });
  assert.throws(() => svc.updateModificador(m.id, { precio_extra: -5 }), /negativo/i);
});

test('edita nombre y precio', () => {
  const m = svc.createModificador({ nombre: 'Viejo', precio_extra: 10 });
  const u = svc.updateModificador(m.id, { nombre: 'Nuevo', precio_extra: 15 });
  assert.equal(u.nombre, 'Nuevo');
  assert.equal(u.precio_extra, 15);
});

test('update de modificador inexistente lanza error', () => {
  assert.throws(() => svc.updateModificador(999, { nombre: 'x' }), /no existe/i);
});

// ---------------- receta (items) ----------------
test('setItems guarda la mini-receta y calcula el costo', () => {
  const cafe = crearInsumo({ nombre: 'Café', costo_compra: 300 }); // 0.30 / g
  const m = svc.createModificador({ nombre: 'Extra shot', precio_extra: 20 });
  const r = svc.setItems(m.id, [{ insumo_id: cafe.id, cantidad_base: 9 }]);
  assert.equal(r.items.length, 1);
  near(r.costo, 2.7, 'costo = 9 g × 0.30');
});

test('setItems reemplaza (no acumula)', () => {
  const a = crearInsumo({ nombre: 'A' });
  const b = crearInsumo({ nombre: 'B' });
  const m = svc.createModificador({ nombre: 'X' });
  svc.setItems(m.id, [{ insumo_id: a.id, cantidad_base: 5 }]);
  const r = svc.setItems(m.id, [{ insumo_id: b.id, cantidad_base: 3 }]);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].insumo_id, b.id);
});

test('setItems rechaza cantidad <= 0 y un insumo inexistente', () => {
  const a = crearInsumo({ nombre: 'A' });
  const m = svc.createModificador({ nombre: 'X' });
  assert.throws(() => svc.setItems(m.id, [{ insumo_id: a.id, cantidad_base: 0 }]), /mayores a 0/i);
  assert.throws(() => svc.setItems(m.id, [{ insumo_id: 9999, cantidad_base: 1 }]), /no existe/i);
});

test('costoModificador refleja el precio del insumo', () => {
  const ins = crearInsumo({ nombre: 'Ins', costo_compra: 100 }); // 0.1 / g
  const m = svc.createModificador({ nombre: 'X' });
  svc.setItems(m.id, [{ insumo_id: ins.id, cantidad_base: 50 }]);
  near(svc.costoModificador(m.id), 5, '50 × 0.1');
});

// ---------------- baja lógica y opciones ----------------
test('deactivate / activate cambian is_active', () => {
  const m = svc.createModificador({ nombre: 'X' });
  assert.equal(svc.deactivateModificador(m.id).is_active, 0);
  assert.equal(svc.activateModificador(m.id).is_active, 1);
});

test('listModificadores incluye conteos y costo', () => {
  const ins = crearInsumo({ nombre: 'Café', costo_compra: 300 });
  const m = svc.createModificador({ nombre: 'Extra shot', precio_extra: 20 });
  svc.setItems(m.id, [{ insumo_id: ins.id, cantidad_base: 10 }]);
  const fila = svc.listModificadores().find((x) => x.id === m.id);
  assert.equal(fila.item_count, 1);
  assert.equal(fila.producto_count, 0);
  near(fila.costo, 3, '10 × 0.30');
});

test('listOptions solo trae los activos', () => {
  const a = svc.createModificador({ nombre: 'A' });
  const b = svc.createModificador({ nombre: 'B' });
  svc.deactivateModificador(b.id);
  const ids = svc.listOptions().map((x) => x.id);
  assert.ok(ids.includes(a.id) && !ids.includes(b.id));
});

test('includeInactive=false oculta los dados de baja', () => {
  svc.createModificador({ nombre: 'Activo' });
  const b = svc.createModificador({ nombre: 'Baja' });
  svc.deactivateModificador(b.id);
  assert.equal(svc.listModificadores({ includeInactive: false }).length, 1);
  assert.equal(svc.listModificadores({ includeInactive: true }).length, 2);
});
