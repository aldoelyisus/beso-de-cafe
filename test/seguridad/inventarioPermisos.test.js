'use strict';

/**
 * MATRIZ DE PERMISOS del módulo Inventario, sobre la capa IPC real.
 *
 * Por cada canal se comprueban las dos caras:
 *   A) sin el permiso → "No tienes permiso" Y nada cambia en la base;
 *   B) con ese permiso (y nada más) → sí funciona.
 * Y que un permiso no abra la puerta del de al lado.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { getDb } = require('../helpers/setup');
const { call, callOk, entrar, session } = require('../helpers/ipc');
const { seed } = require('../../src/main/db/seed');
const { hashPassword } = require('../../src/main/security/password');

let contador = 0;

/** Sistema listo, sesión del administrador interno y un insumo de trabajo. */
async function prepararSistema() {
  seed();
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = 1').run(hashPassword('admin123'));
  await entrar('tester', 'admin123');
  const cat = getDb().prepare("SELECT * FROM insumo_categorias WHERE nombre = 'Café'").get();
  const insumo = await callOk('insumos:create', {
    nombre: 'Café en grano', unidad_base: 'g', categoria_id: cat.id,
    unidad_compra: 'Kilo', factor_compra: 1000, costo_compra: 300, stock_inicial_compra: 5, stock_minimo: 500,
  });
  return { cat, insumo };
}

/** Crea un usuario con EXACTAMENTE estos permisos y entra con él. */
async function comoUsuarioCon(permisos) {
  await entrar('tester', 'admin123');
  const n = ++contador;
  const rol = await callOk('roles:create', { name: `Rol ${n}`, permissions: permisos });
  await callOk('users:create', { name: `U${n}`, username: `u${n}`, password: 'clave1234', roleId: rol.id });
  return entrar(`u${n}`, 'clave1234');
}

/** Foto del inventario, para probar que un intento denegado no cambió nada. */
function fotoInventario() {
  const db = getDb();
  return JSON.stringify({
    insumos: db.prepare('SELECT id, nombre, stock, costo_unitario, is_active FROM insumos ORDER BY id').all(),
    cats: db.prepare('SELECT id, nombre, is_active FROM insumo_categorias ORDER BY id').all(),
    movs: db.prepare('SELECT COUNT(*) n FROM inventory_movements').get().n,
  });
}

/** Canal → permiso que lo protege, con un payload que sí funcionaría. */
function canales({ insumo, cat }) {
  return [
    { canal: 'insumos:list', permiso: 'insumos.view', payload: {} },
    { canal: 'insumos:get', permiso: 'insumos.view', payload: { id: insumo.id } },
    { canal: 'insumos:movimientos', permiso: 'insumos.view', payload: { id: insumo.id, limit: 5 } },
    { canal: 'insumos:create', permiso: 'insumos.create', payload: () => ({ nombre: `Nuevo ${++contador}`, unidad_base: 'g', factor_compra: 1, costo_compra: 1 }) },
    { canal: 'insumos:update', permiso: 'insumos.edit', payload: { id: insumo.id, notas: 'tocado' } },
    { canal: 'insumos:deactivate', permiso: 'insumos.delete', payload: { id: insumo.id } },
    { canal: 'insumos:activate', permiso: 'insumos.delete', payload: { id: insumo.id } },
    { canal: 'insumos:movimiento', permiso: 'insumos.stock', payload: { insumoId: insumo.id, tipo: 'entrada', cantidad: 1, costo_compra: 300 } },
    { canal: 'insumos:corregirCosto', permiso: 'insumos.costo', payload: { id: insumo.id, costo_compra: 310, nota: 'prueba' } },
    { canal: 'insumoCategorias:list', permiso: 'insumo_categorias.view', payload: {} },
    { canal: 'insumoCategorias:options', permiso: 'insumos.view', payload: {} },
    { canal: 'insumoCategorias:create', permiso: 'insumo_categorias.create', payload: () => ({ nombre: `Cat ${++contador}`, unidad_sugerida: 'g' }) },
    { canal: 'insumoCategorias:update', permiso: 'insumo_categorias.edit', payload: { id: cat.id, nombre: 'Café' } },
    { canal: 'insumoCategorias:deactivate', permiso: 'insumo_categorias.delete', payload: { id: cat.id } },
    { canal: 'insumoCategorias:activate', permiso: 'insumo_categorias.delete', payload: { id: cat.id } },
  ];
}
const cuerpo = (p) => (typeof p === 'function' ? p() : p);

// ═══════════ A) sin el permiso ═══════════
test('quien solo vende no puede tocar NINGÚN canal de inventario', async () => {
  const ctx = await prepararSistema();
  await comoUsuarioCon(['ventas.view', 'ventas.crear']);

  for (const { canal, payload } of canales(ctx)) {
    const antes = fotoInventario();
    const r = await call(canal, cuerpo(payload));
    assert.equal(r.ok, false, `${canal} se ejecutó sin permiso`);
    assert.match(r.error, /permiso/i, canal);
    assert.equal(fotoInventario(), antes, `${canal} negó pero algo cambió en la base`);
  }
});

test('quien solo consulta el inventario no puede escribir nada', async () => {
  const ctx = await prepararSistema();
  await comoUsuarioCon(['insumos.view', 'insumo_categorias.view']);

  const soloLectura = ['insumos.view', 'insumo_categorias.view'];
  for (const { canal, permiso, payload } of canales(ctx).filter((c) => !soloLectura.includes(c.permiso))) {
    const antes = fotoInventario();
    const r = await call(canal, cuerpo(payload));
    assert.equal(r.ok, false, `${canal} (${permiso}) se ejecutó con permisos de solo lectura`);
    assert.match(r.error, /permiso/i, canal);
    assert.equal(fotoInventario(), antes, `${canal} negó pero algo cambió`);
  }
});

