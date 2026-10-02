<?php
/**
 * Equivalente PHP di update_data.py: scarica i prezzi, calcola i campi dello scanner
 * e scrive public_html/data.json + public_html/hist/*.json.
 * Pensato per il cron di cPanel (solo CLI). Solo indicatori descrittivi: nessuna raccomandazione.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }
set_time_limit(0);
error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('memory_limit', '512M');
date_default_timezone_set('UTC');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const BENCHMARK = 'SPY';
const PARALLEL = 8;
const FUND_TTL = 7 * 86400;
const MAX_BARS = 316;          // ~15 mesi di sedute
const STATE_THRESHOLD = 10;

$ROOT = __DIR__;
$PUBLIC = $ROOT . '/../public_html';
$HIST = $PUBLIC . '/hist';
$OUT = $PUBLIC . '/data.json';
$FUND_CACHE = $ROOT . '/fund_cache.json';

$SECTOR_ETF = [
    'Information Technology' => 'XLK', 'Health Care' => 'XLV', 'Financials' => 'XLF',
    'Consumer Discretionary' => 'XLY', 'Communication Services' => 'XLC', 'Industrials' => 'XLI',
    'Consumer Staples' => 'XLP', 'Energy' => 'XLE', 'Utilities' => 'XLU',
    'Real Estate' => 'XLRE', 'Materials' => 'XLB',
];

function logm(string $m): void { fwrite(STDERR, '[' . gmdate('H:i:s') . '] ' . $m . "\n"); }

/** Scarica più URL in parallelo a blocchi. $reqs: chiave => url. Ritorna chiave => [code, body]. */
function fetch_all(array $reqs, ?string $cookieFile = null, int $parallel = PARALLEL): array {
    $results = [];
    foreach (array_chunk($reqs, $parallel, true) as $chunk) {
        $mh = curl_multi_init();
        $handles = [];
        foreach ($chunk as $key => $url) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 40,
                CURLOPT_CONNECTTIMEOUT => 15, CURLOPT_USERAGENT => UA, CURLOPT_ENCODING => '',
            ]);
            if ($cookieFile) curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
            curl_multi_add_handle($mh, $ch);
            $handles[$key] = $ch;
        }
        do {
            $status = curl_multi_exec($mh, $running);
            if ($running) curl_multi_select($mh, 1.0);
        } while ($running && $status === CURLM_OK);
        foreach ($handles as $key => $ch) {
            $results[$key] = [curl_getinfo($ch, CURLINFO_HTTP_CODE), (string)curl_multi_getcontent($ch)];
            curl_multi_remove_handle($mh, $ch);
            if (PHP_VERSION_ID < 80000) curl_close($ch);
        }
        curl_multi_close($mh);
    }
    return $results;
}

function http_get(string $url, ?string $cookieJar = null): string {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 40,
        CURLOPT_USERAGENT => UA, CURLOPT_ENCODING => '',
    ]);
    if ($cookieJar) { curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieJar); curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieJar); }
    $body = curl_exec($ch);
    if (PHP_VERSION_ID < 80000) curl_close($ch);
    return $body === false ? '' : (string)$body;
}

/** S&P 500 da Wikipedia; in alternativa tickers.txt (senza nome/settore). */
function load_universe(string $root): array {
    $html = http_get('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies');
    $uni = [];
    if ($html !== '') {
        $dom = new DOMDocument();
        @$dom->loadHTML('<?xml encoding="UTF-8">' . $html);
        $xp = new DOMXPath($dom);
        foreach ($xp->query("//table[@id='constituents']//tr") as $tr) {
            $tds = $xp->query('./td', $tr);
            if ($tds->length < 3) continue;
            $uni[] = [
                'ticker' => str_replace('.', '-', trim($tds->item(0)->textContent)),
                'name' => trim($tds->item(1)->textContent),
                'sector' => trim($tds->item(2)->textContent),
            ];
        }
    }
    if (count($uni) < 400) {
        logm('Wikipedia non disponibile: uso tickers.txt');
        $uni = [];
        foreach (preg_split('/\s+/', trim((string)@file_get_contents($root . '/tickers.txt'))) as $t) {
            if ($t !== '') $uni[] = ['ticker' => strtoupper($t), 'name' => '', 'sector' => ''];
        }
    }
    return $uni;
}

