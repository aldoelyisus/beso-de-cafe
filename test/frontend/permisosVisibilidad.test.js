'use strict';

/**
 * "Si el usuario SÍ tiene el permiso, que se le muestre lo correspondiente;
 * si NO lo tiene, que no se lo muestre." — a diferencia de las pruebas de
 * `test/seguridad/`, que comprueban que el CANAL IPC rechaza sin el permiso,
 * estas renderizan la VISTA real (con el DOM shim de `test/helpers/dom.js`)
 * y comprueban qué botones aparecen. El backend puede estar perfectamente
 * protegido y aun así mostrar un botón que al tocarlo truena con "no tienes
 * permiso" — ese es justo el tipo de falla que esto atrapa.
 *
 * Caso real que encontró esta prueba (ventaTicket.js): el botón "quitar"
 * de una promoción aplicada no comprobaba `can('promociones.aplicar')` —
 * cualquiera con `ventas.crear` lo veía, aunque no pudiera tocarlo.
 *
 * NOTA sobre `beforeEach`: `scripts/run-tests.js` corre TODOS los archivos
 * de prueba en un solo proceso, así que un `beforeEach` de nivel de archivo
 * se aplicaría a la suite ENTERA, no solo a este archivo (ya pasó: `seed()`
 * aquí arriba hacía que las pruebas de mesas de `ventaService.test.js`
 * chocaran con "Ya existe una mesa con ese nombre"). Por eso el montaje va
 * en una función que cada `test()` llama a mano, igual que en
 * `test/seguridad/*.test.js`.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { getDb, crearProductoCategoria, crearInsumo, FOTO_PRUEBA } = require('../helpers/setup');
const { call, entrar } = require('../helpers/ipc');
const { seed } = require('../../src/main/db/seed');
const { hashPassword } = require('../../src/main/security/password');
const dom = require('../helpers/dom');
const { cargarVista } = require('../helpers/vistaEsm');

require('../../src/preload/index.js'); // deja window.api enrutado al IPC real (vía helpers/ipc)

const d = (r) => { if (!r.ok) throw new Error(r.error); return r.data; };
let contador = 0;

/** DOM limpio + sistema sembrado + sesión del admin interno. Devuelve el `store` del renderer. */
async function montar() {
  const D = dom.instalar();
  seed();
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = 1').run(hashPassword('admin123'));
  await entrar('tester', 'admin123');
  const store = await cargarVista('lib/store.js');
  store.setSession(d(await call('auth:session', {})));
  return { D, store };
}

/** Usuario nuevo con EXACTAMENTE estos permisos; deja sesión y store en él. */
async function comoUsuarioCon(store, permisos) {
  await entrar('tester', 'admin123');
  const n = ++contador;
  const rol = d(await call('roles:create', { name: `RolQA${n}`, permissions: permisos }));
  await call('users:create', { name: `UQA${n}`, username: `uqa${n}`, password: 'clave1234', roleId: rol.id });
  await call('auth:login', { username: `uqa${n}`, password: 'clave1234' });
  store.setSession(d(await call('auth:session', {})));
}

test('ventaTicket: el botón "quitar" de una promoción solo aparece con promociones.aplicar', async () => {
  const { store } = await montar();
  const { VentaTicketView } = await cargarVista('views/ventaTicket.js');

  const catProd = crearProductoCategoria('Frappés QA');
  const producto = d(await call('productos:create', { nombre: 'Frappé QA', categoria_id: catProd.id, foto: FOTO_PRUEBA, precio: 70 }));
  const hoy = d(await call('promociones:meta', {})).hoy;
  const promo = d(await call('promociones:create', {
    nombre: 'Promo QA', descripcion: '', tipo: 'monto_fijo', ambito: 'cuenta', dia_semana: 0,
    categoria_id: null, cantidad_requerida: 2, valor_tipo: 'monto', valor: 10,
    fecha_inicio: hoy, fecha_fin: hoy, productoIds: [],
  }));
  const venta = d(await call('ventas:abrir', { tipo: 'llevar' }));
  await call('ventas:agregarItem', { ventaId: venta.id, presentacionId: producto.presentaciones[0].id, cantidad: 1 });
  await call('ventas:aplicarPromocion', { ventaId: venta.id, promocionId: promo.id });

  await comoUsuarioCon(store, ['ventas.view', 'ventas.crear', 'promociones.aplicar']);
  const conPermiso = new dom.Nodo('main');
  await VentaTicketView(conPermiso, String(venta.id));
  assert.ok(conPermiso.boton('quitar'), 'con promociones.aplicar debe verse "quitar"');

  await comoUsuarioCon(store, ['ventas.view', 'ventas.crear']);
  const sinPermiso = new dom.Nodo('main');
  await VentaTicketView(sinPermiso, String(venta.id));
  assert.equal(sinPermiso.boton('quitar'), null, 'sin promociones.aplicar NO debe verse "quitar" (el backend lo rechazaría)');
});

