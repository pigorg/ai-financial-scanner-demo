-- AI Financial Scanner Demo - schema paper trading (MySQL 5.7+ / MariaDB 10.3+)
-- Eseguire una volta da phpMyAdmin (scheda SQL) oppure:  php webapp/scripts/install_db.php

CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username        VARCHAR(30)  NOT NULL,
  email           VARCHAR(190) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  email_verified_at DATETIME NULL,
  status          ENUM('active','suspended') NOT NULL DEFAULT 'active',
  currency        CHAR(3) NOT NULL DEFAULT 'EUR',
  initial_budget  DECIMAL(14,2) NOT NULL DEFAULT 10000.00,
  cash            DECIMAL(18,4) NOT NULL DEFAULT 10000.0000,
  commission_it   DECIMAL(8,2) NOT NULL DEFAULT 2.00,
  commission_us   DECIMAL(8,2) NOT NULL DEFAULT 8.00,
  terms_version   VARCHAR(20) NOT NULL,
  terms_accepted_at DATETIME NOT NULL,
  created_at      DATETIME NOT NULL,
  last_login_at   DATETIME NULL,
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Token monouso per verifica email e reset password (si salva solo l'hash)
CREATE TABLE IF NOT EXISTS auth_tokens (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  type        ENUM('verify','reset') NOT NULL,
  token_hash  CHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  created_at  DATETIME NOT NULL,
  UNIQUE KEY uq_token_hash (token_hash),
  KEY idx_tokens_user (user_id, type),
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Limite ai tentativi (login, registrazione, recupero password)
CREATE TABLE IF NOT EXISTS rate_events (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind       VARCHAR(20) NOT NULL,
  ident      VARCHAR(190) NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_rate (kind, ident, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS positions (
  user_id   INT UNSIGNED NOT NULL,
  ticker    VARCHAR(20) NOT NULL,
  qty       INT UNSIGNED NOT NULL,
  avg_cost  DECIMAL(18,4) NOT NULL COMMENT 'costo medio per azione, in valuta del conto',
  stop_loss   DECIMAL(18,4) NULL COMMENT 'livello di prezzo (valuta del titolo): se il prezzo scende fino a qui, vende tutto',
  take_profit DECIMAL(18,4) NULL COMMENT 'livello di prezzo (valuta del titolo): se il prezzo sale fino a qui, vende tutto',
  PRIMARY KEY (user_id, ticker),
  CONSTRAINT fk_pos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  ticker        VARCHAR(20) NOT NULL,
  market        CHAR(2) NOT NULL,
  side          ENUM('buy','sell') NOT NULL,
  qty           INT UNSIGNED NOT NULL,
  mode          ENUM('now','next','limit') NOT NULL DEFAULT 'now',
  status        ENUM('executed','pending','cancelled','rejected','expired') NOT NULL,
  limit_price   DECIMAL(18,4) NULL COMMENT 'prezzo limite (valuta del titolo) per gli ordini a limite',
  valid_until   DATETIME NULL COMMENT 'scadenza (UTC) degli ordini in attesa: fine della giornata di borsa',
  snapshot      VARCHAR(8) NULL COMMENT 'mid | close: aggiornamento di prezzo usato',
  price         DECIMAL(18,4) NULL COMMENT 'prezzo nella valuta del titolo',
  price_ccy     CHAR(3) NULL,
  fx_rate       DECIMAL(14,6) NULL COMMENT 'cambio titolo -> valuta del conto',
  gross         DECIMAL(18,4) NULL COMMENT 'controvalore in valuta del conto',
  commission    DECIMAL(10,2) NULL,
  realized_pl   DECIMAL(18,4) NULL,
  note          VARCHAR(190) NULL,
  created_at    DATETIME NOT NULL,
  executed_at   DATETIME NULL,
  KEY idx_orders_user (user_id, id),
  KEY idx_orders_pending (status, mode),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equity_history (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id   INT UNSIGNED NOT NULL,
  ts        DATETIME NOT NULL,
  equity    DECIMAL(18,4) NOT NULL,
  cash      DECIMAL(18,4) NOT NULL,
  KEY idx_equity_user (user_id, ts),
  CONSTRAINT fk_eq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