/** Barre giornaliere aggiustate (come yfinance auto_adjust). */
function parse_chart(string $body): ?array {
    $j = json_decode($body, true);
    $res = $j['chart']['result'][0] ?? null;
    if (!$res || empty($res['timestamp'])) return null;
    $off = (int)($res['meta']['gmtoffset'] ?? 0);
    $q = $res['indicators']['quote'][0] ?? [];
    $adj = $res['indicators']['adjclose'][0]['adjclose'] ?? null;
    $b = ['d' => [], 'o' => [], 'h' => [], 'l' => [], 'c' => [], 'v' => []];
    foreach ($res['timestamp'] as $i => $ts) {
        $c = $q['close'][$i] ?? null; $o = $q['open'][$i] ?? null;
        $h = $q['high'][$i] ?? null; $l = $q['low'][$i] ?? null;
        if ($c === null || $o === null || $h === null || $l === null) continue;
        $f = ($adj !== null && isset($adj[$i]) && $c > 0) ? $adj[$i] / $c : 1.0;
        $b['d'][] = gmdate('Y-m-d', $ts + $off);
        $b['o'][] = $o * $f; $b['h'][] = $h * $f; $b['l'][] = $l * $f; $b['c'][] = $c * $f;
        $b['v'][] = (float)($q['volume'][$i] ?? 0);
    }
    $n = count($b['c']);
    if ($n < 61) return null;
    if ($n > MAX_BARS) foreach ($b as $k => $v) $b[$k] = array_slice($v, -MAX_BARS);
    return $b;
}

function r($x, int $nd = 2) { return ($x === null || !is_finite((float)$x)) ? null : round((float)$x, $nd); }
function mean(array $a): float { return array_sum($a) / count($a); }
function tail(array $a, int $n): array { return array_slice($a, -$n); }
function pct(array $c, int $days): ?float {
    $n = count($c);
    if ($n <= $days) return null;
    return ($c[$n - 1] / $c[$n - 1 - $days] - 1) * 100;
}

function avwap_dist(array $b, string $anchor): ?float {
    $pv = 0.0; $vol = 0.0; $cnt = 0;
    foreach ($b['d'] as $i => $d) {
        if ($d < $anchor) continue;
        $pv += (($b['h'][$i] + $b['l'][$i] + $b['c'][$i]) / 3) * $b['v'][$i];
        $vol += $b['v'][$i]; $cnt++;
    }
    if ($cnt < 1 || $vol == 0) return null;
    return (end($b['c']) / ($pv / $vol) - 1) * 100;
}

function compute_row(string $t, array $b, array $spyClose): array {
    $c = $b['c']; $h = $b['h']; $l = $b['l']; $v = $b['v'];
    $n = count($c);
    $price = $c[$n - 1];
    $p5 = pct($c, 5); $p10 = pct($c, 10); $p15 = pct($c, 15); $p1m = pct($c, 21);
    $p3m = pct($c, 63); $p6m = pct($c, 126); $p9m = pct($c, 189); $p12m = pct($c, 252);

    $sw = 0; $sp = 0;
    foreach ([[$p3m, .4], [$p6m, .2], [$p9m, .2], [$p12m, .2]] as [$p, $w]) if ($p !== null) { $sp += $p * $w; $sw += $w; }
    $rsRaw = $sw > 0 ? $sp / $sw : null;
    $momRaw = ($p5 !== null && $p10 !== null && $p1m !== null) ? $p5 * .5 + $p10 * .3 + $p1m * .2 : null;

    $spy6 = pct($spyClose, 126);
    $rsVsSpy = ($p6m !== null && $spy6 !== null) ? ((1 + $p6m / 100) / (1 + $spy6 / 100) - 1) * 100 : null;

    $hi52 = max(tail($h, 252)); $lo52 = min(tail($l, 252));
    $sma50 = $n >= 50 ? mean(tail($c, 50)) : null;
    $sma200 = $n >= 200 ? mean(tail($c, 200)) : null;
    $vol50 = mean(tail($v, 50));
    $trs = [];
    for ($i = max(1, $n - 14); $i < $n; $i++) {
        $trs[] = max($h[$i] - $l[$i], abs($h[$i] - $c[$i - 1]), abs($l[$i] - $c[$i - 1]));
    }
    $atr = mean($trs) / $price * 100;

    $last = $b['d'][$n - 1];
    [$Y, $M] = [(int)substr($last, 0, 4), (int)substr($last, 5, 2)];
    $anchors = [
        'm' => sprintf('%04d-%02d-01', $Y, $M),
        'q' => sprintf('%04d-%02d-01', $Y, 3 * intdiv($M - 1, 3) + 1),
        '6m' => $b['d'][$n >= 126 ? $n - 126 : 0],
        'y' => sprintf('%04d-01-01', $Y),
    ];
    $av = []; $above = 0;
    foreach ($anchors as $k => $a) { $av[$k] = avwap_dist($b, $a); if ($av[$k] !== null && $av[$k] > 0) $above++; }

    return [
        'ticker' => $t, 'price' => r($price),
        '_rs_raw' => $rsRaw, '_mom_raw' => $momRaw, '_p5' => $p5, '_p15' => $p15,
        'perf_1m' => r($p1m), 'perf_3m' => r($p3m), 'perf_6m' => r($p6m), 'perf_12m' => r($p12m),
        'rs_vs_spy' => r($rsVsSpy),
        'dist_high' => r(($price / $hi52 - 1) * 100), 'dist_low' => r(($price / $lo52 - 1) * 100),
        'vs_sma50' => $sma50 ? r(($price / $sma50 - 1) * 100) : null,
        'vs_sma200' => $sma200 ? r(($price / $sma200 - 1) * 100) : null,
        'avg_vol' => (int)$vol50, 'rel_vol' => $vol50 ? r($v[$n - 1] / $vol50) : null,
        'atr_pct' => r($atr),
        'avwap' => $above, 'avwap_m' => r($av['m']), 'avwap_q' => r($av['q']),
        'avwap_6m' => r($av['6m']), 'avwap_y' => r($av['y']),
    ];
}

