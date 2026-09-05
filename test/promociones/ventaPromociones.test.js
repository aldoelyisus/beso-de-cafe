'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTOR, crearProducto, crearProductoCategoria, abrirCaja } = require('../helpers/setup');
const ventaSvc = require('../../src/main/services/ventaService');
const promoSvc = require('../../src/main/services/promocionService');

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m || 'valor'}: ${a} ≈ ${b}`);
const HOY = promoSvc.hoyISO();
const VIG = { fecha_inicio: HOY, fecha_fin: '2040-12-31' };

function frappeCat() {
  const cat = crearProductoCategoria('Frappés');
  const p = crearProducto({ nombre: 'Frappé Oreo', categoria_id: cat.id, precio: 70 });
  return { cat, p, presId: p.presentaciones[0].id };
}

function abrirConItems(presId, cantidad) {
  let v = ventaSvc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad }, ACTOR);
  return v;
}

// ================= listPromocionesAplicables =================
test('solo lista las promos vigentes que además cumple la cuenta', () => {
  const { cat, presId } = frappeCat();
  const monto = promoSvc.createPromocion({ nombre: '$20 off', tipo: 'monto_fijo', ambito: 'cuenta', valor: 20, ...VIG });
  const combo = promoSvc.createPromocion({ nombre: '2 Frappés $120', tipo: 'combo', ambito: 'categoria', categoria_id: cat.id, cantidad_requerida: 2, valor_tipo: 'fijo', valor: 120, ...VIG });
  promoSvc.createPromocion({ nombre: 'Vieja', tipo: 'monto_fijo', ambito: 'cuenta', valor: 5, fecha_inicio: '2000-01-01', fecha_fin: '2000-12-31' });

  const v1 = abrirConItems(presId, 1);
  let ap = ventaSvc.listPromocionesAplicables(v1.id).map((x) => x.id);
  assert.ok(ap.includes(monto.id));
  assert.ok(!ap.includes(combo.id), 'el combo no aplica con 1 frappé');

  const v2 = abrirConItems(presId, 2);
  ap = ventaSvc.listPromocionesAplicables(v2.id).map((x) => x.id);
  assert.ok(ap.includes(combo.id), 'el combo aplica con 2');
});

// ================= aplicarPromocion / quitarPromocion =================
test('aplicar una promo baja el total_final y guarda el descuento', () => {
  const { presId } = frappeCat();
  const monto = promoSvc.createPromocion({ nombre: '$20 off', tipo: 'monto_fijo', ambito: 'cuenta', valor: 20, ...VIG });
  const v = abrirConItems(presId, 1);
  const r = ventaSvc.aplicarPromocion(v.id, monto.id, ACTOR);
  near(r.descuento, 20, 'descuento');
  near(r.total_final, 70 - 20, 'total final');
  assert.equal(r.promocion_nombre, '$20 off');
  assert.equal(r.promocion_aplica, true);
});

test('no se aplica una promo que la cuenta no cumple', () => {
  const { cat, presId } = frappeCat();
  const combo = promoSvc.createPromocion({ nombre: '2 Frappés', tipo: 'combo', ambito: 'categoria', categoria_id: cat.id, cantidad_requerida: 2, valor_tipo: 'fijo', valor: 120, ...VIG });
  const v = abrirConItems(presId, 1);
  assert.throws(() => ventaSvc.aplicarPromocion(v.id, combo.id, ACTOR), /no cumple/i);
});

test('no se aplica una promo fuera de vigencia', () => {
  const { presId } = frappeCat();
  const vieja = promoSvc.createPromocion({ nombre: 'Vieja', tipo: 'monto_fijo', ambito: 'cuenta', valor: 10, fecha_inicio: '2000-01-01', fecha_fin: '2000-12-31' });
  const v = abrirConItems(presId, 1);
  assert.throws(() => ventaSvc.aplicarPromocion(v.id, vieja.id, ACTOR), /no está vigente/i);
});

test('quitar la promo regresa el total a normal', () => {
  const { presId } = frappeCat();
  const monto = promoSvc.createPromocion({ nombre: '$20 off', tipo: 'monto_fijo', ambito: 'cuenta', valor: 20, ...VIG });
  let v = abrirConItems(presId, 1);
  v = ventaSvc.aplicarPromocion(v.id, monto.id, ACTOR);
  v = ventaSvc.quitarPromocion(v.id);
  assert.equal(v.descuento, 0);
  assert.equal(v.promocion_id, null);
  near(v.total_final, 70, 'total final = total');
});

// ================= recálculo al cambiar los items =================
test('el descuento se recalcula al agregar / cancelar productos', () => {
  const { cat, presId } = frappeCat();
  const combo = promoSvc.createPromocion({ nombre: '2 Frappés $120', tipo: 'combo', ambito: 'categoria', categoria_id: cat.id, cantidad_requerida: 2, valor_tipo: 'fijo', valor: 120, ...VIG });
  let v = abrirConItems(presId, 2);
  v = ventaSvc.aplicarPromocion(v.id, combo.id, ACTOR);
  near(v.descuento, 2 * 70 - 120, 'descuento del combo');

  // cancelar un frappé -> el combo deja de aplicar
  const item = v.items.find((i) => i.estado === 'activo').id;
  v = ventaSvc.cancelarItem(v.id, item, 'x', ACTOR);
  assert.equal(v.descuento, 0);
  assert.equal(v.promocion_aplica, false, 'la venta marca que la promo ya no aplica');

  // volver a agregar -> vuelve a aplicar
  v = ventaSvc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  near(v.descuento, 2 * 70 - 120, 'el combo vuelve a aplicar');
});

// ================= cobro con descuento =================
test('cobrar todo aplica el total con descuento', () => {
  abrirCaja();
  const { presId } = frappeCat();
  const monto = promoSvc.createPromocion({ nombre: '$20 off', tipo: 'monto_fijo', ambito: 'cuenta', valor: 20, ...VIG });
  let v = abrirConItems(presId, 1);
  v = ventaSvc.aplicarPromocion(v.id, monto.id, ACTOR);
  v = ventaSvc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);
  assert.equal(v.estado, 'pagada');
  near(v.pagos[0].monto, 50, 'se cobró 70 − 20');
});

test('cobro dividido: el descuento se absorbe en los primeros pagos', () => {
  abrirCaja();
  const { presId } = frappeCat();
  const monto = promoSvc.createPromocion({ nombre: '$20 off', tipo: 'monto_fijo', ambito: 'cuenta', valor: 20, ...VIG });
  let v = abrirConItems(presId, 2); // 140, final 120
  v = ventaSvc.aplicarPromocion(v.id, monto.id, ACTOR);
  const items = v.items.filter((i) => i.estado === 'activo');
  v = ventaSvc.cobrar(v.id, { itemIds: [items[0].id], metodo: 'efectivo' }, ACTOR);
  near(v.pagos[0].monto, 50, 'primer pago absorbe los 20 (70 − 20)');
  assert.equal(v.estado, 'abierta');
  v = ventaSvc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'transferencia' }, ACTOR);
  near(v.pagos[1].monto, 70, 'segundo pago sin descuento');
  assert.equal(v.estado, 'pagada');
  near(v.pagos.reduce((s, p) => s + p.monto, 0), 120, 'total cobrado = total con descuento');
});

test('no se puede cambiar la promo si la cuenta ya tiene pagos', () => {
  abrirCaja();
  const { presId } = frappeCat();
  const a = promoSvc.createPromocion({ nombre: 'A', tipo: 'monto_fijo', ambito: 'cuenta', valor: 10, ...VIG });
  let v = abrirConItems(presId, 2);
  v = ventaSvc.aplicarPromocion(v.id, a.id, ACTOR);
  ventaSvc.cobrar(v.id, { itemIds: [v.items[0].id], metodo: 'efectivo' }, ACTOR);
  assert.throws(() => ventaSvc.quitarPromocion(v.id), /pagos/i);
  assert.throws(() => ventaSvc.aplicarPromocion(v.id, a.id, ACTOR), /pagos/i);
});
