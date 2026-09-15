import { h, esc, toast, confirmDialog, openModal, field } from '../lib/ui.js';
import { can } from '../lib/store.js';
import { Pager } from '../components/pager.js';
import { ImagePicker } from '../components/imagePicker.js';
import { SearchBox, ChipRow, Toggle, sortableTh } from '../components/filters.js';

const PAGE_SIZE = 15;
const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function precioRango(p) {
  if (p.precio_min == null) return h('span', { class: 'muted' }, 'sin precio');
  return p.precio_min === p.precio_max ? money(p.precio_min) : `${money(p.precio_min)} – ${money(p.precio_max)}`;
}

export async function ProductosView(root) {
  root.innerHTML = '';
  const state = { search: '', categoriaId: '', soloAgotados: false, sort: 'nombre', page: 1 };
  const cats = await window.api.productoCategorias.options();

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Productos'),
      h('div', { class: 'muted' }, 'El menú. Cada producto tiene 1 o más tamaños; el precio y la receta viven en cada tamaño.')
    ),
    can('productos.create')
      ? h('button', { class: 'btn', onclick: () => openNuevoProducto(cats) }, '+ Nuevo producto')
      : null
  );

  const searchBox = SearchBox('Buscar producto…', (v) => { state.search = v; state.page = 1; load(); });
  const agotadoToggle = Toggle('Solo agotados', false, (on) => { state.soloAgotados = on; state.page = 1; load(); });
  const catChips = ChipRow(
    [{ value: '', label: 'Todas' }, ...cats.map((c) => ({ value: String(c.id), label: c.nombre }))],
    state.categoriaId,
    (v) => { state.categoriaId = v; state.page = 1; load(); }
  );

  const toolbar = h('div', {},
    h('div', { class: 'toolbar' }, searchBox, agotadoToggle),
    h('div', { class: 'toolbar' }, h('span', { class: 'chip-label' }, 'Categoría'), catChips)
  );
  const tableWrap = h('div', { class: 'card' });
  const pagerWrap = h('div', {});
  root.append(head, toolbar, tableWrap, pagerWrap);

  async function load() {
    tableWrap.innerHTML = '';
    pagerWrap.innerHTML = '';
    const res = await window.api.productos.list({ includeInactive: true, pageSize: PAGE_SIZE, ...state });
    if (!res.rows.length) { tableWrap.appendChild(h('div', { class: 'empty' }, 'Sin productos para este filtro.')); return; }
    const onSort = (k) => { state.sort = k; state.page = 1; load(); };
    tableWrap.appendChild(h('table', {},
      h('thead', {}, h('tr', {},
        sortableTh('Producto', { asc: 'nombre', desc: 'nombre_desc' }, state.sort, onSort),
        h('th', {}, 'Categoría'), h('th', {}, 'Tamaños'),
        sortableTh('Precio', { asc: 'precio_asc', desc: 'precio_desc' }, state.sort, onSort),
        h('th', {}, 'Receta'), h('th', {}, 'Estado'), h('th', {}, ''))),
      h('tbody', {}, ...res.rows.map((p) => row(p)))
    ));
    pagerWrap.appendChild(Pager(res, (pg) => { state.page = pg; load(); }));
  }

  function row(p) {
    const actions = h('div', { class: 'row-actions' });
    actions.appendChild(h('button', { class: 'btn small secondary', onclick: () => { location.hash = `#/productos/${p.id}`; } },
      can('productos.receta') || can('productos.edit') ? 'Abrir' : 'Ver'));
    if (can('productos.edit')) {
      actions.appendChild(h('button', {
        class: 'btn small ' + (p.agotado ? 'secondary' : 'ghost'),
        onclick: async () => {
          try { await window.api.productos.setAgotado(p.id, !p.agotado); toast(p.agotado ? 'Disponible' : 'Marcado agotado', 'ok'); load(); }
          catch (e) { toast(e.message, 'err'); }
        },
      }, p.agotado ? 'Reactivar' : 'Agotar'));
    }
    if (can('productos.delete')) {
      actions.appendChild(p.is_active
        ? h('button', { class: 'btn small danger', onclick: async () => {
            if (!(await confirmDialog({ message: `¿Dar de baja "${p.nombre}"?`, confirmLabel: 'Dar de baja' }))) return;
            try { await window.api.productos.deactivate(p.id); toast('Producto dado de baja', 'ok'); load(); }
            catch (e) { toast(e.message, 'err'); }
          } }, 'Baja')
        : h('button', { class: 'btn small secondary', onclick: async () => {
            try { await window.api.productos.activate(p.id); toast('Producto reactivado', 'ok'); load(); }
            catch (e) { toast(e.message, 'err'); }
          } }, 'Reactivar'));
    }

    return h('tr', { style: p.is_active ? '' : 'opacity:.55' },
      h('td', {},
        h('div', { class: 'prod-fila' },
          p.foto
            ? h('img', { class: 'prod-mini', src: p.foto, alt: '' })
            : h('div', { class: 'prod-mini vacia', title: 'Sin foto' }, '📷'),
          h('div', {},
            h('strong', {}, esc(p.nombre)),
            p.agotado ? h('span', { class: 'badge off', style: 'margin-left:8px' }, 'Agotado') : null
          )
        )
      ),
      h('td', {}, p.categoria_nombre ? esc(p.categoria_nombre) : h('span', { class: 'muted' }, 'Sin categoría')),
      h('td', {}, String(p.num_presentaciones)),
      h('td', {}, precioRango(p)),
      h('td', {}, p.receta_completa
        ? h('span', { class: 'badge on' }, 'Completa')
        : h('span', { class: 'badge off' }, 'Falta receta')),
      h('td', {}, p.is_active ? h('span', { class: 'badge on' }, 'Activo') : h('span', { class: 'badge off' }, 'Baja')),
      h('td', {}, actions)
    );
  }

  await load();
}

