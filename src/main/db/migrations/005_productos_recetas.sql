-- Módulo de productos, presentaciones (tamaños), precios con historial,
-- recetas y modificadores.

-- Categorías del menú: Frappés, Cafés, Postres, ...
CREATE TABLE IF NOT EXISTS producto_categorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL UNIQUE,
  orden       INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS productos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre       TEXT NOT NULL,
  categoria_id INTEGER REFERENCES producto_categorias(id) ON DELETE SET NULL,
  descripcion  TEXT NOT NULL DEFAULT '',
  agotado      INTEGER NOT NULL DEFAULT 0,   -- 1 = agotado temporalmente (oculto del menú, no borrado)
  is_active    INTEGER NOT NULL DEFAULT 1,   -- 0 = baja lógica
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Presentaciones / tamaños de un producto. Todo producto tiene al menos una.
-- Un frappé tiene "Chico" y "Grande"; lo demás tiene "Único".
-- El PRECIO y la RECETA viven en la presentación (cada tamaño es distinto).
CREATE TABLE IF NOT EXISTS producto_presentaciones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id  INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL DEFAULT 'Único',
  orden        INTEGER NOT NULL DEFAULT 0,
  agotado      INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Historial de precios por presentación. El precio vigente es el que tiene
-- vigente_hasta NULL. Cambiar el precio cierra el renglón actual y abre uno nuevo.
-- Las ventas ya hechas guardan su propio precio, no se tocan (pregunta 8).
-- Los precios YA incluyen IVA (pregunta 9): se guardan tal cual.
CREATE TABLE IF NOT EXISTS presentacion_precios (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  presentacion_id INTEGER NOT NULL REFERENCES producto_presentaciones(id) ON DELETE CASCADE,
  precio          REAL NOT NULL,
  vigente_desde   TEXT NOT NULL DEFAULT (datetime('now')),
  vigente_hasta   TEXT,                         -- NULL = precio actual
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username        TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Renglones de receta de una presentación.
--   modo = 'siempre'  -> se consume siempre
--   modo = 'llevar'   -> se consume solo si la venta es "para llevar" (ej. vaso desechable)
--   modo = 'aqui'     -> se consume solo si la venta es "en cafetería"
-- Un frappé grande y uno chico son presentaciones distintas con recetas distintas.
CREATE TABLE IF NOT EXISTS receta_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  presentacion_id INTEGER NOT NULL REFERENCES producto_presentaciones(id) ON DELETE CASCADE,
  insumo_id       INTEGER NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
  cantidad_base   REAL NOT NULL,                -- en la unidad base del insumo
  modo            TEXT NOT NULL DEFAULT 'siempre',
  UNIQUE (presentacion_id, insumo_id, modo)
);

-- Modificadores (el cliente solo pidió "Extra shot de espresso").
CREATE TABLE IF NOT EXISTS modificadores (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre       TEXT NOT NULL UNIQUE,
  precio_extra REAL NOT NULL DEFAULT 0,         -- lo que se suma al total (con IVA incluido)
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Mini-receta de un modificador (ej. extra shot = +9 g de café en grano).
CREATE TABLE IF NOT EXISTS modificador_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  modificador_id INTEGER NOT NULL REFERENCES modificadores(id) ON DELETE CASCADE,
  insumo_id      INTEGER NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
  cantidad_base  REAL NOT NULL,
  UNIQUE (modificador_id, insumo_id)
);

-- Qué modificadores admite cada producto.
CREATE TABLE IF NOT EXISTS producto_modificadores (
  producto_id    INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  modificador_id INTEGER NOT NULL REFERENCES modificadores(id) ON DELETE CASCADE,
  PRIMARY KEY (producto_id, modificador_id)
);

CREATE INDEX IF NOT EXISTS idx_productos_active ON productos(is_active);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_presentaciones_producto ON producto_presentaciones(producto_id);
CREATE INDEX IF NOT EXISTS idx_precios_presentacion ON presentacion_precios(presentacion_id);
CREATE INDEX IF NOT EXISTS idx_precio_vigente ON presentacion_precios(presentacion_id) WHERE vigente_hasta IS NULL;
CREATE INDEX IF NOT EXISTS idx_receta_presentacion ON receta_items(presentacion_id);
