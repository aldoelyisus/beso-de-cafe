'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTOR, crearInsumo, crearProductoCategoria } = require('../helpers/setup');
const svc = require('../../src/main/services/productoService');

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, `${m || 'valor'}: ${a} ≈ ${b}`);

// ================= createProducto =================
test('producto con un solo precio -> 1 presentación "Único"', () => {
  const p = svc.createProducto({ nombre: 'Americano', precio: 40 }, ACTOR);
  assert.equal(p.presentaciones.length, 1);
  assert.equal(p.presentaciones[0].nombre, 'Único');
  assert.equal(p.presentaciones[0].precio_actual, 40);
  assert.equal(p.is_active, 1);
  assert.equal(p.agotado, 0);
});

test('producto con varias presentaciones (Chico / Grande) y precios distintos', () => {
  const cat = crearProductoCategoria('Frappés');
  const p = svc.createProducto({
    nombre: 'Frappé Oreo', categoria_id: cat.id,
    presentaciones: [{ nombre: 'Chico', precio: 65 }, { nombre: 'Grande', precio: 85 }],
  }, ACTOR);
  assert.equal(p.presentaciones.length, 2);
  const chico = p.presentaciones.find((x) => x.nombre === 'Chico');
  const grande = p.presentaciones.find((x) => x.nombre === 'Grande');
  assert.equal(chico.precio_actual, 65);
  assert.equal(grande.precio_actual, 85);
  assert.ok(chico.receta_vacia && grande.receta_vacia);
});

test('rechaza nombre vacío', () => {
  assert.throws(() => svc.createProducto({ nombre: '  ', precio: 10 }, ACTOR), /obligatorio/i);
});

test('rechaza una presentación sin precio válido', () => {
  assert.throws(() => svc.createProducto({ nombre: 'X', presentaciones: [{ nombre: 'A', precio: -1 }] }, ACTOR), /precio válido/i);
});

test('al crear con modificadorIds, el producto los admite', () => {
  const modSvc = require('../../src/main/services/modificadorService');
  const m = modSvc.createModificador({ nombre: 'Extra shot', precio_extra: 20 });
  const p = svc.createProducto({ nombre: 'Latte', precio: 55, modificadorIds: [m.id] }, ACTOR);
  assert.equal(p.modificadores.length, 1);
  assert.equal(p.modificadores[0].id, m.id);
});

// ================= updateProducto =================
test('edita nombre, categoría y descripción', () => {
  const cat = crearProductoCategoria('Cafés');
  const p = svc.createProducto({ nombre: 'Viejo', precio: 10 }, ACTOR);
  const u = svc.updateProducto(p.id, { nombre: 'Nuevo', categoria_id: cat.id, descripcion: 'rico' });
  assert.equal(u.nombre, 'Nuevo');
  assert.equal(u.categoria_id, cat.id);
  assert.equal(u.descripcion, 'rico');
});

test('update de producto inexistente lanza error', () => {
  assert.throws(() => svc.updateProducto(999, { nombre: 'x' }), /no existe/i);
});

// ================= presentaciones =================
test('agregar un tamaño nuevo con su precio', () => {
  const p = svc.createProducto({ nombre: 'Frappé', precio: 65 }, ACTOR);
  const u = svc.addPresentacion(p.id, { nombre: 'Grande', precio: 85 }, ACTOR);
  assert.equal(u.presentaciones.filter((x) => x.is_active).length, 2);
});

test('renombrar un tamaño', () => {
  const p = svc.createProducto({ nombre: 'X', precio: 10 }, ACTOR);
  const pr = p.presentaciones[0];
  const u = svc.updatePresentacion(pr.id, { nombre: 'Mediano' });
  assert.equal(u.presentaciones[0].nombre, 'Mediano');
});

test('no se puede dar de baja el último tamaño activo', () => {
  const p = svc.createProducto({ nombre: 'X', precio: 10 }, ACTOR);
  assert.throws(() => svc.deactivatePresentacion(p.presentaciones[0].id), /al menos un tamaño activo/i);
});

test('dar de baja un tamaño cuando hay otro activo, y reactivarlo', () => {
  let p = svc.createProducto({ nombre: 'X', presentaciones: [{ nombre: 'A', precio: 10 }, { nombre: 'B', precio: 20 }] }, ACTOR);
  const a = p.presentaciones.find((x) => x.nombre === 'A');
  p = svc.deactivatePresentacion(a.id);
  assert.equal(p.presentaciones.filter((x) => x.is_active).length, 1);
  p = svc.activatePresentacion(a.id);
  assert.equal(p.presentaciones.filter((x) => x.is_active).length, 2);
});

