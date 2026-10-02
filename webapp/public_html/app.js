const VIEWS = {
  essenziale: ['ticker','company','price','pe_ttm','rs_composite','mom_breve','state','delta_1w3w','avwap','eps_yoy','sales_yoy','etf'],
  completa: ['ticker','company','sector','price','pe_ttm','rs_composite','mom_breve','state','delta_1w3w','avwap','avwap_m','avwap_q','avwap_6m','avwap_y',
    'perf_1m','perf_3m','perf_6m','perf_12m','rs_vs_spy','dist_high','dist_low','vs_sma50','vs_sma200','avg_vol','rel_vol','atr_pct','eps_yoy','sales_yoy','etf'],
};
let COLS = VIEWS.essenziale;
const TEXT_COLS = new Set(['ticker','company','sector','state','etf']);
const SIGNED = new Set(['perf_1m','perf_3m','perf_6m','perf_12m','rs_vs_spy','vs_sma50','vs_sma200','delta_1w3w','avwap_m','avwap_q','avwap_6m','avwap_y','eps_yoy','sales_yoy']);
const PCT = new Set(['perf_1m','perf_3m','perf_6m','perf_12m','rs_vs_spy','vs_sma50','vs_sma200','avwap_m','avwap_q','avwap_6m','avwap_y','eps_yoy','sales_yoy','dist_high','dist_low','atr_pct']);
const INT = new Set(['rs_composite','mom_breve','delta_1w3w']);

let rows = [], glossary = {}, sortKey = 'rs_composite', sortDir = -1;
const $ = id => document.getElementById(id);

function fmt(k, v) {
  if (v === null || v === undefined) return '–';
  if (k === 'company' || k === 'state' || v === 'Perdita') return v;
  if (k === 'avwap') return v + '/4';
  if (k === 'price') return '$' + v.toLocaleString('it-IT', {minimumFractionDigits: 2});
  if (k === 'pe_ttm') return v.toLocaleString('it-IT', {minimumFractionDigits: 1}) + 'x';
  if (INT.has(k)) return (k === 'delta_1w3w' && v > 0 ? '+' : '') + v;
  if (typeof v === 'number' && PCT.has(k)) return (SIGNED.has(k) && v > 0 ? '+' : '') + v.toLocaleString('it-IT', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%';
  if (k === 'avg_vol') return v.toLocaleString('it-IT');
  if (typeof v === 'number') return v.toLocaleString('it-IT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return v;
}

function renderHead() {
  $('tbl').tHead.innerHTML = '<tr>' + COLS.map(k =>
    `<th data-k="${k}" class="${TEXT_COLS.has(k) ? 'l' : ''}">${glossary[k]?.label || k}<span class="q" data-k="${k}" title="">ⓘ</span></th>`).join('') + '</tr>';
}

function render() {
  const q = $('f-search').value.trim().toLowerCase();
  const sec = $('f-sector').value;
  const minRs = +$('f-rs').value || 0;
  const p3 = $('f-p3').value, dh = $('f-dh').value;
  const a50 = $('f-50').checked, a200 = $('f-200').checked;

  let out = rows.filter(r =>
    (!q || r.ticker.toLowerCase().includes(q) || (r.company || '').toLowerCase().includes(q)) &&
    (!sec || r.sector === sec) &&
    (r.rs_composite ?? 0) >= minRs &&
    (p3 === '' || (r.perf_3m ?? -1e9) >= +p3) &&
    (dh === '' || (r.dist_high ?? -1e9) >= +dh) &&
    (!a50 || (r.vs_sma50 ?? -1) > 0) &&
    (!a200 || (r.vs_sma200 ?? -1) > 0));

  out.sort((a, b) => {
    const x = a[sortKey], y = b[sortKey];
    if (x == null) return 1; if (y == null) return -1;
    return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sortDir;
  });

  $('count').textContent = `${out.length} titoli`;
  $('tbl').tBodies[0].innerHTML = out.map(r => `<tr data-t="${r.ticker}">` + COLS.map(k => {
    const v = r[k];
    const cls = (TEXT_COLS.has(k) ? 'l ' : '') + (k === 'state' ? (v === 'Migliora' ? 'pos' : v === 'Peggiora' ? 'neg' : '') : v === 'Perdita' ? 'neg' : SIGNED.has(k) && typeof v === 'number' ? (v >= 0 ? 'pos' : 'neg') : '');
    return `<td class="${cls}">${fmt(k, v)}</td>`;
  }).join('') + '</tr>').join('');
}

async function init() {
  [glossary, data] = await Promise.all([
    fetch('glossary.json').then(r => r.json()),
    fetch('data.json?_=' + Date.now()).then(r => r.json()),
  ]);
  rows = data.rows.map(r => ({...r, company: r.name}));
  $('updated').textContent = 'Aggiornato: ' + new Date(data.updated).toLocaleString('it-IT') + ' · benchmark ' + data.benchmark;
  [...new Set(rows.map(r => r.sector).filter(Boolean))].sort()
    .forEach(s => $('f-sector').insertAdjacentHTML('beforeend', `<option>${s}</option>`));
  renderHead(); render();
}
let data;

document.querySelectorAll('#views button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#views button').forEach(x => x.classList.toggle('on', x === b));
  COLS = VIEWS[b.dataset.v]; renderHead(); render();
}));
document.querySelectorAll('.filters input,.filters select').forEach(e => e.addEventListener('input', render));
$('tbl').tHead.addEventListener('click', e => {
  if (e.target.closest('.q')) { showTip(e.target.closest('.q')); e.stopPropagation(); return; }
  const th = e.target.closest('th'); if (!th) return;
  const k = th.dataset.k;
  sortDir = sortKey === k ? -sortDir : (TEXT_COLS.has(k) ? 1 : -1);
  sortKey = k; render();
});

