'use strict';

const { ipcMain, dialog, app } = require('electron');
const session = require('../security/session');

const authService = require('../services/authService');
const userService = require('../services/userService');
const roleService = require('../services/roleService');
const permissionService = require('../services/permissionService');
const logService = require('../services/logService');
const categoriaService = require('../services/categoriaService');
const insumoService = require('../services/insumoService');
const preparacionService = require('../services/preparacionService');
const productoCategoriaService = require('../services/productoCategoriaService');
const productoService = require('../services/productoService');
const modificadorService = require('../services/modificadorService');
const mesaService = require('../services/mesaService');
const ventaService = require('../services/ventaService');
const promocionService = require('../services/promocionService');
const reporteService = require('../services/reporteService');
const cajaService = require('../services/cajaService');
const cierreService = require('../services/cierreService');
const backupService = require('../backup/backupService');
const updateService = require('../update/updateService');
const { exportar } = require('../reportes/export');
const { UNITS, MERMA_MOTIVOS } = require('../inventory/units');
const { MODOS_RECETA } = require('../menu/constants');

/**
 * Envoltura para registrar handlers IPC con validación de sesión y permisos.
 * TODA la seguridad se aplica aquí (el renderer solo oculta botones).
 *
 *   opts.guest      -> no requiere sesión
 *   opts.permission -> clave de permiso requerida (el admin interno la salta)
 */
function handle(channel, opts, fn) {
  if (typeof opts === 'function') {
    fn = opts;
    opts = {};
  }
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      if (!opts.guest && !session.isLoggedIn()) {
        throw new Error('Sesión no iniciada.');
      }
      // Si desactivan al usuario mientras tiene la sesión abierta, deja de operar aquí mismo.
      if (!opts.guest && !authService.sessionUserStillActive()) {
        session.clear();
        throw new Error('Tu usuario fue desactivado. Vuelve a iniciar sesión.');
      }
      if (opts.permission && !session.can(opts.permission)) {
        throw new Error('No tienes permiso para realizar esta acción.');
      }
      const data = await fn(payload || {});
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  });
}

/**
 * Para los canales que solo alimentan un desplegable y los usa más de un módulo
 * (el editor de recetas necesita los insumos, el de promociones las categorías…).
 * Evita que una pantalla muera por pedir el permiso de un módulo vecino.
 */
function canAlguno(...claves) {
  return claves.some((k) => session.can(k));
}

/** Usuario de la sesión actual, como { id, username }, para atribuir registros. */
function actor() {
  const u = session.getCurrentUser();
  return u ? { id: u.id, username: u.username } : {};
}

/** Escribe en la bitácora usando el usuario de la sesión actual como autor. */
function audit(action, detail) {
  const u = session.getCurrentUser();
  logService.writeLog({
    userId: u ? u.id : null,
    username: u ? u.username : '',
    action,
    detail: detail || '',
  });
}

function diff(before = [], after = []) {
  const b = new Set(before);
  const a = new Set(after);
  const added = [...a].filter((x) => !b.has(x));
  const removed = [...b].filter((x) => !a.has(x));
  return { added, removed };
}

function describeDiff({ added, removed }) {
  const parts = [];
  if (added.length) parts.push(`agregó: ${added.join(', ')}`);
  if (removed.length) parts.push(`quitó: ${removed.join(', ')}`);
  return parts.join(' | ') || 'sin cambios';
}

