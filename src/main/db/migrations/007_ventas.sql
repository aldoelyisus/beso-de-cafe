-- Ventas y mesas.

CREATE TABLE IF NOT EXISTS mesas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL UNIQUE,
  orden       INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,     -- baja lógica
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Un ticket. Puede estar abierto mucho tiempo (el cliente de mesa paga al final).
CREATE TABLE IF NOT EXISTS ventas (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo                TEXT NOT NULL DEFAULT 'mesa',     -- 'mesa' | 'llevar'
  mesa_id             INTEGER REFERENCES mesas(id) ON DELETE SET NULL,
  estado              TEXT NOT NULL DEFAULT 'abierta',  -- 'abierta' | 'pagada' | 'cancelada'
  motivo_cancelacion  TEXT NOT NULL DEFAULT '',
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username            TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at           TEXT
);

CREATE TABLE IF NOT EXISTS venta_pagos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id    INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  monto       REAL NOT NULL,
  metodo      TEXT NOT NULL,                          -- 'efectivo' | 'transferencia'
  etiqueta    TEXT NOT NULL DEFAULT '',               -- '' pago completo, o 'Comensal 1' / nombre
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username    TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cada renglón es UNA unidad (2 cafés = 2 renglones). Simplifica dividir y cancelar.
CREATE TABLE IF NOT EXISTS venta_items (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id             INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id          INTEGER,                       -- referencia (puede quedar huérfana)
  presentacion_id      INTEGER,
  producto_nombre      TEXT NOT NULL,                 -- snapshot
  presentacion_nombre  TEXT NOT NULL DEFAULT '',      -- snapshot
  precio_unitario      REAL NOT NULL,                 -- snapshot del precio vigente (con IVA), sin extras
  para_llevar          INTEGER NOT NULL DEFAULT 0,    -- este item se preparó para llevar (consume vaso)
  estado               TEXT NOT NULL DEFAULT 'activo',   -- 'activo' | 'cancelado'
  motivo_cancelacion   TEXT NOT NULL DEFAULT '',
  pago_id              INTEGER REFERENCES venta_pagos(id) ON DELETE SET NULL,  -- NULL = sin pagar
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS venta_item_modificadores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_item_id  INTEGER NOT NULL REFERENCES venta_items(id) ON DELETE CASCADE,
  modificador_id INTEGER,
  nombre         TEXT NOT NULL,                       -- snapshot
  precio_extra   REAL NOT NULL DEFAULT 0              -- snapshot
);

-- Opción elegida en cada grupo de la receta (ej. "Leche" -> "Leche deslactosada").
CREATE TABLE IF NOT EXISTS venta_item_opciones (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_item_id  INTEGER NOT NULL REFERENCES venta_items(id) ON DELETE CASCADE,
  grupo_nombre   TEXT NOT NULL,                       -- snapshot
  insumo_id      INTEGER,
  insumo_nombre  TEXT NOT NULL                        -- snapshot
);

-- Lo que consumió del inventario este item exactamente (para poder devolverlo al cancelar).
CREATE TABLE IF NOT EXISTS venta_item_consumo (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_item_id  INTEGER NOT NULL REFERENCES venta_items(id) ON DELETE CASCADE,
  insumo_id      INTEGER NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
  cantidad_base  REAL NOT NULL,
  devuelto       INTEGER NOT NULL DEFAULT 0           -- 1 = ya se regresó al inventario
);

CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado);
CREATE INDEX IF NOT EXISTS idx_ventas_mesa ON ventas(mesa_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_pagos_venta ON venta_pagos(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_consumo_item ON venta_item_consumo(venta_item_id);
