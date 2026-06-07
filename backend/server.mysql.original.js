// ╔══════════════════════════════════════════════════════════════╗
// ║         ZENKZONE — server.js  v4.0  COMPLETO               ║
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
const mysql     = require('mysql2/promise');
const bcrypt    = require('bcryptjs');
const crypto    = require('crypto');
const path      = require('path');
const fs        = require('fs');
const rateLimit = require('express-rate-limit');
const nodemailer= require('nodemailer');
const winston   = require('winston');

const app  = express();
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
const DB_CONFIG = {
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'zenkzone',
  waitForConnections: true,
  connectionLimit:    10,
  charset:            'utf8mb4',
};
const ADMIN_CREDS = [
  { username: process.env.ADMIN_USER_1 || 'Kev1nRd', password: process.env.ADMIN_PASS_1 || 'STRIMER34113' },
  { username: process.env.ADMIN_USER_2 || 'LOVE69',  password: process.env.ADMIN_PASS_2 || 'STRIMER34113' },
];
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

// ─────────────────────────────────────────────────────────────
// 4. BASE DE DATOS
// ─────────────────────────────────────────────────────────────
let pool;
async function q(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

async function conectarDB() {
  try {
    pool = mysql.createPool(DB_CONFIG);
    const conn = await pool.getConnection();
    logger.info('MySQL conectado — BD: ' + DB_CONFIG.database);
    conn.release();
    await autoMigrate();
  } catch (err) {
    logger.error('ERROR MySQL: ' + err.message);
    logger.error('→ Verifica que XAMPP esté corriendo y el schema.sql ejecutado');
    process.exit(1);
  }
}

async function autoMigrate() {
  const tablas = [
    `CREATE TABLE IF NOT EXISTS live_streams (
      id VARCHAR(30) NOT NULL,title VARCHAR(200) NOT NULL,
      description TEXT DEFAULT '',platform VARCHAR(20) NOT NULL DEFAULT 'youtube',
      stream_id VARCHAR(200) NOT NULL,tournament_id VARCHAR(30) DEFAULT NULL,
      region VARCHAR(10) NOT NULL DEFAULT 'ALL',is_live TINYINT(1) NOT NULL DEFAULT 0,
      chat_enabled TINYINT(1) NOT NULL DEFAULT 1,scheduled_at DATETIME DEFAULT NULL,
      started_at DATETIME DEFAULT NULL,ended_at DATETIME DEFAULT NULL,
      viewers INT NOT NULL DEFAULT 0,created_by VARCHAR(50) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),INDEX idx_sl (is_live),INDEX idx_sr (region)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INT NOT NULL AUTO_INCREMENT,username VARCHAR(50) NOT NULL,
      type VARCHAR(30) NOT NULL,title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,link VARCHAR(200) DEFAULT '',
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),INDEX idx_nu (username),INDEX idx_nr (is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS password_resets (
      id INT NOT NULL AUTO_INCREMENT,username VARCHAR(50) NOT NULL,
      token VARCHAR(100) NOT NULL,expires_at DATETIME NOT NULL,
      used TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),INDEX idx_prt (token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS user_roles (
      username VARCHAR(50) NOT NULL,role VARCHAR(20) NOT NULL DEFAULT 'user',
      granted_by VARCHAR(50) DEFAULT NULL,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ];
  const columnas = [
    'ALTER TABLE sessions ADD COLUMN expires_at DATETIME DEFAULT NULL',
    'ALTER TABLE sessions ADD INDEX idx_se (expires_at)',
    'ALTER TABLE users ADD COLUMN last_login DATETIME DEFAULT NULL',
    'ALTER TABLE users ADD COLUMN login_attempts INT NOT NULL DEFAULT 0',
    'ALTER TABLE users ADD COLUMN locked_until DATETIME DEFAULT NULL',
  ];
  for (const sql of tablas)  { try { await pool.execute(sql); } catch {} }
  for (const sql of columnas){ try { await pool.execute(sql); } catch {} }
  logger.info('Migraciones OK');
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
  if (!process.env.MAIL_USER || process.env.MAIL_USER === 'tucorreo@gmail.com') {
    logger.warn('Correo no configurado — edita MAIL_USER y MAIL_PASS en .env');
    return false;
  }
  try {
    const t = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.MAIL_PORT) || 587,
      secure: false,
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });
    await t.sendMail({ from: process.env.MAIL_FROM || 'ZENKZONE <noreply@zenkzone.com>', to, subject, html });
    logger.info(`Correo enviado → ${to}`);
    return true;
  } catch (e) { logger.error('Error correo: ' + e.message); return false; }
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
  validar({ username:{required:true,minLen:3,maxLen:50,pattern:/^[a-zA-Z0-9_]+$/}, email:{required:true,isEmail:true,maxLen:150}, password:{required:true,minLen:6,maxLen:100} }),
  async (req,res) => {
    const { username, email, password, region } = req.body;
    if (ADMIN_CREDS.some(a=>a.username===username)) return res.status(400).json({error:'Usuario no disponible'});
    try {
      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await q('INSERT INTO users (username,email,password,region) VALUES (?,?,?,?)',[username,email,hash,region||'OTRO']);
      const us = await q('SELECT * FROM users WHERE username=?',[username]);
      const token = crypto.randomBytes(32).toString('hex');
      await q('INSERT INTO sessions (token,username,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 7 DAY))',[token,username]);
      await q('INSERT IGNORE INTO user_roles (username,role) VALUES (?,?)',[username,'user']);
      logger.info(`Registro: ${username} (${region})`);
      const {password:_,...safe} = us[0];
      res.json({ token, user: safe });
    } catch(e) {
      if (e.code==='ER_DUP_ENTRY') return res.status(400).json({error:'Usuario o email ya registrado'});
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
app.post('/api/auth/forgot-password',
  validar({ email:{required:true,isEmail:true} }),
  async (req,res) => {
    const { email } = req.body;
    const users = await q('SELECT * FROM users WHERE email=?',[email]);
    if (!users.length) return res.json({ok:true,msg:'Si el correo existe, recibirás instrucciones.'});
    const user  = users[0];
    const token = crypto.randomBytes(32).toString('hex');
    await q('INSERT INTO password_resets (username,token,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR))',[user.username,token]);
    const link = `http://localhost:${PORT}/?reset=${token}`;
    await enviarCorreo(email,'Restablecer contraseña — ZENKZONE 👾',`
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#040810;color:#e0e8ff;padding:32px;border-radius:12px;">
        <h2 style="color:#00FF88;font-family:sans-serif;">ZENKZONE 👾</h2>
        <p>Hola <strong>${user.username}</strong>,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#00FF88,#00D4FF);color:#040810;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">RESTABLECER CONTRASEÑA</a>
        <p style="color:#6a7a9b;font-size:13px;">Este enlace expira en 1 hora.<br>Si no solicitaste esto, ignora este correo.</p>
      </div>
    `);
    logger.info(`Reset solicitado: ${user.username}`);
    res.json({ok:true,msg:'Si el correo existe, recibirás instrucciones.'});
  }
);

// Restablecer contraseña con token
app.post('/api/auth/reset-password',
  validar({ token:{required:true}, password:{required:true,minLen:6,maxLen:100} }),
  async (req,res) => {
    const { token, password } = req.body;
    const rows = await q('SELECT * FROM password_resets WHERE token=? AND used=0 AND expires_at>NOW()',[token]);
    if (!rows.length) return res.status(400).json({error:'Enlace inválido o expirado'});
    const reset = rows[0];
    const hash  = await bcrypt.hash(password, BCRYPT_ROUNDS);
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
    if (e.code==='ER_DUP_ENTRY') return res.status(400).json({error:'Ya estás inscrito'});
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
    if (e.code==='ER_DUP_ENTRY') return res.status(400).json({error:'Código ya existe'});
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
    if (e.code==='ER_DUP_ENTRY') return res.status(400).json({error:'Ya canjeaste este código'});
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
  await q('UPDATE users SET game_id=?,game_region=? WHERE username=?',[game_id||'',game_region||'',req.params.username]);
  const u=(await q('SELECT * FROM users WHERE username=?',[req.params.username]))[0];
  if (!u) return res.status(404).json({error:'No encontrado'});
  const mm=game_region&&game_region!==u.region&&game_region!=='OTRO'&&u.region!=='OTRO'?1:0;
  await q('UPDATE users SET region_mismatch=? WHERE username=?',[mm,req.params.username]);
  res.json({ok:true});
});
app.put('/api/users/me/game-id', auth, requireAuth, async (req,res) => {
  const {game_id,game_region}=req.body;
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
app.use(express.static(path.join(__dirname)));
app.get('/', (req,res) => res.sendFile(path.join(__dirname,'index.html')));
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
