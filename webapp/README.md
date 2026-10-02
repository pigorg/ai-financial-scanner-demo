# AI Financial Scanner Demo – deploy su cPanel

## Struttura
- `public_html/` → radice documento del sito
  - `index.html`, `app.js`, `style.css`: frontend statico
  - `glossary.json`: definizioni dei campi (usate dall'icona ⓘ)
  - `data.json`: generato dal job (non modificare a mano)
  - `hist/`: storico per ticker usato dal grafico (generato dal job)
- `scripts/update_data.php`: job di aggiornamento per il **cron di cPanel** (PHP 7.4 o superiore, richiede curl e dom)
- `scripts/update_data.py`: stessa logica in Python, per PC / GitHub Actions (non serve sul server)

## Cron su cPanel (PHP)
Il job scarica i prezzi da Yahoo Finance, calcola i campi e riscrive `data.json` e `hist/`.
Dura circa 1 minuto. Cron Jobs → ogni giorno feriale alle 23:30 (dopo la chiusura USA):

    30 23 * * 1-5 /usr/bin/php /home/UTENTE/CARTELLA_SITO/webapp/scripts/update_data.php > /home/UTENTE/update.log 2>&1

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
