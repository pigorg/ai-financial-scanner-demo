<?php
/**
 * Da eseguire DOPO update_data.php (cron): esegue gli ordini in coda al nuovo prezzo,
 * registra il valore del portafoglio di ogni utente e ripulisce token/tentativi scaduti.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }
require_once __DIR__ . '/../src/bootstrap.php';
require_once __DIR__ . '/../src/Auth.php';
require_once __DIR__ . '/../src/Trading.php';

try {
    [$done, $rejected, $expired] = Trading::processPending();
    [$stops, $takes] = Trading::checkTriggers();
    $n = Trading::recordEquityAll();
    db()->prepare('DELETE FROM auth_tokens WHERE expires_at < ? OR used_at IS NOT NULL')->execute([gmdate('Y-m-d H:i:s', time() - 86400)]);
    db()->prepare('DELETE FROM rate_events WHERE created_at < ?')->execute([gmdate('Y-m-d H:i:s', time() - 86400)]);
    // account mai confermati dopo 7 giorni: eliminati
    $del = db()->prepare('DELETE FROM users WHERE email_verified_at IS NULL AND created_at < ?');
    $del->execute([gmdate('Y-m-d H:i:s', time() - 7 * 86400)]);
    echo "OK: ordini eseguiti $done, rifiutati $rejected, scaduti $expired, stop loss $stops, take profit $takes, equity registrata per $n utenti, account non confermati eliminati " . $del->rowCount() . PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, 'ERRORE: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
