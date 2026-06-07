# ZENKZONE COMPLETO — Backend + Frontend + PostgreSQL

Proyecto ZENKZONE reorganizado con estructura completa:

```txt
backend/   servidor Express + PostgreSQL
frontend/  HTML + CSS + JavaScript
database/  scripts SQL PostgreSQL
docs/      guía y estructura
```

## 1. Crear base de datos

En PostgreSQL ejecuta:

```sql
CREATE DATABASE zenkzone;
```

Luego abre la base `zenkzone` y ejecuta:

```txt
database/schema_postgresql.sql
```

## 2. Configurar conexión

Edita:

```txt
backend/.env
```

Principalmente:

```env
DB_USER=postgres
DB_PASSWORD=123456
DB_NAME=zenkzone
```

## 3. Instalar y ejecutar backend

```bash
cd backend
npm install
npm run dev
```

## 4. Abrir página

```txt
http://localhost:3000
```

## 5. Usuario administrador

Por defecto:

```txt
Usuario: admin
Contraseña: 123456
```

Puedes cambiarlo en:

```txt
backend/.env
```

## 6. Documentación

Revisa:

```txt
docs/GUIA_PASO_A_PASO.md
docs/ESTRUCTURA_COMPLETA.md
docs/ARCHIVOS_MODIFICADOS_Y_CREADOS.md
```


## Actualización incluida: ID numérico + animación

Esta versión exige el ID de Free Fire durante el registro. El ID solo acepta números y se guarda en PostgreSQL.

También se agregó una animación visual en Inicio/Novedades y Perfil.

Guía específica:

```txt
docs/GUIA_AGREGAR_ID_NUMERICO_Y_ANIMACION.md
```

Para una base ya creada, ejecuta:

```txt
database/migracion_id_numerico_animacion.sql
```
