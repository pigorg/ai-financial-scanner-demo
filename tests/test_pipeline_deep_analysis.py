"""Tests for the Agent-2 ranking/trimming logic (TradingAgentsGraph itself is mocked out)."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from tradingagents.pipeline import deep_analysis


@pytest.mark.unit
def test_run_deep_analysis_ranks_by_rating_and_trims():
    ratings = {"AAA": "Sell", "BBB": "Buy", "CCC": "Hold", "DDD": "Overweight"}

    def fake_analyze_one(ticker, trade_date):
        return deep_analysis.DeepAnalysisResult(
            ticker=ticker, rating=ratings[ticker], final_state={}, report_path=None
        )

    with patch.object(deep_analysis, "_analyze_one", side_effect=fake_analyze_one):
        results = deep_analysis.run_deep_analysis(list(ratings), trade_date="2026-01-01", top_n=2)

    assert [r.ticker for r in results] == ["BBB", "DDD"]  # Buy, then Overweight


@pytest.mark.unit
def test_run_deep_analysis_invokes_on_result_callback():
    seen = []

    def fake_analyze_one(ticker, trade_date):
        return deep_analysis.DeepAnalysisResult(ticker=ticker, rating="Hold", final_state={}, report_path=None)

    with patch.object(deep_analysis, "_analyze_one", side_effect=fake_analyze_one):
        deep_analysis.run_deep_analysis(
            ["AAA", "BBB"], trade_date="2026-01-01", top_n=5, on_result=seen.append
        )

    assert {r.ticker for r in seen} == {"AAA", "BBB"}


@pytest.mark.unit
def test_run_deep_analysis_wraps_exceptions_as_review():
    def fake_analyze_one(ticker, trade_date):
        if ticker == "BAD":
            raise RuntimeError("boom")
        return deep_analysis.DeepAnalysisResult(ticker=ticker, rating="Buy", final_state={}, report_path=None)

    with patch.object(deep_analysis, "_analyze_one", side_effect=fake_analyze_one):
        results = deep_analysis.run_deep_analysis(["GOOD", "BAD"], trade_date="2026-01-01", top_n=5)

    by_ticker = {r.ticker: r for r in results}
    assert by_ticker["BAD"].rating == "REVIEW"
    assert "boom" in by_ticker["BAD"].final_state["error"]
