'use strict';

/**
 * Permisos del módulo Respaldos sobre la capa IPC real. Ya solo existe un
 * canal (`respaldos:crear`): "ver la pantalla" (`respaldos.view`) no tiene
 * canal propio — es puramente la ruta/menú, igual que en cualquier otro
 * módulo — así que aquí solo se prueba el canal que sí hace algo.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { getDb } = require('../helpers/setup');
const { call, callOk, entrar, session, setCarpetaElegida, setDialogoCancelado } = require('../helpers/ipc');
const { seed } = require('../../src/main/db/seed');
const { hashPassword } = require('../../src/main/security/password');

let contador = 0;

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

function carpetaTemporal() {
  const dir = path.join(os.tmpdir(), `beso-respaldo-perm-${process.pid}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test('sin respaldos.crear, el canal se niega y no se guarda nada', async () => {
  await prepararSistema();
  await comoUsuarioCon(['ventas.view']);
  setCarpetaElegida(carpetaTemporal());
  const r = await call('respaldos:crear', {});
  assert.equal(r.ok, false);
  assert.match(r.error, /permiso/i);
});

test('sin sesión, el canal no responde', async () => {
  session.clear();
  const r = await call('respaldos:crear', {});
  assert.equal(r.ok, false);
  assert.match(r.error, /sesión/i);
});

test('con respaldos.crear: si cancela el explorador, no truena y no guarda nada', async () => {
  await prepararSistema();
  await comoUsuarioCon(['respaldos.crear']);
  setDialogoCancelado();
  const r = await callOk('respaldos:crear', {});
  assert.equal(r.cancelado, true);
});

test('con respaldos.crear: si elige una carpeta, se guarda ahí y queda en la bitácora', async () => {
  await prepararSistema();
  const carpeta = carpetaTemporal();
  await comoUsuarioCon(['respaldos.crear']);
  setCarpetaElegida(carpeta);
  const r = await callOk('respaldos:crear', {});
  assert.equal(r.cancelado, false);
  assert.ok(fs.existsSync(r.ruta), 'el archivo quedó en la carpeta elegida');
  assert.equal(path.dirname(r.ruta), carpeta);

  await entrar('tester', 'admin123'); // el admin interno sí ve la bitácora
  const logs = await callOk('logs:list', { action: 'respaldos.crear' });
  assert.ok((logs.rows || logs).some((l) => l.detail.includes(r.ruta)), 'queda en la bitácora con la ruta');
});
