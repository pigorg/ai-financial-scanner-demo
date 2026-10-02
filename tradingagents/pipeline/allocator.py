"""Agent 3: pick the single buy candidate among Agent 2's finalists.

Only compares already-written summaries (trader plan + portfolio manager
decision) — it does not re-run any analysis, so a single cheap Claude call
is enough here. Uses its own provider/model (see pipeline.config), independent
of whatever provider Agent 2 was configured with.
"""

from __future__ import annotations

from dataclasses import dataclass

from langchain_core.messages import HumanMessage, SystemMessage

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.llm_clients.factory import create_llm_client
from tradingagents.pipeline import config
from tradingagents.pipeline.deep_analysis import DeepAnalysisResult

_SYSTEM_PROMPT = (
    "You are a portfolio allocator. You receive investment summaries for a small "
    "number of finalist stocks, each already vetted by a trading-analysis pipeline. "
    "Pick exactly ONE ticker to buy and explain why, referencing the finalists you "
    "rejected and why they lost out. Be concise and concrete. End your answer with "
    "a line formatted exactly as: FINAL PICK: <TICKER>"
)


def _summarize(result: DeepAnalysisResult) -> str:
    state = result.final_state
    parts = [f"### {result.ticker} (rating: {result.rating})"]
    if state.get("trader_investment_plan"):
        parts.append(f"Trader plan:\n{state['trader_investment_plan']}")
    risk = state.get("risk_debate_state") or {}
    if risk.get("judge_decision"):
        parts.append(f"Portfolio manager decision:\n{risk['judge_decision']}")
    return "\n\n".join(parts)


@dataclass
class AllocationResult:
    winner: str
    reasoning: str


def run_allocator(finalists: list[DeepAnalysisResult]) -> AllocationResult:
    if len(finalists) == 1:
        return AllocationResult(winner=finalists[0].ticker, reasoning="Only one finalist reached this stage.")

    client = create_llm_client(
        provider=config.ALLOCATOR_LLM_PROVIDER,
        model=config.ALLOCATOR_LLM_MODEL,
        base_url=DEFAULT_CONFIG.get("backend_url") if config.ALLOCATOR_LLM_PROVIDER == DEFAULT_CONFIG["llm_provider"] else None,
    )
    llm = client.get_llm()

    user_content = "\n\n---\n\n".join(_summarize(r) for r in finalists)
    response = llm.invoke([SystemMessage(content=_SYSTEM_PROMPT), HumanMessage(content=user_content)])
    reasoning = response.content if isinstance(response.content, str) else str(response.content)

    winner = finalists[0].ticker
    for line in reasoning.splitlines():
        if line.strip().upper().startswith("FINAL PICK:"):
            candidate = line.split(":", 1)[1].strip().upper()
            tickers = {r.ticker.upper() for r in finalists}
            if candidate in tickers:
                winner = candidate
            break

    return AllocationResult(winner=winner, reasoning=reasoning)
