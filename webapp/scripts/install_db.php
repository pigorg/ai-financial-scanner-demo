<?php
/** Crea le tabelle eseguendo sql/schema.sql sul database di config/app.config.php. */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }
require_once __DIR__ . '/../src/bootstrap.php';

$sql = file_get_contents(APP_ROOT . '/sql/schema.sql');
$sql = preg_replace('/^\s*--.*$/m', '', $sql);
foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
    db()->exec($stmt);
}
echo "OK: tabelle create/verificate\n";
