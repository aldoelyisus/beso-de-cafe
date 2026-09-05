'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

require('../helpers/setup');
const svc = require('../../src/main/services/categoriaService');

// ---------------- createCategoria ----------------
test('crea una categoría con su unidad sugerida y activa', () => {
  const c = svc.createCategoria({ nombre: '  Lácteos  ', unidad_sugerida: 'ml' });
  assert.equal(c.nombre, 'Lácteos'); // se recorta
  assert.equal(c.unidad_sugerida, 'ml');
  assert.equal(c.is_active, 1);
});

test('unidad sugerida por defecto es "pieza"', () => {
  const c = svc.createCategoria({ nombre: 'Desechables' });
  assert.equal(c.unidad_sugerida, 'pieza');
});

test('rechaza nombre vacío', () => {
  assert.throws(() => svc.createCategoria({ nombre: '   ' }), /obligatorio/i);
});

test('rechaza nombre duplicado', () => {
  svc.createCategoria({ nombre: 'Café' });
  assert.throws(() => svc.createCategoria({ nombre: 'Café' }), /ya existe/i);
});

test('rechaza una unidad sugerida que no existe', () => {
  assert.throws(() => svc.createCategoria({ nombre: 'X', unidad_sugerida: 'kg' }), /no válida/i);
});

// ---------------- updateCategoria ----------------
test('renombra una categoría', () => {
  const c = svc.createCategoria({ nombre: 'Viejo' });
  const u = svc.updateCategoria(c.id, { nombre: 'Nuevo' });
  assert.equal(u.nombre, 'Nuevo');
});

test('cambia la unidad sugerida', () => {
  const c = svc.createCategoria({ nombre: 'Café', unidad_sugerida: 'g' });
  assert.equal(svc.updateCategoria(c.id, { unidad_sugerida: 'ml' }).unidad_sugerida, 'ml');
});

test('update rechaza unidad no válida', () => {
  const c = svc.createCategoria({ nombre: 'Café' });
  assert.throws(() => svc.updateCategoria(c.id, { unidad_sugerida: 'litros' }), /no válida/i);
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
test('deactivate marca is_active = 0 y activate lo revierte', () => {
  const c = svc.createCategoria({ nombre: 'Temp' });
  assert.equal(svc.deactivateCategoria(c.id).is_active, 0);
  assert.equal(svc.activateCategoria(c.id).is_active, 1);
});

test('deactivate funciona aunque la categoría tenga insumos', () => {
  const c = svc.createCategoria({ nombre: 'Café', unidad_sugerida: 'g' });
  require('../../src/main/services/insumoService').createInsumo({ nombre: 'Grano', unidad_base: 'g', categoria_id: c.id, factor_compra: 1, costo_compra: 1 });
  assert.doesNotThrow(() => svc.deactivateCategoria(c.id));
});

test('deactivate de categoría inexistente lanza error', () => {
  assert.throws(() => svc.deactivateCategoria(999), /no existe/i);
});

test('ya no existe borrado físico (deleteCategoria)', () => {
  assert.equal(typeof svc.deleteCategoria, 'undefined');
});

// ---------------- listCategoriaOptions ----------------
test('las opciones solo traen categorías activas', () => {
  const a = svc.createCategoria({ nombre: 'Activa' });
  const b = svc.createCategoria({ nombre: 'Inactiva' });
  svc.deactivateCategoria(b.id);
  const ids = svc.listCategoriaOptions().map((x) => x.id);
  assert.ok(ids.includes(a.id));
  assert.ok(!ids.includes(b.id));
});

// ---------------- listCategorias: paginación ----------------
test('pagina de 15 por defecto y reporta total/totalPages', () => {
  for (let i = 1; i <= 20; i++) svc.createCategoria({ nombre: `Cat ${String(i).padStart(2, '0')}` });
  const r = svc.listCategorias();
  assert.equal(r.pageSize, 15);
  assert.equal(r.page, 1);
  assert.equal(r.total, 20);
  assert.equal(r.totalPages, 2);
  assert.equal(r.rows.length, 15);
});

test('una página fuera de rango cae en la última', () => {
  for (let i = 0; i < 5; i++) svc.createCategoria({ nombre: `C${i}` });
  const r = svc.listCategorias({ page: 99, pageSize: 2 });
  assert.equal(r.page, 3);
  assert.equal(r.rows.length, 1);
});

// ---------------- listCategorias: filtros ----------------
test('filtra por nombre (LIKE, sin distinguir mayúsculas)', () => {
  svc.createCategoria({ nombre: 'Lácteos' });
  svc.createCategoria({ nombre: 'Bebidas vegetales' });
  const r = svc.listCategorias({ search: 'lác' });
  assert.equal(r.total, 1);
  assert.equal(r.rows[0].nombre, 'Lácteos');
});

test('filtra por unidad sugerida', () => {
  svc.createCategoria({ nombre: 'Café', unidad_sugerida: 'g' });
  svc.createCategoria({ nombre: 'Leche', unidad_sugerida: 'ml' });
  svc.createCategoria({ nombre: 'Vasos', unidad_sugerida: 'pieza' });
  const r = svc.listCategorias({ unidad: 'ml' });
  assert.equal(r.total, 1);
  assert.equal(r.rows[0].nombre, 'Leche');
});

test('includeInactive=false oculta las dadas de baja', () => {
  svc.createCategoria({ nombre: 'Activa' });
  const b = svc.createCategoria({ nombre: 'Baja' });
  svc.deactivateCategoria(b.id);
  assert.equal(svc.listCategorias({ includeInactive: false }).total, 1);
  assert.equal(svc.listCategorias({ includeInactive: true }).total, 2);
});

// ---------------- listCategorias: orden ----------------
test('orden por nombre A–Z y Z–A son inversos', () => {
  ['Charolas', 'Azúcar', 'Miel'].forEach((n) => svc.createCategoria({ nombre: n }));
  const asc = svc.listCategorias({ sort: 'nombre', pageSize: 100 }).rows.map((c) => c.nombre);
  const desc = svc.listCategorias({ sort: 'nombre_desc', pageSize: 100 }).rows.map((c) => c.nombre);
  assert.deepEqual(asc, [...desc].reverse());
});

test('orden por cantidad de insumos (mayor y menor primero)', () => {
  const insumoSvc = require('../../src/main/services/insumoService');
  const conUno = svc.createCategoria({ nombre: 'Con uno' });
  const conCero = svc.createCategoria({ nombre: 'Con cero' });
  insumoSvc.createInsumo({ nombre: 'X', unidad_base: 'g', categoria_id: conUno.id, factor_compra: 1, costo_compra: 1 });

  const desc = svc.listCategorias({ sort: 'insumos_desc', pageSize: 100 }).rows;
  assert.equal(desc[0].nombre, 'Con uno');
  const asc = svc.listCategorias({ sort: 'insumos_asc', pageSize: 100 }).rows;
  assert.equal(asc[asc.length - 1].nombre, 'Con uno');
});

test('el conteo de insumos por categoría es correcto', () => {
  const insumoSvc = require('../../src/main/services/insumoService');
  const c = svc.createCategoria({ nombre: 'Café' });
  insumoSvc.createInsumo({ nombre: 'Grano', unidad_base: 'g', categoria_id: c.id, factor_compra: 1, costo_compra: 1 });
  insumoSvc.createInsumo({ nombre: 'Soluble', unidad_base: 'g', categoria_id: c.id, factor_compra: 1, costo_compra: 1 });
  const fila = svc.listCategorias().rows.find((x) => x.id === c.id);
  assert.equal(fila.insumo_count, 2);
});
