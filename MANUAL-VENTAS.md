# Manual de usuario — Ventas

Beso de Café · Punto de venta y gestión interna

Este manual cubre **Punto de venta** (el mapa de mesas y la cuenta de cada una), **Mesas**
(cuántas hay y sus nombres) y **Historial de ventas**. Se lee igual que los anteriores: los
recuadros 🔑 dicen qué casilla de permisos hace aparecer cada botón.

> ℹ️ **Lo que NO está aquí.** Crear y editar **promociones** se explica en el manual de *Menú y
> recetas* (Parte 4) — este manual solo cubre cómo el cajero **la aplica** a una cuenta (ver
> **2.5**). Abrir y cerrar el **turno de caja** y el **corte de caja** tienen su propio manual
> aparte.

---

## Antes de empezar: cómo se organiza una venta

Todo lo que se vende pasa por una **cuenta**:

1. Se **abre** una cuenta — en una mesa, o "para llevar".
2. Se le **agregan productos** del catálogo, uno o varios, cada uno con su tamaño y sus extras.
3. Se **cobra** — de una vez o por partes.
4. Al terminar de cobrarse, la cuenta **se cierra sola** y pasa al historial.

Una cuenta también se puede **cancelar** en vez de cobrarse (por completo, o producto por
producto), y una mesa que se tiene que desocupar a medio servicio se puede **pasar a llevar** sin
perder lo ya pedido.

## Dónde está

Menú lateral → sección **Ventas**. Adentro hay tres pantallas que le tocan a este manual:
**Punto de venta**, **Historial de ventas** y **Mesas**.

## Los permisos de este módulo

```
☐ Ventas
    ☐ Abrir el punto de venta
    ☐ Ver el historial de ventas (pantalla aparte)
    ☐ Abrir cuentas y agregar productos
    ☐ Cobrar cuentas (completo o dividido)
    ☐ Cancelar productos y ventas

☐ Mesas
    ☐ Ver y configurar las mesas
    ☐ Agregar mesas
    ☐ Editar / renombrar mesas
    ☐ Dar de baja / reactivar mesas
```

**"Abrir el punto de venta" y "Ver el historial de ventas" son casillas separadas a propósito**:
una persona puede tener acceso a una pantalla y no a la otra. Por ejemplo, alguien que solo
audita ventas del día anterior no necesita poder vender.

> 💡 Un **cajero típico** lleva: **"Abrir el punto de venta"** + **"Abrir cuentas y agregar
> productos"** + **"Cobrar cuentas"** + **"Aplicar una promoción a una cuenta"** (del grupo
> Promociones). Si además va a poder cancelar productos mal cobrados, se le agrega **"Cancelar
> productos y ventas"**.

> ⚠️ **"Ver y configurar las mesas" es de administración, no de venta.** El cajero **no la
> necesita**: el mapa de mesas del punto de venta usa el permiso de Ventas, no este. Esta casilla
> es para quien decide cuántas mesas tiene la cafetería y cómo se llaman (ver **Parte 3**).

---

# Parte 1 · Punto de venta (mapa de mesas)

## 1.1 La pantalla

Menú → **Ventas** → **Punto de venta**.

📷 **`img-pos-001`** — Pantalla de "Punto de venta" con al menos una mesa libre, una ocupada y un
pedido para llevar abierto.
**Marcar con números:**
1. El botón **"+ Pedido para llevar"**.
2. Una tarjeta de mesa **libre** (dice *"Libre"*).
3. Una tarjeta de mesa **ocupada** (muestra el total acumulado y cuántos productos).
4. La sección **"Pedidos para llevar abiertos"**, con su tabla.

> 🔑 **Permiso de esta pantalla:** grupo **Ventas** → casilla **"Abrir el punto de venta"**.
> Sin ella, la pantalla no aparece en el menú.

Cada tarjeta de mesa dice si está libre u ocupada, y si está ocupada muestra el total acumulado y
cuántos productos lleva, **sin tener que entrar**.

## 1.2 Abrir o entrar a una cuenta

| Toco… | Y la mesa está… | Pasa |
|---|---|---|
| una mesa | libre | se abre una cuenta nueva en esa mesa |
| una mesa | ocupada | entro a la cuenta que ya tiene |
| **"+ Pedido para llevar"** | — | se abre una cuenta nueva "para llevar" |

