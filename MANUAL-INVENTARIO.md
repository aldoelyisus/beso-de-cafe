# Manual de usuario — Inventario

Beso de Café · Punto de venta y gestión interna

Este manual cubre **Categorías de insumos**, **Insumos** y **Existencias** (compras, merma,
conteo físico y corrección de costo). Se lee igual que el manual de Usuarios y Roles: los
recuadros 🔑 dicen qué casilla de permisos hace aparecer cada botón.

---

## Antes de empezar: qué es un insumo

Un **insumo** es todo lo que se gasta para preparar lo que vendes: café en grano, leche, jarabe
de vainilla, galletas Oreo, vasos para llevar, charolas.

El inventario hace tres cosas por ti:

1. **Lleva la existencia** de cada insumo. Cuando vendes un frappé, su receta descuenta sola la
   leche, la base y el vaso. No tienes que restar nada a mano.
2. **Calcula cuánto te cuesta** cada insumo, aunque lo compres a precios distintos en tiendas
   distintas.
3. **Te avisa** cuando algo se está acabando, o cuando salió mercancía que nunca registraste.

> ⚠️ **El orden importa.** Primero das de alta los insumos, luego armas las recetas de los
> productos (manual de Menú), y hasta entonces puedes vender. Sin insumos no hay receta, y sin
> receta el sistema no sabe qué descontar.

## Dónde está

Menú lateral → sección **Catálogo** → **Inventario**. Adentro hay dos opciones:
**Insumos** y **Categorías de insumos**.

> ℹ️ **"Inventario" no tiene casilla propia.** El grupo aparece en el menú en cuanto la persona
> puede ver Insumos o Categorías de insumos (o las dos).

## Los permisos de este módulo

En la lista de permisos vas a encontrar dos grupos:

```
☐ Insumos
    ☐ Ver el módulo y el listado de insumos
    ☐ Crear insumos
    ☐ Editar insumos
    ☐ Dar de baja insumos
    ☐ Registrar entradas, merma y ajustes de existencias
    ☐ Corregir a mano el costo de un insumo

☐ Categorías de insumos
    ☐ Ver el módulo y el listado de categorías de insumos
    ☐ Crear categorías de insumos
    ☐ Editar categorías de insumos
    ☐ Dar de baja / reactivar categorías de insumos
```

Los dos últimos de **Insumos** son **permisos especiales**: no vienen incluidos en "Editar".

- **"Registrar entradas, merma y ajustes de existencias"** — es para quien **recibe mercancía**
  y hace conteos. No le da poder sobre los precios.
- **"Corregir a mano el costo de un insumo"** — es para quien **decide cuánto vale** cada cosa.
  Normalmente solo la dueña.

> 💡 Un almacenista típico lleva **"Ver el módulo y el listado de insumos"** + **"Registrar
> entradas, merma y ajustes de existencias"**, y nada más. Recibe la mercancía y registra lo que
> se pierde, pero no toca costos ni crea insumos nuevos.

---

# Parte 1 · Categorías de insumos

## 1.1 Para qué sirven

Las categorías ordenan la lista (Café, Lácteos, Jarabes, Desechables…) y **te ahorran un
paso**: cada categoría trae una **unidad sugerida**, y cuando das de alta un insumo en esa
categoría, el formulario te propone esa unidad solo.

El sistema ya viene con estas diez:

| Categoría | Unidad sugerida | Ejemplos |
|---|---|---|
| Café | Gramos | Café en grano, café soluble |
| Lácteos | Mililitros | Leche entera, deslactosada |
| Jarabes | Mililitros | Vainilla, caramelo, chai |
| Salsas y coberturas | Mililitros | Hershey's, Hershey's fresa |
| Bases y polvos | Gramos | Base para frappé, azúcar, cocoa |
| Toppings y complementos | Piezas | Chantilly, mazapán, galletas Oreo |
| Aguas y mixers | Mililitros | Agua mineral, agua de coco |
| Tisanas e infusiones | Gramos | Tisanas |
| Repostería | Gramos | Harina |
| Desechables | Piezas | Vasos, charolas |

> ℹ️ La unidad sugerida **solo propone**. Al crear el insumo la puedes cambiar sin problema.

## 1.2 La pantalla

Menú → **Inventario** → **Categorías de insumos**.

