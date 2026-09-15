# Flujo de trabajo — Beso de Café

Orden para construir la aplicación, basado en el documento de alcance
(*Requerimientos Beso de Café*). Cada fase se apoya en la anterior.

Marca `[x]` conforme se termina. "Hecho cuando" es el criterio para cerrar la fase.

---

## Reglas que aplican a TODAS las fases

- **Offline**: nada de internet. Todo en SQLite local (`beso-de-cafe.db`).
- **Todo desde el inicio**: no se dejan partes "para después" dentro de una fase.
- **Permisos en código**: se definen en `src/main/permissions/registry.js` y se
  sincronizan al arrancar. Nunca se crean permisos desde la interfaz.
- **Baja lógica siempre**: nada se borra de la base (usuarios, insumos, categorías,
  productos, ventas…). Se marca `is_active = 0` / se cancela.
- **Bitácora en todo**: cada alta, cambio, baja, cancelación y descuento se
  registra con `audit()` en `src/main/ipc/index.js`.
- **Listados paginados de 15** con el helper `src/main/services/pagination.js`.
- **Precios y costos "foto"**: cuando algo afecta dinero (precio de venta, costo de
  insumo, permisos de un rol), se guarda el valor del momento; cambiarlo después no
  reescribe el histórico. El precio de producto lleva **historial con vigencia**
  (*pregunta 8*): la venta guarda el precio que estaba vigente esa fecha.
- **IVA incluido** (*pregunta 9*): todos los precios ya traen IVA. El sistema no
  calcula ni desglosa impuesto; el total es la suma directa.
- **Acciones sensibles visibles en su módulo**: cancelar una venta o cambiar un precio
  no solo va a la bitácora, también se marca donde se revisa (lista de ventas,
  ficha del producto) — *preguntas 8, 11, 17*.
- **Arquitectura**: renderer → `window.api` (preload) → `ipc` (valida permisos) →
  `services` → `db`. Toda la seguridad se valida en `ipc`.

---

## FASE 0 — Base del proyecto  ✅ HECHO

- [x] Electron + better-sqlite3 + migraciones + seed
- [x] Login (usuario + contraseña)
- [x] Menú lateral desplegable por módulos/submódulos
- [x] Usuario administrador interno oculto (`admin`)

---

## FASE 1 — Usuarios, roles y permisos  ✅ HECHO
*(Documento §3.1)*

- [x] Roles como plantilla de permisos
- [x] Usuario hereda una "foto" de los permisos del rol al crearse
- [x] Editar un rol NO afecta a usuarios existentes
- [x] Permisos individuales extra por usuario
- [x] Baja lógica de usuarios (se muestran como "Desactivado")
- [x] Restablecer contraseña / cambiar nombre de usuario
- [x] Área de personal (teléfono, contacto de emergencia)
- [x] **El nombre de usuario no distingue mayúsculas** (migración 013): quien se dio de alta
      como "Lupita" entra tecleando "lupita", y no se pueden crear "Lupita" y "LUPITA" como
      dos personas distintas. La **contraseña sí** distingue mayúsculas y espacios.
- [x] **Repartir permisos es su propio permiso** (`users.permissions`, aparte de `users.edit`):
      quien puede asignar permisos puede volver administrador a cualquiera, así que no basta
      con poder editar el teléfono de alguien. Además **nadie cambia sus propios permisos**
      ni se desactiva a sí mismo. Dar de alta con permisos sueltos también lo exige.
- [x] **Desactivar a alguien corta su sesión abierta** en ese momento (no espera al logout).
- [x] **`view` incluye ver el listado** (revisión de permisos): antes `X.view` y `X.list` eran
      permisos distintos, y marcar solo el primero dejaba al usuario viendo el módulo en el menú
      con la pantalla vacía. Se fusionaron: **`X.view` = entrar al módulo y ver su contenido**.
      El catálogo bajó de 63 a **55 permisos**.
      - Se conserva `ventas.list` porque el **historial de ventas es otra pantalla** (enseña el
        dinero de todo el día), no el listado del punto de venta.
      - Se eliminó `mesas.list`, que no protegía nada.
- [x] **Los grupos del menú no tienen permiso propio**: "Inventario", "Menú y recetas", "Ventas"
      y "Usuarios y personal" aparecen en cuanto el usuario puede ver **alguno** de sus submódulos,
      y el grupo lleva al primer destino que sí puede abrir. Antes cada grupo exigía además un
      `inventory.view` / `menu.view` invisible: quien tenía `insumos.view` no veía Inventario por
      ningún lado y no había forma de adivinar qué le faltaba. El catálogo quedó en **53 permisos**.