Puedes tener **varias cuentas abiertas a la vez**: todas las mesas ocupadas, más todos los pedidos
para llevar que no se hayan cobrado. Cada pedido para llevar es su **propia** cuenta, aunque sean
del mismo cliente.

> 🔑 **Para abrir cuentas nuevas** hace falta además la casilla **"Abrir cuentas y agregar
> productos"**. Sin ella, tocar una mesa libre o "+ Pedido para llevar" avisa *"No tienes permiso
> para abrir cuentas"* — pero **sí puedes entrar a ver** una mesa ya ocupada, por si solo
> necesitas consultar.

---

# Parte 2 · La cuenta

## 2.1 La pantalla

Al abrir o entrar a una mesa, la pantalla se divide en dos: el **catálogo** a la izquierda y el
**ticket** de esa cuenta a la derecha.

📷 **`img-tk-001`** — Pantalla completa de una cuenta abierta con productos ya agregados.
**Marcar con números:**
1. **"← Punto de venta"** arriba a la izquierda.
2. El nombre de la mesa (o "Para llevar") y su estado.
3. Los botones **"🥤 Pasar a llevar"** / **"Cambiar de mesa"** (ver **2.7**).
4. El catálogo, con buscador y chips de categoría.
5. El ticket: renglones, totales y botones de acción.

## 2.2 El catálogo

Igual que en categorías e insumos, con muchos productos hace falta poder buscar:

📷 **`img-tk-002`** — El catálogo con el buscador y los chips de categoría.
**Marcar:**
1. El buscador **"Buscar producto…"**.
2. Los chips de categoría con su conteo (ej. *"Frappés (8)"*).
3. La **foto** de un producto — es lo primero que ve el cajero, antes que el nombre.
4. Un producto marcado **"Agotado"** (atenuado, no se puede tocar).

Al buscar, las categorías se juntan en una sola rejilla para no obligar a cambiar de chip.
Un producto **"Agotado"** no se puede agregar: se marcó así en Menú → Productos (ver el manual de
*Menú y recetas*, **3.2**).

## 2.3 Agregar un producto

Da clic en la tarjeta del producto.

📷 **`img-tk-003`** — Ventana "Agregar: Frappé Oreo" con tamaño, grupo de opción, modificador y
cantidad.
**Marcar con números:**
1. Los botones de **tamaño** (si el producto tiene más de uno), cada uno con su precio.
2. Un **grupo de opción** (ej. "Leche") con sus botones — **no es un desplegable**: se ve todo de
   un vistazo, como los tamaños.
3. Un **modificador** con su casilla y precio extra (ej. *"Extra shot de espresso (+$15.00)"*).
4. Los campos **"Cantidad"** y **"Para llevar"**.
5. El total de abajo, que se actualiza solo.

| Campo | Cómo funciona |
|---|---|
| **Tamaño** | Si el producto solo tiene uno, no se pregunta |
| **Grupo de opción** | Trae marcada la opción predeterminada de la receta; se puede cambiar |
| **Modificadores** | Ninguno viene marcado. Cada uno que marques suma su precio al total |
| **Cantidad** | De 1 a 20. El total de abajo multiplica automáticamente |
| **Para llevar** | Viene marcada sola si la cuenta ya es "para llevar". Decide si se consume el vaso desechable de la receta (ver el manual de *Menú y recetas*, **3.7**) |

> 💡 **Cambiar de tamaño no borra lo elegido en los grupos de opción.** Si ya elegiste "Leche
> deslactosada" en el tamaño Chico y cambias a Grande, sigue en deslactosada (si ese tamaño
> también la ofrece).

Da clic en **"Agregar a la cuenta"**. Aparece *"Agregado"* y el renglón se suma al ticket.

### Si el insumo se queda sin existencia

La venta **nunca se detiene** por falta de inventario, pero si algo quedó en negativo, el sistema
avisa en ese mismo momento:

> *"⚠ Oreo quedó en −3 pieza. Falta registrar una compra o hacer conteo."*

Es el mismo caso que el manual de *Inventario* explica en **4.3**: alguien tiene que registrar la
entrada que falta o hacer un conteo físico. El producto se vende igual.

## 2.4 El ticket

📷 **`img-tk-004`** — El ticket con dos productos, uno con modificador y otro cancelado.
**Marcar con números:**
1. Un renglón normal: nombre, tamaño, extras en gris debajo.
2. La etiqueta **"llevar"** en un renglón servido para llevar.
3. La etiqueta **"pagado"** en un renglón ya cobrado.
4. La **✕** para cancelar un renglón (solo si no está pagado).
5. Un renglón **cancelado**, tachado, con su motivo.

