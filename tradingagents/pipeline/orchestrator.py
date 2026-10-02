"""Runs the full 3-agent pipeline end to end, emailing a report after each stage.

    python -m tradingagents.pipeline.orchestrator
or:
    tradingagents pipeline

Report-formatting is split into its own functions so the CLI can reuse them
while also rendering live progress (see cli/main.py's `pipeline` command).
"""

from __future__ import annotations

from datetime import date

from tradingagents.pipeline import charts, config
from tradingagents.pipeline.allocator import AllocationResult, run_allocator
from tradingagents.pipeline.deep_analysis import DeepAnalysisResult, run_deep_analysis
from tradingagents.pipeline.emailer import send_report
from tradingagents.pipeline.screener import ScreenResult, run_screener


def format_screener_report(results: list[ScreenResult], trade_date: str) -> tuple[str, str]:
    subject = f"[TradingAgents] Agente 1 — {len(results)} titoli selezionati ({trade_date})"
    body = (
        f"Screener quantitativo (fondamentali + dip) su {len(config.PIPELINE_BASKET)} titoli del paniere.\n\n"
        + "\n\n".join(
            f"{r.ticker} — score {r.score:.2f}, prezzo {r.price:.2f}, "
            f"drawdown {r.drawdown:.1%}\n" + "; ".join(r.reasons)
            for r in results
        )
    )
    return subject, body


def format_finalists_report(results: list[DeepAnalysisResult], trade_date: str) -> tuple[str, str]:
    subject = f"[TradingAgents] Agente 2 — {len(results)} finalisti ({trade_date})"
    body = "Analisi approfondita multi-agente sui titoli selezionati dallo screener.\n\n" + "\n\n".join(
        f"{r.ticker} — rating: {r.rating}\nReport: {r.report_path or 'n/d'}" for r in results
    )
    return subject, body


def format_final_report(allocation: AllocationResult, trade_date: str) -> tuple[str, str]:
    subject = f"[TradingAgents] Decisione finale — {allocation.winner} ({trade_date})"
    body = f"Titolo scelto: {allocation.winner}\n\nMotivazione:\n{allocation.reasoning}"
    return subject, body


def run_pipeline(trade_date: str | None = None) -> None:
    trade_date = trade_date or date.today().isoformat()

    # Agent 1: quant screener over the basket
    screened = run_screener()
    if not screened:
        send_report(
            f"[TradingAgents] Screener {trade_date}: nessun titolo idoneo",
            "Nessun titolo del paniere ha superato i filtri di fondamentali + dip oggi.",
        )
        return
    send_report(*format_screener_report(screened, trade_date))

    # Agent 2: deep multi-agent analysis on the shortlist, narrowed to finalists
    finalists = run_deep_analysis([r.ticker for r in screened], trade_date=trade_date)
    if not finalists:
        send_report(
            f"[TradingAgents] Agente 2 {trade_date}: nessun finalista",
            "L'analisi approfondita non ha prodotto rating utilizzabili.",
        )
        return
    send_report(*format_finalists_report(finalists, trade_date))

    # Agent 3: pick the buy among the finalists, with reasoning
    allocation = run_allocator(finalists)
    chart_paths = charts.build_charts([r.ticker for r in finalists])
    subject, body = format_final_report(allocation, trade_date)
    send_report(subject, body, attachments=chart_paths)


if __name__ == "__main__":
    run_pipeline()
