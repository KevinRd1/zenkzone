// ╔══════════════════════════════════════════════════════════════╗
// ║         ZENKZONE — backend/server.js PostgreSQL               ║
// ║  bcrypt · .env · rate-limit · validación · logs ·          ║
// ║  backup · notificaciones · roles · API pública ·           ║
// ║  recuperación contraseña · perfil público                  ║
// ╚══════════════════════════════════════════════════════════════╝
'use strict';

// ─────────────────────────────────────────────────────────────
// 1. DEPENDENCIAS
// ─────────────────────────────────────────────────────────────
require('dotenv').config();
const express   = require('express');
const { Pool }  = require('pg');
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');
const path      = require('path');
const fs        = require('fs');
const rateLimit = require('express-rate-limit');
const nodemailer= require('nodemailer');
const winston   = require('winston');

const app  = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────
// 2. SISTEMA DE LOGS
// ─────────────────────────────────────────────────────────────
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) =>
      `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'server.log') }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple())
    }),
  ],
});

// ─────────────────────────────────────────────────────────────
// 3. CONFIGURACIÓN DESDE .env
// ─────────────────────────────────────────────────────────────
const DB_CONFIG = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '123456',
      database: process.env.DB_NAME || process.env.DB_DATABASE || 'zenkzone',
      max: 10,
    };
const ADMIN_CREDS = [
  { username: process.env.ADMIN_USER_1 || 'admin', password: process.env.ADMIN_PASS_1 || '123456' },
  { username: process.env.ADMIN_USER_2 || 'moderador',  password: process.env.ADMIN_PASS_2 || '123456' },
];
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
// ID de Free Fire: solo números, entre 5 y 20 dígitos.
const GAME_ID_RE = /^\d{5,20}$/;

// ─────────────────────────────────────────────────────────────
// 4. BASE DE DATOS — PostgreSQL
// ─────────────────────────────────────────────────────────────
let pool;

function toPg(sql) {
  let out = sql;

  // MySQL → PostgreSQL: fechas relativas.
  out = out.replace(/DATE_ADD\(NOW\(\),\s*INTERVAL\s+7\s+DAY\)/gi, "(NOW() + INTERVAL '7 days')");
  out = out.replace(/DATE_ADD\(NOW\(\),\s*INTERVAL\s+30\s+MINUTE\)/gi, "(NOW() + INTERVAL '30 minutes')");
  out = out.replace(/DATE_ADD\(NOW\(\),\s*INTERVAL\s+1\s+HOUR\)/gi, "(NOW() + INTERVAL '1 hour')");
  out = out.replace(/DATE\(created_at\)\s*=\s*CURDATE\(\)/gi, 'created_at::date = CURRENT_DATE');

  // MySQL → PostgreSQL: INSERT IGNORE.
  const wasInsertIgnore = /^\s*INSERT\s+IGNORE\s+INTO/i.test(out);
  out = out.replace(/^\s*INSERT\s+IGNORE\s+INTO/i, 'INSERT INTO');

  // MySQL → PostgreSQL: ON DUPLICATE KEY UPDATE para user_roles.
  out = out.replace(
    /ON\s+DUPLICATE\s+KEY\s+UPDATE\s+role=\?,\s*granted_by=\?/i,
    'ON CONFLICT (username) DO UPDATE SET role=?, granted_by=?'
  );

  // Convierte placeholders ? en $1, $2, $3...
  let i = 0;
  out = out.replace(/\?/g, () => `$${++i}`);

  if (wasInsertIgnore && !/ON\s+CONFLICT/i.test(out)) {
    out += ' ON CONFLICT DO NOTHING';
  }
  return out;
}

async function q(sql, params = []) {
  const result = await pool.query(toPg(sql), params);
  return result.rows;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

async function conectarDB() {
  try {
    pool = new Pool(DB_CONFIG);

    // Compatibilidad mínima para el resto del archivo, que venía de mysql2.
    pool.getConnection = async () => {
      const client = await pool.connect();
      client.execute = async (sql, params = []) => {
        const result = await client.query(toPg(sql), params);
        return [result.rows];
      };
      client.beginTransaction = async () => client.query('BEGIN');
      client.commit = async () => client.query('COMMIT');
      client.rollback = async () => client.query('ROLLBACK');
      return client;
    };

    const conn = await pool.getConnection();
    logger.info('PostgreSQL conectado — BD: ' + DB_CONFIG.database);
    conn.release();
    await autoMigrate();
  } catch (err) {
    logger.error('ERROR PostgreSQL: ' + err.message);
    logger.error('→ Verifica PostgreSQL, la BD zenkzone y el archivo .env');
    process.exit(1);
  }
}

async function autoMigrate() {
  // Este archivo incluye una migración básica para crear las tablas si aún no existen.
  // Para clases o entrega formal, se recomienda ejecutar también:
  // database/schema_postgresql.sql
  const schemaPath = path.join(__dirname, '..', 'database', 'schema_postgresql.sql');
  try {
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
      logger.info('Migraciones PostgreSQL OK desde schema_postgresql.sql');
    } else {
      logger.warn('No se encontró database/schema_postgresql.sql. Ejecuta el script SQL manualmente.');
    }
  } catch (err) {
    logger.error('Error ejecutando migraciones PostgreSQL: ' + err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// 5. BACKUP AUTOMÁTICO
// ─────────────────────────────────────────────────────────────
async function hacerBackup() {
  const dir = path.join(__dirname, process.env.BACKUP_DIR || 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fecha    = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const filename = path.join(dir, `backup_${fecha}.json`);
  const tablas   = ['users','news','tournaments','tournament_participants',
                    'store_items','store_redemptions','promo_codes',
                    'code_redemptions','social_links','collaborations',
                    'point_log','live_streams','notifications'];
  const data = { fecha, tablas: {} };
  for (const t of tablas) {
    try { data.tablas[t] = await q(`SELECT * FROM ${t}`); }
    catch { data.tablas[t] = []; }
  }
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  logger.info(`Backup: ${filename} (${Math.round(fs.statSync(filename).size/1024)} KB)`);
  // Conservar solo 7 backups
  const files = fs.readdirSync(dir).filter(f=>f.startsWith('backup_')).sort().reverse();
  files.slice(7).forEach(f => fs.unlinkSync(path.join(dir, f)));
}

// ─────────────────────────────────────────────────────────────
// 6. CORREO
// ─────────────────────────────────────────────────────────────
async function enviarCorreo(to, subject, html) {
  // En producción Render: usar Resend API
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: process.env.RESEND_FROM || 'ZENKZONE <onboarding@resend.dev>',
        to,
        subject,
        html
      });

      return true;
    } catch (err) {
      logger.error('Error correo Resend: ' + err.message);
      return false;
    }
  }

  // Localhost: seguir usando Gmail SMTP
  const mailHost = (process.env.MAIL_HOST || 'smtp.gmail.com').trim();
  const mailPort = Number(process.env.MAIL_PORT || 587);
  const mailUser = (process.env.MAIL_USER || '').trim();
  const mailPass = (process.env.MAIL_PASS || '').trim().replace(/\s/g, '');
  const mailFrom = (process.env.MAIL_FROM || `ZENKZONE <${mailUser}>`).trim();

  if (!mailUser || !mailPass) {
    logger.warn('Correo no configurado — revisa MAIL_USER y MAIL_PASS en .env');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: false,
      auth: {
        user: mailUser,
        pass: mailPass
      }
    });

    await transporter.sendMail({
      from: mailFrom,
      to,
      subject,
      html
    });

    return true;
  } catch (err) {
    logger.error('Error correo: ' + err.message);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// 7. VALIDADOR DE DATOS
// ─────────────────────────────────────────────────────────────
function validar(rules) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, opts] of Object.entries(rules)) {
      const val = req.body?.[field];
      if (opts.required && (val === undefined || val === null || val === '')) {
        errors.push(`${field} es requerido`); continue;
      }
      if (val !== undefined && val !== '') {
        if (opts.minLen  && String(val).length < opts.minLen)  errors.push(`${field}: mínimo ${opts.minLen} caracteres`);
        if (opts.maxLen  && String(val).length > opts.maxLen)  errors.push(`${field}: máximo ${opts.maxLen} caracteres`);
        if (opts.pattern && !opts.pattern.test(String(val)))   errors.push(`${field}: formato inválido`);
        if (opts.isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) errors.push(`${field}: email inválido`);
      }
    }
    if (errors.length) return res.status(400).json({ error: errors.join(' | ') });
    next();
  };
}

// ─────────────────────────────────────────────────────────────
// 8. NOTIFICACIONES (helper)
// ─────────────────────────────────────────────────────────────
async function notif(username, type, title, message, link = '') {
  try {
    await q('INSERT INTO notifications (username,type,title,message,link) VALUES (?,?,?,?,?)',
            [username, type, title, message, link]);
  } catch {}
}
async function notifAll(type, title, message, link = '') {
  try {
    const users = await q('SELECT username FROM users');
    for (const u of users) await notif(u.username, type, title, message, link);
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// 9. MIDDLEWARE GLOBAL
// ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Rate limiting
const rlGeneral = rateLimit({ windowMs:15*60*1000, max: Number(process.env.RATE_LIMIT_MAX_REQUESTS)||200, message:{error:'Demasiadas peticiones. Espera unos minutos.'}, standardHeaders:true, legacyHeaders:false });
const rlLogin   = rateLimit({ windowMs:15*60*1000, max: Number(process.env.LOGIN_RATE_LIMIT_MAX)||10,  message:{error:'Demasiados intentos. Espera 15 minutos.'}, standardHeaders:true, legacyHeaders:false });
app.use('/api/', rlGeneral);
app.use('/api/auth/login', rlLogin);

// Log de peticiones
app.use('/api/', (req, res, next) => {
  if (!req.path.includes('me') && !req.path.includes('notifications')) {
    logger.info(`${req.method} /api${req.path}`);
  }
  next();
});

// ─────────────────────────────────────────────────────────────
// 10. AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────
async function auth(req, res, next) {
  const token = (req.headers['authorization'] || '').replace('Bearer ','').trim();
  req.user = null;
  if (!token) return next();
  try {
    const rows = await q('SELECT * FROM sessions WHERE token=? AND (expires_at IS NULL OR expires_at>NOW())',[token]);
    if (!rows.length) return next();
    const sess = rows[0];
    if (sess.is_admin) {
      req.user = { username: sess.username, isAdmin: true, role: 'admin', points: 0 };
    } else {
      const us = await q('SELECT * FROM users WHERE username=?',[sess.username]);
      if (us.length) {
        const u = us[0];
        if (u.locked_until && new Date(u.locked_until) > new Date())
          return res.status(403).json({ error: 'Cuenta bloqueada temporalmente.' });
        const roles = await q('SELECT role FROM user_roles WHERE username=?',[sess.username]);
        u.role = roles.length ? roles[0].role : 'user';
        req.user = u;
      }
    }
  } catch(e) { logger.error('Auth error: '+e.message); }
  next();
}
function requireAuth(req, res, next)  { if (!req.user)            return res.status(401).json({error:'No autorizado'});     next(); }
function requireAdmin(req, res, next) { if (!req.user?.isAdmin)   return res.status(403).json({error:'Solo administradores'}); next(); }
function requireMod(req, res, next)   {
  if (!req.user) return res.status(401).json({error:'No autorizado'});
  if (req.user.isAdmin || req.user.role === 'moderator') return next();
  return res.status(403).json({error:'Se requiere moderador o admin'});
}

// ─────────────────────────────────────────────────────────────
// 11. 🔐 AUTENTICACIÓN
// ─────────────────────────────────────────────────────────────
app.post('/api/auth/login',
  validar({ username:{required:true,maxLen:50}, password:{required:true,maxLen:100} }),
  async (req,res) => {
    const { username, password } = req.body;
    // Admin fijo
    const adm = ADMIN_CREDS.find(a=>a.username===username && a.password===password);
    if (adm) {
      const token = crypto.randomBytes(32).toString('hex');
      await q('INSERT INTO sessions (token,username,is_admin,expires_at) VALUES (?,?,1,DATE_ADD(NOW(),INTERVAL 7 DAY))',[token,username]);
      logger.info(`Admin login: ${username}`);
      return res.json({ token, user:{username,isAdmin:true,points:0,region:'LATAM',role:'admin'} });
    }
    const users = await q('SELECT * FROM users WHERE username=?',[username]);
    if (!users.length) return res.status(401).json({error:'Usuario o contraseña incorrectos'});
    const user = users[0];
    if (user.locked_until && new Date(user.locked_until) > new Date())
      return res.status(403).json({error:'Cuenta bloqueada 30 min por intentos fallidos.'});
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      const attempts = (user.login_attempts||0) + 1;
      if (attempts >= 5) {
        await q('UPDATE users SET login_attempts=?,locked_until=DATE_ADD(NOW(),INTERVAL 30 MINUTE) WHERE username=?',[attempts,username]);
        logger.warn(`Cuenta bloqueada: ${username}`);
        return res.status(403).json({error:'Cuenta bloqueada 30 min por 5 intentos fallidos.'});
      }
      await q('UPDATE users SET login_attempts=? WHERE username=?',[attempts,username]);
      return res.status(401).json({error:'Usuario o contraseña incorrectos'});
    }
    await q('UPDATE users SET login_attempts=0,locked_until=NULL,last_login=NOW() WHERE username=?',[username]);
    const token = crypto.randomBytes(32).toString('hex');
    await q('INSERT INTO sessions (token,username,is_admin,expires_at) VALUES (?,?,0,DATE_ADD(NOW(),INTERVAL 7 DAY))',[token,username]);
    logger.info(`Login: ${username}`);
    const {password:_,...safe} = user;
    res.json({ token, user: safe });
  }
);

app.post('/api/auth/register',
  validar({ username:{required:true,minLen:3,maxLen:50,pattern:/^[a-zA-Z0-9_]+$/}, email:{required:true,isEmail:true,maxLen:150}, password:{required:true,minLen:6,maxLen:100}, game_id:{required:true,minLen:5,maxLen:20,pattern:GAME_ID_RE} }),
  async (req,res) => {
    const { username, email, password, region, game_id } = req.body;
    if (ADMIN_CREDS.some(a=>a.username===username)) return res.status(400).json({error:'Usuario no disponible'});
    try {
      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await q('INSERT INTO users (username,email,password,region,game_id,game_region) VALUES (?,?,?,?,?,?)',[username,email,hash,region||'OTRO',game_id,region||'OTRO']);
      const us = await q('SELECT * FROM users WHERE username=?',[username]);
      const token = crypto.randomBytes(32).toString('hex');
      await q('INSERT INTO sessions (token,username,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 7 DAY))',[token,username]);
      await q('INSERT IGNORE INTO user_roles (username,role) VALUES (?,?)',[username,'user']);
      logger.info(`Registro: ${username} (${region})`);
      const {password:_,...safe} = us[0];
      res.json({ token, user: safe });
    } catch(e) {
      if (e.code==='ER_DUP_ENTRY' || e.code==='23505') return res.status(400).json({error:'Usuario, email o ID de Free Fire ya registrado'});
      res.status(500).json({error:e.message});
    }
  }
);

app.post('/api/auth/logout', auth, async (req,res) => {
  const token = (req.headers['authorization']||'').replace('Bearer ','').trim();
  await q('DELETE FROM sessions WHERE token=?',[token]);
  res.json({ok:true});
});

app.get('/api/auth/me', auth, requireAuth, async (req,res) => {
  if (req.user.isAdmin) return res.json(req.user);
  const rows = await q('SELECT * FROM users WHERE username=?',[req.user.username]);
  if (!rows.length) return res.status(404).json({error:'No encontrado'});
  const {password:_,...safe} = rows[0];
  const roles = await q('SELECT role FROM user_roles WHERE username=?',[req.user.username]);
  safe.role = roles.length ? roles[0].role : 'user';
  res.json(safe);
});

// Olvidé mi contraseña
// ── Paso 1: Solicitar código de 6 dígitos por correo ─────────
app.post('/api/auth/forgot-password',
  validar({ email:{required:true,isEmail:true} }),
  async (req,res) => {
    const { email } = req.body;
    const users = await q('SELECT * FROM users WHERE email=?',[email]);
    // Siempre responder OK para no revelar si el email existe
    if (!users.length) return res.json({ok:true});
    const user = users[0];
    

    // Generar código de 6 dígitos
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Token interno
    const token = crypto.randomBytes(32).toString('hex');

    // Ver el código en consola para prueba
    console.log('CÓDIGO DE RECUPERACIÓN:', code);

    // Limpiar códigos anteriores
    await q('DELETE FROM password_resets WHERE username=?', [user.username]);

   // Guardar código
   await q(
   'INSERT INTO password_resets (username, token, code, expires_at) VALUES (?,?,?, NOW() + INTERVAL \'15 minutes\')',
   [user.username, token, code]
);

    // Enviar correo con el código
      const enviado = await enviarCorreo(email, 'Tu código de verificación — ZENKZONE 👾', `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#040810;color:#e0e8ff;padding:32px;border-radius:12px;border:1px solid rgba(0,255,136,0.15);">
    <h2 style="color:#00FF88;font-family:sans-serif;margin-bottom:4px;">ZENKZONE 👾</h2>
    <p style="color:#6a7a9b;font-size:13px;margin-bottom:24px;">Free Fire Hub — LATAM & EEUU</p>
    <p>Hola <strong style="color:#00D4FF;">${user.username}</strong>,</p>
    <p style="margin-bottom:24px;">Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código:</p>
    <div style="background:#060C1A;border:1px solid rgba(0,255,136,0.25);border-radius:10px;padding:24px;text-align:center;margin:24px 0;">
      <div style="font-family:monospace;font-size:42px;font-weight:900;letter-spacing:12px;color:#00FF88;">${code}</div>
      <div style="color:#6a7a9b;font-size:12px;margin-top:10px;letter-spacing:2px;text-transform:uppercase;">Código de verificación</div>
    </div>
    <p style="color:#6a7a9b;font-size:13px;line-height:1.6;">
      Este código expira en <strong style="color:#FF9500;">15 minutos</strong>.<br>
      Si no solicitaste esto, ignora este correo.
    </p>
  </div>
