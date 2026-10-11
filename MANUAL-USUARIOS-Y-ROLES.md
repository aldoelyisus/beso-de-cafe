# Manual de usuario — Usuarios y Roles

Beso de Café · Punto de venta y gestión interna

Este manual cubre **Roles y permisos** y **Usuarios y personal**. Los demás módulos van en
manuales aparte.

---

## Cómo leer este manual

A lo largo del texto vas a encontrar recuadros como este:

> 🔑 **Permiso necesario:** grupo **Roles y permisos** → casilla **"Crear roles"**
> Sin este permiso el botón **no aparece** en la pantalla.

Significa que esa parte de la aplicación **solo se ve o se usa** si el usuario tiene marcado ese
permiso. Si alguien te dice *"no me sale el botón"*, aquí está la respuesta.

**Regla general del sistema:** cuando un botón no se ve, es porque falta el permiso. Y aunque
alguien lograra llegar a la pantalla por otro camino, la aplicación **rechaza la operación de
todos modos**: esconder el botón es solo una cortesía, la seguridad está en el fondo.

---

## Antes de empezar: cómo se organizan los permisos

Cuando abres la lista de permisos —al crear un rol o al ajustar los de una persona— vas a ver
**casillas agrupadas por módulo**. El encabezado en negritas es el módulo; debajo van sus
permisos.

```
☐ Usuarios y personal
    ☐ Ver el módulo y el listado de usuarios
    ☐ Crear usuarios
    ☐ Editar usuarios
    ☐ Desactivar usuarios
    ☐ Asignar permisos individuales a un usuario

☐ Roles y permisos
    ☐ Ver el módulo y el listado de roles
    ☐ Crear roles
    ☐ Editar roles y sus permisos
    ☐ Eliminar roles
```

Casi todos los módulos siguen el mismo patrón:

| La casilla que dice… | Habilita |
|---|---|
| **"Ver el módulo y el listado de…"** | Entrar a la pantalla **y ver su contenido**. Van juntos: no existe "veo el módulo pero está vacío" |
| **"Crear…"** | El botón de alta (**+ Nuevo…**) |
| **"Editar…"** | El botón **Editar** |
| **"Eliminar…"** o **"Desactivar…"** | El botón de baja |

Y aparte hay **permisos especiales** para las acciones delicadas, que no se incluyen en "Editar".
En este manual verás uno: *"Asignar permisos individuales a un usuario"*.

> ℹ️ **En el menú lateral, "Usuarios y personal" no tiene casilla propia.** El grupo aparece solo
> en cuanto la persona puede ver alguno de sus dos submódulos (Usuarios o Roles). No tienes que
> buscar un permiso extra para que se vea el grupo.

---

# Parte 1 · Roles y permisos

## 1.1 Qué es un rol

Un rol es una **plantilla de permisos**. Sirve para no tener que marcar 53 casillas cada vez que
das de alta a alguien: creas el rol "Cajero" una sola vez y luego todos los cajeros nuevos salen
de ahí.

> ⚠️ **La regla más importante de este módulo:**
> **Editar un rol NO cambia a los usuarios que ya existen.**
> Cuando creas un usuario con un rol, el sistema le saca una **foto** de esos permisos y se la
> guarda. A partir de ese momento el usuario es independiente. Si mañana le agregas un permiso al
> rol "Cajero", los cajeros que ya trabajan contigo **no lo reciben**: solo los que crees después.
>
> Esto es a propósito. Evita que un cambio en la plantilla le dé poderes nuevos a alguien sin que
> nadie se dé cuenta.

## 1.2 Cómo llegar

En el menú lateral, sección **Administración** → **Usuarios y personal** → **Roles y permisos**.

📷 **`img-rol-001`** — Menú lateral con el grupo "Usuarios y personal" desplegado.
**Marcar:** recuadro alrededor de la opción **"Roles y permisos"**.

> 🔑 **Permiso necesario:** grupo **Roles y permisos** → casilla
> **"Ver el módulo y el listado de roles"**
> Sin él, la opción no aparece en el menú. Si alguien llega por otro camino, verá el mensaje
> *"No tienes permiso para ver los roles."*

## 1.3 La pantalla de roles

📷 **`img-rol-002`** — Pantalla completa de "Roles y permisos" con al menos dos roles creados.
**Marcar con números:**
1. El título **"Roles y permisos"** y el texto gris de abajo (el recordatorio de que editar un
   rol no cambia a los usuarios existentes).
