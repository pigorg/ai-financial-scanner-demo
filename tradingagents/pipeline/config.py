"""Env-driven configuration for the screening/allocation pipeline.

Follows the same convention as tradingagents/default_config.py: plain
TRADINGAGENTS_PIPELINE_* env vars, coerced to sensible defaults, no code
changes required to retune thresholds or the basket.
"""

import os

_DEFAULT_BASKET = (
    "AAPL,MSFT,GOOGL,AMZN,NVDA,META,TSLA,JPM,V,UNH,HD,PG,MA,DIS,ADBE,"
    "CRM,NFLX,PEP,KO,COST,MRK,ABBV,AVGO,CSCO,XOM,CVX,WMT,BAC,ORCL,INTC"
)


def _float_env(name: str, default: float) -> float:
    raw = os.environ.get(name)
    return float(raw) if raw else default


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return int(raw) if raw else default


PIPELINE_BASKET = [
    t.strip().upper()
    for t in os.environ.get("TRADINGAGENTS_PIPELINE_BASKET", _DEFAULT_BASKET).split(",")
    if t.strip()
]

# Agent 1 (screener) thresholds
SCREENER_MIN_ROE = _float_env("TRADINGAGENTS_SCREENER_MIN_ROE", 0.10)
SCREENER_MAX_DEBT_TO_EQUITY = _float_env("TRADINGAGENTS_SCREENER_MAX_DEBT_TO_EQUITY", 150.0)
SCREENER_MIN_DIP = _float_env("TRADINGAGENTS_SCREENER_MIN_DIP", 0.10)
SCREENER_MAX_DIP = _float_env("TRADINGAGENTS_SCREENER_MAX_DIP", 0.40)
SCREENER_TOP_N = _int_env("TRADINGAGENTS_SCREENER_TOP_N", 5)

# Agent 2 (deep analysis)
DEEP_ANALYSIS_TOP_N = _int_env("TRADINGAGENTS_DEEP_ANALYSIS_TOP_N", 2)
DEEP_ANALYSIS_WORKERS = _int_env("TRADINGAGENTS_DEEP_ANALYSIS_WORKERS", 3)

# Agent 3 (allocator) — always Claude regardless of the provider Agent 2 uses,
# since it's a single cheap call comparing already-written summaries.
ALLOCATOR_LLM_PROVIDER = os.environ.get("TRADINGAGENTS_ALLOCATOR_LLM_PROVIDER", "anthropic")
ALLOCATOR_LLM_MODEL = os.environ.get("TRADINGAGENTS_ALLOCATOR_LLM_MODEL", "claude-sonnet-5")

# Email
SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = _int_env("SMTP_PORT", 587)
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER or "tradingagents@localhost")
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").strip().lower() not in ("false", "0", "no", "off")
REPORT_EMAIL_TO = os.environ.get("REPORT_EMAIL_TO", "informazioni@alessandrognola.com")
