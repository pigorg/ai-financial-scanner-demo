<?php
declare(strict_types=1);

/** Messaggi dell'API in inglese (default) e italiano. La lingua arriva dall'header X-Lang (o ?lang=). */
final class I18n {
    public static string $lang = 'en';

    private static array $it = [
        'Session expired: reload the page and try again.' => 'Sessione scaduta: ricarica la pagina e riprova.',
        'You need to log in.' => 'Devi effettuare l\'accesso.',
        'Too many attempts. Please try again in a few minutes.' => 'Troppi tentativi. Riprova tra qualche minuto.',
        'The password must be at least 8 characters long.' => 'La password deve avere almeno 8 caratteri.',
        'The password can be at most 72 characters long.' => 'La password può avere al massimo 72 caratteri.',
        'The password must contain at least one letter and one number.' => 'La password deve contenere almeno una lettera e un numero.',
        'Confirm your email address' => 'Conferma il tuo indirizzo email',
        'Invalid request.' => 'Richiesta non valida.',
        'Invalid username: 3-30 characters, letters, numbers and underscore only.' => 'Username non valido: 3-30 caratteri tra lettere, numeri e underscore.',
        'Invalid email address.' => 'Indirizzo email non valido.',
        'Invalid currency.' => 'Valuta non valida.',
        'The budget must be between {min} and {max}.' => 'Il budget deve essere tra {min} e {max}.',
        'You must accept the terms and privacy policy and confirm you are at least 18 years old.' => 'Devi accettare termini e privacy e confermare di avere almeno 18 anni.',
        'An account with this email already exists.' => 'Esiste già un account con questa email.',
        'Username already taken.' => 'Username già in uso.',
        'Username or email already registered.' => 'Username o email già registrati.',
        'Account created. We sent you an email: click the link to activate it.' => 'Account creato. Ti abbiamo inviato un\'email: clicca sul link per attivarlo.',
        'Account created, but we could not send the confirmation email. Use "Didn\'t get the confirmation email?" on the log in page.' => 'Account creato, ma non siamo riusciti a inviare l\'email di conferma. Usa «Non hai ricevuto l\'email di conferma?» nella pagina di accesso.',
        'Invalid or expired link. Request a new confirmation email.' => 'Link non valido o scaduto. Richiedi una nuova email di conferma.',
        'Incorrect credentials.' => 'Credenziali non corrette.',
        'Account suspended. Contact us for information.' => 'Account sospeso. Contattaci per informazioni.',
        'Please confirm your email first: check your inbox (and spam) or request a new link.' => 'Devi prima confermare l\'email: controlla la posta (anche lo spam) o richiedi un nuovo link.',
        'Reset your password' => 'Recupero password',
        'Invalid or expired link. Request a new password reset.' => 'Link non valido o scaduto. Richiedi un nuovo recupero password.',
        'The current password is not correct.' => 'La password attuale non è corretta.',
        'Incorrect password.' => 'Password non corretta.',
        'Prices are not available at the moment.' => 'Prezzi non disponibili al momento.',
        'Prices are out of date: trading is paused until the next update.' => 'I prezzi non sono aggiornati: operatività sospesa fino al prossimo aggiornamento.',
        'EUR/USD exchange rate not available.' => 'Cambio EUR/USD non disponibile.',
        'Stock not available: {t}' => 'Titolo non disponibile: {t}',
        'Invalid operation.' => 'Operazione non valida.',
        'Invalid execution mode.' => 'Modalità di esecuzione non valida.',
        'Invalid quantity.' => 'Quantità non valida.',
        'Stop loss and take profit can be set on an immediate buy (or from the portfolio, after execution).' => 'Stop loss e take profit si impostano su un acquisto immediato (oppure dal portafoglio, dopo l\'esecuzione).',
        'You have too many queued orders (maximum {n}).' => 'Hai troppi ordini in coda (massimo {n}).',
        'Account not active.' => 'Account non attivo.',
        'Insufficient cash: you need {need} {ccy}, available {have}.' => 'Liquidità insufficiente: servono {need} {ccy}, disponibili {have}.',
        'You do not own enough shares of {t} (short selling is not allowed).' => 'Non possiedi abbastanza azioni di {t} (vendita allo scoperto non consentita).',
        'Order not found or already executed.' => 'Ordine non trovato o già eseguito.',
        'The stop loss must be greater than 0 and below the current price ({p}).' => 'Lo stop loss deve essere maggiore di 0 e inferiore al prezzo attuale ({p}).',
        'The take profit must be above the current price ({p}).' => 'Il take profit deve essere superiore al prezzo attuale ({p}).',
        'You have no open position on {t}.' => 'Non hai una posizione aperta su {t}.',
        'The commission must be between 0 and 100.' => 'La commissione deve essere tra 0 e 100.',
        'Email confirmed. You can now log in.' => 'Email confermata. Ora puoi accedere.',
        'If an unconfirmed account exists for this email, we have sent you a new link.' => 'Se esiste un account non ancora confermato con questa email, ti abbiamo inviato un nuovo link.',
        'Logged out.' => 'Uscito.',
        'If the address is registered, you will receive an email with instructions shortly.' => 'Se l\'indirizzo è registrato, riceverai a breve un\'email con le istruzioni.',
        'Password updated. You can now log in.' => 'Password aggiornata. Ora puoi accedere.',
        'Password updated.' => 'Password aggiornata.',
        'Account permanently deleted.' => 'Account eliminato definitivamente.',
        'Order executed.' => 'Ordine eseguito.',
        'Order queued: it will be executed at the next price update.' => 'Ordine messo in coda: verrà eseguito al prossimo aggiornamento dei prezzi.',
        'Levels saved.' => 'Livelli salvati.',
        'Order cancelled.' => 'Ordine annullato.',
        'Settings saved.' => 'Impostazioni salvate.',
        'Account reset.' => 'Conto azzerato.',
        'Action not found.' => 'Azione non trovata.',
        'Internal error. Please try again later.' => 'Errore interno. Riprova più tardi.',
        'Please enter your name or nickname (2-80 characters).' => 'Inserisci il tuo nome o soprannome (2-80 caratteri).',
        'Please write a message (10-3000 characters).' => 'Scrivi un messaggio (10-3000 caratteri).',
        'Please accept the privacy policy to send your message.' => 'Accetta l\'informativa privacy per inviare il messaggio.',
        'Thanks! Your message has been sent. I will reply as soon as I can.' => 'Grazie! Il messaggio è stato inviato. Ti risponderò appena possibile.',
        'We could not send your message right now. Please try again later or write to {email}.' => 'Non siamo riusciti a inviare il messaggio in questo momento. Riprova più tardi oppure scrivi a {email}.',
    ];

    public static function init(): void {
        $l = (string)($_SERVER['HTTP_X_LANG'] ?? ($_GET['lang'] ?? 'en'));
        self::$lang = $l === 'it' ? 'it' : 'en';
    }

    public static function t(string $en, array $p = []): string {
        $s = (self::$lang === 'it' && isset(self::$it[$en])) ? self::$it[$en] : $en;
        foreach ($p as $k => $v) $s = str_replace('{' . $k . '}', (string)$v, $s);
        return $s;
    }
}

function tr(string $en, array $p = []): string { return I18n::t($en, $p); }
