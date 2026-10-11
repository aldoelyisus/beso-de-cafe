'use strict';

/**
 * Pantalla de Corte de caja — el flujo "una cosa a la vez".
 *
 * Se rediseñó porque la dueña dijo que se veía "reburujado": antes mostraba
 * de golpe 13 números, dos tablas y dos conceptos separados (turno y día).
 * Estas pruebas fijan lo que no debe volver a perderse:
 *   - la pantalla ofrece UNA acción según el estado;
 *   - el arqueo no se puede cerrar con el campo vacío (era un bug real que
 *     dejaba un faltante falso a nombre del cajero);
 *   - cerrar la caja encadena la pregunta del día, en vez de dejarla como
 *     un botón aparte que había que recordar.
 *
 * (Sobre `beforeEach`: ver la nota en permisosVisibilidad.test.js — todos los
 * archivos de prueba corren en un mismo proceso, así que el montaje va en una
 * función que cada test llama a mano.)
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { getDb, crearProductoCategoria, FOTO_PRUEBA } = require('../helpers/setup');
const { call, entrar } = require('../helpers/ipc');
const { seed } = require('../../src/main/db/seed');
const { hashPassword } = require('../../src/main/security/password');
const dom = require('../helpers/dom');
const { cargarVista } = require('../helpers/vistaEsm');

require('../../src/preload/index.js');

const d = (r) => { if (!r.ok) throw new Error(r.error); return r.data; };
const texto = (n) => String(n.textContent).replace(/\s+/g, ' ').trim();
const espera = (ms = 20) => new Promise((r) => setTimeout(r, ms));

async function montar() {
  const D = dom.instalar();
  seed();
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = 1').run(hashPassword('admin123'));
  await entrar('tester', 'admin123');
  const store = await cargarVista('lib/store.js');
  store.setSession(d(await call('auth:session', {})));
  const { CajaView } = await cargarVista('views/caja.js');
  const pintar = async () => { const c = new dom.Nodo('main'); await CajaView(c); return c; };
  return { D, store, pintar };
}

/** Un producto vendible, para que la caja tenga ventas en efectivo. */
async function venderEnEfectivo(monto = 50) {
  const cat = crearProductoCategoria('Cafés QA');
  const p = d(await call('productos:create', { nombre: `Café QA ${monto}`, categoria_id: cat.id, foto: FOTO_PRUEBA, precio: monto }));
  const v = d(await call('ventas:abrir', { tipo: 'llevar' }));
  const c = d(await call('ventas:agregarItem', { ventaId: v.id, presentacionId: p.presentaciones[0].id, cantidad: 1 }));
  await call('ventas:cobrar', { ventaId: v.id, itemIds: c.items_sin_pagar, metodo: 'efectivo' });
}

test('caja: con la caja cerrada solo se ofrece abrirla', async () => {
  const { pintar } = await montar();
  const cont = await pintar();
  const botones = cont.buscar((n) => n.tagName === 'BUTTON').map(texto);
  assert.deepEqual(botones, ['Abrir caja'], 'una sola acción posible');
  assert.match(texto(cont), /La caja está cerrada/);
});

test('caja abierta: un solo número grande (lo que debe haber en el cajón) y el detalle plegado', async () => {
  const { pintar } = await montar();
  await call('caja:abrir', { fondo_inicial: 500 });
  await venderEnEfectivo(100);
  await call('caja:movimiento', { tipo: 'retiro', monto: 160, concepto: 'servilletas' });

  const cont = await pintar();
  const total = cont.buscar((n) => n.className === 'caja-total')[0];
  assert.ok(total, 'hay un bloque con el total');
  assert.match(texto(total), /\$440\.00/, '500 + 100 − 160');

  // nada de tablas ni montones de KPIs de entrada: ese era el "reburujado"
  assert.equal(cont.buscar((n) => n.tagName === 'TABLE').length, 0, 'ninguna tabla abierta de golpe');
  assert.ok(cont.buscar((n) => n.className === 'k').length <= 2, 'a lo mucho un par de rótulos de número');

  // el movimiento existe, pero detrás del plegable
  assert.equal(cont.buscar((n) => /servilletas/.test(n.textContent || '')).length, 0, 'los movimientos empiezan plegados');
  await cont.buscar((n) => n.tagName === 'BUTTON' && /Ver movimientos/.test(texto(n)))[0].dispatch('click');
  assert.ok(cont.buscar((n) => /servilletas/.test(n.textContent || '')).length > 0, 'al abrirlo sí se ven');
});

test('cerrar la caja: con el conteo vacío NO cierra, y avisa qué falta', async () => {
  const { D, pintar } = await montar();
  await call('caja:abrir', { fondo_inicial: 300 });
  const cont = await pintar();

  await cont.boton('Cerrar caja').dispatch('click');
  await espera();
  D.limpiarToasts();
  await D.modalAbierto().boton('Cerrar caja').dispatch('click');
  await espera();

  assert.match(D.toasts().join(' | '), /Escribe cuánto efectivo contaste/i);
  assert.ok(D.modalAbierto(), 'el modal sigue abierto: no se cerró la caja a ciegas');
  assert.equal(d(await call('caja:corte', {})).estado, 'abierto', 'la caja sigue abierta');
});

test('cerrar la caja encadena la pregunta del día (ya no es un botón aparte que recordar)', async () => {
  const { D, pintar } = await montar();
  await call('caja:abrir', { fondo_inicial: 300 });
  const cont = await pintar();

  await cont.boton('Cerrar caja').dispatch('click');
  await espera();
  const input = D.modalAbierto().buscar((n) => n.tagName === 'INPUT' && n.attrs.type === 'number')[0];
  input.value = '290';
  await input.dispatch('input');
  assert.match(texto(D.modalAbierto()), /Faltan \$10\.00/, 'calcula la diferencia mientras escribe');

  await D.modalAbierto().boton('Cerrar caja').dispatch('click');
  await espera(40);

  const paso2 = D.modalAbierto();
  assert.ok(paso2 && /¿Ya terminaste el día\?/.test(texto(paso2)), 'pregunta por el día enseguida');
  assert.ok(paso2.boton('Todavía no') && paso2.boton('Sí, cerrar el día'), 'con las dos salidas claras');

  await paso2.boton('Sí, cerrar el día').dispatch('click');
  await espera(40);
  assert.equal(d(await call('cierre:estado', {})).cerrado, true, 'el día quedó cerrado desde el mismo flujo');
});
