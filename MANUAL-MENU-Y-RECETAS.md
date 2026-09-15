# Manual de usuario — Menú y recetas

Beso de Café · Punto de venta y gestión interna

Este manual cubre **Categorías de productos**, **Modificadores**, **Productos** (con sus tamaños,
precios y recetas) y **Promociones**. Se lee igual que los manuales anteriores: los recuadros 🔑
dicen qué casilla de permisos hace aparecer cada botón.

> ⚠️ **Antes de empezar, necesitas tener los insumos dados de alta** (manual de Inventario). La
> receta de un producto se arma con insumos: si no existen, no hay nada que poner en ella.

---

## Cómo encaja todo

```
Categoría  ─┐
            ├──  Producto  ──  Tamaño (Chico, Grande…)  ──  Precio  +  Receta
Modificador ┘                                                          │
                                                               descuenta insumos
                                                               cada vez que se vende
```

- La **categoría** agrupa los productos en el punto de venta (Frappés, Cafés, Postres…).
- El **producto** es lo que se vende: "Frappé Oreo". Lleva **foto obligatoria**.
- Cada producto tiene uno o más **tamaños**. El **precio** y la **receta** viven en cada tamaño,
  no en el producto: un frappé chico y uno grande cuestan distinto y gastan distinto.
- El **modificador** es un extra que se agrega al vender ("Extra shot de espresso"): suma al
  precio y descuenta su propio insumo.
- La **promoción** es un descuento que el cajero aplica a una cuenta.

## Dónde está

Menú lateral → sección **Catálogo** → **Menú y recetas**. Adentro hay cuatro opciones:
**Productos**, **Categorías de productos**, **Modificadores** y **Promociones**.

> ℹ️ **"Menú y recetas" no tiene casilla propia.** El grupo aparece en cuanto la persona puede ver
> cualquiera de sus cuatro submódulos.

## Los permisos de este módulo

En la lista de permisos vas a encontrar cuatro grupos:

```
☐ Productos
    ☐ Ver el módulo y el listado de productos
    ☐ Crear productos
    ☐ Editar productos (datos, tamaños, agotado)
    ☐ Dar de baja productos
    ☐ Cambiar el precio de un producto
    ☐ Editar la receta de un producto

☐ Categorías de productos
    ☐ Ver el módulo y el listado de categorías de productos
    ☐ Crear categorías de productos
    ☐ Editar categorías de productos
    ☐ Dar de baja / reactivar categorías de productos

☐ Modificadores
    ☐ Ver el módulo y el listado de modificadores
    ☐ Crear modificadores
    ☐ Editar modificadores y su receta
    ☐ Dar de baja / reactivar modificadores

☐ Promociones
    ☐ Ver el módulo y el listado de promociones
    ☐ Crear promociones
    ☐ Editar promociones
    ☐ Activar / desactivar promociones
    ☐ Aplicar una promoción a una cuenta
```

Hay tres **permisos especiales** que no vienen incluidos en "Editar":

| Casilla | Por qué va aparte |
|---|---|
| **"Cambiar el precio de un producto"** | El precio es dinero. Alguien puede corregir el nombre o marcar "agotado" sin poder tocar precios |
| **"Editar la receta de un producto"** | La receta decide cuánto inventario se gasta y cuánto cuesta cada producto |
| **"Aplicar una promoción a una cuenta"** | Es el que usa el **cajero** en el punto de venta. No le da poder para crear ni editar promociones |

---

# Parte 1 · Categorías de productos

## 1.1 Para qué sirven

Agrupan los productos en el **punto de venta**. Cuando el cajero abre una cuenta, ve el catálogo
separado por categoría y puede filtrar tocando su nombre. El sistema ya viene con siete:

**Frappés · Sodas Italianas · Tisanas · Matcha · Cafés · Postres · Otros**

## 1.2 La pantalla

Menú → **Menú y recetas** → **Categorías de productos**.

📷 **`img-pcat-001`** — Pantalla de "Categorías de productos".
**Marcar con números:**
1. El texto gris *"Cómo se agrupan los productos en el menú (Frappés, Cafés, Postres…)"*.
2. El botón **"+ Nueva categoría"**.
3. El buscador **"Buscar categoría…"**.
4. La columna **"Productos"** (cuántos productos tiene cada una).
5. Los botones **"Editar"** y **"Baja"** de un renglón.

> 🔑 **Permisos de esta pantalla.** Todos están en el grupo **Categorías de productos**:
>
> | Para… | Hay que marcar la casilla |
> |---|---|
> | Ver la pantalla y la tabla | **"Ver el módulo y el listado de categorías de productos"** |
> | Ver el botón **"+ Nueva categoría"** | **"Crear categorías de productos"** |
> | Ver el botón **"Editar"** | **"Editar categorías de productos"** |
> | Ver **"Baja"** / **"Reactivar"** | **"Dar de baja / reactivar categorías de productos"** |

## 1.3 Crear, editar y dar de baja

**Crear:** da clic en **"+ Nueva categoría"**, escribe el **nombre** y da clic en **"Crear"**.
Aparece *"Categoría creada"*.

