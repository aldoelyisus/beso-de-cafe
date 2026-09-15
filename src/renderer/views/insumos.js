import { h, esc, toast, openModal, confirmDialog, field } from '../lib/ui.js';
import { can } from '../lib/store.js';
import { Pager } from '../components/pager.js';
import { SearchBox, ChipRow, Toggle, Segmented, sortableTh } from '../components/filters.js';

const SHORT_BASE = { g: 'g', ml: 'ml', pieza: 'pza' };

const PAGE_SIZE = 15;

const fmt = (n, d = 2) => Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: d });
const money = (n, d = 2) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

export async function InsumosView(root) {
  root.innerHTML = '';
  const state = { search: '', categoriaId: '', soloBajoStock: false, sort: 'nombre', page: 1 };

  const [meta, cats] = await Promise.all([
    window.api.inventory.meta(),
    window.api.insumoCategorias.options(),
  ]);
  const unidades = meta.unidades;
  const unitLabel = (k) => (unidades.find((u) => u.key === k) || {}).label || k;

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Insumos'),
      // El faltante (existencia negativa) es un problema distinto a "por
      // acabarse" y se avisa aparte: ahí salió mercancía sin registrar.
      h('div', { class: 'muted' },
        meta.faltantes
          ? h('span', { class: 'aviso-faltante' }, `⛔ ${meta.faltantes} insumo(s) con faltante`)
          : null,
        meta.faltantes && meta.bajoStock ? ' · ' : null,
        meta.bajoStock
          ? `⚠ ${meta.bajoStock} insumo(s) por acabarse`
          : (meta.faltantes ? '' : 'Ingredientes y materiales con su existencia y costo.'))
    ),
    can('insumos.create')
      ? h('button', { class: 'btn', onclick: () => openInsumoModal(root, null, cats, unidades) }, '+ Nuevo insumo')
      : null
  );

  const searchBox = SearchBox('Buscar insumo…', (v) => {
    state.search = v; state.page = 1; load();
  });

  const bajoToggle = Toggle('Por acabarse', false, (on) => {
    state.soloBajoStock = on; state.page = 1; load();
  });

  const catChips = ChipRow(
    [{ value: '', label: 'Todas' }, ...cats.map((c) => ({ value: String(c.id), label: c.nombre }))],
    state.categoriaId,
    (v) => { state.categoriaId = v; state.page = 1; load(); }
  );

  const toolbar = h('div', {},
    h('div', { class: 'toolbar' }, searchBox, bajoToggle),
    h('div', { class: 'toolbar', style: 'margin-top:0' },
      h('span', { class: 'chip-label' }, 'Categoría'), catChips)
  );

  const tableWrap = h('div', { class: 'card' });
  const pagerWrap = h('div', {});
  root.append(head, toolbar, tableWrap, pagerWrap);

  async function load() {
    tableWrap.innerHTML = '';
    pagerWrap.innerHTML = '';
    const res = await window.api.insumos.list({ includeInactive: true, pageSize: PAGE_SIZE, ...state });
    if (!res.rows.length) {
      tableWrap.appendChild(h('div', { class: 'empty' }, 'Sin insumos para este filtro.'));
      return;
    }
    const onSort = (key) => { state.sort = key; state.page = 1; load(); };
    tableWrap.appendChild(
      h('table', {},
        h('thead', {}, h('tr', {},
          sortableTh('Insumo', { asc: 'nombre', desc: 'nombre_desc' }, state.sort, onSort),
          h('th', {}, 'Categoría'),
          sortableTh('Existencia', { asc: 'stock_asc', desc: 'stock_desc' }, state.sort, onSort),
          h('th', {}, 'Mínimo'),
          sortableTh('Costo unitario', { asc: 'costo_asc', desc: 'costo_desc' }, state.sort, onSort),
          h('th', {}, 'Estado'),
          h('th', {}, ''))),
        h('tbody', {}, ...res.rows.map((i) => insumoRow(i)))
      )
    );
    pagerWrap.appendChild(Pager(res, (p) => { state.page = p; load(); }));
  }

  function insumoRow(i) {
    const actions = h('div', { class: 'row-actions' });
    if (can('insumos.stock') && i.is_active) {
      actions.appendChild(h('button', { class: 'btn small secondary', onclick: () => openMovimientosModal(root, i.id) }, 'Existencias'));
    }
    if (can('insumos.edit')) {
      actions.appendChild(h('button', { class: 'btn small secondary', onclick: () => openInsumoModal(root, i.id, cats, unidades) }, 'Editar'));
    }
    if (can('insumos.delete')) {
      actions.appendChild(i.is_active
        ? h('button', {
            class: 'btn small danger',
            onclick: async () => {
              if (!(await confirmDialog({ message: `¿Dar de baja el insumo "${i.nombre}"?`, confirmLabel: 'Dar de baja' }))) return;
              try { await window.api.insumos.deactivate(i.id); toast('Insumo dado de baja', 'ok'); load(); }
              catch (e) { toast(e.message, 'err'); }
            },
          }, 'Baja')
        : h('button', {
            class: 'btn small secondary',
            onclick: async () => {
              try { await window.api.insumos.activate(i.id); toast('Insumo reactivado', 'ok'); load(); }
              catch (e) { toast(e.message, 'err'); }
            },
          }, 'Reactivar'));
    }

    const stockCell = h('td', {},
      h('strong', {}, fmt(i.stock) + ' '),
      h('span', { class: 'muted' }, i.unidad_base),
      i.faltante && i.is_active
        ? h('span', { class: 'badge faltante', style: 'margin-left:8px' }, `Faltan ${fmt(Math.abs(i.stock))}`)
        : (i.bajo_stock && i.is_active ? h('span', { class: 'badge off', style: 'margin-left:8px' }, 'Bajo') : null)
    );

    return h('tr', { style: i.is_active ? '' : 'opacity:.55' },
      h('td', {}, h('strong', {}, esc(i.nombre)),
        i.unidad_compra ? h('div', { class: 'muted', style: 'font-size:12px' }, `compra: ${esc(i.unidad_compra)} (×${fmt(i.factor_compra, 3)} ${i.unidad_base})`) : null),
      h('td', {}, i.categoria_nombre ? esc(i.categoria_nombre) : h('span', { class: 'muted' }, 'Sin categoría')),
      stockCell,
      h('td', {}, fmt(i.stock_minimo) + ' ' + i.unidad_base),
      h('td', {}, money(i.costo_unitario, 4), h('span', { class: 'muted' }, ' /' + i.unidad_base)),
      h('td', {}, i.is_active ? h('span', { class: 'badge on' }, 'Activo') : h('span', { class: 'badge off' }, 'Baja')),
      h('td', {}, actions)
    );
  }

  await load();
}