- **Referencia completa**: [PERMISOS.md](PERMISOS.md) — qué habilita cada permiso, qué pantalla
  abre, qué botones enseña, recetas de rol y los errores fáciles de cometer. Se genera desde el
  código y se verifica creando un usuario por permiso (`scratchpad/qa-permiso-por-permiso.js`).
- **Permisos**: `users.*` (`users.permissions` como acción aparte), `roles.*`
- **Por configurar en la app** (*preguntas 10-12*): crear los roles **Administrador**,
  **Cajero 1** y **Cajero 2**, y 3 usuarios. Los permisos finos de cada rol de cajero se
  ajustan conforme se construyen las fases 4, 6 y 7 (cancelar ventas, cambiar precios, etc.).

---

## FASE 2 — Bitácora del sistema  ✅ HECHO
*(Documento §3.1, último punto)*

- [x] Registro de solo lectura (`logs.view`, sin crear/editar/eliminar)
- [x] Login exitoso / fallido, logout
- [x] Alta/edición/baja de roles y usuarios + asignación de permisos
- [x] Vista con filtro por acción y búsqueda de texto

---

## FASE 3 — Inventario  🔄 EN PROGRESO
*(Documento §3.2)*

### 3.a Categorías de insumos  ✅ HECHO
- [x] CRUD con unidad sugerida, baja lógica, paginado

### 3.b Insumos  ✅ HECHO

> **Reglas de integridad** (migración 014, revisión de QA):
> - **Nombres únicos "como los lee una persona"** — insumos y categorías. "Café en grano",
>   "café en grano", "CAFÉ EN GRANO" y "Cafe en grano" son el mismo. Con dos fichas iguales la
>   existencia se parte: las recetas descuentan de una y las compras entran a la otra.
>   La comparación vive en `services/nombres.js` porque el `COLLATE NOCASE` de SQLite solo
>   pliega el alfabeto ASCII (para él "CAFÉ" ≠ "Café"); los índices únicos son la red.
> - **La unidad base no se cambia a medio camino**: en cuanto el insumo tiene existencia,
>   movimientos o aparece en una receta, ya no se le puede cambiar de g a ml. No convertía
>   nada (2000 g pasaban a ser 2000 ml) y el costeo quedaba mal. El mensaje dice qué hacer.
> - **Un insumo dado de baja no mueve existencias**: ya no se ofrece en recetas, así que lo
>   que entrara nunca saldría. Hay que reactivarlo primero.
> - **Costo de compra**: nunca negativo. El campo vacío conserva el último costo conocido;
>   un 0 capturado a propósito (mercancía de regalo) **sí** baja el promedio ponderado.
> - **Existencia en negativo**: una venta **nunca** se frena por el inventario (el producto
>   existe aunque el conteo diga que no), pero el negativo **se avisa al cajero en el momento**
>   y el insumo queda marcado en rojo con "Faltan N", aparte de "por acabarse". Un negativo no
>   es un error del sistema: dice *"salió mercancía que nunca se registró como compra"*. Se
>   corrige con un **conteo físico** o registrando la entrada que falta.
> - **El negativo no entra al costo promedio**: si se metiera, se comería parte del valor de la
>   compra siguiente e inflaría el costo de todo (con −45 galletas, comprar a $1.30 daba $1.3441).
>   Para el promedio ponderado, una existencia negativa cuenta como cero.
> - **Los campos numéricos avisan** si traen texto (pasa al pegar de WhatsApp), en vez de
>   quedarse en 0 en silencio y dejar el insumo valiendo $0 en el reporte de inversión.

- [x] Ficha: nombre, categoría, unidad base (ml/g/pieza), presentación de compra
      (unidad, factor, costo), stock, stock mínimo
- [x] Movimientos: entrada, merma (con motivo), ajuste por conteo físico
- [x] Costo promedio ponderado por unidad base
- [x] Alerta "por acabarse" (`stock <= stock_minimo`)
- [x] Baja lógica de insumos
- [x] **Precios que cambian de tienda en tienda** (migración 012): cada **entrada** captura el
      costo real de *esa* compra y una **tienda / proveedor** opcional; el promedio ponderado
      se ajusta solo. Para el mango que hoy está a $20 y el lunes a $21 no hay que hacer nada
      especial: cada compra entra con su precio.
