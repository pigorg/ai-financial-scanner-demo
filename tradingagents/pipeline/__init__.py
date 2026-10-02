"""Three-stage pipeline: quant screener -> parallel deep analysis -> allocator.

Agent 1 (screener.py) filters a basket of tickers down to a shortlist on
fundamentals + recent-dip criteria (no LLM). Agent 2 (deep_analysis.py) runs
the existing TradingAgentsGraph per shortlisted ticker in parallel, narrowing
to finalists by their 5-tier rating. Agent 3 (allocator.py) picks the single
buy candidate among the finalists with a reasoned writeup. orchestrator.py
wires the three stages together and emails a report after each stage.
"""
