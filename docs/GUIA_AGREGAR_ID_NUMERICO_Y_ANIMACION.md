# ZENKZONE — Agregar ID numérico en registro y animación en Inicio/Perfil

## Objetivo

Esta actualización modifica el proyecto para que el usuario, al registrarse, tenga que escribir su **ID de Free Fire**. El ID acepta solo números y queda guardado en PostgreSQL.

También se agrega una animación gamer/neón en:

- Inicio / Novedades
- Perfil del usuario

> Nota: la animación es local con HTML + CSS. No depende de TikTok ni de internet.

---

## Archivos modificados

```txt
backend/server.js
frontend/logica/app.js
frontend/estilo/styles.css
database/schema_postgresql.sql
```

## Archivo nuevo

```txt
database/migracion_id_numerico_animacion.sql
```

---

## 1. Base de datos PostgreSQL

Si estás usando una base de datos nueva, ejecuta:

```sql
\i database/schema_postgresql.sql
```

Si ya tenías la base de datos creada, ejecuta este archivo:

```sql
\i database/migracion_id_numerico_animacion.sql
```

O abre el archivo en pgAdmin y presiona **Execute**.

---

## 2. Backend

Archivo:

```txt
backend/server.js
```

Cambios aplicados:

- Se agregó validación para `game_id`.
- El registro ahora exige `game_id`.
- El ID debe tener solo números.
- El ID debe tener entre 5 y 20 dígitos.
- Se guarda en la tabla `users`.
- Se evita duplicar el mismo ID de Free Fire.

Ejemplo de registro enviado al backend:

```json
{
  "username": "yimmy",
  "email": "yimmy@gmail.com",
  "password": "123456",
  "region": "LATAM",
  "game_id": "123456789"
}
```

---

## 3. Frontend

Archivo:

```txt
frontend/logica/app.js
```

Cambios aplicados:

- En la pantalla **Registrarse** aparece un nuevo campo:

```txt
ID de Free Fire
```

- El input solo permite escribir números.
- Si el usuario intenta registrarse sin ID, aparece error.
- Si el ID tiene letras, aparece error.
- La animación se muestra en inicio y en perfil.

---

## 4. Estilos de animación

Archivo:

```txt
frontend/estilo/styles.css
```

Se agregaron clases CSS nuevas:

```txt
.zk-anim-wrap
.zk-anim-panel
.zk-player-card
.zk-avatar-core
.zk-energy-bar
```

Estas clases crean una animación tipo panel gamer/neón.

---

## 5. Cómo probar

1. Entra al backend:

```bash
cd backend
npm run dev
```

2. Abre la página:

```txt
http://localhost:3000
```

3. Entra a **Registrarse**.

4. Llena:

```txt
Usuario
Email
Contraseña
ID de Free Fire
Región
```

5. El ID debe ser algo así:

```txt
123456789
```

6. Revisa PostgreSQL:

```sql
SELECT username, email, game_id, game_region
FROM users
ORDER BY created_at DESC;
```

---

## 6. Qué NO hacer

No insertes usuarios así:

```sql
INSERT INTO users (username,email,password,game_id)
VALUES ('juan','juan@gmail.com','123456','123456789');
```

Eso guarda la contraseña sin seguridad.

Lo correcto es registrar desde la página para que la contraseña se guarde con bcrypt.
