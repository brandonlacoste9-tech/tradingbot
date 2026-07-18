# IndieTrades — Grok team sync

**Product:** https://indietrades.com  
**API:** https://tradingbot-api-0990.onrender.com/health  
**Date:** 2026-07-18  
**Audience:** Grok product/eng (Harper, Lucas, Benjamin + lead)  
**Status:** **Beta-ready paper desk** · Hybrid C live · freeze held · marketing home live  

---

## 1. One-line product

> Practice stock trading **before real money** — real tickers, virtual cash, chart + ticket + blotter, optional Grok research, **you confirm** every paper order. Not a live broker.

**Map (unchanged):**

| Surface | URL | Role |
|---------|-----|------|
| **Home** | `/` | Marketing (classic layout + trade floor hero) |
| **Think** | `/desk` | AI Desk — Grok research / propose |
| **Act** | `/trade` | Trade floor — ticket, chart, blotter |
| **Pay** | `/plans` | Free → Pro / Pro+ |

**Control plane (sacred):**  
`Research (optional) → Policy → Human confirm (TTL) → PaperSim → Journal`

---

## 2. Live health (ack)

```text
ok · IndieTrades v0.7.0 · paper_only: true · broker_backend: sim
auth_mode: clerk · postgres: true · llm_enabled: true
```

| Layer | State |
|--------|--------|
| Netlify web | Live · Clerk **dev** keys (`pk_test_`) — fine for beta |
| Render API | Live · PaperSim · Clerk JWT via `creative-rodent-96` issuer |
| Postgres | Live multi-user paper books |
| Google OAuth | Enabled on Clerk **Development** |
| Stripe | Keys/prices configured — E2E when ready |
| Yellow `pk_test_` banner | **Removed** from public UI (owner request) |

---

## 3. What shipped since last bounce

### Trade floor realism (Phase 1–3)

| Phase | Status | Notes |
|-------|--------|--------|
| **1 Chrome** | ✅ | Net liq / cash / BP / day & open P&L · RTH · as-of · watchlist Last/Chg% · blotter tabs · TIF Day · PAPER |
| **2 Chart** | ✅ | Pure green/red candles → line fallback · 1D+1M · source/age · no fake bars · chart above ticket |
| **Any ticker** | ✅ | Open / ticket auto-watch · × remove · localStorage |
| **3 Hybrid C** | ✅ | Aggressive fill vs passive **working** · cancel · Day TIF · evaluate on quotes · documented fill rules |

**Hybrid C (locked):**

| After confirm | Condition | Result |
|---------------|-----------|--------|
| Aggressive | Buy limit ≥ last/mark · sell ≤ last/mark | Instant PaperSim fill → Fills / Positions |
| Passive | Buy &lt; last · sell &gt; last | **Working** in Orders · cancel · Day TIF · fill on mark cross |

**Out of freeze (do not open without vote):** SL/TP · Level 2 · bid/ask · partials · multi-leg · live multi-tenant routing  

**Specs:** [`TRADE_FLOOR_PHASE3.md`](./TRADE_FLOOR_PHASE3.md) · [`TRADE_FLOOR_REALISM_PLAN.md`](./TRADE_FLOOR_REALISM_PLAN.md) · Issue [#1](https://github.com/brandonlacoste9-tech/tradingbot/issues/1)

### Paper budget

| Feature | Detail |
|---------|--------|
| UI | **Paper budget** on `/trade` (was hard Reset $100k) |
| Presets | $10k · $20k · $50k · $100k · custom |
| API | Existing `POST /paper/reset` + `starting_cash` |
| Honesty | Simulated starting cash — not a deposit |

### Marketing home

| Feature | Detail |
|---------|--------|
| Layout | Classic (owner preferred) |
| Hero | Trade floor product image (`/landing/trade-floor-v3.jpg`) |
| CTAs | Open Trade floor · Sign up / AI Desk |
| Facts + Think/Act/Pay | Still on page |
| Dev banner | Removed from chrome |

### Trade floor polish

- Budget chip on button + account strip  
- Quotes as-of on mobile  
- Blotter tab counts  
- Refresh re-evaluates working orders  
- Esc / backdrop close budget modal  
- Louder **PAPER** on preflight  

### Auth / ops

- Clerk works (email + **Google** on Development)  
- Render env restored: `AUTH_MODE`, `CLERK_ISSUER` / JWKS, `CORS`, `DATABASE_URL`, paper flags  
- Production Clerk instance exists; **DNS pending** for `clerk.indietrades.com` (not required for beta)  

---

## 4. Product principles (non-negotiable)

1. **Paper only by default** — loud PAPER; never confuse with live brokerage  
2. **Control plane sacred** — LLM never submits  
3. **Honest sim** — no fake Level 2 / invented bars  
4. **Mobile ticket usable**  
5. **Do not rebuild Webull**  

**Grok role:** research bro / opinions on AI Desk — not the order router.

---

## 5. What “done” means for beta

Someone can:

1. Land on `/` and understand the product in 10 seconds  
2. Sign in (Clerk / Google)  
3. Open `/trade`, set **paper budget** (e.g. $20k)  
4. Open any ticker → chart paints  
5. Place aggressive fill **or** passive working limit  
6. See Orders / Fills / Positions mean something  
7. Never think money is live  

---

## 6. Open / later (not in sprint)

| Item | When |
|------|------|
| Clerk **Production** DNS + `pk_live_` on Netlify/Render | Before paid ads / hard launch |
| Stripe Checkout E2E (real customer path) | Before paid plans push |
| Real authenticated `/trade` marketing screenshots | Optional polish |
| Phase 4 (SL/TP, L2, bid/ask, …) | Only after explicit unfreeze |
| Secrets hygiene | Rotate any keys that appeared outside dashboards |

---

## 7. Key commits (recent)

| Commit | What |
|--------|------|
| `884d187` | Phase 3 hybrid fills |
| `a36175e` | Paper budget picker |
| `14b1b0f` | Marketing home |
| `3a196d8` | Trade floor polish |
| `6c37419` | Remove pk_test public banner |
| `4d0502c` | Landing hero capture + tagline cleanup |

---

## 8. Ask for the team

**No vote required** unless someone wants to unfreeze Phase 4 or force Clerk production DNS this week.

**Feel-check welcome:**

1. `/` — does the story land?  
2. `/trade` — budget $20k → passive AAPL below last → Orders → cancel  
3. Aggressive at mark → Fills  
4. Google sign-in still smooth  

**Reply with:** ship / polish note / dissent on freeze.

---

**Owner lean:** Stay frozen on Phase 4. Beta product is coherent. Next big ops item is **Clerk prod DNS + live keys** only when going paid; next product polish only if feel-check finds honesty or UX slips.
