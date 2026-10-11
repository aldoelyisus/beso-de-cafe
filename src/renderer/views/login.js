import { h, field } from '../lib/ui.js';
import { marca } from '../components/icons.js';

export function LoginView(onSuccess) {
  const username = h('input', { type: 'text', autocomplete: 'username', autofocus: true });
  const password = h('input', { type: 'password', autocomplete: 'current-password' });
  const errorBox = h('div', { class: 'form-error', style: 'display:none' });
  const submit = h('button', { class: 'btn', type: 'submit', style: 'width:100%;margin-top:6px' }, 'Entrar');

  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';
      submit.disabled = true;
      submit.textContent = 'Entrando…';
      try {
        const session = await window.api.auth.login(username.value.trim(), password.value);
        onSuccess(session);
      } catch (err) {
        errorBox.textContent = err.message || 'No se pudo iniciar sesión.';
        errorBox.style.display = 'block';
        submit.disabled = false;
        submit.textContent = 'Entrar';
      }
    },
  },
    field('Nombre de usuario', username),
    field('Contraseña', password),
    errorBox,
    submit
  );

  return h('div', { class: 'login-wrap' },
    h('div', { class: 'login-card' },
      marca('login-marca'),
      h('h1', {}, 'Beso de Café'),
      h('p', { class: 'sub' }, 'Punto de venta y gestión interna'),
      form
    )
  );
}
