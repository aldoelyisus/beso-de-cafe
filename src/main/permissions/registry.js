'use strict';

/**
 * REGISTRO DE PERMISOS (única fuente de verdad)
 * -------------------------------------------------
 * Los permisos se definen aquí, en código, y se sincronizan a la base de datos
 * en cada arranque (ver db/seed.js). Nunca se crean permisos desde la interfaz:
 * se aplican sobre el código.
 *
 * Para agregar un módulo nuevo al sistema basta con agregar un objeto a este
 * arreglo. El menú lateral y las validaciones de permisos se arman solos a
 * partir de esto.
 *
 * Convención de clave: "<modulo>.<accion>"
 *   - view    -> entrar al módulo y ver su listado. Van juntos a propósito:
 *                un usuario que ve el módulo en el menú pero no su contenido
 *                solo se topa con una pantalla vacía y no entiende por qué.
 *   - create  -> crear registros
 *   - edit    -> editar registros
 *   - delete  -> eliminar registros (baja lógica)
 */

const MODULES = [
  {
    key: 'users',
    label: 'Usuarios y personal',
    icon: '\u{1F465}', // 👥
    route: '#/users',
    order: 40,
    section: 'administracion',
    permissions: [
      { action: 'view', label: 'Ver el módulo y el listado de usuarios' },
      { action: 'create', label: 'Crear usuarios' },
      { action: 'edit', label: 'Editar usuarios' },
      { action: 'delete', label: 'Desactivar usuarios' },
      // Aparte de "edit" a propósito: quien puede repartir permisos puede
      // convertir a cualquiera (o a sí mismo) en administrador total.
      { action: 'permissions', label: 'Asignar permisos individuales a un usuario' },
    ],
    submodules: [
      { key: 'users-list', label: 'Usuarios', route: '#/users', requires: 'users.view' },
      { key: 'roles-list', label: 'Roles y permisos', route: '#/roles', requires: 'roles.view' },
    ],
  },
  {
    key: 'roles',
    label: 'Roles y permisos',
    icon: '\u{1F510}', // 🔐
    route: '#/roles',
    order: 20,
    hiddenFromMenu: true, // se accede desde el submódulo de "Usuarios y personal"
    permissions: [
      { action: 'view', label: 'Ver el módulo y el listado de roles' },
      { action: 'create', label: 'Crear roles' },
      { action: 'edit', label: 'Editar roles y sus permisos' },
      { action: 'delete', label: 'Eliminar roles' },
    ],
    submodules: [],
  },
  {
    key: 'inventory',
    label: 'Inventario',
    icon: '\u{1F4E6}', // 📦
    route: '#/insumos',
    order: 25,
    section: 'catalogo',
    // Grupo contenedor: no tiene permiso propio. Aparece en el menú si el
    // usuario puede ver alguno de sus submódulos (ver authService.currentSession).
    permissions: [],
    submodules: [
      { key: 'insumos-list', label: 'Insumos', route: '#/insumos', requires: 'insumos.view' },
      { key: 'insumo-categorias-list', label: 'Categorías de insumos', route: '#/insumo-categorias', requires: 'insumo_categorias.view' },
    ],
  },
  {
    key: 'insumos',
    label: 'Insumos',
    icon: '\u{1F950}', // 🥐
    route: '#/insumos',
    order: 26,
    hiddenFromMenu: true, // se accede desde "Inventario"
    permissions: [
      { action: 'view', label: 'Ver el módulo y el listado de insumos' },
      { action: 'create', label: 'Crear insumos' },
      { action: 'edit', label: 'Editar insumos' },
      { action: 'delete', label: 'Dar de baja insumos' },
      { action: 'stock', label: 'Registrar entradas, merma y ajustes de existencias' },
      { action: 'costo', label: 'Corregir a mano el costo de un insumo' },
    ],
    submodules: [],
  },
  {
    key: 'insumo_categorias',
    label: 'Categorías de insumos',
    icon: '\u{1F3F7}', // 🏷️
    route: '#/insumo-categorias',
    order: 27,
    hiddenFromMenu: true,
    permissions: [
      { action: 'view', label: 'Ver el módulo y el listado de categorías de insumos' },
      { action: 'create', label: 'Crear categorías de insumos' },
      { action: 'edit', label: 'Editar categorías de insumos' },
      { action: 'delete', label: 'Dar de baja / reactivar categorías de insumos' },
    ],
    submodules: [],
  },
  {
    key: 'menu',
    label: 'Menú y recetas',
    icon: '\u{1F9CB}', // 🧋
    route: '#/productos',
    order: 20,
    section: 'catalogo',
    // Grupo contenedor: sin permiso propio (ver "Inventario").
    permissions: [],
    submodules: [
      { key: 'productos-list', label: 'Productos', route: '#/productos', requires: 'productos.view' },
      { key: 'producto-categorias-list', label: 'Categorías de productos', route: '#/producto-categorias', requires: 'producto_categorias.view' },
      { key: 'modificadores-list', label: 'Modificadores', route: '#/modificadores', requires: 'modificadores.view' },
      { key: 'promociones-list', label: 'Promociones', route: '#/promociones', requires: 'promociones.view' },
    ],
  },
  {
    key: 'productos',
    label: 'Productos',
    icon: '\u{2615}', // ☕
    route: '#/productos',
    order: 16,
    hiddenFromMenu: true,
    permissions: [
      { action: 'view', label: 'Ver el módulo y el listado de productos' },
      { action: 'create', label: 'Crear productos' },
      { action: 'edit', label: 'Editar productos (datos, tamaños, agotado)' },
      { action: 'delete', label: 'Dar de baja productos' },
      { action: 'precio', label: 'Cambiar el precio de un producto' },
      { action: 'receta', label: 'Editar la receta de un producto' },
    ],
    submodules: [],
  },
  {
    key: 'producto_categorias',
    label: 'Categorías de productos',
    icon: '\u{1F4D1}', // 📑
    route: '#/producto-categorias',
    order: 17,
    hiddenFromMenu: true,
    permissions: [
      { action: 'view', label: 'Ver el módulo y el listado de categorías de productos' },
      { action: 'create', label: 'Crear categorías de productos' },
      { action: 'edit', label: 'Editar categorías de productos' },
      { action: 'delete', label: 'Dar de baja / reactivar categorías de productos' },
    ],
    submodules: [],
  },
  {
    key: 'modificadores',
    label: 'Modificadores',
    icon: '\u{2795}', // ➕
    route: '#/modificadores',
    order: 18,
    hiddenFromMenu: true,
    permissions: [
      { action: 'view', label: 'Ver el módulo y el listado de modificadores' },
      { action: 'create', label: 'Crear modificadores' },
      { action: 'edit', label: 'Editar modificadores y su receta' },
      { action: 'delete', label: 'Dar de baja / reactivar modificadores' },
    ],
    submodules: [],
  },
  {
    key: 'ventas',
    label: 'Ventas',
    icon: '\u{1F4B5}', // 💵
    route: '#/pos',
    order: 5,
    section: 'operacion',
    permissions: [
      { action: 'view', label: 'Abrir el punto de venta' },
      { action: 'list', label: 'Ver el historial de ventas (pantalla aparte)' },
      { action: 'crear', label: 'Abrir cuentas y agregar productos' },
      { action: 'cobrar', label: 'Cobrar cuentas (completo o dividido)' },
      { action: 'cancelar', label: 'Cancelar productos y ventas' },
    ],
    submodules: [
      { key: 'pos', label: 'Punto de venta', route: '#/pos', requires: 'ventas.view' },
      { key: 'caja', label: 'Corte de caja', route: '#/caja', requires: 'caja.view' },
      { key: 'ventas-historial', label: 'Historial de ventas', route: '#/ventas-historial', requires: 'ventas.list' },
      { key: 'mesas-config', label: 'Mesas', route: '#/mesas', requires: 'mesas.view' },
    ],
  },
  {
    key: 'caja',
    label: 'Corte de caja',
    icon: '\u{1F4B0}', // 💰
    route: '#/caja',
    order: 8,
    hiddenFromMenu: true,
    permissions: [
      { action: 'view', label: 'Ver el corte de caja' },
      { action: 'turno', label: 'Abrir y cerrar la caja, y registrar entradas / salidas de efectivo' },
      { action: 'cierre_dia', label: 'Cerrar y reabrir el día' },
    ],
    submodules: [],
  },
  {
    key: 'promociones',
    label: 'Promociones',
    icon: '\u{1F3F7}', // 🏷️
    route: '#/promociones',
    order: 7,
    hiddenFromMenu: true,
    permissions: [
      { action: 'view', label: 'Ver el módulo y el listado de promociones' },
      { action: 'create', label: 'Crear promociones' },
      { action: 'edit', label: 'Editar promociones' },
      { action: 'delete', label: 'Activar / desactivar promociones' },
      { action: 'aplicar', label: 'Aplicar una promoción a una cuenta' },
    ],
    submodules: [],
  },
  {
    key: 'mesas',
    label: 'Mesas',
    icon: '\u{1FA91}', // 🪑
    route: '#/mesas',
    order: 6,
    hiddenFromMenu: true,
    permissions: [
      { action: 'view', label: 'Ver y configurar las mesas' },
      { action: 'create', label: 'Agregar mesas' },
      { action: 'edit', label: 'Editar / renombrar mesas' },
      { action: 'delete', label: 'Dar de baja / reactivar mesas' },
    ],
    submodules: [],
  },
  {
    key: 'reportes',
    label: 'Reportes',
    icon: '\u{1F4CA}', // 📊
    route: '#/reportes',
    order: 10,
    section: 'operacion',
    permissions: [
      { action: 'view', label: 'Ver reportes' },
      { action: 'export', label: 'Exportar reportes a PDF / Excel' },
    ],
    submodules: [],
  },
  {
    key: 'respaldos',
    label: 'Respaldos',
    icon: '\u{1F4BE}', // 💾
    route: '#/respaldos',
    order: 45,
    section: 'administracion',
    permissions: [
      { action: 'view', label: 'Ver la pantalla de respaldos' },
      { action: 'crear', label: 'Hacer un respaldo manual de la base de datos' },
    ],
    submodules: [],
  },
  {
    key: 'logs',
    label: 'Bitácora del sistema',
    icon: '\u{1F4DC}', // 📜
    route: '#/logs',
    order: 50,
    section: 'administracion',
    // La bitácora es SOLO LECTURA. No existen permisos de crear/editar/eliminar
    // a propósito: los registros los escribe el sistema, nadie los modifica.
    permissions: [
      { action: 'view', label: 'Ver la bitácora del sistema' },
    ],
    submodules: [],
  },
];

/** Lista plana de permisos: [{ key, module, action, label }] */
function allPermissions() {
  const out = [];
  for (const m of MODULES) {
    for (const p of m.permissions) {
      out.push({
        key: `${m.key}.${p.action}`,
        module: m.key,
        moduleLabel: m.label,
        action: p.action,
        label: p.label,
      });
    }
  }
  return out;
}

/** Conjunto de todas las claves de permiso (para el usuario administrador). */
function allPermissionKeys() {
  return allPermissions().map((p) => p.key);
}

/** Árbol de módulos para construir el menú lateral en el renderer. */
function menuTree() {
  return MODULES.filter((m) => !m.hiddenFromMenu)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((m) => ({
      key: m.key,
      label: m.label,
      icon: m.icon,
      route: m.route,
      section: m.section || null,
      // Los grupos contenedores no tienen permiso propio: se muestran si al
      // menos uno de sus submódulos es visible.
      requires: m.permissions.some((p) => p.action === 'view') ? `${m.key}.view` : null,
      submodules: (m.submodules || []).map((s) => ({ ...s })),
    }));
}

module.exports = { MODULES, allPermissions, allPermissionKeys, menuTree };
