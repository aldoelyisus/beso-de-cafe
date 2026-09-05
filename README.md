# Beso de Café — Punto de venta y gestión interna

Aplicación de escritorio (Windows), **offline**. Toda la información se guarda en la
misma laptop en un archivo SQLite.

> **Orden de construcción y avance del proyecto:** ver [FLUJO-DE-TRABAJO.md](FLUJO-DE-TRABAJO.md).

## Stack

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Contenedor | **Electron** | app de escritorio con HTML/CSS/JS |
| Base de datos | **better-sqlite3** (SQLite local) | sin servidor, sin internet, un archivo |
| Contraseñas | `scrypt` (módulo `crypto` de Node) | sin dependencias nativas extra |
| Interfaz | JavaScript "vanilla" + ES modules | sin framework ni bundler: fácil de mantener |

## Estructura

```
src/
  main/                 proceso principal (Node): acceso a datos y lógica
    db/
      connection.js     abre el archivo SQLite
      migrate.js        aplica migraciones .sql numeradas
      migrations/       001_init.sql, 002_...  (nunca editar una ya aplicada)
      seed.js           sincroniza permisos desde código + crea admin
    permissions/
      registry.js       ÚNICA fuente de verdad de los permisos y del menú
    security/           hash de contraseñas + sesión en memoria
    services/           authService / userService / roleService / permissionService
    ipc/index.js        expone la lógica al renderer + valida permisos
    index.js            arranque de la app y ventana
  preload/index.js      puente seguro (window.api)
  renderer/             interfaz
    app.js              arranque + router por hash
    components/         sidebar (menú desplegable), permissionPicker
    views/              login, users, roles
```

### Arquitectura en una frase

`renderer` (solo UI) → `window.api` (preload) → `ipc` (valida sesión y permisos) →
`services` (reglas de negocio) → `db` (SQLite).
**Toda la seguridad se valida en `ipc`**, el renderer solo oculta botones.

## Cómo correr

```bash
npm install        # instala y recompila better-sqlite3 para Electron
npm start
```

Con DevTools:  `set BESO_DEVTOOLS=1 && npm start`

| Comando | Qué hace |
|---|---|
| `npm start` | Abre la app |
| `npm test` | Corre las pruebas unitarias (`test/`) |
| `npm run reset-db` | Borra la base de datos local (se recrea limpia al abrir) |
| `npm run dist` | Genera el instalador `.exe` |

### Pruebas

`npm test` ejecuta los `test/**/*.test.js` con `node:test`, bajo el runtime de Electron
(`scripts/test.js` fija `ELECTRON_RUN_AS_NODE=1` porque `better-sqlite3` está compilado
para el ABI de Electron). Cada prueba corre contra una BD SQLite limpia en un archivo
temporal. **218 pruebas** que cubren toda la lógica de negocio: inventario, menú,
ventas, promociones, caja / cierre de día, y reportes (resumen, por producto,
insumos usados, merma, y la combinación snapshot de días cerrados + cálculo en vivo).

## Usuario administrador

En el primer arranque se crea un usuario interno **oculto** en los listados:

```
usuario:    admin
contraseña: admin123
```

Este usuario tiene todos los permisos. **Cambia la contraseña** desde
Usuarios → (no aparece; hazlo por código o crea otro admin y desactívalo más adelante).
> Nota: por ser `is_system`, no aparece en la tabla de usuarios a propósito.

## Modelo de permisos (importante)

