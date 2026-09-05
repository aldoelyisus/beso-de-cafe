import { h } from '../lib/ui.js';

/**
 * Control segmentado (chips). Todas las opciones a la vista, una activa.
 * Reemplaza a los <select> de un solo valor.
 *
 *   options = [{ value, label }]
 *   value   = valor activo
 *   onChange(value)
 *   label   = etiqueta corta opcional a la izquierda
 */
export function Segmented(options, value, onChange, label) {
  const wrap = h('div', { class: 'chips', role: 'group' });
  if (label) wrap.appendChild(h('span', { class: 'chip-label' }, label));

  const buttons = options.map((opt) => {
    const b = h('button', {
      type: 'button',
      class: 'chip' + (opt.value === value ? ' active' : ''),
      onclick: () => {
        if (opt.value === value) return;
        value = opt.value;
        buttons.forEach((x) => x.classList.toggle('active', x === b));
        onChange(opt.value);
      },
    }, opt.label);
    wrap.appendChild(b);
    return b;
  });

  return wrap;
}

/**
 * Fila de chips desplazable para un conjunto largo de opciones de un solo valor
 * (p. ej. categorías). Sustituye a un <select> largo.
 *
 *   options = [{ value, label }]
 */
export function ChipRow(options, value, onChange) {
  const wrap = h('div', { class: 'chip-row', role: 'group' });
  const buttons = options.map((opt) => {
    const b = h('button', {
      type: 'button',
      class: 'chip' + (opt.value === value ? ' active' : ''),
      onclick: () => {
        if (opt.value === value) return;
        value = opt.value;
        buttons.forEach((x) => x.classList.toggle('active', x === b));
        b.scrollIntoView({ inline: 'nearest', block: 'nearest' });
        onChange(opt.value);
      },
    }, opt.label);
    wrap.appendChild(b);
    return b;
  });
  return wrap;
}

/**
 * Chip interruptor de encendido/apagado (un solo filtro booleano).
 */
export function Toggle(label, active, onChange) {
  const b = h('button', {
    type: 'button',
    class: 'chip toggle' + (active ? ' active' : ''),
    'aria-pressed': String(!!active),
    onclick: () => {
      active = !active;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
      onChange(active);
    },
  }, label);
  return b;
}

const MAGNIFIER =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';

/**
 * Campo de búsqueda con icono. Emite `onSearch(texto)` con rebote.
 */
export function SearchBox(placeholder, onSearch, { delay = 250, value = '' } = {}) {
  const input = h('input', { type: 'search', placeholder, value });
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => onSearch(input.value.trim()), delay);
  });
  const box = h('label', { class: 'search-box' });
  box.innerHTML = MAGNIFIER;
  box.appendChild(input);
  return box;
}

/**
 * Encabezado <th> ordenable. Al hacer click alterna entre dos criterios.
 *
 *   text     = texto de la columna
 *   asc/desc = claves de orden para esta columna
 *   current  = clave de orden activa en toda la tabla
 *   onSort(nuevaClave)
 */
export function sortableTh(text, { asc, desc }, current, onSort) {
  const isAsc = current === asc;
  const isDesc = current === desc;
  const sorted = isAsc || isDesc;
  const th = h('th', {
    class: 'sortable' + (sorted ? ' sorted' : ''),
    onclick: () => onSort(isDesc ? asc : desc),
    title: 'Ordenar por ' + text.toLowerCase(),
  }, text, h('span', { class: 'caret' }, isAsc ? '▲' : '▼'));
  return th;
}