2. El botón **"+ Nuevo rol"** (arriba a la derecha).
3. La columna **"Usuarios"** de la tabla.
4. Los botones **"Editar"** y **"Eliminar"** de un renglón.

La tabla tiene cuatro columnas:

| Columna | Qué muestra |
|---|---|
| **Rol** | El nombre que le pusiste |
| **Descripción** | Para qué es. Si la dejaste vacía, aparece un guion |
| **Usuarios** | Cuántas personas tienen ese rol asignado ahora mismo |
| *(última)* | Los botones de acción |

> 🔑 **Permisos de esta pantalla.** Todos están en el grupo **Roles y permisos** de la lista:
>
> | Para… | Hay que marcar la casilla |
> |---|---|
> | Ver la tabla | **"Ver el módulo y el listado de roles"** |
> | Ver el botón **"+ Nuevo rol"** | **"Crear roles"** |
> | Ver el botón **"Editar"** | **"Editar roles y sus permisos"** |
> | Ver el botón **"Eliminar"** | **"Eliminar roles"** |

Si todavía no hay ningún rol, la pantalla dice:
*"Aún no hay roles. Crea el primero para empezar a asignar permisos."*

## 1.4 Crear un rol

**Paso 1.** Da clic en **"+ Nuevo rol"**. Se abre una ventana.

📷 **`img-rol-003`** — Ventana "Nuevo rol", la parte de arriba.
**Marcar:**
1. El campo **"Nombre del rol"**.
2. El campo **"Descripción"** (dice *"Opcional"* debajo).
3. El encabezado **"Permisos de la plantilla"** y el texto gris que lo acompaña.

**Paso 2.** Escribe el **nombre**. Es obligatorio; si lo dejas vacío la aplicación te avisa:
*"El nombre del rol es obligatorio."*

No puede repetirse: si ya existe uno con ese nombre verás *"Ya existe un rol con ese nombre."*

**Paso 3.** La **descripción** es opcional pero conviene ponerla. En seis meses, "Cajero 2" no te
va a decir nada; *"Cajero de turno de tarde, sin cancelaciones"* sí.

**Paso 4.** Marca los permisos.

📷 **`img-rol-004`** — La lista de permisos dentro de la ventana "Nuevo rol", con algunos grupos
marcados y otros a medias.
**Marcar con números:**
1. La casilla **"Seleccionar todos los permisos"** (hasta arriba).
2. La casilla que está junto al **nombre de un módulo** (ej. "Ventas") — la que marca todo el grupo.
3. Una casilla que se vea **a medias** (cuadrito lleno en vez de palomita): significa que ese
   módulo tiene algunos permisos marcados y otros no.
4. Un permiso suelto cualquiera.

La lista está agrupada por módulo. Tienes tres niveles:

- **"Seleccionar todos los permisos"** — marca o desmarca absolutamente todo.
- **La casilla de cada módulo** — marca o desmarca todo ese módulo de golpe.
- **Cada permiso** — uno por uno.

Cuando un módulo tiene solo algunos permisos marcados, su casilla se ve **a medias**. Es la
señal de que ahí adentro hay una mezcla.

**Paso 5.** Da clic en **"Crear rol"**. Aparece el aviso verde *"Rol creado"* y el rol se suma a
la tabla con 0 usuarios.

> 💡 **Consejo:** empieza por marcar la casilla del módulo completo y luego desmarca lo que
> sobre. Es más rápido que ir uno por uno.

## 1.5 Editar un rol

📷 **`img-rol-005`** — Ventana "Editar rol: Cajero".
**Marcar:** el texto gris que dice *"Estos permisos se copiarán a los usuarios NUEVOS que se
creen con este rol. Los usuarios existentes no se modifican."*

Funciona igual que crear, pero el botón dice **"Guardar cambios"**.

> ⚠️ **Recuerda:** los cambios afectan **solo a los usuarios que crees de aquí en adelante**.
> Si quieres cambiarle los permisos a alguien que ya existe, tienes que hacerlo desde su ficha
> (ver **2.7 Permisos individuales**) o volver a asignarle el rol (ver **2.5**).

## 1.6 Eliminar un rol

**Paso 1.** Da clic en **"Eliminar"** en el renglón del rol.

📷 **`img-rol-006`** — Ventana de confirmación con el texto *"¿Eliminar el rol «Cajero»?"*.
**Marcar:** los botones **"Cancelar"** y **"Confirmar"**.

