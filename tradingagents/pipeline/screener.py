"""Agent 1: quantitative screener (no LLM).

Filters the configured basket down to the top N tickers that combine solid
fundamentals with a recent, non-structural price dip: still above its 200-day
average (rules out a stock in freefall) but down meaningfully from its
6-month high (the "dip" to buy).
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

import yfinance as yf

from tradingagents.pipeline import config


@dataclass
class ScreenResult:
    ticker: str
    score: float
    price: float
    drawdown: float
    roe: float | None
    debt_to_equity: float | None
    revenue_growth: float | None
    reasons: list[str]


def _screen_one(ticker: str) -> ScreenResult | None:
    tk = yf.Ticker(ticker)
    info = tk.info
    hist = tk.history(period="1y", auto_adjust=True)
    if hist.empty or len(hist) < 60:
        return None

    close = hist["Close"]
    price = float(close.iloc[-1])
    recent_high = float(close.tail(126).max())  # ~6 months of trading days
    drawdown = (recent_high - price) / recent_high if recent_high else 0.0

    sma200 = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else float(close.mean())
    if price < sma200 * 0.85:
        return None  # not a dip, a structural downtrend

    if not (config.SCREENER_MIN_DIP <= drawdown <= config.SCREENER_MAX_DIP):
        return None

    roe = info.get("returnOnEquity")
    debt_to_equity = info.get("debtToEquity")
    revenue_growth = info.get("revenueGrowth")
    free_cashflow = info.get("freeCashflow")

    reasons = []
    if roe is None or roe < config.SCREENER_MIN_ROE:
        return None
    reasons.append(f"ROE {roe:.1%}")

    if debt_to_equity is not None and debt_to_equity > config.SCREENER_MAX_DEBT_TO_EQUITY:
        return None
    if debt_to_equity is not None:
        reasons.append(f"D/E {debt_to_equity:.0f}%")

    if revenue_growth is not None and revenue_growth < 0:
        return None
    if revenue_growth is not None:
        reasons.append(f"revenue growth {revenue_growth:.1%}")

    if free_cashflow is not None and free_cashflow <= 0:
        return None

    reasons.append(f"drawdown {drawdown:.1%} from 6M high, still above 200D SMA")

    score = roe + drawdown * 0.5 + (revenue_growth or 0.0) * 0.5
    return ScreenResult(
        ticker=ticker,
        score=score,
        price=price,
        drawdown=drawdown,
        roe=roe,
        debt_to_equity=debt_to_equity,
        revenue_growth=revenue_growth,
        reasons=reasons,
    )


def run_screener(basket: list[str] | None = None, top_n: int | None = None) -> list[ScreenResult]:
    """Score every ticker in the basket in parallel and return the top N survivors."""
    basket = basket or config.PIPELINE_BASKET
    top_n = top_n or config.SCREENER_TOP_N

    results: list[ScreenResult] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_screen_one, t): t for t in basket}
        for future in as_completed(futures):
            try:
                result = future.result()
            except Exception:
                result = None
            if result is not None:
                results.append(result)

    results.sort(key=lambda r: r.score, reverse=True)
    return results[:top_n]
