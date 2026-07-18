# Trade floor — team status bounce

**Product:** IndieTrades · https://indietrades.com/trade  
**Audience:** Grok product/eng team (Harper, Lucas, Benjamin + lead)  
**Date:** 2026-07-18  
**Owner ask:** Feel pass on what shipped · lock **Phase 3** so we get a **real-looking paper desk**, not a fake live broker or a thin form  

**Related plan:** [`docs/TRADE_FLOOR_REALISM_PLAN.md`](./TRADE_FLOOR_REALISM_PLAN.md) · decisions §12 still hold  

---

## 1. What we shipped (since decision lock)

Commits on `main`:

| Commit | What |
|--------|------|
| `9ae7e4e` | **Phase 1 chrome + Phase 2 chart** |
| `cb9370c` | **Any ticker** — watchlist Open + ticket auto-watch |

### Phase 1 — desk chrome (done)

- Account strip: **Net liq · Cash · BP · Day P&L · Open P&L**
- Sticky bar: loud **PAPER only** · **US RTH open/closed** · **Quotes as of** time
- Watchlist: **Last · Chg%** (pure green/red)
- Ticket: Buy/Sell · qty · limit · **TIF Day** (UI) · est. notional · **Review paper order**
- Blotter tabs: **Positions | Orders | Fills** (Orders tab honest: “Phase 3”)
- Preflight modal unchanged: **policy + human confirm + TTL**

### Phase 2 — chart (done)

- Select symbol → **own SVG chart** (no TradingView embed)
- **Candles** if OHLC solid; else **line** (same PR fallback)
- **1D + 1M** toggle; chart **above ticket** (center column)
- Pure **#22c55e / #ef4444**; brand accent only for PAPER/chrome
- **Source + age** badge; empty/error if no honest bars — **no fake bars**
- API: `GET /market/bars`, `GET /market/session`; cascade skips single-bar Massive dead-ends

### Follow-up — any stock (done)

Problem: “I want COST but it’s not on the default list.”

- Watchlist **Open** (type ticker → chart + ticket + quote)
- Ticket symbol **blur/Enter** auto-adds to watch
- **×** remove · list **localStorage**-persisted
- Always quote **active** symbol (not only listed rows)

---

## 2. Product line we must not blur

We are building a **real paper trading desk**, not a **fake live broker**.

| Real (good) | Fake / wrong (bad) |
|-------------|--------------------|
| Looks and flows like a desk: chart, ticket, blotter, session clock | Looks like live brokerage / confuses “is this money real?” |
| Real symbols + honest market data badges | Fake Level 2, fake volume, invented bars |
| Policy + **you confirm** every fill | LLM or auto-submit without confirm |
| PaperSim book, loud **PAPER** | Silent “live” language, hidden sim |
| Documented fill rules when we add working orders | Pretending exchange matching we don’t have |

**One-line promise (unchanged):**  
> Practice stock trading here before you use real money.

**Grok (unchanged):** research bro / opinions on AI Desk — not the order router.

---

## 3. Feel pass (owner + team)

Please click through production `/trade` after deploy:

1. Desk chrome feels “broker,” not “settings form”?  
2. Chart paints on symbol pick; 1D/1M OK; source badge honest?  
3. PAPER still impossible to miss?  
4. Mobile: ticket still reachable under chart?  
5. Open a non-default ticker (COST / PLTR / SOFI) — path obvious?  
6. Anything that still feels like a chatbot with a form?

**Owner note so far:** “It’s looking better.” → chrome + chart direction validated; process realism next.

---

## 4. Next phase — team decision: what makes the desk “real enough”?

Phase 3 in the plan is **order lifecycle** (process realism). Today most paper fills are **instant after confirm**. That is honest-but-thin: great for time-to-first-fill; weak for “I placed a limit and it’s working.”

### Option A — Instant fill stays (document it)

- Keep post-confirm fill-at-mark/last  
- UI copy: “Paper fills immediately at mark after you confirm (not exchange matching)”  
- Orders tab stays empty / educational  
- **Pros:** simple, fast practice loop  
- **Cons:** feels less like a real desk; limits don’t “work”

### Option B — Working orders (recommended direction for “real desk”)

- Limit not through → status **working** in Orders  
- Through / rules → **filled** → Fills + Positions  
- **Cancel** working  
- Still: **policy + confirm first**; still **paper only**  
- UI documents fill rule (e.g. “fills if last/mark crosses limit within poll”)  
- **Pros:** blotter means something; teaches process  
- **Cons:** more eng; can confuse beginners if too slow/opaque

### Option C — Hybrid (possible compromise)

- Market-ish / “fill now” path stays instant after confirm  
- Limit path can rest as working  
- Default ticket stays limit + Day TIF  

---

## 5. Open questions for the team (please vote)

| # | Question | Owner lean (non-binding) |
|---|----------|---------------------------|
| 1 | Is **visual desk** (Phase 1–2) good enough to open Phase 3, or more chrome polish first? | Open Phase 3 if feel pass is green |
| 2 | **A / B / C** for fill model? | **C hybrid** or **B** — without working orders the Orders tab stays a lie |
| 3 | How “exchange-like” may fills be? Strict cross-only vs soft paper fill at confirm price? | Soft, **documented**, never pretend NBBO match |
| 4 | Must **PAPER** get louder** when orders rest (working banner)? | Yes — working ≠ live |
| 5 | Phase 3 scope freeze: working + cancel + statuses only — **no** SL/TP, no Level 2, no bid/ask yet? | Yes freeze |
| 6 | Anything that still risks “fake trading desk” (users think money is real)? | Audit copy + badges after B/C |

Also: any **must-fix** from feel pass before Phase 3 code?

---

## 6. Explicit non-goals (still)

- Live multi-tenant brokerage  
- Fake tape / fake depth  
- Removing human confirm for “speed”  
- Rebuilding Webull charting  

---

## 7. Ask

**Reply with:**

1. Feel pass: **ship / polish / rethink** (one word + notes)  
2. Fill model: **A / B / C**  
3. Phase 3 freeze list: agree or edit  

When the team locks §5, eng implements Phase 3 only — no Phase 4 scope creep.

---

**Status:** Phase 1 + Phase 2 + any-ticker shipped. **Awaiting team bounce on Phase 3 / real-paper-desk line.**
