'use strict';
/* Area riservata del paper trading: login, registrazione, portafoglio, ordini, grafici, impostazioni. */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const TZ = 'Europe/Rome';
const PRIVATE = ['portfolio', 'trade', 'orders', 'charts', 'settings'];
const PUBLIC = ['login', 'register', 'forgot', 'reset', 'verify', 'resend'];
const SNAP = {mid: 'ultimo aggiornamento intraday', close: 'chiusura'};

let csrf = '', user = null, prices = null, eqChart = null;

// ------------------------------------------------------------------ utilità
const money = (v, ccy) => new Intl.NumberFormat('it-IT', {style: 'currency', currency: ccy || user?.currency || 'EUR'}).format(v ?? 0);
const num = (v, d = 2) => new Intl.NumberFormat('it-IT', {minimumFractionDigits: d, maximumFractionDigits: d}).format(v ?? 0);
const sgn = v => (v > 0 ? '+' : '') + num(v);
const cls = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
const utc = s => new Date(String(s).replace(' ', 'T') + (String(s).includes('T') ? '' : 'Z'));
const when = s => s ? utc(s).toLocaleString('it-IT', {timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—';

async function api(action, body) {
  const opt = {credentials: 'same-origin'};
  if (body !== undefined) {
    opt.method = 'POST';
    opt.headers = {'Content-Type': 'application/json', 'X-CSRF-Token': csrf};
    opt.body = JSON.stringify(body);
  }
  let j;
  try {
    const r = await fetch('/api.php?action=' + action, opt);
    j = await r.json();
  } catch (e) {
    throw new Error('Servizio non raggiungibile. Riprova tra poco.');
  }
  if (j.csrf) csrf = j.csrf;
  if (!j.ok) { const err = new Error(j.error || 'Errore'); err.code = j.status; throw err; }
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

function pricesInfo() {
  if (!prices) return '<p class="note">Prezzi non disponibili al momento.</p>';
  return `<p class="note">Prezzi: ${SNAP[prices.snapshot] || esc(prices.snapshot)} · aggiornati il ${when(prices.updated)} (ora di Roma). Servizio demo: i prezzi possono essere errati o non aggiornati.</p>`;
}

/** Collega un form: disabilita il pulsante, mostra errori/successo in #fmsg. */
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

// ------------------------------------------------------------------ viste pubbliche
function viewLogin(info) {
  setView(`<div class="authbox"><h2>Accedi</h2>
    <p class="muted">Entra nella tua area di paper trading.</p>
    ${msg('ok', info)}
    <form id="f-login"><div class="fmsg"></div>
      <label class="fld">Username o email<input name="login" autocomplete="username" required></label>
      <label class="fld">Password<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="primary" type="submit">ACCEDI</button>
    </form>
    <div class="links"><a href="#/forgot">Password dimenticata?</a><a href="#/register">Crea un account</a></div>
    <div class="links"><a href="#/resend">Non hai ricevuto l'email di conferma?</a></div></div>`);
  bind('#f-login', async (d, f, box) => {
    try {
      const r = await api('login', d);
      user = r.user;
      go('portfolio');
    } catch (e) { box.innerHTML = msg('err', e.message); }
  });
}

function viewRegister() {
  setView(`<div class="authbox"><h2>Crea il tuo account</h2>
    <p class="muted">Gratis, con denaro <strong>virtuale</strong>. Servono solo username, email e password.</p>
    <form id="f-reg"><div class="fmsg"></div>
      <label class="fld">Username<input name="username" autocomplete="username" pattern="[A-Za-z0-9_]{3,30}" required><small>3-30 caratteri: lettere, numeri, underscore.</small></label>
      <label class="fld">Email<input name="email" type="email" autocomplete="email" required><small>Riceverai un link per confermarla. Un solo account per email.</small></label>
      <label class="fld">Password<input name="password" type="password" autocomplete="new-password" minlength="8" required><small>Almeno 8 caratteri, con lettere e numeri.</small></label>
      <div class="fld row2">
        <div>Valuta del conto<select name="currency"><option value="EUR">Euro (€)</option><option value="USD">Dollaro USA ($)</option></select></div>
        <div>Budget virtuale<select name="budget" id="r-budget"></select></div>
      </div>
      <div class="hp" aria-hidden="true"><label>Sito web<input name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="checks">
        <label><input type="checkbox" name="accept_terms" value="1" required><span>Ho letto e accetto i <a href="/termini.html" target="_blank" rel="noopener">Termini e condizioni</a> e l'<a href="/privacy.html" target="_blank" rel="noopener">informativa privacy</a>. So che si tratta di paper trading con denaro virtuale, senza premi, e che il servizio è una demo che può essere sospesa o eliminata in qualsiasi momento.</span></label>
        <label><input type="checkbox" name="accept_age" value="1" required><span>Dichiaro di avere almeno 18 anni.</span></label>
      </div>
      <button class="primary" type="submit">CREA ACCOUNT</button>
    </form>
    <div class="links"><a href="#/login">Hai già un account? Accedi</a></div></div>`);
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
  setView(`<div class="authbox"><h2>Recupera password</h2>
    <p class="muted">Inserisci l'email dell'account: ti invieremo un link per sceglierne una nuova.</p>
    <form id="f-forgot"><div class="fmsg"></div>
      <label class="fld">Email<input name="email" type="email" autocomplete="email" required></label>
      <button class="primary" type="submit">INVIA LINK</button>
    </form>
    <div class="links"><a href="#/login">← Torna all'accesso</a></div></div>`);
  bind('#f-forgot', async (d, f, box) => { const r = await api('forgot', d); box.innerHTML = msg('ok', r.message); f.reset(); });
}

function viewResend() {
  setView(`<div class="authbox"><h2>Reinvia email di conferma</h2>
    <p class="muted">Se l'account non è ancora confermato, riceverai un nuovo link. Controlla anche lo spam.</p>
    <form id="f-resend"><div class="fmsg"></div>
      <label class="fld">Email<input name="email" type="email" autocomplete="email" required></label>
      <button class="primary" type="submit">REINVIA</button>
    </form>
    <div class="links"><a href="#/login">← Torna all'accesso</a></div></div>`);
  bind('#f-resend', async (d, f, box) => { const r = await api('resend_verification', d); box.innerHTML = msg('ok', r.message); f.reset(); });
}

function viewReset(q) {
  const token = q.get('token') || '';
  setView(`<div class="authbox"><h2>Nuova password</h2>
    <form id="f-reset"><div class="fmsg"></div>
      <label class="fld">Nuova password<input name="password" type="password" autocomplete="new-password" minlength="8" required><small>Almeno 8 caratteri, con lettere e numeri.</small></label>
      <label class="fld">Ripeti la password<input name="again" type="password" autocomplete="new-password" required></label>
      <button class="primary" type="submit">SALVA PASSWORD</button>
    </form></div>`);
  bind('#f-reset', async (d, f, box) => {
    if (d.password !== d.again) throw new Error('Le due password non coincidono.');
    const r = await api('reset', {token, password: d.password});
    f.remove();
    $('.authbox').insertAdjacentHTML('beforeend', msg('ok', r.message) + '<div class="links"><a href="#/login">Vai all\'accesso</a></div>');
  });
}

async function viewVerify(q) {
  setView('<div class="authbox"><h2>Conferma email</h2><p class="muted">Verifica in corso…</p></div>');
  let html;
  try { const r = await api('verify', {token: q.get('token') || ''}); html = msg('ok', r.message) + '<div class="links"><a href="#/login">Vai all\'accesso</a></div>'; }
  catch (e) { html = msg('err', e.message) + '<div class="links"><a href="#/resend">Richiedi un nuovo link</a></div>'; }
  setView(`<div class="authbox"><h2>Conferma email</h2>${html}</div>`);
}

// ------------------------------------------------------------------ viste private
async function viewPortfolio() {
  setView('<p class="muted">Caricamento…</p>');
  const [{portfolio: p}] = await Promise.all([api('portfolio'), loadPrices()]);
  const c = p.currency;
  const rows = p.positions.map(x => `<tr>
      <td class="tk l">${esc(x.ticker)}</td><td class="co l">${esc(x.name)}</td>
      <td>${x.qty}</td><td>${num(x.avg_cost)}</td>
      <td>${x.price === null ? '—' : num(x.price) + ' ' + esc(x.price_ccy)}</td>
      <td>${money(x.value, c)}</td><td class="${cls(x.pl)}">${sgn(x.pl)} (${sgn(x.pl_pct)}%)</td>
      <td>${num(x.weight, 1)}%</td>
      <td><button class="sm" data-sell="${esc(x.ticker)}">VENDI</button> <button class="sm ghost" data-buy="${esc(x.ticker)}">COMPRA</button></td></tr>`).join('');
  setView(`<h2>Portafoglio</h2>
    <p class="muted">Conto in ${c === 'EUR' ? 'euro' : 'dollari USA'} · budget iniziale ${money(p.initial_budget, c)}</p>
    <div class="acc-kpis">
      <div class="kpi"><div class="t">VALORE TOTALE</div><div class="v">${money(p.equity, c)}</div></div>
      <div class="kpi"><div class="t">LIQUIDITÀ</div><div class="v">${money(p.cash, c)}</div></div>
      <div class="kpi"><div class="t">INVESTITO</div><div class="v">${money(p.invested, c)}</div></div>
      <div class="kpi"><div class="t">P/L TOTALE</div><div class="v ${cls(p.total_pl)}">${sgn(p.total_pl)}</div><div class="d ${cls(p.total_pl)}">${sgn(p.total_pl_pct)}%</div></div>
    </div>
    ${pricesInfo()}
    <h3>POSIZIONI APERTE</h3>
    ${p.positions.length ? `<div class="table-wrap"><table><thead><tr><th class="l">Ticker</th><th class="l">Società</th><th>Qtà</th><th>Costo medio</th><th>Prezzo</th><th>Valore</th><th>P/L</th><th>Peso</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<div class="empty panel">Non hai ancora posizioni aperte. Vai su <a href="#/trade" style="color:var(--cyan)">OPERA</a> per acquistare la tua prima azione con il denaro virtuale.</div>'}
    <p class="note">Il P/L include l'effetto del cambio EUR/USD per i titoli in valuta diversa dal conto. Le commissioni sono simulate.</p>`);
  document.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => go('trade?t=' + encodeURIComponent(b.dataset.sell) + '&side=sell'));
  document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => go('trade?t=' + encodeURIComponent(b.dataset.buy) + '&side=buy'));
}

async function viewTrade(q) {
  setView('<p class="muted">Caricamento…</p>');
  const [{portfolio: p}] = await Promise.all([api('portfolio'), loadPrices()]);
  if (!prices) { setView(`<h2>Opera</h2>${msg('err', 'Prezzi non disponibili al momento. Riprova più tardi.')}`); return; }
  const c = p.currency;
  const owned = t => p.positions.find(x => x.ticker === t)?.qty || 0;
  const list = Object.entries(prices.prices).map(([t, x]) => ({t, n: x.n || '', m: x.m}));
  let sel = null;

  setView(`<h2>Opera</h2>
    <p class="muted">Liquidità disponibile: <strong>${money(p.cash, c)}</strong> · denaro virtuale</p>
    ${pricesInfo()}
    <div class="grid2"><div class="panel">
      <form id="f-trade" autocomplete="off"><div class="fmsg"></div>
        <label class="fld">Cerca titolo (ticker o società)<input id="t-search" placeholder="es. AAPL, Enel, ISP.MI"></label>
        <div id="t-suggest" class="suggest" hidden></div>
        <div id="t-quote"></div>
        <label class="fld">Quantità (azioni)<input id="t-qty" name="qty" type="number" min="1" step="1" value="1" required></label>
        <div class="radio">
          <label><input type="radio" name="mode" value="now" checked><span><strong>Subito</strong> al prezzo di ${esc(SNAP[prices.snapshot] || prices.snapshot)} (${when(prices.updated)})</span></label>
          <label><input type="radio" name="mode" value="next"><span><strong>Al prossimo aggiornamento</strong> dei prezzi (giorni feriali: ogni ora dalle 9:00 alle 22:00 e alla chiusura delle 23:30, ora di Roma). Prezzo non noto in anticipo; l'ordine può essere annullato finché è in coda.</span></label>
        </div>
        <div id="t-est" class="estimate">Seleziona un titolo.</div>
        <div class="btnrow"><button class="buy" type="submit" data-side="buy">COMPRA</button><button class="sell" type="submit" data-side="sell">VENDI</button></div>
      </form></div>
      <div class="panel"><h3 style="margin-top:0">COMMISSIONI SIMULATE</h3>
        <p class="note">Azioni italiane: ${money(user.commission_it, c)} per ordine<br>Azioni USA: ${money(user.commission_us, c)} per ordine<br>Modificabili in <a href="#/settings" style="color:var(--cyan)">Impostazioni</a>.</p>
        <h3>REGOLE</h3>
        <p class="note">Solo acquisti con la liquidità disponibile e vendite di azioni possedute (niente vendite allo scoperto, niente leva). Quantità intere. Gli ordini sono simulati: nessuna esecuzione sui mercati reali.</p></div></div>`);

  const search = $('#t-search'), sug = $('#t-suggest'), est = $('#t-est');
  function choose(t) {
    sel = t; search.value = t; sug.hidden = true;
    const x = prices.prices[t];
    $('#t-quote').innerHTML = `<div class="quote"><span class="big">${num(x.p)} ${esc(x.c)}</span><span>${esc(x.n || t)}</span><span class="note">${x.m === 'IT' ? 'Borsa Italiana' : 'USA'} · in portafoglio: ${owned(t)}</span></div>`;
    update();
  }
  function update() {
    if (!sel) { est.textContent = 'Seleziona un titolo.'; return; }
    const x = prices.prices[sel], qty = Math.max(0, parseInt($('#t-qty').value, 10) || 0);
    const fx = fxRate(x.c, c);
    const comm = x.m === 'IT' ? user.commission_it : user.commission_us;
    if (fx === null) { est.textContent = 'Cambio non disponibile.'; return; }
    const gross = qty * x.p * fx;
    est.innerHTML = `Controvalore: <b>${money(gross, c)}</b>${x.c !== c ? ` <span class="note">(cambio ${num(fx, 4)})</span>` : ''}<br>
      Commissione: ${money(comm, c)}<br>Acquisto: <b>${money(gross + comm, c)}</b> · Vendita netta: <b>${money(Math.max(0, gross - comm), c)}</b>`;
  }
  search.addEventListener('input', () => {
    const s = search.value.trim().toLowerCase();
    sel = null; $('#t-quote').innerHTML = ''; update();
    if (s.length < 1) { sug.hidden = true; return; }
    const hits = list.filter(x => x.t.toLowerCase().startsWith(s) || x.n.toLowerCase().includes(s)).slice(0, 12);
    sug.innerHTML = hits.map(x => `<div data-t="${esc(x.t)}">${esc(x.t)} <span>${esc(x.n)}</span></div>`).join('') || '<div>Nessun risultato</div>';
    sug.hidden = false;
  });
  sug.addEventListener('click', e => { const d = e.target.closest('[data-t]'); if (d) choose(d.dataset.t); });
  $('#t-qty').addEventListener('input', update);
  const want = (q.get('t') || '').toUpperCase();
  if (want && prices.prices[want]) choose(want);

  let side = 'buy';
  document.querySelectorAll('#f-trade [data-side]').forEach(b => b.addEventListener('click', () => { side = b.dataset.side; }));
  bind('#f-trade', async (d, f, box) => {
    if (!sel) throw new Error('Seleziona un titolo.');
    const qty = parseInt(d.qty, 10);
    const ask = `${side === 'buy' ? 'Comprare' : 'Vendere'} ${qty} ${sel} (${d.mode === 'now' ? 'subito' : 'al prossimo aggiornamento'})? Operazione simulata, denaro virtuale.`;
    if (!confirm(ask)) return;
    const r = await api('place_order', {ticker: sel, side, qty, mode: d.mode});
    box.innerHTML = msg('ok', r.message);
    setTimeout(() => viewTrade(q), 900);
  });
}

async function viewOrders() {
  setView('<p class="muted">Caricamento…</p>');
  const {orders} = await api('orders');
  const statusLbl = {executed: 'ESEGUITO', pending: 'IN CODA', cancelled: 'ANNULLATO', rejected: 'RIFIUTATO'};
  const rows = orders.map(o => `<tr>
    <td class="l">${when(o.executed_at || o.created_at)}</td>
    <td class="tk l">${esc(o.ticker)}</td>
    <td><span class="chip ${o.side}">${o.side === 'buy' ? 'ACQUISTO' : 'VENDITA'}</span></td>
    <td>${o.qty}</td>
    <td>${o.price === null ? '—' : num(o.price) + ' ' + esc(o.price_ccy)}</td>
    <td>${o.gross === null ? '—' : money(o.gross)}</td>
    <td>${o.commission === null ? '—' : money(o.commission)}</td>
    <td class="${cls(o.realized_pl)}">${o.realized_pl === null ? '—' : sgn(+o.realized_pl)}</td>
    <td>${o.snapshot ? esc(SNAP[o.snapshot] || o.snapshot) : '—'}</td>
    <td><span class="chip ${o.status}" title="${esc(o.note || '')}">${statusLbl[o.status] || esc(o.status)}</span>${o.note ? `<div class="note">${esc(o.note)}</div>` : ''}</td>
    <td>${o.status === 'pending' ? `<button class="sm danger" data-cancel="${o.id}">ANNULLA</button>` : ''}</td></tr>`).join('');
  setView(`<h2>Cronologia ordini</h2><p class="muted">Ultimi ${orders.length} ordini. Importi nella valuta del conto (${esc(user.currency)}).</p>
    ${orders.length ? `<div class="table-wrap"><table><thead><tr><th class="l">Data</th><th class="l">Ticker</th><th>Operazione</th><th>Qtà</th><th>Prezzo</th><th>Controvalore</th><th>Commissione</th><th>P/L realizzato</th><th>Prezzo di</th><th>Stato</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<div class="empty panel">Nessun ordine ancora.</div>'}`);
  document.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { await api('cancel_order', {id: +b.dataset.cancel}); viewOrders(); } catch (e) { alert(e.message); b.disabled = false; }
  });
}

async function viewCharts() {
  setView('<p class="muted">Caricamento…</p>');
  const [{equity}, {portfolio: p}] = await Promise.all([api('equity'), api('portfolio'), loadPrices()]);
  const c = p.currency;
  const alloc = [{l: 'Liquidità', w: p.equity > 0 ? p.cash / p.equity * 100 : 100, cls: 'c'}]
    .concat(p.positions.map(x => ({l: x.ticker, w: x.weight, cls: 'c'})));
  const maxPl = Math.max(5, ...p.positions.map(x => Math.abs(x.pl_pct)));
  setView(`<h2>Grafici</h2><p class="muted">Andamento del valore del portafoglio (liquidità + titoli) negli aggiornamenti dei prezzi.</p>
    <div class="panel"><div id="eqchart"></div></div>
    <div class="grid2">
      <div class="panel bars"><h3 style="margin-top:0">ALLOCAZIONE</h3>${alloc.map(a => `<div class="bar"><span>${esc(a.l)}</span><div class="track"><div class="fill ${a.cls}" style="left:0;width:${Math.min(100, Math.max(0, a.w))}%"></div></div><span>${num(a.w, 1)}%</span></div>`).join('')}</div>
      <div class="panel bars"><h3 style="margin-top:0">P/L PER POSIZIONE</h3>${p.positions.length ? p.positions.map(x => {
        const w = Math.min(50, Math.abs(x.pl_pct) / maxPl * 50), pos = x.pl_pct >= 0;
        return `<div class="bar"><span>${esc(x.ticker)}</span><div class="track"><div class="mid"></div><div class="fill ${pos ? 'g' : 'r'}" style="${pos ? 'left:50%' : 'right:50%'};width:${w}%"></div></div><span class="${cls(x.pl_pct)}">${sgn(x.pl_pct)}%</span></div>`;
      }).join('') : '<div class="empty">Nessuna posizione aperta.</div>'}</div>
    </div>`);
  if (eqChart) { eqChart.remove(); eqChart = null; }
  if (typeof LightweightCharts === 'undefined') { $('#eqchart').innerHTML = '<div class="empty">Grafico non disponibile.</div>'; return; }
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
  setView(`<h2>Impostazioni</h2><p class="muted">${esc(user.username)} · ${esc(user.email)} · registrato il ${when(user.created_at)}</p>
    <div class="grid2">
    <div class="panel"><h3 style="margin-top:0">COMMISSIONI SIMULATE (per ordine, in ${c})</h3>
      <form id="f-comm"><div class="fmsg"></div>
        <label class="fld">Azioni italiane<input name="commission_it" type="number" min="0" max="100" step="0.01" value="${user.commission_it}" required></label>
        <label class="fld">Azioni USA<input name="commission_us" type="number" min="0" max="100" step="0.01" value="${user.commission_us}" required></label>
        <button class="primary" type="submit">SALVA</button></form></div>
    <div class="panel"><h3 style="margin-top:0">CAMBIA PASSWORD</h3>
      <form id="f-pw"><div class="fmsg"></div>
        <label class="fld">Password attuale<input name="current" type="password" autocomplete="current-password" required></label>
        <label class="fld">Nuova password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <button class="primary" type="submit">AGGIORNA</button></form></div>
    <div class="panel"><h3 style="margin-top:0">AZZERA IL CONTO</h3>
      <p class="note">Cancella ordini, posizioni e storico e riparte con un nuovo budget virtuale (anche in un'altra valuta).</p>
      <form id="f-reset-acc"><div class="fmsg"></div>
        <div class="fld row2"><div>Valuta<select name="currency"><option value="EUR"${c === 'EUR' ? ' selected' : ''}>Euro (€)</option><option value="USD"${c === 'USD' ? ' selected' : ''}>Dollaro USA ($)</option></select></div>
        <div>Budget<select name="budget" id="s-budget"></select></div></div>
        <label class="fld">Password per confermare<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="danger" type="submit">AZZERA CONTO</button></form></div>
    <div class="panel"><h3 style="margin-top:0">ELIMINA ACCOUNT</h3>
      <p class="note">Elimina in modo definitivo il tuo account e tutti i dati collegati (ordini, posizioni, storico, email). L'operazione non è reversibile.</p>
      <form id="f-del"><div class="fmsg"></div>
        <label class="fld">Password per confermare<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="danger" type="submit">ELIMINA DEFINITIVAMENTE</button></form></div>
    </div>
    <p style="margin-top:18px"><button id="b-logout">ESCI</button></p>`);
  const sel = $('#s-budget');
  for (let v = 10000; v <= 100000; v += 10000) sel.insertAdjacentHTML('beforeend', `<option value="${v}"${+user.initial_budget === v ? ' selected' : ''}>${num(v, 0)}</option>`);

  bind('#f-comm', async (d, f, box) => {
    const r = await api('update_settings', {commission_it: +d.commission_it, commission_us: +d.commission_us});
    user.commission_it = +d.commission_it; user.commission_us = +d.commission_us;
    box.innerHTML = msg('ok', r.message);
  });
  bind('#f-pw', async (d, f, box) => { const r = await api('change_password', d); f.reset(); box.innerHTML = msg('ok', r.message); });
  bind('#f-reset-acc', async (d, f, box) => {
    if (!confirm('Azzerare il conto? Ordini, posizioni e storico verranno cancellati.')) return;
    const r = await api('reset_account', {currency: d.currency, budget: +d.budget, password: d.password});
    user = (await api('me')).user;
    box.innerHTML = msg('ok', r.message);
  });
  bind('#f-del', async (d, f, box) => {
    if (!confirm('Eliminare DEFINITIVAMENTE il tuo account e tutti i dati? Non si può annullare.')) return;
    await api('delete_account', {password: d.password});
    user = null; await refreshCsrf(); renderChrome(); setView('<div class="authbox"><h2>Account eliminato</h2>' + msg('ok', 'Il tuo account e tutti i dati collegati sono stati eliminati.') + '<div class="links"><a href="#/register">Crea un nuovo account</a></div></div>');
  });
  $('#b-logout').onclick = async () => { try { await api('logout', {}); } catch (e) {} user = null; await refreshCsrf(); go('login'); };
}

// ------------------------------------------------------------------ router
function renderChrome() {
  $('#nav').hidden = !user;
  $('#who').innerHTML = user ? `<b>${esc(user.username)}</b><small>${esc(user.currency)} · DENARO VIRTUALE</small>` : '';
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
