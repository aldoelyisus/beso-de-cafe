'use strict';

/**
 * Comparación de nombres "como los lee una persona".
 *
 * `COLLATE NOCASE` de SQLite solo pliega el alfabeto ASCII: para él "CAFÉ" y
 * "Café" son distintos porque no sabe que É y é son la misma letra. Aquí se
 * normaliza de verdad —minúsculas, sin acentos y sin espacios de sobra— para
 * que no convivan en el catálogo dos nombres que en pantalla se leen igual
 * ("Café", "café", "CAFÉ", "Cafe").
 *
 * Los índices únicos de la base (migraciones 013 y 014) son la red de seguridad;
 * la comparación buena vive aquí, que además da el mensaje claro.
 */
function claveNombre(s) {
  return String(s ?? '')
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita los acentos
    .replace(/\s+/g, ' ');           // "Café  soluble" === "Café soluble"
}

/** ¿Dos nombres se leerían igual en pantalla? */
function mismoNombre(a, b) {
  return claveNombre(a) === claveNombre(b);
}

/**
 * Busca en `filas` (con `id` y `nombre`) una que choque con `nombre`,
 * ignorando la fila `exceptId` (la que se está editando).
 */
function buscarChoque(filas, nombre, exceptId = null) {
  const clave = claveNombre(nombre);
  return filas.find((f) => f.id !== exceptId && claveNombre(f.nombre) === clave) || null;
}

module.exports = { claveNombre, mismoNombre, buscarChoque };
