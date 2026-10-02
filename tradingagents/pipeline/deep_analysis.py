"""Agent 2: run the existing TradingAgentsGraph on each shortlisted ticker in
parallel, then narrow to the top finalists by their 5-tier rating.

Reuses TradingAgentsGraph unmodified (main.py's ta.propagate flow) — this
module is only the orchestration/ranking layer around it.
"""

from __future__ import annotations

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.pipeline import config
from tradingagents.reporting import write_report_tree

# Higher is better; unrecognized/REVIEW sorts last.
_RATING_RANK = {"Buy": 5, "Overweight": 4, "Hold": 3, "Underweight": 2, "Sell": 1, "REVIEW": 0}


@dataclass
class DeepAnalysisResult:
    ticker: str
    rating: str
    final_state: dict
    report_path: str | None


def _analyze_one(ticker: str, trade_date: str) -> DeepAnalysisResult:
    ta = TradingAgentsGraph(debug=False, config=DEFAULT_CONFIG.copy())
    final_state, rating = ta.propagate(ticker, trade_date)
    report_path = None
    try:
        save_path = write_report_tree(final_state, ticker, f"{DEFAULT_CONFIG['results_dir']}/{ticker}/{trade_date}")
        report_path = str(save_path)
    except Exception:
        pass
    return DeepAnalysisResult(ticker=ticker, rating=rating, final_state=final_state, report_path=report_path)


def run_deep_analysis(
    tickers: list[str],
    trade_date: str | None = None,
    top_n: int | None = None,
    on_result: Callable[[DeepAnalysisResult], None] | None = None,
) -> list[DeepAnalysisResult]:
    """Run the deep-analysis graph on each ticker in parallel, return the top N by rating.

    ``on_result`` (optional) is called as each ticker finishes, so a caller can
    show live per-ticker progress instead of waiting silently for the whole batch.
    """
    trade_date = trade_date or date.today().isoformat()
    top_n = top_n or config.DEEP_ANALYSIS_TOP_N

    results: list[DeepAnalysisResult] = []
    with ThreadPoolExecutor(max_workers=config.DEEP_ANALYSIS_WORKERS) as pool:
        futures = {pool.submit(_analyze_one, t, trade_date): t for t in tickers}
        for future in as_completed(futures):
            ticker = futures[future]
            try:
                result = future.result()
            except Exception as exc:
                result = DeepAnalysisResult(ticker=ticker, rating="REVIEW", final_state={"error": str(exc)}, report_path=None)
            results.append(result)
            if on_result:
                on_result(result)

    results.sort(key=lambda r: _RATING_RANK.get(r.rating, -1), reverse=True)
    return results[:top_n]