- [x] **Corregir costo** (`ajuste_costo`, permiso `insumos.costo`): se captura el **precio de la
      presentación de compra** (el kilo, el paquete, la botella de 1.2 L) —igual que en una
      entrada— y el sistema divide entre lo que rinde; la pantalla muestra en vivo en cuánto queda
      por unidad base. Antes pedía el costo *por gramo*: obligaba a dividir de cabeza, y un `400`
      escrito en vez de `0.40` multiplicaba por mil el costo del menú. **No toca la existencia**,
      deja el precio nuevo como el vigente (la próxima entrada ya viene con él), motivo obligatorio,
      renglón en el libro de movimientos y bitácora (`inventory.costo.ajuste`).
- [x] **El costo se congela hacia adelante**: cada venta guarda el costo del insumo de ese
      momento (`venta_item_consumo.costo_unitario`). Si a media jornada se hace una compra de
      emergencia más cara, **solo encarece lo que se venda después** — lo de la mañana conserva
      su costo. Igual con la corrección manual: nunca reescribe histórico.

### 3.c Pendiente en Inventario (se completa con las fases siguientes)
- [ ] Movimiento `consumo` automático al vender (se implementa en FASE 6)
- [ ] Movimiento inverso al `consumo` cuando se cancela un producto — *pregunta 16* (FASE 7)
- [ ] Reporte de costo de merma por periodo (se implementa en FASE 10)
- **Hecho cuando**: al vender un producto, su receta descuenta los insumos solos.

> **Insumos reales del cliente (pregunta 5)** — cargar con estas unidades:
> - **Piezas**: vasos para llevar (frappé / bebida caliente / bebida fría), charolas (chica, grande),
>   chantilly, mazapán, galletas oreo.
> - **Gramos**: café en grano *(se compra en kg → presentación de compra "kg", factor 1000)*,
>   café soluble, base para frappé, azúcar, azúcar glass, harina, crema de avellana, chocoreta,
>   tisanas, cocoa.
> - **Mililitros**: leche entera, leche deslactosada, agua mineral, agua de coco, Hershey's,
>   Hershey's fresa, jarabes (vainilla, caramelo, blueberry, piña colada, fresa, mango, chai, pumpkin spice).
>
> No se necesita una unidad "kg" ni "L": el café en grano se registra en **g** y se compra en kg
> usando la presentación de compra. El formulario tiene un atajo (Suelto · Por kilo · Por litro ·
> Otra presentación) que pone el factor 1000 solo. Categorías reales ya sembradas: Café, Lácteos,
> Jarabes, Salsas y coberturas, Bases y polvos, Toppings y complementos, Aguas y mixers,
> Tisanas e infusiones, Repostería, Desechables.

---

## FASE 4 — Productos y menú  ✅ HECHO
*(Documento §3.5 tarjetas, §5 preguntas 1-4, 7, 8, 9; migración 005)*

- [x] Categorías de producto — CRUD, baja lógica, paginado, orden.
      Sembradas: **Frappés · Sodas Italianas · Tisanas · Matcha · Cafés · Postres · Otros** (7).
- [x] Productos: nombre, categoría, descripción. Baja lógica.
- [x] **Tamaños** (`producto_presentaciones`): cada producto tiene 1+ tamaños; cada uno con su
      **precio** y su **receta propia**. Producto simple = 1 tamaño "Único". Frappés = "Chico" / "Grande".
- [x] Marcar producto **o** tamaño como **agotado temporalmente** — *pregunta 4*.
- [x] **Todos llevan receta** — no existe "producto sin receta" — *pregunta 7*.
- [x] Modificador **"Extra shot de espresso"** — *pregunta 2*: `precio_extra` + mini-receta
      (`modificador_items`) que descuenta café — *pregunta 3*. Se asigna por producto.
- [x] **Precio con historial de vigencia** (`presentacion_precios`) — *pregunta 8*: cambiar el
      precio cierra el renglón vigente y abre uno nuevo; las ventas ya hechas nunca se tocan.
      El historial se ve desde el editor del producto.
