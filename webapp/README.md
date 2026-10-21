# AI Financial Scanner Demo – deploy su cPanel

## Struttura
- `public_html/` → radice documento del sito
  - `index.html`, `app.js`, `style.css`: frontend statico
  - `glossary.json`: definizioni dei campi (usate dall'icona ⓘ)
  - `data.json`: generato dal job (non modificare a mano)
  - `hist/`: storico per ticker usato dal grafico (generato dal job)
- `scripts/update_data.php`: job di aggiornamento per il **cron di cPanel** (PHP 7.4 o superiore, richiede curl e dom)
- `scripts/update_data.py`: stessa logica in Python, per PC / GitHub Actions (non serve sul server)

## Paper trading (login, area riservata, ordini virtuali)
Struttura aggiuntiva (tutto FUORI da `public_html`, tranne le pagine pubbliche):
- `public_html/api.php` + `public_html/account/` → API JSON e area riservata (SPA con hash routing)
- `public_html/termini.html`, `privacy.html`, `consent.js` → termini, informativa privacy/cookie, consenso analytics
- `public_html/prices.json` → prezzi per il trading (generato dal cron, S&P 500 + FTSE MIB + cambio EUR/USD)
- `src/` → codice PHP (Auth, Trading, Mailer, PHPMailer in `src/vendor`)
- `config/` → file segreti (non in git): `app.config.php` (database), `mail.config.php` (SMTP)
- `sql/schema.sql` → tabelle MySQL; `templates/email/` → email di conferma e recupero password
- `scripts/` → `install_db.php`, `post_update.php`, `admin.php`, `tickers_it.txt` (FTSE MIB)

### Installazione (una volta)
1. cPanel → MySQL Database: crea database e utente con tutti i privilegi.
2. Copia `config/app.config.example.php` in `config/app.config.php` e inserisci i dati del database.
3. Copia `config/mail.config.php` (SMTP) sul server in `webapp/config/` (non è in git).
4. Crea le tabelle: `php webapp/scripts/install_db.php` (oppure incolla `sql/schema.sql` in phpMyAdmin).
5. Primo aggiornamento prezzi: `php webapp/scripts/update_data.php --snapshot=close && php webapp/scripts/post_update.php`
6. (facoltativo) Google Analytics: imposta `GA_ID` in `public_html/consent.js`. Vuoto = analytics mai caricati.
7. Compila l'indirizzo del titolare in `termini.html` e `privacy.html` (cerca `INDIRIZZO DEL TITOLARE`).

### Amministrazione
`php webapp/scripts/admin.php list | stats | suspend <utente> | unsuspend <utente> | delete <utente> | verify <utente>`

## Cron su cPanel (PHP)
Quattro aggiornamenti nei giorni feriali: **9:00, 12:00, 16:00, 21:00** (ora del server = ora di Roma; adatta se il server è in UTC). Ogni giro aggiorna tutto: prezzi del paper trading e scanner.

    0 9,12,16,21 * * 1-5  PHP /home/UTENTE/CARTELLA_SITO/webapp/scripts/update_data.php --snapshot=mid --scanner && PHP /home/UTENTE/CARTELLA_SITO/webapp/scripts/post_update.php > /home/UTENTE/update.log 2>&1

(`PHP` = percorso di php, vedi sotto.) Dura circa 2 minuti: `prices.json` (paper trading) e poi `data.json` + `hist/` (scanner). Durante la seduta USA (15:30-22:00 ora di Roma) l'ultima barra giornaliera è quella in corso, quindi il prezzo è l'ultima quotazione disponibile.
`post_update.php` esegue gli ordini in coda, scatta stop loss / take profit, registra il valore dei portafogli e ripulisce token/account non confermati.

### Cron originale (solo scanner)
Il job scarica i prezzi da Yahoo Finance, calcola i campi e riscrive `data.json` e `hist/`.
Dura circa 1 minuto. Cron Jobs → ogni giorno feriale alle 23:30 (dopo la chiusura USA):

    30 23 * * 1-5 /opt/cpanel/ea-php83/root/usr/bin/php /home/UTENTE/CARTELLA_SITO/webapp/scripts/update_data.php > /home/UTENTE/update.log 2>&1

- Il percorso di `php` può variare (`/usr/bin/php`, `/opt/cpanel/ea-php82/root/usr/bin/php`, `/opt/alt/php82/usr/bin/php`):
  per sceglierne uno con PHP 8, verifica le versioni disponibili con un cron di prova `ls -d /usr/bin/php* /opt/cpanel/ea-php*/root/usr/bin/php /opt/alt/php*/usr/bin/php`.
- Tieni il file di log **fuori** dalla radice documento.
- I bilanci (P/E, EPS, ricavi) sono riletti al massimo ogni 7 giorni e salvati in `scripts/fund_cache.json`.

## Alternative
- **PC / GitHub Actions:** `python webapp/scripts/update_data.py`, poi carica `data.json` e `hist/` sul sito
  (workflow pronto in `.github/workflows/update-scanner-data.yml`).

## Modificare i campi
Le colonne vanno aggiornate in tre punti: il calcolo (`compute_row` in Python, `compute_row` in PHP),
`COLS`/`VIEWS` in `app.js` e la definizione in `glossary.json` (usata dall'icona ⓘ).

## Struttura del sito e lingue
- `/` → landing page bilingue (`index.html`, `landing.css`); `/scanner/` → scanner; `/account/` → app di paper trading.
- Lingua di partenza: **inglese**. Italiano con il selettore EN/IT (o `?lang=it`); la scelta resta nel browser (`aifs_lang`).
- `i18n.js` gestisce la lingua; le traduzioni italiane stanno vicino ai testi: `account/account.js` (dizionario `I18N.add`), pagine statiche (oggetto passato a `I18N.applyStatic`), `src/I18n.php` (messaggi API ed email), `glossary.it.json`.
- Email: i template in `templates/email/` sono in inglese, le versioni italiane hanno suffisso `.it` (es. `verify_email.it.html`). La lingua arriva dall'header `X-Lang` inviato dall'app.
- Testi legali: inglese `terms.html`, `privacy.html`; italiano `termini.html`, `informativa-privacy.html`.
- Per aggiungere un testo: scrivilo in inglese nel codice e aggiungi la traduzione italiana nel relativo dizionario.

## Pagina Contatti
- `/contact/` (bilingue): form con nome/soprannome, email, messaggio e spunta privacy. L'API `contact` (`api.php`) invia un'email a `contact_to` (in `config/mail.config.php`, altrimenti `reply_to`) con Reply-To sul mittente. Nessun messaggio viene salvato nel database.
- Limiti anti-spam: 5 messaggi/ora per IP, 3/ora per email, campo trappola nascosto.
- Banner cookie: `consent.js` lo mostra solo se `GA_ID` è valorizzato.

## Ordini: tipi, scadenza, esportazione
- Tipi: **a mercato** (subito), **al prossimo aggiornamento** e **a limite** (prezzo massimo per l'acquisto, minimo per la vendita; se il limite è già soddisfatto si esegue subito).
- Gli ordini in attesa valgono **un giorno di borsa**: scadono alle 22:00 (Roma) del giorno in cui possono essere valutati (se inseriti dopo l'ultimo aggiornamento delle 21:00 o nel weekend, del giorno feriale successivo). Poi risultano **non eseguiti** (stato `expired`). Costanti in `src/Trading.php` (`LAST_UPDATE_HOUR`, `SESSION_END_HOUR`).
- `post_update.php` valuta gli ordini a limite a ogni giro del cron e fa scadere quelli oltre il termine.
- Esportazione dalla pagina Orders: CSV (`;` in italiano, `,` in inglese), Excel `.xlsx` e XML, tramite `api.php?action=export_orders&format=csv|xlsx|xml` (`src/Export.php`, nessuna estensione PHP richiesta).
- Le tabelle si aggiornano da sole (colonne `limit_price`, `valid_until`, stato `expired`).

## Sicurezza (riepilogo)
- Password con hash bcrypt, minimo 8 caratteri con lettere e numeri, elenco di password troppo comuni rifiutate.
- Sessioni: cookie `Secure` + `HttpOnly` + `SameSite=Lax`, modalità strict, rigenerazione dell'ID al login, scadenza dopo 12 ore di inattività (7 giorni al massimo). Cambiando o reimpostando la password le altre sessioni aperte vengono chiuse (`users.pw_changed_at`).
- CSRF su tutte le richieste che modificano dati; limiti ai tentativi (login, registrazione, recupero password, contatti); token monouso salvati solo come hash.
- Query solo con parametri (PDO), output della pagina sempre escapato, errori PHP mai mostrati ai visitatori.
- Libreria dei grafici caricata con Subresource Integrity (`integrity="sha384-..."`): se cambi versione, ricalcola l'hash.
- Header di sicurezza da aggiungere nel `.htaccess` del sito (il file è gestito da cPanel e non è nel repository):

      <IfModule mod_headers.c>
      Header always set Strict-Transport-Security "max-age=31536000"
      Header always set X-Content-Type-Options "nosniff"
      Header always set X-Frame-Options "SAMEORIGIN"
      Header always set Referrer-Policy "strict-origin-when-cross-origin"
      Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
      </IfModule>
