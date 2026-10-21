'use strict';
/* Paper trading app: login, sign up, portfolio, orders, charts, settings. English by default, Italian on request. */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const T = (en, p) => I18N.t(en, p);
const IT = I18N.lang === 'it';
const LOC = IT ? 'it-IT' : 'en-GB';
const PRIVATE = ['portfolio', 'trade', 'orders', 'charts', 'settings'];
const PUBLIC = ['login', 'register', 'forgot', 'reset', 'verify', 'resend'];

I18N.add({
  // generic
  'Service unreachable. Please try again shortly.': 'Servizio non raggiungibile. Riprova tra poco.',
  'Error': 'Errore', 'Loading…': 'Caricamento…',
  'latest intraday update': 'ultimo aggiornamento intraday', 'market close': 'chiusura',
  'Prices are not available at the moment.': 'Prezzi non disponibili al momento.',
  'Prices: {snap} · updated {when} (your local time). Demo service: prices may be wrong or out of date.': 'Prezzi: {snap} · aggiornati il {when}. Servizio demo: i prezzi possono essere errati o non aggiornati.',
  // auth
  'Log in': 'Accedi', 'Access your paper trading account.': 'Entra nella tua area di paper trading.',
  'Username or email': 'Username o email', 'Password': 'Password', 'LOG IN': 'ACCEDI',
  'Forgot your password?': 'Password dimenticata?', 'Create an account': 'Crea un account',
  "Didn't get the confirmation email?": "Non hai ricevuto l'email di conferma?",
  'Create your account': 'Crea il tuo account',
  'Free, with <strong>virtual</strong> money. You only need a username, an email and a password.': 'Gratis, con denaro <strong>virtuale</strong>. Servono solo username, email e password.',
  'Username': 'Username', '3-30 characters: letters, numbers, underscore.': '3-30 caratteri: lettere, numeri, underscore.',
  'Email': 'Email', 'We will send you a link to confirm it. One account per email.': 'Riceverai un link per confermarla. Un solo account per email.',
  'At least 8 characters, with letters and numbers.': 'Almeno 8 caratteri, con lettere e numeri.',
  'Account currency': 'Valuta del conto', 'Euro (€)': 'Euro (€)', 'US dollar ($)': 'Dollaro USA ($)',
  'Virtual budget': 'Budget virtuale', 'Website': 'Sito web',
  'I have read and accept the {terms} and the {privacy}. I understand this is paper trading with virtual money, with no prizes, and that the service is a demo that can be suspended or deleted at any time.':
    "Ho letto e accetto i {terms} e l'{privacy}. So che si tratta di paper trading con denaro virtuale, senza premi, e che il servizio è una demo che può essere sospesa o eliminata in qualsiasi momento.",
  'Terms & Conditions': 'Termini e condizioni', 'Privacy Policy': 'informativa privacy',
  'I confirm that I am at least 18 years old.': 'Dichiaro di avere almeno 18 anni.',
  'CREATE ACCOUNT': 'CREA ACCOUNT', 'Already have an account? Log in': 'Hai già un account? Accedi',
  'Reset your password': 'Recupera password',
  'Enter your account email and we will send you a link to choose a new password.': "Inserisci l'email dell'account: ti invieremo un link per sceglierne una nuova.",
  'SEND LINK': 'INVIA LINK', '← Back to log in': "← Torna all'accesso",
  'Resend confirmation email': 'Reinvia email di conferma',
  'If your account is not confirmed yet, you will get a new link. Check your spam folder too.': "Se l'account non è ancora confermato, riceverai un nuovo link. Controlla anche lo spam.",
  'RESEND': 'REINVIA',
  'New password': 'Nuova password', 'Repeat the password': 'Ripeti la password', 'SAVE PASSWORD': 'SALVA PASSWORD',
  'The two passwords do not match.': 'Le due password non coincidono.', 'Go to log in': "Vai all'accesso",
  'Confirm email': 'Conferma email', 'Verifying…': 'Verifica in corso…', 'Request a new link': 'Richiedi un nuovo link',
  // portfolio
  'Portfolio': 'Portafoglio', 'Euro': 'Euro', 'US dollar': 'Dollaro USA',
  '{ccy} account · starting budget {budget}': 'Conto in {ccy} · budget iniziale {budget}',
  'TOTAL VALUE': 'VALORE TOTALE', 'CASH': 'LIQUIDITÀ', 'INVESTED': 'INVESTITO', 'TOTAL P/L': 'P/L TOTALE',
  'OPEN POSITIONS': 'POSIZIONI APERTE', 'Ticker': 'Ticker', 'Company': 'Società', 'Qty': 'Qtà', 'Avg cost': 'Costo medio',
  'Price': 'Prezzo', 'Value': 'Valore', 'P/L': 'P/L', 'Weight': 'Peso', 'Stop loss': 'Stop loss', 'Take profit': 'Take profit',
  'SELL': 'VENDI', 'BUY': 'COMPRA', 'Set stop loss and take profit': 'Imposta stop loss e take profit',
  'You have no open positions yet. Go to {trade} to buy your first stock with virtual money.': 'Non hai ancora posizioni aperte. Vai su {trade} per acquistare la tua prima azione con il denaro virtuale.',
  'TRADE': 'OPERA',
  "P/L includes the effect of the EUR/USD exchange rate for stocks priced in a currency different from your account. Commissions are simulated. Stop loss and take profit are price levels in the stock's currency: when reached, the whole position is sold at the first price update (up to 4 times a day) and the sale price can differ from the level.":
    'Il P/L include l\'effetto del cambio EUR/USD per i titoli in valuta diversa dal conto. Le commissioni sono simulate. Stop loss e take profit sono livelli di prezzo nella valuta del titolo: se raggiunti, la posizione viene venduta per intero al primo aggiornamento dei prezzi (fino a 4 volte al giorno) e il prezzo di vendita può differire dal livello.',
  // levels dialog
  'Price not available for this stock: please try again later.': 'Prezzo non disponibile per questo titolo: riprova più tardi.',
  'Stop loss / Take profit · {t}': 'Stop loss / Take profit · {t}', 'Close': 'Chiudi',
  'Current price: <b>{price} {ccy}</b> · position: {qty} shares.<br>If the price falls to your <b>stop loss</b> or rises to your <b>take profit</b>, the whole position is sold at the first price update (up to 4 times a day). The sale price can differ from the level you set. Leave a field empty to not use it.':
    'Prezzo attuale: <b>{price} {ccy}</b> · posizione: {qty} azioni.<br>Se il prezzo scende fino allo <b>stop loss</b> o sale fino al <b>take profit</b>, l\'intera posizione viene venduta al primo aggiornamento dei prezzi (fino a 4 volte al giorno). Il prezzo di vendita può differire dal livello impostato. Lascia vuoto per non usarlo.',
  'Stop loss ({ccy}) · below the current price': 'Stop loss ({ccy}) · sotto il prezzo attuale',
  'Take profit ({ccy}) · above the current price': 'Take profit ({ccy}) · sopra il prezzo attuale',
  'SAVE': 'SALVA', '{pct}% vs current price': '{pct}% rispetto al prezzo attuale',
  // trade
  'Trade': 'Opera', 'Prices are not available at the moment. Please try again later.': 'Prezzi non disponibili al momento. Riprova più tardi.',
  'Available cash: {cash} · virtual money': 'Liquidità disponibile: {cash} · denaro virtuale',
  'Search a stock (ticker or company)': 'Cerca titolo (ticker o società)', 'e.g. AAPL, Enel, ISP.MI': 'es. AAPL, Enel, ISP.MI',
  'Quantity (shares)': 'Quantità (azioni)',
  'Stop loss (price, optional)': 'Stop loss (prezzo, facoltativo)', 'Take profit (price, optional)': 'Take profit (prezzo, facoltativo)',
  'e.g. 95': 'es. 95', 'e.g. 120': 'es. 120',
  'Only with an immediate buy. If the price reaches them, the whole position is sold at the first price update (up to 4 times a day) and the price can differ from the level. You can also set them later from the portfolio.':
    'Solo con acquisto immediato. Se il prezzo li raggiunge, l\'intera posizione viene venduta al primo aggiornamento dei prezzi (fino a 4 volte al giorno) e il prezzo può differire dal livello. Puoi impostarli anche dopo, dal portafoglio.',
  '<strong>Now</strong> at the price of the {snap} ({when})': '<strong>Subito</strong> al prezzo di {snap} ({when})',
  '<strong>At the next price update</strong> (weekdays at 9:00, 12:00, 16:00 and 21:00, Rome time). The price is not known in advance; you can cancel the order while it is queued.':
    '<strong>Al prossimo aggiornamento</strong> dei prezzi (giorni feriali: alle 9:00, 12:00, 16:00 e 21:00, ora di Roma). Prezzo non noto in anticipo; l\'ordine può essere annullato finché è in coda.',
  'Select a stock.': 'Seleziona un titolo.',
  'SIMULATED COMMISSIONS': 'COMMISSIONI SIMULATE',
  'Italian stocks: {it} per order<br>US stocks: {us} per order<br>You can change them in {settings}.': 'Azioni italiane: {it} per ordine<br>Azioni USA: {us} per ordine<br>Modificabili in {settings}.',
  'Settings': 'Impostazioni', 'RULES': 'REGOLE',
  'You can only buy with the cash available and sell shares you own (no short selling, no leverage). Whole shares only. Orders are simulated: nothing is executed on real markets.':
    'Solo acquisti con la liquidità disponibile e vendite di azioni possedute (niente vendite allo scoperto, niente leva). Quantità intere. Gli ordini sono simulati: nessuna esecuzione sui mercati reali.',
  'Borsa Italiana': 'Borsa Italiana', 'USA': 'USA', 'in portfolio: {n}': 'in portafoglio: {n}',
  'Exchange rate not available.': 'Cambio non disponibile.',
  'Order value: {gross}{rate}<br>Commission: {comm}<br>Buy total: {buy} · Net sale proceeds: {sell}': 'Controvalore: {gross}{rate}<br>Commissione: {comm}<br>Acquisto: {buy} · Vendita netta: {sell}',
  '(rate {fx})': '(cambio {fx})', 'No results': 'Nessun risultato',
  'Stop loss and take profit can be set on an immediate buy. For a position you already hold, use the SL/TP button in the portfolio.':
    'Stop loss e take profit si impostano su un acquisto immediato. Per una posizione già aperta usa il pulsante SL/TP nel portafoglio.',
  'Buy': 'Comprare', 'Sell': 'Vendere', 'now': 'subito', 'at the next price update': 'al prossimo aggiornamento',
  '{side} {qty} {t} ({mode})? Simulated order, virtual money.': '{side} {qty} {t} ({mode})? Operazione simulata, denaro virtuale.',
  // orders
  'EXECUTED': 'ESEGUITO', 'QUEUED': 'IN CODA', 'CANCELLED': 'ANNULLATO', 'REJECTED': 'RIFIUTATO',
  'Order history': 'Cronologia ordini',
  'Latest {n} orders. Amounts in your account currency ({ccy}).': 'Ultimi {n} ordini. Importi nella valuta del conto ({ccy}).',
  'Date': 'Data', 'Side': 'Operazione', 'Order value': 'Controvalore', 'Commission': 'Commissione', 'Realised P/L': 'P/L realizzato',
  'Price from': 'Prezzo di', 'Status': 'Stato', 'CANCEL': 'ANNULLA', 'No orders yet.': 'Nessun ordine ancora.',
  // charts
  'Charts': 'Grafici', 'Portfolio value over time (cash + stocks), at each price update.': 'Andamento del valore del portafoglio (liquidità + titoli) negli aggiornamenti dei prezzi.',
  'ALLOCATION': 'ALLOCAZIONE', 'P/L BY POSITION': 'P/L PER POSIZIONE', 'Cash': 'Liquidità',
  'No open positions.': 'Nessuna posizione aperta.', 'Chart not available.': 'Grafico non disponibile.',
  // settings
  '{user} · {email} · joined {when}': '{user} · {email} · registrato il {when}',
  'SIMULATED COMMISSIONS (per order, in {ccy})': 'COMMISSIONI SIMULATE (per ordine, in {ccy})',
  'Italian stocks': 'Azioni italiane', 'US stocks': 'Azioni USA',
  'CHANGE PASSWORD': 'CAMBIA PASSWORD', 'Current password': 'Password attuale', 'UPDATE': 'AGGIORNA',
  'RESET YOUR ACCOUNT': 'AZZERA IL CONTO',
  'Deletes orders, positions and history and starts again with a new virtual budget (also in another currency).': "Cancella ordini, posizioni e storico e riparte con un nuovo budget virtuale (anche in un'altra valuta).",
  'Currency': 'Valuta', 'Budget': 'Budget', 'Password to confirm': 'Password per confermare', 'RESET ACCOUNT': 'AZZERA CONTO',
  'DELETE ACCOUNT': 'ELIMINA ACCOUNT',
  "Permanently deletes your account and all linked data (orders, positions, history, email). This cannot be undone.": "Elimina in modo definitivo il tuo account e tutti i dati collegati (ordini, posizioni, storico, email). L'operazione non è reversibile.",
  'DELETE PERMANENTLY': 'ELIMINA DEFINITIVAMENTE', 'LOG OUT': 'ESCI',
  'Reset your account? Orders, positions and history will be deleted.': 'Azzerare il conto? Ordini, posizioni e storico verranno cancellati.',
  'Permanently delete your account and all your data? This cannot be undone.': 'Eliminare DEFINITIVAMENTE il tuo account e tutti i dati? Non si può annullare.',
  'Account deleted': 'Account eliminato', 'Your account and all linked data have been deleted.': 'Il tuo account e tutti i dati collegati sono stati eliminati.',
  'Create a new account': 'Crea un nuovo account',
  // limit orders, expiry, export
  'NOT EXECUTED': 'NON ESEGUITO', 'Expired at the end of the trading day.': 'Scaduto a fine giornata di borsa.',
  'Valid until {when}': 'Valido fino al {when}', 'Type': 'Tipo', 'Market': 'A mercato', 'Next update': 'Al prossimo aggiornamento',
  'Limit {price}': 'Limite {price}', 'Export orders': 'Esporta ordini',
  '<strong>Limit price</strong>: runs only if the price reaches your limit (buy at or below it, sell at or above it). Valid for one trading day: if it is not executed by the end of the day it shows as "not executed".':
    '<strong>Prezzo limite</strong>: si esegue solo se il prezzo raggiunge il tuo limite (acquisto a quel prezzo o meno, vendita a quel prezzo o più). Vale un giorno di borsa: se non viene eseguito entro fine giornata risulta «non eseguito».',
  'Limit price ({ccy})': 'Prezzo limite ({ccy})', 'e.g. 150': 'es. 150', 'Enter a limit price.': 'Inserisci un prezzo limite.',
  'with a limit of {p}': 'con limite {p}',
  // chrome
  'VIRTUAL MONEY': 'DENARO VIRTUALE'
});