Cada renglón muestra el producto, su tamaño (si no es "Único"), y debajo en gris los
modificadores y las opciones elegidas.

### Cancelar un producto de la cuenta

Da clic en la **✕** del renglón. Se pide un motivo (opcional) y se confirma con **"Cancelar
producto"**.

> 🔑 **Permiso:** grupo **Ventas** → casilla **"Cancelar productos y ventas"**. Sin ella no
> aparece la ✕.

Sus insumos **regresan al inventario** y el total de la cuenta baja. Solo se puede cancelar un
producto que **no esté pagado**: uno ya cobrado no tiene ✕ (ver **2.8** para cancelar una cuenta
completa, incluida una ya pagada).

## 2.5 Aplicar o quitar una promoción

Si la cuenta tiene productos y todavía no tiene pagos, aparece el botón **"Aplicar promoción"**.

> 🔑 **Permiso:** grupo **Promociones** → casilla **"Aplicar una promoción a una cuenta"**. Es la
> única casilla de Promociones que necesita alguien que solo cobra.

Se muestran solo las promociones que están vigentes hoy **y** que esa cuenta cumple, cada una con
su descuento ya calculado. Se elige **"Usar"** en la que convenga. El ticket entonces desglosa
**Subtotal**, la línea verde **"Promo: …"** con el descuento y un botón **"quitar"**, y el
**Total** ya rebajado.

📷 **`img-tk-005`** — El ticket con una promoción aplicada.
**Marcar:** la línea verde "Promo: …", el botón "quitar" y el Total rebajado.

Solo se puede **una promoción por cuenta**, y solo mientras **no tenga pagos** — una vez que se
cobró algo (aunque sea una parte), ya no se puede cambiar ni quitar. El detalle completo de cómo
se arma cada tipo de promoción está en el manual de *Menú y recetas*, **Parte 4**.

## 2.6 Cobrar

### Cobrar todo de una vez

Da clic en **"Cobrar todo · $X"**.

📷 **`img-tk-006`** — Ventana "Cobrar todo" en efectivo, con el cambio calculado.
**Marcar con números:**
1. Los botones de método: **Efectivo** / **Transferencia**.
2. El campo **"Efectivo recibido"** (solo aparece con Efectivo).
3. La línea de abajo: **"Cambio a dar: $X"** o **"Faltan $X"** en rojo.

| Campo | Cómo funciona |
|---|---|
| **Método** | Efectivo o Transferencia |
| **Efectivo recibido** | Solo si es efectivo. Vacío = pago exacto, sin cambio. Si escribes menos de lo que se cobra, el sistema te avisa **antes** de confirmar: *"Faltan $X"* en rojo |

> 🔑 **Permiso:** grupo **Ventas** → casilla **"Cobrar cuentas (completo o dividido)"**.

Al confirmar, aparece *"Cobrado. Cambio a dar: $X"* (o *"Cobrado. Cuenta cerrada."* si fue exacto
o por transferencia) y regresas al mapa de mesas: la cuenta ya está pagada y en el historial.

### Cobrar por partes / dividir

Si hay más de un producto sin pagar, aparece **"Cobrar por partes / dividir"**.

📷 **`img-tk-007`** — Ventana "Dividir cuenta" con dos productos marcados de cuatro.
**Marcar con números:**
1. La lista de productos con casilla, cada uno marcable por separado.
2. El renglón **"A cobrar"**, que suma solo lo marcado.
3. El campo **"Etiqueta"** (ej. *"Comensal 1"*), opcional.
4. El botón **"Cobrar seleccionados"**.

Se marca lo que consumió cada persona, se elige método, y se cobra. La ventana **no se cierra**:
se queda abierta para cobrar a la siguiente persona, hasta que no quede nada pendiente — entonces
la cuenta se cierra sola.

> 💡 **Si la cuenta tiene una promoción aplicada**, el descuento se reparte entre los primeros
> pagos: el renglón "A cobrar" muestra *"$X (de $Y, con promo)"* cuando ese pago absorbe parte del
> descuento.

## 2.7 Pasar a llevar / cambiar de mesa

Cuando una mesa se tiene que ir a media cuenta, no hace falta cancelar nada: la cuenta se
**convierte** sin perder lo ya pedido.

📷 **`img-tk-008`** — El aviso de confirmación "Pasar la cuenta a llevar".
**Marcar:** el texto que dice cuántos productos cambian de vaso.

