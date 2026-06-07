-- ═══════════════════════════════════════════════════════════════
-- ZENKZONE — schema_postgresql.sql
-- Base de datos: PostgreSQL
-- Ejecutar en pgAdmin Query Tool o psql conectado a la BD zenkzone
-- ═══════════════════════════════════════════════════════════════

-- IMPORTANTE:
-- En pgAdmin primero crea la BD manualmente:
--   CREATE DATABASE zenkzone;
-- Luego abre esa base y ejecuta este script completo.

-- Limpieza opcional para volver a crear desde cero.
-- Descomenta estas líneas SOLO si quieres borrar todo:
-- DROP TABLE IF EXISTS password_resets, notifications, live_streams, user_roles,
--   code_redemptions, promo_codes, store_redemptions, store_items,
--   tournament_participants, tournaments, news, social_links,
--   collaborations, point_log, sessions, users CASCADE;

-- ─────────────────────────────────────────────────────────────
-- TABLA: users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(50)  NOT NULL,
  email           VARCHAR(150) NOT NULL,
  password        VARCHAR(255) NOT NULL,
  region          VARCHAR(10)  NOT NULL DEFAULT 'OTRO',
  game_id         VARCHAR(50)  DEFAULT '' CHECK (game_id = '' OR game_id ~ '^[0-9]{5,20}$'),
  game_region     VARCHAR(10)  DEFAULT '',
  points          INTEGER      NOT NULL DEFAULT 0,
  is_admin        SMALLINT     NOT NULL DEFAULT 0,
  region_mismatch SMALLINT     NOT NULL DEFAULT 0,
  last_login      TIMESTAMP    DEFAULT NULL,
  login_attempts  INTEGER      NOT NULL DEFAULT 0,
  locked_until    TIMESTAMP    DEFAULT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_username UNIQUE (username),
  CONSTRAINT uq_email UNIQUE (email)
);

-- Evita que dos usuarios registren el mismo ID de Free Fire.
-- Permite registros antiguos con game_id vacío.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_game_id_nonempty
ON users(game_id)
WHERE game_id IS NOT NULL AND game_id <> ''; 

-- ─────────────────────────────────────────────────────────────
-- TABLA: sessions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  token      VARCHAR(100) NOT NULL PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL,
  is_admin   SMALLINT     NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP    DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_sess_user ON sessions(username);
CREATE INDEX IF NOT EXISTS idx_sess_exp  ON sessions(expires_at);

