'use strict';

/**
 * Borra la base de datos local para empezar de cero.
 * Al volver a abrir la app se crea de nuevo con las migraciones y el seed limpio.
 *
 *   npm run reset-db
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dir = process.env.BESO_DB_PATH
  ? path.dirname(process.env.BESO_DB_PATH)
  : path.join(appData, 'beso-de-cafe');

const base = process.env.BESO_DB_PATH
  ? path.basename(process.env.BESO_DB_PATH)
  : 'beso-de-cafe.db';

let borrados = 0;
for (const f of [base, `${base}-wal`, `${base}-shm`]) {
  try {
    fs.rmSync(path.join(dir, f));
    console.log('borrado:', f);
    borrados++;
  } catch {
    /* no existía */
  }
}

console.log(
  borrados
    ? `\nBase de datos reiniciada (${dir}).\nAl abrir la app se vuelve a crear con datos limpios.`
    : `No había base de datos que borrar en ${dir}.`
);
