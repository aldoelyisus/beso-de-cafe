-- Cuentas que quedaron abiertas aunque ya no debian nada.
--
-- Pasaba asi: se cobra un producto, se cancelan los demas, y la cuenta se
-- queda sin pendientes pero marcada como abierta. Cancelar un renglon no
-- revisaba si con eso la cuenta quedaba saldada (cobrar si lo hacia).
--
-- La cuenta quedaba atrapada: el renglon pagado no se puede cancelar, y el
-- dia no cierra mientras haya cuentas abiertas. En la cafeteria bloqueo el
-- cierre del dia, y la unica salida a mano era anular una venta cobrada.
--
-- Esto cierra las que ya quedaron asi. Solo toca cuentas que tienen pagos y
-- cero renglones activos sin pagar: no inventa ningun cobro ni cancela nada.

UPDATE ventas
   SET estado = 'pagada',
       closed_at = COALESCE(
         closed_at,
         (SELECT MAX(created_at) FROM venta_pagos WHERE venta_id = ventas.id),
         datetime('now')
       )
 WHERE estado = 'abierta'
   AND EXISTS (SELECT 1 FROM venta_pagos WHERE venta_id = ventas.id)
   AND NOT EXISTS (
         SELECT 1 FROM venta_items
          WHERE venta_id = ventas.id AND estado = 'activo' AND pago_id IS NULL
       );
