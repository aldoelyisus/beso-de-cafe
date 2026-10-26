'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { crearProductoCategoria, crearProducto } = require('../helpers/setup');
const svc = require('../../src/main/services/promocionService');

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m || 'valor'}: ${a} ≈ ${b}`);
const HOY = svc.hoyISO();
const DOW = new Date(HOY + 'T12:00:00').getDay();
const VIG = { fecha_inicio: HOY, fecha_fin: '2040-12-31' };
const item = (producto_id, categoria_id, total) => ({ producto_id, categoria_id, total });

// ================= validaciones al crear =================
test('rechaza sin fecha de inicio / fin', () => {
  assert.throws(() => svc.createPromocion({ nombre: 'x', tipo: 'monto_fijo', ambito: 'cuenta', valor: 10 }), /fecha de inicio y fin/i);
});

test('rechaza fecha fin anterior a inicio', () => {
  assert.throws(() => svc.createPromocion({ nombre: 'x', tipo: 'monto_fijo', ambito: 'cuenta', valor: 10, fecha_inicio: '2030-05-01', fecha_fin: '2030-04-01' }), /antes de la de inicio/i);
});

test('rechaza tipo no válido', () => {
  assert.throws(() => svc.createPromocion({ nombre: 'x', tipo: 'gratis', ambito: 'cuenta', valor: 10, ...VIG }), /tipo de promoción/i);
});

test('rechaza ámbito no permitido para el tipo', () => {
  // monto_fijo no admite 'categoria'
  assert.throws(() => svc.createPromocion({ nombre: 'x', tipo: 'monto_fijo', ambito: 'categoria', valor: 10, ...VIG }), /alcance/i);
});

test('combo por categoría exige categoría y cantidad >= 2', () => {
  const cat = crearProductoCategoria('Frappés');
  assert.throws(() => svc.createPromocion({ nombre: 'x', tipo: 'combo', ambito: 'categoria', valor_tipo: 'fijo', valor: 100, cantidad_requerida: 1, categoria_id: cat.id, ...VIG }), /al menos 2 productos/i);
  assert.throws(() => svc.createPromocion({ nombre: 'x', tipo: 'combo', ambito: 'categoria', valor_tipo: 'fijo', valor: 100, cantidad_requerida: 2, ...VIG }), /elige la categoría/i);
});

test('promo de día exige día de la semana y porcentaje 1-100', () => {
  const cat = crearProductoCategoria('Postres');
  assert.throws(() => svc.createPromocion({ nombre: 'x', tipo: 'dia', ambito: 'categoria', categoria_id: cat.id, valor: 10, ...VIG }), /día de la semana/i);
  assert.throws(() => svc.createPromocion({ nombre: 'x', tipo: 'dia', ambito: 'categoria', categoria_id: cat.id, dia_semana: 2, valor: 150, ...VIG }), /entre 1 y 100/i);
});

test('ámbito "productos" exige al menos un producto', () => {
  assert.throws(() => svc.createPromocion({ nombre: 'x', tipo: 'monto_fijo', ambito: 'productos', valor: 10, productoIds: [], ...VIG }), /al menos un producto/i);
});

// ================= CRUD =================
test('crea y devuelve una promoción de monto fijo a la cuenta', () => {
  const p = svc.createPromocion({ nombre: '$20 off', tipo: 'monto_fijo', ambito: 'cuenta', valor: 20, ...VIG });
  assert.equal(p.tipo, 'monto_fijo');
  assert.equal(p.valor_tipo, 'monto');
  assert.equal(p.is_active, 1);
});

test('editar cambia los datos y los productos', () => {
  const a = crearProducto({ nombre: 'A', precio: 10 });
  const b = crearProducto({ nombre: 'B', precio: 20 });
  const p = svc.createPromocion({ nombre: 'combo', tipo: 'combo', ambito: 'productos', valor_tipo: 'porcentaje', valor: 10, productoIds: [a.id], ...VIG });
  const u = svc.updatePromocion(p.id, { valor: 25, productoIds: [a.id, b.id] });
  assert.equal(u.valor, 25);
  assert.equal(u.productos.length, 2);
});

test('setActive activa / desactiva', () => {
  const p = svc.createPromocion({ nombre: 'x', tipo: 'monto_fijo', ambito: 'cuenta', valor: 5, ...VIG });
  assert.equal(svc.setActive(p.id, false).is_active, 0);
  assert.equal(svc.setActive(p.id, true).is_active, 1);
});

test('listado pagina y marca "vigente"', () => {
  svc.createPromocion({ nombre: 'Vigente', tipo: 'monto_fijo', ambito: 'cuenta', valor: 5, fecha_inicio: HOY, fecha_fin: '2040-01-01' });
  svc.createPromocion({ nombre: 'Vieja', tipo: 'monto_fijo', ambito: 'cuenta', valor: 5, fecha_inicio: '2000-01-01', fecha_fin: '2000-12-31' });
  const r = svc.listPromociones({ pageSize: 50 });
  assert.equal(r.total, 2);
  assert.equal(r.rows.find((x) => x.nombre === 'Vigente').vigente, true);
  assert.equal(r.rows.find((x) => x.nombre === 'Vieja').vigente, false);
});

test('filtra el listado por tipo', () => {
  svc.createPromocion({ nombre: 'A', tipo: 'monto_fijo', ambito: 'cuenta', valor: 5, ...VIG });
  const cat = crearProductoCategoria('Cafés');
  svc.createPromocion({ nombre: 'B', tipo: 'dia', ambito: 'categoria', categoria_id: cat.id, dia_semana: 1, valor: 10, ...VIG });
  assert.equal(svc.listPromociones({ tipo: 'dia', pageSize: 50 }).total, 1);
});

// ================= vigenteHoy =================
test('vigenteHoy respeta fechas, is_active y el día de la semana', () => {
  const cat = crearProductoCategoria('Postres');
  const activa = svc.createPromocion({ nombre: 'A', tipo: 'monto_fijo', ambito: 'cuenta', valor: 5, ...VIG });
  assert.equal(svc.vigenteHoy(svc.getPromocion(activa.id)), true);

  const inactiva = svc.setActive(activa.id, false);
  assert.equal(svc.vigenteHoy(svc.getPromocion(activa.id)), false);

  const diaHoy = svc.createPromocion({ nombre: 'Hoy', tipo: 'dia', ambito: 'categoria', categoria_id: cat.id, dia_semana: DOW, valor: 10, ...VIG });
  const diaOtro = svc.createPromocion({ nombre: 'Otro', tipo: 'dia', ambito: 'categoria', categoria_id: cat.id, dia_semana: (DOW + 3) % 7, valor: 10, ...VIG });
  assert.equal(svc.vigenteHoy(svc.getPromocion(diaHoy.id)), true);
  assert.equal(svc.vigenteHoy(svc.getPromocion(diaOtro.id)), false);
});

// ================= calcular() =================
test('combo por categoría, precio fijo: descuenta la diferencia de los N más caros', () => {
  const cat = crearProductoCategoria('Frappés');
  const p = svc.getPromocion(svc.createPromocion({
    nombre: '2 Frappés $120', tipo: 'combo', ambito: 'categoria', categoria_id: cat.id,
    cantidad_requerida: 2, valor_tipo: 'fijo', valor: 120, ...VIG,
  }).id);
  // 1 frappé -> no aplica
  assert.equal(svc.calcular(p, [item(1, cat.id, 70)]).aplica, false);
  // 3 frappés (70, 85, 60) -> toma los 2 más caros (85 + 70 = 155) - 120 = 35
  const r = svc.calcular(p, [item(1, cat.id, 70), item(2, cat.id, 85), item(3, cat.id, 60)]);
  assert.equal(r.aplica, true);
  near(r.descuento, 35, '155 − 120');
});

test('combo por categoría, porcentaje', () => {
  const cat = crearProductoCategoria('Frappés');
  const p = svc.getPromocion(svc.createPromocion({
    nombre: '2 Frappés 10%', tipo: 'combo', ambito: 'categoria', categoria_id: cat.id,
    cantidad_requerida: 2, valor_tipo: 'porcentaje', valor: 10, ...VIG,
  }).id);
  const r = svc.calcular(p, [item(1, cat.id, 70), item(2, cat.id, 80)]);
  near(r.descuento, 15, '(70 + 80) × 10%');
});

test('combo de productos específicos (distintas categorías), porcentaje', () => {
  const frap = crearProducto({ nombre: 'Frappé', precio: 85 });
  const pay = crearProducto({ nombre: 'Pay', precio: 55 });
  const p = svc.getPromocion(svc.createPromocion({
    nombre: 'Frappé + Pay 15%', tipo: 'combo', ambito: 'productos',
    productoIds: [frap.id, pay.id], valor_tipo: 'porcentaje', valor: 15, ...VIG,
  }).id);
  // solo frappé -> no aplica
  assert.equal(svc.calcular(p, [item(frap.id, 1, 85)]).aplica, false);
  const r = svc.calcular(p, [item(frap.id, 1, 85), item(pay.id, 2, 55)]);
  near(r.descuento, (85 + 55) * 0.15, '15% de la suma');
});

test('combo de productos, precio fijo mayor que la suma -> no aplica', () => {
  const a = crearProducto({ nombre: 'A', precio: 30 });
  const b = crearProducto({ nombre: 'B', precio: 30 });
  const p = svc.getPromocion(svc.createPromocion({
    nombre: 'combo', tipo: 'combo', ambito: 'productos', productoIds: [a.id, b.id],
    valor_tipo: 'fijo', valor: 100, ...VIG,
  }).id);
  assert.equal(svc.calcular(p, [item(a.id, 1, 30), item(b.id, 2, 30)]).aplica, false);
});

test('descuento por día sobre una categoría', () => {
  const cat = crearProductoCategoria('Postres');
  const p = svc.getPromocion(svc.createPromocion({
    nombre: 'Martes 10% Postres', tipo: 'dia', ambito: 'categoria', categoria_id: cat.id,
    dia_semana: DOW, valor: 10, ...VIG,
  }).id);
  const r = svc.calcular(p, [item(1, cat.id, 70), item(2, cat.id, 30), item(3, 99, 50)]);
  near(r.descuento, (70 + 30) * 0.10, '10% solo de los de la categoría');
});

test('monto fijo a la cuenta (topado al total)', () => {
  const p = svc.getPromocion(svc.createPromocion({ nombre: '$50 off', tipo: 'monto_fijo', ambito: 'cuenta', valor: 50, ...VIG }).id);
  near(svc.calcular(p, [item(1, 1, 120)]).descuento, 50, 'resta 50');
  near(svc.calcular(p, [item(1, 1, 30)]).descuento, 30, 'no pasa del total');
});

test('monto fijo a ciertos productos: aplica solo si hay uno en la cuenta', () => {
  const especial = crearProducto({ nombre: 'Especial', precio: 90 });
  const p = svc.getPromocion(svc.createPromocion({
    nombre: '-$15 al Especial', tipo: 'monto_fijo', ambito: 'productos', productoIds: [especial.id], valor: 15, ...VIG,
  }).id);
  assert.equal(svc.calcular(p, [item(999, 1, 40)]).aplica, false);
  near(svc.calcular(p, [item(especial.id, 1, 90)]).descuento, 15, 'resta 15');
});

// ============== combos de cosas distintas ==============
/**
 * Lo que reporto el dueno: armo "Pastel + cafe" marcando los pasteles y los
 * cafes como "ciertos productos", y al vender decia que no aplicaba. Con ese
 * ambito el combo pide que esten TODOS los marcados en la misma venta, asi que
 * pedia los seis juntos. Y por categoria tampoco se podia: una promocion por
 * categoria solo mira una.
 *
 * Ahora hay dos formas mas: "cualquiera N de una lista" y "uno de cada grupo".
 */
function cafeteria() {
  const postres = crearProductoCategoria('Postres');
  const cafes = crearProductoCategoria('Cafés');
  const pastel = crearProducto({ nombre: 'Pastel chocolate', precio: 65, categoria_id: postres.id });
  const cheese = crearProducto({ nombre: 'Cheesecake', precio: 70, categoria_id: postres.id });
  const americano = crearProducto({ nombre: 'Americano', precio: 40, categoria_id: cafes.id });
  const latte = crearProducto({ nombre: 'Latte', precio: 50, categoria_id: cafes.id });
  return { postres, cafes, pastel, cheese, americano, latte };
}
const it = (p) => item(p.id, p.categoria_id, p.precio_base != null ? p.precio_base : p.presentaciones[0].precio_actual);

test('combo de dos grupos: un postre y un café, por categoría', () => {
  const c = cafeteria();
  const promo = svc.getPromocion(svc.createPromocion({
    nombre: 'Pastel + café', tipo: 'combo', ambito: 'dos_grupos',
    grupo1_tipo: 'categoria', categoria_id: c.postres.id,
    grupo2_tipo: 'categoria', grupo2_categoria_id: c.cafes.id,
    valor_tipo: 'porcentaje', valor: 15, ...VIG,
  }).id);

  const r = svc.calcular(promo, [it(c.pastel), it(c.americano)]);
  assert.ok(r.aplica, 'un pastel y un café: aplica');
  near(r.descuento, (65 + 40) * 0.15, '15% sobre los dos');
});

test('combo de dos grupos: dos del mismo lado NO alcanzan', () => {
  const c = cafeteria();
  const promo = svc.getPromocion(svc.createPromocion({
    nombre: 'Pastel + café', tipo: 'combo', ambito: 'dos_grupos',
    grupo1_tipo: 'categoria', categoria_id: c.postres.id,
    grupo2_tipo: 'categoria', grupo2_categoria_id: c.cafes.id,
    valor_tipo: 'porcentaje', valor: 15, ...VIG,
  }).id);

  assert.equal(svc.calcular(promo, [it(c.pastel), it(c.cheese)]).aplica, false, 'dos postres no son el combo');
  assert.equal(svc.calcular(promo, [it(c.americano), it(c.latte)]).aplica, false, 'dos cafés tampoco');
  assert.equal(svc.calcular(promo, [it(c.pastel)]).aplica, false, 'un postre solo tampoco');
});

test('combo de dos grupos: toma los más caros de cada lado', () => {
  const c = cafeteria();
  const promo = svc.getPromocion(svc.createPromocion({
    nombre: 'Postre + café', tipo: 'combo', ambito: 'dos_grupos',
    grupo1_tipo: 'categoria', categoria_id: c.postres.id,
    grupo2_tipo: 'categoria', grupo2_categoria_id: c.cafes.id,
    valor_tipo: 'porcentaje', valor: 10, ...VIG,
  }).id);

  // Se lleva los cuatro: el descuento sale sobre el postre y el café más caros.
  const r = svc.calcular(promo, [it(c.pastel), it(c.cheese), it(c.americano), it(c.latte)]);
  near(r.descuento, (70 + 50) * 0.10, 'cheesecake 70 + latte 50');
});

test('combo de dos grupos con listas de productos, no categorías', () => {
  const c = cafeteria();
  const promo = svc.getPromocion(svc.createPromocion({
    nombre: 'Cheesecake + Latte', tipo: 'combo', ambito: 'dos_grupos',
    grupo1_tipo: 'productos', productoIds: [c.cheese.id],
    grupo2_tipo: 'productos', productoIds2: [c.latte.id],
    valor_tipo: 'fijo', valor: 100, ...VIG,
  }).id);

  const r = svc.calcular(promo, [it(c.cheese), it(c.latte)]);
  assert.ok(r.aplica);
  near(r.descuento, 70 + 50 - 100, 'de $120 a $100');
  assert.equal(svc.calcular(promo, [it(c.cheese), it(c.americano)]).aplica, false, 'el café debe ser el latte');
});

test('combo "cualquiera de estos": 2 de una lista, sin importar cuáles', () => {
  const c = cafeteria();
  const promo = svc.getPromocion(svc.createPromocion({
    nombre: '2 de la barra', tipo: 'combo', ambito: 'lista',
    productoIds: [c.pastel.id, c.cheese.id, c.americano.id, c.latte.id],
    cantidad_requerida: 2, valor_tipo: 'porcentaje', valor: 20, ...VIG,
  }).id);

  assert.ok(svc.calcular(promo, [it(c.pastel), it(c.americano)]).aplica, 'uno de cada: aplica');
  assert.ok(svc.calcular(promo, [it(c.pastel), it(c.cheese)]).aplica, 'dos postres también: es una lista suelta');
  assert.equal(svc.calcular(promo, [it(c.pastel)]).aplica, false, 'uno solo no');
  near(svc.calcular(promo, [it(c.cheese), it(c.latte)]).descuento, (70 + 50) * 0.20);
});

test('el combo exacto de siempre sigue pidiendo TODOS los productos', () => {
  const c = cafeteria();
  const promo = svc.getPromocion(svc.createPromocion({
    nombre: 'Cheesecake + Latte exacto', tipo: 'combo', ambito: 'productos',
    productoIds: [c.cheese.id, c.latte.id],
    valor_tipo: 'fijo', valor: 100, ...VIG,
  }).id);

  assert.ok(svc.calcular(promo, [it(c.cheese), it(c.latte)]).aplica);
  assert.equal(svc.calcular(promo, [it(c.cheese)]).aplica, false, 'falta el latte');
});

test('avisa al guardar si la promoción nunca podría aplicar', () => {
  const c = cafeteria();
  assert.throws(() => svc.createPromocion({
    nombre: 'imposible', tipo: 'combo', ambito: 'lista',
    productoIds: [c.pastel.id], cantidad_requerida: 3,
    valor_tipo: 'porcentaje', valor: 10, ...VIG,
  }), /nunca podr\u00eda aplicar/i);
});

test('no deja hacer dos grupos de la misma categoría', () => {
  const c = cafeteria();
  assert.throws(() => svc.createPromocion({
    nombre: 'raro', tipo: 'combo', ambito: 'dos_grupos',
    grupo1_tipo: 'categoria', categoria_id: c.postres.id,
    grupo2_tipo: 'categoria', grupo2_categoria_id: c.postres.id,
    valor_tipo: 'porcentaje', valor: 10, ...VIG,
  }), /misma categor\u00eda/i);
});

test('pide los productos que falten de cada grupo', () => {
  const c = cafeteria();
  assert.throws(() => svc.createPromocion({
    nombre: 'sin lado 2', tipo: 'combo', ambito: 'dos_grupos',
    grupo1_tipo: 'categoria', categoria_id: c.postres.id,
    grupo2_tipo: 'productos', productoIds2: [],
    valor_tipo: 'porcentaje', valor: 10, ...VIG,
  }), /productos del segundo grupo/i);
});

test('los dos grupos se guardan y se releen por separado', () => {
  const c = cafeteria();
  const p = svc.createPromocion({
    nombre: 'Postre + café elegido', tipo: 'combo', ambito: 'dos_grupos',
    grupo1_tipo: 'productos', productoIds: [c.pastel.id, c.cheese.id],
    grupo2_tipo: 'productos', productoIds2: [c.latte.id],
    valor_tipo: 'fijo', valor: 90, ...VIG,
  });
  const leida = svc.getPromocion(p.id);
  const g1 = leida.productos.filter((x) => x.grupo === 1).map((x) => x.nombre).sort();
  const g2 = leida.productos.filter((x) => x.grupo === 2).map((x) => x.nombre);
  assert.deepEqual(g1, ['Cheesecake', 'Pastel chocolate']);
  assert.deepEqual(g2, ['Latte']);
});
