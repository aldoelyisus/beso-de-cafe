-- Efectivo recibido y cambio a dar en los pagos en efectivo.
ALTER TABLE venta_pagos ADD COLUMN recibido REAL;                 -- efectivo que entregó el cliente (NULL si no aplica / pago exacto)
ALTER TABLE venta_pagos ADD COLUMN cambio REAL NOT NULL DEFAULT 0;  -- cambio devuelto