**Paso 2.** Confirma. Aparece *"Rol eliminado"*.

**Un rol con gente asignada no se puede borrar.** Si lo intentas, la aplicación te frena y te
dice exactamente cuántas personas lo usan:

📷 **`img-rol-007`** — El aviso rojo *"No se puede eliminar: 2 usuario(s) tienen este rol.
Reasigna esos usuarios primero."*
**Marcar:** el aviso completo.

Para poder borrarlo, primero cámbiale el rol a esas personas desde **Usuarios**.

> 💡 La columna **"Usuarios"** de la tabla te dice de antemano si vas a poder borrarlo: si dice
> 0, sí; si dice cualquier otra cosa, no.

## 1.7 Mensajes que puedes ver en este módulo

| Mensaje | Qué pasó |
|---|---|
| *"El nombre del rol es obligatorio."* | Dejaste el nombre vacío o con puros espacios |
| *"Ya existe un rol con ese nombre."* | Otro rol se llama igual |
| *"No se puede eliminar: N usuario(s) tienen este rol…"* | Hay gente usándolo |
| *"El rol no existe."* | Alguien lo borró desde otra parte mientras lo tenías abierto |
| *"No tienes permiso para realizar esta acción."* | Te falta el permiso de esa acción |

---

# Parte 2 · Usuarios y personal

## 2.1 Cómo llegar

Menú lateral → **Administración** → **Usuarios y personal** → **Usuarios**.

> 🔑 **Permiso necesario:** grupo **Usuarios y personal** → casilla
> **"Ver el módulo y el listado de usuarios"**

## 2.2 La pantalla de usuarios

📷 **`img-user-001`** — Pantalla completa de "Usuarios y personal" con al menos tres personas,
una de ellas desactivada.
**Marcar con números:**
1. El título y el texto gris *"Los usuarios no se borran: se desactivan para conservar el
   historial de ventas."*
2. El botón **"+ Nuevo usuario"**.
3. La columna **"Rol"** con su etiqueta de color.
4. La columna **"Estado"**, señalando una fila **Activo** y una **Desactivado**.
5. Una fila desactivada completa (se ve más tenue que las demás).

| Columna | Qué muestra |
|---|---|
| **Nombre** | El nombre completo de la persona |
| **Usuario** | Con qué escribe para entrar, con `@` adelante |
| **Rol** | El rol asignado, o *"Sin rol"* |
| **Teléfono** | El de contacto, o un guion |
| **Estado** | **Activo** o **Desactivado** |

> 🔑 **Permisos de esta pantalla.** Todos están en el grupo **Usuarios y personal** de la lista:
>
> | Para… | Hay que marcar la casilla |
> |---|---|
> | Ver la tabla | **"Ver el módulo y el listado de usuarios"** |
> | Ver el botón **"+ Nuevo usuario"** | **"Crear usuarios"** |
> | Ver los botones **"Editar"** y **"Acceso"** | **"Editar usuarios"** |
> | Ver el botón **"Permisos"** | **"Asignar permisos individuales a un usuario"** |
> | Ver **"Desactivar"** / **"Reactivar"** | **"Desactivar usuarios"** |

> ℹ️ **El administrador del sistema nunca aparece en esta lista.** Es una cuenta interna de
> rescate (usuario `admin`) que no se puede editar, desactivar ni borrar desde la aplicación.
> Si algún día quedan todos los usuarios bloqueados, con ella se entra a arreglarlo.

## 2.3 Crear un usuario

**Paso 1.** Da clic en **"+ Nuevo usuario"**.

📷 **`img-user-002`** — Ventana "Nuevo usuario", sección **Datos de acceso**.
**Marcar con números:**
1. **Nombre completo**
2. **Nombre de usuario** y su texto de ayuda *"Se usa para iniciar sesión"*
3. **Contraseña** y su texto *"Mínimo 4 caracteres"*
4. El desplegable **Rol** y su texto *"Al crear el usuario se copian los permisos actuales del rol."*

📷 **`img-user-003`** — La misma ventana, sección **Área de personal** (más abajo).
**Marcar:** los tres campos: **Teléfono de contacto**, **Contacto de emergencia** y
**Teléfono de emergencia**.

**Los campos, uno por uno:**

