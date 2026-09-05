-- Módulo de inventario: categorías de insumos, insumos y movimientos de existencias.

-- Categorías de insumos (Lácteos, Café, Desechables, Jarabes...).
-- unidad_sugerida solo autocompleta el formulario del insumo; el insumo puede cambiarla.
CREATE TABLE IF NOT EXISTS insumo_categorias (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre          TEXT NOT NULL UNIQUE,
  unidad_sugerida TEXT NOT NULL DEFAULT 'pieza',   -- 'ml' | 'g' | 'pieza'
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS insumos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre          TEXT NOT NULL,
  categoria_id    INTEGER REFERENCES insumo_categorias(id) ON DELETE SET NULL,

  -- Unidad en la que se lleva el stock y se descuentan las recetas.
  unidad_base     TEXT NOT NULL DEFAULT 'pieza',   -- 'ml' | 'g' | 'pieza'

  -- Presentación de compra: cómo se compra el insumo.
  unidad_compra   TEXT NOT NULL DEFAULT '',        -- texto libre: "Litro", "Bolsa 1 kg", "Paquete 50"
  factor_compra   REAL NOT NULL DEFAULT 1,         -- unidades base que trae 1 unidad de compra (1 L = 1000 ml)
  costo_compra    REAL NOT NULL DEFAULT 0,         -- costo de la ÚLTIMA compra, por unidad de compra (MXN)

  -- Costo promedio ponderado por unidad base. Lo que usan las recetas.
  costo_unitario  REAL NOT NULL DEFAULT 0,

  stock           REAL NOT NULL DEFAULT 0,         -- existencia actual, en unidad base
  stock_minimo    REAL NOT NULL DEFAULT 0,         -- alerta cuando stock <= stock_minimo (unidad base)

  notas           TEXT NOT NULL DEFAULT '',
  is_active       INTEGER NOT NULL DEFAULT 1,      -- 0 = insumo dado de baja (baja lógica)
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Libro de movimientos de existencias (ledger). Nunca se edita ni se borra:
-- cada cambio de stock deja un renglón.
CREATE TABLE IF NOT EXISTS inventory_movements (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  insumo_id         INTEGER NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  tipo              TEXT NOT NULL,                 -- 'entrada' | 'merma' | 'ajuste' | 'consumo'
  cantidad_base     REAL NOT NULL,                 -- CON SIGNO: + suma, - resta (en unidad base)
  cantidad_captura  REAL NOT NULL DEFAULT 0,       -- cantidad tal como se capturó (informativo)
  unidad_captura    TEXT NOT NULL DEFAULT '',      -- unidad en que se capturó (informativo)
  costo_unitario    REAL NOT NULL DEFAULT 0,       -- costo por unidad base al momento del movimiento
  motivo            TEXT NOT NULL DEFAULT '',      -- merma: caducidad|derrame|error_preparacion|otro ; ajuste/otros: nota
  referencia        TEXT NOT NULL DEFAULT '',      -- ej. "Venta #123" (uso futuro)
  stock_resultante  REAL NOT NULL DEFAULT 0,       -- stock después de aplicar el movimiento
  user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username          TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_insumos_active ON insumos(is_active);
CREATE INDEX IF NOT EXISTS idx_insumos_categoria ON insumos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_movements_insumo ON inventory_movements(insumo_id, id DESC);
