"""Price charts (1Y close + 200D SMA, drawdown highlighted) to attach to the
final report email, giving visual support for the allocator's pick."""

from __future__ import annotations

import tempfile
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless: no display available on a server
import matplotlib.pyplot as plt
import yfinance as yf


def build_price_chart(ticker: str, out_dir: str | Path | None = None) -> str:
    """Render a 1-year price chart with 200D SMA for ``ticker``; return the PNG path."""
    hist = yf.Ticker(ticker).history(period="1y", auto_adjust=True)
    close = hist["Close"]
    sma200 = close.rolling(200).mean()

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(close.index, close.values, label="Close", color="#1f77b4")
    ax.plot(sma200.index, sma200.values, label="200D SMA", color="#ff7f0e", linestyle="--")

    recent_high = close.tail(126).max()
    recent_high_date = close.tail(126).idxmax()
    ax.scatter([recent_high_date], [recent_high], color="green", zorder=5, label="6M high")
    ax.scatter([close.index[-1]], [close.iloc[-1]], color="red", zorder=5, label="Current")

    ax.set_title(f"{ticker} — 1Y price / 200D SMA")
    ax.set_ylabel("Price")
    ax.legend(loc="best", fontsize=8)
    fig.tight_layout()

    out_dir = Path(out_dir) if out_dir else Path(tempfile.gettempdir())
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{ticker}_chart.png"
    fig.savefig(out_path, dpi=120)
    plt.close(fig)
    return str(out_path)


def build_charts(tickers: list[str], out_dir: str | Path | None = None) -> list[str]:
    paths = []
    for ticker in tickers:
        try:
            paths.append(build_price_chart(ticker, out_dir))
        except Exception:
            continue
    return paths
