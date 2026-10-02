const VIEWS = {
  essenziale: ['ticker','company','price','pe_ttm','rs_composite','mom_breve','state','delta_1w3w','avwap','eps_yoy','sales_yoy','etf'],
  completa: ['ticker','company','sector','price','pe_ttm','rs_composite','mom_breve','state','delta_1w3w','avwap','avwap_m','avwap_q','avwap_6m','avwap_y',
    'perf_1m','perf_3m','perf_6m','perf_12m','rs_vs_spy','dist_high','dist_low','vs_sma50','vs_sma200','avg_vol','rel_vol','atr_pct','eps_yoy','sales_yoy','etf'],
};
let COLS = VIEWS.essenziale;
const TEXT_COLS = new Set(['ticker','company','sector','etf']);
const SIGNED = new Set(['perf_1m','perf_3m','perf_6m','perf_12m','rs_vs_spy','vs_sma50','vs_sma200','delta_1w3w','avwap_m','avwap_q','avwap_6m','avwap_y','eps_yoy','sales_yoy']);
const PCT = new Set([...SIGNED, 'dist_high','dist_low','atr_pct']);
PCT.delete('delta_1w3w');
const INT = new Set(['rs_composite','mom_breve','delta_1w3w']);
const SCORE = new Set(['rs_composite','mom_breve']);

let rows = [], glossary = {}, data, sortKey = 'rs_composite', sortDir = -1;
let filters = {};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function fmt(k, v) {
  if (v === null || v === undefined) return '—';
  if (k === 'company' || k === 'state' || typeof v === 'string') return esc(v);
  if (k === 'avwap') return v + '/4';
  if (k === 'price') return '$' + v.toLocaleString('en-US', {minimumFractionDigits: 2});
  if (k === 'pe_ttm') return v.toLocaleString('en-US', {minimumFractionDigits: 1}) + 'x';
  if (INT.has(k)) return (k === 'delta_1w3w' && v > 0 ? '+' : '') + v;
  if (PCT.has(k)) return (SIGNED.has(k) && v > 0 ? '+' : '') + v.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%';
  if (k === 'avg_vol') return v.toLocaleString('en-US');
  return v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function cellClass(k, v) {
  if (v === 'Perdita') return 'neg';
  if (v == null) return '';
  if (k === 'state') return v === 'Migliora' ? 'pos' : v === 'Peggiora' ? 'org' : '';
  if (SCORE.has(k)) return v >= 70 ? 'pos' : v >= 40 ? 'amb' : 'neg';
  if (k === 'avwap') return v >= 3 ? 'pos' : v >= 2 ? '' : 'org';
  if (SIGNED.has(k) && typeof v === 'number') return v >= 0 ? 'pos' : 'neg';
  return '';
}

function renderHead() {
  $('tbl').tHead.innerHTML = '<tr><th class="ic"></th>' + COLS.map(k =>
    `<th data-k="${k}" class="${TEXT_COLS.has(k) ? 'l' : ''}${k === sortKey ? ' sorted' : ''}">${esc(glossary[k]?.label || k)}${k === sortKey ? (sortDir < 0 ? ' ↓' : ' ↑') : ''}<span class="q" data-k="${k}">ⓘ</span></th>`).join('') + '</tr>';
  const sel = $('sort-by');
  sel.innerHTML = COLS.map(k => `<option value="${k}">${esc(glossary[k]?.label || k)}</option>`).join('');
  sel.value = COLS.includes(sortKey) ? sortKey : COLS[0];
}

function readFilters() {
  const n = id => $(id).value === '' ? null : +$(id).value;
  filters = {
    sector: $('f-sector').value, state: $('f-state').value,
    rs: n('f-rs'), mom: n('f-mom'), avwap: n('f-avwap'), dh: n('f-dh'), eps: n('f-eps'), sales: n('f-sales'),
    a50: $('f-50').checked, a200: $('f-200').checked, noloss: $('f-noloss').checked,
  };
  const active = Object.values(filters).filter(v => v !== null && v !== '' && v !== false).length;
  $('n-filters').textContent = active;
}

function filtered() {
  const q = $('f-search').value.trim().toLowerCase(), f = filters;
  const ge = (v, min) => min === null || (v != null && typeof v === 'number' && v >= min);
  return rows.filter(r =>
    (!q || r.ticker.toLowerCase().includes(q) || (r.company || '').toLowerCase().includes(q)) &&
    (!f.sector || r.sector === f.sector) && (!f.state || r.state === f.state) &&
    ge(r.rs_composite, f.rs) && ge(r.mom_breve, f.mom) && ge(r.avwap, f.avwap) && ge(r.dist_high, f.dh) &&
    ge(r.eps_yoy, f.eps) && ge(r.sales_yoy, f.sales) &&
    (!f.a50 || (r.vs_sma50 ?? -1) > 0) && (!f.a200 || (r.vs_sma200 ?? -1) > 0) &&
    (!f.noloss || r.eps_yoy !== 'Perdita'));
}

function sorted(list) {
  return list.sort((a, b) => {
    const x = a[sortKey], y = b[sortKey];
    if (x == null) return 1; if (y == null) return -1;
    if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y)) * sortDir;
    return (x - y) * sortDir;
  });
}

