'use strict';

const { getDb } = require('./connection');
const registry = require('../permissions/registry');
const { hashPassword } = require('../security/password');

const DEFAULT_ADMIN = {
  name: 'Administrador del sistema',
  username: 'admin',
  password: 'admin123', // se debe cambiar en el primer uso
};

/**
 * Sincroniza el catálogo de permisos desde el código y garantiza que exista
 * el usuario administrador interno (oculto en los listados).
 * Se ejecuta en cada arranque; es idempotente.
 */
function seed() {
  const db = getDb();

  // 1) Sincronizar permisos desde el registro de código.
  const perms = registry.allPermissions();
  const upsert = db.prepare(
    `INSERT INTO permissions (key, module, action, label)
     VALUES (@key, @module, @action, @label)
     ON CONFLICT(key) DO UPDATE SET module = @module, action = @action, label = @label`
  );
  const syncPerms = db.transaction(() => {
    for (const p of perms) upsert.run(p);
    // Quitar permisos que ya no existen en el código.
    const validKeys = new Set(perms.map((p) => p.key));
    const existing = db.prepare('SELECT key FROM permissions').all().map((r) => r.key);
    const del = db.prepare('DELETE FROM permissions WHERE key = ?');
    for (const k of existing) if (!validKeys.has(k)) del.run(k);
  });
  syncPerms();

  // 2) Usuario administrador interno.
  const admin = db.prepare('SELECT id FROM users WHERE is_system = 1').get();
  if (!admin) {
    db.prepare(
      `INSERT INTO users (name, username, password_hash, is_active, is_system)
       VALUES (?, ?, ?, 1, 1)`
    ).run(DEFAULT_ADMIN.name, DEFAULT_ADMIN.username, hashPassword(DEFAULT_ADMIN.password));
    console.log(
      `[seed] usuario administrador creado -> usuario: "${DEFAULT_ADMIN.username}" / contraseña: "${DEFAULT_ADMIN.password}" (cámbiala)`
    );
  }

  // 3) Categorías de insumos típicas de cafetería (solo si no hay ninguna:
  //    así se pueden borrar sin que vuelvan a aparecer).
  const catCount = db.prepare('SELECT COUNT(*) c FROM insumo_categorias').get().c;
  if (catCount === 0) {
    const insCat = db.prepare(
      'INSERT INTO insumo_categorias (nombre, unidad_sugerida) VALUES (?, ?)'
    );
    for (const [nombre, unidad] of DEFAULT_CATEGORIAS) insCat.run(nombre, unidad);
    console.log(`[seed] ${DEFAULT_CATEGORIAS.length} categorías de insumos creadas`);
  }

  // 4) Categorías del menú (pregunta 1) — solo si no hay ninguna.
  const pcatCount = db.prepare('SELECT COUNT(*) c FROM producto_categorias').get().c;
  if (pcatCount === 0) {
    const insPCat = db.prepare('INSERT INTO producto_categorias (nombre, orden) VALUES (?, ?)');
    DEFAULT_PRODUCTO_CATEGORIAS.forEach((nombre, idx) => insPCat.run(nombre, idx));
    console.log(`[seed] ${DEFAULT_PRODUCTO_CATEGORIAS.length} categorías de producto creadas`);
  }

  // 5) Modificador único del cliente (pregunta 2) — solo si no hay ninguno.
  //    Sin receta ni precio todavía: se configuran desde la interfaz.
  const modCount = db.prepare('SELECT COUNT(*) c FROM modificadores').get().c;
  if (modCount === 0) {
    db.prepare('INSERT INTO modificadores (nombre, precio_extra) VALUES (?, 0)').run(
      'Extra shot de espresso'
    );
    console.log('[seed] modificador "Extra shot de espresso" creado (falta ponerle precio y receta)');
  }

  // 6) Mesas iniciales (ajustables desde la app) — solo si no hay ninguna.
  const mesaCount = db.prepare('SELECT COUNT(*) c FROM mesas').get().c;
  if (mesaCount === 0) {
    const insMesa = db.prepare('INSERT INTO mesas (nombre, orden) VALUES (?, ?)');
    for (let i = 1; i <= 6; i++) insMesa.run(`Mesa ${i}`, i);
    console.log('[seed] 6 mesas creadas (ajusta la cantidad en Ventas → Mesas)');
  }
}

const DEFAULT_PRODUCTO_CATEGORIAS = [
  'Frappés',
  'Sodas Italianas',
  'Tisanas',
  'Matcha',
  'Cafés',
  'Postres',
  'Otros',
];

// Categorías de insumo de Beso de Café (según la lista real del cliente, pregunta 5).
const DEFAULT_CATEGORIAS = [
  ['Café', 'g'],                     // café en grano, café soluble
  ['Lácteos', 'ml'],                 // leche entera, leche deslactosada
  ['Jarabes', 'ml'],                 // vainilla, caramelo, blueberry, piña colada, fresa, mango, chai, pumpkin spice
  ['Salsas y coberturas', 'ml'],     // Hershey's, Hershey's fresa
  ['Bases y polvos', 'g'],           // base para frappé, azúcar, azúcar glass, cocoa
  ['Toppings y complementos', 'pieza'], // chantilly, mazapán, galletas oreo, crema de avellana, chocoreta
  ['Aguas y mixers', 'ml'],          // agua mineral, agua de coco
  ['Tisanas e infusiones', 'g'],     // tisanas
  ['Repostería', 'g'],               // harina
  ['Desechables', 'pieza'],          // vasos para llevar, charolas
];

module.exports = { seed, DEFAULT_ADMIN };
