import { h } from '../lib/ui.js';

/**
 * Selector de foto para el producto.
 *
 * Redimensiona la imagen aquí mismo, con canvas, antes de mandarla al proceso
 * principal: una foto de celular de 4 MB queda en unas decenas de KB. Sin
 * librerías: la aplicación es offline y no agrega dependencias.
 *
 *   const foto = ImagePicker({ valor, onChange });
 *   foto.element        -> nodo para meter en el formulario
 *   foto.getDataUrl()   -> data URI actual ('' si no hay)
 *
 * Devuelve JPEG salvo que la original sea PNG con transparencia, que se
 * conserva en PNG para no pintarle un fondo negro a los recortes.
 */
const MAX_LADO = 640;
const CALIDAD = 0.82;

/** Lee el archivo y devuelve un data URI ya redimensionado. */
export function redimensionar(file, { maxLado = MAX_LADO, calidad = CALIDAD } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No se eligió ninguna imagen.'));
    if (!/^image\//.test(file.type || '')) {
      return reject(new Error('Ese archivo no es una imagen. Elige un JPG, PNG o WebP.'));
    }
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('La imagen está dañada o el formato no se reconoce.'));
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const ancho = Math.max(1, Math.round(img.width * escala));
        const alto = Math.max(1, Math.round(img.height * escala));
        const lienzo = document.createElement('canvas');
        lienzo.width = ancho;
        lienzo.height = alto;
        const ctx = lienzo.getContext('2d');
        const conservarPng = file.type === 'image/png';
        if (!conservarPng) {
          // JPEG no tiene transparencia: sin esto, lo transparente sale negro.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, ancho, alto);
        }
        ctx.drawImage(img, 0, 0, ancho, alto);
        try {
          resolve(conservarPng ? lienzo.toDataURL('image/png') : lienzo.toDataURL('image/jpeg', calidad));
        } catch (e) {
          reject(new Error('No se pudo procesar la imagen.'));
        }
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  });
}

export function ImagePicker({ valor = '', onChange, etiqueta = 'Elegir foto…' } = {}) {
  let actual = valor || '';

  const vista = h('div', { class: 'foto-vista' });
  const estado = h('div', { class: 'hint' });
  const entrada = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', style: 'display:none' });
  const boton = h('button', { type: 'button', class: 'btn secondary small', onclick: () => entrada.click() }, etiqueta);

  function pintar() {
    vista.innerHTML = '';
    if (actual) {
      vista.appendChild(h('img', { src: actual, alt: 'Foto del producto' }));
      estado.textContent = 'Se guarda reducida a 640 px para que la aplicación siga ligera.';
    } else {
      vista.appendChild(h('div', { class: 'foto-vacia' }, '📷'));
      estado.textContent = 'Obligatoria: en el punto de venta el producto se reconoce por su foto.';
    }
  }

  entrada.addEventListener('change', async () => {
    const file = entrada.files && entrada.files[0];
    entrada.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    estado.textContent = 'Procesando la imagen…';
    try {
      actual = await redimensionar(file);
      pintar();
      if (onChange) onChange(actual);
    } catch (e) {
      pintar();
      estado.textContent = e.message;
    }
  });

  pintar();

  return {
    element: h('div', { class: 'foto-picker' }, vista, h('div', {}, boton, estado), entrada),
    getDataUrl: () => actual,
    setDataUrl: (v) => { actual = v || ''; pintar(); },
  };
}
