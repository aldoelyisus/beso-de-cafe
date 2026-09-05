'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTOR, crearInsumo, crearProducto, crearProductoCategoria, abrirCaja } = require('../helpers/setup');
const svc = require('../../src/main/services/ventaService');
const mesaSvc = require('../../src/main/services/mesaService');
const insumoSvc = require('../../src/main/services/insumoService');
const productoSvc = require('../../src/main/services/productoService');

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m || 'valor'}: ${a} ≈ ${b}`);
const stock = (id) => insumoSvc.getInsumo(id).stock;

/** Producto "Frappé" $70 con receta: base 40g siempre, leche 100ml siempre, vaso 1pza para llevar. */
function frappe() {
  const base = crearInsumo({ nombre: 'Base', unidad_base: 'g', factor_compra: 1000, costo_compra: 120, stock_inicial_compra: 10 }); // 0.12/g
  const leche = crearInsumo({ nombre: 'Leche', unidad_base: 'ml', factor_compra: 1000, costo_compra: 25, stock_inicial_compra: 10 }); // 0.025/ml
  const vaso = crearInsumo({ nombre: 'Vaso', unidad_base: 'pieza', factor_compra: 1, costo_compra: 1.5, stock_inicial_compra: 100 });
  const p = crearProducto({ nombre: 'Frappé', precio: 70 }, {
    items: [
      { insumo_id: base.id, cantidad_base: 40, modo: 'siempre' },
      { insumo_id: leche.id, cantidad_base: 100, modo: 'siempre' },
      { insumo_id: vaso.id, cantidad_base: 1, modo: 'llevar' },
    ],
  });
  return { p, presId: p.presentaciones[0].id, base, leche, vaso };
}

// ================= abrirVenta =================
test('cuenta unificada: reabrir la misma mesa devuelve la misma cuenta', () => {
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const a = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  const b = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  assert.equal(a.id, b.id);
  assert.equal(a.estado, 'abierta');
});

test('cada pedido para llevar es una cuenta nueva', () => {
  const a = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  const b = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  assert.notEqual(a.id, b.id);
  assert.equal(a.mesa_id, null);
});

test('abrir en mesa requiere mesaId y que la mesa exista y esté activa', () => {
  assert.throws(() => svc.abrirVenta({ tipo: 'mesa' }, ACTOR), /elige una mesa/i);
  assert.throws(() => svc.abrirVenta({ tipo: 'mesa', mesaId: 999 }, ACTOR), /no existe/i);
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  mesaSvc.deactivateMesa(m.id);
  assert.throws(() => svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR), /baja/i);
});

// ================= agregarItem + inventario =================
test('agregar 2 unidades crea 2 renglones y descuenta inventario', () => {
  const { presId, base, leche, vaso } = frappe();
  const b0 = stock(base.id), l0 = stock(leche.id), va0 = stock(vaso.id);
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 2, paraLlevar: true }, ACTOR);
  assert.equal(v.items.filter((i) => i.estado === 'activo').length, 2);
  near(v.total, 2 * 70, 'total = 2 × precio');
  near(stock(base.id), b0 - 80, 'base: -40 × 2');
  near(stock(leche.id), l0 - 200, 'leche: -100 × 2');
  near(stock(vaso.id), va0 - 2, 'vaso: -1 × 2 (para llevar)');
});

test('servir "aquí" no consume el vaso', () => {
  const { presId, vaso } = frappe();
  const va0 = stock(vaso.id);
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1, paraLlevar: false }, ACTOR);
  assert.equal(stock(vaso.id), va0);
});

test('el renglón guarda el precio del momento (no cambia si luego suben el precio)', () => {
  const { p, presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  productoSvc.cambiarPrecio(presId, 999, ACTOR);
  v = svc.getVenta(v.id);
  assert.equal(v.items[0].precio_unitario, 70);
});

test('un modificador suma al total y consume su insumo', () => {
  const { presId, p } = frappe();
  const cafe = crearInsumo({ nombre: 'Café grano', unidad_base: 'g', factor_compra: 1000, costo_compra: 300, stock_inicial_compra: 5 }); // 0.30/g
  const modSvc = require('../../src/main/services/modificadorService');
  const shot = modSvc.createModificador({ nombre: 'Extra shot', precio_extra: 20 });
  modSvc.setItems(shot.id, [{ insumo_id: cafe.id, cantidad_base: 9 }]);
  productoSvc.setModificadores(p.id, [shot.id]);

  const c0 = stock(cafe.id);
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1, modificadorIds: [shot.id] }, ACTOR);
  near(v.total, 70 + 20, 'total incluye el extra');
  near(stock(cafe.id), c0 - 9, 'consume café del extra shot');
  assert.equal(v.items[0].modificadores[0].nombre, 'Extra shot');
});

test('grupo de opción: consume la opción elegida, no la predeterminada', () => {
  const entera = crearInsumo({ nombre: 'Leche entera', unidad_base: 'ml', factor_compra: 1000, costo_compra: 25, stock_inicial_compra: 10 });
  const deslac = crearInsumo({ nombre: 'Leche deslac', unidad_base: 'ml', factor_compra: 1000, costo_compra: 30, stock_inicial_compra: 10 });
  const p = crearProducto({ nombre: 'Latte', precio: 55 }, {
    items: [],
    grupos: [{ nombre: 'Leche', cantidad_base: 200, modo: 'siempre', opciones: [entera.id, deslac.id], insumo_default_id: entera.id }],
  });
  const grupoId = productoSvc.getProducto(p.id).presentaciones[0].grupos[0].id;
  const e0 = stock(entera.id), d0 = stock(deslac.id);
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: p.presentaciones[0].id, cantidad: 1, opciones: { [grupoId]: deslac.id } }, ACTOR);
  assert.equal(stock(entera.id), e0, 'no toca la entera');
  near(stock(deslac.id), d0 - 200, 'consume la deslactosada elegida');
  assert.equal(v.items[0].opciones[0].insumo_nombre, 'Leche deslac');
});

test('no se puede agregar a una cuenta cerrada', () => {
  abrirCaja();
  const { presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);
  assert.throws(() => svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR), /cerrada/i);
});

test('no se puede agregar un producto agotado o sin precio', () => {
  const { p, presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  productoSvc.setAgotado(p.id, true);
  assert.throws(() => svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR), /agotado/i);
});

// ================= cancelarItem =================
test('cancelar un producto de la cuenta abierta devuelve sus insumos', () => {
  const { presId, base } = frappe();
  const b0 = stock(base.id);
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 2 }, ACTOR);
  near(stock(base.id), b0 - 80, 'consumió 2');
  const item = v.items.find((i) => i.estado === 'activo').id;
  v = svc.cancelarItem(v.id, item, 'error', ACTOR);
  assert.equal(v.items.find((i) => i.id === item).estado, 'cancelado');
  near(stock(base.id), b0 - 40, 'regresó 1');
  near(v.total, 70, 'total baja');
});

test('no se cancela un producto ya pagado', () => {
  abrirCaja();
  const { presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);
  v = svc.getVenta(v.id);
  assert.throws(() => svc.cancelarItem(v.id, v.items[0].id, 'x', ACTOR), /cerrada|pagado/i);
});

// ================= cobrar =================
test('cobrar en efectivo requiere un turno de caja abierto; transferencia no', () => {
  const { presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  assert.throws(() => svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR), /turno de caja/i);
  const r = svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'transferencia' }, ACTOR);
  assert.equal(r.estado, 'pagada');
});

test('cobro parcial deja la cuenta abierta; el último pago la cierra', () => {
  abrirCaja();
  const { presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 2 }, ACTOR);
  const items = v.items.filter((i) => i.estado === 'activo');
  v = svc.cobrar(v.id, { itemIds: [items[0].id], metodo: 'efectivo', etiqueta: 'Comensal 1' }, ACTOR);
  assert.equal(v.estado, 'abierta');
  near(v.saldo, 70, 'queda pendiente el otro');
  assert.equal(v.pagos.length, 1);
  v = svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'transferencia' }, ACTOR);
  assert.equal(v.estado, 'pagada');
  assert.ok(v.closed_at);
  assert.equal(v.pagos.length, 2);
});

test('cobrar rechaza método inválido, sin items, o items ya pagados', () => {
  abrirCaja();
  const { presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  assert.throws(() => svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'tarjeta' }, ACTOR), /método/i);
  assert.throws(() => svc.cobrar(v.id, { itemIds: [], metodo: 'efectivo' }, ACTOR), /al menos un producto/i);
  svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);
  assert.throws(() => svc.cobrar(v.id, { itemIds: [1], metodo: 'efectivo' }, ACTOR), /cerrada/i);
});

test('no se cobra en un día cerrado', () => {
  abrirCaja();
  const cierreSvc = require('../../src/main/services/cierreService');
  const { presId } = frappe();
  // cerrar el día requiere sin cuentas abiertas ni turno abierto
  require('../../src/main/services/cajaService').cerrarCorte({ efectivo_contado: 0 }, ACTOR);
  cierreSvc.cerrarDia(cierreSvc.hoyISO(), ACTOR);
  const v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  assert.throws(() => svc.cobrar(v.id, { itemIds: svc.getVenta(v.id).items_sin_pagar, metodo: 'transferencia' }, ACTOR), /día de hoy ya está cerrado/i);
});

// ================= cancelarVenta =================
test('cancelar una cuenta abierta sin pagos: cancelada + insumos regresan', () => {
  const { presId, base } = frappe();
  const b0 = stock(base.id);
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 2 }, ACTOR);
  v = svc.cancelarVenta(v.id, 'cliente se fue', ACTOR);
  assert.equal(v.estado, 'cancelada');
  assert.equal(v.motivo_cancelacion, 'cliente se fue');
  near(stock(base.id), b0, 'todo el inventario regresó');
});

test('cancelar una venta YA PAGADA: cancelada, insumos regresan, aparece en historial', () => {
  abrirCaja();
  const { presId, base } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);
  const b1 = stock(base.id);
  v = svc.cancelarVenta(v.id, 'insatisfecho', ACTOR);
  assert.equal(v.estado, 'cancelada');
  near(stock(base.id), b1 + 40, 'los insumos de la venta pagada regresan');
  const h = svc.listHistorial({ estado: 'cancelada', pageSize: 50 });
  assert.ok(h.rows.some((r) => r.id === v.id));
});

test('no se cancela una cuenta abierta con pagos parciales', () => {
  abrirCaja();
  const { presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 2 }, ACTOR);
  svc.cobrar(v.id, { itemIds: [v.items[0].id], metodo: 'efectivo' }, ACTOR);
  assert.throws(() => svc.cancelarVenta(v.id, 'x', ACTOR), /pagos parciales/i);
});

// ================= listados =================
test('listVentasAbiertas solo trae las abiertas, con total y nº de productos', () => {
  abrirCaja();
  const { presId } = frappe();
  const abierta = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  svc.agregarItem(abierta.id, { presentacionId: presId, cantidad: 2 }, ACTOR);
  const pagada = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  const p2 = svc.agregarItem(pagada.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  svc.cobrar(pagada.id, { itemIds: p2.items_sin_pagar, metodo: 'efectivo' }, ACTOR);

  const lista = svc.listVentasAbiertas();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, abierta.id);
  assert.equal(lista[0].num_items, 2);
  near(lista[0].total, 140, 'total');
});

test('listHistorial: paginación, filtro por estado y búsqueda', () => {
  abrirCaja();
  const { presId } = frappe();
  const m = mesaSvc.createMesa({ nombre: 'Terraza' });
  // una pagada en mesa
  let v1 = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  v1 = svc.agregarItem(v1.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  svc.cobrar(v1.id, { itemIds: v1.items_sin_pagar, metodo: 'efectivo' }, ACTOR);
  // una cancelada (para llevar)
  let v2 = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v2 = svc.agregarItem(v2.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  svc.cancelarVenta(v2.id, 'x', ACTOR);
  // una abierta (NO debe salir)
  svc.abrirVenta({ tipo: 'llevar' }, ACTOR);

  const todas = svc.listHistorial({ pageSize: 50 });
  assert.equal(todas.total, 2, 'solo pagadas y canceladas');
  assert.equal(svc.listHistorial({ estado: 'pagada', pageSize: 50 }).total, 1);
  assert.equal(svc.listHistorial({ estado: 'cancelada', pageSize: 50 }).total, 1);
  assert.equal(svc.listHistorial({ search: 'Terraza', pageSize: 50 }).total, 1);
});

// ================= efectivo recibido / cambio =================
test('cobro en efectivo: guarda el efectivo recibido y el cambio a dar', () => {
  abrirCaja();
  const { presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR); // 70
  v = svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo', recibido: 100 }, ACTOR);
  const pago = v.pagos[0];
  assert.equal(pago.monto, 70);
  assert.equal(pago.recibido, 100);
  near(pago.cambio, 30, 'cambio = 100 − 70');
});

test('rechaza si el efectivo recibido no alcanza', () => {
  abrirCaja();
  const { presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  assert.throws(() => svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo', recibido: 50 }, ACTOR), /no alcanza/i);
});

test('sin efectivo recibido (pago exacto): cambio 0', () => {
  abrirCaja();
  const { presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  v = svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);
  assert.equal(v.pagos[0].cambio, 0);
  assert.equal(v.pagos[0].recibido, null);
});

test('el cambio se calcula sobre el monto CON promoción, no sobre el precio de lista', () => {
  abrirCaja();
  const promoSvc = require('../../src/main/services/promocionService');
  const { presId } = frappe();
  const promo = promoSvc.createPromocion({ nombre: '$20 off', tipo: 'monto_fijo', ambito: 'cuenta', valor: 20, fecha_inicio: promoSvc.hoyISO(), fecha_fin: '2040-12-31' });
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR); // 70, con promo 50
  v = svc.aplicarPromocion(v.id, promo.id, ACTOR);
  v = svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo', recibido: 100 }, ACTOR);
  assert.equal(v.pagos[0].monto, 50, 'se cobró el precio con descuento');
  near(v.pagos[0].cambio, 50, 'cambio = 100 − 50 (no 100 − 70)');
});

test('en transferencia se ignora el efectivo recibido', () => {
  const { presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  v = svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'transferencia', recibido: 999 }, ACTOR);
  assert.equal(v.pagos[0].recibido, null);
  assert.equal(v.pagos[0].cambio, 0);
});

test('getVenta expone total, pagado, saldo e items_sin_pagar', () => {
  abrirCaja();
  const { presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 3 }, ACTOR);
  const items = v.items.filter((i) => i.estado === 'activo');
  v = svc.cobrar(v.id, { itemIds: [items[0].id], metodo: 'efectivo' }, ACTOR);
  assert.equal(v.total, 210);
  assert.equal(v.pagado, 70);
  assert.equal(v.saldo, 140);
  assert.equal(v.items_sin_pagar.length, 2);
});
