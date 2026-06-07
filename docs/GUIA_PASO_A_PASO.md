# GUÍA PASO A PASO — ZENKZONE con Backend, Frontend y PostgreSQL

## Sesión 1 — Revisar la estructura

Abre la carpeta:

```txt
ZENKZONE_COMPLETO_POSTGRESQL
```

Debe tener esta estructura:

```txt
backend/
frontend/
database/
docs/
```

No muevas los archivos sueltos otra vez. El backend está separado del frontend.

---

## Sesión 2 — Crear la base de datos en PostgreSQL

Abre pgAdmin o SQL Shell y ejecuta:

```sql
CREATE DATABASE zenkzone;
```

También puedes usar el archivo:

```txt
database/crear_base_datos.sql
```

Luego entra a la base de datos `zenkzone` y ejecuta:

```txt
database/schema_postgresql.sql
```

Ese archivo crea todas las tablas y carga datos iniciales de redes, noticias, torneos y tienda.

---

## Sesión 3 — Configurar el backend

Abre este archivo:

```txt
backend/.env
```

Verifica estos datos:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=123456
DB_NAME=zenkzone
PORT=3000
```

Si tu PostgreSQL tiene otra contraseña, cambia solo esta línea:

```env
DB_PASSWORD=tu_contraseña
```

---

## Sesión 4 — Instalar dependencias

Abre CMD o PowerShell dentro de la carpeta `backend`:

```bash
cd ZENKZONE_COMPLETO_POSTGRESQL/backend
npm install
```

Esto instalará:

- express
- pg
- bcryptjs
- dotenv
- nodemailer
- winston
- express-rate-limit

---

## Sesión 5 — Ejecutar el proyecto

Desde la carpeta `backend`, ejecuta:

```bash
npm run dev
```

También puedes usar:

```bash
npm start
```

Cuando funcione, verás algo similar:

```txt
PostgreSQL conectado — BD: zenkzone
ZENKZONE → http://localhost:3000
```

Abre el navegador en:

```txt
http://localhost:3000
```

---

## Sesión 6 — Probar usuario normal

Entra a la página y usa la opción de registro.

Ejemplo:

```txt
Usuario: yimmy
Correo: yimmy@gmail.com
Contraseña: 123456
Región: LATAM
```

El sistema guardará el usuario en PostgreSQL en la tabla:

```txt
users
```

La contraseña se guarda encriptada, no como texto normal.

---

## Sesión 7 — Probar administrador

El administrador está en:

```txt
backend/.env
```

Datos por defecto:

```env
ADMIN_USER_1=admin
ADMIN_PASS_1=123456
```

En la página inicia sesión con:

```txt
Usuario: admin
Contraseña: 123456
```

Ese usuario puede entrar al panel de administración.

---

## Sesión 8 — Archivos que debes modificar

### Para cambiar conexión PostgreSQL

```txt
backend/.env
```

### Para cambiar rutas o lógica del servidor

```txt
backend/server.js
```

### Para cambiar diseño visual

```txt
frontend/estilo/styles.css
```

### Para cambiar funciones del navegador

```txt
frontend/logica/app.js
```

### Para cambiar la estructura de la base de datos

```txt
database/schema_postgresql.sql
```

---

## Sesión 9 — Consultas para revisar si funciona

Abre PostgreSQL y ejecuta:

```sql
SELECT id, username, email, region, points, created_at
FROM users
ORDER BY created_at DESC;
```

Para ver sesiones:

```sql
SELECT token, username, is_admin, created_at, expires_at
FROM sessions
ORDER BY created_at DESC;
```

Para ver ranking:

```sql
SELECT username, region, points
FROM users
WHERE is_admin = 0
ORDER BY points DESC
LIMIT 10;
```

También tienes todo en:

```txt
database/consultas_prueba.sql
```

---

## Sesión 10 — Errores frecuentes

### Error: password authentication failed

Tu contraseña de PostgreSQL está mal en:

```txt
backend/.env
```

Corrige:

```env
DB_PASSWORD=tu_contraseña_real
```

### Error: database zenkzone does not exist

No creaste la base de datos. Ejecuta:

```sql
CREATE DATABASE zenkzone;
```

### Error: relation users does not exist

No ejecutaste el archivo:

```txt
database/schema_postgresql.sql
```

### Error: Cannot find module pg

No instalaste dependencias. Entra a `backend` y ejecuta:

```bash
npm install
```

### Página sin datos

Revisa que el backend esté abierto en:

```txt
http://localhost:3000
```

Y que no estés abriendo directamente el archivo `index.html` con doble clic.
