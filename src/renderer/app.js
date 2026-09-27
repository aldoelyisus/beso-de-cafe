import { h, toast } from './lib/ui.js';
import { setSession, getSession, refreshSession, can } from './lib/store.js';
import { Sidebar } from './components/sidebar.js';
import { LoginView } from './views/login.js';
import { UsersView } from './views/users.js';
import { RolesView } from './views/roles.js';
import { LogsView } from './views/logs.js';
import { RespaldosView } from './views/respaldos.js';
import { InsumosView } from './views/insumos.js';
import { InsumoCategoriasView } from './views/insumoCategorias.js';
import { ProductoCategoriasView } from './views/productoCategorias.js';
import { ModificadoresView } from './views/modificadores.js';
import { ProductosView } from './views/productos.js';
import { ProductoEditorView } from './views/productoEditor.js';
import { MesasView } from './views/mesas.js';
import { PosView } from './views/pos.js';
import { VentaTicketView } from './views/ventaTicket.js';
import { VentasHistorialView } from './views/ventasHistorial.js';
import { PromocionesView } from './views/promociones.js';
import { ReportesView } from './views/reportes.js';
import { CajaView } from './views/caja.js';

const appRoot = document.getElementById('app');

// Rutas: hash -> { permiso requerido, render(container, param) }
// Una ruta con ":id" acepta "#/base/123" y recibe "123" como segundo argumento.
const ROUTES = {
  '#/users': { requires: 'users.view', render: UsersView },
  '#/roles': { requires: 'roles.view', render: RolesView },
  '#/logs': { requires: 'logs.view', render: LogsView },
  '#/respaldos': { requires: 'respaldos.view', render: RespaldosView },
  '#/insumos': { requires: 'insumos.view', render: InsumosView },
  '#/insumo-categorias': { requires: 'insumo_categorias.view', render: InsumoCategoriasView },
  '#/producto-categorias': { requires: 'producto_categorias.view', render: ProductoCategoriasView },
  '#/modificadores': { requires: 'modificadores.view', render: ModificadoresView },
  '#/productos': { requires: 'productos.view', render: ProductosView },
  '#/productos/:id': { requires: 'productos.view', render: ProductoEditorView },
  '#/pos': { requires: 'ventas.view', render: PosView },
  '#/venta/:id': { requires: 'ventas.view', render: VentaTicketView },
  '#/ventas-historial': { requires: 'ventas.list', render: VentasHistorialView },
  '#/promociones': { requires: 'promociones.view', render: PromocionesView },
  '#/reportes': { requires: 'reportes.view', render: ReportesView },
  '#/caja': { requires: 'caja.view', render: CajaView },
  '#/mesas': { requires: 'mesas.view', render: MesasView },
};

function matchRoute(hash) {
  if (ROUTES[hash]) return { def: ROUTES[hash], param: null, base: hash };
  const parts = (hash || '').split('/');
  if (parts.length === 3) {
    const key = `${parts[0]}/${parts[1]}/:id`;
    if (ROUTES[key]) return { def: ROUTES[key], param: decodeURIComponent(parts[2]), base: `${parts[0]}/${parts[1]}` };
  }
  return null;
}

// Al entrar, aterrizar en lo operativo (punto de venta), no en la configuración.
const LANDING_PRIORITY = ['#/pos', '#/caja', '#/reportes', '#/ventas-historial', '#/productos', '#/insumos', '#/users', '#/logs'];
function defaultRoute() {
  const can1 = (r) => ROUTES[r] && can(ROUTES[r].requires);
  return LANDING_PRIORITY.find(can1)
    || Object.keys(ROUTES).find((r) => !r.includes(':') && can(ROUTES[r].requires))
    || null;
}

async function renderShell() {
  const hash = location.hash || defaultRoute() || '';
  const m = matchRoute(hash);

  const main = h('main', { class: 'main' });
  const shell = h('div', { class: 'shell' },
    Sidebar(m ? m.base : hash, doLogout),
    main
  );
  appRoot.innerHTML = '';
  appRoot.appendChild(shell);

  if (!m) {
    main.appendChild(h('div', { class: 'empty' }, 'Selecciona una opción del menú.'));
    return;
  }
  if (!can(m.def.requires)) {
    main.appendChild(h('div', { class: 'empty' }, 'No tienes permiso para ver esta sección.'));
    return;
  }
  try {
    await m.def.render(main, m.param);
  } catch (err) {
    // Se puede tener "ver el módulo" (X.view) sin "ver el listado" (X.list):
    // en ese caso el mensaje se explica solo, no es un error de la aplicación.
    const msg = err && err.message ? err.message : String(err);
    main.innerHTML = '';
    main.appendChild(h('div', { class: 'empty' },
      /no tienes permiso/i.test(msg)
        ? 'No tienes permiso para ver el contenido de esta sección.'
        : 'Error al cargar: ' + msg));
  }
}

function renderLogin() {
  appRoot.innerHTML = '';
  appRoot.appendChild(LoginView(async (session) => {
    setSession(session);
    if (!matchRoute(location.hash)) {
      const d = defaultRoute();
      if (d) location.hash = d;
    }
    renderShell();
  }));
}

async function doLogout() {
  await window.api.auth.logout();
  setSession({ authenticated: false });
  location.hash = '';
  renderLogin();
}

window.addEventListener('hashchange', () => {
  if (getSession().authenticated) renderShell();
});

(async function boot() {
  try {
    const session = await refreshSession();
    if (session.authenticated) {
      if (!matchRoute(location.hash)) {
        const d = defaultRoute();
        if (d) { location.hash = d; return; } // hashchange dispara renderShell
      }
      renderShell();
    } else {
      renderLogin();
    }
  } catch (err) {
    toast('No se pudo iniciar la aplicación: ' + (err.message || err), 'err');
    renderLogin();
  }
})();