// ------------------------------------------------------------------ helpers
const money = (v, ccy) => new Intl.NumberFormat(LOC, {style: 'currency', currency: ccy || user?.currency || 'EUR'}).format(v ?? 0);
const num = (v, d = 2) => new Intl.NumberFormat(LOC, {minimumFractionDigits: d, maximumFractionDigits: d}).format(v ?? 0);
const sgn = v => (v > 0 ? '+' : '') + num(v);
const cls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
const utc = s => new Date(String(s).replace(' ', 'T') + (String(s).includes('T') ? '' : 'Z'));
const when = s => s ? utc(s).toLocaleString(LOC, {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—';
const snapLabel = s => s === 'mid' ? T('latest intraday update') : s === 'close' ? T('market close') : esc(s);

let csrf = '', user = null, prices = null, eqChart = null;

async function api(action, body) {
  const opt = {credentials: 'same-origin', headers: {'X-Lang': I18N.lang}};
  if (body !== undefined) {
    opt.method = 'POST';
    opt.headers['Content-Type'] = 'application/json';
    opt.headers['X-CSRF-Token'] = csrf;
    opt.body = JSON.stringify(body);
  }
  let r, j;
  try {
    r = await fetch('/api.php?action=' + action, opt);
    j = await r.json();
  } catch (e) {
    throw new Error(T('Service unreachable. Please try again shortly.'));
  }
  if (j.csrf) csrf = j.csrf;
  if (!j.ok) { const err = new Error(j.error || T('Error')); err.code = r.status; throw err; }
  return j;
}

async function loadPrices() {
  try {
    const r = await fetch('/prices.json?' + Math.floor(Date.now() / 60000), {cache: 'no-store'});
    prices = r.ok ? await r.json() : null;
  } catch (e) { prices = null; }
  return prices;
}

function fxRate(from, to) {
  if (from === to) return 1;
  const e = prices?.fx?.EURUSD;
  if (!e) return null;
  return from === 'EUR' ? e : 1 / e;
}

const msg = (type, text) => text ? `<div class="msg ${type}" role="${type === 'err' ? 'alert' : 'status'}">${esc(text)}</div>` : '';
const setView = html => { $('#view').innerHTML = html; };
const go = r => { location.hash = '#/' + r; };
const loading = () => `<p class="muted">${T('Loading…')}</p>`;

function pricesInfo() {
  if (!prices) return `<p class="note">${T('Prices are not available at the moment.')}</p>`;
  return `<p class="note">${T('Prices: {snap} · updated {when} (your local time). Demo service: prices may be wrong or out of date.', {snap: snapLabel(prices.snapshot), when: when(prices.updated)})}</p>`;
}

/** Wires a form: disables the button while sending, shows errors/success in .fmsg. */
function bind(id, handler) {
  const f = $(id);
  if (!f) return;
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = f.querySelector('button[type=submit]');
    const box = f.querySelector('.fmsg') || f.parentElement.querySelector('.fmsg');
    if (btn) btn.disabled = true;
    if (box) box.innerHTML = '';
    try { await handler(Object.fromEntries(new FormData(f)), f, box); }
    catch (err) { if (box) box.innerHTML = msg('err', err.message); else alert(err.message); }
    finally { if (btn) btn.disabled = false; }
  });
}

