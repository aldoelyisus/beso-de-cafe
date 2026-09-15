'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTOR, crearCategoria } = require('../helpers/setup');
const svc = require('../../src/main/services/insumoService');

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg || 'valor'}: ${a} ≈ ${b}`);

// ---------------- createInsumo ----------------
test('crea un insumo y calcula el costo por unidad base', () => {
  const i = svc.createInsumo({
    nombre: 'Café en grano', unidad_base: 'g',
    unidad_compra: 'Bolsa 1 kg', factor_compra: 1000, costo_compra: 250,
    stock_inicial_compra: 2, stock_minimo: 500,
  });
  near(i.costo_unitario, 0.25, 'costo por g = 250 / 1000');
  assert.equal(i.stock, 2000, '2 bolsas × 1000 g');
  assert.equal(i.is_active, 1);
});

test('la existencia inicial genera un movimiento de entrada', () => {
  const i = svc.createInsumo({ nombre: 'Leche', unidad_base: 'ml', unidad_compra: 'Litro', factor_compra: 1000, costo_compra: 25, stock_inicial_compra: 3 });
  const movs = svc.listMovimientos({ insumoId: i.id });
  assert.equal(movs.length, 1);
  assert.equal(movs[0].tipo, 'entrada');
  assert.equal(movs[0].cantidad_base, 3000);
});

test('sin existencia inicial no hay movimientos', () => {
  const i = svc.createInsumo({ nombre: 'Vaso', unidad_base: 'pieza', factor_compra: 1, costo_compra: 2, stock_inicial_compra: 0 });
  assert.equal(svc.listMovimientos({ insumoId: i.id }).length, 0);
  assert.equal(i.stock, 0);
});

test('rechaza nombre vacío', () => {
  assert.throws(() => svc.createInsumo({ nombre: '  ', unidad_base: 'g' }), /obligatorio/i);
});

test('rechaza unidad base no válida', () => {
  assert.throws(() => svc.createInsumo({ nombre: 'X', unidad_base: 'kg' }), /no válida/i);
});

test('rechaza factor de compra <= 0', () => {
  assert.throws(() => svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 0 }), /mayor a 0/i);
});

test('rechaza costo de compra negativo', () => {
  assert.throws(() => svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: -1 }), /negativo/i);
});

test('rechaza stock mínimo negativo', () => {
  assert.throws(() => svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_minimo: -5 }), /negativo/i);
});

// ---------------- integridad del alta ----------------
test('no se pueden crear dos insumos con el mismo nombre', () => {
  svc.createInsumo({ nombre: 'Café en grano', unidad_base: 'g', factor_compra: 1000, costo_compra: 300 });
  assert.throws(
    () => svc.createInsumo({ nombre: 'Café en grano', unidad_base: 'g', factor_compra: 1000, costo_compra: 320 }),
    /Ya existe un insumo con ese nombre/i
  );
});

test('el nombre repetido tampoco pasa cambiando mayúsculas, acentos o espacios', () => {
  svc.createInsumo({ nombre: 'Café en grano', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  // "CAFÉ" no lo detecta COLLATE NOCASE de SQLite (solo pliega ASCII): la
  // comparación buena vive en services/nombres.js.
  for (const variante of ['CAFÉ EN GRANO', 'café en grano', 'Cafe en grano', '  Café  en  grano  ']) {
    assert.throws(
      () => svc.createInsumo({ nombre: variante, unidad_base: 'g', factor_compra: 1, costo_compra: 1 }),
      /Ya existe/i, variante
    );
  }
});

test('si el insumo repetido está dado de baja, el mensaje dice que se reactive', () => {
  const i = svc.createInsumo({ nombre: 'Mango', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  svc.deactivateInsumo(i.id);
  assert.throws(() => svc.createInsumo({ nombre: 'Mango', unidad_base: 'g', factor_compra: 1, costo_compra: 1 }),
    /dado de baja.*Reactívalo/i);
});

test('renombrar un insumo al nombre de otro se rechaza', () => {
  svc.createInsumo({ nombre: 'Leche', unidad_base: 'ml', factor_compra: 1, costo_compra: 1 });
  const otro = svc.createInsumo({ nombre: 'Cocoa', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  assert.throws(() => svc.updateInsumo(otro.id, { nombre: 'leche' }), /Ya existe/i);
  // pero conservar su propio nombre sí se puede
  assert.equal(svc.updateInsumo(otro.id, { nombre: 'Cocoa' }).nombre, 'Cocoa');
});

test('una categoría inexistente da un mensaje claro, no el error de la base', () => {
  assert.throws(
    () => svc.createInsumo({ nombre: 'X', unidad_base: 'g', categoria_id: 9999, factor_compra: 1, costo_compra: 1 }),
    /La categoría seleccionada no existe/i
  );
});

test('texto en un campo numérico se rechaza con el nombre del campo', () => {
  const base = { nombre: 'X', unidad_base: 'g' };
  assert.throws(() => svc.createInsumo({ ...base, factor_compra: 'mil', costo_compra: 1 }), /Rinde.*debe ser un número/i);
  assert.throws(() => svc.createInsumo({ ...base, factor_compra: 1, costo_compra: 'cincuenta' }), /Costo de compra.*debe ser un número/i);
  assert.throws(() => svc.createInsumo({ ...base, factor_compra: 1, costo_compra: 1, stock_minimo: 'poco' }), /Stock mínimo.*debe ser un número/i);
  assert.throws(() => svc.createInsumo({ ...base, factor_compra: 1, costo_compra: 1, stock_inicial_compra: 'dos' }), /Existencia inicial.*debe ser un número/i);
});

test('un campo numérico vacío toma el valor por defecto, sin error', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: '', costo_compra: '', stock_minimo: '' });
  assert.equal(i.factor_compra, 1);
  assert.equal(i.costo_compra, 0);
  assert.equal(i.stock_minimo, 0);
});

// ---------------- updateInsumo ----------------
test('edita el nombre sin tocar el stock', () => {
  const i = svc.createInsumo({ nombre: 'Viejo', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 10 });
  const u = svc.updateInsumo(i.id, { nombre: 'Nuevo' });
  assert.equal(u.nombre, 'Nuevo');
  assert.equal(u.stock, 10);
});

test('si no hay stock, cambiar el costo de compra recalcula el costo unitario', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', unidad_compra: 'kg', factor_compra: 1000, costo_compra: 100, stock_inicial_compra: 0 });
  const u = svc.updateInsumo(i.id, { costo_compra: 300 });
  near(u.costo_unitario, 0.3, 'nuevo costo por g');
});

test('update de insumo inexistente lanza error', () => {
  assert.throws(() => svc.updateInsumo(999, { nombre: 'x' }), /no existe/i);
});

// ---------------- la unidad base no se cambia a medio camino ----------------
test('no se puede cambiar la unidad base de un insumo con existencia', () => {
  const i = svc.createInsumo({ nombre: 'Café', unidad_base: 'g', unidad_compra: 'kg', factor_compra: 1000, costo_compra: 300, stock_inicial_compra: 2 });
  assert.throws(() => svc.updateInsumo(i.id, { unidad_base: 'ml' }), /No se puede cambiar la unidad/i);
  const despues = svc.getInsumo(i.id);
  assert.equal(despues.unidad_base, 'g', 'la unidad no cambió');
  assert.equal(despues.stock, 2000, 'la existencia quedó intacta');
});

test('el mensaje explica por qué no se puede cambiar la unidad', () => {
  const i = svc.createInsumo({ nombre: 'Café', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 500 });
  try {
    svc.updateInsumo(i.id, { unidad_base: 'ml' });
    assert.fail('debería haber lanzado');
  } catch (e) {
    assert.match(e.message, /tiene existencia/i);
    assert.match(e.message, /movimientos registrados/i);
    assert.match(e.message, /crea uno nuevo/i, 'dice qué hacer en su lugar');
  }
});

test('un insumo recién creado y en blanco SÍ puede cambiar de unidad', () => {
  const i = svc.createInsumo({ nombre: 'Nuevo', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 0 });
  assert.equal(svc.updateInsumo(i.id, { unidad_base: 'ml' }).unidad_base, 'ml');
});

test('guardar la ficha sin tocar la unidad no se bloquea', () => {
  const i = svc.createInsumo({ nombre: 'Café', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 100 });
  const u = svc.updateInsumo(i.id, { unidad_base: 'g', notas: 'una nota' });
  assert.equal(u.notas, 'una nota');
});

test('con movimientos pero sin existencia tampoco se cambia la unidad', () => {
  const i = svc.createInsumo({ nombre: 'Café', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 10 });
  svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste', conteo: 0 }, ACTOR);
  assert.equal(svc.getInsumo(i.id).stock, 0);
  assert.throws(() => svc.updateInsumo(i.id, { unidad_base: 'ml' }), /movimientos registrados/i);
});

// ---------------- registrarMovimiento: entrada ----------------
test('entrada suma stock y aplica costo promedio ponderado', () => {
  const i = svc.createInsumo({ nombre: 'Café', unidad_base: 'g', unidad_compra: 'kg', factor_compra: 1000, costo_compra: 200, stock_inicial_compra: 2 });
  // 2000 g @ 0.20 ; entra 2 kg @ 0.40  ->  (2000*0.2 + 2000*0.4) / 4000 = 0.30
  const r = svc.registrarMovimiento({ insumoId: i.id, tipo: 'entrada', cantidad: 2, costo_compra: 400 }, ACTOR);
  assert.equal(r.insumo.stock, 4000);
  near(r.insumo.costo_unitario, 0.3, 'costo promedio ponderado');
});

test('la entrada guarda la tienda / proveedor', () => {
  const i = svc.createInsumo({ nombre: 'Mango', unidad_base: 'g', unidad_compra: 'kg', factor_compra: 1000, costo_compra: 20 });
  svc.registrarMovimiento({ insumoId: i.id, tipo: 'entrada', cantidad: 3, costo_compra: 21, proveedor: '  Frutería del mercado  ' }, ACTOR);
  assert.equal(svc.listMovimientos({ insumoId: i.id })[0].proveedor, 'Frutería del mercado');
});

test('el proveedor solo se guarda en las entradas', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 10 });
  svc.registrarMovimiento({ insumoId: i.id, tipo: 'merma', cantidad: 1, motivo: 'derrame', proveedor: 'Tienda' }, ACTOR);
  assert.equal(svc.listMovimientos({ insumoId: i.id })[0].proveedor, '');
});

test('la entrada rechaza un costo de compra negativo', () => {
  const i = svc.createInsumo({ nombre: 'Café', unidad_base: 'g', unidad_compra: 'kg', factor_compra: 1000, costo_compra: 300, stock_inicial_compra: 2 });
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'entrada', cantidad: 1, costo_compra: -50 }, ACTOR), /no puede ser negativo/i);
  const despues = svc.getInsumo(i.id);
  assert.equal(despues.stock, 2000, 'no entró nada');
  assert.equal(despues.costo_compra, 300, 'el costo de compra quedó intacto');
});

test('el campo de costo vacío conserva el último costo conocido', () => {
  const i = svc.createInsumo({ nombre: 'Café', unidad_base: 'g', unidad_compra: 'kg', factor_compra: 1000, costo_compra: 300, stock_inicial_compra: 2 });
  const r = svc.registrarMovimiento({ insumoId: i.id, tipo: 'entrada', cantidad: 2 }, ACTOR);
  assert.equal(r.insumo.stock, 4000);
  near(r.insumo.costo_unitario, 0.3, 'sigue en el costo de siempre');
});

test('mercancía de regalo (costo 0 capturado) sí baja el promedio', () => {
  const i = svc.createInsumo({ nombre: 'Café', unidad_base: 'g', unidad_compra: 'kg', factor_compra: 1000, costo_compra: 300, stock_inicial_compra: 1 });
  // 1000 g @ 0.30 + 1000 g @ 0  ->  0.15
  const r = svc.registrarMovimiento({ insumoId: i.id, tipo: 'entrada', cantidad: 1, costo_compra: 0 }, ACTOR);
  near(r.insumo.costo_unitario, 0.15, 'el promedio baja a la mitad');
});

test('no se mueve la existencia de un insumo dado de baja', () => {
  const i = svc.createInsumo({ nombre: 'Retirado', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 100 });
  svc.deactivateInsumo(i.id);
  for (const mov of [
    { tipo: 'entrada', cantidad: 50, costo_compra: 2 },
    { tipo: 'merma', cantidad: 10, motivo: 'derrame' },
    { tipo: 'ajuste', conteo: 5 },
    { tipo: 'ajuste_costo', costo_compra: 9, nota: 'x' },
  ]) {
    assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, ...mov }, ACTOR),
      /dado de baja.*Reactívalo/i, `tipo ${mov.tipo}`);
  }
  assert.equal(svc.getInsumo(i.id).stock, 100, 'la existencia no se movió');
});

test('al reactivar el insumo, sus existencias vuelven a moverse', () => {
  const i = svc.createInsumo({ nombre: 'Retirado', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 100 });
  svc.deactivateInsumo(i.id);
  svc.activateInsumo(i.id);
  assert.equal(svc.registrarMovimiento({ insumoId: i.id, tipo: 'entrada', cantidad: 50, costo_compra: 1 }, ACTOR).insumo.stock, 150);
});

test('texto en la cantidad de un movimiento se rechaza', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 100 });
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'entrada', cantidad: 'dos' }, ACTOR), /debe ser un número/i);
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'merma', cantidad: 'poco', motivo: 'derrame' }, ACTOR), /debe ser un número/i);
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste', conteo: 'como cien' }, ACTOR), /debe ser un número/i);
});

test('entrada con cantidad <= 0 lanza error', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'entrada', cantidad: 0 }, ACTOR), /mayor a 0/i);
});

// ---------------- registrarMovimiento: merma ----------------
test('merma resta stock y exige un motivo válido', () => {
  const i = svc.createInsumo({ nombre: 'Café', unidad_base: 'g', unidad_compra: 'kg', factor_compra: 1000, costo_compra: 200, stock_inicial_compra: 1 });
  const r = svc.registrarMovimiento({ insumoId: i.id, tipo: 'merma', cantidad: 300, motivo: 'derrame' }, ACTOR);
  assert.equal(r.insumo.stock, 700);
});

test('merma sin motivo válido lanza error', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 5 });
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'merma', cantidad: 1, motivo: '' }, ACTOR), /motivo de merma/i);
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'merma', cantidad: 1, motivo: 'inventado' }, ACTOR), /motivo de merma/i);
});

test('merma no puede dejar el stock en negativo', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 5 });
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'merma', cantidad: 999, motivo: 'caducidad' }, ACTOR), /suficiente existencia/i);
});

test('la nota de la merma se guarda junto al motivo', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 5 });
  svc.registrarMovimiento({ insumoId: i.id, tipo: 'merma', cantidad: 1, motivo: 'derrame', nota: 'se cayó' }, ACTOR);
  assert.match(svc.listMovimientos({ insumoId: i.id })[0].motivo, /derrame: se cayó/);
});

// ---------------- registrarMovimiento: ajuste ----------------
test('ajuste deja el stock en el conteo físico y guarda la diferencia', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 1000 });
  const r = svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste', conteo: 850 }, ACTOR);
  assert.equal(r.insumo.stock, 850);
  assert.equal(r.cantidadBase, -150);
});

test('ajuste rechaza un conteo inválido', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste', conteo: -1 }, ACTOR), /conteo/i);
});

// ---------------- registrarMovimiento: ajuste_costo ----------------
test('ajuste_costo: se captura el precio del kilo y el sistema calcula el del gramo', () => {
  const i = svc.createInsumo({ nombre: 'Café soluble', unidad_base: 'g', unidad_compra: 'kg', factor_compra: 1000, costo_compra: 50, stock_inicial_compra: 2 });
  near(i.costo_unitario, 0.05, 'costo inicial');
  // La dueña escribe lo que cuesta el kilo ($55), no el gramo.
  const r = svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste_costo', costo_compra: 55, nota: 'lo compré en otra tienda' }, ACTOR);
  near(r.insumo.costo_unitario, 0.055, '55 / 1000 por gramo');
  assert.equal(r.insumo.stock, 2000, 'la existencia no cambia');
  assert.equal(r.cantidadBase, 0);
});

test('ajuste_costo deja el precio nuevo como el vigente de la presentación', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', unidad_compra: 'kg', factor_compra: 1000, costo_compra: 50, stock_inicial_compra: 1 });
  const r = svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste_costo', costo_compra: 90, nota: 'subió' }, ACTOR);
  assert.equal(r.insumo.costo_compra, 90, 'la próxima entrada ya viene con $90 el kilo');
  near(r.insumo.costo_unitario, 0.09);
});

test('ajuste_costo con presentación rara: botella de 1.2 L a $30', () => {
  const i = svc.createInsumo({ nombre: 'Leche', unidad_base: 'ml', unidad_compra: 'Botella 1.2 L', factor_compra: 1200, costo_compra: 28, stock_inicial_compra: 3 });
  const r = svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste_costo', costo_compra: 30, nota: 'subió la leche' }, ACTOR);
  near(r.insumo.costo_unitario, 0.025, '30 / 1200 por mililitro, sin que nadie divida a mano');
  assert.equal(r.insumo.stock, 3600, 'la existencia no se movió');
});

test('ajuste_costo con insumo suelto: el precio es el de una pieza', () => {
  const i = svc.createInsumo({ nombre: 'Vaso', unidad_base: 'pieza', factor_compra: 1, costo_compra: 1.5, stock_inicial_compra: 100 });
  const r = svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste_costo', costo_compra: 1.8, nota: 'subió el vaso' }, ACTOR);
  near(r.insumo.costo_unitario, 1.8);
});

test('ajuste_costo deja renglón en el libro de movimientos con el costo nuevo', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 10 });
  svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste_costo', costo_compra: 3, nota: 'subió el mango' }, ACTOR);
  const m = svc.listMovimientos({ insumoId: i.id })[0];
  assert.equal(m.tipo, 'ajuste_costo');
  assert.equal(m.cantidad_base, 0);
  near(m.costo_unitario, 3, 'costo del renglón');
  near(m.cantidad_captura, 3, 'guarda el precio tal como se capturó');
  assert.equal(m.stock_resultante, 10);
  assert.match(m.motivo, /Corrección de costo: subió el mango/);
});

test('ajuste_costo exige un costo mayor a 0', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 1 });
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste_costo', costo_compra: 0, nota: 'x' }, ACTOR), /mayor a 0/i);
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste_costo', nota: 'x' }, ACTOR), /mayor a 0/i);
});

test('ajuste_costo exige motivo', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 1 });
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste_costo', costo_compra: 2, nota: '  ' }, ACTOR), /motivo/i);
});

test('tipo de movimiento no válido lanza error', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  assert.throws(() => svc.registrarMovimiento({ insumoId: i.id, tipo: 'robo', cantidad: 1 }, ACTOR), /no válido/i);
});

test('movimiento sobre un insumo inexistente lanza error', () => {
  assert.throws(() => svc.registrarMovimiento({ insumoId: 999, tipo: 'entrada', cantidad: 1 }, ACTOR), /no existe/i);
});

test('listMovimientos ordena del más reciente al más viejo', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 100 });
  svc.registrarMovimiento({ insumoId: i.id, tipo: 'merma', cantidad: 5, motivo: 'derrame' }, ACTOR);
  svc.registrarMovimiento({ insumoId: i.id, tipo: 'ajuste', conteo: 90 }, ACTOR);
  const movs = svc.listMovimientos({ insumoId: i.id });
  assert.equal(movs[0].tipo, 'ajuste');
  assert.equal(movs[movs.length - 1].tipo, 'entrada');
});

// ---------------- baja lógica ----------------
test('deactivate / activate cambian is_active', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  assert.equal(svc.deactivateInsumo(i.id).is_active, 0);
  assert.equal(svc.activateInsumo(i.id).is_active, 1);
});

// ---------------- alertas y opciones ----------------
test('countBajoStock cuenta los insumos activos en o por debajo del mínimo', () => {
  svc.createInsumo({ nombre: 'Bajo', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 5, stock_minimo: 100 });
  svc.createInsumo({ nombre: 'Ok', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 500, stock_minimo: 100 });
  assert.equal(svc.countBajoStock(), 1);
});

test('un insumo dado de baja no cuenta como bajo stock', () => {
  const i = svc.createInsumo({ nombre: 'Bajo', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 1, stock_minimo: 100 });
  assert.equal(svc.countBajoStock(), 1);
  svc.deactivateInsumo(i.id);
  assert.equal(svc.countBajoStock(), 0);
});

test('listInsumoOptions solo trae insumos activos', () => {
  const a = svc.createInsumo({ nombre: 'Activo', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  const b = svc.createInsumo({ nombre: 'Baja', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  svc.deactivateInsumo(b.id);
  const ids = svc.listInsumoOptions().map((x) => x.id);
  assert.ok(ids.includes(a.id) && !ids.includes(b.id));
});

// ---------------- listInsumos: paginación y filtros ----------------
test('pagina de 15 por defecto', () => {
  for (let i = 0; i < 18; i++) svc.createInsumo({ nombre: `Ins ${i}`, unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  const r = svc.listInsumos();
  assert.equal(r.total, 18);
  assert.equal(r.rows.length, 15);
  assert.equal(r.totalPages, 2);
});

test('filtra por categoría', () => {
  const cat = crearCategoria('Café', 'g');
  svc.createInsumo({ nombre: 'Grano', unidad_base: 'g', categoria_id: cat.id, factor_compra: 1, costo_compra: 1 });
  svc.createInsumo({ nombre: 'Otro', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  const r = svc.listInsumos({ categoriaId: cat.id });
  assert.equal(r.total, 1);
  assert.equal(r.rows[0].nombre, 'Grano');
});

test('filtra por nombre', () => {
  svc.createInsumo({ nombre: 'Leche entera', unidad_base: 'ml', factor_compra: 1, costo_compra: 1 });
  svc.createInsumo({ nombre: 'Café', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  assert.equal(svc.listInsumos({ search: 'lech' }).total, 1);
});

test('filtra "solo por acabarse"', () => {
  svc.createInsumo({ nombre: 'Bajo', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 1, stock_minimo: 100 });
  svc.createInsumo({ nombre: 'Ok', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 500, stock_minimo: 100 });
  const r = svc.listInsumos({ soloBajoStock: true });
  assert.equal(r.total, 1);
  assert.equal(r.rows[0].nombre, 'Bajo');
});

test('includeInactive controla si aparecen los dados de baja', () => {
  const b = svc.createInsumo({ nombre: 'Baja', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  svc.createInsumo({ nombre: 'Activo', unidad_base: 'g', factor_compra: 1, costo_compra: 1 });
  svc.deactivateInsumo(b.id);
  assert.equal(svc.listInsumos({ includeInactive: false }).total, 1);
  assert.equal(svc.listInsumos({ includeInactive: true }).total, 2);
});

test('orden por existencia y por costo, ascendente y descendente', () => {
  svc.createInsumo({ nombre: 'Caro poco', unidad_base: 'g', factor_compra: 1, costo_compra: 10, stock_inicial_compra: 1 });
  svc.createInsumo({ nombre: 'Barato mucho', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 100 });
  assert.equal(svc.listInsumos({ sort: 'stock_asc' }).rows[0].nombre, 'Caro poco');
  assert.equal(svc.listInsumos({ sort: 'stock_desc' }).rows[0].nombre, 'Barato mucho');
  assert.equal(svc.listInsumos({ sort: 'costo_asc' }).rows[0].nombre, 'Barato mucho');
  assert.equal(svc.listInsumos({ sort: 'costo_desc' }).rows[0].nombre, 'Caro poco');
});

test('la fila del listado marca bajo_stock', () => {
  const i = svc.createInsumo({ nombre: 'X', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 1, stock_minimo: 50 });
  const fila = svc.listInsumos().rows.find((x) => x.id === i.id);
  assert.ok(fila.bajo_stock);
});
