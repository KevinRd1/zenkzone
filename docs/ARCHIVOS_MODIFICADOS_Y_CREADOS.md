# ARCHIVOS MODIFICADOS Y CREADOS

## Archivos modificados desde el proyecto original

### 1. `backend/server.js`
Antes usaba MySQL con `mysql2`. Ahora usa PostgreSQL con `pg`.

Cambios principales:
- `mysql2/promise` fue reemplazado por `pg`.
- La conexión usa `Pool` de PostgreSQL.
- Las consultas con `?` se convierten internamente a `$1`, `$2`, `$3`.
- `DATE_ADD`, `CURDATE`, `INSERT IGNORE` y `ON DUPLICATE KEY UPDATE` se adaptaron a PostgreSQL.
- El servidor ahora sirve el frontend desde `../frontend`.

### 2. `frontend/logica/app.js`
Antes llamaba a:

```js
http://localhost:3000/api
```

Ahora llama a:

```js
/api
```

Así funciona correctamente porque Express sirve frontend y API desde el mismo puerto.

### 3. `backend/package.json`
Antes dependía de `mysql2`. Ahora depende de `pg`.

## Archivos creados

### 1. `database/crear_base_datos.sql`
Crea la base de datos PostgreSQL:

```sql
CREATE DATABASE zenkzone;
```

### 2. `database/schema_postgresql.sql`
Crea todas las tablas de ZENKZONE en PostgreSQL:

- users
- sessions
- news
- tournaments
- tournament_participants
- store_items
- store_redemptions
- promo_codes
- code_redemptions
- social_links
- collaborations
- point_log
- live_streams
- notifications
- password_resets
- user_roles

### 3. `database/consultas_prueba.sql`
Consultas para revisar usuarios, sesiones, torneos, tienda y ranking.

### 4. `backend/.env`
Archivo de configuración del servidor y PostgreSQL.

### 5. `backend/server.mysql.original.js`
Copia de respaldo del servidor original con MySQL.