📷 **`img-pcat-002`** — Ventana "Nueva categoría de producto".
**Marcar:** el campo **"Nombre"**.

- El nombre es obligatorio y **no se puede repetir**: *"Ya existe una categoría con ese nombre."*

**Editar:** **"Editar"** → cambia el nombre → **"Guardar"**. Aparece *"Categoría actualizada"*.

**Dar de baja:** **"Baja"** → confirma en *"¿Dar de baja la categoría…?"* con **"Dar de baja"**.
Aparece *"Categoría dada de baja"*. Nada se borra: se puede **reactivar** después, y los productos
que ya la usaban la conservan.

---

# Parte 2 · Modificadores

## 2.1 Qué es un modificador

Un extra que el cliente pide **encima** de su producto. El caso del cliente es uno solo:
**"Extra shot de espresso"**. Hace dos cosas a la vez:

1. **Suma un precio fijo** al total (por ejemplo +$15).
2. **Descuenta su propio insumo** del inventario (por ejemplo 9 g de café en grano).

> ⚠️ **El sistema ya trae "Extra shot de espresso" creado, pero sin precio ni receta.** Antes de
> usarlo en caja, entra a **Editar** y ponle su precio y lo que gasta. Si no, se vende gratis y no
> descuenta café.

## 2.2 La pantalla

Menú → **Menú y recetas** → **Modificadores**.

📷 **`img-mod-001`** — Pantalla de "Modificadores".
**Marcar con números:**
1. El texto gris *"Extras que se pueden agregar a un producto (suman al precio y descuentan
   insumo)."*
2. El botón **"+ Nuevo modificador"**.
3. Las columnas **"Precio extra"**, **"Receta"** y **"Ganancia"**.
4. La columna **"Productos"** (en cuántos productos se ofrece).

| Columna | Qué muestra |
|---|---|
| **Modificador** | El nombre |
| **Precio extra** | Lo que se suma al total |
| **Receta** | Qué insumos gasta |
| **Ganancia** | Precio extra menos lo que cuesta su receta |
| **Productos** | En cuántos productos está permitido |
| **Estado** | Activo o Baja |

> 🔑 **Permisos de esta pantalla.** Todos están en el grupo **Modificadores**:
>
> | Para… | Hay que marcar la casilla |
> |---|---|
> | Ver la pantalla y la tabla | **"Ver el módulo y el listado de modificadores"** |
> | Ver el botón **"+ Nuevo modificador"** | **"Crear modificadores"** |
> | Ver el botón **"Editar"** | **"Editar modificadores y su receta"** |
> | Ver **"Baja"** / **"Reactivar"** | **"Dar de baja / reactivar modificadores"** |

## 2.3 Crear o editar un modificador

📷 **`img-mod-002`** — Ventana "Editar modificador: Extra shot de espresso" con su receta llena.
**Marcar con números:**
1. **"Nombre"**.
2. **"Precio extra (con IVA)"** y su texto *"$ que se suma al total"*.
3. La sección **"Receta del extra (qué consume del inventario)"**.
4. La línea de abajo: *"Costo de la receta: $X · Ganancia del extra: $Y"*.

| Campo | Qué poner |
|---|---|
| **Nombre** | Obligatorio. No se repite |
| **Precio extra** | Lo que se suma al total. Ya trae IVA, como todos los precios. No puede ser negativo |
| **Receta del extra** | Los insumos que gasta y cuánto, **en la unidad base** del insumo: 9 g de café, no 0.009 kg |

La línea de **costo y ganancia** se actualiza mientras capturas, para que veas de inmediato si el
precio del extra deja ganancia.

Da clic en **"Crear"** (o **"Guardar"**). Aparece *"Modificador creado"* (o *"actualizado"*).

## 2.4 En qué productos se ofrece

Un modificador **no aparece solo en todos los productos**. Se activa **producto por producto**, en
la sección **"Modificadores que admite"** del producto (ver **3.4** y **3.6**). Así el "Extra shot"
se ofrece en los cafés y no en una soda italiana.

---

# Parte 3 · Productos

## 3.1 La pantalla

Menú → **Menú y recetas** → **Productos**.

📷 **`img-prod-001`** — Pantalla de "Productos" con varios productos, uno agotado y uno con
"Falta receta".
**Marcar con números:**
1. El botón **"+ Nuevo producto"**.
2. El buscador, el interruptor **"Solo agotados"** y la fila de categorías.
3. La miniatura de la foto junto al nombre.
4. La columna **"Receta"**, señalando una **"Completa"** y una **"Falta receta"**.
5. La etiqueta **"Agotado"** junto a un nombre.
6. Los botones **"Abrir"**, **"Agotar"** y **"Baja"** de un renglón.

| Columna | Qué muestra |
|---|---|
| **Producto** | Foto en miniatura, nombre y, si aplica, la etiqueta **Agotado** |
| **Categoría** | La suya, o *"Sin categoría"* |
| **Tamaños** | Cuántos tamaños activos tiene |
| **Precio** | El precio, o el rango si tiene varios tamaños |
| **Receta** | **"Completa"** si todos sus tamaños tienen receta y precio; si no, **"Falta receta"** |
| **Estado** | Activo o Baja |

