'use strict';

/**
 * MATRIZ DE PERMISOS del módulo Respaldos, sobre la capa IPC real.
 * Mismo patrón que inventarioPermisos.test.js: sin permiso se niega y nada
 * cambia, con el permiso (y nada más) sí funciona, y un permiso no abre la
 * puerta del de al lado — "crear" no deja restaurar, "view" no deja crear.
 */
const fs = require('fs');
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { getDb } = require('../helpers/setup');
const { call, callOk, entrar, session } = require('../helpers/ipc');
const { seed } = require('../../src/main/db/seed');
const { hashPassword } = require('../../src/main/security/password');
const backupService = require('../../src/main/backup/backupService');

let contador = 0;

beforeEach(() => {
  try { fs.rmSync(backupService.backupsDir(), { recursive: true, force: true }); } catch { /* no existía */ }
});

async function prepararSistema() {
  seed();
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = 1').run(hashPassword('admin123'));
  await entrar('tester', 'admin123');
}

async function comoUsuarioCon(permisos) {
  await entrar('tester', 'admin123');
  const n = ++contador;
  const rol = await callOk('roles:create', { name: `Rol ${n}`, permissions: permisos });
  await callOk('users:create', { name: `U${n}`, username: `u${n}`, password: 'clave1234', roleId: rol.id });
  return entrar(`u${n}`, 'clave1234');
}

function numRespaldos() {
  return backupService.listRespaldos().length;
}

function canales(archivoRestaurar) {
  return [
    { canal: 'respaldos:list', permiso: 'respaldos.view', payload: {} },
    { canal: 'respaldos:info', permiso: 'respaldos.view', payload: {} },
    { canal: 'respaldos:crear', permiso: 'respaldos.crear', payload: () => ({}) },
    { canal: 'respaldos:restaurar', permiso: 'respaldos.restaurar', payload: { archivo: archivoRestaurar } },
  ];
}
const cuerpo = (p) => (typeof p === 'function' ? p() : p);

// ═══════════ A) sin el permiso ═══════════
test('quien solo vende no puede tocar NINGÚN canal de respaldos', async () => {
  await prepararSistema();
  const r0 = await backupService.crearRespaldo({ tipo: 'manual' });
  await comoUsuarioCon(['ventas.view', 'ventas.crear']);

  for (const { canal, payload } of canales(r0.archivo)) {
    const antes = numRespaldos();
    const r = await call(canal, cuerpo(payload));
    assert.equal(r.ok, false, `${canal} se ejecutó sin permiso`);
    assert.match(r.error, /permiso/i, canal);
    assert.equal(numRespaldos(), antes, `${canal} negó pero algo cambió en la base de respaldos`);
  }
});

test('sin sesión ningún canal de respaldos responde', async () => {
  await prepararSistema();
  const r0 = await backupService.crearRespaldo({ tipo: 'manual' });
  session.clear();
  for (const { canal, payload } of canales(r0.archivo)) {
    const r = await call(canal, cuerpo(payload));
    assert.equal(r.ok, false, canal);
    assert.match(r.error, /sesión/i, canal);
  }
});

// ═══════════ B) con el permiso ═══════════
test('cada permiso habilita exactamente su canal', async () => {
  await prepararSistema();
  for (const { canal, permiso } of canales(null)) {
    // Cada intento parte de un respaldo fresco (para "restaurar", que necesita uno que exista).
    const r0 = await backupService.crearRespaldo({ tipo: 'manual' });
    await comoUsuarioCon(['respaldos.view', permiso]);
    const payload = canal === 'respaldos:restaurar' ? { archivo: r0.archivo } : cuerpo(canales(r0.archivo).find((c) => c.canal === canal).payload);
    const r = await call(canal, payload);
    assert.ok(r.ok, `${canal} se niega aunque el usuario tiene "${permiso}": ${r.error}`);
  }
});

// ═══════════ C) sin puertas laterales ═══════════
test('"crear" no deja restaurar, y "view" no deja crear ni restaurar', async () => {
  await prepararSistema();
  const r0 = await backupService.crearRespaldo({ tipo: 'manual' });

  await comoUsuarioCon(['respaldos.view', 'respaldos.crear']);
  const noRestaura = await call('respaldos:restaurar', { archivo: r0.archivo });
  assert.equal(noRestaura.ok, false, '"respaldos.crear" no debería dejar restaurar');
  assert.match(noRestaura.error, /permiso/i);

  await comoUsuarioCon(['respaldos.view']);
  const noCrea = await call('respaldos:crear', {});
  assert.equal(noCrea.ok, false, '"respaldos.view" no debería dejar crear');
  const noRestaura2 = await call('respaldos:restaurar', { archivo: r0.archivo });
  assert.equal(noRestaura2.ok, false, '"respaldos.view" no debería dejar restaurar');
});

// ═══════════ D) funcional, a través del IPC ═══════════
test('respaldos:crear por IPC deja un archivo real y queda en la bitácora', async () => {
  await prepararSistema();
  await comoUsuarioCon(['respaldos.view', 'respaldos.crear']);
  const antes = numRespaldos();
  const r = await callOk('respaldos:crear', {});
  assert.match(r.archivo, /^manual_/);
  assert.equal(numRespaldos(), antes + 1);

  await entrar('tester', 'admin123'); // el creador del respaldo no puede ver logs; el admin sí
  const logs = await callOk('logs:list', { action: 'respaldos.crear' });
  assert.ok((logs.rows || logs).some((l) => l.detail.includes(r.archivo)), 'quedó en la bitácora con el nombre del archivo');
});

test('respaldos:restaurar por IPC de verdad regresa los datos y no truena por no tener ventana de Electron', async () => {
  await prepararSistema();
  const cat = getDb().prepare("SELECT * FROM insumo_categorias WHERE nombre = 'Café'").get();
  const r0 = await backupService.crearRespaldo({ tipo: 'manual' }); // sin "Nueva categoría" todavía
  await callOk('insumoCategorias:create', { nombre: 'Nueva categoría', unidad_sugerida: 'g' });

  await comoUsuarioCon(['respaldos.view', 'respaldos.restaurar']);
  const res = await callOk('respaldos:restaurar', { archivo: r0.archivo });
  assert.equal(res.reiniciando, true);

  const nombres = getDb().prepare('SELECT nombre FROM insumo_categorias').all().map((x) => x.nombre);
  assert.ok(!nombres.includes('Nueva categoría'), 'la categoría creada después del respaldo ya no está');
  assert.ok(nombres.includes(cat.nombre), 'la que ya existía al respaldar sigue ahí');
});
