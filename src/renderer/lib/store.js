// Estado de sesión compartido en el renderer.

let session = { authenticated: false };

export function setSession(s) {
  session = s || { authenticated: false };
}

export function getSession() {
  return session;
}

export function currentUser() {
  return session.user || null;
}

/** ¿El usuario actual tiene este permiso? El admin interno tiene todos. */
export function can(key) {
  if (!session.authenticated) return false;
  if (session.user && session.user.isSystem) return true;
  return Array.isArray(session.permissions) && session.permissions.includes(key);
}

export async function refreshSession() {
  const s = await window.api.auth.session();
  setSession(s);
  return s;
}