> ⚠️ **Fíjate en la columna "Receta".** Un producto con **"Falta receta"** se puede vender, pero
> **no descuenta inventario** y su costo sale en cero: el reporte te dirá que ganas el 100%. Deja
> todos en **"Completa"** antes de abrir la caja.

> 🔑 **Permisos de esta pantalla.** Todos están en el grupo **Productos**:
>
> | Para… | Hay que marcar la casilla |
> |---|---|
> | Ver la pantalla y la tabla | **"Ver el módulo y el listado de productos"** |
> | Ver el botón **"+ Nuevo producto"** | **"Crear productos"** |
> | Ver el botón **"Agotar"** | **"Editar productos (datos, tamaños, agotado)"** |
> | Ver **"Baja"** / **"Reactivar"** | **"Dar de baja productos"** |
>
> El botón para entrar al producto siempre aparece. Dice **"Abrir"** si la persona puede editar
> algo del producto, y **"Ver"** si solo puede consultarlo.

## 3.2 Agotado vs. dado de baja

Son dos cosas distintas y conviene no confundirlas:

| | **Agotado** | **Dado de baja** |
|---|---|---|
| Qué significa | Hoy no hay (se acabó la fruta, es de temporada) | Ya no forma parte del menú |
| En el punto de venta | Se ve **atenuado con la etiqueta "Agotado"** y no se puede tocar | **No aparece** |
| Cómo se revierte | Un clic, el mismo día | Reactivándolo |
| Botón | **"Agotar"** (cuando ya está agotado, el mismo botón dice **"Reactivar"**) | **"Baja"** (dado de baja, dice **"Reactivar"**) |

> 💡 **Para un producto de temporada usa "Agotar", no "Baja".** Cuando vuelva la temporada, un
> clic y regresa, con su receta y su precio intactos.

También puedes agotar **solo un tamaño** (por ejemplo, el Grande porque se acabaron los vasos
grandes) desde la ficha del producto (ver **3.6**).

## 3.3 Dar de alta un producto

**Paso 1.** Da clic en **"+ Nuevo producto"**.

📷 **`img-prod-002`** — Ventana "Nuevo producto", parte de arriba.
**Marcar con números:**
1. **"Nombre"** y **"Categoría"**.
2. **"Descripción"** (opcional).
3. La sección **"Foto"**, con el recuadro vacío 📷 y su texto *"Obligatoria: en el punto de
   venta el producto se reconoce por su foto."*

**Paso 2.** Llena **nombre**, **categoría** y, si quieres, una **descripción**.

- El nombre **no se puede repetir**, y no distingue mayúsculas ni acentos: si existe "Frappé
  Oreo", no te deja "FRAPPE OREO".

**Paso 3.** Elige la **foto**. Da clic en **"Elegir foto…"** y escoge una imagen de tu
computadora.

📷 **`img-prod-003`** — La sección "Foto" ya con una imagen elegida.
**Marcar:**
1. La vista previa de la foto.
2. El texto *"Se guarda reducida a 640 px para que la aplicación siga ligera."*

| Sobre la foto | |
|---|---|
| **Es obligatoria** | Sin ella no se puede crear el producto. En el punto de venta el cajero elige por la foto, sin leer |
| **Formatos** | JPG, PNG o WebP |
| **Tamaño** | Puedes elegir una foto de celular grande: el sistema la **reduce solo** antes de guardarla |
| **Si eliges otra cosa** | Te avisa: *"Ese archivo no es una imagen. Elige un JPG, PNG o WebP."* |

> 💡 **Para que el catálogo se vea parejo:** fotos cuadradas o apaisadas, del producto de frente
> y con fondo liso. La tarjeta del punto de venta recorta la foto a lo ancho.

**Paso 4.** Captura los **tamaños y su precio**.

📷 **`img-prod-004`** — Sección "Tamaños y precio" de la ventana.
**Marcar con números:**
1. El texto *"Un solo tamaño para casi todo. Los frappés llevan «Chico» y «Grande»."*
2. La tabla con las columnas **"Tamaño"** y **"Precio"**.
3. El botón **"+ Agregar tamaño"**.
4. La **✕** para quitar un renglón.

- **Casi todo lleva un solo tamaño**: déjalo como viene, **"Único"**, y ponle el precio.
- **Los frappés llevan dos**: cambia "Único" por **"Chico"**, da clic en **"+ Agregar tamaño"**,
  escribe **"Grande"**, y ponle a cada uno su precio.
- El precio **ya trae IVA**, como todos en el sistema.
- Tiene que haber al menos un tamaño con precio: *"Agrega al menos un tamaño con su precio."*

**Paso 5.** Si el producto admite extras, marca los **modificadores** en la sección
**"Modificadores que admite"**.

