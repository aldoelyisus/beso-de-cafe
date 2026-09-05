-- Precios de insumo que varían por tienda / temporada.
--   * proveedor: en una entrada, dónde se compró esta vez (texto libre, opcional).
--   * el tipo de movimiento 'ajuste_costo' (nuevo) corrige el costo unitario a mano
--     sin tocar la existencia: cantidad_base = 0, costo_unitario = el costo nuevo.
ALTER TABLE inventory_movements ADD COLUMN proveedor TEXT NOT NULL DEFAULT '';
