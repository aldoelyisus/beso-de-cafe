import { h, esc, toast, confirmDialog, openModal, field } from '../lib/ui.js';
import { can } from '../lib/store.js';
import { RecetaEditor } from '../components/recetaEditor.js';

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function ModificadoresView(root) {
  root.innerHTML = '';
  const [mods, insumos] = await Promise.all([
    window.api.modificadores.list({ includeInactive: true }),
    window.api.insumos.options(),
  ]);

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Modificadores'),
      h('div', { class: 'muted' }, 'Extras que se pueden agregar a un producto (suman al precio y descuentan insumo).')
    ),
    can('modificadores.create')
      ? h('button', { class: 'btn', onclick: () => openModModal(root, null, insumos) }, '+ Nuevo modificador')
      : null
  );

  const rows = mods.map((m) => {
    const actions = h('div', { class: 'row-actions' });
    if (can('modificadores.edit')) {
      actions.appendChild(h('button', { class: 'btn small secondary', onclick: () => openModModal(root, m.id, insumos) }, 'Editar'));
    }
    if (can('modificadores.delete')) {
      actions.appendChild(m.is_active
        ? h('button', { class: 'btn small danger', onclick: async () => {
            if (!(await confirmDialog({ message: `¿Dar de baja "${m.nombre}"?`, confirmLabel: 'Dar de baja' }))) return;
            try { await window.api.modificadores.deactivate(m.id); toast('Modificador dado de baja', 'ok'); ModificadoresView(root); }
            catch (e) { toast(e.message, 'err'); }
          } }, 'Baja')
        : h('button', { class: 'btn small secondary', onclick: async () => {
            try { await window.api.modificadores.activate(m.id); toast('Modificador reactivado', 'ok'); ModificadoresView(root); }
            catch (e) { toast(e.message, 'err'); }
          } }, 'Reactivar'));
    }
    const ganancia = m.precio_extra - m.costo;
    return h('tr', { style: m.is_active ? '' : 'opacity:.55' },
      h('td', {}, h('strong', {}, esc(m.nombre))),
      h('td', {}, money(m.precio_extra)),
      h('td', {}, m.item_count ? `${m.item_count} insumo/s · ${money(m.costo)}` : h('span', { class: 'badge off' }, 'sin receta')),
      h('td', {}, h('span', { class: ganancia >= 0 ? 'badge on' : 'badge off' }, money(ganancia))),
      h('td', {}, String(m.producto_count)),
      h('td', {}, m.is_active ? h('span', { class: 'badge on' }, 'Activo') : h('span', { class: 'badge off' }, 'Baja')),
      h('td', {}, actions)
    );
  });

  root.append(head, h('div', { class: 'card' },
    mods.length
      ? h('table', {},
          h('thead', {}, h('tr', {},
            h('th', {}, 'Modificador'), h('th', {}, 'Precio extra'), h('th', {}, 'Receta'),
            h('th', {}, 'Ganancia'), h('th', {}, 'Productos'), h('th', {}, 'Estado'), h('th', {}, ''))),
          h('tbody', {}, ...rows))
      : h('div', { class: 'empty' }, 'No hay modificadores.')
  ));
}

async function openModModal(root, id, insumos) {
  const m = id ? await window.api.modificadores.get(id) : { nombre: '', precio_extra: 0, items: [] };
  const meta = await window.api.menu.meta();

  const nombre = h('input', { type: 'text', value: m.nombre || '' });
  const precio = h('input', { type: 'number', min: '0', step: 'any', value: m.precio_extra || 0 });

  const resumen = h('div', { class: 'hint' });
  const editor = RecetaEditor(insumos, (m.items || []).map((it) => ({ insumo_id: it.insumo_id, cantidad_base: it.cantidad_base })), {
    withModo: false,
    onChange: syncResumen,
  });
  function syncResumen() {
    const costo = editor.totals().aqui;
    const g = (Number(precio.value) || 0) - costo;
    resumen.textContent = `Costo de la receta: ${money(costo)}  ·  Ganancia del extra: ${money(g)}`;
  }
  precio.addEventListener('input', syncResumen);
  syncResumen();

  openModal({
    title: id ? `Editar modificador: ${m.nombre}` : 'Nuevo modificador',
    wide: true,
    body: h('div', {},
      h('div', { class: 'grid-2' },
        field('Nombre', nombre),
        field('Precio extra (con IVA)', precio, '$ que se suma al total')
      ),
      h('div', { class: 'section-title' }, 'Receta del extra (qué consume del inventario)'),
      editor.element,
      resumen
    ),
    buttons: [
      { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
      { label: id ? 'Guardar' : 'Crear', kind: 'primary', onClick: async (close) => {
        // Igual que en la receta de un producto: lo que esté a medias se
        // avisa, no se descarta en silencio.
        const faltan = editor.problemas();
        if (faltan.length) throw new Error(faltan[0]);
        const data = { nombre: nombre.value.trim(), precio_extra: Number(precio.value) || 0 };
        const mod = id
          ? await window.api.modificadores.update(id, data)
          : await window.api.modificadores.create(data);
        await window.api.modificadores.setItems(mod.id, editor.getItems());
        toast(id ? 'Modificador actualizado' : 'Modificador creado', 'ok');
        close();
        ModificadoresView(root);
      } },
    ],
  });
}