// ------------------------------------------------------------------ public views
function viewLogin(info) {
  setView(`<div class="authbox"><h2>${T('Log in')}</h2>
    <p class="muted">${T('Access your paper trading account.')}</p>
    ${msg('ok', info)}
    <form id="f-login"><div class="fmsg"></div>
      <label class="fld">${T('Username or email')}<input name="login" autocomplete="username" required></label>
      <label class="fld">${T('Password')}<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="primary" type="submit">${T('LOG IN')}</button>
    </form>
    <div class="links"><a href="#/forgot">${T('Forgot your password?')}</a><a href="#/register">${T('Create an account')}</a></div>
    <div class="links"><a href="#/resend">${T("Didn't get the confirmation email?")}</a></div></div>`);
  bind('#f-login', async (d, f, box) => {
    try {
      const r = await api('login', d);
      user = r.user;
      go('portfolio');
    } catch (e) { box.innerHTML = msg('err', e.message); }
  });
}

function viewRegister() {
  const terms = `<a href="${I18N.legal('terms')}" target="_blank" rel="noopener">${T('Terms & Conditions')}</a>`;
  const privacy = `<a href="${I18N.legal('privacy')}" target="_blank" rel="noopener">${T('Privacy Policy')}</a>`;
  setView(`<div class="authbox"><h2>${T('Create your account')}</h2>
    <p class="muted">${T('Free, with <strong>virtual</strong> money. You only need a username, an email and a password.')}</p>
    <form id="f-reg"><div class="fmsg"></div>
      <label class="fld">${T('Username')}<input name="username" autocomplete="username" pattern="[A-Za-z0-9_]{3,30}" required><small>${T('3-30 characters: letters, numbers, underscore.')}</small></label>
      <label class="fld">${T('Email')}<input name="email" type="email" autocomplete="email" required><small>${T('We will send you a link to confirm it. One account per email.')}</small></label>
      <label class="fld">${T('Password')}<input name="password" type="password" autocomplete="new-password" minlength="8" required><small>${T('At least 8 characters, with letters and numbers.')}</small></label>
      <div class="fld row2">
        <div>${T('Account currency')}<select name="currency"><option value="EUR">${T('Euro (€)')}</option><option value="USD">${T('US dollar ($)')}</option></select></div>
        <div>${T('Virtual budget')}<select name="budget" id="r-budget"></select></div>
      </div>
      <div class="hp" aria-hidden="true"><label>${T('Website')}<input name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="checks">
        <label><input type="checkbox" name="accept_terms" value="1" required><span>${T('I have read and accept the {terms} and the {privacy}. I understand this is paper trading with virtual money, with no prizes, and that the service is a demo that can be suspended or deleted at any time.', {terms, privacy})}</span></label>
        <label><input type="checkbox" name="accept_age" value="1" required><span>${T('I confirm that I am at least 18 years old.')}</span></label>
      </div>
      <button class="primary" type="submit">${T('CREATE ACCOUNT')}</button>
    </form>
    <div class="links"><a href="#/login">${T('Already have an account? Log in')}</a></div></div>`);
  const sel = $('#r-budget');
  for (let v = 10000; v <= 100000; v += 10000) sel.insertAdjacentHTML('beforeend', `<option value="${v}">${num(v, 0)}</option>`);
  bind('#f-reg', async (d, f, box) => {
    d.accept_terms = f.accept_terms.checked; d.accept_age = f.accept_age.checked;
    const r = await api('register', d);
    f.reset();
    box.innerHTML = msg('ok', r.message);
  });
}

