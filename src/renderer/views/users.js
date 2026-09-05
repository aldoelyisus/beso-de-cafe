import { h, esc, toast, openModal, confirmDialog, field } from '../lib/ui.js';
import { can } from '../lib/store.js';
import { PermissionPicker } from '../components/permissionPicker.js';

export async function UsersView(root) {
  root.innerHTML = '';
  const [users, roles] = await Promise.all([
    window.api.users.list({ includeInactive: true }),
    can('roles.list') ? window.api.roles.list() : Promise.resolve([]),
  ]);

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Usuarios y personal'),
      h('div', { class: 'muted' }, 'Los usuarios no se borran: se desactivan para conservar el historial de ventas.')
    ),
    can('users.create')
      ? h('button', { class: 'btn', onclick: () => openUserModal(root, null, roles) }, '+ Nuevo usuario')
      : null
  );

  const rows = users.map((u) => {
    const actions = h('div', { class: 'row-actions' });
    if (can('users.edit')) {
      actions.append(
        h('button', { class: 'btn small secondary', onclick: () => openUserModal(root, u.id, roles) }, 'Editar'),
        h('button', { class: 'btn small secondary', onclick: () => openPermissionsModal(root, u.id) }, 'Permisos'),
        h('button', { class: 'btn small ghost', onclick: () => openSecurityModal(root, u) }, 'Acceso')
      );
    }
    if (can('users.delete')) {
      actions.append(
        u.is_active
          ? h('button', {
              class: 'btn small danger',
              onclick: async () => {
                if (!(await confirmDialog({ message: `¿Desactivar a "${u.name}"? Podrás reactivarlo después.`, confirmLabel: 'Desactivar' }))) return;
                try { await window.api.users.deactivate(u.id); toast('Usuario desactivado', 'ok'); UsersView(root); }
                catch (e) { toast(e.message, 'err'); }
              },
            }, 'Desactivar')
          : h('button', {
              class: 'btn small secondary',
              onclick: async () => {
                try { await window.api.users.activate(u.id); toast('Usuario reactivado', 'ok'); UsersView(root); }
                catch (e) { toast(e.message, 'err'); }
              },
            }, 'Reactivar')
      );
    }

    return h('tr', { style: u.is_active ? '' : 'opacity:.6' },
      h('td', {}, h('strong', {}, esc(u.name))),
      h('td', {}, '@' + esc(u.username)),
      h('td', {}, u.role_name ? h('span', { class: 'badge role' }, esc(u.role_name)) : h('span', { class: 'muted' }, 'Sin rol')),
      h('td', {}, esc(u.phone || '—')),
      h('td', {}, u.is_active ? h('span', { class: 'badge on' }, 'Activo') : h('span', { class: 'badge off' }, 'Desactivado')),
      h('td', {}, actions)
    );
  });

  const table = h('div', { class: 'card' },
    users.length
      ? h('table', {},
          h('thead', {}, h('tr', {},
            h('th', {}, 'Nombre'), h('th', {}, 'Usuario'), h('th', {}, 'Rol'),
            h('th', {}, 'Teléfono'), h('th', {}, 'Estado'), h('th', {}, ''))),
          h('tbody', {}, ...rows)
        )
      : h('div', { class: 'empty' }, 'No hay usuarios registrados todavía.')
  );

  root.append(head, table);
}

function roleSelect(roles, selectedId) {
  const sel = h('select', {},
    h('option', { value: '' }, 'Sin rol'),
    ...roles.map((r) => {
      const o = h('option', { value: String(r.id) }, r.name);
      if (String(r.id) === String(selectedId || '')) o.selected = true;
      return o;
    })
  );
  return sel;
}

