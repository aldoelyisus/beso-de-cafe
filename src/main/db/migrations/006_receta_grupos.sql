-- Grupos de opción dentro de una receta.
-- Ej. "Leche" -> el cliente elige entre Leche entera / Leche deslactosada,
-- misma cantidad, y una es la predeterminada.

CREATE TABLE IF NOT EXISTS receta_grupos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  presentacion_id   INTEGER NOT NULL REFERENCES producto_presentaciones(id) ON DELETE CASCADE,
  nombre            TEXT NOT NULL,                 -- "Leche", "Base", ...
  cantidad_base     REAL NOT NULL,                 -- misma cantidad para cualquier opción, en unidad base
  modo              TEXT NOT NULL DEFAULT 'siempre',   -- siempre | llevar | aqui
  insumo_default_id INTEGER REFERENCES insumos(id) ON DELETE SET NULL,  -- opción preseleccionada
  orden             INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS receta_grupo_opciones (
  grupo_id   INTEGER NOT NULL REFERENCES receta_grupos(id) ON DELETE CASCADE,
  insumo_id  INTEGER NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
  PRIMARY KEY (grupo_id, insumo_id)
);

CREATE INDEX IF NOT EXISTS idx_receta_grupos_pres ON receta_grupos(presentacion_id);