function viewForgot() {
  setView(`<div class="authbox"><h2>${T('Reset your password')}</h2>
    <p class="muted">${T('Enter your account email and we will send you a link to choose a new password.')}</p>
    <form id="f-forgot"><div class="fmsg"></div>
      <label class="fld">${T('Email')}<input name="email" type="email" autocomplete="email" required></label>
      <button class="primary" type="submit">${T('SEND LINK')}</button>
    </form>
    <div class="links"><a href="#/login">${T('← Back to log in')}</a></div></div>`);
  bind('#f-forgot', async (d, f, box) => { const r = await api('forgot', d); box.innerHTML = msg('ok', r.message); f.reset(); });
}

function viewResend() {
  setView(`<div class="authbox"><h2>${T('Resend confirmation email')}</h2>
    <p class="muted">${T('If your account is not confirmed yet, you will get a new link. Check your spam folder too.')}</p>
    <form id="f-resend"><div class="fmsg"></div>
      <label class="fld">${T('Email')}<input name="email" type="email" autocomplete="email" required></label>
      <button class="primary" type="submit">${T('RESEND')}</button>
    </form>
    <div class="links"><a href="#/login">${T('← Back to log in')}</a></div></div>`);
  bind('#f-resend', async (d, f, box) => { const r = await api('resend_verification', d); box.innerHTML = msg('ok', r.message); f.reset(); });
}

function viewReset(q) {
  const token = q.get('token') || '';
  setView(`<div class="authbox"><h2>${T('New password')}</h2>
    <form id="f-reset"><div class="fmsg"></div>
      <label class="fld">${T('New password')}<input name="password" type="password" autocomplete="new-password" minlength="8" required><small>${T('At least 8 characters, with letters and numbers.')}</small></label>
      <label class="fld">${T('Repeat the password')}<input name="again" type="password" autocomplete="new-password" required></label>
      <button class="primary" type="submit">${T('SAVE PASSWORD')}</button>
    </form></div>`);
  bind('#f-reset', async (d, f, box) => {
    if (d.password !== d.again) throw new Error(T('The two passwords do not match.'));
    const r = await api('reset', {token, password: d.password});
    f.remove();
    $('.authbox').insertAdjacentHTML('beforeend', msg('ok', r.message) + `<div class="links"><a href="#/login">${T('Go to log in')}</a></div>`);
  });
}

async function viewVerify(q) {
  setView(`<div class="authbox"><h2>${T('Confirm email')}</h2><p class="muted">${T('Verifying…')}</p></div>`);
  let html;
  try { const r = await api('verify', {token: q.get('token') || ''}); html = msg('ok', r.message) + `<div class="links"><a href="#/login">${T('Go to log in')}</a></div>`; }
  catch (e) { html = msg('err', e.message) + `<div class="links"><a href="#/resend">${T('Request a new link')}</a></div>`; }
  setView(`<div class="authbox"><h2>${T('Confirm email')}</h2>${html}</div>`);
}

