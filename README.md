
# Multi-Agent Trading System

Fork of [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents), esteso con una pipeline a 3 agenti per scansionare un intero paniere di titoli invece di analizzarne uno alla volta.

> Strumento di ricerca, non consulenza finanziaria. Le performance variano in base a modello, temperatura, dati e altri fattori non deterministici.

## Come funziona: 3 agenti in sequenza

**Agente 1 — Screener** (`tradingagents/pipeline/screener.py`)
Filtro quantitativo, nessuna chiamata LLM: scarta i titoli con fondamentali deboli (ROE, debito/equity, crescita ricavi, free cash flow) e tiene solo quelli scesi del 10-40% dal massimo a 6 mesi ma ancora sopra la media mobile a 200 giorni — un ribasso temporaneo su un titolo solido, non un trend strutturale in calo. Gratis e veloce.

**Agente 2 — Analisi approfondita** (`tradingagents/pipeline/deep_analysis.py`)
Per ogni titolo passato allo screener, esegue in parallelo l'intera pipeline multi-agente di TradingAgents (analisti fondamentali/sentiment/news/tecnici → ricercatori bull/bear → trader → risk management → portfolio manager). Alla fine tiene solo i migliori per rating.

**Agente 3 — Allocator** (`tradingagents/pipeline/allocator.py`)
Un'unica chiamata a Claude che confronta i report dei finalisti dell'agente 2 e sceglie il titolo su cui allocare, motivando la scelta.

```
Paniere di ticker
       │
       ▼
  Agente 1 (screener, gratis)  →  shortlist
       │
       ▼
  Agente 2 (analisi multi-agente per ogni titolo)  →  finalisti
       │
       ▼
  Agente 3 (Claude sceglie 1 titolo)  →  decisione finale
```

## Uso

```bash
tradingagents pipeline --show-basket   # mostra il paniere configurato, nessun costo
tradingagents pipeline                 # run completo (chiede conferma: agenti 2/3 fanno chiamate LLM a pagamento)
tradingagents pipeline --yes           # run completo senza conferma (per cron)

tradingagents analyze                  # analisi singolo titolo (solo framework originale)
```

Configurazione via variabili d'ambiente (paniere, soglie screener, provider/modello dell'allocator, SMTP per l'invio email dei report): vedi `.env.example`.
