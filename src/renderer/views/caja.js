import { h, esc, toast, openModal, confirmDialog, field } from '../lib/ui.js';
import { can } from '../lib/store.js';

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const soloHora = (s) => String(s || '').slice(11, 16);

/**
 * Pantalla de Caja — una cosa a la vez.
 *
 * Antes mostraba de golpe el turno, el cierre del día y dos historiales: 13
 * números y 16 columnas de tabla en la misma vista, y había que entender que
 * "turno" y "día" eran dos cosas distintas que se cierran por separado y en
 * cierto orden. La dueña lo describió como "reburujado".
 *
 * Ahora la pantalla enseña **solo el paso que toca**: abrir la caja, o el
 * efectivo que debería haber en el cajón, o que el día ya se cerró. El
 * desglose y el historial están, pero plegados. Y al cerrar la caja el
 * propio sistema pregunta si ya se acabó el día: nadie tiene que acordarse
 * de que son dos pasos.
 */
export async function CajaView(root) {
  root.innerHTML = '';
  const [corte, estadoDia, cortes] = await Promise.all([
    window.api.caja.corte(),
    window.api.caja.estadoDia(),
    window.api.caja.cortes({ limit: 20 }),
  ]);
  const abierta = corte && corte.estado === 'abierto';

  root.appendChild(h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Corte de caja'),
      h('div', { class: 'muted' }, 'El efectivo del cajón: con cuánto empiezas, qué entra y sale, y cuánto debería haber al cerrar.'))));

  root.appendChild(abierta ? cajaAbiertaCard(corte) : cajaCerradaCard(estadoDia));
  root.appendChild(historialPlegado(cortes));

  // ---------- Caja cerrada (o día cerrado) ----------
  function cajaCerradaCard(est) {
    const card = h('div', { class: 'pcard' });
    if (est.cerrado) {
      const c = est.cierre;
      card.append(
        h('h3', {}, 'El día de hoy ya está cerrado ', h('span', { class: 'badge on' }, 'Cerrado')),
        h('p', {}, `Quedaron ${c.ventas} venta(s) por ${money(c.ingreso_neto)}. Los números del día ya están congelados para los reportes.`),
        h('div', { class: 'hint' }, 'Mientras esté cerrado no se puede cobrar con la fecha de hoy. Si falta registrar algo, reábrelo.')
      );
      if (can('caja.cierre_dia')) {
        card.appendChild(h('button', {
          class: 'btn secondary', style: 'margin-top:12px',
          onclick: async () => {
            if (!(await confirmDialog({ title: 'Reabrir el día', message: `¿Reabrir el día ${est.fecha}? Se podrá volver a cobrar con esta fecha.`, confirmLabel: 'Reabrir', kind: 'primary' }))) return;
            try { await window.api.caja.reabrirDia(est.fecha); toast('Día reabierto', 'ok'); CajaView(root); }
            catch (e) { toast(e.message, 'err'); }
          },
        }, 'Reabrir el día'));
      }
      return card;
    }

    card.append(
      h('h3', {}, 'La caja está cerrada'),
      h('p', { class: 'muted' }, 'Ábrela al empezar para poder cobrar en efectivo. Las transferencias se pueden cobrar aunque la caja esté cerrada.')
    );
    if (can('caja.turno')) {
      card.appendChild(h('button', { class: 'btn', onclick: () => abrirCaja() }, 'Abrir caja'));
    }
    return card;
  }

  // ---------- Caja abierta ----------
  function cajaAbiertaCard(c) {
    const card = h('div', { class: 'pcard' },
      h('h3', {}, 'Caja abierta ',
        h('span', { class: 'muted', style: 'font-weight:400;font-size:13px' },
          `desde las ${soloHora(c.abierto_at)} · @${esc(c.abierto_username || '')}`)),
      // Lo único que de verdad importa al cerrar: contra qué número se compara
      // lo que hay en el cajón.
      h('div', { class: 'caja-total' },
        h('div', { class: 'k' }, 'Deberías tener en el cajón'),
        h('div', { class: 'v' }, money(c.efectivo_esperado_calc))),
      h('div', { class: 'caja-desglose' },
        `fondo ${money(c.fondo_inicial)}`,
        ` + ventas en efectivo ${money(c.ventas_efectivo)}`,
        c.ingresos_manuales ? ` + entradas ${money(c.ingresos_manuales)}` : '',
        c.retiros ? ` − salidas ${money(c.retiros)}` : '')
    );

    if (c.ventas_transferencia) {
      card.appendChild(h('div', { class: 'hint' },
        `Además se cobraron ${money(c.ventas_transferencia)} por transferencia — ese dinero no va en el cajón.`));
    }
    if (estadoDia.cerrado) {
      card.appendChild(h('div', { class: 'form-error', style: 'margin-top:10px' },
        'Ojo: el día de hoy está cerrado, así que no se puede cobrar hasta reabrirlo.'));
    }

    if (c.movimientos.length) card.appendChild(plegable(`Ver movimientos (${c.movimientos.length})`, () =>
      h('div', { class: 'card', style: 'margin-top:8px' },
        ...c.movimientos.map((m) => h('div', { class: 'pay-row' },
          h('span', {}, m.tipo === 'retiro' ? h('span', { class: 'badge off' }, 'Salió') : h('span', { class: 'badge on' }, 'Entró')),
          h('span', { class: 'grow' }, esc(m.concepto)),
          h('span', {}, (m.tipo === 'retiro' ? '−' : '+') + money(m.monto)),
          h('span', { class: 'muted', style: 'font-size:11px' }, soloHora(m.created_at)))))));

    if (can('caja.turno')) {
      card.appendChild(h('div', { class: 'caja-acciones' },
        h('div', { style: 'display:flex;gap:8px' },
          h('button', { class: 'btn secondary small', onclick: () => movimiento('ingreso') }, 'Entró efectivo'),
          h('button', { class: 'btn secondary small', onclick: () => movimiento('retiro') }, 'Salió efectivo')),
        h('button', { class: 'btn', onclick: () => cerrarCaja(c) }, 'Cerrar caja')));
    }
    return card;
  }

  // ---------- Historial, plegado ----------
  function historialPlegado(lista) {
    const cerrados = lista.filter((c) => c.estado === 'cerrado');
    if (!cerrados.length) return h('div', {});

    const fila = (c) => h('tr', {},
      h('td', {}, esc(c.cerrado_at || '')),
      h('td', {}, money(c.efectivo_esperado)),
      h('td', {}, c.efectivo_contado != null ? money(c.efectivo_contado) : '—'),
      h('td', {}, c.diferencia == null ? '—' : diffBadge(c.diferencia)),
      h('td', {}, '@' + esc(c.cerrado_username || ''))
    );
    const tabla = () => h('div', { class: 'card', style: 'margin-top:8px' },
      h('table', {},
        h('thead', {}, h('tr', {},
          h('th', {}, 'Cerrada'), h('th', {}, 'Esperado'), h('th', {}, 'Contado'),
          h('th', {}, 'Diferencia'), h('th', {}, 'Quién'))),
        h('tbody', {}, ...cerrados.map(fila))
      )
    );
    return h('div', { style: 'margin-top:18px' },
      plegable(`Historial de cierres (${cerrados.length})`, tabla));
  }

  /** Un "› Título" que abre y cierra su contenido. El contenido se arma una sola vez. */
  function plegable(titulo, contenidoFn) {
    const caja = h('div', { style: 'display:none' });
    let armado = false;
    const flecha = h('span', {}, '› ');
    const btn = h('button', {
      class: 'btn ghost small', style: 'padding-left:0',
      onclick: () => {
        if (!armado) { caja.appendChild(contenidoFn()); armado = true; }
        const abierto = caja.style.display !== 'none';
        caja.style.display = abierto ? 'none' : '';
        flecha.textContent = abierto ? '› ' : '⌄ ';
      },
    }, flecha, titulo);
    return h('div', { style: 'margin-top:10px' }, btn, caja);
  }

  // ---------- Acciones ----------
  function abrirCaja() {
    const fondo = h('input', { type: 'number', min: '0', step: 'any', value: '0' });
    openModal({
      title: 'Abrir caja',
      body: h('div', {}, field('¿Con cuánto efectivo empiezas?', fondo, 'Lo que hay en el cajón en este momento. Si está vacío, déjalo en 0.')),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Abrir caja', kind: 'primary', onClick: async (close) => {
          // Se manda tal cual se escribió: el servicio distingue "vacío" de "0".
          await window.api.caja.abrir(fondo.value);
          toast('Caja abierta', 'ok'); close(); CajaView(root);
        } },
      ],
    });
  }

  function movimiento(tipo) {
    const esRetiro = tipo === 'retiro';
    const monto = h('input', { type: 'number', min: '0', step: 'any' });
    const concepto = h('input', { type: 'text', placeholder: esRetiro ? 'Compra de servilletas…' : 'Cambio que trajo la dueña…' });
    openModal({
      title: esRetiro ? 'Salió efectivo del cajón' : 'Entró efectivo al cajón',
      body: h('div', {},
        field('¿Cuánto?', monto),
        field('¿Para qué?', concepto, 'Para acordarse después de por qué no cuadra el cajón')),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Registrar', kind: 'primary', onClick: async (close) => {
          await window.api.caja.movimiento(tipo, monto.value, concepto.value.trim());
          toast('Anotado', 'ok'); close(); CajaView(root);
        } },
      ],
    });
  }

  /** Paso 1: el arqueo. Al terminar, el paso 2 pregunta por el día. */
  function cerrarCaja(c) {
    const esperado = c.efectivo_esperado_calc;
    const contado = h('input', { type: 'number', min: '0', step: 'any', placeholder: '$' });
    const notas = h('input', { type: 'text', placeholder: 'Opcional' });
    const dif = h('div', { class: 'hint', style: 'font-size:14px;min-height:20px' });
    const sync = () => {
      dif.innerHTML = '';
      if (String(contado.value).trim() === '') { dif.textContent = 'Cuenta el efectivo del cajón y escribe el total.'; return; }
      const d = round2(Number(contado.value) - esperado);
      dif.appendChild(Math.abs(d) < 0.005
        ? h('span', { style: 'color:var(--ok);font-weight:700' }, 'Cuadra exacto ✓')
        : h('span', { style: `color:var(--${d > 0 ? 'ok' : 'danger'});font-weight:700` },
            d > 0 ? `Sobran ${money(d)}` : `Faltan ${money(-d)}`));
    };
    contado.addEventListener('input', sync);
    sync();

    openModal({
      title: 'Cerrar caja',
      body: h('div', {},
        h('p', {}, 'Deberías tener en el cajón: ', h('strong', {}, money(esperado))),
        field('¿Cuánto efectivo contaste?', contado),
        dif,
        field('Notas', notas, 'Por si hubo algo raro que explicar')),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Cerrar caja', kind: 'primary', onClick: async (close) => {
          if (String(contado.value).trim() === '') throw new Error('Escribe cuánto efectivo contaste.');
          const r = await window.api.caja.cerrar(contado.value, notas.value.trim());
          toast(r.diferencia === 0 ? 'Caja cerrada, cuadra exacto' : `Caja cerrada (diferencia ${money(r.diferencia)})`,
            r.diferencia === 0 ? 'ok' : 'err');
          close();
          await preguntarPorElDia();
        } },
      ],
    });
  }

  /** Paso 2: lo que antes era un botón aparte que había que recordar. */
  async function preguntarPorElDia() {
    if (!can('caja.cierre_dia')) { CajaView(root); return; }
    let est;
    try { est = await window.api.caja.estadoDia(); }
    catch { CajaView(root); return; }
    if (est.cerrado) { CajaView(root); return; }

    openModal({
      title: '¿Ya terminaste el día?',
      body: h('div', {},
        h('p', {}, 'La caja quedó cerrada. Si ya no vas a cobrar nada más hoy, cierra también el día.'),
        h('div', { class: 'hint' },
          'Cerrar el día congela sus números para los reportes y evita cobrar con la fecha equivocada. ' +
          'Si todavía falta algo, déjalo abierto: lo puedes cerrar después desde esta misma pantalla.')),
      onClose: () => CajaView(root),
      buttons: [
        { label: 'Todavía no', kind: 'secondary', onClick: (close) => close() },
        { label: 'Sí, cerrar el día', kind: 'primary', onClick: async (close) => {
          await window.api.caja.cerrarDia(est.fecha);
          toast('Día cerrado', 'ok');
          close();
        } },
      ],
    });
  }

  function diffBadge(d) {
    if (Math.abs(d) < 0.005) return h('span', { class: 'badge on' }, 'Cuadra');
    return h('span', { class: 'badge off' }, (d > 0 ? '+' : '') + money(d));
  }
}