test('agotado por producto y por tamaño', () => {
  const p = svc.createProducto({ nombre: 'X', precio: 10 }, ACTOR);
  assert.equal(svc.setAgotado(p.id, true).agotado, 1);
  assert.equal(svc.setAgotado(p.id, false).agotado, 0);
  const pr = p.presentaciones[0];
  assert.equal(svc.setAgotadoPresentacion(pr.id, true).presentaciones[0].agotado, 1);
});

// ================= precios =================
test('cambiar precio deja historial y no toca las ventas viejas', () => {
  const p = svc.createProducto({ nombre: 'X', precio: 65 }, ACTOR);
  const pr = p.presentaciones[0];
  const u = svc.cambiarPrecio(pr.id, 70, ACTOR);
  assert.equal(u.presentaciones[0].precio_actual, 70);
  const hist = svc.historialPrecios(pr.id);
  assert.equal(hist.length, 2);
  assert.equal(hist[0].precio, 70);
  assert.equal(hist[0].vigente_hasta, null);
  assert.equal(hist[1].precio, 65);
  assert.notEqual(hist[1].vigente_hasta, null);
});

test('cambiar al mismo precio se rechaza', () => {
  const p = svc.createProducto({ nombre: 'X', precio: 65 }, ACTOR);
  assert.throws(() => svc.cambiarPrecio(p.presentaciones[0].id, 65, ACTOR), /igual al actual/i);
});

test('cambiar precio con valor no válido se rechaza', () => {
  const p = svc.createProducto({ nombre: 'X', precio: 65 }, ACTOR);
  assert.throws(() => svc.cambiarPrecio(p.presentaciones[0].id, -1, ACTOR), /precio válido/i);
});

// ================= receta: insumos fijos =================
test('receta con modo: "aquí" no consume el vaso, "para llevar" sí', () => {
  const base = crearInsumo({ nombre: 'Base', unidad_base: 'g', factor_compra: 1000, costo_compra: 120 }); // 0.12/g
  const vaso = crearInsumo({ nombre: 'Vaso', unidad_base: 'pieza', factor_compra: 1, costo_compra: 1.5 });
  const p = svc.createProducto({ nombre: 'Frappé', precio: 70 }, ACTOR);
  const pr = p.presentaciones[0];
  const u = svc.setReceta(pr.id, {
    items: [
      { insumo_id: base.id, cantidad_base: 40, modo: 'siempre' },
      { insumo_id: vaso.id, cantidad_base: 1, modo: 'llevar' },
    ],
  }, ACTOR);
  const x = u.presentaciones[0];
  near(x.costo_aqui, 40 * 0.12, 'costo aquí = solo la base');
  near(x.costo_llevar, 40 * 0.12 + 1.5, 'costo para llevar = base + vaso');
  near(x.ganancia_aqui, 70 - 40 * 0.12, 'ganancia aquí');
  assert.ok(x.costo_llevar > x.costo_aqui);
});

test('setReceta acepta un arreglo suelto como items', () => {
  const ins = crearInsumo({ nombre: 'Ins', costo_compra: 100 });
  const p = svc.createProducto({ nombre: 'X', precio: 20 }, ACTOR);
  const u = svc.setReceta(p.presentaciones[0].id, [{ insumo_id: ins.id, cantidad_base: 10, modo: 'siempre' }], ACTOR);
  assert.equal(u.presentaciones[0].receta.length, 1);
});

test('setReceta rechaza cantidad 0, modo inválido, insumo inexistente y duplicados', () => {
  const ins = crearInsumo({ nombre: 'Ins' });
  const p = svc.createProducto({ nombre: 'X', precio: 20 }, ACTOR);
  const pr = p.presentaciones[0].id;
  assert.throws(() => svc.setReceta(pr, { items: [{ insumo_id: ins.id, cantidad_base: 0, modo: 'siempre' }] }, ACTOR), /mayor a 0/i);
  assert.throws(() => svc.setReceta(pr, { items: [{ insumo_id: ins.id, cantidad_base: 1, modo: 'aveces' }] }, ACTOR), /modo/i);
  assert.throws(() => svc.setReceta(pr, { items: [{ insumo_id: 9999, cantidad_base: 1, modo: 'siempre' }] }, ACTOR), /no existe/i);
  assert.throws(() => svc.setReceta(pr, { items: [
    { insumo_id: ins.id, cantidad_base: 1, modo: 'siempre' },
    { insumo_id: ins.id, cantidad_base: 2, modo: 'siempre' },
  ] }, ACTOR), /repetido/i);
});

