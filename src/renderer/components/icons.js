import { h } from '../lib/ui.js';

/**
 * Iconos dibujados, no emoji.
 *
 * Todos comparten la misma rejilla (20×20), el mismo trazo (1.6) y las mismas
 * terminaciones redondeadas, así que el menú se lee como un set y no como una
 * bolsa de dibujitos de distintos tamaños y pesos. Heredan el color del texto
 * (`currentColor`), así que sirven igual en la barra oscura que en un botón.
 *
 * Se insertan con `html:` porque `document.createElement` no sabe crear nodos
 * SVG (quedarían como etiquetas desconocidas y no se pintarían); pasar por
 * innerHTML los parsea en su espacio de nombres correcto.
 */

const svg = (cuerpo) =>
  `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" `
  + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${cuerpo}</svg>`;

const ICONOS = {
  // Ventas: billetes
  ventas: svg('<rect x="2.6" y="5.6" width="14.8" height="8.8" rx="1.8"/><circle cx="10" cy="10" r="2.3"/><path d="M5.6 8.2v3.6M14.4 8.2v3.6"/>'),

  // Corte de caja: cajón con su jaladera
  caja: svg('<rect x="2.6" y="7.4" width="14.8" height="8.4" rx="1.6"/><path d="M2.6 11.2h14.8M8.4 9.3h3.2"/><path d="M5.2 7.4 6.6 4.4h6.8l1.4 3"/>'),

  // Mesas: tablero y pedestal
  mesas: svg('<ellipse cx="10" cy="6.6" rx="6.6" ry="2.4"/><path d="M10 9v6.4M6.6 16.6h6.8"/>'),

  // Promociones: etiqueta con su ojal
  promociones: svg('<path d="M9.8 2.9h5.5a1.3 1.3 0 0 1 1.3 1.3v5.5a1.3 1.3 0 0 1-.38.92l-6.1 6.1a1.3 1.3 0 0 1-1.84 0l-5.5-5.5a1.3 1.3 0 0 1 0-1.84l6.1-6.1a1.3 1.3 0 0 1 .92-.38Z"/><circle cx="13.4" cy="6.6" r="1.15"/>'),

  // Reportes: barras
  reportes: svg('<path d="M3.2 16.8h13.6"/><path d="M6.2 16.8v-4.6M10 16.8V7.4M13.8 16.8v-6.8"/>'),

  // Inventario: caja en perspectiva
  inventario: svg('<path d="m10 2.9 6.9 3.3v7.6L10 17.1 3.1 13.8V6.2Z"/><path d="m3.1 6.2 6.9 3.3 6.9-3.3M10 9.5v7.6"/>'),

  // Insumos: frasco con tapa
  insumos: svg('<path d="M6.6 5.6V3.9h6.8v1.7"/><rect x="4.9" y="5.6" width="10.2" height="10.5" rx="2"/><path d="M4.9 9.1h10.2"/>'),

  // Categorías de insumos: etiquetas apiladas
  insumo_categorias: svg('<path d="M8.6 3.6h4.9a1.2 1.2 0 0 1 1.2 1.2v4.9a1.2 1.2 0 0 1-.35.85l-4.9 4.9a1.2 1.2 0 0 1-1.7 0l-4.9-4.9a1.2 1.2 0 0 1 0-1.7l4.9-4.9a1.2 1.2 0 0 1 .85-.35Z"/><circle cx="11.6" cy="6.6" r="1"/><path d="M16.9 7.3v3.4a1.2 1.2 0 0 1-.35.85l-4.6 4.6"/>'),

  // Menú y recetas: tarjeta de receta
  menu: svg('<rect x="4.2" y="2.9" width="11.6" height="14.2" rx="2"/><path d="M7.2 6.9h5.6M7.2 10h5.6M7.2 13.1h3.4"/>'),

  // Productos: taza con plato
  productos: svg('<path d="M4.6 6.4h9.1v4.3a4.55 4.55 0 0 1-9.1 0Z"/><path d="M13.7 7.4h1.3a2.1 2.1 0 0 1 0 4.2h-1.3"/><path d="M3.3 16.6h11.7"/>'),

  // Categorías de productos: rejilla
  producto_categorias: svg('<rect x="3.1" y="3.1" width="6" height="6" rx="1.4"/><rect x="10.9" y="3.1" width="6" height="6" rx="1.4"/><rect x="3.1" y="10.9" width="6" height="6" rx="1.4"/><rect x="10.9" y="10.9" width="6" height="6" rx="1.4"/>'),

  // Modificadores: un extra que se suma
  modificadores: svg('<circle cx="10" cy="10" r="7.1"/><path d="M10 6.6v6.8M6.6 10h6.8"/>'),

  // Usuarios y personal
  users: svg('<circle cx="8" cy="7.2" r="3.1"/><path d="M2.9 16.6a5.1 5.1 0 0 1 10.2 0"/><path d="M13.5 5.4a2.6 2.6 0 0 1 0 5.1M14.4 16.6a5.3 5.3 0 0 0-1.6-3.8"/>'),

  // Roles y permisos: llave
  roles: svg('<circle cx="7.3" cy="12.7" r="3.3"/><path d="m9.6 10.4 6.5-6.5M13.4 6.6l1.9 1.9M15.3 4.7l1.9 1.9"/>'),

  // Respaldos: guardar una copia
  respaldos: svg('<path d="M10 2.9v8.6M6.6 8.1 10 11.5l3.4-3.4"/><path d="M3.6 13.8v1.9a1.4 1.4 0 0 0 1.4 1.4h10a1.4 1.4 0 0 0 1.4-1.4v-1.9"/>'),

  // Actualizar el programa
  actualizaciones: svg('<circle cx="10" cy="10" r="7.1"/><path d="M10 13.6V6.8M7.2 9.6 10 6.8l2.8 2.8"/>'),

  // Bitácora
  logs: svg('<rect x="4.2" y="2.9" width="11.6" height="14.2" rx="2"/><path d="M7.2 6.6h5.6M7.2 9.7h5.6M7.2 12.8h3.1"/>'),
};

/**
 * La marca: la taza vista desde arriba con el corazón del latte art.
 * De ahí el nombre — un beso de café.
 */
export const MARCA = svg(
  '<circle cx="10" cy="10" r="8.1"/>'
  + '<path d="M10 14.4c-3.1-2.3-4.6-3.8-4.6-5.6a2.6 2.6 0 0 1 4.6-1.65A2.6 2.6 0 0 1 14.6 8.8c0 1.8-1.5 3.3-4.6 5.6Z" fill="currentColor" stroke="none"/>'
);

/** Un icono del set, listo para meter en el DOM. `nombre` desconocido = sin icono. */
export function icono(nombre, clase = 'ico') {
  const cuerpo = ICONOS[nombre];
  return cuerpo ? h('span', { class: clase, html: cuerpo }) : h('span', { class: clase });
}

// Hueco de foto: el mismo trazo que el resto, no un emoji de cámara.
ICONOS.foto = svg('<rect x="2.6" y="5.2" width="14.8" height="11" rx="2.2"/><circle cx="10" cy="10.8" r="3.1"/><path d="M7.2 5.2 8.4 3.2h3.2l1.2 2"/>');

/** Flecha del acordeón del menú (gira al abrir, por CSS). */
export function chevron() {
  return svg('<path d="M7.8 4.4 13.4 10l-5.6 5.6"/>');
}

/** La marca, para el menú y la pantalla de entrada. */
export function marca(clase = 'marca') {
  return h('span', { class: clase, html: MARCA });
}