**Paso 6.** Da clic en **"Crear y configurar receta"**. Aparece *"Producto creado. Ahora arma su
receta."* y **la aplicación te lleva directo a la ficha del producto** para que armes la receta
(ver **3.7**).

## 3.4 La ficha del producto

Desde la lista, da clic en **"Abrir"**. La ficha tiene tres partes: los **datos generales**
arriba, una **pestaña por cada tamaño**, y dentro de cada pestaña el **precio** y la **receta** de
ese tamaño.

📷 **`img-prod-005`** — Ficha completa de un frappé con dos tamaños.
**Marcar con números:**
1. El enlace **"← Volver a productos"**.
2. El botón **"Marcar agotado"** (arriba a la derecha).
3. Los datos generales: nombre, categoría, descripción, foto y **"Modificadores que admite"**.
4. El botón **"Guardar datos"**.
5. Las **pestañas de tamaño** (**Chico**, **Grande**) y la pestaña **"+ Tamaño"**.

**Datos generales:** cambias lo que necesites y das clic en **"Guardar datos"**. Aparece *"Datos
guardados"*. Para cambiar la foto usa **"Cambiar foto…"**; si no la tocas, se queda la que tenía.
Lo que **no** se puede es dejar un producto sin foto.

> 🔑 Sin la casilla **"Editar productos (datos, tamaños, agotado)"** estos campos aparecen
> bloqueados, sin el botón "Guardar datos", y la foto se ve pero no se puede cambiar.

## 3.5 El precio y su historial

Cada pestaña de tamaño empieza con su precio.

📷 **`img-prod-006`** — El recuadro de precio de un tamaño.
**Marcar:**
1. El texto *"Precio de «Chico» (con IVA)"* y el precio grande.
2. Los botones **"Cambiar precio"** e **"Historial"**.

**Cambiar el precio:** da clic en **"Cambiar precio"**, escribe el **"Nuevo precio (con IVA)"** y
da clic en **"Guardar precio"**. Aparece *"Precio actualizado"*.

📷 **`img-prod-007`** — Ventana "Cambiar precio — Frappé Oreo (Chico)".
**Marcar:** el texto *"Las ventas ya registradas conservan su precio. El nuevo aplica de aquí en
adelante."*

> ⚠️ **Cambiar un precio nunca modifica ventas pasadas.** Cada venta guardó el precio del momento.
> Si subes el frappé de $50 a $55 hoy, las ventas de ayer siguen diciendo $50.

**Ver el historial:** da clic en **"Historial"**. Muestra cada precio que ha tenido ese tamaño,
**desde** cuándo, **hasta** cuándo y **quién** lo cambió. El vigente dice **"Actual"**.

📷 **`img-prod-008`** — Ventana "Historial de precios — Chico" con dos o más precios.
**Marcar:** las columnas **"Desde"**, **"Hasta"** y **"Quién"**, y la marca **"Actual"**.

> 🔑 El botón **"Cambiar precio"** necesita la casilla **"Cambiar el precio de un producto"**.
> El botón **"Historial"** lo ve cualquiera que pueda abrir el producto: consultar precios pasados
> no es delicado, cambiarlos sí.

## 3.6 Tamaños: agregar, renombrar, agotar y dar de baja

**Agregar un tamaño:** da clic en la pestaña **"+ Tamaño"**. Escribe el nombre (*Chico / Grande /
Mediano*) y su precio, y da clic en **"Agregar"**. Aparece *"Tamaño agregado"*. El tamaño nuevo
nace **sin receta**: *"Después le armas su propia receta."*

En cada pestaña, abajo, hay un recuadro con las acciones de ese tamaño:

📷 **`img-prod-009`** — El recuadro "Tamaño «Grande»" con sus botones.
**Marcar:** los botones **"Renombrar"**, **"Marcar agotado"** y **"Dar de baja"**.

| Botón | Qué hace |
|---|---|
| **Renombrar** | Le cambia el nombre. Aparece *"Renombrado"* |
| **Marcar agotado** | Agota **solo ese tamaño**. En el punto de venta ese tamaño no se puede elegir, los demás sí. La pestaña muestra un punto ● |
| **Dar de baja** | Lo retira del producto. La pestaña se ve tachada. Se puede **reactivar** |

- Un producto **no puede quedarse sin tamaños activos**: *"El producto necesita al menos un tamaño
  activo."*

> 🔑 Todas estas acciones necesitan **"Editar productos (datos, tamaños, agotado)"**. Sin esa
> casilla no aparecen la pestaña "+ Tamaño" ni el recuadro de acciones.

## 3.7 La receta

Es la parte más importante del producto: **dice qué se gasta del inventario cada vez que se vende**
y de ahí sale **cuánto te cuesta** y **cuánto ganas**.

Cada tamaño tiene **su propia receta**. Un frappé grande lleva más base que uno chico.

