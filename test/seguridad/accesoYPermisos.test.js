'use strict';

/**
 * Acceso y permisos, probados sobre la capa IPC real (la misma que usa la
 * interfaz): validación de sesión, permisos y mensajes de error.
 *
 * Cubre los agujeros encontrados en la revisión de QA de Login / Usuarios / Roles.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { getDb } = require('../helpers/setup');
const { call, callOk, entrar, session } = require('../helpers/ipc');
const { seed } = require('../../src/main/db/seed');
const { hashPassword } = require('../../src/main/security/password');

/** Deja el sistema listo y entra como el administrador interno. */
async function comoAdmin() {
  seed(); // sincroniza el catálogo de permisos desde el código
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = 1').run(hashPassword('admin123'));
  await entrar('tester', 'admin123');
}

const todosLosPermisos = () => getDb().prepare('SELECT key FROM permissions').all().map((r) => r.key);

/** Crea un rol y un usuario con ese rol; devuelve el usuario. */
async function crearUsuarioConPermisos(nombreRol, permisos, datos) {
  const rol = await callOk('roles:create', { name: nombreRol, permissions: permisos });
  return callOk('users:create', { roleId: rol.id, ...datos });
}

// ═══════════════ login ═══════════════
test('el login no distingue mayúsculas en el nombre de usuario', async () => {
  await comoAdmin();
  await callOk('users:create', { name: 'Lupita', username: 'Lupita', password: 'lupe1234' });

  for (const tecleado of ['lupita', 'LUPITA', 'LuPiTa', '  lupita  ']) {
    session.clear();
    const r = await call('auth:login', { username: tecleado, password: 'lupe1234' });
    assert.ok(r.ok, `debería entrar tecleando "${tecleado}": ${r.error}`);
  }
});

test('el login pliega también los acentos, no solo el alfabeto inglés', async () => {
  await comoAdmin();
  await callOk('users:create', { name: 'José', username: 'José', password: 'jose1234' });
  // COLLATE NOCASE de SQLite no sabe que "É" y "é" son la misma letra.
  for (const tecleado of ['josé', 'JOSÉ', 'JOSE', 'jose']) {
    session.clear();
    const r = await call('auth:login', { username: tecleado, password: 'jose1234' });
    assert.ok(r.ok, `debería entrar tecleando "${tecleado}": ${r.error}`);
  }
});

test('tampoco se crean dos cuentas que solo difieran en acentos', async () => {
  await comoAdmin();
  await callOk('users:create', { name: 'José', username: 'jose', password: 'jose1234' });
  const r = await call('users:create', { name: 'Otro', username: 'JOSÉ', password: 'otro1234' });
  assert.equal(r.ok, false);
  assert.match(r.error, /ya está en uso/i);
});

test('la contraseña SÍ distingue mayúsculas y espacios', async () => {
  await comoAdmin();
  await callOk('users:create', { name: 'Lupita', username: 'lupita', password: 'lupe1234' });
  session.clear();
  assert.equal((await call('auth:login', { username: 'lupita', password: 'LUPE1234' })).ok, false);
  assert.equal((await call('auth:login', { username: 'lupita', password: ' lupe1234 ' })).ok, false);
});

test('no se pueden crear dos usuarios que solo difieran en mayúsculas', async () => {
  await comoAdmin();
  await callOk('users:create', { name: 'Lupita', username: 'lupita', password: 'lupe1234' });
  const r = await call('users:create', { name: 'Otra', username: 'LUPITA', password: 'otro1234' });
  assert.equal(r.ok, false);
  assert.match(r.error, /ya está en uso/i);
});

test('cambiar el nombre de usuario también choca sin distinguir mayúsculas', async () => {
  await comoAdmin();
  await callOk('users:create', { name: 'Lupita', username: 'lupita', password: 'lupe1234' });
  const otro = await callOk('users:create', { name: 'Beto', username: 'beto', password: 'beto1234' });
  const r = await call('users:changeUsername', { id: otro.id, username: 'LuPiTa' });
  assert.equal(r.ok, false);
  assert.match(r.error, /ya está en uso/i);
});

test('el mensaje de login no revela si el usuario existe', async () => {
  await comoAdmin();
  session.clear();
  const noExiste = await call('auth:login', { username: 'fantasma', password: 'x' });
  const malaClave = await call('auth:login', { username: 'tester', password: 'x' });
  assert.equal(noExiste.error, malaClave.error);
});

// ═══════════════ sesión ═══════════════
test('sin sesión, los canales protegidos se rechazan', async () => {
  session.clear();
  for (const canal of ['users:list', 'roles:list', 'logs:list', 'insumos:list']) {
    const r = await call(canal, {});
    assert.equal(r.ok, false, canal);
    assert.match(r.error, /sesión/i, canal);
  }
});