// ------------------------------------------------------------------ private views
async function viewPortfolio() {
  setView(loading());
  const [{portfolio: p}] = await Promise.all([api('portfolio'), loadPrices()]);
  const c = p.currency;
  const dash = '<span class="muted">—</span>';
  const rows = p.positions.map(x => `<tr>
      <td class="tk l">${esc(x.ticker)}</td><td class="co l">${esc(x.name)}</td>
      <td>${x.qty}</td><td>${num(x.avg_cost)}</td>
      <td>${x.price === null ? '—' : num(x.price) + ' ' + esc(x.price_ccy)}</td>
      <td>${money(x.value, c)}</td><td class="${cls(x.pl)}">${sgn(x.pl)} (${sgn(x.pl_pct)}%)</td>
      <td>${num(x.weight, 1)}%</td>
      <td class="neg">${x.stop_loss === null ? dash : num(x.stop_loss) + ' ' + esc(x.price_ccy || '')}</td>
      <td class="pos">${x.take_profit === null ? dash : num(x.take_profit) + ' ' + esc(x.price_ccy || '')}</td>
      <td><button class="sm" data-sell="${esc(x.ticker)}">${T('SELL')}</button> <button class="sm ghost" data-buy="${esc(x.ticker)}">${T('BUY')}</button> <button class="sm ghost" data-lv="${esc(x.ticker)}" title="${esc(T('Set stop loss and take profit'))}">SL/TP</button></td></tr>`).join('');
  const tradeLink = `<a href="#/trade" style="color:var(--cyan)">${T('TRADE')}</a>`;
  setView(`<h2>${T('Portfolio')}</h2>
    <p class="muted">${T('{ccy} account · starting budget {budget}', {ccy: c === 'EUR' ? T('Euro') : T('US dollar'), budget: money(p.initial_budget, c)})}</p>
    <div class="acc-kpis">
      <div class="kpi"><div class="t">${T('TOTAL VALUE')}</div><div class="v">${money(p.equity, c)}</div></div>
      <div class="kpi"><div class="t">${T('CASH')}</div><div class="v">${money(p.cash, c)}</div></div>
      <div class="kpi"><div class="t">${T('INVESTED')}</div><div class="v">${money(p.invested, c)}</div></div>
      <div class="kpi"><div class="t">${T('TOTAL P/L')}</div><div class="v ${cls(p.total_pl)}">${sgn(p.total_pl)}</div><div class="d ${cls(p.total_pl)}">${sgn(p.total_pl_pct)}%</div></div>
    </div>
    ${pricesInfo()}
    <h3>${T('OPEN POSITIONS')}</h3>
    ${p.positions.length ? `<div class="table-wrap"><table><thead><tr><th class="l">${T('Ticker')}</th><th class="l">${T('Company')}</th><th>${T('Qty')}</th><th>${T('Avg cost')}</th><th>${T('Price')}</th><th>${T('Value')}</th><th>${T('P/L')}</th><th>${T('Weight')}</th><th>${T('Stop loss')}</th><th>${T('Take profit')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty panel">${T('You have no open positions yet. Go to {trade} to buy your first stock with virtual money.', {trade: tradeLink})}</div>`}
    <p class="note">${T("P/L includes the effect of the EUR/USD exchange rate for stocks priced in a currency different from your account. Commissions are simulated. Stop loss and take profit are price levels in the stock's currency: when reached, the whole position is sold at the first price update (up to 4 times a day) and the sale price can differ from the level.")}</p>`);
  document.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => go('trade?t=' + encodeURIComponent(b.dataset.sell) + '&side=sell'));
  document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => go('trade?t=' + encodeURIComponent(b.dataset.buy) + '&side=buy'));
  document.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => openLevels(p.positions.find(x => x.ticker === b.dataset.lv), viewPortfolio));
}

/** Dialog to set or remove the stop loss and take profit of a position. */
function openLevels(x, done) {
  if (!x) return;
  if (x.price === null) { alert(T('Price not available for this stock: please try again later.')); return; }
  const ccy = x.price_ccy || '';
  const el = document.createElement('div');
  el.id = 'lvmodal';
  el.innerHTML = `<div class="modal-box am-box" role="dialog" aria-modal="true">
    <div class="mhead"><span>${esc(T('Stop loss / Take profit · {t}', {t: x.ticker}))}</span><button type="button" data-x aria-label="${esc(T('Close'))}">×</button></div>
    <div class="am-body">
      <p class="note">${T('Current price: <b>{price} {ccy}</b> · position: {qty} shares.<br>If the price falls to your <b>stop loss</b> or rises to your <b>take profit</b>, the whole position is sold at the first price update (up to 4 times a day). The sale price can differ from the level you set. Leave a field empty to not use it.', {price: num(x.price), ccy: esc(ccy), qty: x.qty})}</p>
      <form id="f-lv"><div class="fmsg"></div>
        <label class="fld">${T('Stop loss ({ccy}) · below the current price', {ccy: esc(ccy)})}<input name="stop_loss" type="number" step="0.01" min="0" value="${x.stop_loss ?? ''}"><small data-h="stop_loss"></small></label>
        <label class="fld">${T('Take profit ({ccy}) · above the current price', {ccy: esc(ccy)})}<input name="take_profit" type="number" step="0.01" min="0" value="${x.take_profit ?? ''}"><small data-h="take_profit"></small></label>
        <button class="primary" type="submit">${T('SAVE')}</button>
      </form>
    </div></div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-x]')) close(); });
  el.querySelectorAll('input').forEach(i => {
    const hint = () => {
      const v = parseFloat(i.value), h = el.querySelector(`[data-h="${i.name}"]`);
      h.textContent = v > 0 ? T('{pct}% vs current price', {pct: sgn((v / x.price - 1) * 100)}) : '';
    };
    i.addEventListener('input', hint); hint();
  });
  bind('#f-lv', async d => {
    await api('set_levels', {ticker: x.ticker, stop_loss: d.stop_loss, take_profit: d.take_profit});
    close(); done();
  });
}

async function viewTrade(q) {
  setView(loading());
  const [{portfolio: p}] = await Promise.all([api('portfolio'), loadPrices()]);
  if (!prices) { setView(`<h2>${T('Trade')}</h2>${msg('err', T('Prices are not available at the moment. Please try again later.'))}`); return; }
  const c = p.currency;
  const owned = t => p.positions.find(x => x.ticker === t)?.qty || 0;
  const list = Object.entries(prices.prices).map(([t, x]) => ({t, n: x.n || '', m: x.m}));
  let sel = null;
  const settingsLink = `<a href="#/settings" style="color:var(--cyan)">${T('Settings')}</a>`;

  setView(`<h2>${T('Trade')}</h2>
    <p class="muted">${T('Available cash: {cash} · virtual money', {cash: `<strong>${money(p.cash, c)}</strong>`})}</p>
    ${pricesInfo()}
    <div class="grid2"><div class="panel">
      <form id="f-trade" autocomplete="off"><div class="fmsg"></div>
        <label class="fld">${T('Search a stock (ticker or company)')}<input id="t-search" placeholder="${esc(T('e.g. AAPL, Enel, ISP.MI'))}"></label>
        <div id="t-suggest" class="suggest" hidden></div>
        <div id="t-quote"></div>
        <label class="fld">${T('Quantity (shares)')}<input id="t-qty" name="qty" type="number" min="1" step="1" value="1" required></label>
        <div class="fld row2">
          <div>${T('Stop loss (price, optional)')}<input id="t-sl" name="stop_loss" type="number" step="0.01" min="0" placeholder="${esc(T('e.g. 95'))}"><small id="t-sl-h"></small></div>
          <div>${T('Take profit (price, optional)')}<input id="t-tp" name="take_profit" type="number" step="0.01" min="0" placeholder="${esc(T('e.g. 120'))}"><small id="t-tp-h"></small></div>
        </div>
        <p class="note" id="t-lvnote">${T('Only with an immediate buy. If the price reaches them, the whole position is sold at the first price update (up to 4 times a day) and the price can differ from the level. You can also set them later from the portfolio.')}</p>
        <div class="radio">
          <label><input type="radio" name="mode" value="now" checked><span>${T('<strong>Now</strong> at the price of the {snap} ({when})', {snap: snapLabel(prices.snapshot), when: when(prices.updated)})}</span></label>
          <label><input type="radio" name="mode" value="next"><span>${T('<strong>At the next price update</strong> (weekdays at 9:00, 12:00, 16:00 and 21:00, Rome time). The price is not known in advance; you can cancel the order while it is queued.')}</span></label>
          <label><input type="radio" name="mode" value="limit"><span>${T('<strong>Limit price</strong>: runs only if the price reaches your limit (buy at or below it, sell at or above it). Valid for one trading day: if it is not executed by the end of the day it shows as "not executed".')}
            <span class="limitrow"><input id="t-limit" name="limit_price" type="number" step="0.01" min="0" placeholder="${esc(T('e.g. 150'))}" aria-label="${esc(T('Limit price ({ccy})', {ccy: ''}))}"><small id="t-limit-h"></small></span></span></label>
        </div>
        <div id="t-est" class="estimate">${T('Select a stock.')}</div>
        <div class="btnrow"><button class="buy" type="submit" data-side="buy">${T('BUY')}</button><button class="sell" type="submit" data-side="sell">${T('SELL')}</button></div>
      </form></div>
      <div class="panel"><h3 style="margin-top:0">${T('SIMULATED COMMISSIONS')}</h3>
        <p class="note">${T('Italian stocks: {it} per order<br>US stocks: {us} per order<br>You can change them in {settings}.', {it: money(user.commission_it, c), us: money(user.commission_us, c), settings: settingsLink})}</p>
        <h3>${T('RULES')}</h3>
        <p class="note">${T('You can only buy with the cash available and sell shares you own (no short selling, no leverage). Whole shares only. Orders are simulated: nothing is executed on real markets.')}</p></div></div>`);

  const search = $('#t-search'), sug = $('#t-suggest'), est = $('#t-est');
  function choose(t) {
    sel = t; search.value = t; sug.hidden = true;
    const x = prices.prices[t];
    $('#t-quote').innerHTML = `<div class="quote"><span class="big">${num(x.p)} ${esc(x.c)}</span><span>${esc(x.n || t)}</span><span class="note">${x.m === 'IT' ? T('Borsa Italiana') : T('USA')} · ${T('in portfolio: {n}', {n: owned(t)})}</span></div>`;
    update();
  }
  function update() {
    if (!sel) { est.textContent = T('Select a stock.'); return; }
    const x = prices.prices[sel], qty = Math.max(0, parseInt($('#t-qty').value, 10) || 0);
    const fx = fxRate(x.c, c);
    const comm = x.m === 'IT' ? user.commission_it : user.commission_us;
    if (fx === null) { est.textContent = T('Exchange rate not available.'); return; }
    const gross = qty * x.p * fx;
    est.innerHTML = T('Order value: {gross}{rate}<br>Commission: {comm}<br>Buy total: {buy} · Net sale proceeds: {sell}', {
      gross: `<b>${money(gross, c)}</b>`,
      rate: x.c !== c ? ` <span class="note">${T('(rate {fx})', {fx: num(fx, 4)})}</span>` : '',
      comm: money(comm, c), buy: `<b>${money(gross + comm, c)}</b>`, sell: `<b>${money(Math.max(0, gross - comm), c)}</b>`});
  }
  search.addEventListener('input', () => {
    const s = search.value.trim().toLowerCase();
    sel = null; $('#t-quote').innerHTML = ''; update();
    if (s.length < 1) { sug.hidden = true; return; }
    const hits = list.filter(x => x.t.toLowerCase().startsWith(s) || x.n.toLowerCase().includes(s)).slice(0, 12);
    sug.innerHTML = hits.map(x => `<div data-t="${esc(x.t)}">${esc(x.t)} <span>${esc(x.n)}</span></div>`).join('') || `<div>${T('No results')}</div>`;
    sug.hidden = false;
  });
  sug.addEventListener('click', e => { const d = e.target.closest('[data-t]'); if (d) choose(d.dataset.t); });
  $('#t-qty').addEventListener('input', update);
  const lvHint = () => {
    for (const [id, hid] of [['#t-sl', '#t-sl-h'], ['#t-tp', '#t-tp-h']]) {
      const v = parseFloat($(id).value), px = sel ? prices.prices[sel].p : 0;
      $(hid).textContent = v > 0 && px ? T('{pct}% vs current price', {pct: sgn((v / px - 1) * 100)}) : '';
    }
  };
  $('#t-sl').addEventListener('input', lvHint); $('#t-tp').addEventListener('input', lvHint);
  document.querySelectorAll('#f-trade [name=mode]').forEach(r => r.addEventListener('change', () => {
    const off = document.querySelector('#f-trade [name=mode]:checked').value !== 'now';
    $('#t-sl').disabled = $('#t-tp').disabled = off;
    if (off) { $('#t-sl').value = $('#t-tp').value = ''; lvHint(); }
  }));
  const limHint = () => {
    const v = parseFloat($('#t-limit').value), x = sel ? prices.prices[sel] : null;
    $('#t-limit-h').textContent = x ? (v > 0 ? `${x.c} · ${T('{pct}% vs current price', {pct: sgn((v / x.p - 1) * 100)})}` : T('Limit price ({ccy})', {ccy: x.c})) : '';
  };
  $('#t-limit').addEventListener('input', () => { document.querySelector('#f-trade [name=mode][value=limit]').checked = true; document.querySelector('#f-trade [name=mode][value=limit]').dispatchEvent(new Event('change')); limHint(); });
  $('#t-limit').addEventListener('focus', () => { const r = document.querySelector('#f-trade [name=mode][value=limit]'); if (!r.checked) { r.checked = true; r.dispatchEvent(new Event('change')); } });
  search.addEventListener('input', limHint);
  sug.addEventListener('click', limHint);
  const want = (q.get('t') || '').toUpperCase();
  if (want && prices.prices[want]) choose(want);

  let side = q.get('side') === 'sell' ? 'sell' : 'buy';
  document.querySelector(`#f-trade [data-side="${side}"]`)?.classList.add('pref');
  document.querySelectorAll('#f-trade [data-side]').forEach(b => b.addEventListener('click', () => { side = b.dataset.side; }));
  bind('#f-trade', async (d, f, box) => {
    if (!sel) throw new Error(T('Select a stock.'));
    const qty = parseInt(d.qty, 10);
    const sl = d.stop_loss || '', tp = d.take_profit || '';
    const lim = d.mode === 'limit' ? parseFloat(d.limit_price) : 0;
    if (d.mode === 'limit' && !(lim > 0)) throw new Error(T('Enter a limit price.'));
    if ((sl || tp) && (side !== 'buy' || d.mode !== 'now')) throw new Error(T('Stop loss and take profit can be set on an immediate buy. For a position you already hold, use the SL/TP button in the portfolio.'));
    const ask = T('{side} {qty} {t} ({mode})? Simulated order, virtual money.', {
      side: T(side === 'buy' ? 'Buy' : 'Sell'), qty, t: sel,
      mode: d.mode === 'limit' ? T('with a limit of {p}', {p: num(lim) + ' ' + prices.prices[sel].c}) : T(d.mode === 'now' ? 'now' : 'at the next price update')});
    if (!confirm(ask)) return;
    const r = await api('place_order', {ticker: sel, side, qty, mode: d.mode, stop_loss: sl, take_profit: tp, limit_price: d.mode === 'limit' ? lim : ''});
    box.innerHTML = msg('ok', r.message);
    setTimeout(() => viewTrade(q), 900);
  });
}

async function viewOrders() {
  setView(loading());
  const [{orders}] = await Promise.all([api('orders'), loadPrices()]);
  const statusLbl = {executed: T('EXECUTED'), pending: T('QUEUED'), cancelled: T('CANCELLED'), rejected: T('REJECTED'), expired: T('NOT EXECUTED')};
  const typeLbl = o => o.mode === 'limit' ? T('Limit {price}', {price: num(o.limit_price) + ' ' + esc(prices?.prices?.[o.ticker]?.c || o.price_ccy || '')})
    : o.mode === 'next' ? T('Next update') : T('Market');
  const rows = orders.map(o => `<tr>
    <td class="l">${when(o.executed_at || o.created_at)}</td>
    <td class="tk l">${esc(o.ticker)}</td>
    <td><span class="chip ${o.side}">${o.side === 'buy' ? T('BUY') : T('SELL')}</span></td>
    <td>${typeLbl(o)}</td>
    <td>${o.qty}</td>
    <td>${o.price === null ? '—' : num(o.price) + ' ' + esc(o.price_ccy)}</td>
    <td>${o.gross === null ? '—' : money(o.gross)}</td>
    <td>${o.commission === null ? '—' : money(o.commission)}</td>
    <td class="${cls(o.realized_pl)}">${o.realized_pl === null ? '—' : sgn(+o.realized_pl)}</td>
    <td>${o.snapshot ? snapLabel(o.snapshot) : '—'}</td>
    <td><span class="chip ${o.status}" title="${esc(o.note || '')}">${statusLbl[o.status] || esc(o.status)}</span>${o.note ? `<div class="note">${esc(o.note)}</div>` : ''}${o.status === 'expired' ? `<div class="note">${T('Expired at the end of the trading day.')}</div>` : ''}${o.status === 'pending' && o.valid_until ? `<div class="note">${T('Valid until {when}', {when: when(o.valid_until)})}</div>` : ''}</td>
    <td>${o.status === 'pending' ? `<button class="sm danger" data-cancel="${o.id}">${T('CANCEL')}</button>` : ''}</td></tr>`).join('');
  const xl = f => `/api.php?action=export_orders&format=${f}&lang=${I18N.lang}`;
  setView(`<h2>${T('Order history')}</h2><p class="muted">${T('Latest {n} orders. Amounts in your account currency ({ccy}).', {n: orders.length, ccy: esc(user.currency)})}</p>
    ${orders.length ? `<div class="exportbar"><span>${T('Export orders')}:</span><a class="xbtn" href="${xl('csv')}" download>CSV</a><a class="xbtn" href="${xl('xlsx')}" download>Excel</a><a class="xbtn" href="${xl('xml')}" download>XML</a></div>` : ''}
    ${orders.length ? `<div class="table-wrap"><table><thead><tr><th class="l">${T('Date')}</th><th class="l">${T('Ticker')}</th><th>${T('Side')}</th><th>${T('Type')}</th><th>${T('Qty')}</th><th>${T('Price')}</th><th>${T('Order value')}</th><th>${T('Commission')}</th><th>${T('Realised P/L')}</th><th>${T('Price from')}</th><th>${T('Status')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty panel">${T('No orders yet.')}</div>`}`);
  document.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await api('cancel_order', {id: +b.dataset.cancel}); viewOrders(); } catch (e) { alert(e.message); b.disabled = false; }
  });
}

