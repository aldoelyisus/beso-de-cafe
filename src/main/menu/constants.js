'use strict';

/**
 * Modos de un renglón de receta: cuándo se consume ese insumo.
 */
const MODOS_RECETA = [
  { key: 'siempre', label: 'Siempre' },
  { key: 'llevar', label: 'Solo para llevar' },
  { key: 'aqui', label: 'Solo en cafetería' },
];

const MODO_KEYS = MODOS_RECETA.map((m) => m.key);

function isModo(m) {
  return MODO_KEYS.includes(m);
}

/** Modos que aplican cuando la venta es "para llevar" / "en cafetería". */
const MODOS_PARA_LLEVAR = ['siempre', 'llevar'];
const MODOS_AQUI = ['siempre', 'aqui'];

module.exports = { MODOS_RECETA, MODO_KEYS, isModo, MODOS_PARA_LLEVAR, MODOS_AQUI };
