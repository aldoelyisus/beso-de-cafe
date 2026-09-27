'use strict';

const fs = require('fs');
const path = require('path');
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { crearCategoria } = require('../helpers/setup');
const { closeDb } = require('../../src/main/db/connection');
const backup = require('../../src/main/backup/backupService');
const categoriaService = require('../../src/main/services/categoriaService');

// La carpeta de respaldos no está namespaced por prueba (vive junto al .db de
// prueba, en el tmpdir), así que se limpia antes de cada prueba para que no
// se acumulen archivos entre corridas de `npm test`.
beforeEach(() => {
  try { fs.rmSync(backup.backupsDir(), { recursive: true, force: true }); } catch { /* no existía */ }
});

test('crearRespaldo (manual) deja un .db abierto, con el prefijo y tamaño correctos', async () => {
  crearCategoria('Café');
  const r = await backup.crearRespaldo({ tipo: 'manual' });
  assert.match(r.archivo, /^manual_.*\.db$/);
  assert.equal(r.tipo, 'manual');
  assert.ok(r.tamano > 0, 'tiene tamaño');
  assert.ok(fs.existsSync(path.join(backup.backupsDir(), r.archivo)));
});

test('listRespaldos: trae lo creado, más nuevo primero', async () => {
  await backup.crearRespaldo({ tipo: 'manual' });
  await new Promise((r) => setTimeout(r, 5));
  const r2 = await backup.crearRespaldo({ tipo: 'automatico' });
  const lista = backup.listRespaldos();
  assert.equal(lista.length, 2);
  assert.equal(lista[0].archivo, r2.archivo, 'el más reciente va primero');
  assert.deepEqual(lista.map((x) => x.tipo).sort(), ['automatico', 'manual']);
});

test('los respaldos automáticos se podan; manuales y "antes de restaurar" no', async () => {
  for (let i = 0; i < backup.MAX_AUTOMATICOS + 3; i++) {
    await backup.crearRespaldo({ tipo: 'automatico' });
  }
  await backup.crearRespaldo({ tipo: 'manual' });
  await backup.crearRespaldo({ tipo: 'pre-restaurar' });

  const lista = backup.listRespaldos();
  const autos = lista.filter((r) => r.tipo === 'automatico');
  assert.equal(autos.length, backup.MAX_AUTOMATICOS, `se conservan solo los últimos ${backup.MAX_AUTOMATICOS}`);
  assert.equal(lista.filter((r) => r.tipo === 'manual').length, 1, 'el manual sobrevive la poda');
  assert.equal(lista.filter((r) => r.tipo === 'pre-restaurar').length, 1, 'el de antes-de-restaurar sobrevive la poda');
});

test('respaldarSiHaceFalta: hace uno si no hay ninguno hoy, y no repite el mismo día', async () => {
  assert.equal(backup.listRespaldos().length, 0);
  const primero = await backup.respaldarSiHaceFalta();
  assert.ok(primero, 'creó el primero');
  assert.equal(backup.listRespaldos().filter((r) => r.tipo === 'automatico').length, 1);

  const segundo = await backup.respaldarSiHaceFalta();
  assert.equal(segundo, null, 'ya había uno hoy: no crea otro');
  assert.equal(backup.listRespaldos().filter((r) => r.tipo === 'automatico').length, 1);

  // Se simula que el único automático es de "ayer" retrasando su fecha de modificación.
  const archivo = path.join(backup.backupsDir(), backup.listRespaldos()[0].archivo);
  const ayer = new Date(Date.now() - 25 * 60 * 60 * 1000);
  fs.utimesSync(archivo, ayer, ayer);

  const tercero = await backup.respaldarSiHaceFalta();
  assert.ok(tercero, 'con el último fechado ayer, hace uno nuevo hoy');
  assert.equal(backup.listRespaldos().filter((r) => r.tipo === 'automatico').length, 2);
});

test('verificarIntegridad: ok en una base sana', () => {
  const r = backup.verificarIntegridad();
  assert.equal(r.ok, true);
  assert.equal(r.detalle, 'ok');
});

test('verificarIntegridad detecta una base dañada (no se queda "ok" en silencio)', () => {
  closeDb();
  const { DB_PATH } = require('../helpers/setup');
  fs.writeFileSync(DB_PATH, 'esto no es una base de datos sqlite', 'utf8');
  fs.rmSync(DB_PATH + '-wal', { force: true });
  fs.rmSync(DB_PATH + '-shm', { force: true });

  let resultado;
  try { resultado = backup.verificarIntegridad(); }
  catch (e) { resultado = { ok: false, detalle: e.message }; }
  assert.equal(resultado.ok, false, 'no pasa la verificación con un archivo corrupto');
});

test('nombreValido rechaza rutas fuera de la carpeta de respaldos', () => {
  assert.equal(backup.nombreValido('manual_2026-01-01_00-00-00-000.db'), true);
  assert.equal(backup.nombreValido('../../etc/algo.db'), false);
  assert.equal(backup.nombreValido('..\\..\\algo.db'), false);
  assert.equal(backup.nombreValido('algo.txt'), false);
  assert.equal(backup.nombreValido(''), false);
  assert.equal(backup.nombreValido(null), false);
});

test('restaurarRespaldo rechaza nombres inválidos o que no existen', async () => {
  await assert.rejects(() => backup.restaurarRespaldo('../fuera.db'), /no válido/);
  await assert.rejects(() => backup.restaurarRespaldo('no_existe_123.db'), /ya no existe/);
});

test('restaurarRespaldo: de punta a punta — regresa los datos a como estaban, y deja un respaldo "antes de restaurar"', async () => {
  crearCategoria('Café');
  const r = await backup.crearRespaldo({ tipo: 'manual' }); // foto: solo "Café"
  crearCategoria('Lácteos'); // esto pasa DESPUÉS del respaldo

  let cats = categoriaService.listCategorias({ pageSize: 50 }).rows.map((c) => c.nombre).sort();
  assert.deepEqual(cats, ['Café', 'Lácteos']);

  const antes = backup.listRespaldos().length;
  const res = await backup.restaurarRespaldo(r.archivo);
  assert.equal(res.archivo, r.archivo);

  cats = categoriaService.listCategorias({ pageSize: 50 }).rows.map((c) => c.nombre);
  assert.deepEqual(cats, ['Café'], '"Lácteos" ya no existe: se volvió al momento del respaldo');

  const despues = backup.listRespaldos();
  assert.equal(despues.length, antes + 1, 'se agregó el respaldo "antes de restaurar"');
  assert.ok(despues.some((x) => x.tipo === 'pre-restaurar'), 'guardó una foto de seguridad antes de restaurar');

  const chequeo = backup.verificarIntegridad();
  assert.equal(chequeo.ok, true, 'la base restaurada pasa la verificación');
});
