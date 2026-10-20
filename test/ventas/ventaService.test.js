'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTOR, getDb, crearInsumo, crearProducto, crearProductoCategoria, abrirCaja } = require('../helpers/setup');
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
test('cobrar en efectivo requiere la caja abierta; transferencia no', () => {
  const { presId } = frappe();
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  assert.throws(() => svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR), /abre la caja/i);
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
  require('../../src/main/services/cajaService').cerrarCorte({ efectivo_contado: 0, notas: 'cierre de prueba' }, ACTOR);
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

test('listHistorial trae la promoción y el total realmente cobrado', () => {
  abrirCaja();
  const promoSvc = require('../../src/main/services/promocionService');
  const { presId } = frappe();
  const promo = promoSvc.createPromocion({ nombre: '$15 off', tipo: 'monto_fijo', ambito: 'cuenta', valor: 15, fecha_inicio: promoSvc.hoyISO(), fecha_fin: '2040-12-31' });
  let v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR); // 70
  v = svc.aplicarPromocion(v.id, promo.id, ACTOR);
  svc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);

  // Sin estos campos el historial mostraba $70 y nunca decía que hubo promoción.
  const fila = svc.listHistorial({ pageSize: 50 }).rows.find((r) => r.id === v.id);
  near(fila.total, 70, 'subtotal');
  near(fila.descuento, 15, 'descuento');
  near(fila.total_final, 55, 'total cobrado');
  near(fila.pagado, 55, 'pagado');
  assert.equal(fila.promocion_nombre, '$15 off');
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

// ================= pasar la cuenta a llevar =================
test('la mesa se retira: pasar a llevar consume los vasos y libera la mesa', () => {
  const { presId, vaso } = frappe();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 2, paraLlevar: false }, ACTOR);
  assert.equal(stock(vaso.id), 100, 'servido aquí no gastó vasos');

  const r = svc.cambiarTipoVenta(v.id, { tipo: 'llevar' }, ACTOR);

  assert.equal(r.tipo, 'llevar');
  assert.equal(r.mesa_id, null, 'la mesa queda libre');
  assert.equal(r.items_convertidos, 2);
  assert.equal(stock(vaso.id), 98, 'ahora sí salieron los 2 vasos');
  assert.ok(r.items.every((i) => i.para_llevar === 1), 'los renglones quedan marcados para llevar');
  assert.equal(mesaSvc.listMesas().find((x) => x.id === m.id).venta_abierta_id, null, 'la mesa ya no aparece ocupada');
});

test('el costo del renglón sube con el vaso, y el reporte lo ve', () => {
  const { presId, vaso } = frappe();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1, paraLlevar: false }, ACTOR);
  const itemId = svc.getVenta(v.id).items[0].id;
  const costo = () => getDb().prepare(
    'SELECT COALESCE(SUM(cantidad_base * costo_unitario), 0) c FROM venta_item_consumo WHERE venta_item_id = ? AND devuelto = 0'
  ).get(itemId).c;

  // base 40g@0.12 + leche 100ml@0.025 = 4.80 + 2.50 = 7.30
  near(costo(), 7.30, 'costo servido aquí');
  svc.cambiarTipoVenta(v.id, { tipo: 'llevar' }, ACTOR);
  near(costo(), 8.80, 'costo con el vaso de $1.50');
  const fila = getDb().prepare('SELECT cantidad_base FROM venta_item_consumo WHERE venta_item_id = ? AND insumo_id = ?').get(itemId, vaso.id);
  assert.ok(fila && Math.abs(fila.cantidad_base - 1) < 1e-9, 'quedó registrado el vaso que consumió');
});

test('los renglones que ya eran para llevar no se tocan dos veces', () => {
  const { presId, vaso } = frappe();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1, paraLlevar: true }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1, paraLlevar: false }, ACTOR);
  assert.equal(stock(vaso.id), 99);

  const r = svc.cambiarTipoVenta(v.id, { tipo: 'llevar' }, ACTOR);
  assert.equal(r.items_convertidos, 1, 'solo el que estaba servido aquí');
  assert.equal(stock(vaso.id), 98, 'un vaso más, no dos');
});

