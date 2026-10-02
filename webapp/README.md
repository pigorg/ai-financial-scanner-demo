# RS Scanner – deploy su cPanel

## Struttura
- `public_html/` → da caricare nella root del sito (o in una sottocartella)
  - `index.html`, `app.js`, `style.css`: frontend statico
  - `glossary.json`: definizioni dei campi (usate dall'icona ⓘ)
  - `data.json`: generato dal job (non modificare a mano)
  - `hist/`: storico per ticker usato dal grafico (generato dal job)
- `scripts/update_data.py`: job che scarica i prezzi e scrive `public_html/data.json`

## Installazione
1. Carica `public_html/*` sul sito e `scripts/` **fuori** dalla cartella pubblica (es. `~/scanner/scripts`).
2. cPanel → **Setup Python App** (o SSH): crea un virtualenv e `pip install -r scripts/requirements.txt`.
3. Controlla in `update_data.py` il percorso `OUT`: deve puntare a `public_html/data.json` del sito
   (modificalo se le cartelle sul server hanno posizioni diverse).
4. cPanel → **Cron Jobs**, ogni giorno feriale alle 23:30 (dopo la chiusura USA):
   `30 23 * * 1-5 /home/UTENTE/virtualenv/scanner/3.x/bin/python /home/UTENTE/scanner/scripts/update_data.py`

## Se l'hosting non regge Python/pandas
Esegui `update_data.py` altrove (PC, GitHub Actions) e carica `data.json` e la cartella `hist/` via FTP/SFTP: il sito non cambia.

## Modificare i campi
Aggiungi/togli la colonna in `compute_row` (Python), in `COLS` (app.js) e la definizione in `glossary.json` (usata dall'icona ⓘ).