📷 **`img-invcat-001`** — Pantalla completa de "Categorías de insumos".
**Marcar con números:**
1. El texto gris de arriba, que explica qué pasa al dar de baja una categoría.
2. El botón **"+ Nueva categoría"**.
3. El buscador **"Buscar categoría…"** y los botones de filtro por unidad (**Todas · ml · g · pza**).
4. La columna **"Insumos"** (cuántos insumos usan esa categoría).
5. Los botones **"Editar"** y **"Baja"** de un renglón.

> 🔑 **Permisos de esta pantalla.** Todos están en el grupo **Categorías de insumos**:
>
> | Para… | Hay que marcar la casilla |
> |---|---|
> | Ver la pantalla y la tabla | **"Ver el módulo y el listado de categorías de insumos"** |
> | Ver el botón **"+ Nueva categoría"** | **"Crear categorías de insumos"** |
> | Ver el botón **"Editar"** | **"Editar categorías de insumos"** |
> | Ver **"Baja"** / **"Reactivar"** | **"Dar de baja / reactivar categorías de insumos"** |

Puedes **ordenar** la tabla dando clic en el encabezado **"Categoría"** (A–Z / Z–A) o
**"Insumos"** (más usadas primero). La tabla muestra 15 renglones por página.

## 1.3 Crear o editar una categoría

Da clic en **"+ Nueva categoría"** (o en **"Editar"** de un renglón).

📷 **`img-invcat-002`** — Ventana "Nueva categoría de insumo".
**Marcar:**
1. El campo **"Nombre"**.
2. El desplegable **"Unidad sugerida"** y su texto de ayuda.

| Campo | Notas |
|---|---|
| **Nombre** | Obligatorio. No se puede repetir, **y el sistema no distingue mayúsculas ni acentos**: si ya existe "Café", no te deja crear "café", "CAFÉ" ni "Cafe". Así no terminas con dos categorías que en pantalla se leen igual |
| **Unidad sugerida** | Mililitros, Gramos o Piezas |

