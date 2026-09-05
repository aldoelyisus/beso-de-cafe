import { h, esc, toast, openModal, confirmDialog, field } from '../lib/ui.js';
import { can } from '../lib/store.js';
import { PermissionPicker } from '../components/permissionPicker.js';

export async function RolesView(root) {
  root.innerHTML = '';
  const [roles, permGroups] = await Promise.all([
    window.api.roles.list(),
    window.api.permissions.list(),
  ]);

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Roles y permisos'),
      h('div', { class: 'muted' }, 'Los roles son la plantilla de permisos. Editar un rol NO cambia los permisos de los usuarios ya creados.')
    ),
    can('roles.create')
      ? h('button', { class: 'btn', onclick: () => openRoleModal(root, null, permGroups) }, '+ Nuevo rol')
      : null
  );

  const rows = roles.map((r) =>
    h('tr', {},
      h('td', {}, h('strong', {}, esc(r.name))),
      h('td', {}, esc(r.description || '—')),
      h('td', {}, String(r.user_count)),
      h('td', {},
        h('div', { class: 'row-actions' },
          can('roles.edit') && !r.is_system
            ? h('button', { class: 'btn small secondary', onclick: () => openRoleModal(root, r.id, permGroups) }, 'Editar')
            : null,
          can('roles.delete') && !r.is_system
            ? h('button', {
                class: 'btn small danger',
                onclick: async () => {
                  if (!(await confirmDialog({ message: `¿Eliminar el rol "${r.name}"?` }))) return;
                  try {
                    await window.api.roles.delete(r.id);
                    toast('Rol eliminado', 'ok');
                    RolesView(root);
                  } catch (e) { toast(e.message, 'err'); }
                },
              }, 'Eliminar')
            : null
        )
      )
    )
  );

  const table = h('div', { class: 'card' },
    roles.length
      ? h('table', {},
          h('thead', {}, h('tr', {},
            h('th', {}, 'Rol'), h('th', {}, 'Descripción'), h('th', {}, 'Usuarios'), h('th', {}, ''))),
          h('tbody', {}, ...rows)
        )
      : h('div', { class: 'empty' }, 'Aún no hay roles. Crea el primero para empezar a asignar permisos.')
  );

  root.append(head, table);
}

async function openRoleModal(root, id, permGroups) {
  const role = id ? await window.api.roles.get(id) : { name: '', description: '', permissions: [] };
  const name = h('input', { type: 'text', value: role.name || '' });
  const desc = h('input', { type: 'text', value: role.description || '' });
  const picker = PermissionPicker(permGroups, new Set(role.permissions || []));

  openModal({
    title: id ? `Editar rol: ${role.name}` : 'Nuevo rol',
    wide: true,
    body: h('div', {},
      field('Nombre del rol', name),
      field('Descripción', desc, 'Opcional'),
      h('div', { class: 'section-title' }, 'Permisos de la plantilla'),
      h('div', { class: 'hint', style: 'margin-bottom:10px' },
        'Estos permisos se copiarán a los usuarios NUEVOS que se creen con este rol. Los usuarios existentes no se modifican.'),
      picker.element
    ),
    buttons: [
      { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
      {
        label: id ? 'Guardar cambios' : 'Crear rol',
        kind: 'primary',
        onClick: async (close) => {
          const payload = {
            name: name.value.trim(),
            description: desc.value.trim(),
            permissions: picker.getSelected(),
          };
          if (id) await window.api.roles.update(id, payload);
          else await window.api.roles.create(payload);
          toast(id ? 'Rol actualizado' : 'Rol creado', 'ok');
          close();
          RolesView(root);
        },
      },
    ],
  });
}
