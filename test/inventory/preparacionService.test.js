'use strict';

/**
 * Insumos que se preparan aquí (base para frappé con leche en polvo, CLM y
 * azúcar glass).
 *
 * Lo que de verdad se está fijando: que el descuento ocurra UNA sola vez.
 * Al preparar salen los componentes; al vender sale solo la base. Si alguna
 * vez se "arregla" para que vender también descuente los componentes, el
 * inventario y la ganancia se van a romper en silencio — y estas pruebas lo
 * tienen que atrapar.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTOR, crearInsumo, crearProducto, abrirCaja } = require('../helpers/setup');
const svc = require('../../src/main/services/preparacionService');
const insumoSvc = require('../../src/main/services/insumoService');
const ventaSvc = require('../../src/main/services/ventaService');

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-4, `${m || 'valor'}: ${a} ≈ ${b}`);
const stock = (id) => insumoSvc.getInsumo(id).stock;
const costo = (id) => insumoSvc.getInsumo(id).costo_unitario;

/**
 * El caso real de la cafetería.
 * Una tanda: 600 g leche en polvo + 200 g CLM + 200 g azúcar glass → 1000 g.
 *   leche en polvo $200/kg = $0.20/g   → 600 × 0.20 = $120
 *   CLM            $150/kg = $0.15/g   → 200 × 0.15 = $30
 *   azúcar glass    $40/kg = $0.04/g   → 200 × 0.04 = $8
 *   tanda = $158 → la base cuesta $0.158 por gramo
 */
function cocina() {
  const leche = crearInsumo({ nombre: 'Leche en polvo', unidad_base: 'g', factor_compra: 1000, costo_compra: 200, stock_inicial_compra: 10 });
  const clm = crearInsumo({ nombre: 'CLM', unidad_base: 'g', factor_compra: 1000, costo_compra: 150, stock_inicial_compra: 10 });
  const azucar = crearInsumo({ nombre: 'Azúcar glass', unidad_base: 'g', factor_compra: 1000, costo_compra: 40, stock_inicial_compra: 10 });
  const base = crearInsumo({ nombre: 'Base para frappé', unidad_base: 'g', factor_compra: 1, costo_compra: 0, stock_inicial_compra: 0 });
  svc.setPreparacion(base.id, {
    rinde: 1000,
    items: [
      { componente_id: leche.id, cantidad_base: 600 },
      { componente_id: clm.id, cantidad_base: 200 },
      { componente_id: azucar.id, cantidad_base: 200 },
    ],
  }, ACTOR);
  return { leche, clm, azucar, base };
}

test('preparar una tanda: salen los componentes y entra la base', () => {
  const { leche, clm, azucar, base } = cocina();
  const antes = { leche: stock(leche.id), clm: stock(clm.id), azucar: stock(azucar.id) };

  const r = svc.producir(base.id, { tandas: 1 }, ACTOR);

  near(r.producido, 1000, 'rinde 1000 g');
  near(stock(base.id), 1000, 'la base entró al inventario');
  near(stock(leche.id), antes.leche - 600, 'salió la leche en polvo');
  near(stock(clm.id), antes.clm - 200, 'salió el CLM');
  near(stock(azucar.id), antes.azucar - 200, 'salió el azúcar glass');
});

test('el costo de la tanda viaja a la base', () => {
  const { base } = cocina();
  const r = svc.producir(base.id, { tandas: 1 }, ACTOR);
  near(r.costo_tanda, 158, '600×0.20 + 200×0.15 + 200×0.04');
  near(costo(base.id), 0.158, '$158 ÷ 1000 g');
});

test('vender el frappé descuenta SOLO la base, no sus ingredientes otra vez', () => {
  abrirCaja();
  const { leche, clm, azucar, base } = cocina();
  svc.producir(base.id, { tandas: 1 }, ACTOR);

  const tras = { leche: stock(leche.id), clm: stock(clm.id), azucar: stock(azucar.id), base: stock(base.id) };

  const frappe = crearProducto({ nombre: 'Frappé', precio: 70 },
    { items: [{ insumo_id: base.id, cantidad_base: 40, modo: 'siempre' }] });
  let v = ventaSvc.abrirVenta({ tipo: 'llevar' }, ACTOR);
  v = ventaSvc.agregarItem(v.id, { presentacionId: frappe.presentaciones[0].id, cantidad: 1 }, ACTOR);
  ventaSvc.cobrar(v.id, { itemIds: v.items_sin_pagar, metodo: 'efectivo' }, ACTOR);

  near(stock(base.id), tras.base - 40, 'bajó la base');
  near(stock(leche.id), tras.leche, 'la leche en polvo NO se volvió a descontar');
  near(stock(clm.id), tras.clm, 'el CLM NO se volvió a descontar');
  near(stock(azucar.id), tras.azucar, 'el azúcar glass NO se volvió a descontar');
});

test('el costo del frappé incluye lo que costaron los ingredientes de la base', () => {
  abrirCaja();
  const { base } = cocina();
  svc.producir(base.id, { tandas: 1 }, ACTOR);
  const frappe = crearProducto({ nombre: 'Frappé', precio: 70 },
    { items: [{ insumo_id: base.id, cantidad_base: 40, modo: 'siempre' }] });
  const pres = require('../../src/main/services/productoService').getProducto(frappe.id).presentaciones[0];
  near(pres.costo_aqui, 6.32, '40 g × $0.158 — ahí van la leche, el CLM y el azúcar');
});

