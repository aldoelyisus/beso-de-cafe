import { h, esc } from '../lib/ui.js';

const ACTION_LABELS = {
  'auth.login.success': 'Inicio de sesión exitoso',
  'auth.login.failed': 'Intento de inicio de sesión fallido',
  'auth.logout': 'Cierre de sesión',
  'roles.create': 'Rol creado',
  'roles.update': 'Rol editado',
  'roles.permissions': 'Permisos de rol modificados',
  'roles.delete': 'Rol eliminado',
  'users.create': 'Usuario creado',
  'users.update': 'Usuario editado',
  'users.username_change': 'Cambio de nombre de usuario',
  'users.password_reset': 'Contraseña restablecida',
  'users.deactivate': 'Usuario desactivado',
  'users.activate': 'Usuario reactivado',
  'users.permissions': 'Permisos individuales modificados',
  'inventory.categoria.create': 'Categoría de insumo creada',
  'inventory.categoria.update': 'Categoría de insumo editada',
  'inventory.categoria.deactivate': 'Categoría de insumo dada de baja',
  'inventory.categoria.activate': 'Categoría de insumo reactivada',
  'inventory.insumo.create': 'Insumo creado',
  'inventory.insumo.update': 'Insumo editado',
  'inventory.insumo.deactivate': 'Insumo dado de baja',
  'inventory.insumo.activate': 'Insumo reactivado',
  'inventory.movimiento': 'Movimiento de existencias',
  'inventory.costo.ajuste': 'Corrección de costo de insumo',
  'menu.categoria.create': 'Categoría de producto creada',
  'menu.categoria.update': 'Categoría de producto editada',
  'menu.categoria.deactivate': 'Categoría de producto dada de baja',
  'menu.categoria.activate': 'Categoría de producto reactivada',
  'menu.modificador.create': 'Modificador creado',
  'menu.modificador.update': 'Modificador editado',
  'menu.modificador.receta': 'Receta de modificador actualizada',
  'menu.modificador.deactivate': 'Modificador dado de baja',
  'menu.modificador.activate': 'Modificador reactivado',
  'menu.producto.create': 'Producto creado',
  'menu.producto.update': 'Producto editado',
  'menu.producto.agotado': 'Producto marcado agotado / disponible',
  'menu.producto.deactivate': 'Producto dado de baja',
  'menu.producto.activate': 'Producto reactivado',
  'menu.producto.precio': 'Precio de producto modificado',
  'menu.producto.receta': 'Receta de producto actualizada',
  'ventas.mesa.create': 'Mesa creada',
  'ventas.mesa.update': 'Mesa editada',
  'ventas.mesa.deactivate': 'Mesa dada de baja',
  'ventas.mesa.activate': 'Mesa reactivada',
  'ventas.abrir': 'Cuenta abierta',
  'ventas.item.add': 'Producto agregado a una cuenta',
  'ventas.item.cancel': 'Producto cancelado de una cuenta',
  'ventas.cambiarTipo': 'Cuenta movida de mesa / pasada a llevar',
  'ventas.cobro': 'Cobro registrado',
  'ventas.cancelar': 'Venta cancelada',
  'ventas.promo': 'Promoción aplicada / quitada en una cuenta',
  'promo.create': 'Promoción creada',
  'promo.update': 'Promoción editada',
  'promo.setActive': 'Promoción activada / desactivada',
  'reportes.export': 'Reporte exportado (PDF / Excel)',
  'caja.abrir': 'Turno de caja abierto',
  'caja.movimiento': 'Movimiento de efectivo en caja',
  'caja.cerrar': 'Turno de caja cerrado',
  'cierre.dia': 'Día cerrado',
  'cierre.reabrir': 'Día reabierto',
  'respaldos.crear': 'Respaldo manual guardado',
  'actualizaciones.aplicar': 'Programa actualizado',
  'actualizaciones.revertir': 'Actualización deshecha',
};

function actionLabel(a) {
  return ACTION_LABELS[a] || a;
}

function actionBadge(a) {
  if (a.endsWith('.failed')) return 'off';
  if (a === 'auth.login.success') return 'on';
  return 'inherit';
}

export async function LogsView(root) {
  root.innerHTML = '';

  const state = { limit: 200, action: '', search: '' };
  const actions = await window.api.logs.actions();

  const actionSelect = h('select', { onchange: (e) => { state.action = e.target.value; load(); } },
    h('option', { value: '' }, 'Todas las acciones'),
    ...actions.map((a) => h('option', { value: a }, actionLabel(a)))
  );

  const searchInput = h('input', {
    type: 'search',
    placeholder: 'Buscar en usuario o detalle…',
    style: 'padding:8px 11px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);min-width:240px',
  });
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = searchInput.value.trim(); load(); }, 250);
  });

  const limitSelect = h('select', { onchange: (e) => { state.limit = Number(e.target.value); load(); } },
    ...[100, 200, 500, 1000].map((n) => {
      const o = h('option', { value: String(n) }, `${n} registros`);
      if (n === state.limit) o.selected = true;
      return o;
    })
  );

  const tableWrap = h('div', { class: 'card' });

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Bitácora del sistema'),
      h('div', { class: 'muted' }, 'Registro de solo lectura. No se puede modificar ni borrar.')
    ),
    h('button', { class: 'btn secondary', onclick: () => load() }, '↻ Actualizar')
  );

  const toolbar = h('div', { class: 'toolbar' },
    actionSelect, searchInput, limitSelect
  );

  root.append(head, toolbar, tableWrap);

  async function load() {
    tableWrap.innerHTML = '';
    tableWrap.appendChild(h('div', { class: 'empty' }, 'Cargando…'));
    let rows;
    try {
      rows = await window.api.logs.list(state);
    } catch (e) {
      tableWrap.innerHTML = '';
      tableWrap.appendChild(h('div', { class: 'empty' }, 'Error: ' + e.message));
      return;
    }
    tableWrap.innerHTML = '';
    if (!rows.length) {
      tableWrap.appendChild(h('div', { class: 'empty' }, 'Sin registros para este filtro.'));
      return;
    }
    tableWrap.appendChild(
      h('table', {},
        h('thead', {}, h('tr', {},
          h('th', { style: 'width:150px' }, 'Fecha y hora'),
          h('th', { style: 'width:140px' }, 'Usuario'),
          h('th', { style: 'width:210px' }, 'Acción'),
          h('th', {}, 'Detalle'))),
        h('tbody', {}, ...rows.map((r) =>
          h('tr', {},
            h('td', {}, esc(r.created_at)),
            h('td', {}, r.username ? '@' + esc(r.username) : h('span', { class: 'muted' }, '—')),
            h('td', {}, h('span', { class: 'badge ' + actionBadge(r.action) }, actionLabel(r.action))),
            h('td', {}, esc(r.detail || '—'))
          )
        ))
      )
    );
  }

  await load();
}
