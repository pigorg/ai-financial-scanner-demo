<?php
/**
 * Amministrazione da terminale (SSH / cron di prova su cPanel).
 *   php admin.php list
 *   php admin.php suspend <username|email>      sospende l'account (non può più accedere)
 *   php admin.php unsuspend <username|email>
 *   php admin.php delete <username|email>       elimina definitivamente account e dati
 *   php admin.php verify <username|email>       segna l'email come confermata
 *   php admin.php stats
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }
require_once __DIR__ . '/../src/bootstrap.php';

[$self, $cmd, $who] = array_pad($argv, 3, null);
$find = function (string $who): array {
    $st = db()->prepare('SELECT * FROM users WHERE username = ? OR email = ?');
    $st->execute([$who, strtolower($who)]);
    $u = $st->fetch();
    if (!$u) { fwrite(STDERR, "Utente non trovato: $who\n"); exit(1); }
    return $u;
};

switch ($cmd) {
    case 'list':
        foreach (db()->query('SELECT id, username, email, status, email_verified_at, currency, created_at, last_login_at FROM users ORDER BY id')->fetchAll() as $u) {
            printf("%4d  %-20s %-32s %-9s %s %s  creato %s  ultimo accesso %s\n", $u['id'], $u['username'], $u['email'], $u['status'],
                $u['currency'], $u['email_verified_at'] ? 'verificato' : 'NON verificato', $u['created_at'], $u['last_login_at'] ?? '-');
        }
        break;
    case 'suspend': case 'unsuspend':
        $u = $find((string)$who);
        db()->prepare('UPDATE users SET status = ? WHERE id = ?')->execute([$cmd === 'suspend' ? 'suspended' : 'active', $u['id']]);
        echo "{$u['username']}: " . ($cmd === 'suspend' ? 'sospeso' : 'riattivato') . "\n";
        break;
    case 'delete':
        $u = $find((string)$who);
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$u['id']]);
        echo "{$u['username']}: eliminato con tutti i dati\n";
        break;
    case 'verify':
        $u = $find((string)$who);
        db()->prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?')->execute([now_utc(), $u['id']]);
        echo "{$u['username']}: email confermata\n";
        break;
    case 'stats':
        $q = fn(string $sql) => db()->query($sql)->fetchColumn();
        echo 'Utenti: ' . $q('SELECT COUNT(*) FROM users') . ' (verificati ' . $q('SELECT COUNT(*) FROM users WHERE email_verified_at IS NOT NULL') . ")\n";
        echo 'Ordini eseguiti: ' . $q("SELECT COUNT(*) FROM orders WHERE status='executed'") . ', in coda: ' . $q("SELECT COUNT(*) FROM orders WHERE status='pending'") . "\n";
        break;
    default:
        echo "Comandi: list | suspend <u> | unsuspend <u> | delete <u> | verify <u> | stats\n";
}
