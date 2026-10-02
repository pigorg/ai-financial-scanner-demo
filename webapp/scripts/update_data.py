#!/usr/bin/env python3
"""Scarica i prezzi, calcola i campi dello scanner e scrive public_html/data.json.

Pensato per girare da cron (cPanel). Solo indicatori descrittivi calcolati da
prezzi storici e dati di bilancio pubblici: nessuna raccomandazione.
"""
import io
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import yfinance as yf

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "public_html" / "data.json"
HIST = ROOT.parent / "public_html" / "hist"
TICKERS_FILE = ROOT / "tickers.txt"
FUND_CACHE = ROOT / "fund_cache.json"
FUND_TTL = 7 * 86400  # i bilanci cambiano di rado: li rileggo al massimo ogni 7 giorni
BENCHMARK = "SPY"
CHUNK = 80

SECTOR_ETF = {
    "Information Technology": "XLK", "Health Care": "XLV", "Financials": "XLF",
    "Consumer Discretionary": "XLY", "Communication Services": "XLC", "Industrials": "XLI",
    "Consumer Staples": "XLP", "Energy": "XLE", "Utilities": "XLU",
    "Real Estate": "XLRE", "Materials": "XLB",
}
STATE_THRESHOLD = 10  # soglia su Δ 1W-3W per Migliora/Peggiora


def load_universe() -> pd.DataFrame:
    """S&P 500 da Wikipedia; se non raggiungibile, usa tickers.txt (senza nome/settore)."""
    try:
        html = requests.get(
            "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
            headers={"User-Agent": "Mozilla/5.0 rs-scanner"},
            timeout=30,
        ).text
        df = pd.read_html(io.StringIO(html))[0]
        df = df.rename(columns={"Symbol": "ticker", "Security": "name", "GICS Sector": "sector"})
        df["ticker"] = df["ticker"].str.replace(".", "-", regex=False)
        return df[["ticker", "name", "sector"]]
    except Exception as exc:  # noqa: BLE001
        print(f"Wikipedia non disponibile ({exc}); uso tickers.txt", file=sys.stderr)
    tickers = [t.strip().upper() for t in TICKERS_FILE.read_text().split() if t.strip()]
    return pd.DataFrame({"ticker": tickers, "name": "", "sector": ""})


def download(tickers: list[str]) -> dict[str, pd.DataFrame]:
    frames: dict[str, pd.DataFrame] = {}
    for i in range(0, len(tickers), CHUNK):
        part = tickers[i : i + CHUNK]
        raw = yf.download(
            part, period="15mo", auto_adjust=True, group_by="ticker",
            threads=True, progress=False,
        )
        for t in part:
            try:
                df = raw[t] if len(part) > 1 else raw
                df = df.dropna(subset=["Close"])
                if len(df) > 60:
                    frames[t] = df
            except KeyError:
                continue
    return frames


def fetch_fundamentals(tickers: list[str]) -> dict[str, dict]:
    """P/E, crescita EPS e ricavi YoY (ultimo trimestre) da Yahoo, con cache su file."""
    cache: dict[str, dict] = {}
    if FUND_CACHE.exists():
        try:
            cache = json.loads(FUND_CACHE.read_text())
        except ValueError:
            cache = {}
    now = time.time()
    todo = [t for t in tickers if now - cache.get(t, {}).get("ts", 0) > FUND_TTL]

    def one(t: str) -> tuple[str, dict | None]:
        try:
            info = yf.Ticker(t).info
            return t, {
                "ts": now,
                "pe": info.get("trailingPE"),
                "eps": info.get("trailingEps"),
                "eps_g": info.get("earningsQuarterlyGrowth"),
                "rev_g": info.get("revenueGrowth"),
            }
        except Exception:  # noqa: BLE001
            return t, None

    with ThreadPoolExecutor(max_workers=8) as ex:
        for t, d in ex.map(one, todo):
            if d:
                cache[t] = d
    FUND_CACHE.write_text(json.dumps(cache))
    return cache


def pct(close: pd.Series, days: int) -> float | None:
    if len(close) <= days:
        return None
    return float(close.iloc[-1] / close.iloc[-1 - days] - 1) * 100


def r(x, nd=2):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), nd)


def avwap_dist(df: pd.DataFrame, anchor: pd.Timestamp) -> float | None:
    """Distanza % del prezzo dall'AVWAP (VWAP ancorato) calcolato dalla data `anchor`."""
    d = df[df.index >= anchor]
    if len(d) < 1 or d["Volume"].sum() == 0:
        return None
    typical = (d["High"] + d["Low"] + d["Close"]) / 3
    vwap = float((typical * d["Volume"]).sum() / d["Volume"].sum())
    return (float(d["Close"].iloc[-1]) / vwap - 1) * 100