📷 **`img-prod-010`** — La tarjeta "Receta de Chico" con insumos, un grupo de opción y el costeo.
**Marcar con números:**
1. El texto gris que explica **Siempre / Solo para llevar / Solo en cafetería**.
2. La tabla de insumos con sus columnas **Insumo · Cantidad · ¿Cuándo? · Costo**.
3. El botón **"+ Agregar insumo"**.
4. La sección **"Grupos de opción (el cliente elige uno)"**.
5. Las cuatro casillas del costeo: **Costo aquí · Costo para llevar · Ganancia aquí · Ganancia
   para llevar**.
6. El botón **"Guardar receta"**.

### Agregar insumos

Da clic en **"+ Agregar insumo"**. Aparece un renglón con un buscador: escribe parte del nombre
(*"lech"*) y elige de la lista.

| Columna | Qué poner |
|---|---|
| **Insumo** | El que se gasta |
| **Cantidad** | Cuánto, **en la unidad base del insumo**: 150 ml de leche, 40 g de base, 1 pieza de vaso. Al lado aparece la unidad para que no te equivoques |
| **¿Cuándo?** | Cuándo se gasta (ver abajo) |
| **Costo** | Se calcula solo: cantidad × costo del insumo |

### "¿Cuándo?": aquí, para llevar o siempre

Es lo que hace que el mismo frappé gaste distinto si se toma en la mesa o se lleva:

| Opción | Se gasta cuando… | Ejemplos |
|---|---|---|
| **Siempre** | En toda venta | La leche, la base, el café |
| **Solo para llevar** | Solo si el producto se vende para llevar | El **vaso desechable**, la **tapa**, la **charola** |
| **Solo en cafetería** | Solo si se sirve en la mesa | Lo que solo aplica en mesa |

**Ejemplo — Frappé Oreo Chico:**

| Insumo | Cantidad | ¿Cuándo? |
|---|---|---|
| Base para frappé | 40 g | Siempre |
| Leche entera | 150 ml | Siempre |
| Galletas Oreo | 2 pzas | Siempre |
| Vaso para llevar (frappé) | 1 pza | **Solo para llevar** |

Servido en la mesa va en vaso de vidrio: no gasta desechable. Para llevar, sí.

> ℹ️ Si una mesa se retira a media cuenta y el cajero usa **"Pasar a llevar"**, el sistema aplica
> esta misma regla y descuenta los vasos que faltaban.

### Grupos de opción: cuando el cliente elige

Un **grupo de opción** es un renglón de la receta donde el cliente escoge **un insumo entre
varios**. El caso típico es la leche: entera o deslactosada.

Da clic en **"+ Agregar grupo de opción"**.

📷 **`img-prod-011`** — Un grupo de opción "Leche" armado, con dos opciones.
**Marcar con números:**
1. El nombre del grupo (**"Leche"**).
2. La **cantidad** y el **¿Cuándo?** del grupo.
3. Las dos opciones y la marca **"Predet."** en la leche entera.
4. El botón **"+ Opción"**.

| Parte | Qué poner |
|---|---|
| **Nombre del grupo** | Lo que el cajero va a ver en caja: *Leche*, *Azúcar*, *Base* |
| **Cantidad** | Una sola, que vale para cualquier opción: 150 ml |
| **¿Cuándo?** | Igual que un insumo normal |
| **Opciones** | Los insumos entre los que se elige. **Mínimo dos** |
| **Predeterminada** | La que se marca sola en caja si el cliente no dice nada |

**En el punto de venta** el grupo aparece como botones, igual que los tamaños:

```
Leche
┌────────────────────┬────────────────────┐
│ ● Leche entera     │ ○ Leche deslact.   │
└────────────────────┴────────────────────┘
```

El inventario descuenta **la que se eligió**, no la predeterminada.

> ⚠️ **Todas las opciones de un grupo deben usar la misma unidad.** No puedes hacer un grupo
> "Cobertura" con Hershey's (en mililitros) y Nutella (en gramos). El sistema te frena:
> *"Las opciones del grupo «Cobertura» deben usar la misma unidad."*

### El costeo

Abajo de la receta hay cuatro casillas que se **recalculan mientras capturas**:

| Casilla | Qué es |
|---|---|
| **Costo aquí** | Lo que cuesta preparar el producto para servirlo en la mesa |
| **Costo para llevar** | Lo mismo, con los desechables |
| **Ganancia aquí** | Precio menos costo aquí |
| **Ganancia para llevar** | Precio menos costo para llevar |

Las ganancias se ven en **verde** si son positivas y en **rojo** si el producto se vende por debajo
de lo que cuesta. Si un grupo tiene opciones de distinto precio, el costeo usa la
**predeterminada**; en la venta real se cobra la que se eligió.

### Guardar

Da clic en **"Guardar receta"**. Aparece *"Receta guardada"*, y en la lista de productos la
columna **Receta** cambia a **"Completa"** cuando todos los tamaños tienen receta y precio.

> 🔑 **Permiso necesario:** grupo **Productos** → casilla **"Editar la receta de un producto"**.
> Sin ella, la receta se ve pero **bloqueada**: no se puede agregar, quitar ni guardar. Sirve para
> que alguien consulte cuánto lleva un frappé sin poder cambiarlo.

### Qué puede salir mal al guardar una receta