test('productoEditor: precio, receta y edit son independientes (ver solo lo que corresponde)', async () => {
  const { store } = await montar();
  const { ProductoEditorView } = await cargarVista('views/productoEditor.js');
  const catProd = crearProductoCategoria('Cafés QA');
  const insumo = crearInsumo({ nombre: 'Leche QA' });
  const producto = d(await call('productos:create', { nombre: 'Café QA', categoria_id: catProd.id, foto: FOTO_PRUEBA, precio: 40 }));
  await call('productos:setReceta', { presentacionId: producto.presentaciones[0].id, items: [{ insumo_id: insumo.id, cantidad_base: 50, modo: 'siempre' }] });

  const casos = [
    { permisos: ['productos.precio'], espera: { 'Cambiar precio': true, 'Guardar receta': false, 'Guardar datos': false, '+ Tamaño': false } },
    { permisos: ['productos.receta'], espera: { 'Cambiar precio': false, 'Guardar receta': true, 'Guardar datos': false, '+ Tamaño': false } },
    { permisos: ['productos.edit'], espera: { 'Cambiar precio': false, 'Guardar receta': false, 'Guardar datos': true, '+ Tamaño': true } },
    { permisos: [], espera: { 'Cambiar precio': false, 'Guardar receta': false, 'Guardar datos': false, '+ Tamaño': false } },
  ];
  for (const { permisos, espera } of casos) {
    await comoUsuarioCon(store, ['productos.view', ...permisos]);
    const cont = new dom.Nodo('main');
    await ProductoEditorView(cont, String(producto.id));
    for (const [texto, debeVerse] of Object.entries(espera)) {
      const visible = !!cont.boton(texto);
      assert.equal(visible, debeVerse,
        `con [${permisos.join(',') || 'nada'}]: "${texto}" ${debeVerse ? 'debería verse' : 'NO debería verse'}`);
    }
  }
});

test('respaldos: "crear" y "restaurar" se ven cada uno solo con su propio permiso', async () => {
  const { store } = await montar();
  const { RespaldosView } = await cargarVista('views/respaldos.js');
  d(await call('respaldos:crear', {})); // que haya al menos uno en la lista

  const casos = [
    { permisos: [], crear: false, restaurar: false },
    { permisos: ['respaldos.crear'], crear: true, restaurar: false },
    { permisos: ['respaldos.restaurar'], crear: false, restaurar: true },
    { permisos: ['respaldos.crear', 'respaldos.restaurar'], crear: true, restaurar: true },
  ];
  for (const { permisos, crear, restaurar } of casos) {
    await comoUsuarioCon(store, ['respaldos.view', ...permisos]);
    const cont = new dom.Nodo('main');
    await RespaldosView(cont);
    assert.equal(!!cont.boton('💾 Hacer un respaldo ahora'), crear, `[${permisos.join(',') || 'nada'}]: "Hacer un respaldo ahora"`);
    assert.equal(!!cont.boton('Restaurar'), restaurar, `[${permisos.join(',') || 'nada'}]: "Restaurar"`);
  }
});

test('usuarios: nadie ve "Permisos"/"Desactivar" en su PROPIA fila, aunque tenga el permiso', async () => {
  const { store } = await montar();
  const { UsersView } = await cargarVista('views/users.js');
  const rol = d(await call('roles:create', { name: 'RolAutoQA', permissions: ['users.view', 'users.permissions', 'users.delete'] }));
  // El admin interno es invisible en el listado (por diseño): sin otro
  // usuario real de por medio, "Self QA" sería la única fila y la prueba de
  // "en otras filas sí se ven" no tendría nada que revisar.
  await call('users:create', { name: 'Otro QA', username: 'otroqa', password: 'clave1234' });
  await call('users:create', { name: 'Self QA', username: 'selfqa', password: 'clave1234', roleId: rol.id });
  await call('auth:login', { username: 'selfqa', password: 'clave1234' });
  store.setSession(d(await call('auth:session', {})));

  const cont = new dom.Nodo('main');
  await UsersView(cont);
  const miFila = cont.buscar((n) => n.tagName === 'TR' && n.textContent.includes('Self QA'))[0];
  assert.ok(miFila, 'se encuentra la propia fila');
  assert.equal(miFila.boton('Permisos'), null, 'no debe poder repartirse permisos a sí mismo');
  assert.equal(miFila.boton('Desactivar'), null, 'no debe poder desactivarse a sí mismo');

  // El bloqueo es "a uno mismo", no "a nadie": en otra fila sí deben verse.
  const otras = cont.buscar((n) => n.tagName === 'TR' && n !== miFila && (n.boton('Permisos') || n.boton('Desactivar')));
  assert.ok(otras.length > 0, 'en la fila de otros usuarios sí se ven "Permisos"/"Desactivar"');
});
