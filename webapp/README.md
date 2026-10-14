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
Aggiornamento orario nei giorni feriali + chiusura (ora del server = ora di Roma; adatta se il server è in UTC):

    0 9-22 * * 1-5 PHP /home/UTENTE/CARTELLA_SITO/webapp/scripts/update_data.php --snapshot=mid   && PHP /home/UTENTE/CARTELLA_SITO/webapp/scripts/post_update.php > /home/UTENTE/update_mid.log 2>&1
    30 23  * * 1-5 PHP /home/UTENTE/CARTELLA_SITO/webapp/scripts/update_data.php --snapshot=close && PHP /home/UTENTE/CARTELLA_SITO/webapp/scripts/post_update.php > /home/UTENTE/update_close.log 2>&1

(`PHP` = percorso di php, vedi sotto.) `mid` aggiorna solo `prices.json` (pochi secondi); `close` ricalcola anche lo scanner (~1-2 minuti).
`post_update.php` esegue gli ordini in coda, registra il valore dei portafogli e ripulisce token/account non confermati.

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
