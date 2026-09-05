-- FASE 9: Corte de caja (efectivo por turno) + Cierre de día (congela los números).

-- Turno de caja. Puede haber varios en un día; solo uno abierto a la vez.
CREATE TABLE IF NOT EXISTS cortes_caja (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  estado             TEXT NOT NULL DEFAULT 'abierto',   -- 'abierto' | 'cerrado'
  fondo_inicial      REAL NOT NULL DEFAULT 0,
  abierto_por        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  abierto_username   TEXT NOT NULL DEFAULT '',
  abierto_at         TEXT NOT NULL DEFAULT (datetime('now')),
  cerrado_por        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  cerrado_username   TEXT NOT NULL DEFAULT '',
  cerrado_at         TEXT,
  efectivo_esperado  REAL,
  efectivo_contado   REAL,
  diferencia         REAL,
  notas              TEXT NOT NULL DEFAULT ''
);

-- Entradas y salidas de efectivo del cajón durante el turno.
CREATE TABLE IF NOT EXISTS caja_movimientos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  corte_id    INTEGER NOT NULL REFERENCES cortes_caja(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,                     -- 'ingreso' | 'retiro'
  monto       REAL NOT NULL,
  concepto    TEXT NOT NULL DEFAULT '',
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username    TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A qué turno pertenece cada pago (para el arqueo de efectivo).
ALTER TABLE venta_pagos ADD COLUMN corte_id INTEGER REFERENCES cortes_caja(id) ON DELETE SET NULL;

-- Cierre de día: congela los totales del día. Después no se puede cobrar en ese día
-- (hay que reabrirlo). Los reportes de periodos largos suman estos renglones.
CREATE TABLE IF NOT EXISTS cierres_dia (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha             TEXT NOT NULL UNIQUE,        -- 'YYYY-MM-DD'
  ventas            INTEGER NOT NULL DEFAULT 0,
  ingreso_bruto     REAL NOT NULL DEFAULT 0,
  descuentos        REAL NOT NULL DEFAULT 0,
  ingreso_neto      REAL NOT NULL DEFAULT 0,
  costo             REAL NOT NULL DEFAULT 0,     -- inversión (insumos)
  ganancia          REAL NOT NULL DEFAULT 0,
  efectivo          REAL NOT NULL DEFAULT 0,
  transferencia     REAL NOT NULL DEFAULT 0,
  merma_costo       REAL NOT NULL DEFAULT 0,
  cerrado_por       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  cerrado_username  TEXT NOT NULL DEFAULT '',
  cerrado_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cierre_dia_productos (
  cierre_id        INTEGER NOT NULL REFERENCES cierres_dia(id) ON DELETE CASCADE,
  producto_nombre  TEXT NOT NULL,
  unidades         INTEGER NOT NULL DEFAULT 0,
  ingreso_neto     REAL NOT NULL DEFAULT 0,
  costo            REAL NOT NULL DEFAULT 0,
  ganancia         REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cortes_estado ON cortes_caja(estado);
CREATE INDEX IF NOT EXISTS idx_cierre_prod ON cierre_dia_productos(cierre_id);