test('media tanda gasta la mitad y rinde la mitad', () => {
  const { leche, base } = cocina();
  const antes = stock(leche.id);
  const r = svc.producir(base.id, { tandas: 0.5 }, ACTOR);
  near(r.producido, 500, 'rinde 500 g');
  near(stock(leche.id), antes - 300, 'gastó 300 g de leche en polvo');
});

test('preparar dos veces promedia el costo, como una compra', () => {
  const { leche, base } = cocina();
  svc.producir(base.id, { tandas: 1 }, ACTOR);
  near(costo(base.id), 0.158, 'primera tanda');

  // Sube la leche en polvo: la tanda nueva cuesta más, la que ya estaba no.
  insumoSvc.registrarMovimiento({ insumoId: leche.id, tipo: 'ajuste_costo', costo_compra: 400, nota: 'subió' }, ACTOR);
  svc.producir(base.id, { tandas: 1 }, ACTOR);

  // tanda 2 = 600×0.40 + 200×0.15 + 200×0.04 = $278 → $0.278/g
  // promedio = (1000×0.158 + 1000×0.278) / 2000 = $0.218/g
  near(costo(base.id), 0.218, 'promedio ponderado de las dos tandas');
});

test('avisa si un componente queda en negativo al preparar', () => {
  const { azucar, base } = cocina();
  // Se deja el azúcar casi en cero.
  insumoSvc.registrarMovimiento({ insumoId: azucar.id, tipo: 'ajuste', conteo: 50, nota: 'conteo' }, ACTOR);
  const r = svc.producir(base.id, { tandas: 1 }, ACTOR);
  assert.equal(r.faltantes.length, 1, 'un componente quedó en negativo');
  assert.match(r.faltantes[0].nombre, /Azúcar glass/);
  assert.ok(r.faltantes[0].stock < 0);
});

test('no se puede preparar lo que no tiene receta, ni lo que no se prepara aquí', () => {
  const suelto = crearInsumo({ nombre: 'Vaso', unidad_base: 'pieza', factor_compra: 1, costo_compra: 2 });
  assert.throws(() => svc.producir(suelto.id, { tandas: 1 }, ACTOR), /no está marcado/i);

  const { base } = cocina();
  assert.throws(() => svc.producir(base.id, { tandas: 0 }, ACTOR), /mayor a 0/i);
  assert.throws(() => svc.producir(base.id, { tandas: -2 }, ACTOR), /mayor a 0/i);
});

test('la receta rechaza lo que no cuadra', () => {
  const { leche, base } = cocina();
  assert.throws(() => svc.setPreparacion(base.id, { rinde: 0, items: [{ componente_id: leche.id, cantidad_base: 1 }] }, ACTOR),
    /cuánto sale de una tanda/i);
  assert.throws(() => svc.setPreparacion(base.id, { rinde: 1000, items: [] }, ACTOR), /al menos un insumo/i);
  assert.throws(() => svc.setPreparacion(base.id, { rinde: 1000, items: [{ componente_id: leche.id, cantidad_base: 0 }] }, ACTOR),
    /falta la cantidad/i);
  assert.throws(() => svc.setPreparacion(base.id, { rinde: 1000, items: [{ componente_id: base.id, cantidad_base: 10 }] }, ACTOR),
    /a sí mismo/i);
  assert.throws(() => svc.setPreparacion(base.id, {
    rinde: 1000,
    items: [{ componente_id: leche.id, cantidad_base: 1 }, { componente_id: leche.id, cantidad_base: 2 }],
  }, ACTOR), /repetido/i);
});

test('no deja armar un círculo: si A lleva B, B no puede llevar A', () => {
  const { base } = cocina();
  const salsa = crearInsumo({ nombre: 'Salsa de la casa', unidad_base: 'ml', factor_compra: 1, costo_compra: 0 });
  // La salsa lleva base: válido.
  svc.setPreparacion(salsa.id, { rinde: 500, items: [{ componente_id: base.id, cantidad_base: 100 }] }, ACTOR);
  // Que la base lleve salsa cerraría el círculo.
  assert.throws(
    () => svc.setPreparacion(base.id, { rinde: 1000, items: [{ componente_id: salsa.id, cantidad_base: 50 }] }, ACTOR),
    /en círculo/i
  );
});

test('un ingrediente de una preparación no se puede dar de baja a la ligera', () => {
  const { leche } = cocina();
  const r = insumoSvc.getInsumo(leche.id);
  assert.ok(r, 'existe');
  // `enUso` lo reporta: la pantalla lo usa para explicar por qué no se puede.
  const insumoNuevo = crearInsumo({ nombre: 'Suelto', unidad_base: 'g', factor_compra: 1, costo_compra: 1, stock_inicial_compra: 0 });
  assert.doesNotThrow(() => insumoSvc.updateInsumo(insumoNuevo.id, { unidad_base: 'ml' }),
    'uno sin uso sí se puede cambiar');
});

test('getPreparacion dice cuántas tandas alcanzan con lo que hay', () => {
  const { base } = cocina();
  const p = svc.getPreparacion(base.id);
  assert.equal(p.se_prepara, true);
  assert.equal(p.receta.length, 3);
  near(p.costo_tanda, 158, 'costo de la tanda');
  near(p.costo_por_unidad, 0.158, 'por gramo');
  // 10 kg de cada uno: la leche (600 g/tanda) es la que limita → 16 tandas.
  assert.equal(p.tandas_posibles, 16);
});