// Tooltip con la definizione del campo
const tip = $('tip');
function showTip(q) {
  tip.textContent = glossary[q.dataset.k]?.text || ''; tip.hidden = false;
  const b = q.getBoundingClientRect();
  tip.style.top = (b.bottom + 6) + 'px';
  tip.style.left = Math.max(8, Math.min(b.left, innerWidth - 340)) + 'px';
}
$('tbl').tHead.addEventListener('mouseover', e => { const q = e.target.closest('.q'); if (q) showTip(q); });
document.addEventListener('click', () => tip.hidden = true);
$('tbl').tHead.addEventListener('mouseout', () => tip.hidden = true);

// Grafico (TradingView Lightweight Charts)
let chart;
const sma = (bars, n) => bars.map((b, i) => i < n - 1 ? null : {time: b.time, value: bars.slice(i - n + 1, i + 1).reduce((s, x) => s + x.close, 0) / n}).filter(Boolean);
async function openChart(t) {
  const row = rows.find(r => r.ticker === t);
  $('m-title').textContent = `${t} ${row?.company ? '· ' + row.name : ''}`;
  $('modal').hidden = false;
  const bars = (await fetch(`hist/${t}.json`).then(r => r.json())).map(([time, open, high, low, close]) => ({time, open, high, low, close}));
  if (chart) chart.remove();
  chart = LightweightCharts.createChart($('chart'), {
    autoSize: true,
    layout: {background: {color: '#151b23'}, textColor: '#8b95a3'},
    grid: {vertLines: {color: '#1d2530'}, horzLines: {color: '#1d2530'}},
    rightPriceScale: {borderColor: '#2b3542'}, timeScale: {borderColor: '#2b3542'},
  });
  chart.addCandlestickSeries({upColor: '#3fb950', downColor: '#f85149', borderVisible: false, wickUpColor: '#3fb950', wickDownColor: '#f85149'}).setData(bars);
  chart.addLineSeries({color: '#58a6ff', lineWidth: 1, priceLineVisible: false}).setData(sma(bars, 50));
  chart.addLineSeries({color: '#d29922', lineWidth: 1, priceLineVisible: false}).setData(sma(bars, 200));
  chart.timeScale().setVisibleLogicalRange({from: Math.max(0, bars.length - 252), to: bars.length + 2});
}
$('tbl').tBodies[0].addEventListener('click', e => {
  const tr = e.target.closest('tr'); if (tr) openChart(tr.dataset.t);
});
$('m-close').onclick = () => $('modal').hidden = true;
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') $('modal').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('modal').hidden = true; });

init();