`);

if (!enviado) {
  return res.status(500).json({
    error: 'No se pudo enviar el correo. Revisa MAIL_USER y MAIL_PASS en el archivo .env'
  });
}

logger.info(`Código de reset enviado a: ${user.username}`);
res.json({ ok: true });
  }
);

// ── Paso 2: Verificar el código de 6 dígitos ─────────────────
// Devuelve el token interno si el código es correcto
app.post('/api/auth/verify-reset-code',
  validar({ email:{required:true,isEmail:true}, code:{required:true} }),
  async (req,res) => {
    const { email, code } = req.body;
    const users = await q('SELECT username FROM users WHERE email=?',[email]);
    if (!users.length) return res.status(400).json({error:'Código incorrecto o expirado'});
    const username = users[0].username;

    const rows = await q(
      'SELECT * FROM password_resets WHERE username=? AND code=? AND used=0 AND expires_at>NOW()',
      [username, code.trim()]
    );
    if (!rows.length) return res.status(400).json({error:'Código incorrecto o expirado'});

    // Marcar código como verificado (used=2 = verificado pero no cambiado aún)
    await q('UPDATE password_resets SET used=2 WHERE token=?',[rows[0].token]);

    logger.info(`Código verificado: ${username}`);
    // Devolver el token interno para el paso 3
    res.json({ok:true, token:rows[0].token});
  }
);

// ── Paso 3: Cambiar contraseña con token verificado ──────────
app.post('/api/auth/reset-password',
  validar({ token:{required:true}, password:{required:true,minLen:6,maxLen:100} }),
  async (req,res) => {
    const { token, password } = req.body;
    // Solo acepta tokens que fueron verificados (used=2)
    const rows = await q(
      'SELECT * FROM password_resets WHERE token=? AND used=2 AND expires_at>NOW()',
      [token]
    );
    if (!rows.length) return res.status(400).json({error:'Sesión de recuperación inválida o expirada'});
    const reset = rows[0];
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await q('UPDATE users SET password=?,login_attempts=0,locked_until=NULL WHERE username=?',[hash,reset.username]);
    await q('UPDATE password_resets SET used=1 WHERE token=?',[token]);
    await q('DELETE FROM sessions WHERE username=?',[reset.username]);
    logger.info(`Contraseña restablecida: ${reset.username}`);
    res.json({ok:true});
  }
);

// ─────────────────────────────────────────────────────────────
// 12. 📰 NOTICIAS
// ─────────────────────────────────────────────────────────────
app.get('/api/news', async (req,res) => {
  const {region} = req.query;
  const rows = region && region!=='ALL'
    ? await q("SELECT * FROM news WHERE region=? OR region='ALL' ORDER BY pub_date DESC",[region])
    : await q('SELECT * FROM news ORDER BY pub_date DESC');
  res.json(rows);
});
app.post('/api/news', auth, requireMod, validar({title_es:{required:true,maxLen:200}}), async (req,res) => {
  const {title_es,title_en,content_es,content_en,image,region,pub_date} = req.body;
  const id = uid();
  await q('INSERT INTO news (id,title_es,title_en,content_es,content_en,image,region,pub_date) VALUES (?,?,?,?,?,?,?,?)',
    [id,title_es,title_en||'',content_es||'',content_en||'',image||'',region||'ALL',pub_date||new Date().toISOString().split('T')[0]]);
  logger.info(`Novedad: "${title_es}" por ${req.user.username}`);
  res.json((await q('SELECT * FROM news WHERE id=?',[id]))[0]);
});
app.put('/api/news/:id', auth, requireMod, async (req,res) => {
  const {title_es,title_en,content_es,content_en,image,region,pub_date} = req.body;
  await q('UPDATE news SET title_es=?,title_en=?,content_es=?,content_en=?,image=?,region=?,pub_date=? WHERE id=?',
    [title_es,title_en,content_es,content_en,image,region,pub_date,req.params.id]);
  res.json({ok:true});
});
app.delete('/api/news/:id', auth, requireAdmin, async (req,res) => {
  await q('DELETE FROM news WHERE id=?',[req.params.id]); res.json({ok:true});
});

// ─────────────────────────────────────────────────────────────
// 13. 🏆 TORNEOS
// ─────────────────────────────────────────────────────────────
async function tourneosConParts(rows) {
  const result = [];
  for (const t of rows) {
    const parts = await q('SELECT username FROM tournament_participants WHERE tournament_id=?',[t.id]);
    result.push({...t, finalized:!!t.finalized, participants:parts.map(r=>r.username)});
  }
  return result;
}
app.get('/api/tournaments', async (req,res) => {
  const {region} = req.query;
  const rows = region && region!=='ALL'
    ? await q("SELECT * FROM tournaments WHERE region=? OR region='ALL' ORDER BY created_at DESC",[region])
    : await q('SELECT * FROM tournaments ORDER BY created_at DESC');
  res.json(await tourneosConParts(rows));
});
app.post('/api/tournaments', auth, requireAdmin, validar({title_es:{required:true,maxLen:200}}), async (req,res) => {
  const {title_es,title_en,desc_es,desc_en,region,status,start_date,end_date} = req.body;
  const id = uid();
  await q('INSERT INTO tournaments (id,title_es,title_en,desc_es,desc_en,region,status,start_date,end_date) VALUES (?,?,?,?,?,?,?,?,?)',
    [id,title_es,title_en||'',desc_es||'',desc_en||'',region||'LATAM',status||'upcoming',start_date,end_date]);
  await notifAll('tournament','🏆 Nuevo Torneo',`Inscripción abierta: ${title_es}`,'/torneos');
  logger.info(`Torneo creado: "${title_es}"`);
  res.json({id});
});
app.put('/api/tournaments/:id', auth, requireAdmin, async (req,res) => {
  const {title_es,title_en,desc_es,desc_en,region,status,start_date,end_date} = req.body;
  await q('UPDATE tournaments SET title_es=?,title_en=?,desc_es=?,desc_en=?,region=?,status=?,start_date=?,end_date=? WHERE id=?',
    [title_es,title_en,desc_es,desc_en,region,status,start_date,end_date,req.params.id]);
  res.json({ok:true});
});
app.delete('/api/tournaments/:id', auth, requireAdmin, async (req,res) => {
  await q('DELETE FROM tournament_participants WHERE tournament_id=?',[req.params.id]);
  await q('DELETE FROM tournaments WHERE id=?',[req.params.id]);
  res.json({ok:true});
});
app.post('/api/tournaments/:id/join', auth, requireAuth, async (req,res) => {
  const rows = await q('SELECT * FROM tournaments WHERE id=?',[req.params.id]);
  if (!rows.length) return res.status(404).json({error:'No encontrado'});
  if (rows[0].finalized) return res.status(400).json({error:'Torneo finalizado'});
  try {
    await q('INSERT INTO tournament_participants (tournament_id,username) VALUES (?,?)',[req.params.id,req.user.username]);
    await notif(req.user.username,'tournament','✅ Inscripción confirmada',`Te inscribiste en: ${rows[0].title_es}`,'/torneos');
    res.json({ok:true});
  } catch(e) {
    if (e.code==='ER_DUP_ENTRY' || e.code==='23505') return res.status(400).json({error:'Ya estás inscrito'});
    res.status(500).json({error:e.message});
  }
});
app.post('/api/tournaments/:id/award', auth, requireAdmin, async (req,res) => {
  const {winner_1,winner_2,winner_3,prize_1st,prize_2nd,prize_3rd,extra_pts} = req.body;
  const rows = await q('SELECT * FROM tournaments WHERE id=?',[req.params.id]);
  if (!rows.length) return res.status(404).json({error:'No encontrado'});
  const tour  = rows[0];
  const p1=Number(prize_1st)||700, p2=Number(prize_2nd)||550, p3=Number(prize_3rd)||350;
  const extra=Number(extra_pts)||0;
  const parts = await q('SELECT username FROM tournament_participants WHERE tournament_id=?',[req.params.id]);
  const conn  = await pool.getConnection();
  await conn.beginTransaction();
  try {
    for (const {username} of parts) {
      let pts = tour.prize_part||10;
      if (username===winner_1) pts=p1;
      else if (username===winner_2) pts=p2;
      else if (username===winner_3) pts=p3;
      pts += extra;
      await conn.execute('UPDATE users SET points=points+? WHERE username=?',[pts,username]);
      await conn.execute('INSERT INTO point_log (username,amount,reason) VALUES (?,?,?)',[username,pts,`torneo:${req.params.id}`]);
      const medal = username===winner_1?'🥇 1er lugar':username===winner_2?'🥈 2do lugar':username===winner_3?'🥉 3er lugar':'🎮 Participación';
      await notif(username,'points',`${medal} — +${pts} pts`,`Recibiste ${pts} puntos del torneo: ${tour.title_es}`,'/perfil');
    }
    await conn.execute("UPDATE tournaments SET finalized=1,status='finished',winner_1=?,winner_2=?,winner_3=?,prize_1st=?,prize_2nd=?,prize_3rd=? WHERE id=?",
      [winner_1||'',winner_2||'',winner_3||'',p1,p2,p3,req.params.id]);
    await conn.commit();
    logger.info(`Torneo finalizado: ${tour.title_es}`);
    res.json({ok:true});
  } catch(e) { await conn.rollback(); res.status(500).json({error:e.message}); }
  finally { conn.release(); }
});

// ─────────────────────────────────────────────────────────────
// 14. 🛒 TIENDA
// ─────────────────────────────────────────────────────────────
app.get('/api/store', async (req,res) => res.json(await q('SELECT * FROM store_items ORDER BY created_at DESC')));
app.post('/api/store', auth, requireAdmin, validar({name_es:{required:true,maxLen:200},points:{required:true}}), async (req,res) => {
  const {name_es,name_en,desc_es,desc_en,image,points,stock,region} = req.body;
  const id=uid();
  await q('INSERT INTO store_items (id,name_es,name_en,desc_es,desc_en,image,points,stock,region) VALUES (?,?,?,?,?,?,?,?,?)',
    [id,name_es,name_en||'',desc_es||'',desc_en||'',image||'',Number(points),Number(stock)||0,region||'ALL']);
  res.json({id});
});
app.put('/api/store/:id', auth, requireAdmin, async (req,res) => {
  const {name_es,name_en,desc_es,desc_en,image,points,stock,region} = req.body;
  await q('UPDATE store_items SET name_es=?,name_en=?,desc_es=?,desc_en=?,image=?,points=?,stock=?,region=? WHERE id=?',
    [name_es,name_en,desc_es,desc_en,image,Number(points),Number(stock),region,req.params.id]);
  res.json({ok:true});
});
app.delete('/api/store/:id', auth, requireAdmin, async (req,res) => {
  await q('DELETE FROM store_items WHERE id=?',[req.params.id]); res.json({ok:true});
});
app.get('/api/store/history', auth, requireAuth, async (req,res) =>
  res.json(await q('SELECT * FROM store_redemptions WHERE username=? ORDER BY redeemed_at DESC',[req.user.username]))
);
app.get('/api/store/all-redemptions', auth, requireAdmin, async (req,res) =>
  res.json(await q('SELECT sr.*,u.region AS user_region FROM store_redemptions sr LEFT JOIN users u ON sr.username=u.username ORDER BY sr.redeemed_at DESC'))
);
app.post('/api/store/:id/redeem', auth, requireAuth, async (req,res) => {
  const {game_id,game_region} = req.body||{};
  if (game_id && !GAME_ID_RE.test(String(game_id))) return res.status(400).json({error:'El ID de Free Fire solo debe tener números, entre 5 y 20 dígitos'});
  const items = await q('SELECT * FROM store_items WHERE id=?',[req.params.id]);
  if (!items.length) return res.status(404).json({error:'Ítem no encontrado'});
  const item = items[0];
  if (item.stock<=0) return res.status(400).json({error:'Sin stock'});
  const users = await q('SELECT * FROM users WHERE username=?',[req.user.username]);
  if (!users.length) return res.status(404).json({error:'Usuario no encontrado'});
  const user = users[0];
  if (user.points<item.points) return res.status(400).json({error:'Puntos insuficientes'});
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    await conn.execute('UPDATE users SET points=points-? WHERE username=?',[item.points,req.user.username]);
    await conn.execute('UPDATE store_items SET stock=stock-1 WHERE id=? AND stock>0',[item.id]);
    if (game_id && (!user.game_id||user.game_id===''))
      await conn.execute('UPDATE users SET game_id=?,game_region=? WHERE username=?',[game_id,game_region||'',req.user.username]);
    const gid=game_id||user.game_id||'', greg=game_region||user.game_region||'';
    await conn.execute('INSERT INTO store_redemptions (username,item_id,item_name,points_used,game_id,game_region) VALUES (?,?,?,?,?,?)',
      [req.user.username,item.id,item.name_es,item.points,gid,greg]);
    await conn.execute('INSERT INTO point_log (username,amount,reason) VALUES (?,?,?)',
      [req.user.username,-item.points,`tienda:${item.id}`]);
    const upd = (await conn.execute('SELECT * FROM users WHERE username=?',[req.user.username]))[0][0];
    if (greg && greg!==upd.region && greg!=='OTRO' && upd.region!=='OTRO')
      await conn.execute('UPDATE users SET region_mismatch=1 WHERE username=?',[req.user.username]);
    await conn.commit();
    await notif(req.user.username,'store',`🛒 Canje exitoso`,`Canjeaste "${item.name_es}" por ${item.points} pts`,'/tienda');
    const fresh=(await q('SELECT * FROM users WHERE username=?',[req.user.username]))[0];
    const {password:_,...safe}=fresh;
    res.json({ok:true,user:safe});
  } catch(e) { await conn.rollback(); res.status(500).json({error:e.message}); }
  finally { conn.release(); }
});

// ─────────────────────────────────────────────────────────────
// 15. 🎟️ CÓDIGOS
// ─────────────────────────────────────────────────────────────
app.get('/api/codes', auth, requireAdmin, async (req,res) => {
  const codes = await q('SELECT * FROM promo_codes ORDER BY created_at DESC');
  for (const c of codes) { const u=await q('SELECT COUNT(*) as n FROM code_redemptions WHERE code=?',[c.code]); c.times_used=u[0].n; }
  res.json(codes);
});
app.post('/api/codes', auth, requireAdmin, validar({code:{required:true,maxLen:50}}), async (req,res) => {
  const {code,points,max_uses}=req.body;
  try {
    const id=uid();
    await q('INSERT INTO promo_codes (id,code,points,max_uses) VALUES (?,?,?,?)',[id,code.toUpperCase(),Number(points)||100,Number(max_uses)||50]);
    res.json({id});
  } catch(e) {
    if (e.code==='ER_DUP_ENTRY' || e.code==='23505') return res.status(400).json({error:'Código ya existe'});
    res.status(500).json({error:e.message});
  }
});
app.delete('/api/codes/:id', auth, requireAdmin, async (req,res) => {
  await q('DELETE FROM promo_codes WHERE id=?',[req.params.id]); res.json({ok:true});
});
app.post('/api/codes/redeem', auth, requireAuth, async (req,res) => {
  const {code}=req.body;
  if (!code) return res.status(400).json({error:'Código requerido'});
  const codes=await q('SELECT * FROM promo_codes WHERE code=?',[code.toUpperCase()]);
  if (!codes.length) return res.status(400).json({error:'Código inválido'});
  const co=codes[0];
  const uses=await q('SELECT COUNT(*) as n FROM code_redemptions WHERE code=?',[code.toUpperCase()]);
  if (uses[0].n>=co.max_uses) return res.status(400).json({error:'Código agotado'});
  try {
    await q('INSERT INTO code_redemptions (code,username,points_awarded) VALUES (?,?,?)',[code.toUpperCase(),req.user.username,co.points]);
    await q('UPDATE users SET points=points+? WHERE username=?',[co.points,req.user.username]);
    await q('INSERT INTO point_log (username,amount,reason) VALUES (?,?,?)',[req.user.username,co.points,`codigo:${code}`]);
    await notif(req.user.username,'points',`🎟️ +${co.points} pts`,`Código ${code.toUpperCase()} canjeado`,'/perfil');
    const fresh=await q('SELECT * FROM users WHERE username=?',[req.user.username]);
    const {password:_,...safe}=fresh[0];
    res.json({ok:true,points:co.points,user:safe});
  } catch(e) {
    if (e.code==='ER_DUP_ENTRY' || e.code==='23505') return res.status(400).json({error:'Ya canjeaste este código'});
    res.status(500).json({error:e.message});
  }
});

// ─────────────────────────────────────────────────────────────
// 16. 📱 SOCIAL & COLLABS
// ─────────────────────────────────────────────────────────────
app.get('/api/social',  async (req,res) => res.json(await q('SELECT * FROM social_links ORDER BY sort_order ASC')));
app.post('/api/social', auth, requireAdmin, validar({platform:{required:true},url:{required:true,maxLen:500}}), async (req,res) => {
  const {platform,url,icon}=req.body;
  const m=await q('SELECT MAX(sort_order) as m FROM social_links');
  const id=uid();
  await q('INSERT INTO social_links (id,platform,url,icon,sort_order) VALUES (?,?,?,?,?)',[id,platform,url,icon||'◈',(m[0].m||0)+1]);
  res.json({id});
});
app.put('/api/social/:id',  auth, requireAdmin, async (req,res) => { const {platform,url,icon}=req.body; await q('UPDATE social_links SET platform=?,url=?,icon=? WHERE id=?',[platform,url,icon||'◈',req.params.id]); res.json({ok:true}); });
app.delete('/api/social/:id', auth, requireAdmin, async (req,res) => { await q('DELETE FROM social_links WHERE id=?',[req.params.id]); res.json({ok:true}); });

app.get('/api/collabs',  async (req,res) => res.json(await q('SELECT * FROM collaborations ORDER BY sort_order ASC')));
app.post('/api/collabs', auth, requireAdmin, validar({name:{required:true,maxLen:100}}), async (req,res) => {
  const {name,image,url}=req.body; const id=uid();
  await q('INSERT INTO collaborations (id,name,image,url) VALUES (?,?,?,?)',[id,name,image||'',url||'#']); res.json({id});
});
app.put('/api/collabs/:id',    auth, requireAdmin, async (req,res) => { const {name,image,url}=req.body; await q('UPDATE collaborations SET name=?,image=?,url=? WHERE id=?',[name,image||'',url||'#',req.params.id]); res.json({ok:true}); });
app.delete('/api/collabs/:id', auth, requireAdmin, async (req,res) => { await q('DELETE FROM collaborations WHERE id=?',[req.params.id]); res.json({ok:true}); });

// ─────────────────────────────────────────────────────────────
// 17. 📺 TRANSMISIONES EN VIVO
// ─────────────────────────────────────────────────────────────
app.get('/api/streams', async (req,res) => {
  try {
    const {region}=req.query;
    const rows = region && region!=='ALL'
      ? await q("SELECT * FROM live_streams WHERE region=? OR region='ALL' ORDER BY is_live DESC,scheduled_at ASC",[region])
      : await q('SELECT * FROM live_streams ORDER BY is_live DESC,scheduled_at ASC');
    res.json(rows);
  } catch(e) { if (e.code==='ER_NO_SUCH_TABLE') return res.json([]); res.status(500).json({error:e.message}); }
});
app.post('/api/streams', auth, requireAdmin, validar({title:{required:true,maxLen:200},stream_id:{required:true}}), async (req,res) => {
  const {title,description,platform,stream_id,tournament_id,region,chat_enabled,scheduled_at}=req.body;
  const id=uid();
  await q('INSERT INTO live_streams (id,title,description,platform,stream_id,tournament_id,region,chat_enabled,scheduled_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id,title,description||'',platform||'youtube',stream_id,tournament_id||null,region||'ALL',chat_enabled!==false?1:0,scheduled_at||null,req.user.username]);
  await notifAll('stream','📺 Nueva transmisión programada',`${title} estará disponible pronto`,'/envivo');
  res.json({id});
});
app.put('/api/streams/:id', auth, requireAdmin, async (req,res) => {
  const {title,description,platform,stream_id,tournament_id,region,chat_enabled,scheduled_at,is_live,viewers}=req.body;
  await q('UPDATE live_streams SET title=?,description=?,platform=?,stream_id=?,tournament_id=?,region=?,chat_enabled=?,scheduled_at=?,is_live=?,viewers=? WHERE id=?',
    [title,description||'',platform,stream_id,tournament_id||null,region,chat_enabled?1:0,scheduled_at||null,is_live?1:0,Number(viewers)||0,req.params.id]);
  res.json({ok:true});
});
app.post('/api/streams/:id/toggle-live', auth, requireAdmin, async (req,res) => {
  const rows=await q('SELECT * FROM live_streams WHERE id=?',[req.params.id]);
  if (!rows.length) return res.status(404).json({error:'No encontrado'});
  const nowLive=rows[0].is_live?0:1;
  if (nowLive) {
    await q('UPDATE live_streams SET is_live=1,started_at=NOW(),ended_at=NULL WHERE id=?',[req.params.id]);
    await notifAll('stream','🔴 ¡EN VIVO AHORA!',`${rows[0].title} está transmitiendo en vivo. ¡Únete!`,'/envivo');
  } else {
    await q('UPDATE live_streams SET is_live=0,ended_at=NOW() WHERE id=?',[req.params.id]);
  }
  res.json({ok:true,is_live:nowLive});
});
app.delete('/api/streams/:id', auth, requireAdmin, async (req,res) => {
  await q('DELETE FROM live_streams WHERE id=?',[req.params.id]); res.json({ok:true});
});

// ─────────────────────────────────────────────────────────────
// 18. 🔔 NOTIFICACIONES
// ─────────────────────────────────────────────────────────────
app.get('/api/notifications', auth, requireAuth, async (req,res) => {
  try {
    const rows=await q('SELECT * FROM notifications WHERE username=? ORDER BY created_at DESC LIMIT 20',[req.user.username]);
    res.json({notifications:rows, unread:rows.filter(r=>!r.is_read).length});
  } catch { res.json({notifications:[],unread:0}); }
});
app.post('/api/notifications/read-all', auth, requireAuth, async (req,res) => {
  await q('UPDATE notifications SET is_read=1 WHERE username=?',[req.user.username]); res.json({ok:true});
});
app.delete('/api/notifications/:id', auth, requireAuth, async (req,res) => {
  await q('DELETE FROM notifications WHERE id=? AND username=?',[req.params.id,req.user.username]); res.json({ok:true});
});

// ─────────────────────────────────────────────────────────────
// 19. 👥 USUARIOS
// ─────────────────────────────────────────────────────────────
app.get('/api/users', auth, requireAdmin, async (req,res) => {
  const users2=await q('SELECT id,username,email,region,game_id,game_region,points,is_admin,region_mismatch,last_login,login_attempts,locked_until,created_at FROM users ORDER BY created_at DESC');
  const roles=await q('SELECT * FROM user_roles');
  const rmap=Object.fromEntries(roles.map(r=>[r.username,r.role]));
  res.json(users2.map(u=>({...u,role:rmap[u.username]||'user'})));
});
// Perfil público
app.get('/api/users/:username/public', async (req,res) => {
  const us=await q('SELECT username,region,points,game_id,game_region,created_at FROM users WHERE username=?',[req.params.username]);
  if (!us.length) return res.status(404).json({error:'No encontrado'});
  const u=us[0];
  const [torneos,pts_log,rank]=await Promise.all([
    q('SELECT t.title_es,t.region,t.status,t.winner_1,t.winner_2,t.winner_3,t.start_date FROM tournament_participants tp JOIN tournaments t ON tp.tournament_id=t.id WHERE tp.username=? ORDER BY t.start_date DESC',[req.params.username]),
    q('SELECT amount,reason,created_at FROM point_log WHERE username=? ORDER BY created_at DESC LIMIT 10',[req.params.username]),
    q('SELECT COUNT(*)+1 as rank FROM users WHERE points>? AND is_admin=0',[u.points]),
  ]);
  res.json({...u,torneos,pts_log,rank:rank[0].rank});
});
app.post('/api/users/:username/give-points', auth, requireAdmin, async (req,res) => {
  const {amount}=req.body;
  if (!amount||Number(amount)<=0) return res.status(400).json({error:'Cantidad inválida'});
  await q('UPDATE users SET points=points+? WHERE username=?',[Number(amount),req.params.username]);
  await q('INSERT INTO point_log (username,amount,reason) VALUES (?,?,?)',[req.params.username,Number(amount),'admin_manual']);
  await notif(req.params.username,'points',`⚡ +${amount} puntos`,`Un administrador te otorgó ${amount} puntos`,'/perfil');
  const rows=await q('SELECT * FROM users WHERE username=?',[req.params.username]);
  res.json({ok:true,points:rows[0]?.points});
});
app.post('/api/users/:username/toggle-mismatch', auth, requireAdmin, async (req,res) => {
  const rows=await q('SELECT region_mismatch FROM users WHERE username=?',[req.params.username]);
  if (!rows.length) return res.status(404).json({error:'No encontrado'});
  const v=rows[0].region_mismatch?0:1;
  await q('UPDATE users SET region_mismatch=? WHERE username=?',[v,req.params.username]);
  res.json({ok:true,region_mismatch:v});
});
app.put('/api/users/:username/game-id', auth, requireAdmin, async (req,res) => {
  const {game_id,game_region}=req.body;
  if (game_id && !GAME_ID_RE.test(String(game_id))) return res.status(400).json({error:'El ID de Free Fire solo debe tener números, entre 5 y 20 dígitos'});
  await q('UPDATE users SET game_id=?,game_region=? WHERE username=?',[game_id||'',game_region||'',req.params.username]);
  const u=(await q('SELECT * FROM users WHERE username=?',[req.params.username]))[0];
  if (!u) return res.status(404).json({error:'No encontrado'});
  const mm=game_region&&game_region!==u.region&&game_region!=='OTRO'&&u.region!=='OTRO'?1:0;
  await q('UPDATE users SET region_mismatch=? WHERE username=?',[mm,req.params.username]);
  res.json({ok:true});
});
app.put('/api/users/me/game-id', auth, requireAuth, async (req,res) => {
  const {game_id,game_region}=req.body;
  if (!game_id || !GAME_ID_RE.test(String(game_id))) return res.status(400).json({error:'El ID de Free Fire solo debe tener números, entre 5 y 20 dígitos'});
  const rows=await q('SELECT * FROM users WHERE username=?',[req.user.username]);
  if (!rows.length) return res.status(404).json({error:'No encontrado'});
  const u=rows[0];
  if (u.game_id&&u.game_id!=='') return res.status(403).json({error:'Tu ID ya está registrado. Contacta a un administrador.',locked:true});
  await q('UPDATE users SET game_id=?,game_region=? WHERE username=?',[game_id||'',game_region||'',req.user.username]);
  if (game_region&&game_region!==u.region&&game_region!=='OTRO'&&u.region!=='OTRO')
    await q('UPDATE users SET region_mismatch=1 WHERE username=?',[req.user.username]);
  const fresh=(await q('SELECT * FROM users WHERE username=?',[req.user.username]))[0];
  const {password:_,...safe}=fresh;
  res.json(safe);
});
app.put('/api/users/:username/role', auth, requireAdmin, async (req,res) => {
  const {role}=req.body;
  if (!['user','moderator'].includes(role)) return res.status(400).json({error:'Rol inválido. Usa: user o moderator'});
  await q('INSERT INTO user_roles (username,role,granted_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE role=?,granted_by=?',
          [req.params.username,role,req.user.username,role,req.user.username]);
  logger.info(`Rol: ${req.params.username} → ${role}`);
  res.json({ok:true});
});
app.post('/api/users/:username/unlock', auth, requireAdmin, async (req,res) => {
  await q('UPDATE users SET login_attempts=0,locked_until=NULL WHERE username=?',[req.params.username]);
  logger.info(`Cuenta desbloqueada: ${req.params.username}`);
  res.json({ok:true});
});

// ─────────────────────────────────────────────────────────────
// 20. 📊 ESTADÍSTICAS
// ─────────────────────────────────────────────────────────────
app.get('/api/stats', auth, requireAdmin, async (req,res) => {
  const [tu,nt,tr,tcu,top,act,reg,tst]=await Promise.all([
    q('SELECT COUNT(*) as n FROM users'),
    q("SELECT COUNT(*) as n FROM users WHERE DATE(created_at)=CURDATE()"),
    q('SELECT COUNT(*) as n FROM store_redemptions'),
    q('SELECT COUNT(*) as n FROM code_redemptions'),
    q('SELECT username,points,region FROM users WHERE is_admin=0 ORDER BY points DESC LIMIT 10'),
    q('SELECT username,amount,reason,created_at FROM point_log ORDER BY created_at DESC LIMIT 30'),
    q('SELECT region,COUNT(*) as total FROM users GROUP BY region'),
    q('SELECT t.title_es,COUNT(tp.username) as inscripciones FROM tournaments t LEFT JOIN tournament_participants tp ON t.id=tp.tournament_id GROUP BY t.id ORDER BY inscripciones DESC LIMIT 5'),
  ]);
  res.json({totalUsers:tu[0].n,newToday:nt[0].n,totalRedeems:tr[0].n,totalCodeUses:tcu[0].n,topUsers:top,recentActivity:act,regionStats:reg,tourStats:tst});
});

// ─────────────────────────────────────────────────────────────
// 21. 🌐 API PÚBLICA (sin auth, para integraciones externas)
// ─────────────────────────────────────────────────────────────
app.get('/api/public/leaderboard', async (req,res) => {
  const rows=await q('SELECT username,points,region FROM users WHERE is_admin=0 ORDER BY points DESC LIMIT 50');
  res.json({leaderboard:rows,updated:new Date().toISOString()});
});
app.get('/api/public/tournaments', async (req,res) => {
  const rows=await q('SELECT id,title_es,title_en,region,status,start_date,end_date,winner_1,winner_2,winner_3 FROM tournaments ORDER BY created_at DESC');
  res.json({tournaments:rows,updated:new Date().toISOString()});
});
app.get('/api/public/streams', async (req,res) => {
  try {
    const rows=await q('SELECT id,title,platform,region,is_live,scheduled_at,viewers FROM live_streams ORDER BY is_live DESC');
    res.json({streams:rows,updated:new Date().toISOString()});
  } catch { res.json({streams:[],updated:new Date().toISOString()}); }
});

// ─────────────────────────────────────────────────────────────
// 22. ARCHIVOS ESTÁTICOS — siempre DESPUÉS de las APIs
// ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('/', (req,res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));
app.use((err,req,res,next) => {
  logger.error(`${req.method} ${req.path}: ${err.message}`);
  if (req.path.startsWith('/api/')) return res.status(500).json({error:err.message||'Error interno'});
  next(err);
});

// ─────────────────────────────────────────────────────────────
// 23. 🚀 ARRANQUE
// ─────────────────────────────────────────────────────────────
async function iniciar() {
  await conectarDB();
  await hacerBackup();
  const bkHrs=Number(process.env.BACKUP_INTERVAL_HOURS)||24;
  setInterval(hacerBackup, bkHrs*60*60*1000);
  setInterval(async()=>{ try{await q('DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at<NOW()');}catch{} }, 60*60*1000);
  app.listen(PORT, () => {
    logger.info('═'.repeat(52));
    logger.info(`ZENKZONE 👾 v4  →  http://localhost:${PORT}`);
    logger.info(`Logs: ${logsDir}`);
    logger.info(`Backups automáticos cada ${bkHrs} horas`);
    logger.info('Seguridad: bcrypt + rate-limit + validación + roles');
    logger.info('═'.repeat(52));
  });
}
iniciar();