// ---- Modal: nuevo producto ----
async function openNuevoProducto(cats) {
  const modificadores = await window.api.modificadores.options();

  const nombre = h('input', { type: 'text' });
  const categoria = h('select', {},
    h('option', { value: '' }, 'Sin categoría'),
    ...cats.map((c) => h('option', { value: String(c.id) }, c.nombre))
  );
  const descripcion = h('input', { type: 'text' });
  const foto = ImagePicker({});

  // tamaños
  const tamRows = [];
  const tamBody = h('tbody', {});
  function addTam(nom = '', precio = '') {
    const n = h('input', { type: 'text', value: nom, placeholder: 'Único / Chico / Grande' });
    const p = h('input', { type: 'number', min: '0', step: 'any', value: precio, placeholder: '$' });
    const tr = h('tr', {},
      h('td', {}, n),
      h('td', { style: 'width:110px' }, p),
      h('td', {}, h('button', { type: 'button', class: 'btn ghost small', onclick: () => {
        const i = tamRows.indexOf(rowObj); if (i >= 0) tamRows.splice(i, 1); tr.remove();
      } }, '✕'))
    );
    const rowObj = { n, p, tr };
    tamRows.push(rowObj);
    tamBody.appendChild(tr);
  }
  addTam('Único', '');

  const modChecks = modificadores.map((m) => {
    const cb = h('input', { type: 'checkbox', value: String(m.id) });
    return { m, cb, el: h('label', { class: 'perm-check' }, cb, h('span', {}, `${m.nombre} (+${money(m.precio_extra)})`)) };
  });

  openModal({
    title: 'Nuevo producto',
    wide: true,
    body: h('div', {},
      h('div', { class: 'grid-2' },
        field('Nombre', nombre),
        field('Categoría', categoria)
      ),
      field('Descripción', descripcion, 'Opcional'),
      h('div', { class: 'section-title' }, 'Foto'),
      foto.element,
      h('div', { class: 'section-title' }, 'Tamaños y precio'),
      h('div', { class: 'hint', style: 'margin-bottom:8px' }, 'Un solo tamaño para casi todo. Los frappés llevan "Chico" y "Grande".'),
      h('table', { class: 'receta-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Tamaño'), h('th', {}, 'Precio'), h('th', {}, ''))),
        tamBody
      ),
      h('button', { type: 'button', class: 'btn secondary small', style: 'margin-top:8px', onclick: () => addTam() }, '+ Agregar tamaño'),
      modChecks.length ? h('div', { class: 'section-title' }, 'Modificadores que admite') : null,
      ...modChecks.map((c) => c.el)
    ),
    buttons: [
      { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
      { label: 'Crear y configurar receta', kind: 'primary', onClick: async (close) => {
        const presentaciones = tamRows
          .map((r) => ({ nombre: r.n.value.trim(), precio: Number(r.p.value) }))
          .filter((r) => r.nombre || Number.isFinite(r.precio));
        if (!presentaciones.length) throw new Error('Agrega al menos un tamaño con su precio.');
        if (!foto.getDataUrl()) throw new Error('Falta la foto del producto: es como se reconoce en el punto de venta.');
        const producto = await window.api.productos.create({
          nombre: nombre.value.trim(),
          categoria_id: categoria.value || null,
          descripcion: descripcion.value.trim(),
          foto: foto.getDataUrl(),
          presentaciones,
          modificadorIds: modChecks.filter((c) => c.cb.checked).map((c) => Number(c.m.id)),
        });
        toast('Producto creado. Ahora arma su receta.', 'ok');
        close();
        location.hash = `#/productos/${producto.id}`;
      } },
    ],
  });
}