test('setReceta reemplaza la receta anterior', () => {
  const a = crearInsumo({ nombre: 'A' });
  const b = crearInsumo({ nombre: 'B' });
  const p = svc.createProducto({ nombre: 'X', precio: 20 }, ACTOR);
  const pr = p.presentaciones[0].id;
  svc.setReceta(pr, { items: [{ insumo_id: a.id, cantidad_base: 5, modo: 'siempre' }] }, ACTOR);
  const u = svc.setReceta(pr, { items: [{ insumo_id: b.id, cantidad_base: 3, modo: 'siempre' }] }, ACTOR);
  assert.equal(u.presentaciones[0].receta.length, 1);
  assert.equal(u.presentaciones[0].receta[0].insumo_id, b.id);
});

// ================= receta: grupos de opción =================
test('grupo de opción: usa la opción predeterminada para el costeo', () => {
  const entera = crearInsumo({ nombre: 'Leche entera', unidad_base: 'ml', factor_compra: 1000, costo_compra: 25 }); // 0.025
  const deslac = crearInsumo({ nombre: 'Leche deslactosada', unidad_base: 'ml', factor_compra: 1000, costo_compra: 30 }); // 0.03
  const p = svc.createProducto({ nombre: 'Latte', precio: 55 }, ACTOR);
  const pr = p.presentaciones[0];
  const u = svc.setReceta(pr.id, {
    items: [],
    grupos: [{ nombre: 'Leche', cantidad_base: 200, modo: 'siempre', opciones: [entera.id, deslac.id], insumo_default_id: entera.id }],
  }, ACTOR);
  const g = u.presentaciones[0].grupos[0];
  assert.equal(g.nombre, 'Leche');
  assert.equal(g.opciones.length, 2);
  assert.equal(g.unidad_base, 'ml');
  near(g.costo_default, 200 * 0.025, 'costo con leche entera (predeterminada)');
  near(u.presentaciones[0].costo_aqui, 200 * 0.025, 'el costo del producto usa la predeterminada');
});

test('cambiar la opción predeterminada cambia el costo', () => {
  const entera = crearInsumo({ nombre: 'Leche entera', unidad_base: 'ml', factor_compra: 1000, costo_compra: 25 });
  const deslac = crearInsumo({ nombre: 'Leche deslac', unidad_base: 'ml', factor_compra: 1000, costo_compra: 30 });
  const p = svc.createProducto({ nombre: 'Latte', precio: 55 }, ACTOR);
  const pr = p.presentaciones[0].id;
  const g = (dflt) => ({ items: [], grupos: [{ nombre: 'Leche', cantidad_base: 200, modo: 'siempre', opciones: [entera.id, deslac.id], insumo_default_id: dflt }] });
  near(svc.setReceta(pr, g(entera.id), ACTOR).presentaciones[0].costo_aqui, 200 * 0.025, 'default entera');
  near(svc.setReceta(pr, g(deslac.id), ACTOR).presentaciones[0].costo_aqui, 200 * 0.03, 'default deslactosada');
});

test('grupo con menos de 2 opciones se rechaza', () => {
  const a = crearInsumo({ nombre: 'A', unidad_base: 'ml' });
  const p = svc.createProducto({ nombre: 'X', precio: 20 }, ACTOR);
  assert.throws(() => svc.setReceta(p.presentaciones[0].id, {
    grupos: [{ nombre: 'Leche', cantidad_base: 100, modo: 'siempre', opciones: [a.id] }],
  }, ACTOR), /al menos 2 opciones/i);
});

test('grupo con opciones de distinta unidad se rechaza', () => {
  const ml = crearInsumo({ nombre: 'Leche', unidad_base: 'ml' });
  const g = crearInsumo({ nombre: 'Cocoa', unidad_base: 'g' });
  const p = svc.createProducto({ nombre: 'X', precio: 20 }, ACTOR);
  assert.throws(() => svc.setReceta(p.presentaciones[0].id, {
    grupos: [{ nombre: 'Mezcla', cantidad_base: 100, modo: 'siempre', opciones: [ml.id, g.id] }],
  }, ACTOR), /misma unidad/i);
});

// ================= modificadores del producto =================
test('setModificadores asigna y quita', () => {
  const modSvc = require('../../src/main/services/modificadorService');
  const m = modSvc.createModificador({ nombre: 'Extra shot', precio_extra: 20 });
  const p = svc.createProducto({ nombre: 'X', precio: 20 }, ACTOR);
  assert.equal(svc.setModificadores(p.id, [m.id]).modificadores.length, 1);
  assert.equal(svc.setModificadores(p.id, []).modificadores.length, 0);
});

