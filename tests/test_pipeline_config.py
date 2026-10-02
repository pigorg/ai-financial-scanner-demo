"""Tests for the pipeline's env-var configuration overlay."""

from __future__ import annotations

import importlib

import pytest

import tradingagents.pipeline.config as pipeline_config_module


def _reload_with_env(monkeypatch, **overrides):
    for key in (
        "TRADINGAGENTS_PIPELINE_BASKET",
        "TRADINGAGENTS_SCREENER_MIN_ROE",
        "TRADINGAGENTS_SCREENER_MAX_DEBT_TO_EQUITY",
        "TRADINGAGENTS_SCREENER_MIN_DIP",
        "TRADINGAGENTS_SCREENER_MAX_DIP",
        "TRADINGAGENTS_SCREENER_TOP_N",
        "TRADINGAGENTS_DEEP_ANALYSIS_TOP_N",
        "TRADINGAGENTS_DEEP_ANALYSIS_WORKERS",
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USER",
        "SMTP_PASSWORD",
        "SMTP_FROM",
        "SMTP_USE_TLS",
        "REPORT_EMAIL_TO",
    ):
        monkeypatch.delenv(key, raising=False)
    for key, val in overrides.items():
        monkeypatch.setenv(key, val)
    return importlib.reload(pipeline_config_module)


@pytest.mark.unit
def test_defaults(monkeypatch):
    cfg = _reload_with_env(monkeypatch)
    assert len(cfg.PIPELINE_BASKET) == 30
    assert "AAPL" in cfg.PIPELINE_BASKET
    assert cfg.SCREENER_TOP_N == 5
    assert cfg.DEEP_ANALYSIS_TOP_N == 2
    assert cfg.REPORT_EMAIL_TO == "informazioni@alessandrognola.com"
    assert cfg.SMTP_HOST is None


@pytest.mark.unit
def test_basket_override_is_parsed_and_uppercased(monkeypatch):
    cfg = _reload_with_env(monkeypatch, TRADINGAGENTS_PIPELINE_BASKET=" aapl, msft ,googl")
    assert cfg.PIPELINE_BASKET == ["AAPL", "MSFT", "GOOGL"]


@pytest.mark.unit
def test_threshold_overrides_are_coerced_to_float(monkeypatch):
    cfg = _reload_with_env(
        monkeypatch,
        TRADINGAGENTS_SCREENER_MIN_ROE="0.2",
        TRADINGAGENTS_SCREENER_MAX_DIP="0.5",
    )
    assert cfg.SCREENER_MIN_ROE == 0.2
    assert cfg.SCREENER_MAX_DIP == 0.5


@pytest.mark.unit
def test_smtp_use_tls_defaults_true_and_honors_false(monkeypatch):
    cfg = _reload_with_env(monkeypatch, SMTP_USE_TLS="false")
    assert cfg.SMTP_USE_TLS is False
    cfg = _reload_with_env(monkeypatch)
    assert cfg.SMTP_USE_TLS is True
