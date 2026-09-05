'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTOR } = require('../helpers/setup');
const svc = require('../../src/main/services/productoCategoriaService');
const productoSvc = require('../../src/main/services/productoService');

// ---------------- crear ----------------
test('crea una categoría de producto activa, con orden incremental', () => {
  const a = svc.createCategoria({ nombre: '  Frappés  ' });
  const b = svc.createCategoria({ nombre: 'Cafés' });
  assert.equal(a.nombre, 'Frappés');
  assert.equal(a.is_active, 1);
  assert.ok(b.orden > a.orden);
});

test('rechaza nombre vacío', () => {
  assert.throws(() => svc.createCategoria({ nombre: '   ' }), /obligatorio/i);
});

test('rechaza nombre duplicado', () => {
  svc.createCategoria({ nombre: 'Postres' });
  assert.throws(() => svc.createCategoria({ nombre: 'Postres' }), /ya existe/i);
});

// ---------------- editar ----------------
test('renombra una categoría', () => {
  const c = svc.createCategoria({ nombre: 'Viejo' });
  assert.equal(svc.updateCategoria(c.id, { nombre: 'Nuevo' }).nombre, 'Nuevo');
});

test('update de categoría inexistente lanza error', () => {
  assert.throws(() => svc.updateCategoria(999, { nombre: 'x' }), /no existe/i);
});

test('update a un nombre ya usado lanza error', () => {
  svc.createCategoria({ nombre: 'A' });
  const b = svc.createCategoria({ nombre: 'B' });
  assert.throws(() => svc.updateCategoria(b.id, { nombre: 'A' }), /ya existe/i);
});

// ---------------- baja lógica ----------------
test('deactivate / activate cambian is_active', () => {
  const c = svc.createCategoria({ nombre: 'Otros' });
  assert.equal(svc.deactivateCategoria(c.id).is_active, 0);
  assert.equal(svc.activateCategoria(c.id).is_active, 1);
});

test('deactivate funciona aunque tenga productos', () => {
  const c = svc.createCategoria({ nombre: 'Frappés' });
  productoSvc.createProducto({ nombre: 'Frappé Oreo', categoria_id: c.id, precio: 80 }, ACTOR);
  assert.doesNotThrow(() => svc.deactivateCategoria(c.id));
});

test('listOptions solo trae categorías activas', () => {
  const a = svc.createCategoria({ nombre: 'Activa' });
  const b = svc.createCategoria({ nombre: 'Inactiva' });
  svc.deactivateCategoria(b.id);
  const ids = svc.listOptions().map((x) => x.id);
  assert.ok(ids.includes(a.id) && !ids.includes(b.id));
});

// ---------------- listado ----------------
test('pagina de 15 por defecto', () => {
  for (let i = 1; i <= 18; i++) svc.createCategoria({ nombre: `Cat ${String(i).padStart(2, '0')}` });
  const r = svc.listCategorias();
  assert.equal(r.total, 18);
  assert.equal(r.rows.length, 15);
  assert.equal(r.totalPages, 2);
});

test('filtra por nombre', () => {
  svc.createCategoria({ nombre: 'Sodas Italianas' });
  svc.createCategoria({ nombre: 'Tisanas' });
  const r = svc.listCategorias({ search: 'soda' });
  assert.equal(r.total, 1);
  assert.equal(r.rows[0].nombre, 'Sodas Italianas');
});

test('includeInactive=false oculta las dadas de baja', () => {
  svc.createCategoria({ nombre: 'Activa' });
  const b = svc.createCategoria({ nombre: 'Baja' });
  svc.deactivateCategoria(b.id);
  assert.equal(svc.listCategorias({ includeInactive: false }).total, 1);
});

test('el orden por defecto respeta el orden de captura (campo "orden")', () => {
  ['Matcha', 'Cafés', 'Otros'].forEach((n) => svc.createCategoria({ nombre: n }));
  const rows = svc.listCategorias({ sort: 'nombre', pageSize: 100 }).rows.map((c) => c.nombre);
  assert.deepEqual(rows, ['Matcha', 'Cafés', 'Otros']); // como se crearon, no alfabético
});

test('el orden "nombre_desc" es alfabético inverso', () => {
  ['Matcha', 'Cafés', 'Otros'].forEach((n) => svc.createCategoria({ nombre: n }));
  const rows = svc.listCategorias({ sort: 'nombre_desc', pageSize: 100 }).rows.map((c) => c.nombre);
  assert.deepEqual(rows, ['Otros', 'Matcha', 'Cafés']);
});

test('orden por cantidad de productos y conteo correcto', () => {
  const conUno = svc.createCategoria({ nombre: 'Con uno' });
  svc.createCategoria({ nombre: 'Con cero' });
  productoSvc.createProducto({ nombre: 'P', categoria_id: conUno.id, precio: 10 }, ACTOR);
  const desc = svc.listCategorias({ sort: 'productos_desc', pageSize: 100 }).rows;
  assert.equal(desc[0].nombre, 'Con uno');
  assert.equal(desc[0].producto_count, 1);
});