- [x] **Precios con IVA incluido** — *pregunta 9*: se guardan tal cual, sin desglose.
- [x] **Foto del producto — obligatoria al dar de alta** (migración 015). En el punto de venta
      el cajero elige "de un vistazo": la tarjeta es la foto, con el nombre y el precio debajo.
      También sale como miniatura en el listado de administración y se puede cambiar desde el
      editor (mandar `foto` la reemplaza, no mandarla conserva la que tenía; **no** se puede
      dejar un producto sin foto).
      - **Se guarda dentro de la base**, como data URI, no como ruta a un archivo: la app es
        offline de un solo equipo y el respaldo de FASE 12 copia un único `.db` — con las fotos
        fuera, un respaldo restaurado se quedaría sin ellas.
      - **La interfaz la reduce antes de mandarla** (`components/imagePicker.js`): canvas a
        640 px de lado mayor y JPEG de calidad 0.82, sin librerías. Una foto de celular de 4 MB
        queda en decenas de KB. Los PNG se conservan en PNG para no perder la transparencia.
      - **El servicio no se fía de la interfaz** (`menu/foto.js`): solo JPG, PNG y WebP —
        el SVG se rechaza porque puede traer scripts— y máximo 600 KB, con el peso en el mensaje.
      - La bitácora anota "Cambió la foto", nunca el data URI completo.
- [x] **Nombre de producto único** "como lo lee una persona" (misma regla que insumos, ver
      `services/nombres.js`) y **categoría validada** con mensaje claro en vez del error de la base.
- **Permisos**: `menu.view`, `productos.*` (`productos.precio` y `productos.receta` como acciones
  aparte), `producto_categorias.*`, `modificadores.*`
- **Menú**: nuevo grupo "Menú y recetas" → Productos · Categorías de productos · Modificadores.

---

## FASE 5 — Recetas y costeo  ✅ HECHO
*(Documento §3.2: receta, costo y ganancia; migración 005)*

- [x] Receta **por tamaño** (`receta_items`): (insumo, cantidad en unidad base, **modo**).
      `modo` = `siempre` · `llevar` (vaso desechable) · `aqui`. Así un mismo producto divide
      "para llevar" vs "en cafetería" y cada tamaño consume distinto.
- [x] **Grupos de opción** (`receta_grupos` + `receta_grupo_opciones`, migración 006):
      un renglón donde el cliente elige un insumo entre varios (misma cantidad), con opción
      **predeterminada**. Ej. "Leche": entera o deslactosada. En la venta (FASE 6) el cajero
      elige cuál; el costeo usa la predeterminada. Todas las opciones deben tener la misma unidad.
- [x] Receta del modificador (ej. +9 g de café en grano).
- [x] **Costo automático** por tamaño = Σ (cantidad × `costo_unitario` del insumo), calculado
      para los dos escenarios: **costo aquí** y **costo para llevar**.
- [x] **Ganancia** = precio − costo (el precio ya trae IVA). Se muestra en vivo en el editor
      mientras se arma la receta (panel de costeo con 4 celdas).
- [x] Señal "receta completa" en el listado (todos los tamaños activos con receta y precio).
- **Depende de**: FASE 3 (insumos y su costo) + FASE 4 (productos y tamaños)
- **Editor**: `#/productos/:id` — datos generales + pestañas por tamaño, cada una con su precio,
  su editor de receta y su costeo en vivo.

---

## FASE 6 — Ventas y mesas  ✅ HECHO
*(Documento §3.4, §2 recuperación; preguntas 8, 9, 13-16; migración 007)*

- [x] **El mapa de mesas del punto de venta va por su propio canal** (`ventas:mesas`, permiso
      `ventas.view`). Antes lo servía `mesas:list`, protegido con `mesas.view`: un cajero con
      permisos de venta abría el punto de venta y recibía "No tienes permiso", porque para
      **vender** se le estaba exigiendo el permiso de **configurar mesas**.
- [x] **Mesas** configurables (agregar de una en una o "N de golpe", renombrar, baja lógica).
      Menú Ventas → Mesas. 6 mesas sembradas.
- [x] **Punto de venta** (`#/pos`): mapa de mesas (libre / ocupada con total) + botón
      "pedido para llevar" + lista de cuentas para llevar abiertas.
- [x] **Cuenta unificada por mesa**: abrir una mesa que ya tiene cuenta entra a la misma
      (el mesero no lleva quién pidió qué). **Varias cuentas abiertas a la vez** — *pregunta 13*.
- [x] Ticket (`#/venta/:id`): catálogo por categoría → al elegir un producto se pide
      **tamaño**, **para llevar / aquí**, **extra shot** y la opción de cada **grupo**
      (tipo de leche), con total en vivo. Cada unidad es un renglón (2 cafés = 2 renglones).
- [x] **Descuento de inventario al agregar** (movimiento `consumo`): receta del tamaño según
      modo (aquí no consume vaso, para llevar sí) + grupo elegido + modificador. Se guarda
      `venta_item_consumo` con lo que consumió exactamente cada renglón.
