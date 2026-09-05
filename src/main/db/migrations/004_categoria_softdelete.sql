-- Borrado lógico para categorías de insumos (igual que usuarios e insumos).
ALTER TABLE insumo_categorias ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_insumo_categorias_active ON insumo_categorias(is_active);
