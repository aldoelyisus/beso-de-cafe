-- Índice para filtrar la bitácora por tipo de acción.
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
