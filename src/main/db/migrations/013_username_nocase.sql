-- El nombre de usuario deja de distinguir mayúsculas.
--
-- Antes se podían crear "Lupita" y "LUPITA" como dos personas distintas, y quien
-- se diera de alta como "Lupita" no podía entrar tecleando "lupita" (recibía el
-- mismo mensaje que si la contraseña estuviera mal).
--
-- SQLite no permite cambiar la colación de una columna con ALTER TABLE, así que
-- la unicidad sin mayúsculas se impone con un índice y las búsquedas de login /
-- alta usan COLLATE NOCASE (ver authService.js y userService.js).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_nocase
  ON users(username COLLATE NOCASE);
