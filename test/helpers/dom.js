'use strict';

/**
 * Shim mínimo de DOM para renderizar las vistas reales (lib/ui.js `h()`) sin
 * Chromium, usado por las pruebas de `test/frontend/`. Cubre lo que usan las
 * vistas de este proyecto: creación de nodos, className/classList, style
 * como objeto plano, atributos, dataset, eventos (click/change/input), y un
 * par de helpers de búsqueda (`buscar`, `boton`).
 *
 * Uso típico de una prueba: `require('../helpers/ipc')` primero (instala el
 * doble de `electron` e `ipcMain`), luego `require(preload)` (deja
 * `window.api` enrutado a los handlers reales), y `dom.instalar()` antes de
 * importar (dinámico, por ser ESM) cualquier vista de `src/renderer/views/`.
 */

function kebabToCamel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

class Nodo {
  constructor(tagName) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.attrs = {};
    this.style = {};
    this.dataset = {};
    this.children = [];
    this.parentNode = null;
    this._listeners = {};
    this._value = '';
    this.checked = false;
    this.disabled = false;
    this.selected = false;
    this.hidden = false;
  }

  get className() { return this.attrs.class || ''; }
  set className(v) { this.attrs.class = String(v || ''); }

  /**
   * Un `<select>` real vale lo que diga su opción seleccionada (y, si
   * ninguna lo está, su primera opción). Sin esto, un formulario recién
   * abierto se leía con las unidades vacías y parecía un bug de la app.
   */
  get opciones() { return this.buscar((n) => n.tagName === 'OPTION'); }
  get selectedOptions() { return this.opciones.filter((o) => o.selected); }
  get value() {
    if (this.tagName !== 'SELECT') return this._value;
    const opts = this.opciones;
    if (this._value !== '' && opts.some((o) => String(o.attrs.value) === String(this._value))) return this._value;
    const marcada = opts.find((o) => o.selected);
    if (marcada) return marcada.attrs.value;
    return opts.length ? opts[0].attrs.value : '';
  }
  set value(v) {
    this._value = v == null ? '' : v;
    if (this.tagName === 'SELECT') {
      for (const o of this.opciones) o.selected = String(o.attrs.value) === String(this._value);
    }
  }

  get classList() {
    const self = this;
    return {
      add(...cs) { const set = new Set(String(self.attrs.class || '').split(/\s+/).filter(Boolean)); cs.forEach((c) => set.add(c)); self.attrs.class = [...set].join(' '); },
      remove(...cs) { const set = new Set(String(self.attrs.class || '').split(/\s+/).filter(Boolean)); cs.forEach((c) => set.delete(c)); self.attrs.class = [...set].join(' '); },
      toggle(c, force) { const tiene = this.contains(c); const quiero = force === undefined ? !tiene : force; if (quiero) this.add(c); else this.remove(c); },
      contains(c) { return String(self.attrs.class || '').split(/\s+/).includes(c); },
    };
  }

  setAttribute(name, val) {
    this.attrs[name] = val;
    if (name === 'value') this.value = val;
    if (name === 'checked') this.checked = true;
    if (name === 'selected') this.selected = true;
    if (name === 'disabled') this.disabled = true;
    if (String(name).startsWith('data-')) this.dataset[kebabToCamel(name.slice(5))] = val;
  }
  getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; }
  removeAttribute(name) { delete this.attrs[name]; }

  appendChild(child) {
    if (child == null) return child;
    if (typeof child === 'string') child = Nodo.textNode(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  append(...nodes) { for (const n of nodes.flat()) { if (n == null || n === false) continue; this.appendChild(typeof n === 'string' ? Nodo.textNode(n) : n); } }
  prepend(...nodes) {
    const made = nodes.flat().filter((n) => n != null && n !== false).map((n) => (typeof n === 'string' ? Nodo.textNode(n) : n));
    made.forEach((n) => { n.parentNode = this; });
    this.children.unshift(...made);
  }
  insertBefore(nuevo, referencia) {
    const i = this.children.indexOf(referencia);
    nuevo.parentNode = this;
    if (i < 0) this.children.push(nuevo); else this.children.splice(i, 0, nuevo);
    return nuevo;
  }
  remove() { if (this.parentNode) { const i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); this.parentNode = null; } }
  /** Se cambia este nodo por otro, en su mismo lugar (lo usa, p. ej., el selector de periodo de Reportes). */
  replaceWith(...nodos) {
    if (!this.parentNode) return;
    const padre = this.parentNode;
    const i = padre.children.indexOf(this);
    const nuevos = nodos.flat().filter((n) => n != null && n !== false)
      .map((n) => (typeof n === 'string' ? Nodo.textNode(n) : n));
    nuevos.forEach((n) => { n.parentNode = padre; });
    padre.children.splice(i, 1, ...nuevos);
    this.parentNode = null;
  }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }

  // Se guarda el HTML crudo (los iconos SVG entran por aquí) para que una
  // prueba pueda serializar el árbol y verlo pintado de verdad.
  set innerHTML(v) { this.children = []; this._html = v === '' ? null : v; }
  get innerHTML() { return this._html || ''; }

  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map((c) => c.textContent).join('');
  }
  set textContent(v) { this.children = []; this._text = undefined; this.appendChild(Nodo.textNode(String(v))); }

  addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); }
  removeEventListener(ev, fn) { if (this._listeners[ev]) this._listeners[ev] = this._listeners[ev].filter((f) => f !== fn); }
  async dispatch(ev, detalle = {}) {
    const evento = { type: ev, target: this, key: detalle.key, preventDefault() {}, stopPropagation() {}, ...detalle };
    for (const fn of (this._listeners[ev] || []).slice()) await fn(evento);
  }

  /** Búsqueda profunda (incluye el nodo mismo) de todos los que cumplan el predicado. */
  buscar(pred) {
    const out = [];
    const visitar = (n) => {
      if (n.tagName && pred(n)) out.push(n);
      for (const c of n.children || []) visitar(c);
    };
    visitar(this);
    return out;
  }

  /** El primer <button> descendiente cuyo texto sea exactamente este. */
  boton(texto) {
    const candidatos = this.buscar((n) => n.tagName === 'BUTTON' && n.textContent.trim() === texto);
    return candidatos[0] || null;
  }

  /** querySelector/querySelectorAll muy simples: tag, .clase, [attr=valor], combinables con espacio (ignora jerarquía real). */
  querySelectorAll(sel) {
    const partes = String(sel).trim().split(/\s+/);
    const ultima = partes[partes.length - 1];
    const pred = compilarSelector(ultima);
    return this.buscar(pred);
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }

  scrollIntoView() {}
  focus() {}
  click() { return this.dispatch('click'); }

  static textNode(text) {
    const n = new Nodo('#text');
    n._text = String(text);
    n.children = [];
    return n;
  }
}

