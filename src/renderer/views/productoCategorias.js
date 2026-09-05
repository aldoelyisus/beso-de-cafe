import { h, esc, toast, confirmDialog, openModal, field } from '../lib/ui.js';
import { can } from '../lib/store.js';
import { Pager } from '../components/pager.js';
import { SearchBox, sortableTh } from '../components/filters.js';

const PAGE_SIZE = 15;

export async function ProductoCategoriasView(root) {
  root.innerHTML = '';
  const state = { page: 1, search: '', sort: 'nombre' };

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Categorías de productos'),
      h('div', { class: 'muted' }, 'Cómo se agrupan los productos en el menú (Frappés, Cafés, Postres…). Baja lógica.')
    ),
    can('producto_categorias.create')
      ? h('button', { class: 'btn', onclick: () => openModalCat(reload, null) }, '+ Nueva categoría')
      : null
  );

  const searchBox = SearchBox('Buscar categoría…', (v) => { state.search = v; state.page = 1; reload(); });
  const tableWrap = h('div', { class: 'card' });
  const pagerWrap = h('div', {});
  root.append(head, h('div', { class: 'toolbar' }, searchBox), tableWrap, pagerWrap);

  async function reload() {
    const res = await window.api.productoCategorias.list({ page: state.page, pageSize: PAGE_SIZE, search: state.search, sort: state.sort });
    tableWrap.innerHTML = '';
    pagerWrap.innerHTML = '';
    if (!res.rows.length) { tableWrap.appendChild(h('div', { class: 'empty' }, 'No hay categorías para este filtro.')); return; }
    const onSort = (k) => { state.sort = k; state.page = 1; reload(); };
    tableWrap.appendChild(h('table', {},
      h('thead', {}, h('tr', {},
        sortableTh('Categoría', { asc: 'nombre', desc: 'nombre_desc' }, state.sort, onSort),
        sortableTh('Productos', { asc: 'productos_asc', desc: 'productos_desc' }, state.sort, onSort),
        h('th', {}, 'Estado'), h('th', {}, ''))),
      h('tbody', {}, ...res.rows.map((c) => row(c)))
    ));
    pagerWrap.appendChild(Pager(res, (p) => { state.page = p; reload(); }));
  }

  function row(c) {
    const actions = h('div', { class: 'row-actions' });
    if (can('producto_categorias.edit')) {
      actions.appendChild(h('button', { class: 'btn small secondary', onclick: () => openModalCat(reload, c) }, 'Editar'));
    }
    if (can('producto_categorias.delete')) {
      actions.appendChild(c.is_active
        ? h('button', { class: 'btn small danger', onclick: async () => {
            if (!(await confirmDialog({ message: `¿Dar de baja la categoría "${c.nombre}"?`, confirmLabel: 'Dar de baja' }))) return;
            try { await window.api.productoCategorias.deactivate(c.id); toast('Categoría dada de baja', 'ok'); reload(); }
            catch (e) { toast(e.message, 'err'); }
          } }, 'Baja')
        : h('button', { class: 'btn small secondary', onclick: async () => {
            try { await window.api.productoCategorias.activate(c.id); toast('Categoría reactivada', 'ok'); reload(); }
            catch (e) { toast(e.message, 'err'); }
          } }, 'Reactivar'));
    }
    return h('tr', { style: c.is_active ? '' : 'opacity:.55' },
      h('td', {}, h('strong', {}, esc(c.nombre))),
      h('td', {}, String(c.producto_count)),
      h('td', {}, c.is_active ? h('span', { class: 'badge on' }, 'Activa') : h('span', { class: 'badge off' }, 'Baja')),
      h('td', {}, actions)
    );
  }

  await reload();
}

function openModalCat(reload, cat) {
  const nombre = h('input', { type: 'text', value: cat ? cat.nombre : '' });
  openModal({
    title: cat ? `Editar categoría: ${cat.nombre}` : 'Nueva categoría de producto',
    body: h('div', {}, field('Nombre', nombre)),
    buttons: [
      { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
      { label: cat ? 'Guardar' : 'Crear', kind: 'primary', onClick: async (close) => {
        if (cat) await window.api.productoCategorias.update(cat.id, { nombre: nombre.value.trim() });
        else await window.api.productoCategorias.create({ nombre: nombre.value.trim() });
        toast(cat ? 'Categoría actualizada' : 'Categoría creada', 'ok');
        close(); reload();
      } },
    ],
  });
}
