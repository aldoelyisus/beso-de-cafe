import { h } from '../lib/ui.js';

/**
 * Controles de paginación.
 *   result = { total, page, pageSize, totalPages }
 *   onGo(page) -> se llama al cambiar de página
 */
export function Pager(result, onGo) {
  const { total, page, pageSize, totalPages } = result;

  if (total === 0) return h('div', {});

  const desde = (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);

  const btn = (label, targetPage, disabled) =>
    h('button', {
      class: 'btn small secondary',
      disabled: disabled ? 'disabled' : null,
      onclick: () => { if (!disabled) onGo(targetPage); },
    }, label);

  return h('div', {
    class: 'toolbar',
    style: 'justify-content:space-between;margin-top:12px',
  },
    h('span', { class: 'muted' }, `${desde}–${hasta} de ${total}`),
    h('div', { style: 'display:flex;gap:6px;align-items:center' },
      btn('« Primera', 1, page <= 1),
      btn('‹ Anterior', page - 1, page <= 1),
      h('span', { class: 'muted', style: 'padding:0 6px' }, `Página ${page} de ${totalPages}`),
      btn('Siguiente ›', page + 1, page >= totalPages),
      btn('Última »', totalPages, page >= totalPages)
    )
  );
}
