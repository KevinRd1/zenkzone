-- ═══════════════════════════════════════════════════════════════
-- ZENKZONE — Tabla password_resets
-- Añadir a la base de datos si no existe
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS password_resets (
  id          INT           NOT NULL AUTO_INCREMENT,
  username    VARCHAR(50)   NOT NULL,
  token       VARCHAR(100)  NOT NULL UNIQUE,  -- Token interno (para cambiar contraseña)
  code        VARCHAR(6)    NOT NULL,          -- Código 6 dígitos (visible al usuario)
  used        TINYINT(1)    NOT NULL DEFAULT 0, -- 0=pendiente, 1=usado, 2=código verificado
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME      NOT NULL,

  PRIMARY KEY (id),
  INDEX idx_token   (token),
  INDEX idx_username(username),
  INDEX idx_code    (code)
);

-- Limpieza automática de resets expirados (ejecutar en cron o manualmente)
-- DELETE FROM password_resets WHERE expires_at < NOW();
