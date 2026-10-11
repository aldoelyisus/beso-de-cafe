import { h } from '../lib/ui.js';
import { getSession, currentUser } from '../lib/store.js';
import { icono, marca, chevron } from './icons.js';

/**
 * Menú lateral. Se construye a partir de `session.menu`, que el proceso
 * principal ya filtró según los permisos del usuario.
 *
 * - Los módulos se agrupan por sección (Operación / Catálogo / Administración).
 * - Un módulo con varios submódulos es un grupo desplegable (acordeón: al abrir
 *   uno se cierran los demás). El grupo de la ruta actual arranca abierto.
 * - Un módulo con un solo destino es un enlace directo (sin desplegable).
 */

const SECCIONES = {
  operacion: 'Operación',
  catalogo: 'Catálogo',
  administracion: 'Administración',
};

export function Sidebar(currentRoute, onLogout) {
  const session = getSession();
  const user = currentUser();
  const menu = session.menu || [];

  const nav = h('nav', { class: 'nav' });
  let seccionActual = null;

  for (const mod of menu) {
    if (mod.section && mod.section !== seccionActual) {
      seccionActual = mod.section;
      nav.appendChild(h('div', { class: 'nav-section' }, SECCIONES[mod.section] || mod.section));
    }

    const subs = mod.submodules && mod.submodules.length
      ? mod.submodules
      : [{ key: mod.key, label: mod.label, route: mod.route }];

    // Un solo destino -> enlace directo, sin desplegable ni clic extra.
    if (subs.length === 1) {
      nav.appendChild(h('a', {
        href: subs[0].route,
        class: 'nav-link' + (subs[0].route === currentRoute ? ' active' : ''),
      },
        icono(mod.icon),
        h('span', { class: 'lbl' }, mod.label),
      ));
      continue;
    }

    const activo = subs.some((s) => s.route === currentRoute);
    const group = h('div', { class: `nav-group ${activo ? 'open' : ''}` });
    const header = h('button', {
      class: 'nav-item' + (activo ? ' here' : ''),
      onclick: () => {
        const abrir = !group.classList.contains('open');
        nav.querySelectorAll('.nav-group.open').forEach((g) => { if (g !== group) g.classList.remove('open'); });
        group.classList.toggle('open', abrir);
      },
    },
      icono(mod.icon),
      h('span', { class: 'lbl' }, mod.label),
      h('span', { class: 'chev', html: chevron() }),
    );
    const sub = h('div', { class: 'nav-sub' },
      ...subs.map((s) => h('a', {
        href: s.route,
        class: s.route === currentRoute ? 'active' : '',
      }, s.label)),
    );
    group.append(header, sub);
    nav.appendChild(group);
  }

  return h('aside', { class: 'sidebar' },
    h('div', { class: 'brand' },
      marca('brand-marca'),
      h('strong', {}, 'Beso', h('br'), 'de Café'),
    ),
    nav,
    h('div', { class: 'spacer' }),
    h('div', { class: 'side-user' },
      h('strong', {}, user ? user.name : ''),
      h('span', {}, user ? '@' + user.username : ''),
      h('button', { class: 'btn ghost small', style: 'margin-top:10px;color:#d8d2c6', onclick: onLogout }, 'Cerrar sesión'),
    ),
  );
}