| Campo | ¿Obligatorio? | Notas |
|---|---|---|
| **Nombre completo** | Sí | Es el que se ve en la tabla y en la bitácora |
| **Nombre de usuario** | Sí | Con esto entra al sistema. **No distingue mayúsculas ni acentos**: quien se dé de alta como "Lupita" puede entrar tecleando `lupita` o `LUPITA`. Por lo mismo, no puedes crear "Lupita" y "LUPITA" como dos personas |
| **Contraseña** | Sí | Mínimo 4 caracteres. **Esta sí distingue mayúsculas y espacios** |
| **Rol** | No | Puedes dejar *"Sin rol"* y darle permisos uno por uno después |
| **Área de personal** | No | Teléfono y contacto de emergencia. Solo información, no afecta permisos |

**Paso 2.** Da clic en **"Crear usuario"**. Aparece *"Usuario creado"*.

### Qué pasa por dentro al elegir un rol

Al momento de crear al usuario, el sistema **copia** los permisos del rol y se los guarda como
suyos. Es la **foto** de la que habla la sección 1.1.

> A partir de ese instante, ese usuario ya no depende del rol. El rol solo dice de dónde salieron
> sus permisos la primera vez.

## 2.4 Los botones de cada persona

📷 **`img-user-004`** — Acercamiento a un renglón de la tabla mostrando sus botones.
**Marcar cada botón con su nombre:** **Editar**, **Acceso**, **Permisos**, **Desactivar**.

| Botón | Para qué | Casilla que lo hace visible |
|---|---|---|
| **Editar** | Nombre, rol y área de personal | "Editar usuarios" |
| **Acceso** | Cambiar su nombre de usuario o su contraseña | "Editar usuarios" |
| **Permisos** | Ajustar sus permisos uno por uno | "Asignar permisos individuales a un usuario" |
| **Desactivar** / **Reactivar** | Darlo de baja o traerlo de vuelta | "Desactivar usuarios" |

> ⚠️ **En tu propio renglón faltan dos botones a propósito.**
> No verás **"Permisos"** ni **"Desactivar"** sobre ti mismo. Nadie puede ampliarse sus propios
> permisos ni dejarse fuera del sistema, ni siquiera el administrador. Si necesitas cambiar los
> tuyos, tiene que hacerlo otro administrador.

## 2.5 Editar un usuario

📷 **`img-user-005`** — Ventana "Editar usuario: Ana".
**Marcar:**
1. Que **no aparecen** los campos de nombre de usuario ni contraseña (esos van en **Acceso**).
2. El desplegable **Rol** y su texto de ayuda, que aquí cambia a *"Al cambiar el rol se vuelven a
   copiar sus permisos (los permisos individuales se conservan)."*

Aquí cambias el nombre, el rol y los datos de personal.

**Si cambias el rol**, el sistema vuelve a sacar la foto: le quita los permisos que traía
heredados y le pone los del rol nuevo. **Los permisos que le hubieras puesto a mano se
conservan** — esos son suyos, no del rol.

## 2.6 Cambiar el usuario o la contraseña (botón "Acceso")

📷 **`img-user-006`** — Ventana "Acceso de Ana".
**Marcar con números:**
1. La sección **"Nombre de usuario"** con su campo y el botón **"Cambiar nombre de usuario"**.
2. La sección **"Contraseña"** con el campo **"Nueva contraseña"** y el botón
   **"Restablecer contraseña"**.

Son dos operaciones **independientes**: cada botón guarda lo suyo por separado.

- **Cambiar nombre de usuario** — no puede quedar vacío ni chocar con el de otra persona.
  Al terminar aparece *"Nombre de usuario actualizado"*.
- **Restablecer contraseña** — se usa cuando alguien la olvidó. **No necesitas saber la
  anterior.** Mínimo 4 caracteres. Al terminar aparece *"Contraseña restablecida"* y el campo
  se limpia.

> ℹ️ La contraseña vieja deja de funcionar en ese momento. Avísale a la persona cuál es la nueva.

## 2.7 Permisos individuales (botón "Permisos")

Sirve para dos cosas: **darle a alguien un permiso extra** que su rol no trae, o **quitarle uno**
que sí trae.

📷 **`img-user-007`** — Ventana "Permisos de Beto Cajero".
**Marcar con números:**
1. El texto gris de arriba, que explica que son los permisos efectivos.
2. Una etiqueta **"del rol"** junto a un permiso.
3. Un permiso marcado que **no** tenga esa etiqueta (uno que le pusiste a mano).

La lista se ve igual que la de los roles, con una diferencia: los permisos que vinieron del rol
traen la etiqueta **"del rol"**. Los que no la traen se los pusiste tú a mano.

