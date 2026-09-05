import { h, esc, toast, openModal, confirmDialog, field } from '../lib/ui.js';
import { can } from '../lib/store.js';

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function CajaView(root) {
  root.innerHTML = '';
  const [corte, estadoDia, cortes, cierres] = await Promise.all([
    window.api.caja.corte(),
    window.api.caja.estadoDia(),
    window.api.caja.cortes({ limit: 20 }),
    window.api.caja.cierres({ limit: 30 }),
  ]);

  root.appendChild(h('div', { class: 'page-head' },
    h('div', {}, h('h2', {}, 'Corte de caja y cierre de día'),
      h('div', { class: 'muted' }, 'El turno controla el efectivo del cajón. El cierre de día congela los números del día para los reportes.'))));

  root.appendChild(turnoCard(corte));
  root.appendChild(cierreCard(estadoDia));
  if (cortes.length) root.appendChild(historial('Turnos de caja', ['Turno', 'Abierto', 'Cerrado', 'Fondo', 'Ventas efectivo', 'Esperado', 'Contado', 'Diferencia'],
    cortes.map((c) => [
      '#' + c.id, esc(c.abierto_at || ''), c.estado === 'cerrado' ? esc(c.cerrado_at || '') : h('span', { class: 'badge role' }, 'Abierto'),
      money(c.fondo_inicial), money(c.ventas_efectivo), money(c.efectivo_esperado),
      c.efectivo_contado != null ? money(c.efectivo_contado) : '—',
      c.diferencia == null ? '—' : diffBadge(c.diferencia),
    ])));
  if (cierres.length) root.appendChild(historial('Días cerrados', ['Fecha', 'Ventas', 'Ingreso neto', 'Inversión', 'Ganancia', 'Efectivo', 'Transf.', 'Cerró'],
    cierres.map((c) => [c.fecha, c.ventas, money(c.ingreso_neto), money(c.costo), money(c.ganancia), money(c.efectivo), money(c.transferencia), '@' + esc(c.cerrado_username || '')])));

  // ---------- Turno ----------
  function turnoCard(c) {
    const card = h('div', { class: 'pcard' }, h('h3', {}, 'Turno de caja'));
    if (!c || c.estado === 'cerrado') {
      card.appendChild(h('p', { class: 'muted' }, 'No hay un turno abierto. Ábrelo al empezar para poder cobrar en efectivo.'));
      if (can('caja.turno')) {
        card.appendChild(h('button', { class: 'btn', onclick: () => abrirTurno() }, 'Abrir turno de caja'));
      }
      return card;
    }
    card.appendChild(h('div', { class: 'costeo', style: 'grid-template-columns:repeat(auto-fit,minmax(140px,1fr))' },
      kpi('Fondo inicial', money(c.fondo_inicial)),
      kpi('Ventas en efectivo', money(c.ventas_efectivo)),
      kpi('Ingresos manuales', money(c.ingresos_manuales)),
      kpi('Retiros', '−' + money(c.retiros)),
      kpi('Efectivo esperado', money(c.efectivo_esperado_calc)),
      kpi('Ventas por transferencia', money(c.ventas_transferencia))
    ));
    card.appendChild(h('div', { class: 'muted', style: 'font-size:12px;margin:4px 0 10px' },
      `Turno #${c.id} · abierto por @${esc(c.abierto_username)} · ${esc(c.abierto_at)}`));

    if (c.movimientos.length) {
      card.appendChild(h('div', { class: 'section-title' }, 'Movimientos de efectivo'));
      card.appendChild(h('div', { class: 'card' }, h('table', {}, h('tbody', {},
        ...c.movimientos.map((m) => h('tr', {},
          h('td', {}, m.tipo === 'retiro' ? h('span', { class: 'badge off' }, 'Retiro') : h('span', { class: 'badge on' }, 'Ingreso')),
          h('td', {}, esc(m.concepto)),
          h('td', { style: 'text-align:right' }, (m.tipo === 'retiro' ? '−' : '+') + money(m.monto)),
          h('td', {}, h('span', { class: 'muted', style: 'font-size:11px' }, esc(m.created_at)))
        ))
      ))));
    }

    if (can('caja.turno')) {
      card.appendChild(h('div', { class: 'row-actions', style: 'justify-content:flex-start;margin-top:12px' },
        h('button', { class: 'btn secondary small', onclick: () => movimiento('ingreso') }, '+ Ingreso'),
        h('button', { class: 'btn secondary small', onclick: () => movimiento('retiro') }, '− Retiro'),
        h('button', { class: 'btn', onclick: () => cerrarTurno(c) }, 'Cerrar turno (arqueo)')
      ));
    }
    return card;
  }

  function abrirTurno() {
    const fondo = h('input', { type: 'number', min: '0', step: 'any', value: '0' });
    openModal({
      title: 'Abrir turno de caja',
      body: h('div', {}, field('Efectivo inicial en el cajón', fondo, 'El fondo con el que empiezas el turno.')),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Abrir turno', kind: 'primary', onClick: async (close) => {
          await window.api.caja.abrir(Number(fondo.value) || 0);
          toast('Turno abierto', 'ok'); close(); CajaView(root);
        } },
      ],
    });
  }

  function movimiento(tipo) {
    const monto = h('input', { type: 'number', min: '0', step: 'any' });
    const concepto = h('input', { type: 'text', placeholder: tipo === 'retiro' ? 'Compra de servilletas…' : 'Cambio recibido…' });
    openModal({
      title: tipo === 'retiro' ? 'Retiro de efectivo' : 'Ingreso de efectivo',
      body: h('div', {}, field('Monto', monto), field('Concepto', concepto)),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Registrar', kind: 'primary', onClick: async (close) => {
          await window.api.caja.movimiento(tipo, Number(monto.value), concepto.value.trim());
          toast('Movimiento registrado', 'ok'); close(); CajaView(root);
        } },
      ],
    });
  }

  function cerrarTurno(c) {
    const contado = h('input', { type: 'number', min: '0', step: 'any' });
    const notas = h('input', { type: 'text' });
    const dif = h('div', { class: 'hint' });
    contado.addEventListener('input', () => {
      const d = (Number(contado.value) || 0) - c.efectivo_esperado_calc;
      dif.textContent = Math.abs(d) < 0.005 ? 'Cuadra exacto.' : d > 0 ? `Sobran ${money(d)}` : `Faltan ${money(-d)}`;
    });
    openModal({
      title: 'Cerrar turno — arqueo de efectivo',
      body: h('div', {},
        h('p', {}, 'Efectivo esperado en el cajón: ', h('strong', {}, money(c.efectivo_esperado_calc))),
        field('¿Cuánto efectivo contaste?', contado),
        dif,
        field('Notas', notas, 'Opcional')
      ),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Cerrar turno', kind: 'primary', onClick: async (close) => {
          const r = await window.api.caja.cerrar(Number(contado.value), notas.value.trim());
          toast(r.diferencia === 0 ? 'Turno cerrado, cuadra exacto' : `Turno cerrado (diferencia ${money(r.diferencia)})`, r.diferencia === 0 ? 'ok' : 'err');
          close(); CajaView(root);
        } },
      ],
    });
  }

  // ---------- Cierre de día ----------
  function cierreCard(est) {
    const card = h('div', { class: 'pcard' }, h('h3', {}, `Cierre de día — ${est.fecha}`));
    if (est.cerrado) {
      const c = est.cierre;
      card.appendChild(h('div', { class: 'badge on', style: 'display:inline-block;margin-bottom:8px' }, 'Día cerrado'));
      card.appendChild(resumenGrid(c));
      card.appendChild(h('div', { class: 'muted', style: 'font-size:12px;margin-top:8px' }, `Cerrado por @${esc(c.cerrado_username)} · ${esc(new Date(c.cerrado_at).toLocaleString('es-MX'))}`));
      if (can('caja.cierre_dia')) {
        card.appendChild(h('button', { class: 'btn ghost small', style: 'color:var(--danger);margin-top:10px', onclick: async () => {
          if (!(await confirmDialog({ message: `¿Reabrir el día ${est.fecha}? Se podrá volver a cobrar y editar.`, confirmLabel: 'Reabrir' }))) return;
          try { await window.api.caja.reabrirDia(est.fecha); toast('Día reabierto', 'ok'); CajaView(root); }
          catch (e) { toast(e.message, 'err'); }
        } }, 'Reabrir día'));
      }
      return card;
    }
    const v = est.en_vivo;
    card.appendChild(h('p', { class: 'muted' }, 'Números del día hasta ahora (en vivo). Al cerrar el día se congelan.'));
    card.appendChild(resumenGrid(v));
    if (can('caja.cierre_dia')) {
      card.appendChild(h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => cerrarDia(est.fecha) }, 'Cerrar día'));
    }
    return card;
  }

  function resumenGrid(d) {
    return h('div', { class: 'costeo', style: 'grid-template-columns:repeat(auto-fit,minmax(130px,1fr))' },
      kpi('Ventas', String(d.ventas)),
      kpi('Ingreso neto', money(d.ingreso_neto)),
      kpi('Inversión', money(d.costo)),
      kpi('Ganancia', money(d.ganancia), d.ganancia >= 0 ? 'pos' : 'neg'),
      kpi('Efectivo', money(d.efectivo)),
      kpi('Transferencia', money(d.transferencia)),
      kpi('Merma', money(d.merma_costo), 'neg')
    );
  }

  async function cerrarDia(fecha) {
    if (!(await confirmDialog({ title: 'Cerrar día', message: `¿Cerrar el día ${fecha}? Después no se podrá cobrar en esa fecha sin reabrirlo.`, confirmLabel: 'Cerrar día', kind: 'primary' }))) return;
    try { await window.api.caja.cerrarDia(fecha); toast('Día cerrado', 'ok'); CajaView(root); }
    catch (e) { toast(e.message, 'err'); }
  }

  function kpi(k, val, cls) { return h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v ' + (cls || '') }, val)); }
  function diffBadge(d) {
    if (Math.abs(d) < 0.005) return h('span', { class: 'badge on' }, 'Cuadra');
    return h('span', { class: 'badge off' }, (d > 0 ? '+' : '') + money(d));
  }
  function historial(titulo, encabezados, filas) {
    return h('div', {},
      h('div', { class: 'section-title' }, titulo),
      h('div', { class: 'card' }, h('table', {},
        h('thead', {}, h('tr', {}, ...encabezados.map((e) => h('th', {}, e)))),
        h('tbody', {}, ...filas.map((f) => h('tr', {}, ...f.map((c) => h('td', {}, typeof c === 'string' || typeof c === 'number' ? String(c) : c)))))
      ))
    );
  }
}