// ================= baja lógica =================
test('deactivate / activate producto', () => {
  const p = svc.createProducto({ nombre: 'X', precio: 10 }, ACTOR);
  assert.equal(svc.deactivateProducto(p.id).is_active, 0);
  assert.equal(svc.activateProducto(p.id).is_active, 1);
});

// ================= listProductos =================
test('pagina de 15, con rango de precio y nº de tamaños', () => {
  for (let i = 0; i < 17; i++) svc.createProducto({ nombre: `Prod ${i}`, precio: 10 + i }, ACTOR);
  const r = svc.listProductos();
  assert.equal(r.total, 17);
  assert.equal(r.rows.length, 15);
  assert.equal(r.totalPages, 2);
  assert.ok(r.rows.every((p) => p.num_presentaciones === 1));
});

test('señal receta_completa: true solo si todos los tamaños activos tienen receta y precio', () => {
  const ins = crearInsumo({ nombre: 'Ins' });
  const sin = svc.createProducto({ nombre: 'Sin receta', precio: 20 }, ACTOR);
  const con = svc.createProducto({ nombre: 'Con receta', precio: 20 }, ACTOR);
  svc.setReceta(con.presentaciones[0].id, { items: [{ insumo_id: ins.id, cantidad_base: 1, modo: 'siempre' }] }, ACTOR);
  const rows = svc.listProductos({ pageSize: 100 }).rows;
  assert.equal(rows.find((p) => p.id === sin.id).receta_completa, false);
  assert.equal(rows.find((p) => p.id === con.id).receta_completa, true);
});

test('filtra por categoría y por nombre', () => {
  const cat = crearProductoCategoria('Postres');
  svc.createProducto({ nombre: 'Crepa', categoria_id: cat.id, precio: 70 }, ACTOR);
  svc.createProducto({ nombre: 'Café', precio: 40 }, ACTOR);
  assert.equal(svc.listProductos({ categoriaId: cat.id }).total, 1);
  assert.equal(svc.listProductos({ search: 'caf' }).total, 1);
});

test('filtra "solo agotados"', () => {
  const a = svc.createProducto({ nombre: 'Agotado', precio: 10 }, ACTOR);
  svc.createProducto({ nombre: 'Normal', precio: 10 }, ACTOR);
  svc.setAgotado(a.id, true);
  const r = svc.listProductos({ soloAgotados: true });
  assert.equal(r.total, 1);
  assert.equal(r.rows[0].nombre, 'Agotado');
});

test('includeInactive controla los dados de baja', () => {
  const b = svc.createProducto({ nombre: 'Baja', precio: 10 }, ACTOR);
  svc.createProducto({ nombre: 'Activo', precio: 10 }, ACTOR);
  svc.deactivateProducto(b.id);
  assert.equal(svc.listProductos({ includeInactive: false }).total, 1);
  assert.equal(svc.listProductos({ includeInactive: true }).total, 2);
});

test('orden por nombre y por precio', () => {
  svc.createProducto({ nombre: 'Zeta', precio: 100 }, ACTOR);
  svc.createProducto({ nombre: 'Alfa', precio: 10 }, ACTOR);
  assert.equal(svc.listProductos({ sort: 'nombre' }).rows[0].nombre, 'Alfa');
  assert.equal(svc.listProductos({ sort: 'nombre_desc' }).rows[0].nombre, 'Zeta');
  assert.equal(svc.listProductos({ sort: 'precio_asc' }).rows[0].nombre, 'Alfa');
  assert.equal(svc.listProductos({ sort: 'precio_desc' }).rows[0].nombre, 'Zeta');
});

// ================= listOptions (POS / promos) =================
test('listOptions trae productos activos con sus tamaños y precio', () => {
  const cat = crearProductoCategoria('Frappés');
  svc.createProducto({ nombre: 'Frappé', categoria_id: cat.id, presentaciones: [{ nombre: 'Chico', precio: 65 }, { nombre: 'Grande', precio: 85 }] }, ACTOR);
  const baja = svc.createProducto({ nombre: 'Baja', precio: 10 }, ACTOR);
  svc.deactivateProducto(baja.id);
  const opts = svc.listOptions();
  assert.equal(opts.length, 1);
  assert.equal(opts[0].presentaciones.length, 2);
  assert.equal(opts[0].categoria_nombre, 'Frappés');
  assert.ok(opts[0].presentaciones.every((pr) => typeof pr.precio_actual === 'number'));
});
