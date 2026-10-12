-- Insumos que la cafetería prepara con otros insumos.
--
-- La base para frappé no se compra: se hace con leche en polvo, CLM y azúcar
-- glass. Al preparar una tanda salen esos tres del inventario y entra la base;
-- al vender el frappé se descuenta SOLO la base, porque lo demás ya se
-- descontó cuando se preparó. Restarlo otra vez sería contarlo dos veces.

ALTER TABLE insumos ADD COLUMN se_prepara INTEGER NOT NULL DEFAULT 0;

-- Cuánto sale de una tanda, en la unidad base del propio insumo
-- (ej. 1000 g de base). Es el puente entre "lo que lleva" y "lo que rinde",
-- igual que `factor_compra` lo es entre la presentación y la unidad base.
ALTER TABLE insumos ADD COLUMN rinde REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS insumo_receta (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  insumo_id     INTEGER NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  componente_id INTEGER NOT NULL REFERENCES insumos(id),
  cantidad_base REAL NOT NULL,          -- en la unidad base del COMPONENTE
  orden         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (insumo_id, componente_id)
);

CREATE INDEX IF NOT EXISTS idx_insumo_receta ON insumo_receta(insumo_id);
CREATE INDEX IF NOT EXISTS idx_insumo_receta_comp ON insumo_receta(componente_id);