async function viewCharts() {
  setView(loading());
  const [{equity}, {portfolio: p}] = await Promise.all([api('equity'), api('portfolio'), loadPrices()]);
  const c = p.currency;
  const alloc = [{l: T('Cash'), w: p.equity > 0 ? p.cash / p.equity * 100 : 100, cls: 'c'}]
    .concat(p.positions.map(x => ({l: x.ticker, w: x.weight, cls: 'c'})));
  const maxPl = Math.max(5, ...p.positions.map(x => Math.abs(x.pl_pct)));
  setView(`<h2>${T('Charts')}</h2><p class="muted">${T('Portfolio value over time (cash + stocks), at each price update.')}</p>
    <div class="panel"><div id="eqchart"></div></div>
    <div class="grid2">
      <div class="panel bars"><h3 style="margin-top:0">${T('ALLOCATION')}</h3>${alloc.map(a => `<div class="bar"><span>${esc(a.l)}</span><div class="track"><div class="fill ${a.cls}" style="left:0;width:${Math.min(100, Math.max(0, a.w))}%"></div></div><span>${num(a.w, 1)}%</span></div>`).join('')}</div>
      <div class="panel bars"><h3 style="margin-top:0">${T('P/L BY POSITION')}</h3>${p.positions.length ? p.positions.map(x => {
        const w = Math.min(50, Math.abs(x.pl_pct) / maxPl * 50), pos = x.pl_pct >= 0;
        return `<div class="bar"><span>${esc(x.ticker)}</span><div class="track"><div class="mid"></div><div class="fill ${pos ? 'g' : 'r'}" style="${pos ? 'left:50%' : 'right:50%'};width:${w}%"></div></div><span class="${cls(x.pl_pct)}">${sgn(x.pl_pct)}%</span></div>`;
      }).join('') : `<div class="empty">${T('No open positions.')}</div>`}</div>
    </div>`);
  if (eqChart) { eqChart.remove(); eqChart = null; }
  if (typeof LightweightCharts === 'undefined') { $('#eqchart').innerHTML = `<div class="empty">${T('Chart not available.')}</div>`; return; }
  eqChart = LightweightCharts.createChart($('#eqchart'), {
    autoSize: true,
    layout: {background: {color: '#0a120a'}, textColor: '#9fb0a0'},
    grid: {vertLines: {color: '#14200f'}, horzLines: {color: '#14200f'}},
    timeScale: {timeVisible: true, borderColor: '#1d2b14'}, rightPriceScale: {borderColor: '#1d2b14'},
    localization: {priceFormatter: v => num(v, 0) + ' ' + c},
  });
  const s = eqChart.addAreaSeries({lineColor: '#b6ff00', topColor: 'rgba(182,255,0,.25)', bottomColor: 'rgba(182,255,0,0)', lineWidth: 2});
  let last = 0;
  const pts = [];
  for (const e of equity) {
    let t = Math.floor(utc(e.ts).getTime() / 1000);
    if (t <= last) t = last + 1;
    last = t;
    pts.push({time: t, value: +e.equity});
  }
  s.setData(pts);
  eqChart.timeScale().fitContent();
}