- [x] **La mesa se retira → la cuenta pasa a llevar** (botón "🥤 Pasar a llevar" en el ticket).
      No es solo cambiar la bandera: los renglones ya descontaron inventario con la receta de
      **aquí** (que no gasta vaso), así que se les aplica la **diferencia** con la receta de
      **para llevar** — salen los vasos desechables y se actualiza `venta_item_consumo`, para que
      el reporte de inversión cobre el vaso. La mesa queda libre en el mapa al instante.
      - Solo se convierten los renglones **activos**; los cancelados ya devolvieron sus insumos.
      - Los que ya eran "para llevar" **no** se vuelven a cobrar (no salen dos vasos).
      - Se **respeta la opción elegida** en cada grupo (si pidió deslactosada, sigue deslactosada).
      - El **precio no cambia**: el vaso es costo, no precio.
      - **Se puede deshacer**: "Sentar en una mesa" devuelve los vasos al inventario. Y una
        cuenta se puede **cambiar de mesa** sin tocar el inventario.
      - Una mesa lleva una sola cuenta: si el destino ya tiene una abierta, se avisa con su número.
      - Permiso `ventas.crear`. Queda en la bitácora como `ventas.cambiarTipo` con el detalle
        de cuántos productos se ajustaron.
- [x] **Cancelar un producto de la cuenta abierta** → los insumos **regresan** (`devolucion`) — *pregunta 16*.
- [x] Precio **snapshot** del momento (*pregunta 8*); **IVA incluido**, total = suma directa (*pregunta 9*).
- [x] **Cobro completo** ("Cobrar todo") y **por partes / dividir**: marcas los productos de
      cada quien, eliges método y cobras esa parte. Cubre el **Escenario 1** (uno se va, la
      cuenta sigue abierta) y el **Escenario 2** (todos por separado). Métodos **efectivo** /
      **transferencia**, cada parte con el suyo. Sin propina (*pregunta 15*), sin impresora.
- [x] En efectivo: campo **"Efectivo recibido"** → el sistema muestra el **cambio a dar**
      (calculado sobre el monto **con la promoción aplicada**, no el precio de lista). Se
      rechaza si el efectivo no alcanza. `venta_pagos.recibido` / `.cambio` (migración 011).
- [x] **Cancelar cuenta abierta** (sin pagos) y **cancelar venta ya pagada** desde el
      **Historial de ventas** → queda marcada como *Cancelada* con motivo y regresa el
      inventario — *pregunta 17*.
- [x] **Recuperación**: todo vive en la BD desde el primer producto; al abrir la app los
      tickets abiertos siguen en el mapa — *documento §2*.
- **Tablas**: `mesas`, `ventas`, `venta_items`, `venta_item_modificadores`, `venta_item_opciones`,
  `venta_item_consumo`, `venta_pagos`. (Sin tabla de comensales: la división son solo los pagos, cada uno con su etiqueta.)
- **Permisos**: `ventas.*` (view/list/crear/cobrar/cancelar), `mesas.*`
- **Vistas**: `pos.js`, `ventaTicket.js`, `ventasHistorial.js`, `mesas.js`

---

## FASE 7 — Cancelaciones  ✅ HECHO (junto con FASE 6)
*(preguntas 16, 17)*

- [x] Cancelar producto de cuenta abierta → insumos regresan (`ventas.cancelarItem`).
- [x] Cancelar venta ya pagada desde el Historial → devuelve todo el inventario y queda
      marcada *Cancelada* con motivo (`ventas.cancelar`).
- [x] Cualquier usuario con `ventas.cancelar` puede hacerlo. Todo va a la bitácora
      (`ventas.item.cancel`, `ventas.cancelar`) y el historial lo muestra en rojo.

---

## FASE 8 — Promociones y descuentos  ✅ HECHO
*(Documento §3.6; preguntas 19-21; migración 008)*

- [x] **Combo**: *misma categoría* ("N productos de Frappés = $X" o "% off") o
      *productos específicos* ("Frappé Oreo + Latte, 15% off"). Precio fijo o porcentaje.
- [x] **Descuento por día**: % en una categoría o en ciertos productos, un día de la semana.
- [x] **Monto fijo**: −$X a la cuenta completa o a ciertos productos.
- [x] **Una sola por cuenta** — *pregunta 20*. Toda promoción con **fecha de inicio y fin** — *pregunta 21*.
- [x] Pantalla de administración (`#/promociones`, permiso `promociones.*`) — el formulario
      cambia según el tipo. **Solo quien tenga el permiso** (por defecto solo el admin) — *pregunta 19*.