| Mensaje | Qué pasó |
|---|---|
| *"Cada insumo de la receta necesita una cantidad mayor a 0."* | Un renglón quedó en 0 o vacío |
| *"El insumo «X» está repetido con el mismo modo."* | Pusiste dos veces el mismo insumo con el mismo "¿Cuándo?". Súmalos en un solo renglón |
| *"Cada grupo de opción necesita un nombre."* | Un grupo quedó sin nombre |
| *"El grupo «X» necesita al menos 2 opciones."* | Un grupo con una sola opción no es una elección: ponlo como insumo normal |
| *"El grupo «X» necesita una cantidad mayor a 0."* | Falta la cantidad del grupo |
| *"Las opciones del grupo «X» deben usar la misma unidad."* | Mezclaste ml con g, o g con piezas |

## 3.8 Dar de baja un producto

En la lista, **"Baja"** → confirma en *"¿Dar de baja «X»?"* con **"Dar de baja"**. Aparece
*"Producto dado de baja"*. Deja de aparecer en el punto de venta, pero sus ventas pasadas se
conservan y se puede **reactivar**.

---

# Parte 4 · Promociones

## 4.1 Las reglas del juego

Antes de crear una, conviene saber cómo funcionan:

- **Una sola promoción por cuenta.** No se acumulan.
- **Toda promoción tiene fecha de inicio y de fin.** No existen promociones "para siempre".
- **Las crea la dueña; las aplica el cajero.** Crear y editar son permisos distintos de aplicar.
- **El cajero no ve todas**: al tocar "Aplicar promoción" solo le aparecen las que están **vigentes
  hoy** y que **esa cuenta cumple**, con el descuento ya calculado.
- **Se recalcula sola.** Si el cliente agrega o quita productos, el descuento se ajusta. Si la
  cuenta deja de cumplir, el ticket avisa: *"⚠ la promoción ya no aplica a esta cuenta"*.

## 4.2 La pantalla

Menú → **Menú y recetas** → **Promociones**.

📷 **`img-promo-001`** — Pantalla de "Promociones" con al menos una de cada estado.
**Marcar con números:**
1. El texto gris *"Combos, descuentos por día y montos fijos. Toda promoción necesita fecha de
   inicio y fin. En la venta se aplica una a la vez."*
2. El botón **"+ Nueva promoción"**.
3. Los filtros **Todas · Combos · Por día · Monto fijo** y el buscador.
4. La columna **"Estado"**, señalando una **Vigente**, una **Fuera de fecha** y una **Inactiva**.
5. Los botones **"Editar"** y **"Desactivar"**.

| Estado | Qué significa |
|---|---|
| **Vigente** | Activa y dentro de sus fechas: el cajero la puede aplicar hoy |
| **Fuera de fecha** | Activa, pero hoy no está entre su inicio y su fin (ya pasó, o todavía no empieza) |
| **Inactiva** | La apagaste a mano. No se aplica aunque esté en fechas |

> 🔑 **Permisos de esta pantalla.** Todos están en el grupo **Promociones**:
>
> | Para… | Hay que marcar la casilla |
> |---|---|
> | Ver la pantalla y la tabla | **"Ver el módulo y el listado de promociones"** |
> | Ver el botón **"+ Nueva promoción"** | **"Crear promociones"** |
> | Ver el botón **"Editar"** | **"Editar promociones"** |
> | Ver **"Desactivar"** / **"Activar"** | **"Activar / desactivar promociones"** |

## 4.3 Crear una promoción

Da clic en **"+ Nueva promoción"**. La ventana **cambia según el tipo** que elijas.

📷 **`img-promo-002`** — Ventana "Nueva promoción", parte de arriba.
**Marcar con números:**
1. **"Nombre"** y **"Descripción"** (opcional).
2. **"Vigente desde"** y **"Vigente hasta"**.
3. El desplegable **"Tipo de promoción"**.

Estos campos van en todas:

| Campo | Notas |
|---|---|
| **Nombre** | Obligatorio. Es lo que el cajero ve al aplicarla: que se entienda solo ("2 frappés por $110") |
| **Descripción** | Opcional, para reconocerla |
| **Vigente desde / hasta** | Obligatorias. El fin no puede ser antes del inicio |
| **Tipo de promoción** | **Combo**, **Descuento por día** o **Monto fijo** |

Hay tres tipos:

### Combo

Varios productos juntos a un precio especial o con un porcentaje de descuento.

📷 **`img-promo-003`** — Formulario de un combo por categoría.
**Marcar:** **"¿A qué aplica?"**, **"Categoría"**, **"¿Cuántos productos?"**, **"Tipo de
descuento"** y **"Precio del combo ($)"**.

| Campo | Opciones |
|---|---|
| **¿A qué aplica?** | **Una categoría** (cualquier producto de ella) o **Ciertos productos** (los que marques) |
| **¿Cuántos productos?** | *(solo por categoría)* Cuántos hay que llevar. Mínimo 2 |
| **Tipo de descuento** | **Precio fijo del combo ($)** o **% de descuento** |