test('un producto cancelado no revive al pasar la cuenta a llevar', () => {
  const { presId, vaso } = frappe();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 2, paraLlevar: false }, ACTOR);
  const items = svc.getVenta(v.id).items;
  svc.cancelarItem(v.id, items[0].id, 'se arrepintió', ACTOR);

  const r = svc.cambiarTipoVenta(v.id, { tipo: 'llevar' }, ACTOR);
  assert.equal(r.items_convertidos, 1, 'solo el activo');
  assert.equal(stock(vaso.id), 99, 'un solo vaso');
  assert.equal(r.items.find((i) => i.id === items[0].id).para_llevar, 0, 'el cancelado se queda como estaba');
});

test('volver a sentar la cuenta devuelve los vasos', () => {
  const { presId, vaso } = frappe();
  const m1 = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const m2 = mesaSvc.createMesa({ nombre: 'Mesa 2' });
  const v = svc.abrirVenta({ tipo: 'mesa', mesaId: m1.id }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 2, paraLlevar: false }, ACTOR);

  svc.cambiarTipoVenta(v.id, { tipo: 'llevar' }, ACTOR);
  assert.equal(stock(vaso.id), 98);

  const r = svc.cambiarTipoVenta(v.id, { tipo: 'mesa', mesaId: m2.id }, ACTOR);
  assert.equal(r.tipo, 'mesa');
  assert.equal(r.mesa_id, m2.id);
  assert.equal(stock(vaso.id), 100, 'los vasos regresaron al inventario');
});

/**
 * Un producto que gasta cosas distintas según dónde se consuma: vaso
 * desechable si va para llevar, taza y plato si se sirve en la mesa.
 *
 * El fixture de arriba solo tenía el vaso, así que el sentido "pasar a
 * consumir aquí" se probaba a medias: se veía regresar el vaso, pero nadie
 * verificaba que saliera la taza. Si alguna vez se rompe, la cafetería
 * serviría en tazas que el inventario sigue contando como guardadas.
 */
function capuchino() {
  const cafe = crearInsumo({ nombre: 'Café', unidad_base: 'g', factor_compra: 1000, costo_compra: 300, stock_inicial_compra: 10 });
  const vaso = crearInsumo({ nombre: 'Vaso desechable', unidad_base: 'pieza', factor_compra: 1, costo_compra: 2, stock_inicial_compra: 100 });
  const taza = crearInsumo({ nombre: 'Taza', unidad_base: 'pieza', factor_compra: 1, costo_compra: 0.5, stock_inicial_compra: 50 });
  const p = crearProducto({ nombre: 'Capuchino', precio: 55 }, {
    items: [
      { insumo_id: cafe.id, cantidad_base: 18, modo: 'siempre' },
      { insumo_id: vaso.id, cantidad_base: 1, modo: 'llevar' },
      { insumo_id: taza.id, cantidad_base: 1, modo: 'aqui' },
    ],
  });
  return { presId: p.presentaciones[0].id, cafe, vaso, taza };
}

test('pasar a consumir aquí: regresa el vaso Y sale la taza', () => {
  const { presId, cafe, vaso, taza } = capuchino();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1, paraLlevar: true }, ACTOR);

  assert.equal(stock(vaso.id), 99, 'nació para llevar: salió el vaso');
  assert.equal(stock(taza.id), 50, 'la taza sigue guardada');
  const cafeTrasPedir = stock(cafe.id);

  const r = svc.cambiarTipoVenta(v.id, { tipo: 'mesa', mesaId: m.id }, ACTOR);

  assert.equal(r.tipo, 'mesa');
  assert.equal(r.items_convertidos, 1);
  assert.equal(r.items_con_movimiento, 1, 'hubo movimiento de inventario');
  assert.equal(stock(vaso.id), 100, 'el vaso desechable regresó');
  assert.equal(stock(taza.id), 49, 'salió la taza para servir aquí');
  assert.equal(stock(cafe.id), cafeTrasPedir, 'el café es de modo siempre: no se toca');
});