test('desactivar a alguien corta su sesión abierta al instante', async () => {
  await comoAdmin();
  const u = await crearUsuarioConPermisos('Cajero', ['ventas.view'],
    { name: 'Beto', username: 'beto', password: 'beto1234' });

  await entrar('beto', 'beto1234');
  assert.ok((await call('ventas:abiertas', {})).ok, 'trabajando con normalidad');

  getDb().prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(u.id);

  const r = await call('ventas:abiertas', {});
  assert.equal(r.ok, false);
  assert.match(r.error, /desactivado/i);
  assert.equal((await callOk('auth:session')).authenticated, false, 'la app lo manda al login');
});

// ═══════════════ escalada de privilegios ═══════════════
test('"users.edit" NO alcanza para repartir permisos', async () => {
  await comoAdmin();
  const u = await crearUsuarioConPermisos('Encargado',
    ['ventas.view', 'users.view', 'users.edit'],
    { name: 'Encargado', username: 'enc', password: 'enc12345' });

  await entrar('enc', 'enc12345');
  assert.ok((await call('users:list', {})).ok, 'sí puede ver el listado');

  const r = await call('users:setPermissions', { id: u.id, permissions: todosLosPermisos() });
  assert.equal(r.ok, false, 'no debería poder auto-asignarse permisos');
  assert.match(r.error, /permiso/i);

  // Y sigue sin poder entrar a lo que no le toca.
  assert.equal((await call('roles:list', {})).ok, false);
});

test('nadie cambia sus propios permisos, ni teniendo "users.permissions"', async () => {
  await comoAdmin();
  const u = await crearUsuarioConPermisos('Sub-admin',
    ['users.view', 'users.edit', 'users.permissions'],
    { name: 'Sub', username: 'sub', password: 'sub12345' });

  await entrar('sub', 'sub12345');
  const r = await call('users:setPermissions', { id: u.id, permissions: todosLosPermisos() });
  assert.equal(r.ok, false);
  assert.match(r.error, /tus propios permisos/i);
});

test('con "users.permissions" sí puede repartir permisos a OTROS', async () => {
  await comoAdmin();
  const sub = await crearUsuarioConPermisos('Sub-admin',
    ['users.view', 'users.edit', 'users.permissions'],
    { name: 'Sub', username: 'sub', password: 'sub12345' });
  const otro = await callOk('users:create', { name: 'Otro', username: 'otro', password: 'otro1234' });

  await entrar('sub', 'sub12345');
  const r = await callOk('users:setPermissions', { id: otro.id, permissions: ['ventas.view'] });
  assert.deepEqual(r.permissions.map((p) => p.permission_key), ['ventas.view']);
});