function compilarSelector(sel) {
  if (sel.startsWith('.')) { const c = sel.slice(1); return (n) => n.classList && n.classList.contains(c); }
  if (sel.startsWith('#')) { const id = sel.slice(1); return (n) => n.attrs && n.attrs.id === id; }
  const m = sel.match(/^\[([a-zA-Z-]+)=(['"]?)([^'"\]]*)\2\]$/);
  if (m) return (n) => n.attrs && String(n.attrs[m[1]]) === m[3];
  return (n) => n.tagName === sel.toUpperCase();
}

/** Instala `document`/`window` globales mínimos y devuelve utilidades de prueba. */
function instalar() {
  const modalRoot = new Nodo('div');
  modalRoot.attrs.id = 'modal-root';
  const toastRoot = new Nodo('div');
  toastRoot.attrs.id = 'toast-root';
  const body = new Nodo('body');
  body.appendChild(modalRoot);
  body.appendChild(toastRoot);

  const porId = { 'modal-root': modalRoot, 'toast-root': toastRoot };

  global.document = {
    createElement: (tag) => new Nodo(tag),
    createTextNode: (t) => Nodo.textNode(t),
    getElementById: (id) => porId[id] || null,
    body,
    addEventListener: (...a) => body.addEventListener(...a),
    removeEventListener: (...a) => body.removeEventListener(...a),
    querySelector: (sel) => body.querySelectorAll(sel)[0] || null,
    querySelectorAll: (sel) => body.querySelectorAll(sel),
  };
  global.window = global.window || {};
  global.window.location = global.window.location || { hash: '' };
  if (!global.location) global.location = global.window.location;

  return {
    Nodo,
    modalRoot,
    toastRoot,
    /** El modal actualmente abierto (si hay uno), como Nodo. */
    modalAbierto: () => modalRoot.children.find((c) => c.classList.contains('modal-backdrop')) || null,
    /** Cierra cualquier modal abierto, de golpe (sin pasar por su botón "Cerrar"). */
    cerrarModales: () => { modalRoot.children = []; },
    /** Los avisos (toast) que se han mostrado, como texto. */
    toasts: () => toastRoot.children.map((t) => t.textContent),
    limpiarToasts: () => { toastRoot.children = []; },
  };
}

module.exports = { Nodo, instalar };