test('pasar a consumir aquí y de vuelta a llevar deja el inventario como al principio', () => {
  const { presId, cafe, vaso, taza } = capuchino();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 3, paraLlevar: true }, ACTOR);
  const inicio = { cafe: stock(cafe.id), vaso: stock(vaso.id), taza: stock(taza.id) };

  svc.cambiarTipoVenta(v.id, { tipo: 'mesa', mesaId: m.id }, ACTOR);
  assert.equal(stock(vaso.id), inicio.vaso + 3, 'los 3 vasos regresaron');
  assert.equal(stock(taza.id), inicio.taza - 3, 'salieron 3 tazas');

  svc.cambiarTipoVenta(v.id, { tipo: 'llevar' }, ACTOR);
  assert.equal(stock(vaso.id), inicio.vaso, 'vasos como al principio');
  assert.equal(stock(taza.id), inicio.taza, 'tazas como al principio');
  assert.equal(stock(cafe.id), inicio.cafe, 'el café nunca se movió');
});

test('el cambio a consumir aquí queda en el libro de inventario con su motivo', () => {
  const { presId, taza } = capuchino();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1, paraLlevar: true }, ACTOR);
  svc.cambiarTipoVenta(v.id, { tipo: 'mesa', mesaId: m.id }, ACTOR);

  const movs = insumoSvc.listMovimientos({ insumoId: taza.id });
  const mov = movs.find((x) => x.tipo === 'consumo');
  assert.ok(mov, 'la salida de la taza quedó anotada');
  assert.match(mov.motivo, /Pasó a servir aquí/, 'con un motivo que se entiende');
  assert.match(mov.referencia, new RegExp(`Cuenta #${v.id}`), 'y apunta a la cuenta');
});

test('el costo del renglón cambia al pasar a consumir aquí', () => {
  const { presId } = capuchino();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1, paraLlevar: true }, ACTOR);
  const itemId = svc.getVenta(v.id).items[0].id;
  const costo = () => getDb().prepare(
    'SELECT COALESCE(SUM(cantidad_base * costo_unitario), 0) c FROM venta_item_consumo WHERE venta_item_id = ? AND devuelto = 0'
  ).get(itemId).c;

  // Para llevar: café 18 g × 0.30 = 5.40, más el vaso de $2.00
  near(costo(), 7.40, 'costo para llevar');
  svc.cambiarTipoVenta(v.id, { tipo: 'mesa', mesaId: m.id }, ACTOR);
  // Aquí: los mismos 5.40, más la taza de $0.50
  near(costo(), 5.90, 'servido aquí sale más barato: taza en vez de vaso');
});

test('cambiar de mesa no toca el inventario', () => {
  const { presId, vaso, base } = frappe();
  const m1 = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const m2 = mesaSvc.createMesa({ nombre: 'Mesa 2' });
  const v = svc.abrirVenta({ tipo: 'mesa', mesaId: m1.id }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1, paraLlevar: false }, ACTOR);
  const antesBase = stock(base.id);

  const r = svc.cambiarTipoVenta(v.id, { tipo: 'mesa', mesaId: m2.id }, ACTOR);
  assert.equal(r.mesa_id, m2.id);
  assert.equal(r.items_convertidos, 0);
  assert.equal(stock(vaso.id), 100);
  assert.equal(stock(base.id), antesBase);
});

test('no se pasa una cuenta a una mesa que ya tiene cuenta abierta', () => {
  const { presId } = frappe();
  const m1 = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const m2 = mesaSvc.createMesa({ nombre: 'Mesa 2' });
  const a = svc.abrirVenta({ tipo: 'mesa', mesaId: m1.id }, ACTOR);
  const b = svc.abrirVenta({ tipo: 'mesa', mesaId: m2.id }, ACTOR);
  svc.agregarItem(b.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  assert.throws(() => svc.cambiarTipoVenta(a.id, { tipo: 'mesa', mesaId: m2.id }, ACTOR),
    /ya tiene abierta la cuenta/i);
  assert.equal(svc.getVenta(a.id).mesa_id, m1.id, 'se quedó donde estaba');
});

test('rechaza mesas inexistentes, dadas de baja o sin elegir', () => {
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const baja = mesaSvc.createMesa({ nombre: 'Mesa 9' });
  mesaSvc.deactivateMesa(baja.id);
  const v = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  assert.throws(() => svc.cambiarTipoVenta(v.id, { tipo: 'mesa' }, ACTOR), /Elige la mesa/i);
  assert.throws(() => svc.cambiarTipoVenta(v.id, { tipo: 'mesa', mesaId: 9999 }, ACTOR), /no existe o está dada de baja/i);
  assert.throws(() => svc.cambiarTipoVenta(v.id, { tipo: 'mesa', mesaId: baja.id }, ACTOR), /no existe o está dada de baja/i);
});

test('avisa cuando la cuenta ya está en ese destino', () => {
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const enMesa = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  assert.throws(() => svc.cambiarTipoVenta(enMesa.id, { tipo: 'mesa', mesaId: m.id }, ACTOR), /ya está en esa mesa/i);
  const llevar = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  assert.throws(() => svc.cambiarTipoVenta(llevar.id, { tipo: 'llevar' }, ACTOR), /ya es para llevar/i);
});

test('no se mueve una cuenta ya cobrada ni una cancelada', () => {
  const { presId } = frappe();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  abrirCaja(0);
  const v = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1 }, ACTOR);
  svc.cobrar(v.id, { itemIds: svc.getVenta(v.id).items_sin_pagar, metodo: 'efectivo' }, ACTOR);
  assert.throws(() => svc.cambiarTipoVenta(v.id, { tipo: 'llevar' }, ACTOR), /ya está cerrada/i);

  const c = svc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  svc.cancelarVenta(c.id, 'error', ACTOR);
  assert.throws(() => svc.cambiarTipoVenta(c.id, { tipo: 'mesa', mesaId: m.id }, ACTOR), /ya está cerrada/i);
});

