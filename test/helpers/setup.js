'use strict';

/**
 * Base para las pruebas unitarias.
 * Cada prueba corre contra una base SQLite limpia en un archivo temporal:
 * antes de cada `test()` se borra la BD y se aplican todas las migraciones.
 *
 * Se ejecuta bajo el runtime de Electron (ver scripts/test.js) porque
 * better-sqlite3 está compilado para el ABI de Electron.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { beforeEach, afterEach } = require('node:test');

const DB_PATH = path.join(os.tmpdir(), `beso-unit-${process.pid}.db`);
process.env.BESO_DB_PATH = DB_PATH;
const ACTOR = { id: 1, username: 'tester' };

const { getDb, closeDb } = require('../../src/main/db/connection');
const { runMigrations } = require('../../src/main/db/migrate');

function borrarArchivo() {
  for (const s of ['', '-wal', '-shm']) {
    try { fs.rmSync(DB_PATH + s); } catch { /* no existía */ }
  }
}

function reset() {
  closeDb();
  borrarArchivo();
  runMigrations();
  // usuario mínimo para que los movimientos con actor no rompan la FK a users(id)
  getDb().prepare(
    "INSERT INTO users (id, name, username, password_hash, is_active, is_system) VALUES (1, 'Tester', 'tester', 'x', 1, 1)"
  ).run();
}

beforeEach(() => reset());
afterEach(() => closeDb());
process.on('exit', borrarArchivo);

/** Crea una categoría de insumo y devuelve su fila. */
function crearCategoria(nombre = 'Prueba', unidad = 'g') {
  return require('../../src/main/services/categoriaService').createCategoria({ nombre, unidad_sugerida: unidad });
}

/** Crea un insumo básico y devuelve su fila. */
function crearInsumo(over = {}) {
  return require('../../src/main/services/insumoService').createInsumo({
    nombre: 'Insumo prueba',
    unidad_base: 'g',
    unidad_compra: 'Bolsa 1 kg',
    factor_compra: 1000,
    costo_compra: 100,        // -> costo_unitario 0.1 por g
    stock_inicial_compra: 10,
    stock_minimo: 200,
    ...over,
  });
}

/** Crea una categoría de producto. */
function crearProductoCategoria(nombre = 'Categoría prueba') {
  return require('../../src/main/services/productoCategoriaService').createCategoria({ nombre });
}

/**
 * Foto mínima válida (PNG de 1×1 px) para las pruebas: el producto no se puede
 * dar de alta sin foto, y a estas pruebas la imagen les da igual.
 */
const FOTO_PRUEBA =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Crea un producto simple (1 tamaño "Único") con la receta que se pase. */
function crearProducto(over = {}, receta = null) {
  const svc = require('../../src/main/services/productoService');
  const p = svc.createProducto({ nombre: 'Producto prueba', precio: 50, foto: FOTO_PRUEBA, ...over }, ACTOR);
  if (receta) svc.setReceta(p.presentaciones[0].id, receta, ACTOR);
  return svc.getProducto(p.id);
}

/** Abre un turno de caja (requerido para cobrar en efectivo). */
function abrirCaja(fondo_inicial = 0) {
  return require('../../src/main/services/cajaService').abrirCorte({ fondo_inicial }, ACTOR);
}

module.exports = {
  getDb, reset, DB_PATH, ACTOR, FOTO_PRUEBA,
  crearCategoria, crearInsumo, crearProductoCategoria, crearProducto, abrirCaja,
};