test('"users.create" no permite fabricar un usuario con permisos sueltos', async () => {
  await comoAdmin();
  await crearUsuarioConPermisos('Alta de personal', ['users.view', 'users.create'],
    { name: 'Reclutador', username: 'rec', password: 'rec12345' });

  await entrar('rec', 'rec12345');
  const r = await call('users:create', {
    name: 'Títere', username: 'titere', password: 'tit12345', extraPermissions: todosLosPermisos(),
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /permiso/i);

  // Sin permisos sueltos, el alta normal sí funciona.
  assert.ok((await call('users:create', { name: 'Normal', username: 'normal', password: 'nor12345' })).ok);
});

test('los permisos nuevos no aplican a una sesión ya abierta', async () => {
  await comoAdmin();
  const u = await crearUsuarioConPermisos('Cajero', ['ventas.view'],
    { name: 'Beto', username: 'beto', password: 'beto1234' });

  await entrar('beto', 'beto1234');
  assert.equal((await call('users:list', {})).ok, false);

  await comoAdmin();
  await callOk('users:setPermissions', { id: u.id, permissions: ['ventas.view', 'users.view'] });

  await entrar('beto', 'beto1234');
  assert.ok((await call('users:list', {})).ok, 'tras volver a entrar sí los tiene');
});

// ═══════════════ un cajero no toca la administración ═══════════════
test('un cajero recibe "no tienes permiso" en todos los canales de administración', async () => {
  await comoAdmin();
  const jefa = await callOk('users:create', { name: 'Jefa', username: 'jefa', password: 'jefa1234' });
  await crearUsuarioConPermisos('Cajero', ['ventas.view', 'ventas.crear', 'ventas.cobrar'],
    { name: 'Caro', username: 'caro', password: 'caro1234' });

  await entrar('caro', 'caro1234');
  const intentos = [
    ['users:list', {}], ['users:get', { id: jefa.id }],
    ['users:create', { name: 'Yo', username: 'yo', password: '1234' }],
    ['users:update', { id: jefa.id, name: 'Hackeada' }],
    ['users:resetPassword', { id: jefa.id, password: 'hackeado' }],
    ['users:deactivate', { id: jefa.id }],
    ['users:setPermissions', { id: jefa.id, permissions: [] }],
    ['roles:list', {}], ['roles:create', { name: 'Pirata', permissions: [] }],
    ['roles:delete', { id: 1 }], ['logs:list', {}],
  ];
  for (const [canal, payload] of intentos) {
    const r = await call(canal, payload);
    assert.equal(r.ok, false, `${canal} debería negarse`);
    assert.match(r.error, /permiso/i, canal);
  }
});

// ═══════════════ mensajes claros ═══════════════
test('operar sobre un usuario inexistente da un mensaje entendible, no un error de JavaScript', async () => {
  await comoAdmin();
  const canales = [
    ['users:update', { id: 9999, name: 'X' }],
    ['users:changeUsername', { id: 9999, username: 'x' }],
    ['users:resetPassword', { id: 9999, password: 'abcd' }],
    ['users:deactivate', { id: 9999 }],
    ['users:activate', { id: 9999 }],
    ['users:setPermissions', { id: 9999, permissions: [] }],
  ];
  for (const [canal, payload] of canales) {
    const r = await call(canal, payload);
    assert.equal(r.ok, false, canal);
    assert.match(r.error, /El usuario no existe\./, canal);
    assert.doesNotMatch(r.error, /Cannot read|undefined|null/i, `${canal} filtra un error interno`);
  }
});

test('el usuario interno del sistema no se puede tocar desde la interfaz', async () => {
  await comoAdmin();
  const adminId = getDb().prepare('SELECT id FROM users WHERE is_system = 1').get().id;
  assert.equal(await callOk('users:get', { id: adminId }), null, 'es invisible');
  assert.equal((await callOk('users:list', {})).some((u) => u.id === adminId), false);
  for (const [canal, payload] of [
    ['users:resetPassword', { id: adminId, password: 'hackeado' }],
    ['users:deactivate', { id: adminId }],
    ['users:changeUsername', { id: adminId, username: 'root' }],
  ]) {
    assert.match((await call(canal, payload)).error, /no existe/i, canal);
  }
});

// ═══════════════ roles ═══════════════
test('editar un rol no cambia los permisos de los usuarios ya creados', async () => {
  await comoAdmin();
  const rol = await callOk('roles:create', { name: 'Cajero', permissions: ['ventas.view', 'ventas.cancelar'] });
  const u = await callOk('users:create', { name: 'Beto', username: 'beto', password: 'beto1234', roleId: rol.id });
  const antes = (await callOk('users:get', { id: u.id })).permissions.map((p) => p.permission_key).sort();

  await callOk('roles:update', { id: rol.id, permissions: ['ventas.view'] });

  const despues = (await callOk('users:get', { id: u.id })).permissions.map((p) => p.permission_key).sort();
  assert.deepEqual(despues, antes);
});

test('no se elimina un rol que tiene usuarios asignados', async () => {
  await comoAdmin();
  const rol = await callOk('roles:create', { name: 'Cajero', permissions: ['ventas.view'] });
  await callOk('users:create', { name: 'Beto', username: 'beto', password: 'beto1234', roleId: rol.id });
  const r = await call('roles:delete', { id: rol.id });
  assert.equal(r.ok, false);
  assert.match(r.error, /1 usuario\(s\) tienen este rol/i);
});

test('un rol no puede llevar permisos que no existen en el catálogo', async () => {
  await comoAdmin();
  const r = await call('roles:create', { name: 'Inventado', permissions: ['ventas.view', 'ventas.no_existe'] });
  assert.equal(r.ok, false, 'el permiso inventado debe rechazarse');
  assert.equal(getDb().prepare("SELECT COUNT(*) c FROM roles WHERE name = 'Inventado'").get().c, 0,
    'y el rol no queda a medias');
});

// ═══════════════ bitácora ═══════════════
test('la bitácora registra el acceso y los cambios de personal', async () => {
  await comoAdmin();
  const u = await callOk('users:create', { name: 'Beto', username: 'beto', password: 'beto1234' });
  await callOk('users:changeUsername', { id: u.id, username: 'beto2' });
  await callOk('users:resetPassword', { id: u.id, password: 'otra1234' });
  await callOk('users:deactivate', { id: u.id });
  await callOk('auth:logout');
  session.clear();
  await call('auth:login', { username: 'beto2', password: 'malísima' });

  const acciones = getDb().prepare('SELECT DISTINCT action FROM audit_log').all().map((r) => r.action);
  for (const esperada of ['auth.login.success', 'auth.login.failed', 'auth.logout',
    'users.create', 'users.username_change', 'users.password_reset', 'users.deactivate']) {
    assert.ok(acciones.includes(esperada), `falta "${esperada}" en la bitácora`);
  }
  const sinAutor = getDb().prepare("SELECT COUNT(*) c FROM audit_log WHERE username = ''").get().c;
  assert.equal(sinAutor, 0, 'todos los renglones deben tener autor');
});

test('la bitácora solo expone canales de lectura', () => {
  const { handlers } = require('../helpers/ipc');
  const canales = [...handlers.keys()].filter((c) => c.startsWith('logs:'));
  assert.deepEqual(canales.sort(), ['logs:actions', 'logs:list']);
});