- [x] En el ticket: botón **"Aplicar promoción"** → muestra las **vigentes hoy que además
      cumplen** las condiciones de esa cuenta, con el descuento calculado; el cajero elige una.
- [x] El descuento se **recalcula solo** al agregar/quitar productos; si la cuenta deja de
      cumplir, el ticket avisa "la promoción ya no aplica".
- [x] Al cobrar, el descuento se **absorbe** (en cobros divididos, en los primeros pagos).
      La venta guarda `promocion_id`, `promocion_nombre` y `descuento` (para reportes).
- **Tablas**: `promociones`, `promocion_productos`. Columnas nuevas en `ventas`
  (`promocion_id`, `promocion_nombre`, `descuento`) y `venta_pagos` (`descuento`).
- **Vista**: `promociones.js`. Lógica: `promocionService.js` (evaluador `calcular()`).

---

## FASE 9 — Corte de caja y cierre de día  ✅ HECHO
*(Documento §5 pregunta 18; migración 010)*

Pantalla `#/caja` (Ventas → Corte de caja). Dos partes:

### Turno de caja (el efectivo)
- [x] **Abrir turno** con el fondo inicial. Solo uno abierto a la vez.
- [x] **Movimientos**: ingresos y retiros de efectivo con concepto ("saqué $200 para servilletas").
- [x] **Cerrar turno (arqueo)**: efectivo esperado = fondo + ventas en efectivo del turno
      + ingresos − retiros. El cajero captura lo contado y el sistema muestra la **diferencia**.
- [x] **Cobrar en efectivo requiere turno abierto** (mensaje claro). Transferencia no.
      Cada pago queda ligado a su turno (`venta_pagos.corte_id`).
- [x] Historial de turnos con esperado / contado / diferencia.

### Cierre de día (congela los números)
- [x] Botón **"Cerrar día"** → guarda en `cierres_dia` los totales del día (ventas, ingreso,
      inversión, ganancia, efectivo, transferencia, merma) + `cierre_dia_productos` (por producto).
- [x] Requiere: **sin cuentas abiertas** y **sin turno de caja abierto**.
- [x] Un día cerrado **bloquea cobrar** en esa fecha (hasta reabrirlo, permiso `caja.cierre_dia`).
- [x] **Los reportes de periodos largos suman los días cerrados** (snapshot) y solo calculan
      en vivo los días abiertos → mucho más rápido y con números "oficiales" congelados.

- **Tablas**: `cortes_caja`, `caja_movimientos`, `cierres_dia`, `cierre_dia_productos`.
- **Permisos**: `caja.view` / `caja.turno` / `caja.cierre_dia`.
- **Servicios**: `cajaService.js`, `cierreService.js`. **Vista**: `caja.js`.

---

## FASE 10 — Reportes  ✅ HECHO
*(Documento §3.3; pregunta 22; migración 009)*

Pantalla `#/reportes` con selector de periodo (Hoy · Ayer · Semana · Mes · Trimestre ·
Semestre · Año · o rango personalizado) y 4 pestañas. **Solo cuentan las ventas pagadas**;
los productos cancelados no suman.

- [x] **Ganancias** (resumen): ventas, ingreso bruto, descuentos de promo, ingreso neto,
      **inversión (costo de insumos)**, **ganancia**, **margen %**, ticket promedio,
      desglose efectivo / transferencia, costo de merma, y tabla **por día**.
- [x] **Por producto**: unidades vendidas · ingreso · **inversión** · **ganancia** · margen %,
      con total. Ordenado por ganancia. (Es también "más vendidos" — *pregunta 22*, no por empleado.)
- [x] **Insumos más usados**: cantidad consumida y costo, por las ventas del periodo.
- [x] **Desglose de inversión** (a petición de la dueña): por cada producto vendido, qué
      insumos consumió su receta (× unidades) y su costo; al final, el **total de cada
      insumo usado en el periodo** y la inversión total. Exportable a PDF/Excel. Periodos:
      **día · semana · mes** (anual no).
- [x] **Merma**: costo por insumo y por motivo en el periodo.
- [x] **Exportar** cada reporte a **Excel (CSV con BOM)** y **PDF** (ventana oculta + `printToPDF`,
      sin dependencias). Botones ⬇ Excel / ⬇ PDF (permiso `reportes.export`).