/** Classifica percentile 1-99 (rango medio sui pari merito, come pandas rank(pct=True)). */
function rank99(array $vals): array {
    $vals = array_filter($vals, fn($x) => $x !== null);
    $n = count($vals);
    if ($n === 0) return [];
    asort($vals);
    $keys = array_keys($vals); $v = array_values($vals);
    $out = [];
    for ($i = 0; $i < $n;) {
        $j = $i;
        while ($j + 1 < $n && $v[$j + 1] == $v[$i]) $j++;
        $avg = ($i + $j) / 2 + 1;
        for ($k = $i; $k <= $j; $k++) $out[$keys[$k]] = (int)round($avg / $n * 98 + 1);
        $i = $j + 1;
    }
    return $out;
}

/** P/E, EPS e ricavi YoY da Yahoo (cookie + crumb), con cache su file. */
function fetch_fundamentals(array $tickers, string $cacheFile): array {
    $cache = [];
    if (is_file($cacheFile)) $cache = json_decode((string)file_get_contents($cacheFile), true) ?: [];
    $now = time();
    $todo = array_values(array_filter($tickers, fn($t) => $now - ($cache[$t]['ts'] ?? 0) > FUND_TTL));
    if (!$todo) return $cache;

    $jar = sys_get_temp_dir() . '/yf_cookie_' . getmypid() . '.txt';
    http_get('https://fc.yahoo.com', $jar);
    $crumb = trim(http_get('https://query1.finance.yahoo.com/v1/test/getcrumb', $jar));
    if ($crumb === '' || stripos($crumb, '<') !== false || stripos($crumb, 'Too Many') !== false) {
        logm('Crumb Yahoo non ottenuto: bilanci dalla cache, se presente');
        @unlink($jar);
        return $cache;
    }
    $reqs = [];
    foreach ($todo as $t) {
        $reqs[$t] = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' . rawurlencode($t)
            . '?modules=summaryDetail,defaultKeyStatistics,financialData&crumb=' . rawurlencode($crumb);
    }
    foreach (fetch_all($reqs, $jar) as $t => [$code, $body]) {
        if ($code !== 200) continue;
        $res = json_decode($body, true)['quoteSummary']['result'][0] ?? null;
        if (!$res) continue;
        $cache[$t] = [
            'ts' => $now,
            'pe' => $res['summaryDetail']['trailingPE']['raw'] ?? null,
            'eps' => $res['defaultKeyStatistics']['trailingEps']['raw'] ?? null,
            'eps_g' => $res['defaultKeyStatistics']['earningsQuarterlyGrowth']['raw'] ?? null,
            'rev_g' => $res['financialData']['revenueGrowth']['raw'] ?? null,
        ];
    }
    @unlink($jar);
    file_put_contents($cacheFile, json_encode($cache));
    return $cache;
}

// ---------------------------------------------------------------- main
$uni = load_universe($ROOT);
$meta = [];
foreach ($uni as $u) $meta[$u['ticker']] = $u;
$tickers = array_keys($meta);
logm(count($tickers) . ' titoli nell\'universo');

