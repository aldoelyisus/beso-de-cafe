import { h, esc, toast } from '../lib/ui.js';
import { can } from '../lib/store.js';

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function PosView(root) {
  root.innerHTML = '';
  const [mesas, abiertas] = await Promise.all([
    window.api.mesas.list({ includeInactive: false }),
    window.api.ventas.abiertas(),
  ]);

  const cuentaPorMesa = new Map();
  for (const v of abiertas) if (v.mesa_id) cuentaPorMesa.set(v.mesa_id, v);
  const paraLlevar = abiertas.filter((v) => v.tipo === 'llevar');

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Punto de venta'),
      h('div', { class: 'muted' }, 'Toca una mesa para abrir o entrar a su cuenta. Puedes tener varias cuentas abiertas a la vez.')
    ),
    can('ventas.crear')
      ? h('button', { class: 'btn', onclick: () => abrir('llevar', null) }, '+ Pedido para llevar')
      : null
  );

  async function abrir(tipo, mesaId) {
    try {
      const v = await window.api.ventas.abrir(tipo, mesaId);
      location.hash = `#/venta/${v.id}`;
    } catch (e) { toast(e.message, 'err'); }
  }

  const grid = h('div', { class: 'mesa-grid' },
    ...mesas.map((m) => {
      const v = cuentaPorMesa.get(m.id);
      return h('button', {
        class: 'mesa-card' + (v ? ' ocupada' : ''),
        onclick: () => (v ? (location.hash = `#/venta/${v.id}`) : (can('ventas.crear') ? abrir('mesa', m.id) : toast('No tienes permiso para abrir cuentas', 'err'))),
      },
        h('div', { class: 'mesa-nombre' }, esc(m.nombre)),
        v
          ? h('div', { class: 'mesa-info' }, money(v.total), h('span', {}, `${v.num_items} prod.`))
          : h('div', { class: 'mesa-info libre' }, 'Libre')
      );
    })
  );

  const llevarSec = h('div', {},
    h('div', { class: 'section-title' }, 'Pedidos para llevar abiertos'),
    paraLlevar.length
      ? h('div', { class: 'card' }, h('table', {},
          h('tbody', {}, ...paraLlevar.map((v) => h('tr', {},
            h('td', {}, h('strong', {}, `Cuenta #${v.id}`)),
            h('td', {}, `${v.num_items} producto(s)`),
            h('td', {}, money(v.total)),
            h('td', {}, h('button', { class: 'btn small secondary', onclick: () => (location.hash = `#/venta/${v.id}`) }, 'Abrir'))
          )))
        ))
      : h('div', { class: 'hint' }, 'Ninguno.')
  );

  root.append(head, grid, llevarSec);
}