**Ejemplos:**

| Promoción | Cómo se captura |
|---|---|
| *2 frappés de cualquier sabor por $110* | Una categoría → **Frappés** → ¿Cuántos? **2** → Precio fijo → **110** |
| *Frappé Oreo + Latte, 15% de descuento* | Ciertos productos → marca **Frappé Oreo** y **Latte** → % de descuento → **15** |

### Descuento por día

Un porcentaje de descuento un día de la semana.

📷 **`img-promo-004`** — Formulario de un descuento por día.
**Marcar:** **"Día de la semana"**, **"¿A qué aplica?"** y **"Porcentaje de descuento (%)"**.

**Ejemplo:** *Martes de sodas, 20%* → Día **Martes** → Una categoría → **Sodas Italianas** →
**20**.

El porcentaje va de 1 a 100.

### Monto fijo

Se descuenta una cantidad de dinero.

📷 **`img-promo-005`** — Formulario de un monto fijo.
**Marcar:** **"¿A qué aplica?"** (con sus opciones **A toda la cuenta** / **A ciertos productos**)
y **"Monto a descontar ($)"**.

**Ejemplo:** *$20 menos en tu cuenta* → A toda la cuenta → **20**.

Da clic en **"Crear"**. Aparece *"Promoción creada"*.

## 4.4 Editar, desactivar y activar

- **Editar:** **"Editar"** → cambias lo que necesites → **"Guardar"**. Aparece *"Promoción
  actualizada"*.
- **Desactivar:** **"Desactivar"** → confirma en *"¿Desactivar «X»?"*. Queda **Inactiva** y deja de
  ofrecerse en caja aunque esté en fechas. Aparece *"Promoción desactivada"*.
- **Activar:** en una inactiva, **"Activar"**. Aparece *"Promoción activada"*.

> 💡 **Para una promoción que se repite** (el descuento de cada Buen Fin), no la borres ni crees
> otra: al año siguiente **edítala**, cámbiale las fechas y actívala.

## 4.5 Cómo la usa el cajero

En la cuenta abierta, el cajero toca **"Aplicar promoción"**. Se abre la ventana **"Aplicar una
promoción"**: *"Solo se puede una por cuenta. Elige la que conviene:"*.

📷 **`img-promo-006`** — La ventana "Aplicar una promoción" desde un ticket, con dos o más
promociones.
**Marcar con números:**
1. El descuento en verde de cada promoción (**−$X**), ya calculado para esa cuenta.
2. El botón **"Usar"** de una de ellas.

Solo aparecen las que están vigentes hoy **y** que esa cuenta cumple, así que el cajero puede
comparar y escoger la que más le conviene al cliente. Si una cuenta tiene un solo frappé, el combo
de "2 frappés" no aparece. Si ninguna aplica, la ventana lo dice: *"Ninguna promoción vigente
aplica a esta cuenta ahora mismo."*

Al tocar **"Usar"** aparece *"Promoción aplicada"*.

📷 **`img-promo-007`** — El ticket con una promoción aplicada.
**Marcar:** la línea verde **"Promo: …"** con el descuento, y el botón **"quitar"**.

> 🔑 **Permiso del cajero:** grupo **Promociones** → casilla **"Aplicar una promoción a una
> cuenta"**. Es la única casilla de Promociones que necesita alguien que solo cobra: no le deja
> crear ni editar promociones, ni ver la pantalla de administración.

Si la cuenta se cobra en varias partes, el descuento se descuenta **de los primeros pagos**.

---

# Parte 5 · Mensajes que puedes ver

| Mensaje | Qué pasó |
|---|---|
| *"El nombre del producto es obligatorio."* | Falta el nombre |
| *"Ya existe un producto con ese nombre."* | Otro producto se llama igual (sin importar mayúsculas ni acentos) |
| *"Falta la foto del producto: es como se reconoce en el punto de venta."* | No elegiste foto |
| *"Agrega al menos un tamaño con su precio."* | La tabla de tamaños quedó vacía |
| *"Indica un precio válido para «X»."* | Un tamaño quedó sin precio o con precio negativo |
| *"El precio nuevo es igual al actual."* | Intentaste "cambiar" el precio al mismo valor |
| *"El producto necesita al menos un tamaño activo."* | Intentaste dar de baja el último tamaño |
| *"Ya existe una categoría con ese nombre."* | Otra categoría de producto se llama igual |
| *"El nombre del modificador es obligatorio."* | Falta el nombre del extra |
| *"El precio extra no puede ser negativo."* | Pusiste un precio con signo menos |
| *"La promoción necesita fecha de inicio y fin (AAAA-MM-DD)."* | Falta una de las dos fechas |
| *"La fecha de fin no puede ser antes de la de inicio."* | Las fechas están al revés |
| *"Elige el día de la semana."* | Descuento por día sin día |
| *"Elige la categoría de la promoción."* | Aplica a una categoría pero no elegiste cuál |
| *"Elige al menos un producto para la promoción."* | Aplica a ciertos productos pero no marcaste ninguno |
| *"Un combo por categoría necesita al menos 2 productos."* | "¿Cuántos productos?" quedó en 1 |
| *"El porcentaje debe estar entre 1 y 100."* | Porcentaje fuera de rango |
| *"Indica el monto a descontar."* | Monto fijo sin cantidad |
| *"No tienes permiso para realizar esta acción."* | Te falta el permiso de esa acción |