$reqs = [];
foreach (array_merge($tickers, [BENCHMARK]) as $t) {
    $reqs[$t] = 'https://query1.finance.yahoo.com/v8/finance/chart/' . rawurlencode($t) . '?range=2y&interval=1d&events=div%2Csplit';
}
$bars = [];
$res = fetch_all($reqs);
foreach ($res as $t => [$code, $body]) {
    $b = $code === 200 ? parse_chart($body) : null;
    if ($b) $bars[$t] = $b; else $failed[] = $t;
}
// secondo tentativo per i fallimenti (rate limit)
if (!empty($failed)) {
    logm(count($failed) . ' download falliti, riprovo');
    sleep(3);
    $retry = [];
    foreach ($failed as $t) $retry[$t] = $reqs[$t];
    foreach (fetch_all($retry, null, 3) as $t => [$code, $body]) {
        $b = $code === 200 ? parse_chart($body) : null;
        if ($b) $bars[$t] = $b;
    }
}
if (!isset($bars[BENCHMARK])) { logm('Benchmark SPY non scaricato, abbandono.'); exit(1); }
$spyClose = $bars[BENCHMARK]['c'];

if (!is_dir($HIST)) mkdir($HIST, 0755, true);
$rows = [];
foreach ($tickers as $t) {
    if (!isset($bars[$t])) continue;
    $row = compute_row($t, $bars[$t], $spyClose);
    $row['name'] = $meta[$t]['name'];
    $row['sector'] = $meta[$t]['sector'];
    $row['etf'] = $SECTOR_ETF[$meta[$t]['sector']] ?? '';
    $rows[] = $row;

    $b = $bars[$t]; $hist = [];
    foreach ($b['d'] as $i => $d) {
        $hist[] = [$d, round($b['o'][$i], 2), round($b['h'][$i], 2), round($b['l'][$i], 2), round($b['c'][$i], 2), (int)$b['v'][$i]];
    }
    file_put_contents($HIST . '/' . $t . '.json', json_encode($hist));
}
if (count($rows) < 50) { logm('Troppi pochi titoli scaricati (' . count($rows) . '), non sovrascrivo data.json'); exit(1); }

$rs = rank99(array_column($rows, '_rs_raw', 'ticker'));
$mom = rank99(array_column($rows, '_mom_raw', 'ticker'));
$k5 = rank99(array_column($rows, '_p5', 'ticker'));
$k15 = rank99(array_column($rows, '_p15', 'ticker'));
$fund = fetch_fundamentals(array_column($rows, 'ticker'), $FUND_CACHE);

foreach ($rows as &$x) {
    $t = $x['ticker'];
    $x['rs_composite'] = $rs[$t] ?? null;
    $x['mom_breve'] = $mom[$t] ?? null;
    $x['delta_1w3w'] = (isset($k5[$t], $k15[$t])) ? $k5[$t] - $k15[$t] : null;
    $d = $x['delta_1w3w'];
    $x['state'] = $d === null ? null : ($d >= STATE_THRESHOLD ? 'Migliora' : ($d <= -STATE_THRESHOLD ? 'Peggiora' : 'Stabile'));
    $f = $fund[$t] ?? [];
    $pe = $f['pe'] ?? null;
    $x['pe_ttm'] = ($pe && $pe > 0) ? r($pe, 1) : null;
    $loss = isset($f['eps']) && $f['eps'] < 0;
    $x['eps_yoy'] = $loss ? 'Perdita' : (isset($f['eps_g']) ? r($f['eps_g'] * 100, 1) : null);
    $x['sales_yoy'] = isset($f['rev_g']) ? r($f['rev_g'] * 100, 1) : null;
    unset($x['_rs_raw'], $x['_mom_raw'], $x['_p5'], $x['_p15']);
}
unset($x);

usort($rows, function ($a, $b) {
    if ($a['rs_composite'] === null) return 1;
    if ($b['rs_composite'] === null) return -1;
    return $b['rs_composite'] <=> $a['rs_composite'];
});

$payload = [
    'updated' => gmdate('Y-m-d\TH:i:sP'),
    'market_date' => end($bars[BENCHMARK]['d']),
    'benchmark' => BENCHMARK, 'count' => count($rows), 'rows' => $rows,
];
$tmp = $OUT . '.tmp';
file_put_contents($tmp, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
rename($tmp, $OUT);
echo 'OK: ' . count($rows) . " titoli -> $OUT\n";
