<?php
/**
 * Bootstrap condiviso da API e script CLI: configurazione, database, utilità.
 * Sta FUORI da public_html.
 */
declare(strict_types=1);

date_default_timezone_set('UTC');   // tutte le date nel database sono UTC
if (PHP_SAPI !== 'cli') { ini_set('display_errors', '0'); ini_set('log_errors', '1'); }   // mai mostrare errori ai visitatori

define('APP_ROOT', dirname(__DIR__));
require_once __DIR__ . '/I18n.php';

function app_config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $file = APP_ROOT . '/config/app.config.php';
        if (!is_file($file)) {
            throw new RuntimeException('Manca webapp/config/app.config.php (copia app.config.example.php).');
        }
        $cfg = require $file;
    }
    return $cfg;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $c = app_config()['db'];
        $port = isset($c['port']) ? ";port=" . (int)$c['port'] : '';
        $dsn = "mysql:host={$c['host']}{$port};dbname={$c['name']};charset={$c['charset']}";
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec("SET time_zone = '+00:00'");
        migrate_schema($pdo);
    }
    return $pdo;
}

/** Aggiorna le tabelle create con versioni precedenti dello schema (utile senza accesso al terminale). */
function migrate_schema(PDO $pdo): void {
    $cols = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'positions'")->fetchAll(PDO::FETCH_COLUMN);
    if ($cols && !in_array('stop_loss', $cols, true)) {
        $pdo->exec('ALTER TABLE positions ADD COLUMN stop_loss DECIMAL(18,4) NULL, ADD COLUMN take_profit DECIMAL(18,4) NULL');
    }
    $uc = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'")->fetchAll(PDO::FETCH_COLUMN);
    if ($uc && !in_array('pw_changed_at', $uc, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN pw_changed_at DATETIME(6) NULL');
    }
    $oc = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'")->fetchAll(PDO::FETCH_COLUMN);
    if ($oc && !in_array('limit_price', $oc, true)) {
        $pdo->exec("ALTER TABLE orders
            ADD COLUMN limit_price DECIMAL(18,4) NULL AFTER status,
            ADD COLUMN valid_until DATETIME NULL AFTER limit_price,
            MODIFY mode ENUM('now','next','limit') NOT NULL DEFAULT 'now',
            MODIFY status ENUM('executed','pending','cancelled','rejected','expired') NOT NULL");
    }
}

function now_utc(): string { return gmdate('Y-m-d H:i:s'); }

function client_ip(): string {
    return substr((string)($_SERVER['REMOTE_ADDR'] ?? 'cli'), 0, 45);
}

/** Eccezione con messaggio mostrabile all'utente e codice HTTP. */
class ApiError extends RuntimeException {
    public int $status;
    public function __construct(string $message, int $status = 400) {
        parent::__construct($message);
        $this->status = $status;
    }
}

function round_money(float $x): float { return round($x, 4); }