function unitSelect(unidades, selected) {
  return h('select', {}, ...unidades.map((u) => {
    const o = h('option', { value: u.key }, `${u.label} — ${u.tipo}`);
    if (u.key === selected) o.selected = true;
    return o;
  }));
}

async function openInsumoModal(root, id, cats, unidades) {
  const i = id ? await window.api.insumos.get(id) : null;

  const nombre = h('input', { type: 'text', value: i ? i.nombre : '' });
  const unidadBase = unitSelect(unidades, i ? i.unidad_base : 'pieza');
  // Si el insumo tiene una categoría dada de baja, la agregamos para no perderla.
  const catList = cats.slice();
  if (i && i.categoria_id && !catList.some((c) => String(c.id) === String(i.categoria_id))) {
    catList.push({ id: i.categoria_id, nombre: `${i.categoria_nombre} (dada de baja)`, unidad_sugerida: i.unidad_base });
  }
  const categoria = h('select', {},
    h('option', { value: '' }, 'Sin categoría'),
    ...catList.map((c) => {
      const o = h('option', { value: String(c.id), 'data-unidad': c.unidad_sugerida }, c.nombre);
      if (i && String(c.id) === String(i.categoria_id)) o.selected = true;
      return o;
    })
  );
  // Al elegir categoría (en alta), sugerir su unidad base.
  let unidadTocada = !!id;
  unidadBase.addEventListener('change', () => { unidadTocada = true; onBaseChanged(); });
  categoria.addEventListener('change', () => {
    if (unidadTocada) return;
    const opt = categoria.selectedOptions[0];
    if (opt && opt.dataset.unidad) { unidadBase.value = opt.dataset.unidad; onBaseChanged(); }
  });

  const unidadCompra = h('input', { type: 'text', value: i ? i.unidad_compra : '', placeholder: 'Bolsa 1 kg, Paquete 50…' });
  const factor = h('input', { type: 'number', min: '0', step: 'any', value: i ? i.factor_compra : '1' });
  const costoCompra = h('input', { type: 'number', min: '0', step: 'any', value: i ? i.costo_compra : '0' });
  const stockInicial = h('input', { type: 'number', min: '0', step: 'any', value: '0' });
  const stockMin = h('input', { type: 'number', min: '0', step: 'any', value: i ? i.stock_minimo : '0' });
  const notas = h('input', { type: 'text', value: i ? i.notas : '' });

  const costoInfo = h('div', { class: 'hint' });
  function syncCosto() {
    const f = Number(factor.value) || 0;
    const cc = Number(costoCompra.value) || 0;
    const base = f > 0 ? cc / f : 0;
    costoInfo.textContent = f > 0
      ? `Costo por ${unidadBase.value}: ${money(base, 4)}  ·  1 ${unidadCompra.value || 'unidad de compra'} = ${fmt(f, 3)} ${unidadBase.value}`
      : 'Indica cuánto rinde cada compra para calcular el costo por unidad base.';
  }
  [factor, costoCompra, unidadCompra].forEach((el) => el.addEventListener('input', syncCosto));

  // --- Atajo de presentación de compra ---
  const manualFields = h('div', { class: 'grid-2' },
    field('¿Cómo se compra?', unidadCompra, 'Nombre de la presentación'),
    field('Rinde (en unidad base)', factor, 'Cuántas unidades base trae una compra')
  );
  const presetRow = h('div', { style: 'margin-bottom:10px' });

  function detectModo() {
    const f = Number(i ? i.factor_compra : 1);
    const uc = String(i ? i.unidad_compra : '').toLowerCase();
    if (!i || f === 1) return 'suelto';
    if (i.unidad_base === 'g' && f === 1000 && /^(kilo|kg|kilogramo)/.test(uc)) return 'kg';
    if (i.unidad_base === 'ml' && f === 1000 && /^(litro|lt?|l)$/.test(uc)) return 'litro';
    return 'otra';
  }
  let modo = detectModo();

  function applyModo(m, { silent = false } = {}) {
    modo = m;
    const base = unidadBase.value;
    if (m === 'suelto') { unidadCompra.value = SHORT_BASE[base] || base; factor.value = '1'; }
    else if (m === 'kg') { unidadCompra.value = 'Kilo'; factor.value = '1000'; }
    else if (m === 'litro') { unidadCompra.value = 'Litro'; factor.value = '1000'; }
    const manual = m === 'otra';
    unidadCompra.disabled = !manual;
    factor.disabled = !manual;
    manualFields.style.opacity = manual ? '1' : '.55';
    if (!silent) { syncCosto(); renderPresets(); }
  }

  function renderPresets() {
    presetRow.innerHTML = '';
    const base = unidadBase.value;
    const opts = [{ value: 'suelto', label: `Suelto (por ${SHORT_BASE[base] || base})` }];
    if (base === 'g') opts.push({ value: 'kg', label: 'Por kilo' });
    if (base === 'ml') opts.push({ value: 'litro', label: 'Por litro' });
    opts.push({ value: 'otra', label: 'Otra presentación' });
    if (!opts.some((o) => o.value === modo)) modo = 'suelto';
    presetRow.appendChild(Segmented(opts, modo, (v) => applyModo(v)));
  }

  // Reacciona a un cambio de unidad base (por el usuario o sugerido por la categoría).
  function onBaseChanged() {
    if ((modo === 'kg' && unidadBase.value !== 'g') || (modo === 'litro' && unidadBase.value !== 'ml')) modo = 'suelto';
    renderPresets();
    applyModo(modo);
  }

  renderPresets();
  applyModo(modo, { silent: true });
  syncCosto();

  const body = h('div', {},
    field('Nombre del insumo', nombre),
    h('div', { class: 'grid-2' },
      field('Categoría', categoria),
      field('Unidad base (stock y recetas)', unidadBase)
    ),
    h('div', { class: 'section-title' }, 'Presentación de compra'),
    presetRow,
    manualFields,
    field('Costo de compra', costoCompra, '$ por cada compra (kilo, litro, paquete…)'),
    costoInfo,
    id ? null : field('Existencia inicial', stockInicial, 'En unidades de compra (kilos, litros, piezas…).'),
    field('Stock mínimo (alerta)', stockMin, 'En unidad base. Avisa cuando la existencia baja de aquí.'),
    field('Notas', notas, 'Opcional'),
  );

  openModal({
    title: id ? `Editar insumo: ${i.nombre}` : 'Nuevo insumo',
    wide: true,
    body,
    buttons: [
      { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
      {
        label: id ? 'Guardar cambios' : 'Crear insumo',
        kind: 'primary',
        onClick: async (close) => {
          const data = {
            nombre: nombre.value.trim(),
            categoria_id: categoria.value || null,
            unidad_base: unidadBase.value,
            unidad_compra: unidadCompra.value.trim(),
            factor_compra: Number(factor.value) || 1,
            costo_compra: Number(costoCompra.value) || 0,
            stock_minimo: Number(stockMin.value) || 0,
            notas: notas.value.trim(),
          };
          if (id) {
            await window.api.insumos.update(id, data);
          } else {
            await window.api.insumos.create({ ...data, stock_inicial_compra: Number(stockInicial.value) || 0 });
          }
          toast(id ? 'Insumo actualizado' : 'Insumo creado', 'ok');
          close();
          InsumosView(root);
        },
      },
    ],
  });
}

async function openMovimientosModal(root, id) {
  const [insumo, meta] = await Promise.all([
    window.api.insumos.get(id),
    window.api.inventory.meta(),
  ]);
  let movimientos = await window.api.insumos.movimientos(id, 100);

  const puedeCosto = can('insumos.costo');
  const tipo = h('select', {},
    h('option', { value: 'entrada' }, 'Entrada (compra / recepción)'),
    h('option', { value: 'merma' }, 'Merma (pérdida)'),
    h('option', { value: 'ajuste' }, 'Ajuste por conteo físico'),
    puedeCosto ? h('option', { value: 'ajuste_costo' }, 'Corregir costo (no cambia la existencia)') : null
  );

  const cantidad = h('input', { type: 'number', min: '0', step: 'any', value: '' });
  const costoCompra = h('input', { type: 'number', min: '0', step: 'any', value: insumo.costo_compra });
  const proveedor = h('input', { type: 'text', value: '', placeholder: 'Bodega, frutería del mercado…' });
  const conteo = h('input', { type: 'number', min: '0', step: 'any', value: '' });
  // Corregir costo: se escribe el precio de la presentación (el kilo, el paquete),
  // igual que en una entrada, y aquí mismo se ve en qué queda por unidad base.
  const presentacion = insumo.unidad_compra || insumo.unidad_base;
  const nuevoCosto = h('input', { type: 'number', min: '0', step: 'any', value: insumo.costo_compra });
  const nuevoCostoInfo = h('div', { class: 'hint' });
  function syncNuevoCosto() {
    const v = Number(nuevoCosto.value);
    const f = insumo.factor_compra > 0 ? insumo.factor_compra : 1;
    nuevoCostoInfo.textContent = v > 0
      ? `Queda en ${money(v / f, 4)} por ${insumo.unidad_base} (antes ${money(insumo.costo_unitario, 4)}). `
        + 'No cambia la existencia y solo aplica a las ventas de aquí en adelante.'
      : `Escribe cuánto cuesta ahora 1 ${presentacion}.`;
  }
  nuevoCosto.addEventListener('input', syncNuevoCosto);
  const motivo = h('select', {}, ...meta.motivosMerma.map((m) => h('option', { value: m.key }, m.label)));
  const nota = h('input', { type: 'text', value: '' });

  const dynFields = h('div', {});
  function renderFields() {
    dynFields.innerHTML = '';
    if (tipo.value === 'entrada') {
      dynFields.append(
        field(`Cantidad (en ${insumo.unidad_compra || insumo.unidad_base})`, cantidad),
        field('Costo de compra', costoCompra, `$ por ${insumo.unidad_compra || 'unidad'} — actualiza el costo promedio`),
        field('Tienda / proveedor', proveedor, 'Opcional — dónde lo compraste esta vez')
      );
    } else if (tipo.value === 'ajuste_costo') {
      syncNuevoCosto();
      dynFields.append(
        field(`Nuevo precio por ${presentacion}`, nuevoCosto,
          insumo.factor_compra > 1
            ? `Lo que cuesta ahora 1 ${presentacion} completo (${fmt(insumo.factor_compra, 3)} ${insumo.unidad_base}). Precio actual: ${money(insumo.costo_compra)}.`
            : `Lo que cuesta ahora 1 ${presentacion}. Precio actual: ${money(insumo.costo_compra)}.`),
        nuevoCostoInfo,
        field('Motivo', nota, 'Obligatorio — por qué se corrige')
      );
    } else if (tipo.value === 'merma') {
      dynFields.append(
        field(`Cantidad perdida (en ${insumo.unidad_base})`, cantidad),
        field('Motivo', motivo),
        field('Nota', nota, 'Opcional')
      );
    } else {
      dynFields.append(
        field(`Conteo físico real (en ${insumo.unidad_base})`, conteo, `Existencia registrada ahora: ${fmt(insumo.stock)} ${insumo.unidad_base}`),
        field('Nota', nota, 'Opcional')
      );
    }
  }
  tipo.addEventListener('change', renderFields);
  renderFields();

  const historial = h('div', {});
  function renderHistorial() {
    historial.innerHTML = '';
    historial.appendChild(h('div', { class: 'section-title' }, 'Últimos movimientos'));
    if (!movimientos.length) { historial.appendChild(h('div', { class: 'hint' }, 'Sin movimientos todavía.')); return; }
    historial.appendChild(h('div', { class: 'card' },
      h('table', {},
        h('thead', {}, h('tr', {},
          h('th', {}, 'Fecha'), h('th', {}, 'Tipo'), h('th', {}, 'Cantidad'), h('th', {}, 'Stock'), h('th', {}, 'Motivo'), h('th', {}, 'Usuario'))),
        h('tbody', {}, ...movimientos.map((m) => {
          const esCosto = m.tipo === 'ajuste_costo';
          return h('tr', {},
            h('td', {}, esc(m.created_at)),
            h('td', {}, h('span', { class: 'badge ' + (esCosto ? 'inherit' : m.cantidad_base >= 0 ? 'on' : 'off') },
              esCosto ? 'costo' : m.tipo)),
            h('td', {}, esCosto
              // Los renglones viejos guardaban el costo por unidad base ("$/g");
              // los nuevos, el precio de la presentación ("Kilo").
              ? (String(m.unidad_captura || '').startsWith('$/')
                  ? money(m.costo_unitario, 4) + ' /' + insumo.unidad_base
                  : `${money(m.cantidad_captura)} /${esc(m.unidad_captura)} · ${money(m.costo_unitario, 4)} /${insumo.unidad_base}`)
              : (m.cantidad_base >= 0 ? '+' : '') + fmt(m.cantidad_base) + ' ' + insumo.unidad_base),
            h('td', {}, esCosto ? h('span', { class: 'muted' }, 'sin cambio') : fmt(m.stock_resultante) + ' ' + insumo.unidad_base),
            h('td', {}, esc(m.motivo || '—'),
              m.proveedor ? h('div', { class: 'muted', style: 'font-size:12px' }, '🏪 ' + esc(m.proveedor)) : null),
            h('td', {}, m.username ? '@' + esc(m.username) : '—')
          );
        }))
      )
    ));
  }
  renderHistorial();

  const resumen = h('div', { class: 'hint', style: 'margin-bottom:12px' });
  function renderResumen() {
    resumen.innerHTML = '';
    resumen.append(
      `Existencia actual: `, h('strong', {}, `${fmt(insumo.stock)} ${insumo.unidad_base}`),
      `  ·  Costo promedio: `, h('strong', {}, `${money(insumo.costo_unitario, 4)} /${insumo.unidad_base}`)
    );
  }
  renderResumen();

  openModal({
    title: `Existencias — ${insumo.nombre}`,
    wide: true,
    body: h('div', {},
      resumen,
      field('Tipo de movimiento', tipo),
      dynFields,
      h('div', { style: 'text-align:right;margin:6px 0 4px' },
        h('button', { class: 'btn', onclick: async (e) => {
          const btn = e.target; btn.disabled = true;
          try {
            let updated;
            if (tipo.value === 'ajuste_costo') {
              updated = await window.api.insumos.corregirCosto(id, Number(nuevoCosto.value), nota.value.trim());
              toast('Costo corregido', 'ok');
            } else {
              const payload = { insumoId: id, tipo: tipo.value };
              if (tipo.value === 'entrada') {
                payload.cantidad = cantidad.value;
                payload.proveedor = proveedor.value.trim();
                // Campo vacío = "no sé / el de siempre": se conserva el último
                // costo. Un 0 capturado a propósito sí baja el promedio.
                if (costoCompra.value.trim() !== '') payload.costo_compra = costoCompra.value;
              }
              else if (tipo.value === 'merma') { payload.cantidad = Number(cantidad.value); payload.motivo = motivo.value; payload.nota = nota.value.trim(); }
              else { payload.conteo = Number(conteo.value); payload.nota = nota.value.trim(); }
              updated = await window.api.insumos.movimiento(payload);
              toast('Movimiento registrado', 'ok');
            }
            Object.assign(insumo, updated);
            movimientos = await window.api.insumos.movimientos(id, 100);
            cantidad.value = ''; conteo.value = ''; nota.value = ''; proveedor.value = '';
            nuevoCosto.value = insumo.costo_unitario;
            renderResumen();
            renderFields();
            renderHistorial();
            InsumosView(root); // refresca la tabla de fondo
          } catch (err) {
            toast(err.message, 'err');
          } finally { btn.disabled = false; }
        } }, 'Registrar movimiento')
      ),
      historial
    ),
    buttons: [{ label: 'Cerrar', kind: 'secondary', onClick: (close) => close() }],
  });
}
