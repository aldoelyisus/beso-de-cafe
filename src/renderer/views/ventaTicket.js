import { h, esc, toast, openModal, confirmDialog, field } from '../lib/ui.js';
import { can } from '../lib/store.js';

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function VentaTicketView(root, idParam) {
  const id = Number(idParam);
  root.innerHTML = '';

  const [catalogo, meta] = await Promise.all([
    window.api.ventas.catalogoProductos(),
    window.api.ventas.meta(),
  ]);
  let venta = await window.api.ventas.get(id);
  if (!venta) { root.appendChild(h('div', { class: 'empty' }, 'La cuenta no existe.')); return; }

  render();

  async function refresh() {
    venta = await window.api.ventas.get(id);
    render();
  }

  function render() {
    root.innerHTML = '';
    root.appendChild(h('a', { class: 'editor-back', href: '#/pos' }, '← Punto de venta'));
    root.appendChild(h('div', { class: 'page-head' },
      h('div', {},
        h('h2', {}, `Cuenta #${venta.id}`),
        h('div', { class: 'muted' },
          (venta.tipo === 'mesa' ? esc(venta.mesa_nombre || 'Mesa') : 'Para llevar') + ' · ',
          estadoBadge(venta.estado))
      )
    ));

    if (venta.estado === 'abierta') {
      root.appendChild(h('div', { class: 'ticket-layout' }, catalogoEl(), ticketEl()));
    } else {
      root.appendChild(ticketEl(true));
    }
  }

  function estadoBadge(e) {
    if (e === 'abierta') return h('span', { class: 'badge role' }, 'Abierta');
    if (e === 'pagada') return h('span', { class: 'badge on' }, 'Pagada');
    return h('span', { class: 'badge off' }, 'Cancelada');
  }

  // ---------- Catálogo ----------
  function catalogoEl() {
    const wrap = h('div', {});
    if (!can('ventas.crear')) { wrap.appendChild(h('div', { class: 'hint' }, 'No tienes permiso para agregar productos.')); return wrap; }
    const porCat = new Map();
    for (const p of catalogo) {
      const k = p.categoria_nombre || 'Otros';
      if (!porCat.has(k)) porCat.set(k, []);
      porCat.get(k).push(p);
    }
    for (const [cat, prods] of porCat) {
      wrap.appendChild(h('div', { class: 'cat-group' },
        h('h4', {}, esc(cat)),
        h('div', { class: 'cat-items' },
          ...prods.map((p) => {
            const min = Math.min(...p.presentaciones.map((pr) => pr.precio_actual ?? Infinity));
            return h('button', {
              class: 'prod-btn', disabled: p.agotado ? 'disabled' : null,
              onclick: () => openAgregar(p.id),
            },
              h('span', { class: 'n' }, esc(p.nombre)),
              h('span', { class: 'p' }, p.agotado ? 'Agotado' : (Number.isFinite(min) ? money(min) : 'sin precio'))
            );
          })
        )
      ));
    }
    if (!catalogo.length) wrap.appendChild(h('div', { class: 'empty' }, 'No hay productos. Créalos en Menú → Productos.'));
    return wrap;
  }

  async function openAgregar(productoId) {
    const p = await window.api.ventas.producto(productoId);
    if (!p || p.agotado) return toast('Producto no disponible', 'err');
    if (!p.presentaciones.length) return toast('Este producto no tiene tamaños activos', 'err');

    let presId = p.presentaciones[0].id;
    const paraLlevar = h('input', { type: 'checkbox' });
    paraLlevar.checked = venta.tipo === 'llevar';
    const cantidad = h('input', { type: 'number', min: '1', max: '20', value: '1' });
    const modChecks = p.modificadores.map((m) => {
      const cb = h('input', { type: 'checkbox', value: String(m.id) });
      return { m, cb };
    });

    const dyn = h('div', {});
    const totalLine = h('div', { class: 'row total', style: 'display:flex;justify-content:space-between;margin-top:10px;font-weight:700' });

    function pres() { return p.presentaciones.find((x) => x.id === presId); }
    const grupoSelects = {}; // grupoId -> select

    function renderDyn() {
      dyn.innerHTML = '';
      const pr = pres();
      // tamaños
      if (p.presentaciones.length > 1) {
        dyn.appendChild(h('div', { class: 'section-title', style: 'margin-top:0' }, 'Tamaño'));
        dyn.appendChild(h('div', { class: 'metodo-pick' }, ...p.presentaciones.map((x) => {
          const r = h('input', { type: 'radio', name: 'tam', value: String(x.id) });
          r.checked = x.id === presId;
          if (x.agotado) r.disabled = true;
          r.addEventListener('change', () => { presId = x.id; renderDyn(); syncTotal(); });
          return h('label', {}, r, h('span', {}, `${x.nombre} · ${money(x.precio_actual)}`));
        })));
      }
      // grupos de opción
      for (const g of pr.grupos || []) {
        const sel = h('select', {}, ...g.opciones.map((o) => {
          const opt = h('option', { value: String(o.insumo_id) }, o.insumo_nombre);
          if (o.insumo_id === g.insumo_default_id) opt.selected = true;
          return opt;
        }));
        grupoSelects[g.id] = sel;
        dyn.appendChild(field(g.nombre, sel));
      }
      // modificadores
      for (const { m, cb } of modChecks) {
        dyn.appendChild(h('label', { class: 'perm-check' }, cb, h('span', {}, `${m.nombre} (+${money(m.precio_extra)})`)));
      }
      dyn.appendChild(h('div', { class: 'grid-2' },
        field('Cantidad', cantidad),
        field('Para llevar', h('div', { style: 'padding-top:8px' }, h('label', { class: 'perm-check', style: 'padding:0' }, paraLlevar, h('span', {}, 'Sí, para llevar'))))
      ));
    }

    function syncTotal() {
      const pr = pres();
      const extra = modChecks.filter((x) => x.cb.checked).reduce((s, x) => s + x.m.precio_extra, 0);
      const q = Math.max(1, Number(cantidad.value) || 1);
      totalLine.innerHTML = '';
      totalLine.append(h('span', {}, `${q} ×`), h('span', {}, money((pr.precio_actual + extra) * q)));
    }
    cantidad.addEventListener('input', syncTotal);
    modChecks.forEach((x) => x.cb.addEventListener('change', syncTotal));
    renderDyn(); syncTotal();

    openModal({
      title: `Agregar: ${p.nombre}`,
      body: h('div', {}, dyn, totalLine),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Agregar a la cuenta', kind: 'primary', onClick: async (close) => {
          const opciones = {};
          for (const [gid, sel] of Object.entries(grupoSelects)) opciones[gid] = Number(sel.value);
          await window.api.ventas.agregarItem(id, {
            presentacionId: presId,
            paraLlevar: paraLlevar.checked,
            modificadorIds: modChecks.filter((x) => x.cb.checked).map((x) => Number(x.m.id)),
            opciones,
            cantidad: Math.max(1, Number(cantidad.value) || 1),
          });
          toast('Agregado', 'ok');
          close();
          refresh();
        } },
      ],
    });
  }

  // ---------- Ticket ----------
  function ticketEl(readOnly = false) {
    const items = venta.items;
    const side = h('div', { class: 'ticket-side' });
    const card = h('div', { class: 'card' });

    const itemsBox = h('div', { class: 'ticket-items' });
    if (!items.length) itemsBox.appendChild(h('div', { class: 'hint', style: 'padding:16px' }, 'Cuenta vacía. Agrega productos del catálogo.'));
    for (const it of items) {
      const extras = it.modificadores.map((m) => m.nombre).concat(it.opciones.map((o) => o.insumo_nombre));
      const puedeCancelar = !readOnly && it.estado === 'activo' && it.pago_id == null && can('ventas.cancelar');
      itemsBox.appendChild(h('div', { class: 'tk-item' + (it.estado === 'cancelado' ? ' cancelado' : '') },
        h('div', { class: 'grow' },
          h('div', {}, esc(it.producto_nombre), it.presentacion_nombre && it.presentacion_nombre !== 'Único' ? ' · ' + esc(it.presentacion_nombre) : '',
            it.para_llevar ? h('span', { class: 'badge inherit', style: 'margin-left:6px' }, 'llevar') : null,
            it.pago_id != null ? h('span', { class: 'badge on', style: 'margin-left:6px' }, 'pagado') : null),
          extras.length ? h('div', { class: 'sub' }, extras.map(esc).join(' · ')) : null,
          it.estado === 'cancelado' && it.motivo_cancelacion ? h('div', { class: 'sub' }, 'cancelado: ' + esc(it.motivo_cancelacion)) : null
        ),
        h('div', { class: 'amt' }, money(it.total)),
        puedeCancelar ? h('button', { class: 'btn ghost small', title: 'Cancelar producto', onclick: () => cancelarItem(it) }, '✕') : null
      ));
    }
    card.appendChild(itemsBox);

    const totals = h('div', { class: 'ticket-totals' });
    if (venta.descuento > 0 || venta.promocion_id) {
      totals.append(
        h('div', { class: 'row' }, h('span', {}, 'Subtotal'), h('span', {}, money(venta.total))),
        h('div', { class: 'row', style: 'color:var(--ok)' },
          h('span', {}, 'Promo: ' + esc(venta.promocion_nombre || ''),
            !readOnly && venta.estado === 'abierta' && venta.pagos.length === 0
              ? h('button', { class: 'btn ghost small', style: 'margin-left:6px', onclick: () => quitarPromo() }, 'quitar') : null),
          h('span', {}, '−' + money(venta.descuento))),
        venta.promocion_id && !venta.promocion_aplica
          ? h('div', { class: 'row', style: 'color:var(--danger);font-size:12px' }, h('span', {}, '⚠ la promoción ya no aplica a esta cuenta'), h('span', {}, '')) : null
      );
    }
    totals.append(
      h('div', { class: 'row total' }, h('span', {}, 'Total'), h('span', {}, money(venta.total_final))),
      venta.pagado > 0 ? h('div', { class: 'row' }, h('span', {}, 'Pagado'), h('span', {}, money(venta.pagado))) : null,
      venta.saldo > 0 && venta.pagado > 0 ? h('div', { class: 'row saldo' }, h('span', {}, 'Saldo'), h('span', {}, money(venta.saldo))) : null
    );
    card.appendChild(totals);

    if (venta.pagos.length) {
      card.appendChild(h('div', { style: 'padding:0 16px 12px' },
        h('div', { class: 'section-title' }, 'Pagos'),
        ...venta.pagos.map((pg) => h('div', { class: 'pay-row' },
          h('span', { class: 'grow' },
            `${money(pg.monto)} · ${pg.metodo}${pg.etiqueta ? ' · ' + esc(pg.etiqueta) : ''}`,
            pg.cambio > 0 ? h('div', { class: 'sub' }, `recibió ${money(pg.recibido)} · cambio ${money(pg.cambio)}`) : null),
          h('span', { class: 'muted', style: 'font-size:11px' }, esc(pg.created_at))
        ))
      ));
    }

    if (!readOnly && venta.estado === 'abierta') {
      const acts = h('div', { class: 'ticket-actions' });
      if (can('promociones.aplicar') && !venta.promocion_id && venta.pagos.length === 0 && venta.total > 0) {
        acts.appendChild(h('button', { class: 'btn secondary', onclick: () => aplicarPromo() }, 'Aplicar promoción'));
      }
      if (can('ventas.cobrar') && venta.saldo > 0 && venta.items_sin_pagar.length) {
        acts.appendChild(h('button', { class: 'btn', onclick: () => cobrarTodo() }, `Cobrar todo · ${money(venta.saldo)}`));
        if (venta.items_sin_pagar.length > 1) {
          acts.appendChild(h('button', { class: 'btn secondary', onclick: () => dividir() }, 'Cobrar por partes / dividir'));
        }
      }
      if (can('ventas.cancelar') && venta.pagos.length === 0) {
        acts.appendChild(h('button', { class: 'btn ghost', style: 'color:var(--danger)', onclick: () => cancelarCuenta() }, 'Cancelar cuenta'));
      }
      card.appendChild(acts);
    }

    if (venta.estado !== 'abierta') {
      card.appendChild(h('div', { class: 'ticket-actions' },
        h('a', { class: 'btn secondary', href: '#/pos', style: 'text-align:center;text-decoration:none' }, 'Volver al punto de venta')));
    }

    side.appendChild(card);
    return side;
  }

  // ---------- Acciones ----------
  async function cancelarItem(it) {
    const motivo = h('input', { type: 'text', placeholder: 'Motivo (opcional)' });
    openModal({
      title: `Cancelar: ${it.producto_nombre}`,
      body: h('div', {},
        h('p', {}, 'El producto sale de la cuenta y sus insumos regresan al inventario.'),
        field('Motivo', motivo)
      ),
      buttons: [
        { label: 'No', kind: 'secondary', onClick: (close) => close() },
        { label: 'Cancelar producto', kind: 'danger', onClick: async (close) => {
          await window.api.ventas.cancelarItem(id, it.id, motivo.value.trim());
          toast('Producto cancelado', 'ok'); close(); refresh();
        } },
      ],
    });
  }

  function metodoPicker(name = 'metodo', onChange) {
    const wrap = h('div', { class: 'metodo-pick' });
    meta.metodos.forEach((m, i) => {
      const r = h('input', { type: 'radio', name, value: m });
      if (i === 0) r.checked = true;
      if (onChange) r.addEventListener('change', () => onChange(m));
      wrap.appendChild(h('label', {}, r, h('span', {}, m === 'efectivo' ? 'Efectivo' : 'Transferencia')));
    });
    return { wrap, value: () => (wrap.querySelector('input:checked') || {}).value || meta.metodos[0] };
  }

  /** Descuento de promoción que todavía no ha absorbido ningún pago. */
  function descuentoPendiente() {
    const usado = venta.pagos.reduce((s, p) => s + (p.descuento || 0), 0);
    return Math.max(0, round2((venta.descuento || 0) - usado));
  }
  /** Lo que realmente se cobra por un subtotal (respetando la promoción). */
  function montoDe(subtotalCrudo) {
    return round2(subtotalCrudo - Math.min(descuentoPendiente(), subtotalCrudo));
  }

  /** Bloque "Efectivo recibido / cambio a dar". getMonto() = cuánto se va a cobrar. */
  function efectivoBox(getMonto) {
    const recibido = h('input', { type: 'number', min: '0', step: 'any', placeholder: '$ que entregó el cliente' });
    const linea = h('div', { class: 'hint', style: 'font-size:14px;margin-top:4px' });
    const box = h('div', { style: 'margin-top:6px' }, field('Efectivo recibido', recibido), linea);
    const sync = () => {
      linea.innerHTML = '';
      if (recibido.value === '' || recibido.value == null) { linea.textContent = 'Vacío = pago exacto (sin cambio).'; return; }
      const c = round2((Number(recibido.value) || 0) - getMonto());
      linea.appendChild(c < -0.001
        ? h('span', { style: 'color:var(--danger);font-weight:600' }, `Faltan ${money(-c)}`)
        : h('span', { style: 'color:var(--ok);font-weight:700' }, `Cambio a dar: ${money(c)}`));
    };
    recibido.addEventListener('input', sync);
    sync();
    return { box, sync, value: () => (recibido.value === '' ? null : Number(recibido.value)) };
  }

  function cobrarTodo() {
    const monto = venta.saldo;
    const efec = efectivoBox(() => monto);
    const mp = metodoPicker('metodo', (m) => { efec.box.hidden = m !== 'efectivo'; });
    openModal({
      title: `Cobrar todo · ${money(monto)}`,
      body: h('div', {}, h('p', {}, 'Método de pago:'), mp.wrap, efec.box),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Confirmar cobro', kind: 'primary', onClick: async (close) => {
          const metodo = mp.value();
          const r = await window.api.ventas.cobrar(id, { itemIds: venta.items_sin_pagar, metodo, recibido: metodo === 'efectivo' ? efec.value() : null });
          const pago = r.pagos[r.pagos.length - 1];
          toast(pago && pago.cambio > 0 ? `Cobrado. Cambio a dar: ${money(pago.cambio)}` : 'Cobrado. Cuenta cerrada.', 'ok');
          close();
          location.hash = '#/pos';
        } },
      ],
    });
  }

  function dividir() {
    const build = (close) => {
      const pendientes = venta.items.filter((it) => it.estado === 'activo' && it.pago_id == null);
      const boxes = pendientes.map((it) => ({ it, cb: h('input', { type: 'checkbox', value: String(it.id) }) }));
      const subtotalCrudo = () => boxes.filter((b) => b.cb.checked).reduce((s, b) => s + b.it.total, 0);
      const montoReal = () => montoDe(subtotalCrudo());

      const efec = efectivoBox(montoReal);
      const mp = metodoPicker('metodo-div', (m) => { efec.box.hidden = m !== 'efectivo'; });
      const etiqueta = h('input', { type: 'text', placeholder: 'Comensal 1 (opcional)' });
      const linea = h('div', { style: 'display:flex;justify-content:space-between;margin:8px 0;font-size:15px;font-weight:700' });
      const sync = () => {
        const crudo = subtotalCrudo();
        const real = montoReal();
        linea.innerHTML = '';
        linea.append(h('span', {}, 'A cobrar'),
          h('span', {}, money(real) + (Math.abs(real - crudo) > 0.001 ? ` (de ${money(crudo)}, con promo)` : '')));
        efec.sync();
      };
      boxes.forEach((b) => b.cb.addEventListener('change', sync));
      sync();

      return h('div', {},
        h('p', { class: 'hint' }, 'Marca lo que consumió esta persona, elige el método y cóbralo. Repite para cada quien. Lo que quede sin pagar deja la cuenta abierta.'),
        h('div', { class: 'pay-list' }, ...boxes.map((b) => h('label', { class: 'pay-row' },
          b.cb, h('span', { class: 'grow' }, esc(b.it.producto_nombre) + (b.it.presentacion_nombre && b.it.presentacion_nombre !== 'Único' ? ' · ' + esc(b.it.presentacion_nombre) : '')),
          h('span', {}, money(b.it.total))
        ))),
        linea,
        field('Etiqueta', etiqueta),
        mp.wrap,
        efec.box,
        h('div', { style: 'text-align:right;margin-top:8px' }, h('button', { class: 'btn', onclick: async () => {
          const sel = boxes.filter((b) => b.cb.checked).map((b) => Number(b.it.id));
          if (!sel.length) return toast('Marca al menos un producto', 'err');
          try {
            const metodo = mp.value();
            const r = await window.api.ventas.cobrar(id, { itemIds: sel, metodo, etiqueta: etiqueta.value.trim(), recibido: metodo === 'efectivo' ? efec.value() : null });
            const pago = r.pagos[r.pagos.length - 1];
            const msgCambio = pago && pago.cambio > 0 ? ` Cambio: ${money(pago.cambio)}` : '';
            venta = await window.api.ventas.get(id);
            if (venta.estado !== 'abierta') { toast('Cuenta saldada.' + msgCambio, 'ok'); close(); location.hash = '#/pos'; return; }
            toast('Parte cobrada.' + msgCambio, 'ok');
            const body = document.querySelector('.modal .modal-body');
            if (body) { body.innerHTML = ''; body.appendChild(build(close)); }
          } catch (e) { toast(e.message, 'err'); }
        } }, 'Cobrar seleccionados'))
      );
    };

    openModal({
      title: `Dividir cuenta #${venta.id}`,
      wide: true,
      body: (close) => build(close),
      buttons: [{ label: 'Cerrar', kind: 'secondary', onClick: (close) => { close(); refresh(); } }],
    });
  }

  async function aplicarPromo() {
    let aplicables;
    try { aplicables = await window.api.ventas.promocionesAplicables(id); }
    catch (e) { return toast(e.message, 'err'); }
    if (!aplicables.length) {
      return openModal({
        title: 'Promociones',
        body: h('div', {}, h('p', {}, 'Ninguna promoción vigente aplica a esta cuenta ahora mismo.')),
        buttons: [{ label: 'Cerrar', kind: 'secondary', onClick: (close) => close() }],
      });
    }
    openModal({
      title: 'Aplicar una promoción',
      body: h('div', {},
        h('p', { class: 'hint' }, 'Solo se puede una por cuenta. Elige la que conviene:'),
        h('div', { class: 'pay-list' }, ...aplicables.map((pr) => h('div', { class: 'pay-row' },
          h('div', { class: 'grow' }, h('strong', {}, esc(pr.nombre)), h('div', { class: 'sub', style: 'font-size:11px;color:var(--ink-soft)' }, esc(pr.detalle || ''))),
          h('span', { style: 'color:var(--ok);font-weight:600' }, '−' + money(pr.descuento)),
          h('button', { class: 'btn small', style: 'margin-left:8px', onclick: async (e) => {
            e.target.disabled = true;
            try {
              await window.api.ventas.aplicarPromocion(id, pr.id);
              toast('Promoción aplicada', 'ok');
              document.querySelector('.modal-backdrop').remove();
              refresh();
            } catch (err) { toast(err.message, 'err'); e.target.disabled = false; }
          } }, 'Usar')
        )))
      ),
      buttons: [{ label: 'Cerrar', kind: 'secondary', onClick: (close) => close() }],
    });
  }

  async function quitarPromo() {
    try { await window.api.ventas.quitarPromocion(id); toast('Promoción quitada', 'ok'); refresh(); }
    catch (e) { toast(e.message, 'err'); }
  }

  async function cancelarCuenta() {
    const motivo = h('input', { type: 'text', placeholder: 'Motivo (opcional)' });
    openModal({
      title: `Cancelar cuenta #${venta.id}`,
      body: h('div', {}, h('p', {}, 'Se cancela toda la cuenta y los insumos regresan al inventario.'), field('Motivo', motivo)),
      buttons: [
        { label: 'No', kind: 'secondary', onClick: (close) => close() },
        { label: 'Cancelar cuenta', kind: 'danger', onClick: async (close) => {
          await window.api.ventas.cancelar(id, motivo.value.trim());
          toast('Cuenta cancelada', 'ok'); close(); location.hash = '#/pos';
        } },
      ],
    });
  }
}