| Botón | Cuándo aparece | Qué hace |
|---|---|---|
| **"🥤 Pasar a llevar"** | Cuenta en mesa | La mesa queda libre. Los productos servidos "aquí" pasan a vaso desechable — el inventario se ajusta solo, consumiendo el vaso que faltaba |
| **"Cambiar de mesa"** | Cuenta en mesa, hay otra mesa libre | Mueve la cuenta completa a otra mesa, sin tocar el inventario |
| **"Sentar en una mesa"** | Cuenta para llevar, hay mesa libre | Convierte el pedido para llevar en una cuenta de mesa. Si algún producto se sirvió para llevar, sus vasos **regresan** al inventario |

Solo se puede mover una cuenta **abierta**; una mesa que ya tiene su propia cuenta abierta no
aparece como destino — hay que cobrarla o moverla primero.

## 2.8 Cancelar una cuenta

Si la cuenta todavía no tiene ningún pago, aparece **"Cancelar cuenta"** en rojo.

📷 **`img-tk-009`** — Ventana "Cancelar cuenta #N".
**Marcar:** el texto que dice que los insumos regresan al inventario.

> 🔑 **Permiso:** grupo **Ventas** → casilla **"Cancelar productos y ventas"**.

Todos sus productos se cancelan, los insumos regresan al inventario, y la cuenta queda marcada
como **Cancelada** en el historial. Si la cuenta **ya tiene pagos parciales**, este botón no
aparece — hay que cancelar producto por producto (ver **2.4**) o terminar de cobrarla. Para
cancelar una cuenta que **ya se pagó por completo**, se hace desde el historial (ver **4.3**).

---

# Parte 3 · Mesas

## 3.1 La pantalla

Menú → **Ventas** → **Mesas**.

📷 **`img-mesa-001`** — Pantalla de "Mesas" con varias, alguna ocupada y alguna de baja.
**Marcar con números:**
1. El texto gris de arriba.
2. Los botones **"+ Agregar varias"** y **"+ Mesa"**.
3. La columna **"Estado"** con **"Ocupada"** / **"Libre"**.
4. Los botones **"Renombrar"** y **"Baja"** / **"Reactivar"**.

> 🔑 **Permisos de esta pantalla.** Todos están en el grupo **Mesas**:
>
> | Para… | Hay que marcar la casilla |
> |---|---|
> | Ver la pantalla y la tabla | **"Ver y configurar las mesas"** |
> | Ver **"+ Mesa"** / **"+ Agregar varias"** | **"Agregar mesas"** |
> | Ver **"Renombrar"** | **"Editar / renombrar mesas"** |
> | Ver **"Baja"** / **"Reactivar"** | **"Dar de baja / reactivar mesas"** |

## 3.2 Crear mesas

**Una por una:** clic en **"+ Mesa"**, escribe el nombre (ej. *"Mesa 7"*, *"Terraza 1"*,
*"Barra"*) y **"Crear"**.

**Varias de golpe:** clic en **"+ Agregar varias"**.

📷 **`img-mesa-002`** — Ventana "Agregar varias mesas".
**Marcar:** el campo con su texto *"Se crean como Mesa N+1, Mesa N+2…"*.

Escribe cuántas (de 1 a 50) y se crean numeradas a partir de la última mesa que exista. Útil para
armar de golpe las mesas al configurar el sistema por primera vez.

Los nombres **no se pueden repetir**: *"Ya existe una mesa con ese nombre."*

## 3.3 Dar de baja una mesa

Clic en **"Baja"** y confirma.

Una mesa **con una cuenta abierta no se puede dar de baja**: *"La mesa tiene una cuenta abierta.
Ciérrala primero."* Una vez de baja, deja de ofrecerse en el punto de venta pero se conserva y se
puede reactivar.

---

# Parte 4 · Historial de ventas

## 4.1 La pantalla

Menú → **Ventas** → **Historial de ventas**.

📷 **`img-hist-001`** — Pantalla de "Historial de ventas" con ventas pagadas, una con promoción, y
una cancelada.
**Marcar con números:**
1. El buscador **"Buscar (#, mesa, usuario)…"** y los chips **"Todas · Pagadas · Canceladas"**.
2. La columna **"Total"**, con la línea verde **"promo: … −$X"** debajo cuando aplicó una.
3. La columna **"Pago"** con el método.
4. Una fila **Cancelada**, atenuada.
5. Los botones **"Ver"** y **"Cancelar venta"**.

