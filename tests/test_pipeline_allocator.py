"""Tests for the Agent-3 allocator's FINAL PICK parsing (LLM call itself is stubbed)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tradingagents.pipeline import allocator
from tradingagents.pipeline.deep_analysis import DeepAnalysisResult


def _finalist(ticker: str) -> DeepAnalysisResult:
    return DeepAnalysisResult(
        ticker=ticker,
        rating="Buy",
        final_state={"trader_investment_plan": f"plan for {ticker}", "risk_debate_state": {}},
        report_path=None,
    )


@pytest.mark.unit
def test_single_finalist_skips_llm_call():
    result = allocator.run_allocator([_finalist("AAA")])
    assert result.winner == "AAA"


@pytest.mark.unit
def test_parses_final_pick_line():
    finalists = [_finalist("AAA"), _finalist("BBB")]
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = MagicMock(content="Some reasoning...\nFINAL PICK: BBB")
    fake_client = MagicMock()
    fake_client.get_llm.return_value = fake_llm

    with patch.object(allocator, "create_llm_client", return_value=fake_client):
        result = allocator.run_allocator(finalists)

    assert result.winner == "BBB"
    assert "FINAL PICK" in result.reasoning


@pytest.mark.unit
def test_falls_back_to_first_finalist_when_pick_unparseable():
    finalists = [_finalist("AAA"), _finalist("BBB")]
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = MagicMock(content="I like both, no clear winner stated.")
    fake_client = MagicMock()
    fake_client.get_llm.return_value = fake_llm

    with patch.object(allocator, "create_llm_client", return_value=fake_client):
        result = allocator.run_allocator(finalists)

    assert result.winner == "AAA"


@pytest.mark.unit
def test_ignores_pick_naming_ticker_outside_finalists():
    finalists = [_finalist("AAA"), _finalist("BBB")]
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = MagicMock(content="FINAL PICK: ZZZ")
    fake_client = MagicMock()
    fake_client.get_llm.return_value = fake_llm

    with patch.object(allocator, "create_llm_client", return_value=fake_client):
        result = allocator.run_allocator(finalists)

    assert result.winner == "AAA"  # fallback, ZZZ was never a finalist
