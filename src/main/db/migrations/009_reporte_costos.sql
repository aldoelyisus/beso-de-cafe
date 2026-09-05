-- Guarda el costo del insumo al momento de venderse, para reportes de inversión vs ganancia.
ALTER TABLE venta_item_consumo ADD COLUMN costo_unitario REAL NOT NULL DEFAULT 0;
