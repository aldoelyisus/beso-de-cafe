import { h, esc, toast } from '../lib/ui.js';
import { can } from '../lib/store.js';
import { Segmented } from '../components/filters.js';

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) => Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 3 });
const iso = (d) => d.toLocaleDateString('en-CA');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** '2026-09-02' -> '2 sep 2026' (sin pasar por Date para no correr la zona horaria) */
function fechaLarga(isoStr) {
  const [y, m, d] = String(isoStr).split('-').map(Number);
  return `${d} ${MESES[m - 1] || '?'} ${y}`;
}

function presetRango(key) {
  const hoy = new Date();
  const h = iso(hoy);
  const start = (d) => iso(d);
  if (key === 'hoy') return [h, h];
  if (key === 'ayer') { const a = new Date(hoy); a.setDate(a.getDate() - 1); return [iso(a), iso(a)]; }
  if (key === 'semana') { const d = new Date(hoy); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return [start(d), h]; }
  if (key === 'mes') return [start(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), h];
  if (key === 'trimestre') { const q = Math.floor(hoy.getMonth() / 3) * 3; return [start(new Date(hoy.getFullYear(), q, 1)), h]; }
  if (key === 'semestre') { const s = hoy.getMonth() < 6 ? 0 : 6; return [start(new Date(hoy.getFullYear(), s, 1)), h]; }
  if (key === 'anio') return [start(new Date(hoy.getFullYear(), 0, 1)), h];
  return [h, h];
}

