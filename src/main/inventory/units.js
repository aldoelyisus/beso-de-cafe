'use strict';

/**
 * Unidades base soportadas para los insumos.
 * Todo el stock y las recetas se manejan en una de estas tres unidades.
 */
const UNITS = [
  { key: 'ml', label: 'Mililitros (ml)', tipo: 'Volumen' },
  { key: 'g', label: 'Gramos (g)', tipo: 'Peso' },
  { key: 'pieza', label: 'Piezas (pza)', tipo: 'Conteo' },
];

const UNIT_KEYS = UNITS.map((u) => u.key);

/** Motivos de merma (pregunta 6 del documento de alcance). */
const MERMA_MOTIVOS = [
  { key: 'caducidad', label: 'Caducidad' },
  { key: 'derrame', label: 'Derrame / accidente' },
  { key: 'error_preparacion', label: 'Error de preparación' },
  { key: 'otro', label: 'Otro' },
];

// entrada/merma/ajuste/ajuste_costo = manuales ; consumo/devolucion = automáticos por ventas
const MOVEMENT_TYPES = ['entrada', 'merma', 'ajuste', 'ajuste_costo', 'consumo', 'devolucion'];

function isUnit(u) {
  return UNIT_KEYS.includes(u);
}

function unitLabel(u) {
  const found = UNITS.find((x) => x.key === u);
  return found ? found.label : u;
}

module.exports = { UNITS, UNIT_KEYS, MERMA_MOTIVOS, MOVEMENT_TYPES, isUnit, unitLabel };
