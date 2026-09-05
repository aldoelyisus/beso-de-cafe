import { h, esc, toast, confirmDialog, openModal, field } from '../lib/ui.js';
import { can } from '../lib/store.js';

export async function MesasView(root) {
  root.innerHTML = '';
  const mesas = await window.api.mesas.list({ includeInactive: true });

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Mesas'),
      h('div', { class: 'muted' }, 'La cantidad de mesas se ajusta aquí. Baja lógica: una mesa con cuenta abierta no se puede quitar.')
    ),
    can('mesas.create')
      ? h('div', { style: 'display:flex;gap:8px' },
          h('button', { class: 'btn secondary', onclick: () => openAgregarVarias(root) }, '+ Agregar varias'),
          h('button', { class: 'btn', onclick: () => openMesaModal(root, null) }, '+ Mesa'))
      : null
  );

  const rows = mesas.map((m) => {
    const actions = h('div', { class: 'row-actions' });
    if (can('mesas.edit')) actions.appendChild(h('button', { class: 'btn small secondary', onclick: () => openMesaModal(root, m) }, 'Renombrar'));
    if (can('mesas.delete')) {
      actions.appendChild(m.is_active
        ? h('button', { class: 'btn small danger', onclick: async () => {
            if (!(await confirmDialog({ message: `¿Dar de baja "${m.nombre}"?`, confirmLabel: 'Dar de baja' }))) return;
            try { await window.api.mesas.deactivate(m.id); toast('Mesa dada de baja', 'ok'); MesasView(root); }
            catch (e) { toast(e.message, 'err'); }
          } }, 'Baja')
        : h('button', { class: 'btn small secondary', onclick: async () => {
            try { await window.api.mesas.activate(m.id); toast('Mesa reactivada', 'ok'); MesasView(root); }
            catch (e) { toast(e.message, 'err'); }
          } }, 'Reactivar'));
    }
    return h('tr', { style: m.is_active ? '' : 'opacity:.55' },
      h('td', {}, h('strong', {}, esc(m.nombre))),
      h('td', {}, m.cuentas_abiertas > 0 ? h('span', { class: 'badge off' }, 'Ocupada') : h('span', { class: 'badge on' }, 'Libre')),
      h('td', {}, m.is_active ? 'Activa' : h('span', { class: 'muted' }, 'De baja')),
      h('td', {}, actions)
    );
  });

  root.append(head, h('div', { class: 'card' },
    mesas.length
      ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Mesa'), h('th', {}, 'Estado'), h('th', {}, ''), h('th', {}, ''))),
          h('tbody', {}, ...rows))
      : h('div', { class: 'empty' }, 'No hay mesas. Agrega las que tenga la cafetería.')
  ));
}

function openMesaModal(root, mesa) {
  const nombre = h('input', { type: 'text', value: mesa ? mesa.nombre : '' });
  openModal({
    title: mesa ? `Renombrar "${mesa.nombre}"` : 'Nueva mesa',
    body: h('div', {}, field('Nombre', nombre, 'Ej. "Mesa 7", "Terraza 1", "Barra"')),
    buttons: [
      { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
      { label: mesa ? 'Guardar' : 'Crear', kind: 'primary', onClick: async (close) => {
        if (mesa) await window.api.mesas.update(mesa.id, { nombre: nombre.value.trim() });
        else await window.api.mesas.create(nombre.value.trim());
        toast(mesa ? 'Mesa actualizada' : 'Mesa creada', 'ok');
        close(); MesasView(root);
      } },
    ],
  });
}

function openAgregarVarias(root) {
  const cant = h('input', { type: 'number', min: '1', max: '50', value: '4' });
  openModal({
    title: 'Agregar varias mesas',
    body: h('div', {}, field('¿Cuántas mesas agregar?', cant, 'Se crean como "Mesa N+1", "Mesa N+2"…')),
    buttons: [
      { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
      { label: 'Agregar', kind: 'primary', onClick: async (close) => {
        const r = await window.api.mesas.agregarVarias(Number(cant.value) || 0);
        toast(`${r.creadas} mesa(s) agregada(s)`, 'ok');
        close(); MesasView(root);
      } },
    ],
  });
}
