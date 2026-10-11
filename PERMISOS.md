# Permisos de Beso de Café

> Generado desde el código (`src/main/permissions/registry.js`) y **verificado**: se crea un
> usuario por cada permiso, a solas, y se abre cada pantalla de verdad. Si cambias los
> permisos, vuelve a correr `scratchpad/qa-permiso-por-permiso.js` y regenera este archivo.

**57 permisos.** Clave: `<modulo>.<accion>`.

## Cómo leerlos

- **`view`** = *entrar al módulo y ver su listado*. Van juntos a propósito: no existe el estado
  "veo el módulo en el menú pero adentro no hay nada".
- **`create` / `edit` / `delete`** = los botones de la pantalla. Sin ellos se ve igual, pero de
  solo lectura: los botones **no aparecen**.
- Las **acciones sensibles tienen permiso propio** aunque parezcan parte de "editar":
  `productos.precio`, `productos.receta`, `insumos.costo`, `users.permissions`.
- **Los grupos del menú no tienen permiso propio.** "Inventario", "Menú y recetas", "Ventas" y
  "Usuarios y personal" aparecen solos en cuanto el usuario puede ver **alguno** de sus
  submódulos, y el grupo lleva al primer destino que sí puede abrir.

---

## Operación

### Ventas

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `ventas.view` | Abrir el punto de venta | `#/pos`, `#/venta/:id` | — |
| `ventas.list` | Ver el historial de ventas (pantalla aparte) | `#/ventas-historial` | — |
| `ventas.crear` | Abrir cuentas y agregar productos | — | Punto de venta, Ticket de una cuenta |
| `ventas.cobrar` | Cobrar cuentas (completo o dividido) | — | Ticket de una cuenta |
| `ventas.cancelar` | Cancelar productos y ventas | — | Historial de ventas, Ticket de una cuenta |

### Corte de caja

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `caja.view` | Ver el corte de caja | `#/caja` | — |
| `caja.turno` | Abrir y cerrar la caja, y registrar entradas / salidas de efectivo | — | Corte de caja |
| `caja.cierre_dia` | Cerrar y reabrir el día | — | Corte de caja (también el paso "¿Ya terminaste el día?" al cerrar la caja) |

### Mesas

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `mesas.view` | Ver y configurar las mesas | `#/mesas` | — |
| `mesas.create` | Agregar mesas | — | Mesas |
| `mesas.edit` | Editar / renombrar mesas | — | Mesas |
| `mesas.delete` | Dar de baja / reactivar mesas | — | Mesas |

### Reportes

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `reportes.view` | Ver reportes | `#/reportes` | — |
| `reportes.export` | Exportar reportes a PDF / Excel | — | Reportes |

## Catálogo

### Menú y recetas

*Grupo del menú, sin permiso propio.* Aparece cuando el usuario puede ver alguno de sus
submódulos: **Productos, Categorías de productos, Modificadores o Promociones**.

### Productos

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `productos.view` | Ver el módulo y el listado de productos | `#/productos`, `#/productos/:id` | — |
| `productos.create` | Crear productos | — | Productos |
| `productos.edit` | Editar productos (datos, tamaños, agotado) | — | Editor de producto, Productos |
| `productos.delete` | Dar de baja productos | — | Productos |
| `productos.precio` | Cambiar el precio de un producto | — | Editor de producto |
| `productos.receta` | Editar la receta de un producto | — | Editor de producto, Productos |

### Categorías de productos

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `producto_categorias.view` | Ver el módulo y el listado de categorías de productos | `#/producto-categorias` | — |
| `producto_categorias.create` | Crear categorías de productos | — | Categorías de productos |
| `producto_categorias.edit` | Editar categorías de productos | — | Categorías de productos |
| `producto_categorias.delete` | Dar de baja / reactivar categorías de productos | — | Categorías de productos |

### Modificadores

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `modificadores.view` | Ver el módulo y el listado de modificadores | `#/modificadores` | — |
| `modificadores.create` | Crear modificadores | — | Modificadores |
| `modificadores.edit` | Editar modificadores y su receta | — | Modificadores |
| `modificadores.delete` | Dar de baja / reactivar modificadores | — | Modificadores |

### Promociones

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `promociones.view` | Ver el módulo y el listado de promociones | `#/promociones` | — |
| `promociones.create` | Crear promociones | — | Promociones |
| `promociones.edit` | Editar promociones | — | Promociones |
| `promociones.delete` | Activar / desactivar promociones | — | Promociones |
| `promociones.aplicar` | Aplicar una promoción a una cuenta | — | Ticket de una cuenta |

### Inventario

*Grupo del menú, sin permiso propio.* Aparece cuando el usuario puede ver alguno de sus
submódulos: **Insumos o Categorías de insumos**.

