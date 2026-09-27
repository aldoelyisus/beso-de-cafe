'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Puente seguro entre la interfaz (renderer) y el proceso principal.
 * El renderer NO tiene acceso a Node ni a la base de datos: todo pasa por aquí.
 */
function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload).then((res) => {
    if (res && res.ok) return res.data;
    const err = new Error((res && res.error) || 'Error desconocido');
    throw err;
  });
}

const api = {
  auth: {
    login: (username, password) => invoke('auth:login', { username, password }),
    logout: () => invoke('auth:logout'),
    session: () => invoke('auth:session'),
  },
  permissions: {
    list: () => invoke('permissions:list'),
  },
  logs: {
    list: (opts) => invoke('logs:list', opts || {}),
    actions: () => invoke('logs:actions'),
  },
  inventory: {
    meta: () => invoke('inventory:meta'),
  },
  insumoCategorias: {
    list: (opts) => invoke('insumoCategorias:list', opts || {}),
    options: () => invoke('insumoCategorias:options'),
    create: (data) => invoke('insumoCategorias:create', data),
    update: (id, data) => invoke('insumoCategorias:update', { id, ...data }),
    deactivate: (id) => invoke('insumoCategorias:deactivate', { id }),
    activate: (id) => invoke('insumoCategorias:activate', { id }),
  },
  insumos: {
    list: (opts) => invoke('insumos:list', opts || {}),
    options: () => invoke('insumos:options'),
    get: (id) => invoke('insumos:get', { id }),
    movimientos: (id, limit) => invoke('insumos:movimientos', { id, limit }),
    create: (data) => invoke('insumos:create', data),
    update: (id, data) => invoke('insumos:update', { id, ...data }),
    deactivate: (id) => invoke('insumos:deactivate', { id }),
    activate: (id) => invoke('insumos:activate', { id }),
    movimiento: (payload) => invoke('insumos:movimiento', payload),
    corregirCosto: (id, costo_compra, nota) => invoke('insumos:corregirCosto', { id, costo_compra, nota }),
  },
  menu: {
    meta: () => invoke('menu:meta'),
  },
  productoCategorias: {
    list: (opts) => invoke('productoCategorias:list', opts || {}),
    options: () => invoke('productoCategorias:options'),
    create: (data) => invoke('productoCategorias:create', data),
    update: (id, data) => invoke('productoCategorias:update', { id, ...data }),
    deactivate: (id) => invoke('productoCategorias:deactivate', { id }),
    activate: (id) => invoke('productoCategorias:activate', { id }),
  },
  modificadores: {
    list: (opts) => invoke('modificadores:list', opts || {}),
    get: (id) => invoke('modificadores:get', { id }),
    options: () => invoke('modificadores:options'),
    create: (data) => invoke('modificadores:create', data),
    update: (id, data) => invoke('modificadores:update', { id, ...data }),
    setItems: (id, items) => invoke('modificadores:setItems', { id, items }),
    deactivate: (id) => invoke('modificadores:deactivate', { id }),
    activate: (id) => invoke('modificadores:activate', { id }),
  },
  productos: {
    list: (opts) => invoke('productos:list', opts || {}),
    catalogo: () => invoke('productos:catalogo'),
    get: (id) => invoke('productos:get', { id }),
    historialPrecios: (presentacionId) => invoke('productos:historialPrecios', { presentacionId }),
    create: (data) => invoke('productos:create', data),
    update: (id, data) => invoke('productos:update', { id, ...data }),
    setAgotado: (id, agotado) => invoke('productos:setAgotado', { id, agotado }),
    deactivate: (id) => invoke('productos:deactivate', { id }),
    activate: (id) => invoke('productos:activate', { id }),
    addPresentacion: (productoId, nombre, precio) => invoke('productos:addPresentacion', { productoId, nombre, precio }),
    updatePresentacion: (presentacionId, data) => invoke('productos:updatePresentacion', { presentacionId, ...data }),
    setAgotadoPresentacion: (presentacionId, agotado) => invoke('productos:setAgotadoPresentacion', { presentacionId, agotado }),
    deactivatePresentacion: (presentacionId) => invoke('productos:deactivatePresentacion', { presentacionId }),
    activatePresentacion: (presentacionId) => invoke('productos:activatePresentacion', { presentacionId }),
    cambiarPrecio: (presentacionId, precio) => invoke('productos:cambiarPrecio', { presentacionId, precio }),
    setReceta: (presentacionId, receta) => {
      const r = Array.isArray(receta) ? { items: receta, grupos: [] } : (receta || {});
      return invoke('productos:setReceta', { presentacionId, items: r.items || [], grupos: r.grupos || [] });
    },
    setModificadores: (id, modificadorIds) => invoke('productos:setModificadores', { id, modificadorIds }),
  },
  users: {
    list: (opts) => invoke('users:list', opts || {}),
    get: (id) => invoke('users:get', { id }),
    create: (data) => invoke('users:create', data),
    update: (id, data) => invoke('users:update', { id, ...data }),
    changeUsername: (id, username) => invoke('users:changeUsername', { id, username }),
    resetPassword: (id, password) => invoke('users:resetPassword', { id, password }),
    deactivate: (id) => invoke('users:deactivate', { id }),
    activate: (id) => invoke('users:activate', { id }),
    setPermissions: (id, permissions) => invoke('users:setPermissions', { id, permissions }),
  },
  mesas: {
    list: (opts) => invoke('mesas:list', opts || {}),
    create: (nombre) => invoke('mesas:create', { nombre }),
    agregarVarias: (cantidad) => invoke('mesas:agregarVarias', { cantidad }),
    update: (id, data) => invoke('mesas:update', { id, ...data }),
    deactivate: (id) => invoke('mesas:deactivate', { id }),
    activate: (id) => invoke('mesas:activate', { id }),
  },
  ventas: {
    meta: () => invoke('ventas:meta'),
    abiertas: () => invoke('ventas:abiertas'),
    get: (id) => invoke('ventas:get', { id }),
    historial: (opts) => invoke('ventas:historial', opts || {}),
    catalogoProductos: () => invoke('ventas:catalogoProductos'),
    mesas: () => invoke('ventas:mesas'),
    producto: (id) => invoke('ventas:producto', { id }),
    abrir: (tipo, mesaId) => invoke('ventas:abrir', { tipo, mesaId }),
    agregarItem: (ventaId, data) => invoke('ventas:agregarItem', { ventaId, ...data }),
    cambiarTipo: (ventaId, tipo, mesaId) => invoke('ventas:cambiarTipo', { ventaId, tipo, mesaId }),
    cancelarItem: (ventaId, itemId, motivo) => invoke('ventas:cancelarItem', { ventaId, itemId, motivo }),
    cobrar: (ventaId, payload) => invoke('ventas:cobrar', { ventaId, ...payload }), // { itemIds, metodo, etiqueta?, recibido? }
    cancelar: (ventaId, motivo) => invoke('ventas:cancelar', { ventaId, motivo }),
    promocionesAplicables: (ventaId) => invoke('ventas:promocionesAplicables', { ventaId }),
    aplicarPromocion: (ventaId, promocionId) => invoke('ventas:aplicarPromocion', { ventaId, promocionId }),
    quitarPromocion: (ventaId) => invoke('ventas:quitarPromocion', { ventaId }),
  },
  promociones: {
    meta: () => invoke('promociones:meta'),
    list: (opts) => invoke('promociones:list', opts || {}),
    get: (id) => invoke('promociones:get', { id }),
    create: (data) => invoke('promociones:create', data),
    update: (id, data) => invoke('promociones:update', { id, ...data }),
    setActive: (id, activo) => invoke('promociones:setActive', { id, activo }),
  },
  caja: {
    corte: (id) => invoke('caja:corte', { id }),
    cortes: (opts) => invoke('caja:cortes', opts || {}),
    abrir: (fondo_inicial) => invoke('caja:abrir', { fondo_inicial }),
    movimiento: (tipo, monto, concepto) => invoke('caja:movimiento', { tipo, monto, concepto }),
    cerrar: (efectivo_contado, notas) => invoke('caja:cerrar', { efectivo_contado, notas }),
    estadoDia: (fecha) => invoke('cierre:estado', { fecha }),
    cierres: (opts) => invoke('cierre:lista', opts || {}),
    cerrarDia: (fecha) => invoke('cierre:cerrarDia', { fecha }),
    reabrirDia: (fecha) => invoke('cierre:reabrirDia', { fecha }),
  },
  reportes: {
    resumen: (desde, hasta) => invoke('reportes:resumen', { desde, hasta }),
    productos: (desde, hasta) => invoke('reportes:productos', { desde, hasta }),
    insumos: (desde, hasta) => invoke('reportes:insumos', { desde, hasta }),
    inversion: (desde, hasta) => invoke('reportes:inversion', { desde, hasta }),
    merma: (desde, hasta) => invoke('reportes:merma', { desde, hasta }),
    exportar: (tipo, formato, desde, hasta) => invoke('reportes:exportar', { tipo, formato, desde, hasta }),
  },
  roles: {
    list: () => invoke('roles:list'),
    get: (id) => invoke('roles:get', { id }),
    create: (data) => invoke('roles:create', data),
    update: (id, data) => invoke('roles:update', { id, ...data }),
    delete: (id) => invoke('roles:delete', { id }),
  },
  respaldos: {
    list: () => invoke('respaldos:list'),
    info: () => invoke('respaldos:info'),
    crear: () => invoke('respaldos:crear'),
    restaurar: (archivo) => invoke('respaldos:restaurar', { archivo }),
  },
};

contextBridge.exposeInMainWorld('api', api);