test('sin sesión ningún canal de inventario responde', async () => {
  const ctx = await prepararSistema();
  session.clear();
  for (const { canal, payload } of canales(ctx)) {
    const r = await call(canal, cuerpo(payload));
    assert.equal(r.ok, false, canal);
    assert.match(r.error, /sesión/i, canal);
  }
  assert.match((await call('inventory:meta', {})).error, /sesión/i);
});

// ═══════════ B) con el permiso ═══════════
test('cada permiso habilita exactamente su canal', async () => {
  const ctx = await prepararSistema();
  for (const { canal, permiso, payload } of canales(ctx)) {
    await comoUsuarioCon(['insumos.view', permiso]);
    const r = await call(canal, cuerpo(payload));
    assert.ok(r.ok, `${canal} se niega aunque el usuario tiene "${permiso}": ${r.error}`);
  }
});

// ═══════════ C) sin puertas laterales ═══════════
test('un permiso de inventario no abre la puerta del de al lado', async () => {
  const { insumo, cat } = await prepararSistema();
  const vecinos = [
    { tiene: 'insumos.stock', intenta: 'insumos:corregirCosto', payload: { id: insumo.id, costo_compra: 9, nota: 'x' } },
    { tiene: 'insumos.costo', intenta: 'insumos:movimiento', payload: { insumoId: insumo.id, tipo: 'entrada', cantidad: 1 } },
    { tiene: 'insumos.edit', intenta: 'insumos:movimiento', payload: { insumoId: insumo.id, tipo: 'merma', cantidad: 1, motivo: 'derrame' } },
    { tiene: 'insumos.edit', intenta: 'insumos:deactivate', payload: { id: insumo.id } },
    { tiene: 'insumos.create', intenta: 'insumos:update', payload: { id: insumo.id, nombre: 'Cambiado' } },
    { tiene: 'insumo_categorias.edit', intenta: 'insumoCategorias:deactivate', payload: { id: cat.id } },
    { tiene: 'insumo_categorias.create', intenta: 'insumos:create', payload: { nombre: 'Colado', unidad_base: 'g' } },
    { tiene: 'insumos.view', intenta: 'insumoCategorias:list', payload: {} },
  ];
  for (const { tiene, intenta, payload } of vecinos) {
    await comoUsuarioCon(['insumos.view', tiene]);
    const r = await call(intenta, payload);
    assert.equal(r.ok, false, `"${tiene}" permite ${intenta}`);
    assert.match(r.error, /permiso/i, `${tiene} → ${intenta}`);
  }
});

test('corregir el costo no se puede colar por el canal de existencias', async () => {
  const { insumo } = await prepararSistema();
  await comoUsuarioCon(['insumos.view', 'insumos.stock']);
  const r = await call('insumos:movimiento', { insumoId: insumo.id, tipo: 'ajuste_costo', costo_compra: 99, nota: 'trampa' });
  assert.equal(r.ok, false);
  assert.match(r.error, /Corregir costo/i);
});

// ═══════════ D) el menú y los metadatos ═══════════
test('el grupo "Inventario" aparece si se ve alguno de sus submódulos', async () => {
  await prepararSistema();
  const soloVende = await comoUsuarioCon(['ventas.view', 'ventas.crear']);
  assert.equal(soloVende.menu.some((m) => m.key === 'inventory'), false, 'quien solo vende no lo ve');

  // Antes hacía falta además un "inventory.view" invisible: quien tenía los
  // permisos de adentro no veía el grupo y no había forma de adivinar por qué.
  const soloInsumos = await comoUsuarioCon(['insumos.view']);
  const inv = soloInsumos.menu.find((m) => m.key === 'inventory');
  assert.ok(inv, 'con "insumos.view" ya debe verse el grupo Inventario');
  assert.deepEqual(inv.submodules.map((s) => s.label), ['Insumos'],
    'sin insumo_categorias.view no debe ver el submódulo de Categorías');
  assert.equal(inv.route, '#/insumos', 'el grupo apunta a un destino que sí puede abrir');

  // Y al revés: solo categorías.
  const soloCats = await comoUsuarioCon(['insumo_categorias.view']);
  const inv2 = soloCats.menu.find((m) => m.key === 'inventory');
  assert.ok(inv2, 'con "insumo_categorias.view" también');
  assert.deepEqual(inv2.submodules.map((s) => s.label), ['Categorías de insumos']);
  assert.equal(inv2.route, '#/insumo-categorias', 'no apunta a Insumos, que no puede abrir');
});

test('un grupo apunta al primer destino que el usuario SÍ puede abrir', async () => {
  await prepararSistema();
  // Ventas agrupa POS, Caja, Historial y Mesas. Con solo "caja.view"...
  const soloCaja = await comoUsuarioCon(['caja.view']);
  const ventas = soloCaja.menu.find((m) => m.key === 'ventas');
  assert.ok(ventas, 'debe ver el grupo Ventas aunque no tenga ventas.view');
  assert.deepEqual(ventas.submodules.map((s) => s.label), ['Corte de caja y cierre de día']);
  assert.equal(ventas.route, '#/caja');
});

test('el conteo de "por acabarse" no llega a quien no ve el inventario', async () => {
  await prepararSistema();
  await comoUsuarioCon(['ventas.view', 'ventas.crear']);
  const meta = await callOk('inventory:meta', {});
  assert.ok(Array.isArray(meta.unidades), 'las unidades son catálogo, sí van');
  assert.equal(meta.bajoStock, null, 'el conteo de stock bajo se oculta');

  await comoUsuarioCon(['insumos.view']);
  assert.equal(typeof (await callOk('inventory:meta', {})).bajoStock, 'number');
});