def compute_row(t: str, df: pd.DataFrame, spy_close: pd.Series) -> dict:
    c, h, l, v = df["Close"], df["High"], df["Low"], df["Volume"]
    price = float(c.iloc[-1])
    p5, p10, p15, p1m, p3m, p6m, p9m, p12m = (pct(c, n) for n in (5, 10, 15, 21, 63, 126, 189, 252))

    # RS grezzo: media pesata delle performance 3/6/9/12 mesi (40% sul trimestre recente).
    parts = [(p3m, 0.4), (p6m, 0.2), (p9m, 0.2), (p12m, 0.2)]
    valid = [(p, w) for p, w in parts if p is not None]
    rs_raw = sum(p * w for p, w in valid) / sum(w for _, w in valid) if valid else None
    # Momentum breve grezzo: 1 settimana 50%, 2 settimane 30%, 1 mese 20%.
    sp = [(p5, 0.5), (p10, 0.3), (p1m, 0.2)]
    mom_raw = sum(p * w for p, w in sp if p is not None) if all(p is not None for p, _ in sp) else None

    spy6 = pct(spy_close, 126)
    rs_vs_spy = ((1 + p6m / 100) / (1 + spy6 / 100) - 1) * 100 if p6m is not None and spy6 is not None else None

    hi52, lo52 = float(h.tail(252).max()), float(l.tail(252).min())
    sma50 = float(c.tail(50).mean()) if len(c) >= 50 else None
    sma200 = float(c.tail(200).mean()) if len(c) >= 200 else None
    vol50 = float(v.tail(50).mean())
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)

    last = df.index[-1]
    anchors = {
        "m": last.replace(day=1),
        "q": last.replace(month=3 * ((last.month - 1) // 3) + 1, day=1),
        "6m": df.index[-126] if len(df) >= 126 else df.index[0],
        "y": last.replace(month=1, day=1),
    }
    av = {k: avwap_dist(df, a.normalize()) for k, a in anchors.items()}
    above = sum(1 for x in av.values() if x is not None and x > 0)

    return {
        "ticker": t, "price": r(price),
        "_rs_raw": rs_raw, "_mom_raw": mom_raw, "_p5": p5, "_p15": p15,
        "perf_1m": r(p1m), "perf_3m": r(p3m), "perf_6m": r(p6m), "perf_12m": r(p12m),
        "rs_vs_spy": r(rs_vs_spy),
        "dist_high": r((price / hi52 - 1) * 100), "dist_low": r((price / lo52 - 1) * 100),
        "vs_sma50": r((price / sma50 - 1) * 100) if sma50 else None,
        "vs_sma200": r((price / sma200 - 1) * 100) if sma200 else None,
        "avg_vol": int(vol50), "rel_vol": r(float(v.iloc[-1]) / vol50) if vol50 else None,
        "atr_pct": r(float(tr.tail(14).mean() / price * 100)),
        "avwap": above, "avwap_m": r(av["m"]), "avwap_q": r(av["q"]),
        "avwap_6m": r(av["6m"]), "avwap_y": r(av["y"]),
    }


def rank99(values: dict[str, float | None]) -> dict[str, int]:
    s = pd.Series({k: v for k, v in values.items() if v is not None})
    return (s.rank(pct=True) * 98 + 1).round().astype(int).to_dict()


def main() -> int:
    uni = load_universe()
    tickers = uni["ticker"].tolist()
    frames = download(tickers + [BENCHMARK])
    if BENCHMARK not in frames:
        print("Benchmark SPY non scaricato, abbandono.", file=sys.stderr)
        return 1
    spy_close = frames[BENCHMARK]["Close"]
    meta = uni.set_index("ticker").to_dict("index")

    HIST.mkdir(parents=True, exist_ok=True)
    rows = []
    for t in tickers:
        if t in frames:
            row = compute_row(t, frames[t], spy_close)
            row["name"] = meta[t].get("name", "")
            row["sector"] = meta[t].get("sector", "")
            row["etf"] = SECTOR_ETF.get(row["sector"], "")
            rows.append(row)
            write_hist(t, frames[t])

    # Ranking 1-99 nell'universo
    rs = rank99({x["ticker"]: x["_rs_raw"] for x in rows})
    mom = rank99({x["ticker"]: x["_mom_raw"] for x in rows})
    k5 = rank99({x["ticker"]: x["_p5"] for x in rows})
    k15 = rank99({x["ticker"]: x["_p15"] for x in rows})

    fund = fetch_fundamentals([x["ticker"] for x in rows])
    for x in rows:
        t = x["ticker"]
        x["rs_composite"] = rs.get(t)
        x["mom_breve"] = mom.get(t)
        x["delta_1w3w"] = k5[t] - k15[t] if t in k5 and t in k15 else None
        d = x["delta_1w3w"]
        x["state"] = None if d is None else ("Migliora" if d >= STATE_THRESHOLD else "Peggiora" if d <= -STATE_THRESHOLD else "Stabile")
        f = fund.get(t, {})
        pe = f.get("pe")
        x["pe_ttm"] = r(pe, 1) if pe and pe > 0 else None
        loss = f.get("eps") is not None and f["eps"] < 0
        x["eps_yoy"] = "Perdita" if loss else (r(f["eps_g"] * 100, 1) if f.get("eps_g") is not None else None)
        x["sales_yoy"] = r(f["rev_g"] * 100, 1) if f.get("rev_g") is not None else None
        for k in ("_rs_raw", "_mom_raw", "_p5", "_p15"):
            del x[k]

    rows.sort(key=lambda x: (x["rs_composite"] is None, -(x["rs_composite"] or 0)))
    payload = {
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "market_date": spy_close.index[-1].strftime("%Y-%m-%d"),
        "benchmark": BENCHMARK, "count": len(rows), "rows": rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(OUT)
    print(f"OK: {len(rows)} titoli -> {OUT}")
    return 0


def write_hist(t: str, df: pd.DataFrame) -> None:
    """Storico giornaliero (ultimi ~15 mesi) per il grafico, in formato compatto."""
    d = df.dropna(subset=["Close"])
    bars = [
        [i.strftime("%Y-%m-%d"), round(float(o), 2), round(float(h), 2), round(float(l), 2), round(float(c), 2), int(v)]
        for i, o, h, l, c, v in zip(d.index, d["Open"], d["High"], d["Low"], d["Close"], d["Volume"].fillna(0))
    ]
    (HIST / f"{t}.json").write_text(json.dumps(bars, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