test('cambiar el tipo de una cuenta inexistente', () => {
  assert.throws(() => svc.cambiarTipoVenta(9999, { tipo: 'llevar' }, ACTOR), /La cuenta no existe/i);
});

test('una cuenta vacía se pasa a llevar sin mover inventario', () => {
  const { vaso } = frappe();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  const r = svc.cambiarTipoVenta(v.id, { tipo: 'llevar' }, ACTOR);
  assert.equal(r.tipo, 'llevar');
  assert.equal(r.items_convertidos, 0);
  assert.equal(stock(vaso.id), 100);
});

test('se respeta la opción de leche elegida al pasar a llevar', () => {
  const entera = crearInsumo({ nombre: 'Leche entera', unidad_base: 'ml', factor_compra: 1000, costo_compra: 25, stock_inicial_compra: 10 });
  const deslac = crearInsumo({ nombre: 'Leche deslactosada', unidad_base: 'ml', factor_compra: 1000, costo_compra: 30, stock_inicial_compra: 10 });
  const vaso = crearInsumo({ nombre: 'Vaso', unidad_base: 'pieza', factor_compra: 1, costo_compra: 1.5, stock_inicial_compra: 100 });
  const p = crearProducto({ nombre: 'Latte', precio: 50 }, {
    items: [{ insumo_id: vaso.id, cantidad_base: 1, modo: 'llevar' }],
    grupos: [{ nombre: 'Leche', cantidad_base: 100, modo: 'siempre', insumo_default_id: entera.id, opciones: [entera.id, deslac.id] }],
  });
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  const grupoId = p.presentaciones[0].grupos[0].id;
  svc.agregarItem(v.id, { presentacionId: p.presentaciones[0].id, cantidad: 1, paraLlevar: false, opciones: { [grupoId]: deslac.id } }, ACTOR);
  assert.equal(stock(deslac.id), 9900, 'se sirvió con deslactosada');

  svc.cambiarTipoVenta(v.id, { tipo: 'llevar' }, ACTOR);
  assert.equal(stock(deslac.id), 9900, 'la leche no se vuelve a cobrar');
  assert.equal(stock(entera.id), 10000, 'ni se cambia por la predeterminada');
  assert.equal(stock(vaso.id), 99, 'solo se agregó el vaso');
});

test('los movimientos del cambio quedan en el libro de inventario con su motivo', () => {
  const { presId, vaso } = frappe();
  const m = mesaSvc.createMesa({ nombre: 'Mesa 1' });
  const v = svc.abrirVenta({ tipo: 'mesa', mesaId: m.id }, ACTOR);
  svc.agregarItem(v.id, { presentacionId: presId, cantidad: 1, paraLlevar: false }, ACTOR);
  svc.cambiarTipoVenta(v.id, { tipo: 'llevar' }, ACTOR);
  const mov = insumoSvc.listMovimientos({ insumoId: vaso.id })[0];
  assert.equal(mov.tipo, 'consumo');
  assert.match(mov.motivo, /Pasó a para llevar/i);
  assert.match(mov.referencia, new RegExp('Cuenta #' + v.id));
});