async function openUserModal(root, id, roles) {
  const u = id ? await window.api.users.get(id) : null;

  const name = h('input', { type: 'text', value: u ? u.name : '' });
  const username = h('input', { type: 'text', value: u ? u.username : '', autocomplete: 'off' });
  const password = h('input', { type: 'password', autocomplete: 'new-password' });
  const role = roleSelect(roles, u ? u.role_id : '');
  const phone = h('input', { type: 'text', value: u ? u.phone : '' });
  const ecName = h('input', { type: 'text', value: u ? u.emergency_contact_name : '' });
  const ecPhone = h('input', { type: 'text', value: u ? u.emergency_contact_phone : '' });

  const body = h('div', {},
    h('div', { class: 'section-title' }, 'Datos de acceso'),
    field('Nombre completo', name),
    id
      ? null
      : field('Nombre de usuario', username, 'Se usa para iniciar sesión'),
    id
      ? null
      : field('Contraseña', password, 'Mínimo 4 caracteres'),
    field('Rol', role, id ? 'Al cambiar el rol se vuelven a copiar sus permisos (los permisos individuales se conservan).' : 'Al crear el usuario se copian los permisos actuales del rol.'),
    h('div', { class: 'section-title' }, 'Área de personal'),
    field('Teléfono de contacto', phone),
    h('div', { class: 'grid-2' },
      field('Contacto de emergencia', ecName),
      field('Teléfono de emergencia', ecPhone)
    )
  );

  openModal({
    title: id ? `Editar usuario: ${u.name}` : 'Nuevo usuario',
    body,
    buttons: [
      { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
      {
        label: id ? 'Guardar cambios' : 'Crear usuario',
        kind: 'primary',
        onClick: async (close) => {
          const data = {
            name: name.value.trim(),
            roleId: role.value || null,
            phone: phone.value.trim(),
            emergencyContactName: ecName.value.trim(),
            emergencyContactPhone: ecPhone.value.trim(),
          };
          if (id) {
            await window.api.users.update(id, data);
          } else {
            await window.api.users.create({
              ...data,
              username: username.value.trim(),
              password: password.value,
            });
          }
          toast(id ? 'Usuario actualizado' : 'Usuario creado', 'ok');
          close();
          UsersView(root);
        },
      },
    ],
  });
}

async function openPermissionsModal(root, id) {
  const [user, permGroups] = await Promise.all([
    window.api.users.get(id),
    window.api.permissions.list(),
  ]);
  const selected = new Set(user.permissions.map((p) => p.permission_key));
  const inherited = new Set(user.permissions.filter((p) => p.from_role).map((p) => p.permission_key));
  const picker = PermissionPicker(permGroups, selected, inherited);

  openModal({
    title: `Permisos de ${user.name}`,
    wide: true,
    body: h('div', {},
      h('div', { class: 'hint', style: 'margin-bottom:12px' },
        'Estos son los permisos efectivos de este usuario. Puedes agregar permisos extra sin tocar el rol, o quitar los que no quieras. Cambiar el rol después no borra lo que ajustes aquí.'),
      picker.element
    ),
    buttons: [
      { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
      {
        label: 'Guardar permisos',
        kind: 'primary',
        onClick: async (close) => {
          await window.api.users.setPermissions(id, picker.getSelected());
          toast('Permisos actualizados', 'ok');
          close();
          UsersView(root);
        },
      },
    ],
  });
}

function openSecurityModal(root, u) {
  const newUsername = h('input', { type: 'text', value: u.username });
  const newPassword = h('input', { type: 'password', autocomplete: 'new-password' });

  openModal({
    title: `Acceso de ${u.name}`,
    body: h('div', {},
      h('div', { class: 'section-title' }, 'Nombre de usuario'),
      field('Nombre de usuario', newUsername),
      h('button', { class: 'btn secondary small', onclick: async () => {
        try {
          await window.api.users.changeUsername(u.id, newUsername.value.trim());
          toast('Nombre de usuario actualizado', 'ok');
          UsersView(root);
        } catch (e) { toast(e.message, 'err'); }
      } }, 'Cambiar nombre de usuario'),
      h('div', { class: 'section-title' }, 'Contraseña'),
      field('Nueva contraseña', newPassword, 'Mínimo 4 caracteres'),
      h('button', { class: 'btn secondary small', onclick: async () => {
        try {
          await window.api.users.resetPassword(u.id, newPassword.value);
          newPassword.value = '';
          toast('Contraseña restablecida', 'ok');
        } catch (e) { toast(e.message, 'err'); }
      } }, 'Restablecer contraseña')
    ),
    buttons: [{ label: 'Cerrar', kind: 'secondary', onClick: (close) => close() }],
  });
}
