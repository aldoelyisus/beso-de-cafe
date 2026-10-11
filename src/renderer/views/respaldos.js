import { h, toast } from '../lib/ui.js';
import { can } from '../lib/store.js';

function formatoTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function RespaldosView(root) {
  root.innerHTML = '';

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Respaldos'),
      h('div', { class: 'muted' },
        'Guarda una copia de TODA la base de datos — usuarios, inventario, ventas, todo — en el ',
        'lugar que elijas de tu computadora: una USB, Documentos, donde quieras.')
    )
  );

  const resultado = h('div', {});

  async function hacerRespaldo(boton) {
    boton.disabled = true;
    try {
      const r = await window.api.respaldos.crear();
      if (r.cancelado) return;
      toast(`Respaldo guardado (${formatoTamano(r.tamano)})`, 'ok');
      resultado.innerHTML = '';
      resultado.appendChild(h('div', { class: 'hint' }, 'Guardado en: ', h('code', {}, r.ruta)));
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      boton.disabled = false;
    }
  }

  const card = h('div', { class: 'pcard' },
    h('p', {}, 'Se abre el explorador de Windows para que elijas la carpeta. Hazlo seguido, sobre todo antes de algo importante, y de vez en cuando guarda uno en una USB o en otro equipo — si solo vive en esta laptop, no sirve de nada si la laptop se pierde o se daña.'),
    can('respaldos.crear')
      ? h('button', { class: 'btn', onclick: (e) => hacerRespaldo(e.target) }, 'Hacer un respaldo')
      : h('div', { class: 'empty' }, 'No tienes permiso para hacer respaldos.'),
    resultado
  );

  root.append(head, card);
}
