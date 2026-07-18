# Trade floor — team status bounce

**Product:** IndieTrades · https://indietrades.com/trade  
**Audience:** Grok product/eng team (Harper, Lucas, Benjamin + lead)  
**Date:** 2026-07-18  
**Status:** Phase 1–2 **shipped** · Phase 3 **Hybrid C shipped** · freeze held  

**Related plan:** [`TRADE_FLOOR_REALISM_PLAN.md`](./TRADE_FLOOR_REALISM_PLAN.md)  
**Phase 3 spec:** [`TRADE_FLOOR_PHASE3.md`](./TRADE_FLOOR_PHASE3.md)  

---

## 1. What we shipped

| Area | What |
|------|------|
| Phase 1 | Desk chrome: Net liq · RTH · as-of · watchlist · blotter tabs · TIF Day · PAPER |
| Phase 2 | Chart: candles → line fallback · 1D+1M · pure green/red · source/age · no fake bars |
| Any ticker | Watchlist Open + ticket auto-watch |
| **Phase 3 Hybrid C** | Aggressive instant fill vs passive working · cancel · Day TIF · evaluate on quotes |

**Control plane unchanged:** research (optional) → policy → human confirm → PaperSim.

### Hybrid C (live model)

| After confirm | Condition | Result |
|---------------|-----------|--------|
| **Aggressive** | Buy limit ≥ last/mark · sell ≤ last/mark | Instant PaperSim fill at last/mark → Fills / Positions |
| **Passive** | Buy < last · sell > last | Working in Orders · cancel · Day TIF · fill when mark crosses |

**API:** hybrid `submit_order` · `evaluate_working_orders` · `POST /orders/{id}/cancel` · `POST /orders/evaluate`  
**Statuses:** `working` · `filled` · `cancelled` · `expired` (+ policy / confirm path)  
**UI:** Orders tab + cancel · Fills with “PaperSim · not a live broker” · Tips: How fills work · account disclaimer  
**Tests:** 13 hybrid/manual/sim green · web tsc clean

---

## 2. Real paper desk vs fake live broker

| Real (good) | Wrong (bad) |
|-------------|-------------|
| Desk look + process | Looks like live brokerage |
| Honest data badges | Fake Level 2 / invented bars |
| You confirm every order | LLM auto-submit |
| Loud PAPER + PaperSim | Silent “live” language |
| Working vs fill is real | Orders tab as theater |

---

## 3. Freeze (held)

**In (shipped):** working limits · cancel · statuses · documented fill rules · Day TIF  

**Out (do not open yet):** SL/TP · Level 2 · bid/ask · partials · multi-leg · live routing · extra TIFs

---

## 4. Feel-check after deploy

1. **Aggressive:** buy AAPL at mark or higher → confirm → appears in **Fills** / Positions  
2. **Passive:** buy AAPL below last → confirm → appears in **Orders** → Cancel or wait for mark cross  
3. Confirm copy never implies live broker match  

Live health (sample): `paper_only: true`, `broker_backend: sim`, product IndieTrades, llm_enabled.

---

## 5. What’s next (team lean)

1. **Feel pass on Hybrid C** in production (aggressive + passive paths)  
2. Stay frozen on SL/TP / L2 / bid-ask  
3. Optional honesty polish only (wording, as-of, PAPER adjacency)  
4. Chart already shipped — if any residual chart gaps, honesty/polish only  

**Not next:** unfreezing Phase 4 scope or live routing.

---

**Previous:** Owner locked C + freeze; implement.  
**Now:** Hybrid C **shipped**. Freeze held. Feel-check in prod.
