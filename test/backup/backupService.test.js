'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { crearCategoria } = require('../helpers/setup');
const backup = require('../../src/main/backup/backupService');
const categoriaService = require('../../src/main/services/categoriaService');

function carpetaTemporal() {
  const dir = path.join(os.tmpdir(), `beso-respaldo-qa-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test('crearRespaldoEn: deja un .db válido y abierto en la carpeta elegida', async () => {
  crearCategoria('Café');
  const carpeta = carpetaTemporal();
  const r = await backup.crearRespaldoEn(carpeta);
  assert.match(r.archivo, /^beso-de-cafe_respaldo_.*\.db$/);
  assert.equal(r.ruta, path.join(carpeta, r.archivo));
  assert.ok(r.tamano > 0, 'tiene tamaño');
  assert.ok(fs.existsSync(r.ruta));
});

test('crearRespaldoEn: contiene de verdad los datos de ese momento', async () => {
  crearCategoria('Solo esta');
  const carpeta = carpetaTemporal();
  const r = await backup.crearRespaldoEn(carpeta);

  // Abre el .db resultante como una base aparte y confirma su contenido,
  // sin tocar la base "viva" de la prueba.
  const Database = require('better-sqlite3');
  const copia = new Database(r.ruta, { readonly: true });
  const nombres = copia.prepare('SELECT nombre FROM insumo_categorias').all().map((x) => x.nombre);
  copia.close();
  assert.ok(nombres.includes('Solo esta'));
});

test('crearRespaldoEn: sin carpeta o con una que no existe, avisa claro', async () => {
  await assert.rejects(() => backup.crearRespaldoEn(''), /elige una carpeta/i);
  await assert.rejects(() => backup.crearRespaldoEn(null), /elige una carpeta/i);
  await assert.rejects(() => backup.crearRespaldoEn(path.join(os.tmpdir(), 'esta-carpeta-no-existe-qa')), /no existe/i);
});

test('crearRespaldoEn: dos respaldos seguidos no se pisan (nombres con hora distinta o ambos válidos)', async () => {
  crearCategoria('X');
  const carpeta = carpetaTemporal();
  const r1 = await backup.crearRespaldoEn(carpeta);
  await new Promise((res) => setTimeout(res, 1100)); // el nombre solo lleva hasta los segundos
  const r2 = await backup.crearRespaldoEn(carpeta);
  assert.notEqual(r1.archivo, r2.archivo);
  assert.ok(fs.existsSync(r1.ruta) && fs.existsSync(r2.ruta), 'los dos archivos existen, ninguno se sobrescribió');
});
