'use strict';

const path = require('path');
const { app, BrowserWindow, shell, dialog } = require('electron');

const { runMigrations } = require('./db/migrate');
const { seed } = require('./db/seed');
const { closeDb } = require('./db/connection');
const { registerIpc } = require('./ipc');
const backupService = require('./backup/backupService');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'Beso de Café',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Los enlaces externos se abren en el navegador del sistema, no dentro de la app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.BESO_DEVTOOLS === '1') mainWindow.webContents.openDevTools({ mode: 'detach' });
}

/**
 * Antes de tocar nada, se revisa que la base abra bien (PRAGMA integrity_check
 * de SQLite). Si no, se ofrece restaurar el último respaldo con un diálogo
 * nativo: todavía no existe ninguna ventana ni la interfaz, así que la
 * recuperación no puede depender de que el renderer funcione.
 */
async function verificarBaseAlArrancar() {
  let chequeo;
  try { chequeo = backupService.verificarIntegridad(); }
  catch (e) { chequeo = { ok: false, detalle: e.message }; }
  if (chequeo.ok) return true;

  let respaldos = [];
  try { respaldos = backupService.listRespaldos(); } catch { /* ni carpeta hay todavía */ }
  const ultimo = respaldos[0];

  const detalle = `La base de datos no pasó la verificación al arrancar:\n${chequeo.detalle}\n\n` +
    (ultimo
      ? `Se puede restaurar el último respaldo (${ultimo.archivo}, ${new Date(ultimo.creado_en).toLocaleString()}).`
      : 'No hay ningún respaldo guardado todavía: no hay de dónde recuperar.');
  const opciones = ultimo ? ['Restaurar el último respaldo', 'Salir sin cambiar nada'] : ['Salir'];

  const r = dialog.showMessageBoxSync({
    type: 'error',
    title: 'Beso de Café — problema con la base de datos',
    message: 'La base de datos tiene un problema y no se puede abrir de forma segura.',
    detail: detalle,
    buttons: opciones,
    defaultId: 0,
    cancelId: opciones.length - 1,
  });

  if (ultimo && r === 0) {
    try {
      await backupService.restaurarRespaldo(ultimo.archivo);
      dialog.showMessageBoxSync({ type: 'info', title: 'Beso de Café', message: 'Base restaurada. La aplicación va a continuar.' });
      return true;
    } catch (e) {
      dialog.showMessageBoxSync({ type: 'error', title: 'Beso de Café', message: 'No se pudo restaurar: ' + e.message });
      return false;
    }
  }
  return false;
}

app.whenReady().then(async () => {
  const ok = await verificarBaseAlArrancar();
  if (!ok) { app.quit(); return; }

  runMigrations();
  seed();
  registerIpc();
  createWindow();

  // No bloquea el arranque: si falla, la persona sigue trabajando y puede
  // hacer un respaldo a mano desde la pantalla de Respaldos.
  backupService.respaldarSiHaceFalta().catch(() => {});

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => closeDb());
