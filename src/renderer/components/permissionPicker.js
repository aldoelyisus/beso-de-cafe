import { h } from '../lib/ui.js';

/**
 * Lista de permisos agrupada por módulo con checkboxes.
 *
 *  groups    -> [{ module, label, items: [{ key, label, action }] }]
 *  selected  -> Set<string> claves marcadas al inicio
 *  inherited -> Set<string> claves que vienen del rol (solo etiqueta)
 *
 * Incluye "Seleccionar todos" general y por sección (con estado intermedio).
 * Devuelve { element, getSelected() }.
 */
export function PermissionPicker(groups, selected = new Set(), inherited = new Set()) {
  const allBoxes = [];
  const headers = []; // [{ cb, boxes }]
  const wrap = h('div', {});

  function syncHeader(hd) {
    const n = hd.boxes.filter((b) => b.checked).length;
    hd.cb.checked = n > 0 && n === hd.boxes.length;
    hd.cb.indeterminate = n > 0 && n < hd.boxes.length;
  }
  function syncMaster() {
    const n = allBoxes.filter((b) => b.checked).length;
    masterCb.checked = n > 0 && n === allBoxes.length;
    masterCb.indeterminate = n > 0 && n < allBoxes.length;
  }

  const masterCb = h('input', { type: 'checkbox' });
  masterCb.addEventListener('change', () => {
    const v = masterCb.checked;
    allBoxes.forEach((b) => { b.checked = v; });
    headers.forEach(syncHeader);
  });
  wrap.appendChild(h('label', { class: 'perm-allbar' }, masterCb, h('strong', {}, 'Seleccionar todos los permisos')));

  for (const g of groups) {
    const boxes = [];
    const groupCb = h('input', { type: 'checkbox' });
    const hd = { cb: groupCb, boxes };
    headers.push(hd);

    groupCb.addEventListener('change', () => {
      const v = groupCb.checked;
      boxes.forEach((b) => { b.checked = v; });
      groupCb.indeterminate = false;
      syncMaster();
    });

    const groupEl = h('div', { class: 'perm-group' },
      h('label', { class: 'perm-group-head' }, groupCb, h('h4', {}, g.label))
    );

    for (const item of g.items) {
      const cb = h('input', { type: 'checkbox' });
      cb.checked = selected.has(item.key);
      cb.dataset.key = item.key;
      cb.addEventListener('change', () => { syncHeader(hd); syncMaster(); });
      boxes.push(cb);
      allBoxes.push(cb);
      groupEl.appendChild(
        h('label', { class: 'perm-check' },
          cb,
          h('span', {}, item.label),
          inherited.has(item.key) ? h('span', { class: 'badge inherit' }, 'del rol') : null
        )
      );
    }
    wrap.appendChild(groupEl);
    syncHeader(hd);
  }
  syncMaster();

  return {
    element: wrap,
    getSelected: () => allBoxes.filter((b) => b.checked).map((b) => b.dataset.key),
  };
}
