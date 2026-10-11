import { h, esc, toast, openModal, confirmDialog, field } from '../lib/ui.js';
import { can } from '../lib/store.js';
import { RecetaEditor } from '../components/recetaEditor.js';
import { ImagePicker } from '../components/imagePicker.js';
import { icono } from '../components/icons.js';

const money = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export async function ProductoEditorView(root, idParam) {
  const id = Number(idParam);
  root.innerHTML = '';

  const [insumos, categorias, modificadores, meta] = await Promise.all([
    window.api.insumos.options(),
    window.api.productoCategorias.options(),
    window.api.modificadores.options(),
    window.api.menu.meta(),
  ]);

  let producto = await window.api.productos.get(id);
  if (!producto) { root.appendChild(h('div', { class: 'empty' }, 'El producto no existe.')); return; }

  let activePresId = (producto.presentaciones.find((p) => p.is_active) || producto.presentaciones[0] || {}).id;

  render();

  function render() {
    root.innerHTML = '';
    root.appendChild(h('a', { class: 'editor-back', href: '#/productos' }, '← Volver a productos'));

    root.appendChild(datosCard());
    root.appendChild(tabsBar());

    const pres = producto.presentaciones.find((p) => p.id === activePresId);
    if (pres) root.appendChild(presentacionPanel(pres));
  }

  async function refresh(keepPres = activePresId) {
    producto = await window.api.productos.get(id);
    const still = producto.presentaciones.find((p) => p.id === keepPres && p.is_active);
    activePresId = still ? keepPres : (producto.presentaciones.find((p) => p.is_active) || producto.presentaciones[0] || {}).id;
    render();
  }

  // ---------- Datos generales ----------
  function datosCard() {
    const nombre = h('input', { type: 'text', value: producto.nombre });
    const categoria = h('select', {},
      h('option', { value: '' }, 'Sin categoría'),
      ...categorias.map((c) => {
        const o = h('option', { value: String(c.id) }, c.nombre);
        if (String(c.id) === String(producto.categoria_id)) o.selected = true;
        return o;
      })
    );
    if (producto.categoria_id && !categorias.some((c) => String(c.id) === String(producto.categoria_id))) {
      const o = h('option', { value: String(producto.categoria_id) }, `${producto.categoria_nombre} (inactiva)`);
      o.selected = true; categoria.appendChild(o);
    }
    const descripcion = h('input', { type: 'text', value: producto.descripcion });
    const foto = ImagePicker({ valor: producto.foto, etiqueta: producto.foto ? 'Cambiar foto…' : 'Elegir foto…' });

    const modChecks = modificadores.map((m) => {
      const cb = h('input', { type: 'checkbox', value: String(m.id) });
      cb.checked = producto.modificadores.some((x) => x.id === m.id);
      return { m, cb, el: h('label', { class: 'perm-check' }, cb, h('span', {}, `${m.nombre} (+${money(m.precio_extra)})`)) };
    });

    const editable = can('productos.edit');
    [nombre, categoria, descripcion].forEach((el) => { if (!editable) el.disabled = true; });
    modChecks.forEach((c) => { if (!editable) c.cb.disabled = true; });

    const card = h('div', { class: 'pcard' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start;gap:16px' },
        h('h3', {}, esc(producto.nombre),
          producto.agotado ? h('span', { class: 'badge off', style: 'margin-left:8px' }, 'Agotado') : null,
          !producto.is_active ? h('span', { class: 'badge off', style: 'margin-left:8px' }, 'De baja') : null),
        editable ? h('button', {
          class: 'btn small ' + (producto.agotado ? 'secondary' : 'ghost'),
          onclick: async () => {
            try { await window.api.productos.setAgotado(id, !producto.agotado); toast(producto.agotado ? 'Disponible' : 'Marcado agotado', 'ok'); refresh(); }
            catch (e) { toast(e.message, 'err'); }
          },
        }, producto.agotado ? 'Marcar disponible' : 'Marcar agotado') : null
      ),
      h('div', { class: 'grid-2', style: 'margin-top:10px' },
        field('Nombre', nombre),
        field('Categoría', categoria)
      ),
      field('Descripción', descripcion),
      h('div', { class: 'section-title' }, 'Foto'),
      editable ? foto.element : h('div', { class: 'foto-vista' },
        producto.foto ? h('img', { src: producto.foto, alt: '' }) : h('div', { class: 'foto-vacia' }, icono('foto', 'ico-foto'))),
      modChecks.length ? h('div', { class: 'section-title' }, 'Modificadores que admite') : null,
      ...modChecks.map((c) => c.el),
      editable ? h('div', { style: 'margin-top:12px' }, h('button', {
        class: 'btn', onclick: async () => {
          try {
            const datos = { nombre: nombre.value.trim(), categoria_id: categoria.value || null, descripcion: descripcion.value.trim() };
            // Solo se manda la foto si cambió: así no viaja el data URI en cada guardado.
            if (foto.getDataUrl() !== producto.foto) datos.foto = foto.getDataUrl();
            await window.api.productos.update(id, datos);
            await window.api.productos.setModificadores(id, modChecks.filter((c) => c.cb.checked).map((c) => Number(c.m.id)));
            toast('Datos guardados', 'ok');
            refresh();
          } catch (e) { toast(e.message, 'err'); }
        },
      }, 'Guardar datos')) : null
    );
    return card;
  }

  // ---------- Tabs de tamaños ----------
  function tabsBar() {
    const bar = h('div', { class: 'pres-tabs' });
    producto.presentaciones.forEach((p) => {
      const tab = h('button', {
        class: 'pres-tab' + (p.id === activePresId ? ' active' : '') + (p.is_active ? '' : ' '),
        style: p.is_active ? '' : 'opacity:.5;text-decoration:line-through',
        onclick: () => { activePresId = p.id; render(); },
      }, p.nombre, p.agotado ? h('span', { class: 'agotado-dot' }, '●') : null);
      bar.appendChild(tab);
    });
    if (can('productos.edit')) {
      bar.appendChild(h('button', { class: 'pres-tab', onclick: () => openNuevoTamano() }, '+ Tamaño'));
    }
    return bar;
  }

  // ---------- Panel de una presentación ----------
  function presentacionPanel(pres) {
    const wrap = h('div', {});

    // Precio
    const precioRow = h('div', { class: 'pcard' },
      h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap' },
        h('div', {},
          h('div', { class: 'muted', style: 'font-size:12px' }, `Precio de "${esc(pres.nombre)}" (con IVA)`),
          h('div', { style: 'font-size:22px;font-weight:700;margin-top:2px' }, money(pres.precio_actual))
        ),
        h('div', { style: 'display:flex;gap:8px' },
          can('productos.precio') ? h('button', { class: 'btn secondary small', onclick: () => cambiarPrecio(pres) }, 'Cambiar precio') : null,
          h('button', { class: 'btn ghost small', onclick: () => verHistorial(pres) }, 'Historial')
        )
      )
    );

    // Receta
    const canReceta = can('productos.receta');
    const editor = RecetaEditor(insumos, {
      items: pres.receta.map((r) => ({ insumo_id: r.insumo_id, cantidad_base: r.cantidad_base, modo: r.modo })),
      grupos: (pres.grupos || []).map((g) => ({
        nombre: g.nombre, cantidad_base: g.cantidad_base, modo: g.modo,
        opciones: g.opciones.map((o) => o.insumo_id), insumo_default_id: g.insumo_default_id,
      })),
    }, {
      withModo: true,
      withGrupos: true,
      modos: meta.modosReceta,
      onChange: syncCosteo,
    });
    if (!canReceta) {
      editor.element.querySelectorAll('select,input,button').forEach((el) => (el.disabled = true));
      editor.element.querySelectorAll('.combobox').forEach((el) => el.setDisabled && el.setDisabled(true));
    }

    const costeo = h('div', { class: 'costeo' });
    function syncCosteo() {
      const t = editor.totals();
      const precio = pres.precio_actual;
      const gAqui = precio != null ? precio - t.aqui : null;
      const gLlevar = precio != null ? precio - t.llevar : null;
      costeo.innerHTML = '';
      const cell = (k, v, cls) => h('div', {}, h('div', { class: 'k' }, k), h('div', { class: 'v ' + (cls || '') }, v));
      costeo.append(
        cell('Costo aquí', money(t.aqui)),
        cell('Costo para llevar', money(t.llevar)),
        cell('Ganancia aquí', money(gAqui), gAqui == null ? '' : (gAqui >= 0 ? 'pos' : 'neg')),
        cell('Ganancia para llevar', money(gLlevar), gLlevar == null ? '' : (gLlevar >= 0 ? 'pos' : 'neg'))
      );
    }
    syncCosteo();

    const recetaCard = h('div', { class: 'pcard' },
      h('h3', {}, 'Receta de ', esc(pres.nombre)),
      h('div', { class: 'hint', style: 'margin-bottom:10px' },
        '"Siempre" se consume en toda venta. "Solo para llevar" es el vaso desechable. "Solo en cafetería" para lo que solo aplica en mesa.'),
      editor.element,
      costeo,
      canReceta ? h('button', {
        class: 'btn', onclick: async () => {
          // Lo que quedó a medias se avisa y se marca en rojo. Antes se
          // descartaba en silencio: "Receta guardada" con un insumo menos.
          const faltan = editor.problemas();
          if (faltan.length) {
            toast(faltan.length === 1 ? faltan[0]
              : `${faltan[0]} (y ${faltan.length - 1} cosa(s) más, marcadas en rojo)`, 'err');
            return;
          }
          const receta = editor.getReceta();
          if (!receta.items.length && !receta.grupos.length) {
            const seguro = await confirmDialog({
              title: 'Se va a quedar sin receta',
              message: `"${pres.nombre}" no va a descontar nada del inventario al venderse, y no se va a poder calcular su costo ni su ganancia. ¿Guardar así?`,
              confirmLabel: 'Guardar sin receta',
            });
            if (!seguro) return;
          }
          try {
            await window.api.productos.setReceta(pres.id, receta);
            toast('Receta guardada', 'ok');
            refresh(pres.id);
          } catch (e) { toast(e.message, 'err'); }
        },
      }, 'Guardar receta') : null
    );

    // Acciones del tamaño
    let tamActions = null;
    if (can('productos.edit')) {
      tamActions = h('div', { class: 'pcard' },
        h('h3', {}, 'Tamaño "', esc(pres.nombre), '"'),
        h('div', { class: 'row-actions', style: 'justify-content:flex-start' },
          h('button', { class: 'btn secondary small', onclick: () => renombrarTamano(pres) }, 'Renombrar'),
          h('button', {
            class: 'btn ' + (pres.agotado ? 'secondary' : 'ghost') + ' small',
            onclick: async () => {
              try { await window.api.productos.setAgotadoPresentacion(pres.id, !pres.agotado); toast('Actualizado', 'ok'); refresh(pres.id); }
              catch (e) { toast(e.message, 'err'); }
            },
          }, pres.agotado ? 'Marcar disponible' : 'Marcar agotado'),
          pres.is_active
            ? h('button', { class: 'btn danger small', onclick: async () => {
                if (!(await confirmDialog({ message: `¿Dar de baja el tamaño "${pres.nombre}"?`, confirmLabel: 'Dar de baja' }))) return;
                try { await window.api.productos.deactivatePresentacion(pres.id); toast('Tamaño dado de baja', 'ok'); refresh(); }
                catch (e) { toast(e.message, 'err'); }
              } }, 'Dar de baja')
            : h('button', { class: 'btn secondary small', onclick: async () => {
                try { await window.api.productos.activatePresentacion(pres.id); toast('Tamaño reactivado', 'ok'); refresh(pres.id); }
                catch (e) { toast(e.message, 'err'); }
              } }, 'Reactivar tamaño')
        )
      );
    }

    wrap.append(precioRow, recetaCard, tamActions || h('div', {}));
    return wrap;
  }

  // ---------- Modales ----------
  function cambiarPrecio(pres) {
    const input = h('input', { type: 'number', min: '0', step: 'any', value: pres.precio_actual != null ? pres.precio_actual : '' });
    openModal({
      title: `Cambiar precio — ${producto.nombre} (${pres.nombre})`,
      body: h('div', {},
        field('Nuevo precio (con IVA)', input),
        h('div', { class: 'hint' }, 'Las ventas ya registradas conservan su precio. El nuevo aplica de aquí en adelante.')
      ),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Guardar precio', kind: 'primary', onClick: async (close) => {
          await window.api.productos.cambiarPrecio(pres.id, Number(input.value));
          toast('Precio actualizado', 'ok');
          close(); refresh(pres.id);
        } },
      ],
    });
  }

  async function verHistorial(pres) {
    const hist = await window.api.productos.historialPrecios(pres.id);
    openModal({
      title: `Historial de precios — ${pres.nombre}`,
      body: hist.length
        ? h('div', { class: 'card' }, h('table', {},
            h('thead', {}, h('tr', {}, h('th', {}, 'Precio'), h('th', {}, 'Desde'), h('th', {}, 'Hasta'), h('th', {}, 'Quién'))),
            h('tbody', {}, ...hist.map((r) => h('tr', {},
              h('td', {}, money(r.precio)),
              h('td', {}, esc(r.vigente_desde)),
              h('td', {}, r.vigente_hasta ? esc(r.vigente_hasta) : h('span', { class: 'badge on' }, 'Actual')),
              h('td', {}, r.username ? '@' + esc(r.username) : '—')
            )))
          ))
        : h('div', { class: 'hint' }, 'Sin historial.'),
      buttons: [{ label: 'Cerrar', kind: 'secondary', onClick: (close) => close() }],
    });
  }

  function renombrarTamano(pres) {
    const input = h('input', { type: 'text', value: pres.nombre });
    openModal({
      title: 'Renombrar tamaño',
      body: h('div', {}, field('Nombre', input)),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Guardar', kind: 'primary', onClick: async (close) => {
          await window.api.productos.updatePresentacion(pres.id, { nombre: input.value.trim() });
          toast('Renombrado', 'ok'); close(); refresh(pres.id);
        } },
      ],
    });
  }

  function openNuevoTamano() {
    const nombre = h('input', { type: 'text', placeholder: 'Chico / Grande / Mediano' });
    const precio = h('input', { type: 'number', min: '0', step: 'any', placeholder: '$' });
    openModal({
      title: `Nuevo tamaño de ${producto.nombre}`,
      body: h('div', {},
        h('div', { class: 'grid-2' }, field('Nombre', nombre), field('Precio', precio)),
        h('div', { class: 'hint' }, 'Después le armas su propia receta.')
      ),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Agregar', kind: 'primary', onClick: async (close) => {
          const p = await window.api.productos.addPresentacion(id, nombre.value.trim(), Number(precio.value));
          const nuevo = p.presentaciones[p.presentaciones.length - 1];
          toast('Tamaño agregado', 'ok');
          close();
          refresh(nuevo ? nuevo.id : activePresId);
        } },
      ],
    });
  }
}
