import { h } from '../lib/ui.js';

/**
 * Combobox con búsqueda (tipo "select2"), sin dependencias.
 * Se ve como un input: al enfocarlo se abre una lista; al escribir se filtra.
 *
 *   options = [{ value, label }]
 *
 * Devuelve un <div> contenedor con:
 *   - propiedad `.value` (get/set) = el value elegido (string)
 *   - evento 'change' cuando el usuario elige una opción
 *   - método `.setDisabled(bool)`
 */
export function Combobox(options, { value = '', placeholder = 'Selecciona…', emptyText = 'Sin resultados' } = {}) {
  let current = value == null ? '' : String(value);
  const byValue = new Map(options.map((o) => [String(o.value), o]));

  const input = h('input', { type: 'text', class: 'cbx-input', autocomplete: 'off', spellcheck: 'false', placeholder });
  const caret = h('span', { class: 'cbx-caret' }, '▾');
  const wrap = h('div', { class: 'combobox' }, input, caret);

  let listEl = null;
  let filtered = options;
  let activeIdx = -1;

  const labelFor = (v) => {
    const o = byValue.get(String(v));
    return o ? o.label : (v ? `#${v}` : '');
  };
  const syncText = () => { input.value = labelFor(current); };
  syncText();

  Object.defineProperty(wrap, 'value', {
    get: () => current,
    set: (v) => { current = v == null ? '' : String(v); syncText(); },
  });
  wrap.setDisabled = (d) => { input.disabled = !!d; wrap.classList.toggle('disabled', !!d); };

  const emitChange = () => wrap.dispatchEvent(new Event('change', { bubbles: true }));

  function position() {
    const r = input.getBoundingClientRect();
    const width = Math.max(r.width, 240);
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - width);
    listEl.style.left = `${left}px`;
    listEl.style.width = `${width}px`;
    listEl.style.top = `${r.bottom + 2}px`;
    listEl.style.maxHeight = `${Math.min(300, Math.max(120, window.innerHeight - r.bottom - 12))}px`;
  }

  function open() {
    if (listEl || input.disabled) return;
    filtered = options;
    activeIdx = Math.max(0, options.findIndex((o) => String(o.value) === current));
    listEl = h('div', { class: 'cbx-list' });
    document.body.appendChild(listEl);
    position();
    render();
    input.select();
    setTimeout(() => {
      document.addEventListener('mousedown', onDocDown, true);
      window.addEventListener('resize', close);
      window.addEventListener('scroll', close, true);
    }, 0);
  }

  function close() {
    if (!listEl) return;
    listEl.remove();
    listEl = null;
    activeIdx = -1;
    syncText();
    document.removeEventListener('mousedown', onDocDown, true);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', close, true);
  }

  function onDocDown(e) {
    if (wrap.contains(e.target) || (listEl && listEl.contains(e.target))) return;
    close();
  }

  function filter() {
    const q = input.value.trim().toLowerCase();
    filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    activeIdx = filtered.length ? 0 : -1;
    render();
  }

  function render() {
    listEl.innerHTML = '';
    if (!filtered.length) { listEl.appendChild(h('div', { class: 'cbx-empty' }, emptyText)); return; }
    filtered.forEach((o, i) => listEl.appendChild(h('div', {
      class: 'cbx-opt' + (i === activeIdx ? ' active' : '') + (String(o.value) === current ? ' sel' : ''),
      onmousedown: (e) => { e.preventDefault(); choose(o); },
      onmousemove: () => { if (activeIdx !== i) { activeIdx = i; paint(); } },
    }, o.label)));
    scrollActive();
  }

  function paint() {
    [...listEl.children].forEach((c, i) => c.classList.toggle('active', i === activeIdx));
    scrollActive();
  }
  function scrollActive() {
    const el = listEl && listEl.children[activeIdx];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  function choose(o) {
    current = String(o.value);
    syncText();
    close();
    emitChange();
  }

  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  input.addEventListener('input', () => { if (!listEl) open(); else filter(); });
  caret.addEventListener('mousedown', (e) => { e.preventDefault(); listEl ? close() : (input.focus(), open()); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!listEl) return open();
      if (!filtered.length) return;
      activeIdx = (activeIdx + (e.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length;
      paint();
    } else if (e.key === 'Enter') {
      if (listEl && filtered[activeIdx]) { e.preventDefault(); choose(filtered[activeIdx]); }
    } else if (e.key === 'Escape') {
      if (listEl) { e.preventDefault(); e.stopPropagation(); close(); }
    } else if (e.key === 'Tab') {
      close();
    }
  });

  return wrap;
}