### Insumos

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `insumos.view` | Ver el módulo y el listado de insumos | `#/insumos` | — |
| `insumos.create` | Crear insumos | — | Insumos |
| `insumos.edit` | Editar insumos | — | Insumos |
| `insumos.delete` | Dar de baja insumos | — | Insumos |
| `insumos.stock` | Registrar entradas, merma y ajustes de existencias | — | Insumos |
| `insumos.costo` | Corregir a mano el costo de un insumo | — | Insumos |

### Categorías de insumos

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `insumo_categorias.view` | Ver el módulo y el listado de categorías de insumos | `#/insumo-categorias` | — |
| `insumo_categorias.create` | Crear categorías de insumos | — | Categorías de insumos |
| `insumo_categorias.edit` | Editar categorías de insumos | — | Categorías de insumos |
| `insumo_categorias.delete` | Dar de baja / reactivar categorías de insumos | — | Categorías de insumos |

## Administración

### Usuarios y personal

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `users.view` | Ver el módulo y el listado de usuarios | `#/users` | Usuarios |
| `users.create` | Crear usuarios | — | Usuarios |
| `users.edit` | Editar usuarios | — | Usuarios |
| `users.delete` | Desactivar usuarios | — | Usuarios |
| `users.permissions` | Asignar permisos individuales a un usuario | — | Usuarios |

### Roles y permisos

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `roles.view` | Ver el módulo y el listado de roles | `#/roles` | Roles, Usuarios |
| `roles.create` | Crear roles | — | Roles |
| `roles.edit` | Editar roles y sus permisos | — | Roles |
| `roles.delete` | Eliminar roles | — | Roles |

### Respaldos

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `respaldos.view` | Ver la pantalla de respaldos | `#/respaldos` | — |
| `respaldos.crear` | Hacer un respaldo manual de la base de datos | — | Respaldos |

### Actualizar el programa

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `actualizaciones.view` | Ver la versión del programa y el historial de actualizaciones | `#/actualizaciones` | — |
| `actualizaciones.aplicar` | Aplicar un archivo de actualización (y deshacerlo) | — | Actualizar el programa |

### Bitácora del sistema

| Permiso | Qué habilita | Pantalla que abre | Botones que enseña |
|---|---|---|---|
| `logs.view` | Ver la bitácora del sistema | `#/logs` | — |

---

## Recetas de rol

Probadas: con estos permisos las pantallas abren y se pueden usar.

```
Cajero básico       ventas.view + ventas.crear + ventas.cobrar
                    + caja.view + caja.turno

Cajero con mando    lo anterior
                    + ventas.cancelar       cancelar productos y ventas
                    + ventas.list           ver el historial del día
                    + promociones.aplicar   aplicar promos en el ticket
                    + insumos.view          consultar existencias

Encargado de        insumos.view + insumos.stock    recibe mercancía y registra merma
almacén             + insumo_categorias.view
                    (sin insumos.costo: no decide cuánto vale nada)

Administrador       todos
```

## Errores fáciles de cometer

| Si marcas… | …pasa esto |
|---|---|
| `ventas.view` sin `ventas.crear` | El punto de venta abre, pero el catálogo dice *"No tienes permiso para agregar productos"*. Sirve para quien solo consulta. |
| `insumos.stock` sin `insumos.costo` | Recibe mercancía y registra merma, pero **no** corrige el costo a mano. Es lo normal para un almacenista. |
| `users.edit` sin `users.permissions` | Corrige el teléfono de alguien pero **no** reparte permisos. Separados a propósito: repartir permisos es volver administrador a cualquiera. |
| `productos.edit` sin `productos.precio` | Edita nombre, tamaños y "agotado", pero no toca precios. |
| Solo `ventas.list` | Ve el **historial con el dinero del día** sin poder vender. Es una pantalla aparte, no el listado del punto de venta. |
| `mesas.view` a un cajero | **No hace falta.** El mapa de mesas del punto de venta va con `ventas.view`; `mesas.view` es para *configurar* las mesas. |

## Reglas que el sistema aplica solo

- **Nadie cambia sus propios permisos** ni se desactiva a sí mismo, ni siendo administrador.
- **El administrador interno (`admin`) es invisible**: no sale en el listado y no se le puede
  editar, desactivar ni cambiar la contraseña desde la interfaz. Es la llave de rescate.
- **Editar un rol NO cambia a los usuarios ya creados**: al crear un usuario se copia una *foto*
  de los permisos del rol y desde ahí es independiente.
- **Los permisos nuevos no aplican a una sesión ya abierta**: hay que volver a entrar.
- **Si desactivan a alguien mientras trabaja**, deja de operar en ese momento.
- Toda la validación vive en `src/main/ipc/index.js`. Ocultar un botón es solo cortesía:
  aunque alguien llegue tecleando la URL, el canal lo rechaza igual.