let shown = [];
function render() {
  shown = sorted(filtered());
  $('count').textContent = `${shown.length} TITOLI`;
  $('tbl').tBodies[0].innerHTML = shown.map(r => `<tr><td class="ic"><button class="chartbtn" data-t="${esc(r.ticker)}" title="Apri il grafico di ${esc(r.ticker)}" aria-label="Apri il grafico di ${esc(r.ticker)}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg></button></td>` + COLS.map(k => {
    const v = r[k];
    const cls = [TEXT_COLS.has(k) ? 'l' : '', k === 'ticker' ? 'tk' : '', k === 'company' ? 'co' : '', cellClass(k, v)].join(' ');
    return `<td class="${cls}">${fmt(k, v)}</td>`;
  }).join('') + '</tr>').join('');
  renderHead();
}

function renderKpis() {
  const n = rows.length, c = f => rows.filter(f).length;
  const lead = c(r => r.rs_composite >= 80), imp = c(r => r.state === 'Migliora'), av4 = c(r => r.avwap === 4);
  const gro = c(r => typeof r.eps_yoy === 'number' && r.eps_yoy >= 25 && r.sales_yoy >= 20);
  const p = x => (x / n * 100).toFixed(1).replace('.', ',') + '%';
  const d = data.market_date ? data.market_date.split('-').reverse().join('/') : new Date(data.updated).toLocaleDateString('it-IT');
  const card = (t, v, desc, cls = '') => `<div class="kpi"><div class="t">${t}</div><div class="v ${cls}">${v}</div><div class="d">${desc}</div></div>`;
  $('kpis').innerHTML =
    card('LEADERSHIP', lead, `RS COMPOSITE ≥ 80 · ${p(lead)}`) +
    card('IN MIGLIORAMENTO', imp, `STATE = MIGLIORA · ${p(imp)}`) +
    card('AVWAP 4/4', av4, 'PREZZO SOPRA TUTTI E 4 GLI AVWAP') +
    card('GROWTH', gro, 'EPS YoY ≥ 25 · SALES YoY ≥ 20') +
    card('MARKET DATE', d, 'EOD', 'sm') +
    card('UNIVERSE', n.toLocaleString('it-IT'), 'TITOLI SCANSIONATI');
}

function renderGuide() {
  $('guide-list').innerHTML = VIEWS.completa.map(k => `<div class="gi"><b>${esc(glossary[k]?.label || k)}</b><p>${esc(glossary[k]?.text || '')}</p></div>`).join('');
}

function tick() {
  const now = new Date(), tz = 'America/New_York';
  $('clock').textContent = now.toLocaleTimeString('en-GB', {timeZone: tz}) + ' ET';
  $('mdate').textContent = now.toLocaleDateString('it-IT', {timeZone: tz});
}

async function init() {
  [glossary, data] = await Promise.all([
    fetch('glossary.json').then(r => r.json()),
    fetch('data.json?_=' + Date.now()).then(r => r.json()),
  ]);
  rows = data.rows.map(r => ({...r, company: r.name}));
  $('updated').textContent = 'AGGIORNATO: ' + new Date(data.updated).toLocaleString('it-IT') + ' · BENCHMARK ' + data.benchmark;
  $('n-univ').textContent = rows.length.toLocaleString('it-IT');
  [...new Set(rows.map(r => r.sector).filter(Boolean))].sort()
    .forEach(s => $('f-sector').insertAdjacentHTML('beforeend', `<option>${esc(s)}</option>`));
  readFilters(); renderKpis(); renderGuide(); render();
}