> 🔑 **Permiso de esta pantalla:** grupo **Ventas** → casilla **"Ver el historial de ventas
> (pantalla aparte)"**. Es independiente de "Abrir el punto de venta": se puede tener una sin la
> otra.

La columna **"Total"** siempre muestra **lo que de verdad se cobró** (ya con la promoción
restada, si hubo). El buscador encuentra por número de cuenta, nombre de mesa o usuario que
cobró.

## 4.2 Ver el detalle de una venta

Clic en **"Ver"**.

📷 **`img-hist-002`** — Ventana "Venta #N" de una venta con promoción aplicada y dos pagos.
**Marcar con números:**
1. La línea de arriba: mesa/para llevar, usuario y fecha.
2. La tabla de productos, con uno cancelado tachado si lo hay.
3. El desglose **Subtotal / Promo: … / Total** cuando la venta llevó promoción.
4. La sección **"Pagos"**, con método, etiqueta y el cambio dado si fue en efectivo.

Si la venta **no** llevó promoción, el desglose se simplifica a un solo renglón **"Total"** — no
aparecen "Subtotal" ni "Promo" de más.

Una venta **cancelada** muestra además el motivo en un recuadro rojo arriba: *"Cancelada: …"*.

## 4.3 Cancelar una venta ya pagada

Solo para ventas con estado **Pagada**. Clic en **"Cancelar venta"**.

📷 **`img-hist-003`** — Ventana "Cancelar venta pagada #N".
**Marcar:** el texto de que el dinero se devuelve por fuera del sistema.

> 🔑 **Permiso:** grupo **Ventas** → casilla **"Cancelar productos y ventas"** — la misma que
> cancela productos y cuentas abiertas (ver **2.4** y **2.8**).

Aquí el **motivo es obligatorio** (a diferencia de cancelar desde la cuenta abierta, donde es
opcional): una venta ya cobrada es más delicada, así que el sistema exige que quede por escrito
por qué. Al confirmar:

- todos sus productos regresan sus insumos al inventario;
- la venta queda marcada **Cancelada** en el historial, **sin borrarse**;
- **el dinero se devuelve por fuera** — el sistema no maneja reembolsos ni toca la caja. Es una
  anotación contable, no una transacción.

---

# Parte 5 · Mensajes que puedes ver

| Mensaje | Qué pasó |
|---|---|
| *"No tienes permiso para abrir cuentas"* | Te falta "Abrir cuentas y agregar productos" |
| *"Elige una mesa."* | Intentaste abrir una cuenta de mesa sin elegir cuál |
| *"La mesa no existe o está dada de baja."* | La mesa se dio de baja o borró mientras tanto |
| *"La cuenta no existe."* | La cuenta ya no está (poco común; refresca la pantalla) |
| *"La cuenta ya está cerrada."* | Intentaste modificar una cuenta ya pagada o cancelada |
| *"El producto o tamaño no existe."* / *"El tamaño del producto no existe."* | El producto cambió o se borró mientras armabas el pedido |
| *""X" está dado de baja.* / *marcado como agotado.* / *no tiene precio."* | El producto o tamaño dejó de estar disponible justo antes de agregarlo |
| *"⚠ X quedó en −N unidad. Falta registrar una compra o hacer conteo."* | El insumo de la receta se fue a negativo (ver **2.3**) |
| *"El producto no existe en esta cuenta."* / *"Ese producto ya estaba cancelado."* / *"…ya está pagado; no se puede cancelar."* | Intentaste cancelar un renglón que ya no se puede tocar |
| *"La cuenta ya tiene pagos; no se puede cambiar/quitar la promoción."* | Ya se cobró algo; la promoción queda fija |
| *"La promoción no está vigente hoy."* / *"Esta cuenta no cumple las condiciones de la promoción."* | La promoción dejó de aplicar entre que la viste y la usaste |
| *"Método de pago no válido."* | Error de datos, no debería pasar desde la pantalla normal |
| *"El día de hoy ya está cerrado. Reábrelo desde Corte de caja para poder cobrar."* | El corte del día ya se cerró — ningún método de pago funciona hasta reabrirlo |
| *"Abre el turno de caja (Ventas → Corte de caja) antes de cobrar en efectivo."* | Nadie ha abierto el turno hoy. Solo bloquea **efectivo**; transferencia si funciona |
| *"Elige al menos un producto para cobrar."* | En "Dividir cuenta", intentaste cobrar sin marcar nada |
| *"Un producto seleccionado está cancelado."* / *"…ya estaba pagado."* | Alguien más cobró o canceló ese renglón justo antes que tú |
| *"El efectivo recibido (X) no alcanza. Faltan Y."* | El efectivo que escribiste es menor a lo que se cobra |
| *"La venta ya está cancelada."* | Ya se había cancelado |
| *"La cuenta tiene pagos parciales. Cancela producto por producto o termina de cobrarla."* | No se puede cancelar la cuenta completa con pagos a medias |
| *"El nombre de la mesa es obligatorio."* | Nombre de mesa vacío |
| *"Ya existe una mesa con ese nombre."* | Nombre de mesa repetido |
| *"La mesa tiene una cuenta abierta. Ciérrala primero."* | Intentaste dar de baja una mesa ocupada |
| *"No tienes permiso para realizar esta acción."* | Te falta el permiso de esa acción |