- **Base**: `venta_item_consumo.costo_unitario` (nuevo) guarda el costo del insumo al momento
  de venderse. El descuento de promoción se reparte entre los renglones (proporcional al ingreso).
- **Servicios**: `reporteService.js`, `reportes/export.js`. **Vista**: `reportes.js`.

---

## FASE 11 — Diseño y marca
*(Documento §3.5)*

- [ ] Logo y colores de Beso de Café en toda la app
- [x] ~~Tarjetas de producto con foto grande (elegir "de un vistazo")~~ — **adelantado a FASE 4**
      (migración 015): la foto es obligatoria al dar de alta y el punto de venta ya pinta la
      tarjeta con la imagen. Aquí queda solo el pulido visual con la marca.
- [ ] Repaso de usabilidad, con foco en inventario
- **Depende de**: que las pantallas existan (se hace al final, sobre lo ya construido)
- **Hecho cuando**: la app se ve como Beso de Café y el menú se usa sin leer nombres.

---

## FASE 12 — Respaldos y resistencia a fallos
*(Documento §2)*

- [ ] Respaldo **automático y local** del archivo SQLite (carpeta aparte + rotación)
- [ ] Respaldo manual "hacer copia ahora"
- [ ] Restaurar desde un respaldo
- [ ] Verificación al arrancar de que la última orden abierta se puede recuperar
      (endurece lo hecho en FASE 6)
- **Permisos nuevos**: `respaldos.*`
- **Depende de**: todo lo anterior
- **Hecho cuando**: si se corrompe o se pierde la laptop, se recupera con un respaldo.

---

## Fases de calidad (pruebas)

Además del script de humo (`scratchpad/*.js`, herramienta de desarrollo), se agregan
**pruebas unitarias reales** por módulo, en `test/`, con el runner de Node (`node:test`).

- Corren con **`npm test`** (bajo el runtime de Electron por el módulo nativo).
- Cada prueba usa una **BD SQLite limpia** en un archivo temporal (migraciones aplicadas,
  un usuario mínimo). Aisladas y rápidas (~15 ms c/u).

| Módulo | Archivo | Estado |
|--------|---------|--------|
| Acceso: login, sesión, permisos por rol, escalada, bitácora | `test/seguridad/accesoYPermisos.test.js` | ✅ 22 |
| Inventario: matriz de permisos por canal | `test/seguridad/inventarioPermisos.test.js` | ✅ 8 |
| Inventario: categorías de insumos | `test/inventory/categoriaService.test.js` | ✅ 25 |
| Inventario: insumos y movimientos | `test/inventory/insumoService.test.js` | ✅ 58 |
| Inventario: existencia en negativo (faltantes) | `test/inventory/stockNegativo.test.js` | ✅ 8 |
| Menú: categorías de producto | `test/menu/productoCategoriaService.test.js` | ✅ 16 |
| Menú: modificadores y su receta | `test/menu/modificadorService.test.js` | ✅ 15 |
| Menú: productos, tamaños, precios, recetas, grupos de opción, **foto** | `test/menu/productoService.test.js` | ✅ 42 |
| Ventas: mesas | `test/ventas/mesaService.test.js` | ✅ 8 |
| Ventas: cuentas, cobro, cancelaciones, historial, **pasar a llevar** | `test/ventas/ventaService.test.js` | ✅ 41 |
| Promociones: CRUD + evaluador `calcular()` | `test/promociones/promocionService.test.js` | ✅ 19 |
| Promociones: aplicar/quitar en la venta, recálculo, cobro con descuento | `test/promociones/ventaPromociones.test.js` | ✅ 10 |
| Caja: turno, movimientos, arqueo | `test/caja/cajaService.test.js` | ✅ 13 |
| Cierre de día: congelar, bloqueos, reportes desde snapshot, reabrir | `test/caja/cierreService.test.js` | ✅ 9 |
| Reportes: resumen, por producto, insumos usados, merma, snapshot+vivo | `test/reportes/reporteService.test.js` | ✅ 15 |

**Total: 313 pruebas. Toda la lógica de negocio cubierta.**

Las pruebas de `test/seguridad/` corren contra la **capa IPC real** (`test/helpers/ipc.js`
sustituye `electron` por un doble y captura los canales que registra `registerIpc()`), así que
validan también la comprobación de sesión y permisos de `handle()`, no solo los servicios.

`inventarioPermisos.test.js` recorre la **matriz completa** del módulo: por cada canal comprueba
que sin el permiso se niega **y nada cambia en la base**, que con ese permiso (y ninguno más) sí
funciona, y que un permiso no abre la puerta del de al lado (`insumos.stock` no corrige costos,
`insumos.edit` no mueve existencias…).

