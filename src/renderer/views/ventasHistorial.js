import { h, esc, toast, openModal, field } from '../lib/ui.js';
import { can } from '../lib/store.js';
import { Pager } from '../components/pager.js';
import { SearchBox, Segmented } from '../components/filters.js';

const PAGE_SIZE = 15;
const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function VentasHistorialView(root) {
  root.innerHTML = '';
  const state = { page: 1, search: '', estado: '' };

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Historial de ventas'),
      h('div', { class: 'muted' }, 'Ventas pagadas y canceladas. Cancelar una venta ya pagada la deja marcada aquí y regresa sus insumos.')
    )
  );

  const searchBox = SearchBox('Buscar (#, mesa, usuario)…', (v) => { state.search = v; state.page = 1; load(); });
  const estadoChips = Segmented(
    [{ value: '', label: 'Todas' }, { value: 'pagada', label: 'Pagadas' }, { value: 'cancelada', label: 'Canceladas' }],
    '', (v) => { state.estado = v; state.page = 1; load(); }, 'Estado'
  );
  const tableWrap = h('div', { class: 'card' });
  const pagerWrap = h('div', {});
  root.append(head, h('div', { class: 'toolbar' }, searchBox, estadoChips), tableWrap, pagerWrap);

  async function load() {
    tableWrap.innerHTML = '';
    pagerWrap.innerHTML = '';
    const res = await window.api.ventas.historial({ page: state.page, pageSize: PAGE_SIZE, search: state.search, estado: state.estado });
    if (!res.rows.length) { tableWrap.appendChild(h('div', { class: 'empty' }, 'Sin ventas para este filtro.')); return; }
    tableWrap.appendChild(h('table', {},
      h('thead', {}, h('tr', {},
        h('th', {}, '#'), h('th', {}, 'Origen'), h('th', {}, 'Total'), h('th', {}, 'Pago'),
        h('th', {}, 'Cerrada'), h('th', {}, 'Estado'), h('th', {}, ''))),
      h('tbody', {}, ...res.rows.map((v) => row(v)))
    ));
    pagerWrap.appendChild(Pager(res, (p) => { state.page = p; load(); }));
  }

  function row(v) {
    const metodos = [...new Set(v.pagos.map((p) => p.metodo))].join(', ') || '—';
    return h('tr', { style: v.estado === 'cancelada' ? 'opacity:.6' : '' },
      h('td', {}, h('strong', {}, '#' + v.id)),
      h('td', {}, v.tipo === 'mesa' ? esc(v.mesa_nombre || 'Mesa') : 'Para llevar'),
      h('td', {}, money(v.total)),
      h('td', {}, v.estado === 'pagada' ? `${money(v.total)} · ${metodos}` : '—'),
      h('td', {}, esc(v.closed_at || '')),
      h('td', {}, v.estado === 'pagada'
        ? h('span', { class: 'badge on' }, 'Pagada')
        : h('span', { class: 'badge off' }, 'Cancelada')),
      h('td', {}, h('div', { class: 'row-actions' },
        h('button', { class: 'btn small secondary', onclick: () => verDetalle(v.id) }, 'Ver'),
        (v.estado === 'pagada' && can('ventas.cancelar'))
          ? h('button', { class: 'btn small danger', onclick: () => cancelarPagada(v) }, 'Cancelar venta')
          : null
      ))
    );
  }

  async function verDetalle(id) {
    const v = await window.api.ventas.get(id);
    openModal({
      title: `Venta #${v.id}`,
      wide: true,
      body: h('div', {},
        h('div', { class: 'muted', style: 'margin-bottom:10px' },
          (v.tipo === 'mesa' ? esc(v.mesa_nombre || 'Mesa') : 'Para llevar') + ' · ' + esc(v.username || '') +
          ' · ' + esc(v.created_at)),
        v.estado === 'cancelada' && v.motivo_cancelacion
          ? h('div', { class: 'form-error' }, 'Cancelada: ' + esc(v.motivo_cancelacion)) : null,
        h('div', { class: 'card' }, h('table', {}, h('tbody', {},
          ...v.items.map((it) => h('tr', { style: it.estado === 'cancelado' ? 'opacity:.5;text-decoration:line-through' : '' },
            h('td', {}, esc(it.producto_nombre) + (it.presentacion_nombre && it.presentacion_nombre !== 'Único' ? ' · ' + esc(it.presentacion_nombre) : ''),
              it.modificadores.length || it.opciones.length
                ? h('div', { class: 'sub', style: 'font-size:11px;color:var(--ink-soft)' },
                    it.modificadores.map((m) => m.nombre).concat(it.opciones.map((o) => o.insumo_nombre)).map(esc).join(' · '))
                : null),
            h('td', { style: 'text-align:right' }, money(it.total))
          ))
        ))),
        h('div', { style: 'display:flex;justify-content:space-between;margin-top:10px;font-weight:700' },
          h('span', {}, 'Total'), h('span', {}, money(v.total))),
        v.pagos.length ? h('div', { class: 'section-title' }, 'Pagos') : null,
        ...v.pagos.map((p) => h('div', { class: 'pay-row' },
          h('span', { class: 'grow' },
            `${money(p.monto)} · ${p.metodo}${p.etiqueta ? ' · ' + esc(p.etiqueta) : ''}`,
            p.cambio > 0 ? h('div', { class: 'sub', style: 'font-size:11px;color:var(--ink-soft)' }, `recibió ${money(p.recibido)} · cambio ${money(p.cambio)}`) : null),
          h('span', { class: 'muted', style: 'font-size:11px' }, esc(p.created_at))))
      ),
      buttons: [{ label: 'Cerrar', kind: 'secondary', onClick: (close) => close() }],
    });
  }

  function cancelarPagada(v) {
    const motivo = h('input', { type: 'text', placeholder: 'Motivo' });
    openModal({
      title: `Cancelar venta pagada #${v.id}`,
      body: h('div', {},
        h('p', {}, 'La venta queda marcada como CANCELADA en el historial y todos sus insumos regresan al inventario. El dinero se devuelve por fuera.'),
        field('Motivo', motivo)
      ),
      buttons: [
        { label: 'No', kind: 'secondary', onClick: (close) => close() },
        { label: 'Cancelar venta', kind: 'danger', onClick: async (close) => {
          if (!motivo.value.trim()) return toast('Escribe el motivo', 'err');
          await window.api.ventas.cancelar(v.id, motivo.value.trim());
          toast('Venta cancelada', 'ok'); close(); load();
        } },
      ],
    });
  }

  await load();
}