function registerIpc() {
  // ---- Autenticación (la bitácora la escribe authService) ----
  handle('auth:login', { guest: true }, ({ username, password }) =>
    authService.login(username, password)
  );
  handle('auth:logout', { guest: true }, () => authService.logout());
  handle('auth:session', { guest: true }, () => authService.currentSession());

  // ---- Catálogo de permisos (solo lectura) ----
  handle('permissions:list', () => permissionService.listPermissionsGrouped());

  // ---- Bitácora del sistema (SOLO LECTURA) ----
  handle('logs:list', { permission: 'logs.view' }, ({ limit, action, search }) =>
    logService.listLogs({ limit, action, search })
  );
  handle('logs:actions', { permission: 'logs.view' }, () => logService.listActions());

  // ---- Usuarios ----
  handle('users:list', { permission: 'users.view' }, ({ includeInactive = true }) =>
    userService.listUsers({ includeInactive })
  );
  handle('users:get', { permission: 'users.view' }, ({ id }) => userService.getUser(id));

  handle('users:create', { permission: 'users.create' }, (data) => {
    // Repartir permisos sueltos al dar de alta también exige "users.permissions":
    // si no, "users.create" bastaría para fabricarse un administrador.
    if (Array.isArray(data.extraPermissions) && data.extraPermissions.length && !session.can('users.permissions')) {
      throw new Error('No tienes permiso para asignar permisos individuales.');
    }
    const user = userService.createUser(data);
    const roleTxt = user.role_name ? ` con rol "${user.role_name}"` : ' sin rol';
    audit('users.create', `Creó al usuario "${user.name}" (@${user.username}, id ${user.id})${roleTxt}`);
    if (Array.isArray(data.extraPermissions) && data.extraPermissions.length) {
      audit('users.permissions', `Asignó permisos individuales al crear a @${user.username}: ${data.extraPermissions.join(', ')}`);
    }
    return user;
  });

  handle('users:update', { permission: 'users.edit' }, ({ id, ...data }) => {
    const before = userService.getUser(id);
    const user = userService.updateUser(id, data);
    let detail = `Editó al usuario "${user.name}" (@${user.username}, id ${id})`;
    if (before && Number(before.role_id || 0) !== Number(user.role_id || 0)) {
      detail += `. Cambió el rol de "${before.role_name || 'sin rol'}" a "${user.role_name || 'sin rol'}"`;
    }
    audit('users.update', detail);
    return user;
  });

  handle('users:changeUsername', { permission: 'users.edit' }, ({ id, username }) => {
    const before = userService.getUser(id);
    const user = userService.changeUsername(id, username);
    audit('users.username_change', `Cambió el nombre de usuario de "@${before.username}" a "@${user.username}" (id ${id})`);
    return user;
  });

  handle('users:resetPassword', { permission: 'users.edit' }, ({ id, password }) => {
    const user = userService.getUser(id);
    const res = userService.resetPassword(id, password);
    audit('users.password_reset', `Restableció la contraseña de "${user.name}" (@${user.username}, id ${id})`);
    return res;
  });

  handle('users:deactivate', { permission: 'users.delete' }, ({ id }) => {
    const u = session.getCurrentUser();
    const user = userService.deactivateUser(id, u ? u.id : null);
    audit('users.deactivate', `Desactivó al usuario "${user.name}" (@${user.username}, id ${id})`);
    return user;
  });

  handle('users:activate', { permission: 'users.delete' }, ({ id }) => {
    const user = userService.activateUser(id);
    audit('users.activate', `Reactivó al usuario "${user.name}" (@${user.username}, id ${id})`);
    return user;
  });

  handle('users:setPermissions', { permission: 'users.permissions' }, ({ id, permissions }) => {
    const yo = session.getCurrentUser();
    if (yo && Number(id) === Number(yo.id)) {
      throw new Error('No puedes cambiar tus propios permisos. Pídeselo a otro administrador.');
    }
    const before = userService.getUser(id);
    if (!before) throw new Error('El usuario no existe.');
    const beforeKeys = before.permissions.map((p) => p.permission_key);
    const user = userService.setUserPermissions(id, permissions);
    const d = diff(beforeKeys, user.permissions.map((p) => p.permission_key));
    audit(
      'users.permissions',
      `Permisos individuales de "${user.name}" (@${user.username}, id ${id}) — ${describeDiff(d)}`
    );
    return user;
  });

  // ---- Inventario: metadatos y categorías ----
  // Las unidades y los motivos de merma son catálogos fijos, sin información de
  // negocio. El conteo de "por acabarse" sí lo es: solo va para quien puede ver
  // el inventario (si no, quien únicamente vende sabría cómo anda el almacén).
  handle('inventory:meta', () => ({
    unidades: UNITS,
    motivosMerma: MERMA_MOTIVOS,
    bajoStock: session.can('insumos.view') ? insumoService.countBajoStock() : null,
    faltantes: session.can('insumos.view') ? insumoService.countFaltantes() : null,
  }));

  handle('insumoCategorias:list', { permission: 'insumo_categorias.view' }, (opts) =>
    categoriaService.listCategorias(opts || {})
  );
  handle('insumoCategorias:options', { permission: 'insumos.view' }, () =>
    categoriaService.listCategoriaOptions()
  );
  handle('insumoCategorias:create', { permission: 'insumo_categorias.create' }, (data) => {
    const c = categoriaService.createCategoria(data);
    audit('inventory.categoria.create', `Creó la categoría de insumo "${c.nombre}" (unidad sugerida: ${c.unidad_sugerida})`);
    return c;
  });
  handle('insumoCategorias:update', { permission: 'insumo_categorias.edit' }, ({ id, ...data }) => {
    const c = categoriaService.updateCategoria(id, data);
    audit('inventory.categoria.update', `Editó la categoría de insumo "${c.nombre}" (id ${id})`);
    return c;
  });
  handle('insumoCategorias:deactivate', { permission: 'insumo_categorias.delete' }, ({ id }) => {
    const c = categoriaService.deactivateCategoria(id);
    audit('inventory.categoria.deactivate', `Dio de baja la categoría de insumo "${c.nombre}" (id ${id})`);
    return c;
  });
  handle('insumoCategorias:activate', { permission: 'insumo_categorias.delete' }, ({ id }) => {
    const c = categoriaService.activateCategoria(id);
    audit('inventory.categoria.activate', `Reactivó la categoría de insumo "${c.nombre}" (id ${id})`);
    return c;
  });

  // ---- Inventario: insumos ----
  handle('insumos:list', { permission: 'insumos.view' }, (opts) => insumoService.listInsumos(opts || {}));
  // Trae el costo de cada insumo: solo para quien administra inventario o menú,
  // no para quien únicamente vende.
  handle('insumos:options', () => {
    if (!canAlguno('insumos.view', 'productos.view', 'modificadores.view')) {
      throw new Error('No tienes permiso para realizar esta acción.');
    }
    return insumoService.listInsumoOptions();
  });
  handle('insumos:get', { permission: 'insumos.view' }, ({ id }) => insumoService.getInsumo(id));
  handle('insumos:movimientos', { permission: 'insumos.view' }, ({ id, limit }) =>
    insumoService.listMovimientos({ insumoId: id, limit })
  );

  handle('insumos:create', { permission: 'insumos.create' }, (data) => {
    const insumo = insumoService.createInsumo(data, actor());
    audit('inventory.insumo.create',
      `Creó el insumo "${insumo.nombre}" (${insumo.unidad_base}, stock inicial: ${insumo.stock})`);
    return insumo;
  });

  handle('insumos:update', { permission: 'insumos.edit' }, ({ id, ...data }) => {
    const insumo = insumoService.updateInsumo(id, data);
    audit('inventory.insumo.update', `Editó el insumo "${insumo.nombre}" (id ${id})`);
    return insumo;
  });

  handle('insumos:deactivate', { permission: 'insumos.delete' }, ({ id }) => {
    const insumo = insumoService.deactivateInsumo(id);
    audit('inventory.insumo.deactivate', `Dio de baja el insumo "${insumo.nombre}" (id ${id})`);
    return insumo;
  });

  handle('insumos:activate', { permission: 'insumos.delete' }, ({ id }) => {
    const insumo = insumoService.activateInsumo(id);
    audit('inventory.insumo.activate', `Reactivó el insumo "${insumo.nombre}" (id ${id})`);
    return insumo;
  });

  handle('insumos:movimiento', { permission: 'insumos.stock' }, (payload) => {
    if (payload.tipo === 'ajuste_costo') throw new Error('Usa "Corregir costo" para este movimiento.');
    const { insumo, cantidadBase, stockResultante } = insumoService.registrarMovimiento(payload, actor());
    const signo = cantidadBase >= 0 ? '+' : '';
    const prov = payload.tipo === 'entrada' && payload.proveedor ? ` — tienda: ${String(payload.proveedor).trim()}` : '';
    audit('inventory.movimiento',
      `${payload.tipo.toUpperCase()} en "${insumo.nombre}": ${signo}${cantidadBase} ${insumo.unidad_base} ` +
      `(stock: ${stockResultante} ${insumo.unidad_base})` + (payload.motivo ? ` — ${payload.motivo}` : '') + prov);
    return insumo;
  });

  // ---- Insumos que se preparan aquí (base para frappé y demás) ----
  handle('insumos:preparacion', { permission: 'insumos.view' }, ({ id }) => preparacionService.getPreparacion(id));

  handle('insumos:setPreparacion', { permission: 'insumos.edit' }, ({ id, rinde, items }) => {
    const p = preparacionService.setPreparacion(id, { rinde, items }, actor());
    audit('inventory.insumo.preparacion',
      `Definió cómo se prepara "${p.nombre}": ${p.receta.length} insumo(s), rinde ${p.rinde} ${p.unidad_base}`);
    return p;
  });

  handle('insumos:quitarPreparacion', { permission: 'insumos.edit' }, ({ id }) => {
    const p = preparacionService.quitarPreparacion(id);
    audit('inventory.insumo.preparacion', `"${p.nombre}" ya no se prepara aquí`);
    return p;
  });

  handle('insumos:producir', { permission: 'insumos.stock' }, ({ id, tandas, nota }) => {
    const r = preparacionService.producir(id, { tandas, nota }, actor());
    audit('inventory.produccion',
      `Preparó ${r.tandas} tanda(s) de "${r.insumo.nombre}": +${r.producido} ${r.insumo.unidad_base}, ` +
      `costo $${r.costo_tanda} por tanda`);
    return r;
  });

  handle('insumos:corregirCosto', { permission: 'insumos.costo' }, ({ id, costo_compra, nota }) => {
    const previo = insumoService.getInsumo(id);
    if (!previo) throw new Error('El insumo no existe.');
    const { insumo } = insumoService.registrarMovimiento(
      { insumoId: id, tipo: 'ajuste_costo', costo_compra, nota }, actor());
    const pres = insumo.unidad_compra || insumo.unidad_base;
    audit('inventory.costo.ajuste',
      `Corrigió el costo de "${insumo.nombre}": ${pres} $${previo.costo_compra} → $${insumo.costo_compra} ` +
      `(${previo.costo_unitario} → ${insumo.costo_unitario} $/${insumo.unidad_base})` +
      (nota ? ` — ${String(nota).trim()}` : ''));
    return insumo;
  });

  // ---- Menú: metadatos ----
  handle('menu:meta', () => ({ modosReceta: MODOS_RECETA }));

  // ---- Menú: categorías de productos ----
  handle('productoCategorias:list', { permission: 'producto_categorias.view' }, (opts) =>
    productoCategoriaService.listCategorias(opts || {})
  );
  // La usan Productos, Promociones y Categorías: pedir el permiso de un solo
  // módulo dejaba muerta la pantalla de los otros.
  handle('productoCategorias:options', () => {
    if (!canAlguno('productos.view', 'promociones.view', 'producto_categorias.view')) {
      throw new Error('No tienes permiso para realizar esta acción.');
    }
    return productoCategoriaService.listOptions();
  });
  handle('productoCategorias:create', { permission: 'producto_categorias.create' }, (data) => {
    const c = productoCategoriaService.createCategoria(data);
    audit('menu.categoria.create', `Creó la categoría de producto "${c.nombre}"`);
    return c;
  });
  handle('productoCategorias:update', { permission: 'producto_categorias.edit' }, ({ id, ...data }) => {
    const c = productoCategoriaService.updateCategoria(id, data);
    audit('menu.categoria.update', `Editó la categoría de producto "${c.nombre}" (id ${id})`);
    return c;
  });
  handle('productoCategorias:deactivate', { permission: 'producto_categorias.delete' }, ({ id }) => {
    const c = productoCategoriaService.deactivateCategoria(id);
    audit('menu.categoria.deactivate', `Dio de baja la categoría de producto "${c.nombre}" (id ${id})`);
    return c;
  });
  handle('productoCategorias:activate', { permission: 'producto_categorias.delete' }, ({ id }) => {
    const c = productoCategoriaService.activateCategoria(id);
    audit('menu.categoria.activate', `Reactivó la categoría de producto "${c.nombre}" (id ${id})`);
    return c;
  });

  // ---- Menú: modificadores ----
  handle('modificadores:list', { permission: 'modificadores.view' }, (opts) =>
    modificadorService.listModificadores(opts || {})
  );
  handle('modificadores:get', { permission: 'modificadores.view' }, ({ id }) => modificadorService.getModificador(id));
  handle('modificadores:options', { permission: 'productos.view' }, () => modificadorService.listOptions());
  handle('modificadores:create', { permission: 'modificadores.create' }, (data) => {
    const m = modificadorService.createModificador(data);
    audit('menu.modificador.create', `Creó el modificador "${m.nombre}" (+$${m.precio_extra})`);
    return m;
  });
  handle('modificadores:update', { permission: 'modificadores.edit' }, ({ id, ...data }) => {
    const m = modificadorService.updateModificador(id, data);
    audit('menu.modificador.update', `Editó el modificador "${m.nombre}" (id ${id})`);
    return m;
  });
  handle('modificadores:setItems', { permission: 'modificadores.edit' }, ({ id, items }) => {
    const m = modificadorService.setItems(id, items);
    audit('menu.modificador.receta', `Actualizó la receta del modificador "${m.nombre}" (${m.items.length} insumo/s)`);
    return m;
  });
  handle('modificadores:deactivate', { permission: 'modificadores.delete' }, ({ id }) => {
    const m = modificadorService.deactivateModificador(id);
    audit('menu.modificador.deactivate', `Dio de baja el modificador "${m.nombre}" (id ${id})`);
    return m;
  });
  handle('modificadores:activate', { permission: 'modificadores.delete' }, ({ id }) => {
    const m = modificadorService.activateModificador(id);
    audit('menu.modificador.activate', `Reactivó el modificador "${m.nombre}" (id ${id})`);
    return m;
  });

  // ---- Menú: productos ----
  handle('productos:list', { permission: 'productos.view' }, (opts) => productoService.listProductos(opts || {}));
  handle('productos:catalogo', () => productoService.listOptions()); // productos activos con tamaños + precio (para promos / ventas)
  handle('productos:get', { permission: 'productos.view' }, ({ id }) => productoService.getProducto(id));
  handle('productos:historialPrecios', { permission: 'productos.view' }, ({ presentacionId }) =>
    productoService.historialPrecios(presentacionId)
  );

  handle('productos:create', { permission: 'productos.create' }, (data) => {
    const p = productoService.createProducto(data, actor());
    audit('menu.producto.create',
      `Creó el producto "${p.nombre}" (${p.presentaciones.length} tamaño/s): ` +
      p.presentaciones.map((pr) => `${pr.nombre} $${pr.precio_actual}`).join(', '));
    return p;
  });
  handle('productos:update', { permission: 'productos.edit' }, ({ id, ...data }) => {
    const p = productoService.updateProducto(id, data);
    // La foto es un data URI larguísimo: en la bitácora solo se anota que cambió.
    const cambioFoto = data.foto !== undefined ? '. Cambió la foto' : '';
    audit('menu.producto.update', `Editó el producto "${p.nombre}" (id ${id})${cambioFoto}`);
    return p;
  });
  handle('productos:setAgotado', { permission: 'productos.edit' }, ({ id, agotado }) => {
    const p = productoService.setAgotado(id, agotado);
    audit('menu.producto.agotado', `Marcó "${p.nombre}" como ${agotado ? 'AGOTADO' : 'disponible'} (id ${id})`);
    return p;
  });
  handle('productos:deactivate', { permission: 'productos.delete' }, ({ id }) => {
    const p = productoService.deactivateProducto(id);
    audit('menu.producto.deactivate', `Dio de baja el producto "${p.nombre}" (id ${id})`);
    return p;
  });
  handle('productos:activate', { permission: 'productos.delete' }, ({ id }) => {
    const p = productoService.activateProducto(id);
    audit('menu.producto.activate', `Reactivó el producto "${p.nombre}" (id ${id})`);
    return p;
  });

  handle('productos:addPresentacion', { permission: 'productos.edit' }, ({ productoId, nombre, precio }) => {
    const p = productoService.addPresentacion(productoId, { nombre, precio }, actor());
    audit('menu.producto.update', `Agregó el tamaño "${nombre}" ($${precio}) a "${p.nombre}"`);
    return p;
  });
  handle('productos:updatePresentacion', { permission: 'productos.edit' }, ({ presentacionId, nombre, orden }) => {
    const p = productoService.updatePresentacion(presentacionId, { nombre, orden });
    audit('menu.producto.update', `Editó un tamaño de "${p.nombre}" (id tamaño ${presentacionId})`);
    return p;
  });
  handle('productos:setAgotadoPresentacion', { permission: 'productos.edit' }, ({ presentacionId, agotado }) => {
    const p = productoService.setAgotadoPresentacion(presentacionId, agotado);
    audit('menu.producto.agotado', `Tamaño ${presentacionId} de "${p.nombre}" marcado ${agotado ? 'AGOTADO' : 'disponible'}`);
    return p;
  });
  handle('productos:deactivatePresentacion', { permission: 'productos.edit' }, ({ presentacionId }) => {
    const p = productoService.deactivatePresentacion(presentacionId);
    audit('menu.producto.update', `Dio de baja un tamaño de "${p.nombre}" (id tamaño ${presentacionId})`);
    return p;
  });
  handle('productos:activatePresentacion', { permission: 'productos.edit' }, ({ presentacionId }) => {
    const p = productoService.activatePresentacion(presentacionId);
    audit('menu.producto.update', `Reactivó un tamaño de "${p.nombre}" (id tamaño ${presentacionId})`);
    return p;
  });

  handle('productos:cambiarPrecio', { permission: 'productos.precio' }, ({ presentacionId, precio }) => {
    const p = productoService.cambiarPrecio(presentacionId, precio, actor());
    const pr = p.presentaciones.find((x) => x.id === Number(presentacionId));
    audit('menu.producto.precio',
      `Cambió el precio de "${p.nombre}" — ${pr ? pr.nombre : ''} a $${precio}. ` +
      'Las ventas ya hechas conservan su precio.');
    return p;
  });

  handle('productos:setReceta', { permission: 'productos.receta' }, ({ presentacionId, items, grupos }) => {
    const p = productoService.setReceta(presentacionId, { items, grupos }, actor());
    const pr = p.presentaciones.find((x) => x.id === Number(presentacionId));
    audit('menu.producto.receta',
      `Actualizó la receta de "${p.nombre}" — ${pr ? pr.nombre : ''} ` +
      `(${pr ? pr.receta.length : 0} insumo/s fijos, ${pr ? pr.grupos.length : 0} grupo/s de opción)`);
    return p;
  });

  handle('productos:setModificadores', { permission: 'productos.edit' }, ({ id, modificadorIds }) => {
    const p = productoService.setModificadores(id, modificadorIds);
    audit('menu.producto.update', `Actualizó los modificadores de "${p.nombre}" (${p.modificadores.length})`);
    return p;
  });

  // ---- Mesas ----
  handle('mesas:list', { permission: 'mesas.view' }, (opts) => mesaService.listMesas(opts || {}));
  handle('mesas:create', { permission: 'mesas.create' }, ({ nombre }) => {
    const m = mesaService.createMesa({ nombre });
    audit('ventas.mesa.create', `Creó la mesa "${m.nombre}"`);
    return m;
  });
  handle('mesas:agregarVarias', { permission: 'mesas.create' }, ({ cantidad }) => {
    const r = mesaService.agregarVarias(cantidad);
    audit('ventas.mesa.create', `Agregó ${r.creadas} mesa(s)`);
    return r;
  });
  handle('mesas:update', { permission: 'mesas.edit' }, ({ id, ...data }) => {
    const m = mesaService.updateMesa(id, data);
    audit('ventas.mesa.update', `Editó la mesa "${m.nombre}" (id ${id})`);
    return m;
  });
  handle('mesas:deactivate', { permission: 'mesas.delete' }, ({ id }) => {
    const m = mesaService.deactivateMesa(id);
    audit('ventas.mesa.deactivate', `Dio de baja la mesa "${m.nombre}" (id ${id})`);
    return m;
  });
  handle('mesas:activate', { permission: 'mesas.delete' }, ({ id }) => {
    const m = mesaService.activateMesa(id);
    audit('ventas.mesa.activate', `Reactivó la mesa "${m.nombre}" (id ${id})`);
    return m;
  });

  // ---- Ventas / Punto de venta ----
  handle('ventas:meta', { permission: 'ventas.view' }, () => ({ metodos: ventaService.METODOS }));
  handle('ventas:abiertas', { permission: 'ventas.view' }, () => ventaService.listVentasAbiertas());
  handle('ventas:get', { permission: 'ventas.view' }, ({ id }) => ventaService.getVenta(id));
  handle('ventas:historial', { permission: 'ventas.list' }, (opts) => ventaService.listHistorial(opts || {}));
  handle('ventas:catalogoProductos', { permission: 'ventas.view' }, () => productoService.listOptions());
  // El mapa de mesas es parte de VENDER, no de configurar mesas: si esto pidiera
  // "mesas.view", un cajero no podría ni abrir el punto de venta.
  handle('ventas:mesas', { permission: 'ventas.view' }, () => mesaService.listMesas({ includeInactive: false }));
  handle('ventas:producto', { permission: 'ventas.view' }, ({ id }) => {
    const p = productoService.getProducto(id);
    if (!p) return null;
    return {
      id: p.id, nombre: p.nombre, agotado: p.agotado, is_active: p.is_active,
      modificadores: p.modificadores,
      presentaciones: p.presentaciones.filter((pr) => pr.is_active).map((pr) => ({
        id: pr.id, nombre: pr.nombre, agotado: pr.agotado, precio_actual: pr.precio_actual,
        grupos: (pr.grupos || []).map((g) => ({
          id: g.id, nombre: g.nombre, insumo_default_id: g.insumo_default_id,
          opciones: g.opciones.map((o) => ({ insumo_id: o.insumo_id, insumo_nombre: o.insumo_nombre })),
        })),
      })),
    };
  });

  handle('ventas:abrir', { permission: 'ventas.crear' }, ({ tipo, mesaId }) => {
    const v = ventaService.abrirVenta({ tipo, mesaId }, actor());
    audit('ventas.abrir', `Abrió cuenta #${v.id} (${v.tipo === 'mesa' ? v.mesa_nombre : 'para llevar'})`);
    return v;
  });

  handle('ventas:agregarItem', { permission: 'ventas.crear' }, ({ ventaId, ...data }) => {
    const v = ventaService.agregarItem(ventaId, data, actor());
    audit('ventas.item.add', `Cuenta #${ventaId}: agregó ${data.cantidad || 1}× producto (tamaño ${data.presentacionId})`);
    return v;
  });

  handle('ventas:cambiarTipo', { permission: 'ventas.crear' }, ({ ventaId, tipo, mesaId }) => {
    const v = ventaService.cambiarTipoVenta(ventaId, { tipo, mesaId }, actor());
    const de = v.desde.tipo === 'mesa' ? `mesa ${v.desde.mesa_id}` : 'para llevar';
    const a = v.tipo === 'mesa' ? `mesa "${v.mesa_nombre}"` : 'para llevar';
    const ajuste = v.items_convertidos
      ? ` — ${v.items_convertidos} producto(s) se pasaron al modo nuevo` +
        (v.items_con_movimiento ? ` y ${v.items_con_movimiento} ajustaron inventario (vasos)` : '')
      : '';
    audit('ventas.cambiarTipo', `Cuenta #${ventaId}: de ${de} a ${a}${ajuste}`);
    return v;
  });

  handle('ventas:cancelarItem', { permission: 'ventas.cancelar' }, ({ ventaId, itemId, motivo }) => {
    const v = ventaService.cancelarItem(ventaId, itemId, motivo, actor());
    audit('ventas.item.cancel', `Cuenta #${ventaId}: canceló el producto #${itemId} (insumos devueltos)` + (motivo ? ` — ${motivo}` : ''));
    return v;
  });

  handle('ventas:cobrar', { permission: 'ventas.cobrar' }, ({ ventaId, itemIds, metodo, etiqueta, recibido }) => {
    const v = ventaService.cobrar(ventaId, { itemIds, metodo, etiqueta, recibido }, actor());
    const pago = v.pagos[v.pagos.length - 1];
    audit('ventas.cobro', `Cuenta #${ventaId}: cobró $${pago ? pago.monto : '?'} en ${metodo}` +
      (pago && pago.cambio > 0 ? ` (recibió $${pago.recibido}, cambio $${pago.cambio})` : '') +
      (etiqueta ? ` (${etiqueta})` : '') + (v.estado === 'pagada' ? ' — cuenta CERRADA' : ' — pago parcial'));
    return v;
  });

  // ---- Promociones ----
  handle('promociones:meta', { permission: 'promociones.view' }, () => ({ tipos: promocionService.TIPOS, dias: promocionService.DIAS, hoy: promocionService.hoyISO() }));
  handle('promociones:list', { permission: 'promociones.view' }, (opts) => promocionService.listPromociones(opts || {}));
  handle('promociones:get', { permission: 'promociones.view' }, ({ id }) => promocionService.getPromocion(id));
  handle('promociones:create', { permission: 'promociones.create' }, (data) => {
    const p = promocionService.createPromocion(data);
    audit('promo.create', `Creó la promoción "${p.nombre}" (${p.tipo}, ${p.fecha_inicio} a ${p.fecha_fin})`);
    return p;
  });
  handle('promociones:update', { permission: 'promociones.edit' }, ({ id, ...data }) => {
    const p = promocionService.updatePromocion(id, data);
    audit('promo.update', `Editó la promoción "${p.nombre}" (id ${id})`);
    return p;
  });
  handle('promociones:setActive', { permission: 'promociones.delete' }, ({ id, activo }) => {
    const p = promocionService.setActive(id, activo);
    audit('promo.setActive', `${activo ? 'Activó' : 'Desactivó'} la promoción "${p.nombre}" (id ${id})`);
    return p;
  });

  handle('ventas:promocionesAplicables', { permission: 'ventas.view' }, ({ ventaId }) =>
    ventaService.listPromocionesAplicables(ventaId)
  );
  handle('ventas:aplicarPromocion', { permission: 'promociones.aplicar' }, ({ ventaId, promocionId }) => {
    const v = ventaService.aplicarPromocion(ventaId, promocionId, actor());
    audit('ventas.promo', `Cuenta #${ventaId}: aplicó la promoción "${v.promocion_nombre}" (−$${v.descuento})`);
    return v;
  });
  handle('ventas:quitarPromocion', { permission: 'promociones.aplicar' }, ({ ventaId }) => {
    const v = ventaService.quitarPromocion(ventaId);
    audit('ventas.promo', `Cuenta #${ventaId}: quitó la promoción`);
    return v;
  });

  handle('ventas:cancelar', { permission: 'ventas.cancelar' }, ({ ventaId, motivo }) => {
    const antes = ventaService.getVenta(ventaId);
    const v = ventaService.cancelarVenta(ventaId, motivo, actor());
    audit('ventas.cancelar',
      `Canceló la venta #${ventaId}` + (antes && antes.estado === 'pagada' ? ' (YA ESTABA PAGADA)' : '') +
      `. Insumos devueltos al inventario.` + (motivo ? ` Motivo: ${motivo}` : ''));
    return v;
  });

  // ---- Corte de caja ----
  handle('caja:corte', { permission: 'caja.view' }, ({ id } = {}) => cajaService.getCorte(id));
  handle('caja:cortes', { permission: 'caja.view' }, (opts) => cajaService.listCortes(opts || {}));
  // Para proponer el fondo al abrir el turno: lo que quedó en el cajón ayer.
  handle('caja:ultimoCierre', { permission: 'caja.view' }, () => cajaService.ultimoCierre());
  handle('caja:abrir', { permission: 'caja.turno' }, ({ fondo_inicial }) => {
    const c = cajaService.abrirCorte({ fondo_inicial }, actor());
    audit('caja.abrir', `Abrió la caja #${c.id} con $${c.fondo_inicial} de fondo`);
    return c;
  });
  handle('caja:movimiento', { permission: 'caja.turno' }, ({ tipo, monto, concepto }) => {
    const c = cajaService.registrarMovimiento({ tipo, monto, concepto }, actor());
    audit('caja.movimiento', `${tipo === 'retiro' ? 'Retiro' : 'Ingreso'} de caja: $${monto} — ${concepto} (caja #${c.id})`);
    return c;
  });
  handle('caja:cerrar', { permission: 'caja.turno' }, ({ efectivo_contado, notas }) => {
    const c = cajaService.cerrarCorte({ efectivo_contado, notas }, actor());
    const dif = c.diferencia;
    audit('caja.cerrar',
      `Cerró el turno de caja #${c.id}. Esperado $${c.efectivo_esperado}, contado $${c.efectivo_contado}, ` +
      (dif === 0 ? 'sin diferencia' : dif > 0 ? `sobró $${dif}` : `faltó $${-dif}`));
    return c;
  });

  // ---- Cierre de día ----
  handle('cierre:estado', { permission: 'caja.view' }, ({ fecha }) => cierreService.estadoDia(fecha || cierreService.hoyISO()));
  handle('cierre:lista', { permission: 'caja.view' }, (opts) => cierreService.listCierres(opts || {}));
  handle('cierre:cerrarDia', { permission: 'caja.cierre_dia' }, ({ fecha }) => {
    const c = cierreService.cerrarDia(fecha || cierreService.hoyISO(), actor());
    audit('cierre.dia', `Cerró el día ${c.fecha}: ${c.ventas} ventas, ingreso $${c.ingreso_neto}, ganancia $${c.ganancia}`);
    return c;
  });
  handle('cierre:reabrirDia', { permission: 'caja.cierre_dia' }, ({ fecha }) => {
    const r = cierreService.reabrirDia(fecha, actor());
    audit('cierre.reabrir', `Reabrió el día ${fecha}`);
    return r;
  });

  // ---- Reportes ----
  handle('reportes:resumen', { permission: 'reportes.view' }, ({ desde, hasta }) => reporteService.resumen({ desde, hasta }));
  handle('reportes:productos', { permission: 'reportes.view' }, ({ desde, hasta }) => reporteService.porProducto({ desde, hasta }));
  handle('reportes:insumos', { permission: 'reportes.view' }, ({ desde, hasta }) => reporteService.insumosUsados({ desde, hasta }));
  handle('reportes:inversion', { permission: 'reportes.view' }, ({ desde, hasta }) => reporteService.inversionPorProducto({ desde, hasta }));
  handle('reportes:merma', { permission: 'reportes.view' }, ({ desde, hasta }) => reporteService.merma({ desde, hasta }));

  handle('reportes:movimientosCaja', { permission: 'reportes.view' }, ({ desde, hasta }) =>
    reporteService.movimientosCaja({ desde, hasta }));

  handle('reportes:exportar', { permission: 'reportes.export' }, async ({ tipo, formato, desde, hasta }) => {
    const data = tipo === 'resumen' ? reporteService.resumen({ desde, hasta })
      : tipo === 'productos' ? reporteService.porProducto({ desde, hasta })
      : tipo === 'insumos' ? reporteService.insumosUsados({ desde, hasta })
      : tipo === 'inversion' ? reporteService.inversionPorProducto({ desde, hasta })
      : tipo === 'caja' ? reporteService.movimientosCaja({ desde, hasta })
      : reporteService.merma({ desde, hasta });
    const r = await exportar({ formato, tipo, data });
    if (r.ok) audit('reportes.export', `Exportó el reporte "${tipo}" (${formato.toUpperCase()}) del ${desde} al ${hasta}`);
    return r;
  });

  // ---- Roles ----
  handle('roles:list', { permission: 'roles.view' }, () => roleService.listRoles());
  handle('roles:get', { permission: 'roles.view' }, ({ id }) => roleService.getRole(id));

  handle('roles:create', { permission: 'roles.create' }, (data) => {
    const role = roleService.createRole(data);
    audit('roles.create', `Creó el rol "${role.name}" (id ${role.id})`);
    if (role.permissions.length) {
      audit('roles.permissions', `Permisos iniciales del rol "${role.name}": ${role.permissions.join(', ')}`);
    }
    return role;
  });

  handle('roles:update', { permission: 'roles.edit' }, ({ id, ...data }) => {
    const before = roleService.getRole(id);
    const role = roleService.updateRole(id, data);
    if (before && (before.name !== role.name || before.description !== role.description)) {
      audit('roles.update', `Editó el rol "${role.name}" (id ${id})`);
    }
    if (Array.isArray(data.permissions)) {
      const d = diff(before ? before.permissions : [], role.permissions);
      if (d.added.length || d.removed.length) {
        audit(
          'roles.permissions',
          `Permisos del rol "${role.name}" (id ${id}) — ${describeDiff(d)}. ` +
            'Solo afecta a usuarios creados a partir de ahora.'
        );
      }
    }
    return role;
  });

  handle('roles:delete', { permission: 'roles.delete' }, ({ id }) => {
    const role = roleService.getRole(id);
    const res = roleService.deleteRole(id);
    audit('roles.delete', `Eliminó el rol "${role ? role.name : id}" (id ${id})`);
    return res;
  });

  // ============ Respaldos ============
  // Un respaldo a la vez, a la carpeta que la persona elija en su propia
  // computadora: el explorador de Windows es más claro que una pantalla con
  // historial, y así se puede guardar directo en una USB.
  handle('respaldos:crear', { permission: 'respaldos.crear' }, async () => {
    const res = await dialog.showOpenDialog({
      title: 'Elige dónde guardar el respaldo',
      buttonLabel: 'Guardar aquí',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths.length) return { cancelado: true };
    const r = await backupService.crearRespaldoEn(res.filePaths[0]);
    audit('respaldos.crear', `Respaldo guardado en: ${r.ruta} (${r.tamano} bytes)`);
    return { cancelado: false, ...r };
  });

  // ============ Actualizaciones ============
  // Reiniciar es parte de actualizar: el código viejo sigue cargado en memoria
  // hasta que el proceso arranca de nuevo.
  const reiniciar = () => {
    if (app && typeof app.relaunch === 'function') {
      setTimeout(() => { app.relaunch(); app.exit(0); }, 600);
    }
  };

  handle('actualizaciones:estado', { permission: 'actualizaciones.view' }, () => updateService.estado());

  handle('actualizaciones:elegir', { permission: 'actualizaciones.aplicar' }, async () => {
    const res = await dialog.showOpenDialog({
      title: 'Elige el archivo de actualización',
      buttonLabel: 'Abrir',
      properties: ['openFile'],
      filters: [{ name: 'Actualización de Beso de Café', extensions: ['json'] }],
    });
    if (res.canceled || !res.filePaths.length) return { cancelado: true };
    // Solo se lee y se revisa: todavía no se toca nada del programa.
    return { cancelado: false, ...updateService.leerActualizacion(res.filePaths[0]) };
  });

  handle('actualizaciones:aplicar', { permission: 'actualizaciones.aplicar' }, ({ ruta }) => {
    if (!app.isPackaged) {
      throw new Error('Esto solo se puede hacer en el programa instalado, no en el de desarrollo.');
    }
    const r = updateService.aplicar(ruta);
    audit('actualizaciones.aplicar',
      `Aplicó la actualización ${r.version} (${r.archivos.length} archivo/s): ${r.descripcion}`);
    reiniciar();
    return { ...r, reiniciando: true };
  });

  handle('actualizaciones:revertir', { permission: 'actualizaciones.aplicar' }, () => {
    if (!app.isPackaged) {
      throw new Error('Esto solo se puede hacer en el programa instalado, no en el de desarrollo.');
    }
    const r = updateService.revertir();
    audit('actualizaciones.revertir', `Deshizo la última actualización (${r.archivos} archivo/s)`);
    reiniciar();
    return { ...r, reiniciando: true };
  });
}

module.exports = { registerIpc };