---

# Anexo · Lista de capturas

Prefijos: `img-pos-` Punto de venta (mapa) · `img-tk-` la cuenta / ticket · `img-mesa-`
configuración de Mesas · `img-hist-` Historial de ventas.

## Punto de venta

| Referencia | Qué capturar | Qué marcar |
|---|---|---|
| `img-pos-001` | Mapa de mesas con libre, ocupada y para llevar | ① "+ Pedido para llevar" ② mesa libre ③ mesa ocupada ④ sección "Pedidos para llevar abiertos" |

## La cuenta

| Referencia | Qué capturar | Qué marcar |
|---|---|---|
| `img-tk-001` | Pantalla completa de una cuenta abierta | ① "← Punto de venta" ② nombre de mesa y estado ③ botones Pasar a llevar/Cambiar de mesa ④ catálogo ⑤ ticket |
| `img-tk-002` | El catálogo con buscador y chips | ① buscador ② chips con conteo ③ foto del producto ④ producto Agotado |
| `img-tk-003` | Ventana "Agregar" con tamaño, grupo y modificador | ① botones de tamaño ② grupo de opción ③ modificador ④ Cantidad/Para llevar ⑤ total |
| `img-tk-004` | Ticket con un producto normal y uno cancelado | ① renglón normal ② etiqueta "llevar" ③ etiqueta "pagado" ④ ✕ ⑤ renglón cancelado |
| `img-tk-005` | Ticket con promoción aplicada | Línea verde "Promo: …", botón "quitar" y Total rebajado |
| `img-tk-006` | Ventana "Cobrar todo" en efectivo | ① método ② Efectivo recibido ③ línea de cambio |
| `img-tk-007` | Ventana "Dividir cuenta" con productos marcados | ① lista con casillas ② "A cobrar" ③ Etiqueta ④ "Cobrar seleccionados" |
| `img-tk-008` | Aviso "Pasar la cuenta a llevar" | El texto de cuántos productos cambian de vaso |
| `img-tk-009` | Ventana "Cancelar cuenta" | El texto de que los insumos regresan |

## Mesas

| Referencia | Qué capturar | Qué marcar |
|---|---|---|
| `img-mesa-001` | Pantalla de Mesas con ocupada y de baja | ① texto gris ② "+ Agregar varias"/"+ Mesa" ③ columna Estado ④ Renombrar/Baja |
| `img-mesa-002` | Ventana "Agregar varias mesas" | El campo y su texto de numeración |

## Historial de ventas

| Referencia | Qué capturar | Qué marcar |
|---|---|---|
| `img-hist-001` | Historial con pagadas (una con promo) y una cancelada | ① buscador y chips ② Total con línea de promo ③ Pago ④ fila cancelada ⑤ Ver/Cancelar venta |
| `img-hist-002` | Ventana "Venta #N" con promoción y dos pagos | ① encabezado ② tabla de productos ③ desglose Subtotal/Promo/Total ④ sección Pagos |
| `img-hist-003` | Ventana "Cancelar venta pagada" | El texto de que el dinero se devuelve por fuera |

> 💡 **Para las capturas:** usa una cuenta de mesa con al menos dos productos (uno con
> modificador, otro con grupo de opción) para `img-tk-001` a `img-tk-005`, y cóbrala con
> promoción para que `img-hist-001`/`002` salgan completas. Para `img-tk-008` necesitas una mesa
> con algo servido "aquí" (no para llevar) antes de pasarla.
