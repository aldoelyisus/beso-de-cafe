import { h } from '../lib/ui.js';
import { Combobox } from './combobox.js';

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let GRUPO_SEQ = 0;

/**
 * Editor de receta: insumos fijos + (opcional) grupos de opción.
 *
 *   insumos  = [{ id, nombre, unidad_base, costo_unitario }]  (activos)
 *   receta   = { items: [{insumo_id, cantidad_base, modo}], grupos: [{nombre, cantidad_base, modo, opciones:[insumo_id], insumo_default_id}] }
 *              (también acepta un arreglo suelto = items)
 *   opts.withModo   = true  -> columna "¿Cuándo?"
 *   opts.withGrupos = true  -> sección "Grupos de opción"
 *   opts.modos      = [{ key, label }]
 *   opts.onChange()
 *
 * Devuelve { element, getItems(), getGrupos(), getReceta(), totals() }.
 */
export function RecetaEditor(insumos, receta = {}, { withModo = false, withGrupos = false, modos = [], onChange = () => {} } = {}) {
  const items = Array.isArray(receta) ? receta : (receta.items || []);
  const grupos = (Array.isArray(receta) ? [] : receta.grupos) || [];
  const byId = new Map(insumos.map((i) => [String(i.id), i]));

  // ---------------- Insumos fijos ----------------
  const itemRows = [];
  const itemBody = h('tbody', {});

  function insumoSelect(selected) {
    const opts = insumos.map((i) => ({ value: String(i.id), label: `${i.nombre} (${i.unidad_base})` }));
    if (selected && !byId.has(String(selected))) {
      opts.push({ value: String(selected), label: `#${selected} (insumo inactivo)` });
    }
    return Combobox(opts, {
      value: selected != null ? String(selected) : '',
      placeholder: 'Escribe para buscar un insumo…',
    });
  }

  function modoSelect(selected) {
    return h('select', {}, ...modos.map((m) => {
      const o = h('option', { value: m.key }, m.label);
      if (m.key === (selected || 'siempre')) o.selected = true;
      return o;
    }));
  }

  function addItem(it = {}) {
    const sel = insumoSelect(it.insumo_id);
    const cant = h('input', { type: 'number', min: '0', step: 'any', value: it.cantidad_base != null ? it.cantidad_base : '' });
    const unidad = h('span', { class: 'muted' }, '');
    const costo = h('span', {}, '');
    const modoSel = withModo ? modoSelect(it.modo) : null;
    // Al corregir lo que faltaba, se le quita la marca roja al renglón.
    const despintar = () => { sel.classList.remove('falta'); cant.classList.remove('falta'); };
    sel.addEventListener('change', despintar);
    cant.addEventListener('input', despintar);

    const refresh = () => {
      const ins = byId.get(sel.value);
      unidad.textContent = ins ? ins.unidad_base : '';
      costo.textContent = ins ? money((Number(cant.value) || 0) * ins.costo_unitario) : '—';
    };
    const onEdit = () => { refresh(); onChange(); };
    sel.addEventListener('change', onEdit);
    cant.addEventListener('input', onEdit);
    if (modoSel) modoSel.addEventListener('change', onChange);

    const tr = h('tr', {},
      h('td', {}, sel),
      h('td', { style: 'white-space:nowrap' }, cant, ' ', unidad),
      withModo ? h('td', {}, modoSel) : null,
      h('td', { style: 'text-align:right' }, costo),
      h('td', {}, h('button', {
        type: 'button', class: 'btn ghost small', title: 'Quitar',
        onclick: () => { const i = itemRows.indexOf(row); if (i >= 0) itemRows.splice(i, 1); tr.remove(); onChange(); },
      }, '✕'))
    );
    const row = { sel, cant, modoSel, tr };
    itemRows.push(row);
    itemBody.appendChild(tr);
    refresh();
  }

  for (const it of items) addItem(it);

  const itemTable = h('table', { class: 'receta-table' },
    h('thead', {}, h('tr', {},
      h('th', {}, 'Insumo'), h('th', {}, 'Cantidad'),
      withModo ? h('th', {}, '¿Cuándo?') : null,
      h('th', { style: 'text-align:right' }, 'Costo'), h('th', {}, ''))),
    itemBody
  );

  // ---------------- Grupos de opción ----------------
  const grupoRows = [];
  const gruposWrap = h('div', {});

  function addGrupo(g = {}) {
    const gid = `g${++GRUPO_SEQ}`;
    const nombre = h('input', { type: 'text', value: g.nombre || '', placeholder: 'Leche, Base…' });
    const cant = h('input', { type: 'number', min: '0', step: 'any', value: g.cantidad_base != null ? g.cantidad_base : '' });
    const unidad = h('span', { class: 'muted' }, '');
    const modoSel = withModo ? modoSelect(g.modo) : null;
    const costoInfo = h('span', { class: 'muted' }, '');
    const optBody = h('tbody', {});
    const optRows = [];

    const refresh = () => {
      // unidad = la de la primera opción con insumo elegido
      let u = '';
      for (const r of optRows) { const ins = byId.get(r.sel.value); if (ins) { u = ins.unidad_base; break; } }
      unidad.textContent = u;
      // costo con la predeterminada
      const def = optRows.find((r) => r.radio.checked) || optRows.find((r) => r.sel.value);
      const ins = def ? byId.get(def.sel.value) : null;
      costoInfo.textContent = ins ? `costo con "${ins.nombre}": ${money((Number(cant.value) || 0) * ins.costo_unitario)}` : '';
    };
    const onEdit = () => { refresh(); onChange(); };

    function addOpt(insumoId = '') {
      const sel = insumoSelect(insumoId);
      const radio = h('input', { type: 'radio', name: gid, title: 'Predeterminada' });
      if (insumoId && (g.insumo_default_id === Number(insumoId) || (!g.insumo_default_id && optRows.length === 0))) radio.checked = true;
      sel.addEventListener('change', onEdit);
      radio.addEventListener('change', onChange);
      const tr = h('tr', {},
        h('td', { style: 'width:60%' }, sel),
        h('td', { style: 'text-align:center;white-space:nowrap' }, radio, ' ', h('span', { class: 'muted', style: 'font-size:11px' }, 'default')),
        h('td', {}, h('button', {
          type: 'button', class: 'btn ghost small', onclick: () => {
            const i = optRows.indexOf(o); if (i >= 0) optRows.splice(i, 1); tr.remove();
            if (radio.checked && optRows[0]) optRows[0].radio.checked = true;
            onEdit();
          },
        }, '✕'))
      );
      const o = { sel, radio, tr };
      optRows.push(o);
      optBody.appendChild(tr);
    }

    (g.opciones || []).forEach((oid) => addOpt(oid));
    if (!optRows.length) { addOpt(); addOpt(); }
    if (!optRows.some((r) => r.radio.checked) && optRows[0]) optRows[0].radio.checked = true;

    nombre.addEventListener('input', () => { nombre.classList.remove('falta'); onChange(); });
    cant.addEventListener('input', () => { cant.classList.remove('falta'); onEdit(); });
    if (modoSel) modoSel.addEventListener('change', onChange);

    const card = h('div', { class: 'grupo-card' },
      h('div', { class: 'grupo-head' },
        h('label', {}, 'Grupo ', nombre),
        h('label', {}, 'Cantidad ', cant, ' ', unidad),
        withModo ? h('label', {}, '¿Cuándo? ', modoSel) : null,
        h('button', {
          type: 'button', class: 'btn ghost small', title: 'Quitar grupo',
          onclick: () => { const i = grupoRows.indexOf(row); if (i >= 0) grupoRows.splice(i, 1); card.remove(); onChange(); },
        }, 'Quitar grupo')
      ),
      h('table', { class: 'receta-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Opción (insumo)'), h('th', { style: 'text-align:center' }, 'Predet.'), h('th', {}, ''))),
        optBody
      ),
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-top:6px' },
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { addOpt(); refresh(); } }, '+ Opción'),
        costoInfo
      )
    );

    const row = { nombre, cant, modoSel, optRows };
    grupoRows.push(row);
    gruposWrap.appendChild(card);
    refresh();
  }

  for (const g of grupos) addGrupo(g);

  // ---------------- Ensamblado ----------------
  const parts = [
    h('div', { class: 'section-title', style: 'margin-top:0' }, 'Insumos'),
    itemTable,
    h('div', { style: 'margin-top:8px' },
      h('button', { type: 'button', class: 'btn secondary small', onclick: () => addItem() }, '+ Agregar insumo')),
  ];
  if (withGrupos) {
    parts.push(
      h('div', { class: 'section-title' }, 'Grupos de opción (el cliente elige uno)'),
      h('div', { class: 'hint', style: 'margin-bottom:8px' }, 'Ej. "Leche": entera o deslactosada, misma cantidad. En la venta se elige cuál.'),
      gruposWrap,
      h('div', { style: 'margin-top:8px' },
        h('button', { type: 'button', class: 'btn secondary small', onclick: () => addGrupo() }, '+ Agregar grupo de opción'))
    );
  }

  const element = h('div', { class: 'receta-editor' }, ...parts);

  function getItems() {
    return itemRows.map((r) => ({
      insumo_id: Number(r.sel.value) || null,
      cantidad_base: Number(r.cant.value) || 0,
      modo: r.modoSel ? r.modoSel.value : 'siempre',
    })).filter((x) => x.insumo_id && x.cantidad_base > 0);
  }

  function getGrupos() {
    return grupoRows.map((g) => {
      const opciones = [...new Set(g.optRows.map((r) => Number(r.sel.value)).filter(Boolean))];
      const def = g.optRows.find((r) => r.radio.checked && r.sel.value);
      return {
        nombre: g.nombre.value.trim(),
        cantidad_base: Number(g.cant.value) || 0,
        modo: g.modoSel ? g.modoSel.value : 'siempre',
        opciones,
        insumo_default_id: def ? Number(def.sel.value) : (opciones[0] || null),
      };
    }).filter((g) => g.nombre || g.opciones.length);
  }

  function getReceta() { return { items: getItems(), grupos: getGrupos() }; }

  /**
   * Lo que la persona dejó a medias, en su idioma. Vacío = se puede guardar.
   *
   * Importante: `getItems()`/`getGrupos()` **descartan** los renglones
   * incompletos para no mandarle basura al servicio. Eso hacía que armar la
   * receta, olvidar una cantidad y guardar dijera "Receta guardada" mientras
   * ese insumo se perdía en el camino: el producto jamás lo descontaba y su
   * costo quedaba mal sin que nadie se enterara. Por eso quien guarda tiene
   * que preguntar primero aquí, y el renglón incompleto se marca en rojo.
   */
  function problemas() {
    const out = [];
    for (const r of itemRows) {
      const tieneInsumo = !!r.sel.value;
      const cantTexto = String(r.cant.value).trim();
      const cantNum = Number(cantTexto);
      const tieneCant = cantTexto !== '' && Number.isFinite(cantNum) && cantNum > 0;
      if (tieneInsumo === tieneCant) continue; // completo, o renglón en blanco que se ignora solo
      const ins = byId.get(r.sel.value);
      if (tieneInsumo) {
        r.cant.classList.add('falta');
        out.push(`Falta la cantidad de "${ins ? ins.nombre : 'un insumo'}".`);
      } else {
        r.sel.classList.add('falta');
        out.push(`Hay un renglón con cantidad ${cantTexto} pero sin insumo elegido.`);
      }
    }
    for (const g of grupoRows) {
      const nombre = g.nombre.value.trim();
      const elegidas = g.optRows.filter((r) => r.sel.value).length;
      const cantTexto = String(g.cant.value).trim();
      const cantNum = Number(cantTexto);
      const vacio = !nombre && !elegidas && cantTexto === '';
      if (vacio) continue; // grupo en blanco: se ignora solo
      const comoSeLlama = nombre ? `"${nombre}"` : 'un grupo de opción';
      if (!nombre) { g.nombre.classList.add('falta'); out.push('Falta ponerle nombre a un grupo de opción (ej. "Leche").'); }
      if (!(cantTexto !== '' && Number.isFinite(cantNum) && cantNum > 0)) {
        g.cant.classList.add('falta');
        out.push(`Falta la cantidad del grupo ${comoSeLlama}.`);
      }
      if (elegidas < 2) out.push(`El grupo ${comoSeLlama} necesita al menos 2 opciones para que el cliente pueda elegir.`);
    }
    return out;
  }

  function totals() {
    let aqui = 0;
    let llevar = 0;
    const add = (cant, modo, costoUnit) => {
      const l = cant * costoUnit;
      if (modo === 'siempre' || modo === 'aqui') aqui += l;
      if (modo === 'siempre' || modo === 'llevar') llevar += l;
    };
    for (const it of getItems()) {
      const ins = byId.get(String(it.insumo_id));
      if (ins) add(it.cantidad_base, it.modo, ins.costo_unitario);
    }
    for (const g of getGrupos()) {
      const insId = g.insumo_default_id || g.opciones[0];
      const ins = insId ? byId.get(String(insId)) : null;
      if (ins && g.cantidad_base > 0) add(g.cantidad_base, g.modo, ins.costo_unitario);
    }
    return { aqui, llevar };
  }

  return { element, getItems, getGrupos, getReceta, totals, problemas, addItem, addGrupo };
}