Marca o desmarca lo que necesites y da clic en **"Guardar permisos"**. Aparece
*"Permisos actualizados"*.

> 🔑 **Este botón necesita su propia casilla:**
> **"Asignar permisos individuales a un usuario"**, que es **distinta** de "Editar usuarios".
>
> Están separadas a propósito: quien puede repartir permisos puede volver administrador a
> cualquiera. Que alguien pueda corregir un teléfono no significa que deba poder hacer eso.
> Marcar "Editar usuarios" **no** le da este botón.

> ⚠️ **Los permisos nuevos no aplican de inmediato.** Si la persona tiene la sesión abierta,
> tiene que **salir y volver a entrar** para que le tomen efecto.

## 2.8 Desactivar y reactivar

En este sistema **los usuarios no se borran nunca**. Se desactivan. Así el historial de ventas
sigue mostrando quién cobró qué, aunque esa persona ya no trabaje contigo.

**Paso 1.** Da clic en **"Desactivar"**.

📷 **`img-user-008`** — Ventana de confirmación: *"¿Desactivar a «Beto Cajero»? Podrás
reactivarlo después."*
**Marcar:** los botones **"Cancelar"** y **"Desactivar"**.

**Paso 2.** Confirma. Aparece *"Usuario desactivado"*.

📷 **`img-user-009`** — El renglón de esa persona ya desactivado.
**Marcar:**
1. La etiqueta roja **"Desactivado"** en la columna Estado.
2. El botón, que ahora dice **"Reactivar"**.
3. Que el renglón completo se ve más tenue.

**Qué le pasa a esa persona:**

- **Ya no puede entrar.** Si lo intenta, ve el mensaje
  *"Este usuario está desactivado. Contacta a un administrador."*
- **Si estaba trabajando en ese momento, deja de operar de inmediato.** No espera a que cierre
  sesión: la siguiente cosa que intente le dirá *"Tu usuario fue desactivado. Vuelve a iniciar
  sesión."*
- **Sus ventas y sus registros se quedan.** Nada se borra.

📷 **`img-user-010`** — Pantalla de inicio de sesión mostrando el error de usuario desactivado.
**Marcar:** el recuadro rojo con el mensaje.

Para traerlo de vuelta, da clic en **"Reactivar"**. Conserva su rol, sus permisos y su
contraseña tal como los tenía.

## 2.9 Mensajes que puedes ver en este módulo

| Mensaje | Qué pasó |
|---|---|
| *"El nombre es obligatorio."* | Falta el nombre completo |
| *"El nombre de usuario es obligatorio."* | Falta el nombre de usuario |
| *"La contraseña debe tener al menos 4 caracteres."* | Contraseña muy corta |
| *"Ese nombre de usuario ya está en uso."* | Otra persona ya lo tiene (recuerda: no distingue mayúsculas ni acentos) |
| *"No puedes desactivar tu propio usuario."* | Intentaste darte de baja a ti mismo |
| *"No puedes cambiar tus propios permisos. Pídeselo a otro administrador."* | Intentaste editar tus propios permisos |
| *"El usuario no existe."* | Alguien lo borró mientras lo tenías abierto |
| *"No tienes permiso para realizar esta acción."* | Te falta el permiso de esa acción |
| *"Tu usuario fue desactivado. Vuelve a iniciar sesión."* | Te desactivaron mientras trabajabas |

---

# Parte 3 · Cómo dejar la cafetería lista desde cero

Este es el orden recomendado la primera vez.

**1. Entra con el administrador interno.**
Usuario `admin`, contraseña `admin123`.

> ⚠️ **Cambia esa contraseña el primer día.** Es pública, viene en la documentación.

**2. Crea el rol *Administrador*.**
Roles y permisos → **+ Nuevo rol** → nombre "Administrador" → marca
**"Seleccionar todos los permisos"** → **Crear rol**.

**3. Crea tu usuario personal con ese rol.**
Usuarios → **+ Nuevo usuario** → tus datos → Rol: *Administrador* → **Crear usuario**.

**4. Sal y vuelve a entrar con tu usuario.**
De aquí en adelante trabaja con el tuyo, no con `admin`. Así la bitácora registra tu nombre en
cada movimiento.

**5. Crea los roles de cajero.**
Estas combinaciones están probadas y funcionan. Marca exactamente estas casillas:

**Cajero básico** — puede vender y manejar la caja.

