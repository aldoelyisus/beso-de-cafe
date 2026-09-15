-- Integridad del inventario.
--
-- 1) El nombre del INSUMO era libre: se podían crear dos "Café en grano" y la
--    existencia quedaba partida en dos (las recetas descontaban de uno y las
--    compras entraban al otro, viéndose idénticos en el selector de recetas).
-- 2) El nombre de la CATEGORÍA era único pero distinguiendo mayúsculas, así que
--    "Café" y "café" convivían leyéndose igual en pantalla.
--
-- SQLite no permite cambiar la colación de una columna con ALTER TABLE; la
-- unicidad sin mayúsculas se impone con un índice (ver categoriaService.js e
-- insumoService.js, que además dan el mensaje claro antes de llegar aquí).
CREATE UNIQUE INDEX IF NOT EXISTS idx_insumos_nombre_nocase
  ON insumos(nombre COLLATE NOCASE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_insumo_categorias_nombre_nocase
  ON insumo_categorias(nombre COLLATE NOCASE);
