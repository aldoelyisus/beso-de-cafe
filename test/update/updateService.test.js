'use strict';

/**
 * Actualización a distancia. Esto reescribe el código de una computadora a la
 * que no se puede ir, así que lo que se prueba aquí es sobre todo lo que NO
 * debe pasar: que un archivo dañado se aplique, que una actualización se salga
 * de la carpeta del programa, o que un fallo a media escritura deje el
 * programa mitad viejo y mitad nuevo.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { test } = require('node:test');
const assert = require('node:assert/strict');

// Carpeta de datos de mentiras: los respaldos de código y el historial de
// esta prueba no tienen por qué tocar los de la computadora de quien la corre.
process.env.BESO_DATOS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), 'beso-datos-'));
const update = require('../../src/main/update/updateService');

function raizFalsa(archivos = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beso-app-'));
  for (const [rel, contenido] of Object.entries(archivos)) {
    const destino = path.join(dir, rel);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido, 'utf8');
  }
  return dir;
}

function paquete(archivos, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beso-upd-'));
  const ruta = path.join(dir, 'actualizacion.json');
  const conHash = {};
  for (const [rel, contenido] of Object.entries(archivos)) {
    conHash[rel] = { sha256: update.sha256(contenido), contenido };
  }
  fs.writeFileSync(ruta, JSON.stringify({
    formato: 1, version: '9.9.9', descripcion: 'prueba', creado: new Date().toISOString(),
    archivos: conHash, ...extra,
  }), 'utf8');
  return ruta;
}

const leer = (raiz, rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');

test('aplicar: reemplaza el código y agrega archivos nuevos', () => {
  const raiz = raizFalsa({ 'src/a.js': 'viejo', 'src/sub/b.js': 'b viejo' });
  const p = paquete({ 'src/a.js': 'nuevo', 'src/sub/c.js': 'c nuevo' });

  const r = update.aplicar(p, { raiz });
  assert.equal(r.version, '9.9.9');
  assert.equal(leer(raiz, 'src/a.js'), 'nuevo', 'el archivo cambiado se reemplaza');
  assert.equal(leer(raiz, 'src/sub/c.js'), 'c nuevo', 'el archivo nuevo se crea');
  assert.equal(leer(raiz, 'src/sub/b.js'), 'b viejo', 'lo que no venía en la actualización no se toca');
});

test('deshacer: deja el programa como estaba antes', () => {
  const raiz = raizFalsa({ 'src/a.js': 'viejo' });
  update.aplicar(paquete({ 'src/a.js': 'nuevo', 'src/nuevo.js': 'recién llegado' }), { raiz });
  assert.equal(leer(raiz, 'src/a.js'), 'nuevo');

  update.revertir({ raiz });
  assert.equal(leer(raiz, 'src/a.js'), 'viejo', 'el archivo vuelve a su contenido anterior');
  assert.equal(fs.existsSync(path.join(raiz, 'src/nuevo.js')), false,
    'el archivo que no existía antes se quita');
});

test('un archivo dañado en el camino (WhatsApp, USB) no se aplica', () => {
  const raiz = raizFalsa({ 'src/a.js': 'viejo' });
  const p = paquete({ 'src/a.js': 'nuevo' });
  const datos = JSON.parse(fs.readFileSync(p, 'utf8'));
  datos.archivos['src/a.js'].contenido = 'llegó a medias'; // el sha ya no cuadra
  fs.writeFileSync(p, JSON.stringify(datos), 'utf8');

  assert.throws(() => update.aplicar(p, { raiz }), /incompleto o dañado/i);
  assert.equal(leer(raiz, 'src/a.js'), 'viejo', 'no alcanzó a tocar nada');
});

test('no deja escribir fuera de la carpeta del programa', () => {
  const raiz = raizFalsa({ 'src/a.js': 'viejo' });
  for (const malo of ['../fuera.js', 'src/../../fuera.js', 'C:/Windows/x.js', '/etc/passwd', 'otro/sitio.js']) {
    const p = paquete({ [malo]: 'intruso' });
    assert.throws(() => update.aplicar(p, { raiz }), /lugar no permitido/i, `debió rechazar ${malo}`);
  }
  // y la base de datos no es código: tampoco se puede pisar desde una actualización
  assert.equal(update.rutaSegura('data/beso-de-cafe.db'), null);
  assert.equal(update.rutaSegura('src/main/index.js'), 'src/main/index.js');
  assert.equal(update.rutaSegura('package.json'), 'package.json');
});

test('un archivo que no es una actualización se rechaza con un mensaje claro', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beso-upd-'));
  const basura = path.join(dir, 'foto.json');
  fs.writeFileSync(basura, 'esto no es json {{{', 'utf8');
  assert.throws(() => update.leerActualizacion(basura), /no es una actualización/i);

  const otroFormato = path.join(dir, 'futuro.json');
  fs.writeFileSync(otroFormato, JSON.stringify({ formato: 99, version: '1', archivos: {} }), 'utf8');
  assert.throws(() => update.leerActualizacion(otroFormato), /no es una actualización|más nueva/i);

  const vacia = path.join(dir, 'vacia.json');
  fs.writeFileSync(vacia, JSON.stringify({ formato: 1, version: '1.0.0', archivos: {} }), 'utf8');
  assert.throws(() => update.leerActualizacion(vacia), /ningún archivo/i);

  assert.throws(() => update.leerActualizacion(path.join(dir, 'no-existe.json')), /no se pudo leer/i);
});

test('si falla a media escritura, deshace lo que alcanzó: nunca queda mitad viejo y mitad nuevo', () => {
  const raiz = raizFalsa({ 'src/a.js': 'viejo A', 'src/b.js': 'viejo B' });
  // Se hace que el segundo archivo sea imposible de escribir: ya existe una
  // CARPETA con ese nombre, así que writeFileSync truena a medio camino.
  fs.mkdirSync(path.join(raiz, 'src/c.js'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'src/c.js', 'adentro.txt'), 'x', 'utf8');

  const p = paquete({ 'src/a.js': 'nuevo A', 'src/c.js': 'no se va a poder' });
  assert.throws(() => update.aplicar(p, { raiz }), /no se pudo aplicar/i);
  assert.equal(leer(raiz, 'src/a.js'), 'viejo A', 'el archivo que sí se había escrito volvió a su versión anterior');
  assert.equal(leer(raiz, 'src/b.js'), 'viejo B');
});

test('leerActualizacion solo lee: no toca el programa', () => {
  const raiz = raizFalsa({ 'src/a.js': 'viejo' });
  const p = paquete({ 'src/a.js': 'nuevo' });
  const info = update.leerActualizacion(p);
  assert.equal(info.version, '9.9.9');
  assert.deepEqual(info.archivos, ['src/a.js']);
  assert.equal(leer(raiz, 'src/a.js'), 'viejo', 'revisar no es aplicar');
});

test('el historial anota cada actualización aplicada', () => {
  const raiz = raizFalsa({ 'src/a.js': 'viejo' });
  const antes = update.historial().length;
  update.aplicar(paquete({ 'src/a.js': 'nuevo' }, { descripcion: 'Arregla el botón X' }), { raiz });
  const h = update.historial();
  assert.equal(h.length, antes + 1);
  assert.equal(h[0].descripcion, 'Arregla el botón X');
  assert.equal(h[0].archivos, 1);
});