Da clic en **"Crear"** (o **"Guardar"**). Aparece *"Categoría creada"* (o *"Categoría
actualizada"*).

## 1.4 Dar de baja una categoría

Da clic en **"Baja"** y confirma en la ventana *"¿Dar de baja la categoría…?"*.

📷 **`img-invcat-003`** — La tabla con una categoría ya dada de baja.
**Marcar:**
1. La etiqueta **"Baja"** en la columna Estado.
2. El botón, que ahora dice **"Reactivar"**.

**Qué pasa con los insumos que ya la usaban:** nada. **La conservan.** La categoría solo deja de
ofrecerse al dar de alta insumos **nuevos**. Nada se borra y se puede reactivar cuando quieras.

---

# Parte 2 · Insumos

## 2.1 La pantalla

Menú → **Inventario** → **Insumos**.

📷 **`img-ins-001`** — Pantalla completa de "Insumos" con varios insumos, al menos uno "Bajo" y
uno con faltante.
**Marcar con números:**
1. El aviso de arriba (**"⛔ N insumo(s) con faltante · ⚠ N insumo(s) por acabarse"**).
2. El botón **"+ Nuevo insumo"**.
3. El buscador, el interruptor **"Por acabarse"** y la fila de categorías.
4. La columna **"Existencia"** con una etiqueta **"Bajo"** y una **"Faltan N"** (roja).
5. La columna **"Costo unitario"**.
6. Los botones **"Existencias"**, **"Editar"** y **"Baja"** de un renglón.

Lo que muestra cada columna:

| Columna | Qué muestra |
|---|---|
| **Insumo** | El nombre y, debajo en gris, cómo se compra (ej. *"compra: Kilo (×1000 g)"*) |
| **Categoría** | La suya, o *"Sin categoría"* |
| **Existencia** | Cuánto hay, **en la unidad base**. Con etiqueta si hace falta atención |
| **Mínimo** | Debajo de esta cantidad, el sistema te avisa |
| **Costo unitario** | Lo que te cuesta **cada** gramo, mililitro o pieza |
| **Estado** | Activo o Baja |

> 🔑 **Permisos de esta pantalla.** Todos están en el grupo **Insumos**:
>
> | Para… | Hay que marcar la casilla |
> |---|---|
> | Ver la pantalla y la tabla | **"Ver el módulo y el listado de insumos"** |
> | Ver el botón **"+ Nuevo insumo"** | **"Crear insumos"** |
> | Ver el botón **"Editar"** | **"Editar insumos"** |
> | Ver **"Baja"** / **"Reactivar"** | **"Dar de baja insumos"** |
> | Ver el botón **"Existencias"** | **"Registrar entradas, merma y ajustes de existencias"** |

### Las dos etiquetas de alerta

| Etiqueta | Qué significa | Qué hacer |
|---|---|---|
| **Bajo** | Te queda menos del mínimo que pusiste | Comprar pronto |
| **Faltan N** *(roja)* | La existencia está **en negativo**: salió más de lo que había registrado | Ver **4.3 Faltantes** |

Son cosas distintas y por eso se ven distinto. "Bajo" es normal en el día a día; "Faltan" quiere
decir que **hay algo que no se registró**.

## 2.2 La idea clave: unidad base y presentación de compra

Esto es lo que más cuesta entender del inventario, así que va antes de dar de alta nada.

Cada insumo se maneja con **dos medidas**:

| | Qué es | Ejemplo con el café en grano |
|---|---|---|
| **Unidad base** | La medida en que **se gasta**. Con ella se escriben las recetas y se lleva la existencia | **Gramos** — un espresso lleva 9 g |
| **Presentación de compra** | La medida en que **se compra** | **Kilo** — la bolsa del proveedor |

Y el puente entre las dos es **"Rinde"**: cuántas unidades base trae una compra.

```
1 Kilo  =  1000 gramos        →  Rinde: 1000
1 Litro =  1000 mililitros    →  Rinde: 1000
1 Paquete de Oreo = 24 piezas →  Rinde: 24
1 Cono de huevo   = 30 piezas →  Rinde: 30
```

**¿Por qué así?** Porque tú compras por kilo, pero la receta gasta por gramos. Con el "Rinde",
cuando registras que compraste **2 kilos**, el sistema suma **2000 gramos** a la existencia, y
cuando la receta pide **9 gramos**, resta exactamente eso.

> ⚠️ **Elige bien la unidad base desde el principio.** Una vez que el insumo tiene existencia,
> movimientos o aparece en alguna receta, **ya no se puede cambiar** (ver **2.5**).

**Cuál elegir:**

| Si el insumo… | Unidad base |
|---|---|
| se pesa (café, azúcar, fruta, harina) | **Gramos** |
| se mide en líquido (leche, jarabes, salsas) | **Mililitros** |
| se cuenta (vasos, galletas, huevos, charolas) | **Piezas** |

> 💡 Si en una receta vas a usar **media** pieza (medio huevo), no hay problema: el sistema acepta
> decimales. Escribe `0.5`.

## 2.3 Dar de alta un insumo

**Paso 1.** Da clic en **"+ Nuevo insumo"**.

📷 **`img-ins-002`** — Ventana "Nuevo insumo", parte de arriba.
**Marcar con números:**
1. **Nombre del insumo**
2. **Categoría**
3. **Unidad base (stock y recetas)**

**Paso 2.** Escribe el **nombre** y elige la **categoría**. Al elegir la categoría, el sistema
te propone su unidad sugerida en **"Unidad base"**. Cámbiala si no te sirve.

> ℹ️ **El nombre no se puede repetir**, igual que en categorías: no distingue mayúsculas, acentos
> ni espacios de más. Si ya existe "Café en grano", tampoco te deja "café en grano". Esto evita el
> error más caro del inventario: dos fichas para lo mismo, con la existencia partida en dos.
> Si el que existe está dado de baja, el mensaje te dice que lo **reactives** en vez de crear otro.

**Paso 3.** Elige **cómo se compra**.

📷 **`img-ins-003`** — Sección "Presentación de compra" de la misma ventana.
**Marcar con números:**
1. Los botones **"Suelto · Por kilo · Por litro · Otra presentación"**.
2. Los campos **"¿Cómo se compra?"** y **"Rinde (en unidad base)"**.
3. El campo **"Costo de compra"**.
4. La línea gris de abajo que calcula el costo por unidad (ej. *"Costo por g: $0.3000"*).

Los botones son atajos que llenan los campos por ti:

| Botón | Úsalo cuando… | Llena |
|---|---|---|
| **Suelto** | Lo compras por la misma unidad en que lo gastas (vasos sueltos) | Rinde = 1 |
| **Por kilo** *(solo con gramos)* | Lo compras por kilo | "Kilo", Rinde = 1000 |
| **Por litro** *(solo con mililitros)* | Lo compras por litro | "Litro", Rinde = 1000 |
| **Otra presentación** | Viene en paquete, bolsa, cono… | Tú escribes el nombre y cuánto rinde |

**Ejemplo con "Otra presentación":** las galletas Oreo vienen en paquete de 24.
- **¿Cómo se compra?:** `Paquete 24`
- **Rinde:** `24`
- **Costo de compra:** `30` (lo que pagas por el paquete)

La línea gris te confirma: *"Costo por pza: $1.2500 · 1 Paquete 24 = 24 pza"*.

**Paso 4.** Llena lo último.

📷 **`img-ins-004`** — Parte de abajo de la ventana, **con cantidades ya escritas** para que se
vean los textos que calcula solos.
**Marcar:**
1. **"¿Cuánto tienes ahora?"** y la línea gris de abajo (*"Van a entrar 3,000 g (3 × 1,000 g que
   rinde cada Kilo)"*).
2. **"Avísame cuando queden menos de…"** y su línea gris (*"Te avisa cuando queden menos de 500 g
   (0.5 Kilo)"*).

| Campo | Cuidado con… |
|---|---|
| **Costo de compra** | Lo que pagas **por una presentación completa** (el kilo, el paquete), no por gramo |
| **¿Cuánto tienes ahora?** | Se cuenta **en presentaciones de compra**: si tienes 3 kilos, escribe `3`, no `3000` |
| **Avísame cuando queden menos de…** | Se cuenta **en unidad base**: para avisarte con menos de medio kilo, escribe `500` |
| **Notas** | Opcional |

> ✅ **No tienes que adivinar cuál va en cuál.** Debajo de cada uno de esos dos campos, el sistema
> te dice en vivo en qué se convierte lo que escribiste: *"Van a entrar 3,000 g"*, *"Te avisa
> cuando queden menos de 500 g (0.5 Kilo)"*. **Léelo antes de guardar**: ahí se ve de inmediato si
> te equivocaste de unidad. (Son medidas distintas a propósito: la existencia la cuentas por
> bolsas, la alerta la piensas en lo que gastas.)

**Paso 5.** Da clic en **"Crear insumo"**. Aparece *"Insumo creado"*.

> ℹ️ Si en un campo de número escribes letras (pasa al pegar de WhatsApp), el sistema no lo
> guarda en cero en silencio: te avisa, por ejemplo, *"«Costo de compra» debe ser un número."*

## 2.4 Editar un insumo

Da clic en **"Editar"**. Es la misma ventana, sin el campo de existencia inicial (la existencia
se mueve desde **"Existencias"**, ver Parte 3). El botón dice **"Guardar cambios"**.

📷 **`img-ins-005`** — Ventana "Editar insumo: Café en grano".
**Marcar:** que **no** aparece el campo "¿Cuánto tienes ahora?".

## 2.5 Por qué no se puede cambiar la unidad base

Si intentas cambiarle la unidad base a un insumo que ya se usó, verás algo como:

📷 **`img-ins-006`** — El aviso rojo al intentar cambiar la unidad base de un insumo con
movimientos.
**Marcar:** el aviso completo.

> *"No se puede cambiar la unidad de «Café en grano» (g → ml) porque tiene existencia (2000) y
> ya tiene movimientos registrados. La existencia y las recetas quedarían en la unidad
> equivocada. Da de baja este insumo y crea uno nuevo con la unidad correcta."*

**Por qué:** cambiar la unidad **no convierte nada**. Tus 2000 gramos pasarían a ser 2000
mililitros, y todas las recetas que pedían gramos empezarían a descontar mililitros. El costeo
quedaría mal sin que nadie lo notara.

**Qué hacer:** lo que dice el mensaje — da de baja ese insumo y crea uno nuevo con la unidad
correcta. Mientras el insumo esté **en blanco** (recién creado, sin existencia ni movimientos ni
recetas), sí puedes cambiarle la unidad libremente.

## 2.6 Dar de baja un insumo

Da clic en **"Baja"** y confirma en *"¿Dar de baja el insumo…?"* con **"Dar de baja"**.
Aparece *"Insumo dado de baja"*.

📷 **`img-ins-007`** — La tabla con un insumo dado de baja.
**Marcar:**
1. El renglón atenuado con la etiqueta **"Baja"**.
2. Que ya **no tiene** el botón "Existencias".
3. El botón **"Reactivar"**.

Un insumo dado de baja:
- **ya no se ofrece** al armar recetas nuevas;
- **no puede mover existencia** — si lo intentas, verás *"«X» está dado de baja. Reactívalo para
  poder mover su existencia."* Es a propósito: lo que entrara a un insumo que ya no se usa nunca
  volvería a salir;
- **no se borra**: su historial se conserva y se puede **reactivar**.

---

# Parte 3 · Existencias: compras, merma, conteo y costo

## 3.1 La ventana de existencias

Da clic en **"Existencias"** en el renglón del insumo.

> 🔑 **Permiso necesario:** grupo **Insumos** → casilla
> **"Registrar entradas, merma y ajustes de existencias"**
> Sin ella, el botón "Existencias" no aparece.

📷 **`img-ins-008`** — Ventana "Existencias — Café en grano".
**Marcar con números:**
1. La línea de arriba: **"Existencia actual"** y **"Costo promedio"**.
2. El desplegable **"Tipo de movimiento"**, abierto, mostrando las opciones.
3. El botón **"Registrar movimiento"**.
4. La tabla **"Últimos movimientos"** de abajo.

Hay cuatro tipos de movimiento. **Cuál usar depende de qué pasó en la vida real:**

| Lo que pasó | Movimiento |
|---|---|
| Llegó mercancía (compraste) | **Entrada** |
| Se tiró, se cayó, se echó a perder | **Merma** |
| Contaste y el número del sistema no coincide | **Ajuste por conteo físico** |
| El precio cambió y quieres corregirlo sin registrar compra | **Corregir costo** |

> ⚠️ **Las ventas NO se registran aquí.** Cuando vendes un producto, su receta descuenta los
> insumos sola. Este botón es solo para lo que pasa **fuera** de la caja.

## 3.2 Entrada (compra / recepción)

Úsala **cada vez que llegue mercancía**, en el momento en que llega.

📷 **`img-ins-009`** — Ventana de existencias con "Entrada" elegida.
**Marcar con números:**
1. **"Cantidad (en Kilo)"** — la unidad cambia según el insumo.
2. **"Costo de compra"** y su texto *"— actualiza el costo promedio"*.
3. **"Tienda / proveedor"** y su texto *"Opcional — dónde lo compraste esta vez"*.

| Campo | Qué poner |
|---|---|
| **Cantidad** | En **unidades de compra**: compraste 2 kilos → `2` |
| **Costo de compra** | Lo que pagaste **esta vez** por **una** presentación. Viene lleno con el último precio; cámbialo si cambió |
| **Tienda / proveedor** | Opcional. Dónde lo compraste |

Da clic en **"Registrar movimiento"**. Aparece *"Movimiento registrado"*, la existencia sube y el
costo promedio se ajusta solo.

**Sobre el costo:**

- **Si lo compraste en otra tienda más caro** (el café soluble a $55 en vez de $50): escribe
  `55`. El sistema lo mezcla con lo que ya tenías (ver **4.1**). No hace falta hacer nada más.
- **Si el campo lo dejas vacío**, se usa el último costo conocido.
- **Si te lo regalaron** (una muestra), escribe `0` a propósito: la mercancía gratis **sí** baja
  el costo promedio, porque de verdad te salió más barato.
- **Nunca negativo**: *"El costo de compra no puede ser negativo."*

## 3.3 Merma (pérdida)

Úsala cuando algo **se pierde sin venderse**: la leche que caducó, el frappé que se cayó.

📷 **`img-ins-010`** — Ventana de existencias con "Merma" elegida.
**Marcar con números:**
1. **"Cantidad perdida (en ml)"** — va en **unidad base**.
2. El desplegable **"Motivo"**.
3. El campo **"Nota"**.

| Campo | Qué poner |
|---|---|
| **Cantidad perdida** | En **unidad base**: se tiró medio litro de leche → `500` |
| **Motivo** | Obligatorio: **Caducidad**, **Derrame / accidente**, **Error de preparación** u **Otro** |
| **Nota** | Opcional. Detalle libre (*"se cayó la jarra"*) |

La merma **no puede dejar la existencia en negativo**. Si intentas registrar más de lo que hay,
verás *"No hay suficiente existencia. Stock actual: N."*

> 💡 Registra la merma aunque sea poca. El reporte de merma te dice **cuánto dinero** se te va
> por caducidad o accidentes, y por qué motivo. Sin registro, esa pérdida es invisible.

## 3.4 Ajuste por conteo físico

Úsalo cuando **cuentas lo que hay en la alacena** y no coincide con el sistema.

📷 **`img-ins-011`** — Ventana de existencias con "Ajuste por conteo físico" elegido.
**Marcar:**
1. **"Conteo físico real (en g)"** y su texto *"Existencia registrada ahora: N g"*.
2. El campo **"Nota"**.

No escribes la **diferencia**: escribes **lo que contaste**. El sistema calcula solo cuánto
sobraba o faltaba y deja la existencia en el número real.

**Ejemplo:** el sistema dice 850 g de café, pesas la bolsa y hay 800 g. Escribes `800`. El
sistema registra la diferencia de −50 g y la existencia queda en 800.

> 💡 **Es la salida para casi cualquier descuadre**, incluido el de un insumo en negativo
> (ver **4.3**).

## 3.5 Corregir costo

Úsalo cuando **el precio cambió** y quieres que el sistema lo sepa, **sin registrar una compra**.

> 🔑 **Permiso necesario:** grupo **Insumos** → casilla
> **"Corregir a mano el costo de un insumo"**
> Sin ella, esta opción **no aparece** en el desplegable, aunque la persona sí pueda registrar
> entradas y mermas.

📷 **`img-ins-012`** — Ventana de existencias con "Corregir costo (no cambia la existencia)"
elegido, con un precio ya escrito.
**Marcar con números:**
1. **"Nuevo precio por Kilo"** y su texto con el precio actual.
2. La línea gris de abajo: *"Queda en $X por g (antes $Y)…"*.
3. El campo **"Motivo"** y su texto *"Obligatorio — por qué se corrige"*.

Igual que en una **Entrada**, escribes **lo que cuesta ahora la presentación completa**: el kilo,
el paquete, la botella. **No tienes que hacer cuentas**: el sistema divide solo y te muestra
abajo en cuánto queda cada gramo, mililitro o pieza, antes de guardar.

| Campo | Qué poner |
|---|---|
| **Nuevo precio** | Lo que cuesta ahora **una presentación completa**, tal como la compras. Mayor a 0 |
| **Motivo** | Obligatorio. *"Subió en la bodega"*, *"el proveedor cambió de precio"* |

**Ejemplos:**

| Insumo | Se compra como | Escribes | El sistema calcula |
|---|---|---|---|
| Café en grano | Kilo | `400` | $0.40 por gramo |
| Leche | Botella de 1.2 L (rinde 1200 ml) | `30` | $0.025 por mililitro |
| Galletas Oreo | Paquete de 24 | `32` | $1.3333 por pieza |
| Vaso para llevar | Suelto (por pieza) | `1.80` | $1.80 por pieza |

Aparece *"Costo corregido"*. La existencia **no se mueve**, y el precio nuevo queda como el
vigente: la próxima **Entrada** ya viene prellenada con él.

**¿Entrada o Corregir costo?**

| Si… | Usa |
|---|---|
| Llegó mercancía nueva a otro precio | **Entrada** con el precio nuevo. El promedio se ajusta solo |
| Sabes que el precio cambió pero no estás comprando ahora | **Corregir costo** |
| Te diste cuenta de que el costo quedó mal capturado | **Corregir costo** |

> ⚠️ Corregir el costo **nunca cambia lo que ya se vendió**: cada venta guardó el costo del
> momento en que se hizo. Solo afecta a las ventas de aquí en adelante (ver **4.2**).

## 3.6 El historial de movimientos

Abajo de la ventana está **"Últimos movimientos"**: fecha, tipo, cantidad, cómo quedó la
existencia, el motivo y quién lo hizo.

📷 **`img-ins-013`** — La tabla "Últimos movimientos" con varios tipos distintos, incluida una
entrada con tienda y una corrección de costo.
**Marcar con números:**
1. La etiqueta verde de una **entrada** y su cantidad con **+**.
2. La etiqueta roja de una **merma** o **consumo** y su cantidad con **−**.
3. La etiqueta gris **"costo"** de una corrección, con **"sin cambio"** en la columna Stock.
4. La tienda con 🏪 debajo del motivo de una entrada.
5. La columna **"Usuario"**.

Cómo leerla:

| Columna | Qué muestra |
|---|---|
| **Tipo** | Etiqueta **verde** si sumó existencia (entrada, devolución), **roja** si restó (merma, consumo), **gris "costo"** si fue una corrección de costo |
| **Cantidad** | Con **+** o **−**. En una corrección de costo muestra el costo nuevo |
| **Stock** | Cómo quedó la existencia después. En una corrección dice *"sin cambio"* |
| **Motivo** | Por qué. Si fue una compra con tienda, abajo aparece 🏪 y el nombre |
| **Usuario** | Quién lo registró |

Ahí también aparecen los **consumos** que hicieron las ventas y las **devoluciones** de productos
cancelados. Nada de esto se puede editar ni borrar: es el registro de todo lo que pasó.

---

# Parte 4 · Entender los costos

## 4.1 El costo promedio

El **Costo unitario** no es el precio de la última compra. Es el **promedio** de lo que tienes en
la alacena, pesado por cuánto compraste de cada precio.

**Ejemplo:**

```
Tienes          2 kilos de café comprados a $300 el kilo   →  $0.30 por gramo
Compras         1 kilo más en otra tienda a $400           →  $0.40 por gramo

Nuevo costo  =  (2000 g × $0.30 + 1000 g × $0.40) ÷ 3000 g  =  $0.3333 por gramo
```

Por eso no necesitas hacer nada especial cuando un insumo cambia de precio: **registra cada
compra con lo que pagaste** y el sistema lleva la cuenta. Sirve igual para el mango que el
viernes está a $20 y el lunes a $21: cada compra entra con su precio y el promedio flota solo.

## 4.2 Lo que ya se vendió no cambia

Cada venta **congela** el costo de sus insumos en el momento en que se hizo.

**Ejemplo:** en la mañana vendiste 30 cafés con el café a $0.050 el gramo. A mediodía se acabó,
fuiste a comprar de emergencia más caro, y el promedio subió a $0.054.

- Los 30 cafés de la mañana **siguen costando** $0.050 en el reporte.
- Solo los que vendas **después** de la compra usan $0.054.

La compra de emergencia **no reescribe la mañana**. El reporte del día suma los dos tramos con
el costo real de cada uno.

## 4.3 Faltantes: cuando la existencia se va a negativo

Si vendes algo cuyo insumo está en cero, **la venta no se frena**. El producto existe aunque el
sistema diga que no, y dejar a un cliente sin cobrar sale más caro que el descuadre.

Pero **el sistema te avisa en ese momento**. Al cajero le aparece:

> *"⚠ Oreo quedó en −45 pieza. Falta registrar una compra o hacer conteo."*

📷 **`img-ins-014`** — El aviso rojo que le sale al cajero en el punto de venta al vender algo
sin existencia.
**Marcar:** el aviso completo.

Y en la lista de insumos queda marcado con la etiqueta roja **"Faltan 45"**.

**Qué significa:** el −45 **no es un error del sistema**. Te está diciendo *"salieron 45
galletas que nunca registraste como compra"*. Casi siempre es una entrada que se te olvidó
capturar. Tu alacena está bien; el registro no.

**Cómo se arregla:**

1. **Si se te olvidó registrar una compra** → haz la **Entrada** que faltó, con su costo real.
2. **Si solo quieres dejar el número en la realidad** → haz un **Ajuste por conteo físico** con
   lo que hay en la alacena.

Mientras esté en negativo, **la merma no te deja registrar** y te dice por qué:

> *"«Oreo» está en −45 pieza: hay un faltante sin registrar. Haz un conteo físico o registra la
> compra que falta antes de capturar la merma."*

> ✅ **Para que no pase:** registra la **entrada cuando llega la mercancía**, no cuando te
> acuerdes. Es el único paso que evita los faltantes.

---

# Parte 5 · Mensajes que puedes ver

| Mensaje | Qué pasó |
|---|---|
| *"El nombre del insumo es obligatorio."* | Dejaste el nombre vacío |
| *"Ya existe un insumo con ese nombre."* | Otro insumo se llama igual (sin importar mayúsculas ni acentos) |
| *"Ya existe un insumo con ese nombre, dado de baja. Reactívalo en vez de crear otro."* | El que choca está de baja: reactívalo |
| *"Ya existe una categoría con ese nombre."* | Otra categoría se llama igual |
| *"El factor de compra debe ser mayor a 0."* | El "Rinde" quedó en 0 |
| *"El costo de compra no puede ser negativo."* | Pusiste un costo con signo menos |
| *"«X» debe ser un número."* | Escribiste letras en un campo de número |
| *"No se puede cambiar la unidad de…"* | El insumo ya se usó (ver **2.5**) |
| *"La cantidad de la entrada debe ser mayor a 0."* | Entrada vacía o en cero |
| *"Selecciona un motivo de merma."* | Falta elegir el motivo |
| *"No hay suficiente existencia. Stock actual: N."* | Intentaste tirar más de lo que hay |
| *"«X» está en −N: hay un faltante sin registrar…"* | El insumo está en negativo (ver **4.3**) |
| *"Indica el conteo físico (0 o más)."* | El conteo quedó vacío o negativo |
| *"Indica el nuevo precio de compra (mayor a 0)."* | La corrección de costo quedó vacía o en cero |
| *"Escribe el motivo de la corrección de costo."* | La corrección de costo necesita motivo |
| *"«X» está dado de baja. Reactívalo para poder mover su existencia."* | El insumo está de baja |
| *"No tienes permiso para realizar esta acción."* | Te falta el permiso de esa acción |

---

# Anexo · Lista de capturas

Las capturas de **Categorías de insumos** usan el prefijo `img-invcat-` y las de **Insumos**
`img-ins-`, numeradas en el orden en que aparecen en el texto.

## Categorías de insumos

| Referencia | Qué capturar | Qué marcar |
|---|---|---|
| `img-invcat-001` | Pantalla de Categorías de insumos | ① texto gris ② "+ Nueva categoría" ③ buscador y filtro por unidad ④ columna "Insumos" ⑤ botones Editar/Baja |
| `img-invcat-002` | Ventana "Nueva categoría de insumo" | ① Nombre ② Unidad sugerida y su texto |
| `img-invcat-003` | Tabla con una categoría dada de baja | ① etiqueta "Baja" ② botón "Reactivar" |

## Insumos

| Referencia | Qué capturar | Qué marcar |
|---|---|---|
| `img-ins-001` | Pantalla de Insumos, con uno "Bajo" y uno "Faltan" | ① aviso de arriba ② "+ Nuevo insumo" ③ buscador, "Por acabarse" y categorías ④ etiquetas "Bajo" y "Faltan N" ⑤ Costo unitario ⑥ botones Existencias/Editar/Baja |
| `img-ins-002` | Ventana "Nuevo insumo", parte de arriba | ① Nombre ② Categoría ③ Unidad base |
| `img-ins-003` | Sección "Presentación de compra" | ① botones Suelto/Por kilo/… ② "¿Cómo se compra?" y "Rinde" ③ Costo de compra ④ línea gris del costo por unidad |
| `img-ins-004` | Parte de abajo de "Nuevo insumo", con cantidades escritas | ① "¿Cuánto tienes ahora?" y su línea gris de conversión ② "Avísame cuando queden menos de…" y la suya |
| `img-ins-005` | Ventana "Editar insumo" | Que no aparece "¿Cuánto tienes ahora?" |
| `img-ins-006` | Aviso al cambiar la unidad base de un insumo usado | El aviso completo |
| `img-ins-007` | Tabla con un insumo dado de baja | ① renglón atenuado con "Baja" ② sin botón Existencias ③ botón "Reactivar" |
| `img-ins-008` | Ventana "Existencias — …" | ① Existencia actual y Costo promedio ② desplegable abierto ③ "Registrar movimiento" ④ "Últimos movimientos" |
| `img-ins-009` | Existencias con "Entrada" | ① Cantidad ② Costo de compra y su texto ③ Tienda / proveedor |
| `img-ins-010` | Existencias con "Merma" | ① Cantidad perdida ② Motivo ③ Nota |
| `img-ins-011` | Existencias con "Ajuste por conteo físico" | ① Conteo físico y su texto ② Nota |
| `img-ins-012` | Existencias con "Corregir costo" y un precio escrito | ① "Nuevo precio por Kilo" y su texto ② la línea "Queda en $X por g" ③ Motivo |
| `img-ins-013` | Tabla "Últimos movimientos" con tipos variados | ① etiqueta verde + cantidad con + ② etiqueta roja + cantidad con − ③ etiqueta gris "costo" con "sin cambio" ④ tienda con 🏪 ⑤ columna Usuario |
| `img-ins-014` | Aviso al cajero al vender sin existencia | El aviso completo |

> 💡 **Para las capturas:** usa siempre el mismo insumo de ejemplo (por ejemplo "Café en grano",
> comprado por kilo) para que el manual se lea como una sola historia. Para `img-ins-001` y
> `img-ins-014` vas a necesitar un insumo en negativo: vende un producto cuyo insumo tenga poca
> existencia, toma las capturas, y después corrígelo con un conteo físico.