---

# Anexo · Lista de capturas

Prefijos: `img-pcat-` Categorías de productos · `img-mod-` Modificadores · `img-prod-` Productos ·
`img-promo-` Promociones.

## Categorías de productos

| Referencia | Qué capturar | Qué marcar |
|---|---|---|
| `img-pcat-001` | Pantalla de Categorías de productos | ① texto gris ② "+ Nueva categoría" ③ buscador ④ columna "Productos" ⑤ botones Editar/Baja |
| `img-pcat-002` | Ventana "Nueva categoría de producto" | El campo Nombre |

## Modificadores

| Referencia | Qué capturar | Qué marcar |
|---|---|---|
| `img-mod-001` | Pantalla de Modificadores | ① texto gris ② "+ Nuevo modificador" ③ columnas Precio extra, Receta y Ganancia ④ columna Productos |
| `img-mod-002` | Ventana "Editar modificador: Extra shot de espresso" con receta | ① Nombre ② Precio extra y su texto ③ sección Receta del extra ④ línea de costo y ganancia |

## Productos

| Referencia | Qué capturar | Qué marcar |
|---|---|---|
| `img-prod-001` | Pantalla de Productos, con uno agotado y uno sin receta | ① "+ Nuevo producto" ② buscador, "Solo agotados" y categorías ③ miniatura ④ "Completa" y "Falta receta" ⑤ etiqueta Agotado ⑥ botones Abrir/Agotar/Baja |
| `img-prod-002` | Ventana "Nuevo producto", parte de arriba | ① Nombre y Categoría ② Descripción ③ sección Foto vacía y su texto |
| `img-prod-003` | Sección Foto con imagen elegida | ① vista previa ② texto de los 640 px |
| `img-prod-004` | Sección "Tamaños y precio" | ① texto gris ② tabla Tamaño/Precio ③ "+ Agregar tamaño" ④ la ✕ |
| `img-prod-005` | Ficha de un frappé con dos tamaños | ① "← Volver a productos" ② "Marcar agotado" ③ datos generales ④ "Guardar datos" ⑤ pestañas Chico/Grande/"+ Tamaño" |
| `img-prod-006` | Recuadro de precio de un tamaño | ① "Precio de «Chico» (con IVA)" ② botones Cambiar precio e Historial |
| `img-prod-007` | Ventana "Cambiar precio" | El texto de que las ventas registradas conservan su precio |
| `img-prod-008` | Ventana "Historial de precios" con 2+ precios | Columnas Desde, Hasta y Quién, y la marca "Actual" |
| `img-prod-009` | Recuadro "Tamaño «Grande»" | Botones Renombrar, Marcar agotado y Dar de baja |
| `img-prod-010` | Tarjeta "Receta de Chico" completa | ① texto de los modos ② tabla Insumo/Cantidad/¿Cuándo?/Costo ③ "+ Agregar insumo" ④ Grupos de opción ⑤ las 4 casillas del costeo ⑥ "Guardar receta" |
| `img-prod-011` | Un grupo de opción "Leche" armado | ① nombre del grupo ② cantidad y ¿Cuándo? ③ opciones y "Predet." ④ "+ Opción" |

## Promociones

| Referencia | Qué capturar | Qué marcar |
|---|---|---|
| `img-promo-001` | Pantalla de Promociones con los tres estados | ① texto gris ② "+ Nueva promoción" ③ filtros y buscador ④ Vigente, Fuera de fecha e Inactiva ⑤ botones Editar/Desactivar |
| `img-promo-002` | Ventana "Nueva promoción", parte de arriba | ① Nombre y Descripción ② Vigente desde / hasta ③ Tipo de promoción |
| `img-promo-003` | Formulario de combo por categoría | ¿A qué aplica?, Categoría, ¿Cuántos productos?, Tipo de descuento, Precio del combo |
| `img-promo-004` | Formulario de descuento por día | Día de la semana, ¿A qué aplica?, Porcentaje |
| `img-promo-005` | Formulario de monto fijo | ¿A qué aplica? con sus dos opciones y Monto a descontar |
| `img-promo-006` | Ventana "Aplicar una promoción" desde un ticket | ① el descuento −$X de cada una ② el botón "Usar" |
| `img-promo-007` | Ticket con promoción aplicada | La línea verde "Promo: …" y el botón "quitar" |

> 💡 **Para las capturas:** arma un solo producto de ejemplo completo —"Frappé Oreo", con Chico y
> Grande, grupo de leche y el vaso "Solo para llevar"— y úsalo en todas las de la Parte 3. Para
> `img-promo-001` vas a necesitar tres promociones: una en fechas, una con fechas pasadas y una
> desactivada.
