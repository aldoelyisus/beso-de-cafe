import { h, esc, toast, openModal } from '../lib/ui.js';
import { can } from '../lib/store.js';

const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/**
 * Actualizar el programa con un archivo, sin internet ni reinstalar.
 *
 * Pensada para que la dueña la use sola al teléfono: un botón, el explorador
 * de Windows, y una pantalla que le dice QUÉ trae la actualización antes de
 * aplicar nada.
 */
export async function ActualizacionesView(root) {
  root.innerHTML = '';
  const estado = await window.api.actualizaciones.estado();

  root.appendChild(h('div', { class: 'page-head' },
    h('div', {},
      h('h2', {}, 'Actualizar el programa'),
      h('div', { class: 'muted' },
        'Para cuando te manden un archivo de actualización. Tus datos no se tocan: ',
        'las ventas, el inventario y los usuarios se quedan exactamente como están.'))));

  const card = h('div', { class: 'pcard' },
    h('div', { class: 'caja-total' },
      h('div', { class: 'k' }, 'Versión instalada'),
      h('div', { class: 'v' }, esc(estado.version))));

  // La carpeta importa para resolver fallas a distancia: es lo primero que hay
  // que preguntar cuando una actualización no se puede aplicar.
  if (estado.carpeta) {
    card.appendChild(h('div', { class: 'hint', style: 'margin-top:8px;word-break:break-all' },
      'Carpeta del programa: ', esc(estado.carpeta)));
  }

  if (!estado.instalada) {
    card.appendChild(h('div', { class: 'form-error', style: 'margin-top:12px' },
      'Estás en el programa de desarrollo, no en el instalado: aquí las actualizaciones no se pueden aplicar.'));
  }

  // Si el programa quedó en una carpeta protegida de Windows, decirlo AQUÍ:
  // de nada sirve enterarse cuando el archivo ya viajó y falla al aplicarse.
  if (estado.instalada && estado.impedimento) {
    card.appendChild(h('div', { class: 'form-error', style: 'margin-top:12px' },
      h('strong', {}, 'Este programa no se puede actualizar con archivos.'),
      h('div', { style: 'margin-top:6px' }, esc(estado.impedimento)),
      h('div', { class: 'hint', style: 'margin-top:6px' },
        'Avísale a quien te instaló el programa: hay que reinstalarlo en la carpeta del usuario. '
        + 'Las ventas, el inventario y los usuarios se quedan donde están.')));
  }

  if (can('actualizaciones.aplicar') && !estado.impedimento) {
    card.appendChild(h('p', { style: 'margin-top:14px' },
      'Cuando te manden un archivo de actualización (por WhatsApp o en una USB), guárdalo en la computadora y ábrelo con este botón. Te va a decir qué trae antes de hacer nada.'));
    card.appendChild(h('div', { class: 'caja-acciones' },
      h('button', { class: 'btn', onclick: (e) => elegirArchivo(e.target) }, 'Abrir archivo de actualización'),
      estado.sePuedeDeshacer
        ? h('button', { class: 'btn secondary small', onclick: (e) => deshacer(e.target) }, 'Deshacer la última')
        : null));
  } else if (can('actualizaciones.aplicar')) {
    // Con impedimento no se ofrece el botón, pero sí poder deshacer: si una
    // actualización vieja dejó algo mal, hay que poder volver atrás.
    if (estado.sePuedeDeshacer) {
      card.appendChild(h('div', { class: 'caja-acciones' },
        h('button', { class: 'btn secondary small', onclick: (e) => deshacer(e.target) }, 'Deshacer la última')));
    }
  } else {
    card.appendChild(h('div', { class: 'hint', style: 'margin-top:12px' },
      'No tienes permiso para aplicar actualizaciones.'));
  }
  root.appendChild(card);

  if (estado.historial.length) {
    root.appendChild(h('div', { class: 'section-title' }, 'Actualizaciones aplicadas'));
    root.appendChild(h('div', { class: 'card' }, h('table', {},
      h('thead', {}, h('tr', {},
        h('th', {}, 'Cuándo'), h('th', {}, 'Versión'), h('th', {}, 'Qué traía'), h('th', {}, 'Archivos'))),
      h('tbody', {}, ...estado.historial.map((x) => h('tr', {},
        h('td', {}, fecha(x.aplicado_en)),
        h('td', {}, esc(x.version)),
        h('td', {}, esc(x.descripcion || '—')),
        h('td', {}, String(x.archivos))))))));
  }

  async function elegirArchivo(boton) {
    boton.disabled = true;
    try {
      const info = await window.api.actualizaciones.elegir();
      if (info.cancelado) return;
      confirmar(info);
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      boton.disabled = false;
    }
  }

  /** Antes de tocar el programa: enseñar qué trae y pedir el sí. */
  function confirmar(info) {
    openModal({
      title: `Actualización ${info.version}`,
      body: h('div', {},
        info.descripcion ? h('p', {}, h('strong', {}, esc(info.descripcion))) : null,
        h('div', { class: 'hint' },
          `Preparada el ${fecha(info.creado)} · cambia ${info.archivos.length} archivo(s) del programa.`),
        h('p', { style: 'margin-top:12px' },
          'Tus ventas, inventario, productos y usuarios NO se tocan. El programa se va a cerrar y abrir solo para terminar.'),
        h('div', { class: 'hint' },
          'Si algo sale mal, desde esta misma pantalla puedes deshacerla.')),
      buttons: [
        { label: 'Ahora no', kind: 'secondary', onClick: (close) => close() },
        { label: 'Actualizar y reiniciar', kind: 'primary', onClick: async (close) => {
          await window.api.actualizaciones.aplicar(info.ruta);
          toast('Actualizado. El programa se va a reiniciar solo…', 'ok');
          close();
        } },
      ],
    });
  }

  async function deshacer(boton) {
    boton.disabled = true;
    openModal({
      title: 'Deshacer la última actualización',
      body: h('div', {},
        h('p', {}, 'El programa va a volver a como estaba antes de la última actualización.'),
        h('div', { class: 'hint' }, 'Tus datos siguen sin tocarse. El programa se reinicia solo al terminar.')),
      onClose: () => { boton.disabled = false; },
      buttons: [
        { label: 'Cancelar', kind: 'secondary', onClick: (close) => close() },
        { label: 'Deshacer y reiniciar', kind: 'danger', onClick: async (close) => {
          await window.api.actualizaciones.revertir();
          toast('Listo. El programa se va a reiniciar solo…', 'ok');
          close();
        } },
      ],
    });
  }
}