function viewSettings() {
  const c = user.currency;
  setView(`<h2>${T('Settings')}</h2><p class="muted">${T('{user} · {email} · joined {when}', {user: esc(user.username), email: esc(user.email), when: when(user.created_at)})}</p>
    <div class="grid2">
    <div class="panel"><h3 style="margin-top:0">${T('SIMULATED COMMISSIONS (per order, in {ccy})', {ccy: c})}</h3>
      <form id="f-comm"><div class="fmsg"></div>
        <label class="fld">${T('Italian stocks')}<input name="commission_it" type="number" min="0" max="100" step="0.01" value="${user.commission_it}" required></label>
        <label class="fld">${T('US stocks')}<input name="commission_us" type="number" min="0" max="100" step="0.01" value="${user.commission_us}" required></label>
        <button class="primary" type="submit">${T('SAVE')}</button></form></div>
    <div class="panel"><h3 style="margin-top:0">${T('CHANGE PASSWORD')}</h3>
      <form id="f-pw"><div class="fmsg"></div>
        <label class="fld">${T('Current password')}<input name="current" type="password" autocomplete="current-password" required></label>
        <label class="fld">${T('New password')}<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <button class="primary" type="submit">${T('UPDATE')}</button></form></div>
    <div class="panel"><h3 style="margin-top:0">${T('RESET YOUR ACCOUNT')}</h3>
      <p class="note">${T('Deletes orders, positions and history and starts again with a new virtual budget (also in another currency).')}</p>
      <form id="f-reset-acc"><div class="fmsg"></div>
        <div class="fld row2"><div>${T('Currency')}<select name="currency"><option value="EUR"${c === 'EUR' ? ' selected' : ''}>${T('Euro (€)')}</option><option value="USD"${c === 'USD' ? ' selected' : ''}>${T('US dollar ($)')}</option></select></div>
        <div>${T('Budget')}<select name="budget" id="s-budget"></select></div></div>
        <label class="fld">${T('Password to confirm')}<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="danger" type="submit">${T('RESET ACCOUNT')}</button></form></div>
    <div class="panel"><h3 style="margin-top:0">${T('DELETE ACCOUNT')}</h3>
      <p class="note">${T('Permanently deletes your account and all linked data (orders, positions, history, email). This cannot be undone.')}</p>
      <form id="f-del"><div class="fmsg"></div>
        <label class="fld">${T('Password to confirm')}<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="danger" type="submit">${T('DELETE PERMANENTLY')}</button></form></div>
    </div>
    <p style="margin-top:18px"><button id="b-logout">${T('LOG OUT')}</button></p>`);
  const sel = $('#s-budget');
  for (let v = 10000; v <= 100000; v += 10000) sel.insertAdjacentHTML('beforeend', `<option value="${v}"${+user.initial_budget === v ? ' selected' : ''}>${num(v, 0)}</option>`);

  bind('#f-comm', async (d, f, box) => {
    const r = await api('update_settings', {commission_it: +d.commission_it, commission_us: +d.commission_us});
    user.commission_it = +d.commission_it; user.commission_us = +d.commission_us;
    box.innerHTML = msg('ok', r.message);
  });
  bind('#f-pw', async (d, f, box) => { const r = await api('change_password', d); f.reset(); box.innerHTML = msg('ok', r.message); });
  bind('#f-reset-acc', async (d, f, box) => {
    if (!confirm(T('Reset your account? Orders, positions and history will be deleted.'))) return;
    const r = await api('reset_account', {currency: d.currency, budget: +d.budget, password: d.password});
    user = (await api('me')).user;
    box.innerHTML = msg('ok', r.message);
  });
  bind('#f-del', async (d, f, box) => {
    if (!confirm(T('Permanently delete your account and all your data? This cannot be undone.'))) return;
    await api('delete_account', {password: d.password});
    user = null; await refreshCsrf(); renderChrome();
    setView(`<div class="authbox"><h2>${T('Account deleted')}</h2>` + msg('ok', T('Your account and all linked data have been deleted.')) + `<div class="links"><a href="#/register">${T('Create a new account')}</a></div></div>`);
  });
  $('#b-logout').onclick = async () => { try { await api('logout', {}); } catch (e) {} user = null; await refreshCsrf(); go('login'); };
}

