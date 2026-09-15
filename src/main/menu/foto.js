'use strict';

/**
 * Validación de la foto del producto.
 *
 * Llega desde la interfaz como data URI ya redimensionada (ver
 * `components/imagePicker.js`). Aquí no se confía en eso: se comprueba el
 * formato y el peso, porque el canal IPC lo puede llamar cualquiera.
 */

const FORMATOS = ['jpeg', 'png', 'webp'];
const MAX_KB = 600;

/** ¿Cuánto pesa de verdad el contenido base64, en bytes? */
function pesoBytes(base64) {
  const relleno = (base64.match(/=+$/) || [''])[0].length;
  return Math.floor((base64.length * 3) / 4) - relleno;
}

/**
 * Devuelve la foto lista para guardar, o lanza con un mensaje entendible.
 * `obligatoria` = true en el alta; en la edición se puede dejar la que ya tenía.
 */
function limpiarFoto(valor, { obligatoria = false } = {}) {
  const foto = String(valor ?? '').trim();

  if (!foto) {
    if (obligatoria) throw new Error('El producto necesita una foto: es como se reconoce en el punto de venta.');
    return '';
  }

  const m = /^data:image\/([a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(foto);
  if (!m) throw new Error('La foto no es una imagen válida. Elige un archivo de imagen.');

  const formato = m[1].toLowerCase();
  if (!FORMATOS.includes(formato)) {
    throw new Error(`Formato de imagen no admitido (${formato}). Usa JPG, PNG o WebP.`);
  }

  const kb = Math.round(pesoBytes(m[2]) / 1024);
  if (kb > MAX_KB) {
    throw new Error(`La foto pesa ${kb} KB y el máximo son ${MAX_KB} KB. Elige una imagen más chica.`);
  }

  return foto;
}

module.exports = { limpiarFoto, FORMATOS, MAX_KB };
