<?php
/**
 * Configurazione email (SMTP) per verifica account e recupero password.
 *
 * COME USARLO
 *  1. Copia questo file in  mail.config.php  (stessa cartella).
 *  2. Compila i valori con i dati della casella creata su cPanel
 *     (cPanel > Account di posta > Connetti dispositivi / "Configurazione manuale").
 *  3. mail.config.php NON va committato: e' gia' escluso da .gitignore.
 *  4. Questa cartella sta FUORI da public_html, quindi non e' raggiungibile dal browser.
 */
return [
    // --- Server SMTP (su cPanel di solito mail.tuodominio.it o il nome del server) ---
    'host'       => 'mail.alessandrognola.com',
    'port'       => 465,          // 465 = SSL/TLS implicito, 587 = STARTTLS
    'encryption' => 'ssl',        // 'ssl' per la porta 465, 'tls' per la 587
    'username'   => 'noreply@alessandrognola.com',   // indirizzo email completo
    'password'   => 'CAMBIA_QUESTA_PASSWORD',

    // --- Mittente mostrato all'utente ---
    'from_email' => 'noreply@alessandrognola.com',
    'from_name'  => 'AI Financial Scanner Demo',
    'reply_to'   => 'informazioni@alessandrognola.com',
    // Dove arrivano i messaggi del form Contatti (se omesso, usa reply_to)
    'contact_to' => 'informazioni@alessandrognola.com',

    // --- Sito e link nelle email ---
    'site_name'  => 'AI Financial Scanner Demo',
    'site_url'   => 'https://ai-financial-scanner-demo.alessandrognola.com',

    // --- Recupero password ---
    'reset_token_ttl_minutes' => 60,   // validita' del link di reset

    // --- Template (cartella webapp/templates/email) ---
    'templates_dir' => __DIR__ . '/../templates/email',

    // Debug: true scrive il dialogo SMTP nel log. Solo in fase di test.
    'debug'      => false,
];
