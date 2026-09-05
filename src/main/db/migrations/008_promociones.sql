-- Promociones y descuentos (§3.6). Solo el administrador las crea (pregunta 19).
-- Vigencia obligatoria (pregunta 21). Una promoción por pedido (pregunta 20).

CREATE TABLE IF NOT EXISTS promociones (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre              TEXT NOT NULL,
  tipo                TEXT NOT NULL,             -- 'combo' | 'dia' | 'monto_fijo'
  descripcion         TEXT NOT NULL DEFAULT '',
  fecha_inicio        TEXT NOT NULL,             -- 'YYYY-MM-DD'
  fecha_fin           TEXT NOT NULL,             -- 'YYYY-MM-DD' (inclusive)
  dia_semana          INTEGER,                   -- 0=domingo .. 6=sábado (solo tipo 'dia')
  ambito              TEXT NOT NULL,             -- 'categoria' | 'productos' | 'cuenta'
  categoria_id        INTEGER REFERENCES producto_categorias(id) ON DELETE SET NULL,
  cantidad_requerida  INTEGER,                   -- combo por categoría: cuántos productos
  valor_tipo          TEXT NOT NULL,             -- 'fijo' (precio del combo) | 'porcentaje' | 'monto'
  valor               REAL NOT NULL,
  is_active           INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Productos específicos que participan (cuando ambito = 'productos').
CREATE TABLE IF NOT EXISTS promocion_productos (
  promocion_id  INTEGER NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
  producto_id   INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  PRIMARY KEY (promocion_id, producto_id)
);

-- La promoción aplicada a una venta y cuánto se descontó.
ALTER TABLE ventas ADD COLUMN promocion_id INTEGER REFERENCES promociones(id) ON DELETE SET NULL;
ALTER TABLE ventas ADD COLUMN promocion_nombre TEXT NOT NULL DEFAULT '';
ALTER TABLE ventas ADD COLUMN descuento REAL NOT NULL DEFAULT 0;

-- Cuánto descuento absorbió cada pago (para cobros divididos).
ALTER TABLE venta_pagos ADD COLUMN descuento REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_promociones_activa ON promociones(is_active);