export async function ReportesView(root) {
  root.innerHTML = '';
  const state = { desde: presetRango('mes')[0], hasta: presetRango('mes')[1], tab: 'resumen', preset: 'mes' };

  const head = h('div', { class: 'page-head' },
    h('div', {}, h('h2', {}, 'Reportes'), h('div', { class: 'muted' }, 'Solo cuentan las ventas pagadas. Los productos cancelados no suman.')));

  const desde = h('input', { type: 'date', value: state.desde });
  const hasta = h('input', { type: 'date', value: state.hasta });
  [desde, hasta].forEach((el) => el.addEventListener('change', () => {
    state.desde = desde.value; state.hasta = hasta.value; state.preset = 'custom'; presetSeg.replaceWith(buildPresets()); load();
  }));

  // El desglose de inversión solo se ofrece por día / semana / mes (anual no).
  const PRESETS_CORTOS = ['hoy', 'ayer', 'semana', 'mes'];
  const presetsDeTab = () => {
    const todos = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Semana'], ['mes', 'Mes'], ['trimestre', 'Trimestre'], ['semestre', 'Semestre'], ['anio', 'Año']];
    return state.tab === 'inversion' ? todos.filter(([v]) => PRESETS_CORTOS.includes(v)) : todos;
  };

  function buildPresets() {
    const seg = Segmented(
      presetsDeTab().map(([v, l]) => ({ value: v, label: l })),
      state.preset,
      (v) => { const [d, hh] = presetRango(v); state.desde = d; state.hasta = hh; state.preset = v; desde.value = d; hasta.value = hh; load(); },
      'Periodo'
    );
    seg.id = 'preset-seg';
    return seg;
  }
  let presetSeg = buildPresets();

  const tabSeg = Segmented(
    [
      { value: 'resumen', label: 'Ganancias' },
      { value: 'productos', label: 'Por producto' },
      { value: 'insumos', label: 'Insumos usados' },
      { value: 'inversion', label: 'Desglose de inversión' },
      { value: 'merma', label: 'Merma' },
    ],
    state.tab,
    (v) => {
      state.tab = v;
      // si la inversión no admite el periodo largo actual, lo bajamos a "mes"
      if (v === 'inversion' && !PRESETS_CORTOS.includes(state.preset)) {
        const [d, hh] = presetRango('mes');
        state.preset = 'mes'; state.desde = d; state.hasta = hh; desde.value = d; hasta.value = hh;
      }
      const nuevo = buildPresets();
      presetSeg.replaceWith(nuevo);
      presetSeg = nuevo;
      load();
    }
  );

  const toolbar = h('div', {},
    h('div', { class: 'toolbar' }, presetSeg, h('span', { class: 'chip-label' }, 'o'), desde, h('span', { class: 'muted' }, 'a'), hasta),
    h('div', { class: 'toolbar' }, tabSeg,
      can('reportes.export')
        ? h('div', { style: 'margin-left:auto;display:flex;gap:8px' },
            h('button', { class: 'btn secondary small', onclick: () => exportar('csv') }, '⬇ Excel'),
            h('button', { class: 'btn secondary small', onclick: () => exportar('pdf') }, '⬇ PDF'))
        : null)
  );

  const body = h('div', {});
  root.append(head, toolbar, body);

  async function exportar(formato) {
    try {
      const r = await window.api.reportes.exportar(state.tab, formato, state.desde, state.hasta);
      if (r.canceled) return;
      if (r.ok) toast('Guardado en ' + r.path, 'ok');
      else toast('No se pudo exportar', 'err');
    } catch (e) { toast(e.message, 'err'); }
  }

  async function load() {
    body.innerHTML = '';
    body.appendChild(h('div', { class: 'hint' }, 'Cargando…'));
    try {
      if (state.tab === 'resumen') body.replaceChildren(await resumen());
      else if (state.tab === 'productos') body.replaceChildren(await productos());
      else if (state.tab === 'insumos') body.replaceChildren(await insumos());
      else if (state.tab === 'inversion') body.replaceChildren(await inversion());
      else body.replaceChildren(await merma());
    } catch (e) {
      body.replaceChildren(h('div', { class: 'empty' }, e.message));
    }
  }

  function eqCell(lbl, amt, sub, cls, amtCls) {
    return h('div', { class: 'cell ' + (cls || '') },
      h('div', { class: 'lbl' }, lbl),
      h('div', { class: 'amt ' + (amtCls || '') }, amt),
      sub ? h('div', { class: 'sub' }, sub) : null);
  }

  function payCell(lbl, monto, total) {
    const p = total > 0 ? Math.round((monto / total) * 100) : 0;
    return h('div', { class: 'cell' },
      h('div', { class: 'top' }, h('span', { class: 'lbl' }, lbl), h('span', { class: 'amt' }, money(monto))),
      h('div', { class: 'rep-bar' }, h('i', { style: `width:${p}%` })),
      h('div', { class: 'pct' }, total > 0 ? `${p}% de lo cobrado` : 'sin cobros'));
  }

  function factItem(lbl, val, cls) {
    return h('span', { class: 'f ' + (cls || '') }, lbl, h('b', {}, val));
  }

  async function resumen() {
    const d = await window.api.reportes.resumen(state.desde, state.hasta);
    const wrap = h('div', {});
    const unDia = state.desde === state.hasta;

    // línea de contexto: qué periodo y cuántas ventas
    wrap.appendChild(h('div', { class: 'rep-ctx' },
      h('span', { class: 'strong' }, unDia ? fechaLarga(state.desde) : `${fechaLarga(state.desde)} — ${fechaLarga(state.hasta)}`),
      h('span', { class: 'dot' }, '·'),
      h('span', {}, `${d.ventas} ${d.ventas === 1 ? 'venta pagada' : 'ventas pagadas'}`),
      d.dias_cerrados ? h('span', { class: 'tag' }, `${d.dias_cerrados} día${d.dias_cerrados === 1 ? '' : 's'} cerrado${d.dias_cerrados === 1 ? '' : 's'}`) : null));

    // ecuación principal: lo que de verdad importa, de un vistazo
    wrap.appendChild(h('div', { class: 'rep-eq' },
      eqCell('Ingreso', money(d.ingreso_neto),
        d.descuentos > 0 ? `ya menos ${money(d.descuentos)} de promos` : 'lo que entró por ventas'),
      h('div', { class: 'op' }, '−'),
      eqCell('Inversión', money(d.costo), 'costo de los insumos vendidos'),
      h('div', { class: 'op' }, '='),
      eqCell('Ganancia', money(d.ganancia), `margen ${d.margen}%`, 'result', d.ganancia >= 0 ? 'pos' : 'neg')));

    if (d.descuentos > 0) wrap.appendChild(h('div', { class: 'hint' },
      `Ingreso bruto (antes de promociones): ${money(d.ingreso_bruto)}.`));

    // cómo entró el dinero
    const cobrado = (d.por_metodo.efectivo || 0) + (d.por_metodo.transferencia || 0);
    wrap.appendChild(h('div', { class: 'section-title' }, 'Cómo entró el dinero'));
    wrap.appendChild(h('div', { class: 'rep-pay' },
      payCell('Efectivo', d.por_metodo.efectivo, cobrado),
      payCell('Transferencia', d.por_metodo.transferencia, cobrado)));

    // otros datos secundarios
    wrap.appendChild(h('div', { class: 'section-title' }, 'Otros datos'));
    wrap.appendChild(h('div', { class: 'rep-facts' },
      factItem('Ticket promedio', money(d.ticket_promedio)),
      d.descuentos > 0 ? factItem('Descuentos en promos', money(d.descuentos)) : null,
      factItem('Costo de merma', money(d.merma_costo), d.merma_costo > 0 ? 'neg' : '')));

    // desglose por día: solo tiene sentido cuando el rango abarca varios días
    if (!unDia) {
      wrap.appendChild(h('div', { class: 'section-title' }, 'Por día'));
      wrap.appendChild(tabla(['Fecha', 'Ventas', 'Ingreso neto', 'Costo', 'Ganancia'],
        d.por_dia.map((x) => [fechaLarga(x.fecha), x.ventas, money(x.ingreso_neto), money(x.costo), money(x.ganancia)]),
        d.por_dia.length ? null : 'Sin ventas en el periodo.'));
    }
    return wrap;
  }

  async function productos() {
    const d = await window.api.reportes.productos(state.desde, state.hasta);
    const filas = d.filas.map((p) => [p.producto, p.unidades, money(p.ingreso_neto), money(p.costo), money(p.ganancia), p.margen + '%']);
    if (d.filas.length) filas.push(['TOTAL', d.total.unidades, money(d.total.ingreso_neto), money(d.total.costo), money(d.total.ganancia), d.total.margen + '%']);
    return tabla(['Producto', 'Unidades', 'Ingreso', 'Inversión (costo)', 'Ganancia', 'Margen'], filas,
      d.filas.length ? null : 'Sin ventas en el periodo.', filas.length - 1);
  }

  async function insumos() {
    const d = await window.api.reportes.insumos(state.desde, state.hasta);
    const filas = d.filas.map((r) => [r.nombre, num(r.cantidad) + ' ' + r.unidad_base, money(r.costo)]);
    if (d.filas.length) filas.push(['TOTAL', '', money(d.total_costo)]);
    return tabla(['Insumo', 'Cantidad usada', 'Costo'], filas, d.filas.length ? null : 'Sin consumo en el periodo.', filas.length - 1);
  }

  async function inversion() {
    const d = await window.api.reportes.inversion(state.desde, state.hasta);
    const wrap = h('div', {});
    if (!d.productos.length) return h('div', { class: 'card' }, h('div', { class: 'empty' }, 'Sin ventas en el periodo.'));

    wrap.appendChild(h('div', { class: 'hint', style: 'margin-bottom:10px' },
      'Por cada producto vendido, lo que consumió su receta (× unidades). Abajo, el total de cada insumo usado en el periodo. Exporta a PDF con ⬇ PDF.'));

    for (const p of d.productos) {
      wrap.appendChild(h('div', { class: 'section-title', style: 'display:flex;justify-content:space-between;align-items:baseline' },
        h('span', {}, `${esc(p.producto)}  ·  ${p.unidades} vendido(s)`),
        h('span', { class: 'muted' }, 'inversión ' + money(p.costo))));
      wrap.appendChild(tabla(['Insumo', 'Cantidad', 'Costo'],
        p.insumos.map((i) => [i.nombre, num(i.cantidad) + ' ' + i.unidad_base, money(i.costo)])));
    }

    wrap.appendChild(h('div', { class: 'section-title', style: 'border-top:2px solid var(--line);padding-top:10px;margin-top:18px' }, 'Total por insumo (todo el periodo)'));
    const filas = d.total_insumos.map((t) => [t.nombre, num(t.cantidad) + ' ' + t.unidad_base, money(t.costo)]);
    filas.push(['INVERSIÓN TOTAL', '', money(d.total_costo)]);
    wrap.appendChild(tabla(['Insumo', 'Cantidad total', 'Costo total'], filas, null, filas.length - 1));
    return wrap;
  }

  async function merma() {
    const d = await window.api.reportes.merma(state.desde, state.hasta);
    const wrap = h('div', {});
    const filas = d.por_insumo.map((r) => [r.nombre, num(r.cantidad) + ' ' + r.unidad_base, money(r.costo)]);
    if (d.por_insumo.length) filas.push(['TOTAL', '', money(d.total_costo)]);
    wrap.appendChild(tabla(['Insumo', 'Cantidad', 'Costo'], filas, d.por_insumo.length ? null : 'Sin merma registrada en el periodo.', filas.length - 1));
    if (d.por_motivo.length) {
      wrap.appendChild(h('div', { class: 'section-title' }, 'Por motivo'));
      wrap.appendChild(tabla(['Motivo', 'Eventos', 'Costo'], d.por_motivo.map((r) => [r.motivo, r.eventos, money(r.costo)])));
    }
    return wrap;
  }

  function tabla(encabezados, filas, vacio, filaTotalIdx) {
    if (!filas.length) return h('div', { class: 'card' }, h('div', { class: 'empty' }, vacio || 'Sin datos.'));
    return h('div', { class: 'card' }, h('table', {},
      h('thead', {}, h('tr', {}, ...encabezados.map((e) => h('th', {}, e)))),
      h('tbody', {}, ...filas.map((f, i) => h('tr', { style: i === filaTotalIdx ? 'font-weight:700;background:var(--surface-2)' : '' },
        ...f.map((c) => h('td', {}, String(c))))))
    ));
  }

  await load();
}
