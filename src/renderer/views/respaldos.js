import { h, toast, openModal, field } from '../lib/ui.js';
import { can } from '../lib/store.js';

const TIPO_LABEL = { automatico: 'Automático', manual: 'Manual', 'pre-restaurar': 'Antes de restaurar' };
const TIPO_BADGE = { automatico: 'inherit', manual: 'manual', 'pre-restaurar': 'off' };

function formatoTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatoFecha(iso) {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

export async function RespaldosView(root) {
  root.innerHTML = '';

  const [info, respaldos] = await Promise.all([
    window.api.respaldos.info(),
    window.api.respaldos.list(),
  ]);

  const head = h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Respaldos'),
      h('div', { class: 'muted' },
        'Copias de seguridad de toda la base de datos: usuarios, inventario, ventas, todo. ',
        'Si la laptop falla o algo se corrompe, se recupera desde aquí.')
    ),
    can('respaldos.crear')
      ? h('button', { class: 'btn', onclick: () => hacerRespaldo() }, '💾 Hacer un respaldo ahora')
      : null
  );

  const infoBox = h('div', { class: 'hint' },
    `Cada vez que abres la app se hace uno automático (uno por día; se conservan los últimos ` +
    `${info.maxAutomaticos}, ~1 mes). Los que pides a mano y los de "antes de restaurar" nunca se ` +
    `borran solos. Se guardan en: `,
    h('code', {}, info.carpeta),
    ' — de vez en cuando cópialos a una USB o a otro equipo: si la laptop se pierde o se daña, un respaldo que solo vive ahí adentro no sirve de nada.'
  );

  const tableWrap = h('div', { class: 'card' });
  root.append(head, infoBox, tableWrap);

  function pintarTabla(lista) {
    tableWrap.innerHTML = '';
    if (!lista.length) {
      tableWrap.appendChild(h('div', { class: 'empty' }, 'Todavía no hay ningún respaldo.'));
      return;
    }
    tableWrap.appendChild(h('table', {},
      h('thead', {}, h('tr', {},
        h('th', {}, 'Fecha'), h('th', {}, 'Tipo'), h('th', {}, 'Tamaño'), h('th', {}, ''))),
      h('tbody', {}, ...lista.map((r) => h('tr', {},
        h('td', {}, formatoFecha(r.creado_en)),
        h('td', {}, h('span', { class: `badge ${TIPO_BADGE[r.tipo] || 'inherit'}` }, TIPO_LABEL[r.tipo] || r.tipo)),
        h('td', {}, formatoTamano(r.tamano)),
        h('td', {}, can('respaldos.restaurar')
          ? h('div', { class: 'row-actions' },
              h('button', { class: 'btn small danger', onclick: () => confirmarRestaurar(r) }, 'Restaurar'))
          : null)
      )))
    ));
  }
  pintarTabla(respaldos);

  async function hacerRespaldo() {
    try {
      const r = await window.api.respaldos.crear();
      toast(`Respaldo creado (${formatoTamano(r.tamano)})`, 'ok');
      pintarTabla(await window.api.respaldos.list());
    } catch (e) { toast(e.message, 'err'); }
  }

  function confirmarRestaurar(r) {
    // Restaurar reemplaza TODA la base actual: no basta un "sí/no", hay que
    // escribir la palabra a propósito, igual que borrar un repositorio en GitHub.
    const palabra = h('input', { type: 'text', placeholder: 'RESTAURAR' });
    openModal({
      title: `Restaurar respaldo del ${formatoFecha(r.creado_en)}`,
      body: h('div', {},
        h('div', { class: 'form-error' },
          `Esto reemplaza TODA la información actual —ventas, inventario, usuarios, todo— por ` +
          `cómo estaba en este respaldo (${TIPO_LABEL[r.tipo] || r.tipo}, ${formatoTamano(r.tamano)}). ` +
          `Lo que haya pasado después de esa fecha se pierde. No se puede deshacer.`),
        h('p', {}, 'Antes de restaurar se guarda automáticamente una copia de cómo está todo ahora mismo, por si fue un error.'),
        h('p', {}, 'La aplicación se va a cerrar y volver a abrir sola para terminar.'),
        field('Escribe RESTAURAR para confirmar', palabra)
      ),
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Restaurar y reiniciar', kind: 'danger', onClick: async (close) => {
          if (palabra.value.trim().toUpperCase() !== 'RESTAURAR') {
            throw new Error('Escribe RESTAURAR para confirmar.');
          }
          await window.api.respaldos.restaurar(r.archivo);
          toast('Restaurando… la aplicación se va a reiniciar sola.', 'ok');
          close();
        } },
      ],
    });
  }
}
