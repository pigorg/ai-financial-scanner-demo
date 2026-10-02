"""Tests for the Agent-1 quantitative screener (no network, no LLM)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pandas as pd
import pytest

from tradingagents.pipeline import screener


def _make_history(prices: list[float]) -> pd.DataFrame:
    idx = pd.date_range("2025-01-01", periods=len(prices), freq="D")
    return pd.DataFrame({"Close": prices}, index=idx)


def _fake_ticker(info: dict, prices: list[float]):
    return SimpleNamespace(info=info, history=lambda **kw: _make_history(prices))


def _good_fundamentals(**overrides):
    base = {
        "returnOnEquity": 0.25,
        "debtToEquity": 40.0,
        "revenueGrowth": 0.10,
        "freeCashflow": 1_000_000,
    }
    base.update(overrides)
    return base


@pytest.mark.unit
def test_screens_out_low_roe():
    # Flat 300-day history so SMA/drawdown checks pass; ROE below threshold fails.
    prices = [100.0] * 300
    fake = _fake_ticker(_good_fundamentals(returnOnEquity=0.02), prices)
    with patch.object(screener.yf, "Ticker", return_value=fake):
        assert screener._screen_one("XYZ") is None


@pytest.mark.unit
def test_screens_out_structural_downtrend():
    # Deep, sustained decline: price ends far below its 200D SMA -> not a "dip".
    prices = [200.0] * 100 + [80.0] * 200
    fake = _fake_ticker(_good_fundamentals(), prices)
    with patch.object(screener.yf, "Ticker", return_value=fake):
        assert screener._screen_one("XYZ") is None


@pytest.mark.unit
def test_screens_out_no_dip():
    # Flat price, no recent drawdown at all -> fails the dip-range filter.
    prices = [100.0] * 300
    fake = _fake_ticker(_good_fundamentals(), prices)
    with patch.object(screener.yf, "Ticker", return_value=fake):
        assert screener._screen_one("XYZ") is None


@pytest.mark.unit
def test_passes_good_fundamentals_and_dip():
    # 260 flat days near 100, then a ~15% dip in the last stretch, still above 85% of SMA200
    # (sma200 = (60*100 + 40*85)/100 = 94, and 85 > 0.85*94 = 79.9).
    prices = [100.0] * 260 + [85.0] * 40
    fake = _fake_ticker(_good_fundamentals(), prices)
    with patch.object(screener.yf, "Ticker", return_value=fake):
        result = screener._screen_one("XYZ")
    assert result is not None
    assert result.ticker == "XYZ"
    assert screener.config.SCREENER_MIN_DIP <= result.drawdown <= screener.config.SCREENER_MAX_DIP


@pytest.mark.unit
def test_screens_out_high_debt_to_equity():
    prices = [100.0] * 250 + [95.0] * 30 + [80.0] * 20
    fake = _fake_ticker(_good_fundamentals(debtToEquity=500.0), prices)
    with patch.object(screener.yf, "Ticker", return_value=fake):
        assert screener._screen_one("XYZ") is None


@pytest.mark.unit
def test_run_screener_sorts_and_truncates():
    def fake_screen_one(ticker):
        return screener.ScreenResult(
            ticker=ticker, score=float(ord(ticker[0])), price=100.0, drawdown=0.15,
            roe=0.2, debt_to_equity=40.0, revenue_growth=0.1, reasons=["ok"],
        )

    with patch.object(screener, "_screen_one", side_effect=fake_screen_one):
        results = screener.run_screener(basket=["A", "C", "B"], top_n=2)

    assert [r.ticker for r in results] == ["C", "B"]  # highest score first, truncated to top_n
