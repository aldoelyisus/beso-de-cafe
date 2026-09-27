import { h, esc, toast, confirmDialog, openModal, field } from '../lib/ui.js';
import { can } from '../lib/store.js';
import { Pager } from '../components/pager.js';
import { SearchBox, Segmented, ChipRow } from '../components/filters.js';

const PAGE_SIZE = 15;
const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TIPO_LABEL = { combo: 'Combo', dia: 'Descuento por día', monto_fijo: 'Monto fijo' };

export async function PromocionesView(root) {
  root.innerHTML = '';
  const state = { page: 1, search: '', tipo: '' };
  const [meta, categorias, productos] = await Promise.all([
    window.api.promociones.meta(),
    window.api.productoCategorias.options(),
    window.api.productos.catalogo(),
  ]);

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Promociones'),
      h('div', { class: 'muted' }, 'Combos, descuentos por día y montos fijos. Toda promoción necesita fecha de inicio y fin. En la venta se aplica una a la vez.')
    ),
    can('promociones.create')
      ? h('button', { class: 'btn', onclick: () => openForm(reload, null, { meta, categorias, productos }) }, '+ Nueva promoción')
      : null
  );

  const searchBox = SearchBox('Buscar promoción…', (v) => { state.search = v; state.page = 1; reload(); });
  const tipoChips = Segmented(
    [{ value: '', label: 'Todas' }, { value: 'combo', label: 'Combos' }, { value: 'dia', label: 'Por día' }, { value: 'monto_fijo', label: 'Monto fijo' }],
    '', (v) => { state.tipo = v; state.page = 1; reload(); }, 'Tipo'
  );

  const tableWrap = h('div', { class: 'card' });
  const pagerWrap = h('div', {});
  root.append(head, h('div', { class: 'toolbar' }, searchBox, tipoChips), tableWrap, pagerWrap);

  async function reload() {
    const res = await window.api.promociones.list({ page: state.page, pageSize: PAGE_SIZE, search: state.search, tipo: state.tipo });
    tableWrap.innerHTML = '';
    pagerWrap.innerHTML = '';
    if (!res.rows.length) { tableWrap.appendChild(h('div', { class: 'empty' }, 'No hay promociones para este filtro.')); return; }
    tableWrap.appendChild(h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Promoción'), h('th', {}, 'Tipo'), h('th', {}, 'Vigencia'), h('th', {}, 'Estado'), h('th', {}, ''))),
      h('tbody', {}, ...res.rows.map((p) => row(p)))
    ));
    pagerWrap.appendChild(Pager(res, (pg) => { state.page = pg; reload(); }));
  }

  function row(p) {
    const actions = h('div', { class: 'row-actions' });
    if (can('promociones.edit')) actions.appendChild(h('button', { class: 'btn small secondary', onclick: () => openForm(reload, p.id, { meta, categorias, productos }) }, 'Editar'));
    if (can('promociones.delete')) {
      actions.appendChild(p.is_active
        ? h('button', { class: 'btn small danger', onclick: async () => {
            if (!(await confirmDialog({ message: `¿Desactivar "${p.nombre}"?`, confirmLabel: 'Desactivar' }))) return;
            try { await window.api.promociones.setActive(p.id, false); toast('Promoción desactivada', 'ok'); reload(); }
            catch (e) { toast(e.message, 'err'); }
          } }, 'Desactivar')
        : h('button', { class: 'btn small secondary', onclick: async () => {
            try { await window.api.promociones.setActive(p.id, true); toast('Promoción activada', 'ok'); reload(); }
            catch (e) { toast(e.message, 'err'); }
          } }, 'Activar'));
    }
    return h('tr', { style: p.is_active ? '' : 'opacity:.55' },
      h('td', {}, h('strong', {}, esc(p.nombre)), p.descripcion ? h('div', { class: 'sub', style: 'font-size:11px;color:var(--ink-soft)' }, esc(p.descripcion)) : null),
      h('td', {}, TIPO_LABEL[p.tipo] || p.tipo, p.tipo === 'dia' ? ` · ${meta.dias[p.dia_semana]}` : ''),
      h('td', {}, `${p.fecha_inicio} → ${p.fecha_fin}`),
      h('td', {}, !p.is_active
        ? h('span', { class: 'badge off' }, 'Inactiva')
        : p.vigente ? h('span', { class: 'badge on' }, 'Vigente') : h('span', { class: 'badge inherit' }, 'Fuera de fecha')),
      h('td', {}, actions)
    );
  }

  await reload();
}