| Grupo | Casillas a marcar |
|---|---|
| **Ventas** | ☑ Abrir el punto de venta<br>☑ Abrir cuentas y agregar productos<br>☑ Cobrar cuentas (completo o dividido) |
| **Corte de caja** | ☑ Ver el corte de caja<br>☑ Abrir y cerrar la caja, y registrar entradas / salidas de efectivo |

**Cajero con mando** — lo anterior **más** estas cuatro:

| Grupo | Casillas a agregar | Para qué |
|---|---|---|
| **Ventas** | ☑ Cancelar productos y ventas | Cancelar lo que se equivocó |
| **Ventas** | ☑ Ver el historial de ventas (pantalla aparte) | Revisar el día |
| **Promociones** | ☑ Aplicar una promoción a una cuenta | Aplicar promos en el ticket |
| **Insumos** | ☑ Ver el módulo y el listado de insumos | Consultar existencias |

> ℹ️ Fíjate en lo que **no** lleva ninguno de los dos: no pueden cambiar precios, ni tocar el
> costo de los insumos, ni cerrar el día, ni entrar a Usuarios. Eso se queda contigo.

**6. Da de alta a tus cajeros** con el rol que les toque.

**7. Guarda el `admin` para emergencias.** No lo uses para el día a día.

> 📄 El listado completo de los 53 permisos, con lo que hace cada uno y en qué pantalla se nota,
> está en el documento **PERMISOS.md** (ese sí trae la clave técnica de cada uno, por si algún
> día alguien tiene que revisar el sistema por dentro).

---

# Anexo · Lista de capturas

Las imágenes van nombradas por módulo y numeradas en el orden en que aparecen en el texto.

## Módulo Roles

| Referencia | Qué capturar | Qué marcar |
|---|---|---|
| `img-rol-001` | Menú lateral con "Usuarios y personal" desplegado | Recuadro en **"Roles y permisos"** |
| `img-rol-002` | Pantalla de Roles con 2+ roles | ① título y texto gris ② "+ Nuevo rol" ③ columna "Usuarios" ④ botones Editar/Eliminar |
| `img-rol-003` | Ventana "Nuevo rol", parte de arriba | ① Nombre del rol ② Descripción ③ "Permisos de la plantilla" y su texto gris |
| `img-rol-004` | La lista de permisos dentro de la ventana | ① "Seleccionar todos" ② casilla de un módulo ③ una casilla a medias ④ un permiso suelto |
| `img-rol-005` | Ventana "Editar rol: Cajero" | El texto gris sobre usuarios NUEVOS vs existentes |
| `img-rol-006` | Confirmación de eliminar rol | Botones "Cancelar" y "Confirmar" |
| `img-rol-007` | Error al eliminar un rol en uso | El aviso rojo completo |

## Módulo Usuarios

| Referencia | Qué capturar | Qué marcar |
|---|---|---|
| `img-user-001` | Pantalla de Usuarios con 3+ personas, una desactivada | ① título y texto gris ② "+ Nuevo usuario" ③ columna Rol ④ columna Estado (Activo y Desactivado) ⑤ una fila desactivada |
| `img-user-002` | Ventana "Nuevo usuario", sección Datos de acceso | ① Nombre completo ② Nombre de usuario ③ Contraseña ④ Rol y su texto de ayuda |
| `img-user-003` | La misma ventana, sección Área de personal | Los tres campos |
| `img-user-004` | Acercamiento a un renglón con sus botones | Cada botón con su nombre: Editar, Acceso, Permisos, Desactivar |
| `img-user-005` | Ventana "Editar usuario" | ① que faltan usuario y contraseña ② el desplegable Rol y su texto |
| `img-user-006` | Ventana "Acceso de …" | ① sección Nombre de usuario + su botón ② sección Contraseña + su botón |
| `img-user-007` | Ventana "Permisos de …" | ① texto gris de arriba ② etiqueta "del rol" ③ un permiso marcado sin esa etiqueta |
| `img-user-008` | Confirmación de desactivar | Botones "Cancelar" y "Desactivar" |
| `img-user-009` | Renglón ya desactivado | ① etiqueta "Desactivado" ② botón "Reactivar" ③ el renglón atenuado |
| `img-user-010` | Login con el error de usuario desactivado | El recuadro rojo del mensaje |

> 💡 **Consejo para las capturas:** toma todas con la misma persona de ejemplo (por ejemplo
> "Beto Cajero") para que el manual se lea como una sola historia. Y si vas a mostrar datos
> reales, cambia teléfonos y nombres por inventados antes de capturar.
