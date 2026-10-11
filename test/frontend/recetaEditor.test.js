'use strict';

/**
 * Editor de receta — que nada se pierda en silencio.
 *
 * Bug real que motivó estas pruebas: el editor DESCARTABA los renglones
 * incompletos antes de mandarlos al servicio (`getItems()` filtra los que no
 * tienen cantidad). Así, armar una receta de 2 insumos, olvidar una cantidad
 * y guardar decía **"Receta guardada"** mientras ese insumo se perdía: el
 * producto nunca lo descontaba del inventario y su costo quedaba mal para
 * siempre, sin que nadie se enterara. El servicio sí tenía el mensaje
 * correcto preparado, pero nunca llegaba a ejecutarse.
 *
 * (Sobre `beforeEach`: ver la nota en permisosVisibilidad.test.js.)
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { getDb, crearProductoCategoria, crearInsumo, FOTO_PRUEBA } = require('../helpers/setup');
const { call, entrar } = require('../helpers/ipc');
const { seed } = require('../../src/main/db/seed');
const { hashPassword } = require('../../src/main/security/password');
const dom = require('../helpers/dom');
const { cargarVista } = require('../helpers/vistaEsm');

require('../../src/preload/index.js');

const d = (r) => { if (!r.ok) throw new Error(r.error); return r.data; };
const espera = (ms = 40) => new Promise((r) => setTimeout(r, ms));

async function montar() {
  const D = dom.instalar();
  seed();
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = 1').run(hashPassword('admin123'));
  await entrar('tester', 'admin123');
  const store = await cargarVista('lib/store.js');
  store.setSession(d(await call('auth:session', {})));
  const { ProductoEditorView } = await cargarVista('views/productoEditor.js');

  const leche = crearInsumo({ nombre: 'Leche entera', unidad_base: 'ml', factor_compra: 1000, costo_compra: 25 });
  const base = crearInsumo({ nombre: 'Base para frappé', unidad_base: 'g', factor_compra: 1000, costo_compra: 120 });
  const cat = crearProductoCategoria('Frappés QA');
  const prod = d(await call('productos:create', { nombre: 'Frappé QA', categoria_id: cat.id, foto: FOTO_PRUEBA, precio: 70 }));

  const abrirEditor = async () => {
    const cont = new dom.Nodo('main');
    await ProductoEditorView(cont, String(prod.id));
    return cont;
  };
  /** Pone insumo y/o cantidad en el renglón n (0-based) del editor abierto. */
  const llenarRenglon = async (cont, n, { insumoId, cantidad } = {}) => {
    const combos = cont.buscar((x) => x.className === 'combobox');
    const cants = cont.buscar((x) => x.tagName === 'INPUT' && x.attrs.type === 'number'
      && x.parentNode && x.parentNode.tagName === 'TD');
    if (insumoId !== undefined) { combos[n].value = String(insumoId); await combos[n].dispatch('change'); }
    if (cantidad !== undefined) { cants[n].value = String(cantidad); await cants[n].dispatch('input'); }
  };
  const recetaGuardada = async () => d(await call('productos:get', { id: prod.id })).presentaciones[0].receta;

  return { D, prod, leche, base, abrirEditor, llenarRenglon, recetaGuardada };
}

test('receta: un renglón sin cantidad NO se guarda en silencio — avisa cuál es', async () => {
  const { D, leche, base, abrirEditor, llenarRenglon, recetaGuardada } = await montar();
  const cont = await abrirEditor();
  await cont.boton('+ Agregar insumo').dispatch('click');
  await cont.boton('+ Agregar insumo').dispatch('click');
  await llenarRenglon(cont, 0, { insumoId: base.id, cantidad: 40 });
  await llenarRenglon(cont, 1, { insumoId: leche.id }); // ← se le olvida la cantidad

  D.limpiarToasts();
  await cont.boton('Guardar receta').dispatch('click');
  await espera();

  assert.match(D.toasts().join(' | '), /Falta la cantidad de "Leche entera"/,
    'tiene que decir exactamente a qué insumo le falta');
  assert.equal((await recetaGuardada()).length, 0, 'no guarda a medias: o completa o nada');
});

test('receta: al completar la cantidad sí guarda los dos insumos', async () => {
  const { D, leche, base, abrirEditor, llenarRenglon, recetaGuardada } = await montar();
  const cont = await abrirEditor();
  await cont.boton('+ Agregar insumo').dispatch('click');
  await cont.boton('+ Agregar insumo').dispatch('click');
  await llenarRenglon(cont, 0, { insumoId: base.id, cantidad: 40 });
  await llenarRenglon(cont, 1, { insumoId: leche.id, cantidad: 100 });

  D.limpiarToasts();
  await cont.boton('Guardar receta').dispatch('click');
  await espera();

  assert.match(D.toasts().join(' | '), /Receta guardada/);
  const receta = await recetaGuardada();
  assert.equal(receta.length, 2, 'los dos insumos quedaron en la receta');
  assert.deepEqual(receta.map((r) => r.cantidad_base).sort((a, b) => a - b), [40, 100]);
});

test('receta: una cantidad sin insumo elegido tampoco pasa de noche', async () => {
  const { D, abrirEditor, llenarRenglon, recetaGuardada } = await montar();
  const cont = await abrirEditor();
  await cont.boton('+ Agregar insumo').dispatch('click');
  await llenarRenglon(cont, 0, { cantidad: 25 }); // cantidad sin insumo

  D.limpiarToasts();
  await cont.boton('Guardar receta').dispatch('click');
  await espera();

  assert.match(D.toasts().join(' | '), /sin insumo elegido/i);
  assert.equal((await recetaGuardada()).length, 0);
});

test('receta: dejarla vacía pide confirmación (no se borra sin avisar)', async () => {
  const { D, base, abrirEditor, llenarRenglon, recetaGuardada } = await montar();

  // primero se guarda una receta buena
  let cont = await abrirEditor();
  await cont.boton('+ Agregar insumo').dispatch('click');
  await llenarRenglon(cont, 0, { insumoId: base.id, cantidad: 40 });
  await cont.boton('Guardar receta').dispatch('click');
  await espera();
  assert.equal((await recetaGuardada()).length, 1);

  // ahora se quita el renglón y se guarda: debe preguntar antes
  cont = await abrirEditor();
  await cont.buscar((n) => n.tagName === 'BUTTON' && n.textContent.trim() === '✕')[0].dispatch('click');
  // Sin `await`: el handler se queda esperando la respuesta del diálogo, que
  // es justo lo que la prueba va a contestar enseguida.
  const guardando = cont.boton('Guardar receta').dispatch('click');
  await espera();

  const aviso = D.modalAbierto();
  assert.ok(aviso && /sin receta/i.test(aviso.textContent), 'pregunta antes de dejarlo sin receta');
  assert.equal((await recetaGuardada()).length, 1, 'mientras no confirme, la receta sigue intacta');

  await aviso.boton('Guardar sin receta').dispatch('click');
  await guardando;
  await espera();
  assert.equal((await recetaGuardada()).length, 0, 'si confirma, sí se vacía');
});
