-- Consultas de prueba para verificar ZENKZONE en PostgreSQL

-- 1. Ver usuarios registrados
SELECT id, username, email, region, points, created_at
FROM users
ORDER BY created_at DESC;

-- 2. Ver sesiones activas
SELECT token, username, is_admin, created_at, expires_at
FROM sessions
ORDER BY created_at DESC;

-- 3. Ver noticias
SELECT id, title_es, region, pub_date
FROM news
ORDER BY pub_date DESC;

-- 4. Ver torneos y cantidad de inscritos
SELECT t.id, t.title_es, t.region, t.status, COUNT(tp.username) AS inscritos
FROM tournaments t
LEFT JOIN tournament_participants tp ON tp.tournament_id = t.id
GROUP BY t.id, t.title_es, t.region, t.status
ORDER BY inscritos DESC;

-- 5. Ver tienda
SELECT id, name_es, points, stock, region
FROM store_items
ORDER BY created_at DESC;

-- 6. Ver ranking de usuarios
SELECT username, region, points
FROM users
WHERE is_admin = 0
ORDER BY points DESC
LIMIT 10;
