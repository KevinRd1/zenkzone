# ESTRUCTURA COMPLETA — ZENKZONE PostgreSQL

Esta versión deja el proyecto separado en backend, frontend, base de datos y documentación.

```txt
ZENKZONE_COMPLETO_POSTGRESQL/
├── backend/
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   ├── server.js
│   ├── server.mysql.original.js
│   ├── backups/
│   │   └── .gitkeep
│   └── logs/
│       └── .gitkeep
│
├── frontend/
│   ├── index.html
│   ├── estilo/
│   │   └── styles.css
│   ├── logica/
│   │   └── app.js
│   └── assets/
│       └── .gitkeep
│
├── database/
│   ├── crear_base_datos.sql
│   ├── schema_postgresql.sql
│   └── consultas_prueba.sql
│
├── docs/
│   ├── ESTRUCTURA_COMPLETA.md
│   ├── GUIA_PASO_A_PASO.md
│   └── ARCHIVOS_MODIFICADOS_Y_CREADOS.md
│
├── .gitignore
├── INICIAR_BACKEND.bat
└── README.md
```

## Carpetas principales

### backend/
Contiene el servidor Express. Aquí se ejecuta `npm install` y `npm run dev`.

### frontend/
Contiene la página visual: HTML, CSS y JavaScript. No se ejecuta aparte; el backend la sirve en `http://localhost:3000`.

### database/
Contiene los scripts SQL para PostgreSQL.

### docs/
Contiene la guía y explicación de la estructura.