---

## Respuestas del cliente  *(documento de respuestas, 2026-09-01)*

Todas las preguntas del alcance ya están contestadas. Resumen operativo:

| # | Respuesta | Fase |
|---|-----------|------|
| 1 | 7 categorías: Frappés, Sodas Italianas, Tisanas, Matcha, Cafés, Postres, Otros. ~40 productos (lista completa en el PDF de respuestas). | 4 |
| 2 | Un solo modificador: **Extra shot de espresso**. | 4 |
| 3 | El shot **suma un monto fijo** al total **y descuenta café** del inventario (tiene mini-receta). | 4, 5 |
| 4 | **Sí**, marcar producto agotado temporalmente (productos de temporada). | 4 |
| 5 | Lista real de insumos (ver recuadro en FASE 3). Unidades: piezas, g, ml. Café en grano se piensa en kg → compra en kg. | 3 ✅ modelo listo |
| 6 | **Sí**, la merma especifica motivo. | 3 ✅ hecho |
| 7 | **No** hay productos sin receta: todo se prepara en cafetería. | 4, 5 |
| 8 | Precio **editable**; las ventas anteriores y posteriores **conservan su precio**; el cambio **debe verse**. → historial de precios con vigencia. | 4, 6 |
| 9 | Los precios **ya incluyen IVA**. No se desglosa. | 4, 5, 6, 10 |
| 10 | Roles: **Administrador + 2 roles de cajero** (Cajero 1 y Cajero 2, con permisos distintos). | 1 ✅ (se crean en la app) |
| 11 | Los cajeros pueden **cancelar productos y ventas** y **cambiar el precio de productos**; ambas acciones **deben quedar visibles** al revisar ventas/productos. | 4, 7 |
| 12 | 3 usuarios: 1 administrador + 2 cajeros. | 1 ✅ |
| 13 | Órdenes en **caja y en mesa**. En mesa se paga al final → **tickets abiertos**, se pueden tener varios a la vez. | 6 |
| 14 | **Sí**, pedidos para llevar. | 6 |
| 15 | **No** se registra propina (se maneja aparte). | 6 |
| 16 | Al cancelar, **los insumos regresan al inventario** (no se usaron). | 7 |
| 17 | **Cualquier usuario** puede cancelar. Cancelar una venta ya realizada **se muestra al revisar las ventas**. | 7 |
| 18 | **Sí**, se necesita corte de caja. | 9 |
| 19 | **Solo el Administrador** crea/edita promociones, con total libertad. | 8 |
| 20 | **Una sola promoción** por pedido. | 8 |
| 21 | Las promociones **tienen fecha de inicio y fin**. | 8 |
| 22 | Reportes **por producto** solamente (no por empleado). | 10 |

**Fuera del documento (respuesta directa de la dueña):**
- **Tamaños de producto**: solo los **Frappés** manejan tamaño — **Chico** y **Grande**. Los demás
  productos tienen un solo tamaño. Cada tamaño tiene su propio precio y su propia receta.

---

## Cómo se agrega un módulo nuevo (receta corta)

1. Migración `00X_nombre.sql` en `src/main/db/migrations/` (tablas nuevas).
2. Agregar el módulo y sus permisos a `src/main/permissions/registry.js`.
3. `src/main/services/xxxService.js` con la lógica y validaciones.
4. Handlers en `src/main/ipc/index.js` con `handle(canal, { permission }, fn)` y `audit(...)`.
5. Métodos en `src/preload/index.js` (`window.api.xxx`).
6. Vista en `src/renderer/views/xxx.js` + ruta en `src/renderer/app.js`
   (una ruta con `:id`, ej. `#/productos/:id`, recibe el id como 2º argumento del render).
7. Si hay listado: usar `paginate(...)` y el componente `Pager`. Para filtros usar
   `components/filters.js`: `SearchBox` (búsqueda con icono), `Segmented` (chips en
   vez de `<select>` de un valor) y `sortableTh` (ordenar haciendo click en el
   encabezado de la columna). No usar `<select>` para filtros.
   Para elegir una entidad con muchas opciones (insumo, producto…) usar
   `components/combobox.js` `Combobox` (input con búsqueda estilo select2, sin dependencias).
8. Etiquetas de las acciones nuevas en `src/renderer/views/logs.js` (`ACTION_LABELS`).
9. Pruebas en el script de humo.