async function openForm(reload, id, { meta, categorias, productos }) {
  const p = id ? await window.api.promociones.get(id) : null;

  const nombre = h('input', { type: 'text', value: p ? p.nombre : '' });
  const descripcion = h('input', { type: 'text', value: p ? p.descripcion : '' });
  const fi = h('input', { type: 'date', value: p ? p.fecha_inicio : meta.hoy });
  const ff = h('input', { type: 'date', value: p ? p.fecha_fin : meta.hoy });

  const tipo = h('select', {}, ...meta.tipos.map((t) => {
    const o = h('option', { value: t }, TIPO_LABEL[t]);
    if (p && p.tipo === t) o.selected = true;
    return o;
  }));
  const ambito = h('select', {});
  const diaSemana = h('select', {}, ...meta.dias.map((d, i) => {
    const o = h('option', { value: String(i) }, d);
    if (p && p.dia_semana === i) o.selected = true;
    return o;
  }));
  const categoria = h('select', {}, ...categorias.map((c) => {
    const o = h('option', { value: String(c.id) }, c.nombre);
    if (p && p.categoria_id === c.id) o.selected = true;
    return o;
  }));
  const cantidad = h('input', { type: 'number', min: '2', step: '1', value: p && p.cantidad_requerida ? p.cantidad_requerida : '2' });
  const valorTipo = h('select', {},
    h('option', { value: 'fijo' }, 'Precio fijo del combo ($)'),
    h('option', { value: 'porcentaje' }, '% de descuento')
  );
  if (p && p.valor_tipo === 'porcentaje') valorTipo.value = 'porcentaje';
  const valor = h('input', { type: 'number', min: '0', step: 'any', value: p ? p.valor : '' });

  // Selector de "Ciertos productos": con pocos productos una lista simple
  // basta, pero con 20+ hay que poder buscar, filtrar por categoría y marcar
  // varios de golpe (si no, el usuario se pierde haciendo scroll uno por uno).
  const pickerFiltro = { texto: '', categoria: '' };
  const prodChecks = productos.map((pr) => {
    const cb = h('input', { type: 'checkbox', value: String(pr.id) });
    if (p && p.productos.some((x) => x.producto_id === pr.id)) cb.checked = true;
    cb.addEventListener('change', () => actualizarContadorProductos());
    return { pr, cb, el: h('label', { class: 'perm-check' }, cb, h('span', {}, `${esc(pr.nombre)}${pr.categoria_nombre ? ' · ' + esc(pr.categoria_nombre) : ''}`)) };
  });
  const categoriasProductos = [...new Set(productos.map((pr) => pr.categoria_nombre || 'Otros'))];
  const contadorProductos = h('span', { class: 'muted', style: 'font-size:12px' }, '');
  function actualizarContadorProductos() {
    const n = prodChecks.filter((c) => c.cb.checked).length;
    contadorProductos.textContent = n === 1 ? '1 producto elegido' : `${n} productos elegidos`;
  }
  function coincideProducto(c) {
    if (pickerFiltro.categoria && (c.pr.categoria_nombre || 'Otros') !== pickerFiltro.categoria) return false;
    if (!pickerFiltro.texto) return true;
    const t = pickerFiltro.texto.toLocaleLowerCase('es');
    return `${c.pr.nombre} ${c.pr.categoria_nombre || ''}`.toLocaleLowerCase('es').includes(t);
  }
  const sinResultadosProductos = h('div', { class: 'empty', style: 'display:none' }, 'Ningún producto coincide con la búsqueda.');
  function pintarProductosVisibles() {
    // Nota: .perm-check trae su propio "display: flex", que en la cascada le
    // gana al [hidden] del navegador (misma especificidad, gana la regla de
    // autor) — por eso se oculta con style.display y no con el atributo hidden.
    let visibles = 0;
    for (const c of prodChecks) {
      const vis = coincideProducto(c);
      c.el.style.display = vis ? '' : 'none';
      if (vis) visibles++;
    }
    sinResultadosProductos.style.display = visibles ? 'none' : '';
  }
  const listaProductos = h('div', { class: 'prod-picker-list' }, ...prodChecks.map((c) => c.el), sinResultadosProductos);
  function productosPickerEl() {
    pintarProductosVisibles();
    actualizarContadorProductos();
    return h('div', {},
      h('div', { class: 'cat-barra' },
        SearchBox('Buscar producto…', (v) => { pickerFiltro.texto = v; pintarProductosVisibles(); }, { delay: 120, value: pickerFiltro.texto }),
        ChipRow(
          [{ value: '', label: `Todas (${productos.length})` },
           ...categoriasProductos.map((cat) => ({ value: cat, label: `${cat} (${productos.filter((pr) => (pr.categoria_nombre || 'Otros') === cat).length})` }))],
          pickerFiltro.categoria,
          (v) => { pickerFiltro.categoria = v; pintarProductosVisibles(); }
        )
      ),
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;margin:8px 0' },
        contadorProductos,
        h('div', {},
          h('button', {
            type: 'button', class: 'btn small secondary',
            onclick: () => { for (const c of prodChecks) if (coincideProducto(c)) c.cb.checked = true; actualizarContadorProductos(); },
          }, 'Marcar los visibles'),
          h('button', {
            type: 'button', class: 'btn ghost small', style: 'margin-left:6px',
            onclick: () => { for (const c of prodChecks) c.cb.checked = false; actualizarContadorProductos(); },
          }, 'Vaciar selección'))
      ),
      listaProductos
    );
  }

  const dyn = h('div', {});
  function ambitoOptions(t) {
    return t === 'monto_fijo' ? [['cuenta', 'A toda la cuenta'], ['productos', 'A ciertos productos']]
      : [['categoria', 'Una categoría'], ['productos', 'Ciertos productos']];
  }
  // Las opciones de "¿A qué aplica?" dependen del TIPO, así que solo se
  // reconstruyen cuando cambia el tipo. Antes se reconstruían en cada repintado
  // —incluido el que dispara el propio desplegable— y la elección volvía a la
  // primera opción: en una promoción nueva era imposible elegir "Ciertos productos".
  function rellenarAmbito() {
    const opciones = ambitoOptions(tipo.value);
    const antes = ambito.value || (p ? p.ambito : '');
    ambito.innerHTML = '';
    for (const [v, l] of opciones) ambito.appendChild(h('option', { value: v }, l));
    // Se conserva lo elegido si sigue valiendo para este tipo ("Ciertos
    // productos" existe en los tres); si no, la primera opción.
    ambito.value = opciones.some(([v]) => v === antes) ? antes : opciones[0][0];
  }
  function renderDyn() {
    const t = tipo.value;
    dyn.innerHTML = '';
    if (t === 'dia') dyn.appendChild(field('Día de la semana', diaSemana));
    dyn.appendChild(field('¿A qué aplica?', ambito));
    if (ambito.value === 'categoria') dyn.appendChild(field('Categoría', categoria));
    if (ambito.value === 'productos') {
      dyn.appendChild(h('div', { class: 'section-title' }, 'Productos de la promoción'));
      dyn.appendChild(productosPickerEl());
    }
    if (t === 'combo') {
      if (ambito.value === 'categoria') dyn.appendChild(field('¿Cuántos productos?', cantidad, 'Ej. 2 frappés de cualquier sabor'));
      dyn.appendChild(field('Tipo de descuento', valorTipo));
      dyn.appendChild(field(valorTipo.value === 'fijo' ? 'Precio del combo ($)' : 'Porcentaje (%)', valor));
    } else if (t === 'dia') {
      dyn.appendChild(field('Porcentaje de descuento (%)', valor));
    } else {
      dyn.appendChild(field('Monto a descontar ($)', valor));
    }
  }
  tipo.addEventListener('change', () => { rellenarAmbito(); renderDyn(); });
  ambito.addEventListener('change', renderDyn);
  valorTipo.addEventListener('change', renderDyn);
  rellenarAmbito();
  renderDyn();

  openModal({
    title: id ? `Editar: ${p.nombre}` : 'Nueva promoción',
    wide: true,
    body: h('div', {},
      field('Nombre', nombre),
      field('Descripción', descripcion, 'Opcional, para reconocerla'),
      h('div', { class: 'grid-2' }, field('Vigente desde', fi), field('Vigente hasta', ff)),
      field('Tipo de promoción', tipo),
      dyn
    ),
    buttons: [
      { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
      { label: id ? 'Guardar' : 'Crear', kind: 'primary', onClick: async (close) => {
        const data = {
          nombre: nombre.value.trim(),
          descripcion: descripcion.value.trim(),
          tipo: tipo.value,
          fecha_inicio: fi.value,
          fecha_fin: ff.value,
          ambito: ambito.value,
          dia_semana: Number(diaSemana.value),
          categoria_id: ambito.value === 'categoria' ? Number(categoria.value) : null,
          cantidad_requerida: Number(cantidad.value),
          valor_tipo: tipo.value === 'combo' ? valorTipo.value : (tipo.value === 'dia' ? 'porcentaje' : 'monto'),
          valor: Number(valor.value),
          productoIds: ambito.value === 'productos' ? prodChecks.filter((c) => c.cb.checked).map((c) => Number(c.pr.id)) : [],
        };
        if (id) await window.api.promociones.update(id, data);
        else await window.api.promociones.create(data);
        toast(id ? 'Promoción actualizada' : 'Promoción creada', 'ok');
        close();
        reload();
      } },
    ],
  });
}