// ------------------------------------------------------------------ router
function renderChrome() {
  $('#nav').hidden = !user;
  $('#who').innerHTML = user ? `<b>${esc(user.username)}</b><small>${esc(user.currency)} · ${T('VIRTUAL MONEY')}</small>` : '';
}

async function refreshCsrf() { const r = await api('csrf'); csrf = r.csrf; }

async function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path0, qs] = h.split('?');
  const q = new URLSearchParams(qs || '');
  let path = path0 || (user ? 'portfolio' : 'login');
  if (!user && PRIVATE.includes(path)) path = 'login';
  if (user && ['login', 'register', 'forgot', 'resend'].includes(path)) path = 'portfolio';
  if (![...PRIVATE, ...PUBLIC].includes(path)) path = user ? 'portfolio' : 'login';
  if (location.hash !== '#/' + path + (qs ? '?' + qs : '') && !path0) history.replaceState(null, '', '#/' + path);

  renderChrome();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.r === path));
  if (eqChart && path !== 'charts') { eqChart.remove(); eqChart = null; }
  try {
    switch (path) {
      case 'login': return viewLogin(q.get('info'));
      case 'register': return viewRegister();
      case 'forgot': return viewForgot();
      case 'resend': return viewResend();
      case 'reset': return viewReset(q);
      case 'verify': return await viewVerify(q);
      case 'portfolio': return await viewPortfolio();
      case 'trade': return await viewTrade(q);
      case 'orders': return await viewOrders();
      case 'charts': return await viewCharts();
      case 'settings': return viewSettings();
    }
  } catch (e) {
    if (e.code === 401) { user = null; return go('login'); }
    setView(`<div class="authbox">${msg('err', e.message)}</div>`);
  }
}

$('#nav').addEventListener('click', e => { const b = e.target.closest('button[data-r]'); if (b) go(b.dataset.r); });
window.addEventListener('hashchange', route);

(async function init() {
  try { const r = await api('me'); user = r.user; }
  catch (e) { setView(`<div class="authbox">${msg('err', e.message)}</div>`); return; }
  route();
})();
