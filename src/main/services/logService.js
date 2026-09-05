'use strict';

const { getDb } = require('../db/connection');

/**
 * Bitácora del sistema (audit_log).
 *
 * SOLO LECTURA desde el exterior: la única forma de escribir es `writeLog`,
 * que llaman los propios servicios/IPC. No hay endpoints para crear, editar
 * ni eliminar registros, y tampoco permisos para ello.
 *
 * Códigos de acción usados en el sistema:
 *   auth.login.success        inicio de sesión correcto
 *   auth.login.failed         intento de inicio de sesión fallido
 *   auth.logout               cierre de sesión
 *   roles.create              rol creado
 *   roles.update              rol editado (nombre / descripción)
 *   roles.permissions         permisos asignados / quitados a un rol
 *   roles.delete              rol eliminado
 *   users.create              usuario creado
 *   users.update              usuario editado
 *   users.username_change     cambio de nombre de usuario
 *   users.password_reset      contraseña restablecida
 *   users.deactivate          usuario desactivado (baja lógica)
 *   users.activate            usuario reactivado
 *   users.permissions         permisos individuales asignados / quitados a un usuario
 *   inventory.categoria.*     alta / edición / baja de categorías de insumos
 *   inventory.insumo.*        alta / edición / baja / reactivación de insumos
 *   inventory.movimiento      entrada / merma / ajuste de existencias
 *   inventory.costo.ajuste    corrección manual del costo unitario de un insumo
 */

function writeLog({ userId = null, username = '', action, detail = '' }) {
  try {
    getDb()
      .prepare(
        'INSERT INTO audit_log (user_id, username, action, detail) VALUES (?, ?, ?, ?)'
      )
      .run(userId, String(username || ''), String(action), String(detail || ''));
  } catch (err) {
    // La bitácora nunca debe romper la operación principal.
    console.error('[audit] no se pudo escribir el log:', err.message);
  }
}

function listLogs({ limit = 200, action = null, search = null } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 1000);
  const like = search ? `%${String(search).trim()}%` : null;
  return getDb()
    .prepare(
      `SELECT id, user_id, username, action, detail,
              datetime(created_at, 'localtime') AS created_at
       FROM audit_log
       WHERE (@action IS NULL OR action = @action)
         AND (@like IS NULL OR detail LIKE @like OR username LIKE @like OR action LIKE @like)
       ORDER BY id DESC
       LIMIT @limit`
    )
    .all({ action: action || null, like, limit: lim });
}

/** Lista de acciones presentes en la bitácora, para el filtro. */
function listActions() {
  return getDb()
    .prepare('SELECT DISTINCT action FROM audit_log ORDER BY action')
    .all()
    .map((r) => r.action);
}

module.exports = { writeLog, listLogs, listActions };