// Filtri
$('apply').onclick = () => { readFilters(); render(); };
$('reset').onclick = () => {
  document.querySelectorAll('.side input,.side select').forEach(e => e.type === 'checkbox' ? e.checked = false : e.value = '');
  $('f-search').value = ''; readFilters(); render();
};
document.querySelectorAll('.side input').forEach(e => e.addEventListener('keydown', ev => { if (ev.key === 'Enter') $('apply').click(); }));
$('f-search').addEventListener('input', render);

// Viste, ordinamento, nav
document.querySelectorAll('.vt').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.vt').forEach(x => x.classList.toggle('on', x === b));
  COLS = VIEWS[b.dataset.v]; if (!COLS.includes(sortKey)) sortKey = 'ticker'; render();
}));
$('sort-by').addEventListener('change', e => { sortKey = e.target.value; sortDir = TEXT_COLS.has(sortKey) ? 1 : -1; render(); });
$('tbl').tHead.addEventListener('click', e => {
  const q = e.target.closest('.q');
  if (q) { showTip(q); e.stopPropagation(); return; }
  const th = e.target.closest('th'); if (!th) return;
  const k = th.dataset.k;
  sortDir = sortKey === k ? -sortDir : (TEXT_COLS.has(k) ? 1 : -1);
  sortKey = k; render();
});
$('nav').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#nav button').forEach(x => x.classList.toggle('on', x === b));
  $('page-scanner').hidden = b.dataset.page !== 'scanner';
  $('page-guida').hidden = b.dataset.page !== 'guida';
});

// Esporta CSV (righe filtrate, colonne della vista corrente)
$('export').onclick = () => {
  const cell = v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
  const csv = [COLS.map(k => cell(glossary[k]?.label || k)).join(',')]
    .concat(shown.map(r => COLS.map(k => cell(r[k])).join(','))).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], {type: 'text/csv;charset=utf-8'}));
  a.download = 'rs-scanner.csv'; a.click(); URL.revokeObjectURL(a.href);
};

// Tooltip con la definizione del campo (icona ⓘ)
const tip = $('tip');
function showTip(q) {
  tip.textContent = glossary[q.dataset.k]?.text || ''; tip.hidden = false;
  const b = q.getBoundingClientRect();
  tip.style.top = (b.bottom + 8) + 'px';
  tip.style.left = Math.max(8, Math.min(b.left - 20, innerWidth - 360)) + 'px';
}
$('tbl').tHead.addEventListener('mouseover', e => { const q = e.target.closest('.q'); if (q) showTip(q); });
$('tbl').tHead.addEventListener('mouseout', () => tip.hidden = true);
document.addEventListener('click', () => tip.hidden = true);

// Grafico (TradingView Lightweight Charts)
let chart;
const sma = (bars, n) => bars.map((b, i) => i < n - 1 ? null : {time: b.time, value: bars.slice(i - n + 1, i + 1).reduce((s, x) => s + x.close, 0) / n}).filter(Boolean);
async function openChart(t) {
  const row = rows.find(r => r.ticker === t);
  $('m-title').textContent = `${t}${row?.company ? ' · ' + row.company : ''}`;
  $('modal').hidden = false;
  const bars = (await fetch(`hist/${t}.json`).then(r => r.json())).map(([time, open, high, low, close]) => ({time, open, high, low, close}));
  if (chart) chart.remove();
  chart = LightweightCharts.createChart($('chart'), {
    autoSize: true,
    layout: {background: {color: '#0a141d'}, textColor: '#7b8d9b'},
    grid: {vertLines: {color: '#102431'}, horzLines: {color: '#102431'}},
    rightPriceScale: {borderColor: '#1b3f52'}, timeScale: {borderColor: '#1b3f52'},
  });
  chart.addCandlestickSeries({upColor: '#2fe08a', downColor: '#ff5a4d', borderVisible: false, wickUpColor: '#2fe08a', wickDownColor: '#ff5a4d'}).setData(bars);
  chart.addLineSeries({color: '#58a6ff', lineWidth: 1, priceLineVisible: false}).setData(sma(bars, 50));
  chart.addLineSeries({color: '#d29922', lineWidth: 1, priceLineVisible: false}).setData(sma(bars, 200));
  chart.timeScale().setVisibleLogicalRange({from: Math.max(0, bars.length - 252), to: bars.length + 2});
}
$('tbl').tBodies[0].addEventListener('click', e => { const b = e.target.closest('.chartbtn'); if (b) openChart(b.dataset.t); });
$('m-close').onclick = () => $('modal').hidden = true;
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') $('modal').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('modal').hidden = true; });

tick(); setInterval(tick, 1000);
init();
