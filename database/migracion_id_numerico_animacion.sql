-- Migración para proyectos ZENKZONE existentes en PostgreSQL
-- Objetivo: validar que el ID de Free Fire sea numérico y no se repita.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS game_id VARCHAR(50) DEFAULT '';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS game_region VARCHAR(10) DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_game_id_nonempty
ON users(game_id)
WHERE game_id IS NOT NULL AND game_id <> '';

ALTER TABLE users
DROP CONSTRAINT IF EXISTS chk_users_game_id_numeric;

ALTER TABLE users
ADD CONSTRAINT chk_users_game_id_numeric
CHECK (game_id = '' OR game_id ~ '^[0-9]{5,20}$');

-- Prueba rápida:
-- SELECT username, email, game_id, game_region FROM users ORDER BY created_at DESC;