-- ─────────────────────────────────────────────────────────────
-- TABLA: news
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news (
  id         VARCHAR(30)  NOT NULL PRIMARY KEY,
  title_es   VARCHAR(200) NOT NULL,
  title_en   VARCHAR(200) NOT NULL DEFAULT '',
  content_es TEXT         NOT NULL,
  content_en TEXT,
  image      TEXT,
  region     VARCHAR(10)  NOT NULL DEFAULT 'ALL',
  pub_date   DATE         NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_news_region ON news(region);
CREATE INDEX IF NOT EXISTS idx_news_date   ON news(pub_date);

-- ─────────────────────────────────────────────────────────────
-- TABLA: tournaments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournaments (
  id         VARCHAR(30)  NOT NULL PRIMARY KEY,
  title_es   VARCHAR(200) NOT NULL,
  title_en   VARCHAR(200) NOT NULL DEFAULT '',
  desc_es    TEXT         NOT NULL,
  desc_en    TEXT,
  region     VARCHAR(10)  NOT NULL DEFAULT 'LATAM',
  status     VARCHAR(20)  NOT NULL DEFAULT 'upcoming',
  start_date DATE         NOT NULL,
  end_date   DATE         NOT NULL,
  prize_1st  INTEGER      NOT NULL DEFAULT 700,
  prize_2nd  INTEGER      NOT NULL DEFAULT 550,
  prize_3rd  INTEGER      NOT NULL DEFAULT 350,
  prize_part INTEGER      NOT NULL DEFAULT 10,
  finalized  SMALLINT     NOT NULL DEFAULT 0,
  winner_1   VARCHAR(50)  DEFAULT '',
  winner_2   VARCHAR(50)  DEFAULT '',
  winner_3   VARCHAR(50)  DEFAULT '',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tour_region ON tournaments(region);
CREATE INDEX IF NOT EXISTS idx_tour_status ON tournaments(status);

-- ─────────────────────────────────────────────────────────────
-- TABLA: tournament_participants
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournament_participants (
  id            SERIAL PRIMARY KEY,
  tournament_id VARCHAR(30) NOT NULL,
  username      VARCHAR(50) NOT NULL,
  joined_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tp UNIQUE (tournament_id, username)
);
CREATE INDEX IF NOT EXISTS idx_tp_tour ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tp_user ON tournament_participants(username);

-- ─────────────────────────────────────────────────────────────
-- TABLA: store_items
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_items (
  id         VARCHAR(30)  NOT NULL PRIMARY KEY,
  name_es    VARCHAR(200) NOT NULL,
  name_en    VARCHAR(200) NOT NULL DEFAULT '',
  desc_es    TEXT         NOT NULL,
  desc_en    TEXT,
  image      TEXT,
  points     INTEGER      NOT NULL DEFAULT 100,
  stock      INTEGER      NOT NULL DEFAULT 0,
  region     VARCHAR(10)  NOT NULL DEFAULT 'ALL',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_store_region ON store_items(region);

-- ─────────────────────────────────────────────────────────────
-- TABLA: store_redemptions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_redemptions (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL,
  item_id     VARCHAR(30)  NOT NULL,
  item_name   VARCHAR(200) NOT NULL,
  points_used INTEGER      NOT NULL,
  game_id     VARCHAR(50)  DEFAULT '',
  game_region VARCHAR(10)  DEFAULT '',
  redeemed_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sr_user ON store_redemptions(username);
CREATE INDEX IF NOT EXISTS idx_sr_item ON store_redemptions(item_id);

-- ─────────────────────────────────────────────────────────────
-- TABLA: promo_codes
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id         VARCHAR(30) NOT NULL PRIMARY KEY,
  code       VARCHAR(50) NOT NULL,
  points     INTEGER     NOT NULL DEFAULT 100,
  max_uses   INTEGER     NOT NULL DEFAULT 50,
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_code UNIQUE (code)
);
CREATE INDEX IF NOT EXISTS idx_code_code ON promo_codes(code);

-- ─────────────────────────────────────────────────────────────
-- TABLA: code_redemptions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS code_redemptions (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(50) NOT NULL,
  username       VARCHAR(50) NOT NULL,
  points_awarded INTEGER     NOT NULL,
  redeemed_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_cr UNIQUE (code, username)
);
CREATE INDEX IF NOT EXISTS idx_cr_code ON code_redemptions(code);
CREATE INDEX IF NOT EXISTS idx_cr_user ON code_redemptions(username);

-- ─────────────────────────────────────────────────────────────
-- TABLA: social_links
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_links (
  id         VARCHAR(30) NOT NULL PRIMARY KEY,
  platform   VARCHAR(60) NOT NULL,
  url        TEXT        NOT NULL,
  icon       VARCHAR(10) DEFAULT '◈',
  sort_order INTEGER     NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: collaborations
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collaborations (
  id         VARCHAR(30)  NOT NULL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  image      TEXT,
  url        TEXT,
  sort_order INTEGER      NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────────────────────
-- TABLA: point_log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS point_log (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL,
  amount     INTEGER      NOT NULL,
  reason     VARCHAR(100) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pl_user ON point_log(username);

-- ─────────────────────────────────────────────────────────────
-- TABLA: live_streams
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_streams (
  id            VARCHAR(30)  NOT NULL PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  description   TEXT         DEFAULT '',
  platform      VARCHAR(20)  NOT NULL DEFAULT 'youtube',
  stream_id     VARCHAR(200) NOT NULL,
  tournament_id VARCHAR(30)  DEFAULT NULL,
  region        VARCHAR(10)  NOT NULL DEFAULT 'ALL',
  is_live       SMALLINT     NOT NULL DEFAULT 0,
  chat_enabled  SMALLINT     NOT NULL DEFAULT 1,
  scheduled_at  TIMESTAMP    DEFAULT NULL,
  started_at    TIMESTAMP    DEFAULT NULL,
  ended_at      TIMESTAMP    DEFAULT NULL,
  viewers       INTEGER      NOT NULL DEFAULT 0,
  created_by    VARCHAR(50)  DEFAULT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sl ON live_streams(is_live);
CREATE INDEX IF NOT EXISTS idx_sr ON live_streams(region);

-- ─────────────────────────────────────────────────────────────
-- TABLA: notifications
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL,
  type       VARCHAR(30)  NOT NULL,
  title      VARCHAR(200) NOT NULL,
  message    TEXT         NOT NULL,
  link       VARCHAR(200) DEFAULT '',
  is_read    SMALLINT     NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_nu ON notifications(username);
CREATE INDEX IF NOT EXISTS idx_nr ON notifications(is_read);

-- ─────────────────────────────────────────────────────────────
-- TABLA: password_resets
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL,
  token      VARCHAR(100) NOT NULL,
  expires_at TIMESTAMP    NOT NULL,
  used       SMALLINT     NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_prt ON password_resets(token);

-- ─────────────────────────────────────────────────────────────
-- TABLA: user_roles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  username   VARCHAR(50) NOT NULL PRIMARY KEY,
  role       VARCHAR(20) NOT NULL DEFAULT 'user',
  granted_by VARCHAR(50) DEFAULT NULL,
  granted_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════
-- DATOS INICIALES
-- ═══════════════════════════════════════════════════════════════

INSERT INTO social_links (id, platform, url, icon, sort_order) VALUES
  ('sc1','YouTube',   'https://youtube.com/@zenkzone',  '▶', 1),
  ('sc2','Instagram', 'https://instagram.com/zenkzone', '◈', 2),
  ('sc3','TikTok',    'https://tiktok.com/@zenkzone',   '♪', 3),
  ('sc4','Discord',   'https://discord.gg/zenkzone',    '◉', 4),
  ('sc5','Twitter/X', 'https://twitter.com/zenkzone',   '✕', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO collaborations (id, name, image, url, sort_order) VALUES
  ('c1','ProGamer_X','https://placehold.co/110x110/001a0d/00FF88?text=PGX','#',1),
  ('c2','FF_Legend', 'https://placehold.co/110x110/001433/00D4FF?text=FFL','#',2),
  ('c3','SniperKing','https://placehold.co/110x110/150015/FF00AA?text=SKG','#',3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO news (id,title_es,title_en,content_es,content_en,image,region,pub_date) VALUES
  ('n1','🔥 Nueva Temporada Free Fire — LATAM 2026','🔥 New Free Fire Season — LATAM 2026',
   'La temporada más esperada llega a LATAM con nuevos personajes y mapas exclusivos.',
   'The most awaited season arrives in LATAM with new characters and exclusive maps.',
   'https://placehold.co/780x320/002211/00FF88?text=FREE+FIRE+LATAM+SEASON+2026','LATAM','2026-04-12'),
  ('n2','🏆 Evento Doble XP — Región EEUU','🏆 Double XP Event — USA Region',
   'Durante el fin de semana, jugadores EEUU ganarán el doble de experiencia en todas las partidas.',
   'All weekend, USA players earn double XP in every match.',
   'https://placehold.co/780x320/001833/00D4FF?text=DOUBLE+XP+USA+EVENT','EEUU','2026-04-10'),
  ('n3','🎮 Nuevo Modo Ranked — Global','🎮 New Ranked Mode — Global',
   'Free Fire lanza un nuevo sistema de ranked con rangos renovados y recompensas exclusivas.',
   'Free Fire launches a new ranked system with refreshed tiers and exclusive rewards.',
   'https://placehold.co/780x320/150020/CC00FF?text=NEW+RANKED+MODE','ALL','2026-04-08')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tournaments (id,title_es,title_en,desc_es,desc_en,region,start_date,end_date) VALUES
  ('t1','Torneo Primavera ZENKZONE 2026','ZENKZONE Spring Tournament 2026',
   'El torneo inaugural de ZENKZONE. Compite y demuestra que eres el mejor de LATAM.',
   'ZENKZONE inaugural tournament. Compete and prove you are the best in LATAM.',
   'LATAM','2026-04-25','2026-05-05'),
  ('t2','Copa EEUU — Free Fire Open','USA Cup — Free Fire Open',
   'El torneo más grande de la región EEUU. Inscríbete y pelea por los premios.',
   'The biggest tournament in the USA region. Register and fight for the prizes.',
   'EEUU','2026-04-28','2026-05-08')
ON CONFLICT (id) DO NOTHING;

INSERT INTO store_items (id,name_es,name_en,desc_es,desc_en,image,points,stock,region) VALUES
  ('s1','Skin Élite ZENKZONE','ZENKZONE Elite Skin',
   'Skin exclusiva de personaje para campeones de ZENKZONE.',
   'Exclusive character skin for ZENKZONE champions.',
   'https://placehold.co/380x230/001a0d/00FF88?text=ELITE+SKIN',500,10,'ALL'),
  ('s2','100 Diamantes','100 Diamonds',
   'Recarga de 100 diamantes Free Fire para tu cuenta.',
   '100 Free Fire diamonds recharge for your account.',
   'https://placehold.co/380x230/001433/00CFFF?text=100+DIAMONDS',300,25,'ALL'),
  ('s3','Lootbox Legendaria','Legendary Lootbox',
   'Caja con contenido legendario garantizado. Solo para campeones.',
   'Box with guaranteed legendary content.',
   'https://placehold.co/380x230/150015/FF00AA?text=LEGENDARY+BOX',750,5,'ALL'),
  ('s4','Parche de Nombre Exclusivo','Exclusive Name Tag',
   'Parche con diseño exclusivo ZENKZONE.',
   'Name tag with exclusive ZENKZONE design.',
   'https://placehold.co/380x230/1a1000/FFAA00?text=NAME+TAG',150,50,'ALL')
ON CONFLICT (id) DO NOTHING;
