'use strict';

/**
 * Sesión en memoria. La app es de una sola ventana y un solo usuario a la vez.
 * No se persiste: al cerrar la app hay que volver a iniciar sesión.
 */
let current = null; // { id, name, username, isSystem, permissions: Set<string> }

function setCurrentUser(user) {
  current = user
    ? {
        id: user.id,
        name: user.name,
        username: user.username,
        isSystem: !!user.isSystem,
        permissions: new Set(user.permissions || []),
      }
    : null;
}

function getCurrentUser() {
  return current;
}

function clear() {
  current = null;
}

function isLoggedIn() {
  return !!current;
}

/** El admin interno (is_system) puede todo. */
function can(permissionKey) {
  if (!current) return false;
  if (current.isSystem) return true;
  return current.permissions.has(permissionKey);
}

module.exports = { setCurrentUser, getCurrentUser, clear, isLoggedIn, can };
