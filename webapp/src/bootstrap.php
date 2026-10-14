<?php
/**
 * Bootstrap condiviso da API e script CLI: configurazione, database, utilità.
 * Sta FUORI da public_html.
 */
declare(strict_types=1);

date_default_timezone_set('UTC');   // tutte le date nel database sono UTC

define('APP_ROOT', dirname(__DIR__));

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
    }
    return $pdo;
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
