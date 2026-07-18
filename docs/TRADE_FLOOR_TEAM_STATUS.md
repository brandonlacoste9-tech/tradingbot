# Trade floor — team status bounce

**Product:** IndieTrades · https://indietrades.com/trade  
**Audience:** Grok product/eng team (Harper, Lucas, Benjamin + lead)  
**Date:** 2026-07-18  
**Status:** Phase 1–3 **shipped** · Hybrid **C** locked · **freeze held**  

**Related plan:** [`TRADE_FLOOR_REALISM_PLAN.md`](./TRADE_FLOOR_REALISM_PLAN.md)  
**Phase 3 spec:** [`TRADE_FLOOR_PHASE3.md`](./TRADE_FLOOR_PHASE3.md)  
**Vote issue:** https://github.com/brandonlacoste9-tech/tradingbot/issues/1  

---

## 1. What we shipped

| Area | What |
|------|------|
| Phase 1 | Desk chrome: Net liq · RTH · as-of · watchlist · blotter tabs · TIF Day · PAPER |
| Phase 2 | Chart: candles → line fallback · 1D+1M · pure green/red · source/age · no fake bars |
| Any ticker | Watchlist Open + ticket auto-watch · localStorage |
| **Phase 3 Hybrid C** | Aggressive instant fill vs passive working · cancel · Day TIF · evaluate on quotes |

**Key commits:** `9ae7e4e` · `cb9370c` · `884d187` · `f98bcd7`

**Control plane unchanged:** research (optional) → policy → human confirm → PaperSim.

### Live health (ack)

`ok` · IndieTrades **v0.7.0** · `paper_only: true` · `broker_backend: sim` · Clerk · Postgres · `llm_enabled: true`

---

## 2. Hybrid C — locked model

| After confirm | Condition | Result |
|---------------|-----------|--------|
| **Aggressive** | Buy limit ≥ last/mark · sell ≤ last/mark | Instant PaperSim fill → **Fills / Positions** |
| **Passive** | Buy &lt; last · sell &gt; last | **Working** in Orders · cancel · Day TIF · fill on mark cross |

Still: **policy → you confirm → paper only**. No fake tape / L2.

**API:** hybrid `submit_order` · `evaluate_working_orders` · `POST /orders/{id}/cancel` · `POST /orders/evaluate`  
**Statuses:** `working` · `filled` · `cancelled` · `expired` (+ `awaiting_confirm` / `policy_rejected`)  
**UI:** Orders tab + cancel · Fills labeled *PaperSim · not a live broker* · Tips / How fills work · account disclaimer · preflight fill vs working  
**Tests:** 13 hybrid/manual/sim green · web `tsc` clean  

---

## 3. Real paper desk vs fake live broker

| Real (good) | Wrong (bad) |
|-------------|-------------|
| Desk look + process | Looks like live brokerage |
| Honest data badges | Fake Level 2 / invented bars |
| You confirm every order | LLM auto-submit |
| Loud PAPER + PaperSim | Silent “live” language |
| Working vs fill is real | Orders tab as theater |

---

## 4. Freeze held (unchanged)

**In (shipped):** working limits · cancel · statuses · documented fill rules · Day TIF  

**Out (do not open yet):** SL/TP · Level 2 · bid/ask · partials · multi-leg · live routing · extra TIFs  

**Team lean:** stay frozen. Next = **honesty polish only** if something feels live-broker-ish — **not Phase 4** scope.

---

## 5. Feel-check after deploy

1. **Aggressive** — buy AAPL at mark or higher → confirm → **Fills** / Positions  
2. **Passive** — buy AAPL below last → confirm → **Orders** → Cancel or wait for mark cross  
3. Confirm copy never implies live broker match  

---

## 6. Prior vote (owner lock — recorded)

1. Feel pass → **Ship** Phase 1–2  
2. Fill model → **C Hybrid**  
3. Freeze → **Yes**  
4. Real-money risks → honesty polish list (LIVE wording, paper account line, PaperSim confirm, source/age, Clerk prod ops)

---

**Status:** Hybrid C **shipped and synced**. Freeze held. Honesty polish only if feel-check flags live-broker-ish copy/UX.
