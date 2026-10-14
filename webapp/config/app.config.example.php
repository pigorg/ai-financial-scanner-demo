<?php
/**
 * Configurazione applicazione (database). Copia in app.config.php e compila.
 * app.config.php e' escluso da git e sta fuori da public_html.
 */
return [
    'db' => [
        'host'    => 'localhost',
        'name'    => 'NOME_DATABASE',      // su cPanel di solito  utente_nomedb
        'user'    => 'UTENTE_DATABASE',
        'pass'    => 'PASSWORD_DATABASE',
        'charset' => 'utf8mb4',
    ],

    // Versione dei termini accettati alla registrazione (cambiala quando modifichi i termini)
    'terms_version' => '2026-10',

    // Cookie di sessione: true se il sito e' servito in HTTPS (consigliato)
    'cookie_secure' => true,
];