1. Los **permisos** se definen en `src/main/permissions/registry.js` (en código).
   Se sincronizan a la base en cada arranque. Módulos actuales:
   - `users.*` y `roles.*` con acciones `view` (ver en el menú), `list`, `create`, `edit`, `delete`.
   - `logs.view` — **único permiso** de la bitácora. No existen `logs.create/edit/delete`:
     nadie puede modificar ni borrar la bitácora.
   - `inventory.view` (menú), `insumos.*` (view/list/create/edit/delete/**stock**),
     `insumo_categorias.*` (view/list/create/edit/delete).
2. Los **roles** se crean desde la interfaz y son una **plantilla** de permisos.
3. Al **crear un usuario** con un rol, se toma una *foto* de los permisos del rol
   y se copian al usuario (`user_permissions.from_role = 1`).
4. **Editar un rol después NO afecta** a los usuarios ya creados — solo a los
   que se creen a partir de ese momento.
5. A un usuario se le pueden dar **permisos individuales** extra (o quitarle
   heredados) sin tocar el rol (`from_role = 0`).
6. Cambiar el rol de un usuario vuelve a copiar los permisos heredados;
   los permisos manuales se conservan.

## Bitácora del sistema (`audit_log`)

Registro **solo lectura**. La única forma de escribir es `logService.writeLog`,
que llaman los servicios y la capa `ipc`. No hay endpoint ni permiso para
crear, editar o borrar registros.

Acciones registradas hoy:

| Código | Cuándo |
|--------|--------|
| `auth.login.success` / `auth.login.failed` | inicio de sesión correcto / fallido (guarda el usuario intentado) |
| `auth.logout` | cierre de sesión |
| `roles.create` / `roles.update` / `roles.delete` | alta / edición / baja de roles |
| `roles.permissions` | permisos asignados o quitados a un rol (con el detalle de qué cambió) |
| `users.create` / `users.update` / `users.deactivate` / `users.activate` | alta / edición / baja lógica / reactivación |
| `users.username_change` / `users.password_reset` | cambio de usuario / restablecer contraseña |
| `users.permissions` | permisos individuales asignados o quitados a un usuario |

Para registrar una acción nueva: llama `logService.writeLog({ action, detail })`
desde el handler correspondiente en `src/main/ipc/index.js` (usa el helper `audit()`).

## Inventario — insumos

**Unidad base** (`ml` / `g` / `pieza`): en ella se lleva el stock y se descontarán
las recetas. Vive en el insumo; la categoría solo trae una unidad *sugerida* que
autocompleta el formulario.

**Presentación de compra**: `unidad_compra` (texto: "Litro", "Bolsa 1 kg"),
`factor_compra` (cuántas unidades base trae — 1 L = 1000 ml) y `costo_compra`
(precio de la última compra por unidad de compra).

**Costo para recetas** (`costo_unitario`, por unidad base): **promedio ponderado**.
Cada entrada lo recalcula:
`(stock·costo_actual + entra·costo_entrada) / (stock + entra)`.

**Existencias** = tabla `inventory_movements` (ledger, nunca se edita) + campo
`stock` en el insumo para consulta rápida. Tipos de movimiento:

| Tipo | Efecto | Captura |
|------|--------|---------|
| `entrada` | + stock, recalcula costo promedio | cantidad en unidad de **compra** |
| `merma` | − stock, exige **motivo** (caducidad/derrame/error de preparación/otro) | cantidad en unidad **base** |
| `ajuste` | fija el stock al **conteo físico**, guarda la diferencia | conteo en unidad **base** |
| `consumo` | − stock (automático al vender — fase futura) | — |

Alerta "por acabarse": `stock <= stock_minimo`. **Insumos y categorías usan baja
lógica** (`is_active = 0`), igual que usuarios: nada se borra de la base. Una
categoría dada de baja deja de ofrecerse para insumos nuevos, pero los que ya la
tienen la conservan.

Los listados de insumos y categorías **paginan de 15** (`src/main/services/pagination.js`).
El servicio devuelve `{ rows, total, page, pageSize, totalPages }`.

Categorías de insumo sembradas al inicio (solo si la tabla está vacía), según la
lista real del cliente: Café, Lácteos, Jarabes, Salsas y coberturas, Bases y polvos,
Toppings y complementos, Aguas y mixers, Tisanas e infusiones, Repostería, Desechables.

El formulario de insumo tiene un atajo de presentación de compra
(**Suelto · Por kilo · Por litro · Otra**) que rellena el factor (p. ej. 1 kg = 1000 g).

Para empezar de cero con datos limpios: `npm run reset-db` (borra el archivo SQLite;
se recrea al abrir la app).

## Productos, tamaños y recetas

- **producto_categorias** (Frappés, Cafés, …) — sembradas, baja lógica.
- **productos** → tienen 1+ **producto_presentaciones** (tamaños). Producto simple = 1 tamaño
  "Único"; un frappé = "Chico" y "Grande". **El precio y la receta viven en el tamaño.**
- **presentacion_precios**: historial con vigencia. `cambiarPrecio` cierra el renglón actual
  (`vigente_hasta = now`) y abre uno nuevo. Una venta guardará el precio vigente a su fecha.
  Los precios **ya incluyen IVA**.
- **receta_items** (por tamaño): `(insumo, cantidad_base, modo)`.
  `modo` = `siempre` · `llevar` (vaso desechable para pedidos para llevar) · `aqui`.
  Costo de un tamaño = Σ (cantidad × `costo_unitario`); se calcula para **aquí** y **para llevar**.
- **receta_grupos** + **receta_grupo_opciones**: un renglón de receta donde el cliente elige
  un insumo entre varios (misma cantidad), con opción **predeterminada** (ej. "Leche":
  entera / deslactosada). El costeo usa la predeterminada; en la venta se elige cuál.
  Todas las opciones de un grupo deben usar la misma unidad base.
- **modificadores** ("Extra shot de espresso"): `precio_extra` + `modificador_items` (mini-receta).
  Se asignan por producto (`producto_modificadores`).

Editor: `#/productos/:id` — datos + pestañas por tamaño (precio, editor de receta, costeo en vivo).

## Ventas y mesas (`ventas`, migración 007)

- **mesas** — configurables, baja lógica. `ventas` (ticket): `abierta` / `pagada` / `cancelada`.
- **Cuenta unificada por mesa**: abrir una mesa con cuenta abierta devuelve la misma; el mesero
  no registra quién pidió qué.
- **venta_items** — 1 renglón por unidad. Snapshot de `producto_nombre`, `presentacion_nombre`,
  `precio_unitario` (precio vigente al momento). `venta_item_modificadores` / `venta_item_opciones`
  guardan el extra shot y la opción de grupo elegida (ej. leche deslactosada).
- **venta_item_consumo** — lo que consumió del inventario cada renglón (para devolver exacto al cancelar).
  Al agregar: movimiento `consumo`; al cancelar item / venta: `devolucion`.
- **venta_pagos** — `monto`, `metodo` (`efectivo`/`transferencia`), `etiqueta` opcional,
  `recibido` / `cambio` (efectivo recibido y cambio a dar; migración 011). El cambio se
  calcula sobre el `monto` **con descuento de promoción ya aplicado**.
  La cuenta se cierra (`pagada`) cuando todos los items activos tienen `pago_id`.
  Dividir = varios pagos parciales; cada item apunta a su pago.
- **Cancelar venta pagada** (`ventaService.cancelarVenta`): la marca `cancelada`, regresa todo
  el inventario, se ve en el Historial de ventas.
- Precios **con IVA incluido**: el total es la suma directa, sin desglose.
- Vistas: `#/pos` (mapa), `#/venta/:id` (ticket + cobro), `#/ventas-historial`, `#/mesas`.

## Promociones (`promociones`, migración 008)

Tres tipos, todas con **fecha de inicio y fin** obligatorias:
- **combo** — `ambito` `categoria` (N productos de una categoría → precio fijo o %) o
  `productos` (lista específica → precio fijo o %).
- **dia** — `dia_semana` 0-6, % de descuento sobre una categoría o ciertos productos.
- **monto_fijo** — −$X a la cuenta (`ambito='cuenta'`) o a ciertos productos.

`promocionService.calcular(promo, items)` evalúa si aplica y cuánto descuenta.
`ventaService.listPromocionesAplicables(ventaId)` filtra por vigencia de hoy + condiciones de la cuenta.
Una sola promo por venta. El descuento se recalcula al cambiar los items (mientras no haya pagos)
y se absorbe en los pagos al cobrar. `ventas.descuento` + `venta_pagos.descuento` guardan el reparto.

## Reportes (`reporteService.js` + `reportes/export.js`, migración 009)

Vista `#/reportes`, permiso `reportes.*`. Selector de periodo con presets + rango libre.
**Solo ventas `estado='pagada'`, items `estado='activo'`.**

- **Resumen**: ingreso bruto/neto, descuentos, **costo (inversión)**, ganancia, margen %,
  ticket promedio, efectivo vs transferencia, costo de merma, tabla por día.
- **Por producto**: unidades · ingreso · inversión · ganancia · margen %.
- **Insumos usados** y **Merma** (por insumo y por motivo) del periodo.
- El costo de cada venta sale de `venta_item_consumo.costo_unitario` (snapshot al vender).
  El descuento de promoción se reparte proporcional al ingreso de cada renglón.
- **Export**: CSV (BOM, abre en Excel) y PDF (`BrowserWindow` oculta reutilizable + `printToPDF`,
  cero dependencias). `dialog.showSaveDialog` para elegir dónde guardar.

## Corte de caja y cierre de día (`cajaService.js` + `cierreService.js`, migración 010)

- **cortes_caja** (turno de efectivo): abierto/cerrado, `fondo_inicial`, arqueo al cerrar
  (`efectivo_esperado` = fondo + ventas efectivo + ingresos − retiros; `efectivo_contado`; `diferencia`).
  `caja_movimientos` = ingresos/retiros. Uno abierto a la vez.
- **`ventaService.cobrar`**: bloquea efectivo si no hay turno abierto; bloquea todo si el día está
  cerrado. Sella `venta_pagos.corte_id`.
- **cierres_dia** + **cierre_dia_productos**: `cierreService.cerrarDia(fecha)` congela los totales
  del día (requiere sin cuentas abiertas ni turno abierto). `reabrirDia` los borra.
- **reporteService** usa los snapshots de días cerrados y solo calcula en vivo los días abiertos.

## Borrado de usuarios

No hay borrado real: `Desactivar` pone `is_active = 0`. El usuario sigue
apareciendo como *Desactivado* para no perder la relación con sus ventas.
