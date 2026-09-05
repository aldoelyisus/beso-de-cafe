import { h, esc, toast, confirmDialog, openModal, field } from '../lib/ui.js';
import { can } from '../lib/store.js';
import { Pager } from '../components/pager.js';
import { Segmented, SearchBox, sortableTh } from '../components/filters.js';

const SHORT_UNIT = { ml: 'ml', g: 'g', pieza: 'pza' };

const PAGE_SIZE = 15;

export async function InsumoCategoriasView(root) {
  root.innerHTML = '';
  const state = { page: 1, search: '', unidad: '', sort: 'nombre' };
  const meta = await window.api.inventory.meta();
  const unidades = meta.unidades;
  const unitLabel = (k) => (unidades.find((u) => u.key === k) || {}).label || k;

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Categorías de insumos'),
      h('div', { class: 'muted' }, 'Baja lógica: al dar de baja una categoría, los insumos que ya la usan la conservan; solo deja de ofrecerse para insumos nuevos.')
    ),
    can('insumo_categorias.create')
      ? h('button', { class: 'btn', onclick: () => openCatModal(reload, null, unidades) }, '+ Nueva categoría')
      : null
  );

  const searchBox = SearchBox('Buscar categoría…', (v) => {
    state.search = v; state.page = 1; reload();
  });

  const unidadChips = Segmented(
    [{ value: '', label: 'Todas' }, ...unidades.map((u) => ({ value: u.key, label: SHORT_UNIT[u.key] || u.key }))],
    state.unidad,
    (v) => { state.unidad = v; state.page = 1; reload(); },
    'Unidad'
  );

  const toolbar = h('div', { class: 'toolbar' }, searchBox, unidadChips);
  const tableWrap = h('div', { class: 'card' });
  const pagerWrap = h('div', {});
  root.append(head, toolbar, tableWrap, pagerWrap);

  async function reload() {
    const res = await window.api.insumoCategorias.list({
      page: state.page, pageSize: PAGE_SIZE,
      search: state.search, unidad: state.unidad, sort: state.sort,
    });
    tableWrap.innerHTML = '';
    pagerWrap.innerHTML = '';
    if (!res.rows.length) {
      tableWrap.appendChild(h('div', { class: 'empty' }, 'No hay categorías para este filtro.'));
      return;
    }
    const onSort = (key) => { state.sort = key; state.page = 1; reload(); };
    tableWrap.appendChild(
      h('table', {},
        h('thead', {}, h('tr', {},
          sortableTh('Categoría', { asc: 'nombre', desc: 'nombre_desc' }, state.sort, onSort),
          h('th', {}, 'Unidad sugerida'),
          sortableTh('Insumos', { asc: 'insumos_asc', desc: 'insumos_desc' }, state.sort, onSort),
          h('th', {}, 'Estado'),
          h('th', {}, ''))),
        h('tbody', {}, ...res.rows.map((c) => row(c)))
      )
    );
    pagerWrap.appendChild(Pager(res, (p) => { state.page = p; reload(); }));
  }

  function row(c) {
    const actions = h('div', { class: 'row-actions' });
    if (can('insumo_categorias.edit')) {
      actions.appendChild(h('button', { class: 'btn small secondary', onclick: () => openCatModal(reload, c, unidades) }, 'Editar'));
    }
    if (can('insumo_categorias.delete')) {
      actions.appendChild(c.is_active
        ? h('button', {
            class: 'btn small danger',
            onclick: async () => {
              if (!(await confirmDialog({ message: `¿Dar de baja la categoría "${c.nombre}"?`, confirmLabel: 'Dar de baja' }))) return;
              try { await window.api.insumoCategorias.deactivate(c.id); toast('Categoría dada de baja', 'ok'); reload(); }
              catch (e) { toast(e.message, 'err'); }
            },
          }, 'Baja')
        : h('button', {
            class: 'btn small secondary',
            onclick: async () => {
              try { await window.api.insumoCategorias.activate(c.id); toast('Categoría reactivada', 'ok'); reload(); }
              catch (e) { toast(e.message, 'err'); }
            },
          }, 'Reactivar'));
    }
    return h('tr', { style: c.is_active ? '' : 'opacity:.55' },
      h('td', {}, h('strong', {}, esc(c.nombre))),
      h('td', {}, esc(unitLabel(c.unidad_sugerida))),
      h('td', {}, String(c.insumo_count)),
      h('td', {}, c.is_active ? h('span', { class: 'badge on' }, 'Activa') : h('span', { class: 'badge off' }, 'Baja')),
      h('td', {}, actions)
    );
  }

  await reload();
}

function unitSelect(unidades, selected) {
  return h('select', {}, ...unidades.map((u) => {
    const o = h('option', { value: u.key }, `${u.label} — ${u.tipo}`);
    if (u.key === selected) o.selected = true;
    return o;
  }));
}

function openCatModal(reload, cat, unidades) {
  const nombre = h('input', { type: 'text', value: cat ? cat.nombre : '' });
  const unidad = unitSelect(unidades, cat ? cat.unidad_sugerida : 'pieza');

  openModal({
    title: cat ? `Editar categoría: ${cat.nombre}` : 'Nueva categoría de insumo',
    body: h('div', {},
      field('Nombre', nombre),
      field('Unidad sugerida', unidad, 'Se autocompleta al crear un insumo de esta categoría (se puede cambiar).')
    ),
    buttons: [
      { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
      {
        label: cat ? 'Guardar' : 'Crear',
        kind: 'primary',
        onClick: async (close) => {
          const data = { nombre: nombre.value.trim(), unidad_sugerida: unidad.value };
          if (cat) await window.api.insumoCategorias.update(cat.id, data);
          else await window.api.insumoCategorias.create(data);
          toast(cat ? 'Categoría actualizada' : 'Categoría creada', 'ok');
          close();
          reload();
        },
      },
    ],
  });
}
