-- Combos que piden cosas distintas: "un pastel y un cafe".
--
-- Antes un combo solo sabia dos cosas: N productos de UNA categoria, o la
-- lista exacta de productos que tenian que estar TODOS en la venta. El dueno
-- quiso armar "Pastel + cafe" marcando los pasteles y los cafes como "ciertos
-- productos", y la promocion nunca aplicaba: pedia los catorce juntos.
--
-- Se agregan dos formas mas:
--   'lista'       cualquiera N de una lista de productos
--   'dos_grupos'  N de un lado y N del otro (cada lado: categoria o lista)

ALTER TABLE promociones ADD COLUMN grupo2_tipo TEXT;
ALTER TABLE promociones ADD COLUMN grupo2_categoria_id INTEGER REFERENCES producto_categorias(id);
ALTER TABLE promociones ADD COLUMN grupo2_cantidad INTEGER NOT NULL DEFAULT 1;

-- De que lado del combo esta cada producto marcado. Lo que ya existe es del
-- grupo 1, que es como se venia usando.
ALTER TABLE promocion_productos ADD COLUMN grupo INTEGER NOT NULL DEFAULT 1;
