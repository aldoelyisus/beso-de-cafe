'use strict';

const fs = require('fs');
const path = require('path');
const { getDb, closeDb, dbPath } = require('../db/connection');

/**
 * Respaldos y resistencia a fallos (FASE 12).
 *
 * Se guardan como archivos `.db` sueltos en una carpeta aparte, no en una
 * tabla dentro de la misma base: si la base se corrompe, la lista de
 * respaldos tiene que poder leerse igual (es lo primero que se ofrece antes
 * de que la base vuelva a abrirse).
 *
 * El nombre del archivo ya dice su tipo (prefijo) y su fecha:
 *   auto_2026-09-27_09-15-03-421.db        — automático, uno por día al abrir la app
 *   manual_2026-09-27_18-40-11-009.db      — pedido a mano desde la pantalla
 *   prerestaurar_2026-09-27_18-41-02-118.db — foto de seguridad justo antes de restaurar
 */

const MAX_AUTOMATICOS = 30; // ~1 mes si se respalda una vez al día
const PREFIJOS = { automatico: 'auto', manual: 'manual', 'pre-restaurar': 'prerestaurar' };
const TIPO_DE_PREFIJO = { auto: 'automatico', manual: 'manual', prerestaurar: 'pre-restaurar' };

function backupsDir() {
  const dir = path.join(path.dirname(dbPath()), 'respaldos');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function timestamp() {
  const d = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_` +
    `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`;
}

function tipoDeArchivo(nombre) {
  const prefijo = nombre.split('_')[0];
  return TIPO_DE_PREFIJO[prefijo] || 'manual';
}

/** Solo el nombre del archivo, sin rutas: evita salir de la carpeta de respaldos. */
function nombreValido(archivo) {
  return typeof archivo === 'string' && /^[A-Za-z0-9_.-]+\.db$/.test(archivo) && !archivo.includes('..');
}

function listRespaldos() {
  const dir = backupsDir();
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((archivo) => {
      const st = fs.statSync(path.join(dir, archivo));
      return { archivo, tipo: tipoDeArchivo(archivo), tamano: st.size, creado_en: st.mtime.toISOString() };
    })
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en));
}

/** Conserva solo los últimos MAX_AUTOMATICOS automáticos. Los manuales y los de antes de restaurar nunca se borran solos. */
function podarAutomaticos() {
  const sobran = listRespaldos().filter((r) => r.tipo === 'automatico').slice(MAX_AUTOMATICOS);
  for (const r of sobran) {
    try { fs.unlinkSync(path.join(backupsDir(), r.archivo)); } catch { /* ya no estaba */ }
  }
}

/**
 * Hace un respaldo consistente del archivo actual con el backup en línea de
 * SQLite (`db.backup`): a diferencia de copiar el archivo a lo bruto, es
 * seguro aunque en ese momento haya una venta escribiéndose (modo WAL).
 */
async function crearRespaldo({ tipo = 'manual' } = {}) {
  const prefijo = PREFIJOS[tipo] || 'manual';
  const nombre = `${prefijo}_${timestamp()}.db`;
  const destino = path.join(backupsDir(), nombre);
  const db = getDb();
  await db.backup(destino);
  if (tipo === 'automatico') podarAutomaticos();
  const st = fs.statSync(destino);
  return { archivo: nombre, tipo, tamano: st.size, creado_en: st.mtime.toISOString() };
}

/** ¿Ya se hizo un respaldo automático hoy? Si no, hace uno. Se llama al arrancar la app. */
async function respaldarSiHaceFalta() {
  const hoy = new Date().toISOString().slice(0, 10);
  const ultimo = listRespaldos().find((r) => r.tipo === 'automatico');
  if (ultimo && ultimo.creado_en.slice(0, 10) === hoy) return null;
  return crearRespaldo({ tipo: 'automatico' });
}

/** PRAGMA integrity_check de SQLite: 'ok' si todo bien, si no la lista de problemas. */
function verificarIntegridad() {
  const db = getDb();
  const filas = db.pragma('integrity_check');
  const ok = filas.length === 1 && filas[0].integrity_check === 'ok';
  return { ok, detalle: ok ? 'ok' : filas.map((f) => f.integrity_check).join('; ') };
}

/**
 * Restaura la base desde un respaldo. Antes de tocar nada intenta guardar un
 * respaldo de "antes de restaurar" (si la base actual ya está dañada y no se
 * puede ni leer, ese paso simplemente se salta — no bloquea la restauración).
 *
 * Al terminar dejar la conexión reabierta contra el archivo nuevo: quien
 * llama decide si reinicia el proceso completo (la pantalla de Respaldos lo
 * hace) o si sigue con el arranque (la recuperación automática al abrir la
 * app, que todavía no ha creado ninguna ventana).
 */
async function restaurarRespaldo(archivo) {
  if (!nombreValido(archivo)) throw new Error('Nombre de respaldo no válido.');
  const origen = path.join(backupsDir(), archivo);
  if (!fs.existsSync(origen)) throw new Error('Ese respaldo ya no existe.');

  try { await crearRespaldo({ tipo: 'pre-restaurar' }); }
  catch { /* la base actual ya está dañada y no se puede respaldar: se sigue igual */ }

  const destino = dbPath();
  closeDb();
  fs.copyFileSync(origen, destino);
  // El respaldo es un archivo consistente sin WAL: los -wal/-shm que haya
  // dejado la base anterior ya no aplican y hay que quitarlos, si no se
  // intentan "reproducir" contra el archivo nuevo y lo dejan mal otra vez.
  for (const ext of ['-wal', '-shm']) {
    try { fs.unlinkSync(destino + ext); } catch { /* no había */ }
  }

  const chequeo = verificarIntegridad(); // reabre la conexión de paso
  if (!chequeo.ok) throw new Error(`El respaldo restaurado no pasó la verificación: ${chequeo.detalle}`);
  return { archivo };
}

module.exports = {
  MAX_AUTOMATICOS,
  backupsDir,
  crearRespaldo,
  listRespaldos,
  respaldarSiHaceFalta,
  verificarIntegridad,
  restaurarRespaldo,
  nombreValido,
};
