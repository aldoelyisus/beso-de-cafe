'use strict';

const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/connection');

/**
 * Respaldo manual (FASE 12). Solo esto: un respaldo a la vez, guardado en la
 * carpeta que la persona elija en su computadora (USB, Documentos, donde
 * sea) — no en una carpeta escondida dentro de la app.
 */

function timestamp() {
  const d = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_` +
    `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/**
 * Hace un respaldo consistente de la base actual, dentro de `carpetaDestino`,
 * con el backup en línea de SQLite (`db.backup`): a diferencia de copiar el
 * archivo a lo bruto, es seguro aunque en ese momento haya una venta
 * escribiéndose (modo WAL).
 */
async function crearRespaldoEn(carpetaDestino) {
  if (!carpetaDestino) throw new Error('Elige una carpeta para guardar el respaldo.');
  if (!fs.existsSync(carpetaDestino) || !fs.statSync(carpetaDestino).isDirectory()) {
    throw new Error('La carpeta elegida no existe.');
  }
  const nombre = `beso-de-cafe_respaldo_${timestamp()}.db`;
  const destino = path.join(carpetaDestino, nombre);
  const db = getDb();
  await db.backup(destino);
  const st = fs.statSync(destino);
  return { archivo: nombre, ruta: destino, tamano: st.size };
}

module.exports = { crearRespaldoEn };
