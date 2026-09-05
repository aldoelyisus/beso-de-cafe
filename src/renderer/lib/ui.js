// Utilidades pequeñas de interfaz: crear nodos, escapar texto, toasts y modales.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

export function toast(message, type = '') {
  const root = document.getElementById('toast-root');
  const t = h('div', { class: `toast ${type}` }, message);
  root.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .3s';
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

/**
 * Modal genérico. `render(close)` devuelve el contenido del cuerpo.
 * `buttons` = [{ label, kind, onClick(close) }]. onClick puede ser async;
 * si lanza error, el modal permanece abierto.
 */
export function openModal({ title, body, buttons = [], wide = false }) {
  const root = document.getElementById('modal-root');
  const backdrop = h('div', { class: 'modal-backdrop' });
  const modal = h('div', { class: `modal ${wide ? 'wide' : ''}` });

  const close = () => backdrop.remove();

  const bodyEl = h('div', { class: 'modal-body' });
  bodyEl.appendChild(typeof body === 'function' ? body(close) : body);

  const foot = h('div', { class: 'modal-foot' });
  for (const b of buttons) {
    const btn = h('button', { class: `btn ${b.kind || 'secondary'}` }, b.label);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await b.onClick(close, modal);
      } catch (err) {
        toast(err.message || String(err), 'err');
      } finally {
        btn.disabled = false;
      }
    });
    foot.appendChild(btn);
  }

  modal.append(h('div', { class: 'modal-head' }, title), bodyEl, foot);
  backdrop.appendChild(modal);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });
  root.appendChild(backdrop);
  return { close, modal, bodyEl };
}

export function confirmDialog({ title = 'Confirmar', message, confirmLabel = 'Confirmar', kind = 'danger' }) {
  return new Promise((resolve) => {
    openModal({
      title,
      body: h('p', {}, message),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => { close(); resolve(false); } },
        { label: confirmLabel, kind, onClick: (close) => { close(); resolve(true); } },
      ],
    });
  });
}

/** Campo de formulario simple. */
export function field(label, inputEl, hint) {
  return h('div', { class: 'field' },
    h('label', {}, label),
    inputEl,
    hint ? h('div', { class: 'hint' }, hint) : null
  );
}
