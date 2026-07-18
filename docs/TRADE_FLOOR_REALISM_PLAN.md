# Trade floor realism plan — for Grok team review

**Product:** IndieTrades · https://indietrades.com  
**Surface:** `/trade` (paper trading floor)  
**Status:** Phase 1 + Phase 2 + any-ticker shipped — team bounce on Phase 3  
**Date:** 2026-07-18  
**Team status:** [`docs/TRADE_FLOOR_TEAM_STATUS.md`](./TRADE_FLOOR_TEAM_STATUS.md)

**Owner intent:** Make `/trade` look and feel like a real stock trading screen, while staying **paper-only**, with **policy + human confirm**, and optional **Grok research** on AI Desk.

---

## 1. Why this project exists

IndieTrades already works as a product:

| Mode | Role |
|------|------|
| **AI Desk (`/`)** | Think — Grok research, propose paper ideas |
| **Trade (`/trade`)** | Act — ticket, watchlist, positions, paper fills |
| **Plans (`/plans`)** | Pay — free → Pro / Pro+ chat limits |

The **Trade floor** is the hero for “practice before real money.” It already supports an end-to-end paper loop (watchlist → ticket → preflight → fill → positions).

What’s missing for many users is **visual and process realism** — especially a **red/green stock chart when you pick a symbol**. That is the emotional centerpiece of “this feels like trading,” not a chatbot with a form.

---

## 2. Product principles (non-negotiable)

1. **Paper only by default** — loud PAPER chrome; never confuse with live brokerage.  
2. **Control plane stays sacred**  
   `Research (optional) → Policy → Human confirm (TTL) → PaperSim fill → Journal`  
3. **LLM never submits orders** — Grok proposes / opines; user confirms.  
4. **Honest simulation** — no fake Level 2 or fake volume; document fill model if needed.  
5. **Mobile-first** — ticket reachable on phone; chart must not bury the ticket forever.  
6. **Do not rebuild Webull** — density and chart yes; full indicator suite / options chain no (v1).

**One-line product promise:**  
> Practice stock trading here before you use real money.

**Grok role in the brand:**  
> Market research bro — can say what looks good/skip for paper practice. Opinion, not guarantee. You confirm.

---

## 3. What “more real” means

| More real | Still not real (and we say so) |
|-----------|--------------------------------|
| Account strip: equity, cash, BP, day P&L | No live brokerage account |
| Watchlist: last, chg, chg% | Not institutional data guarantees |
| **Chart on symbol select (red/green)** | Not full TradingView feature set |
| Ticket: side, qty, limit, TIF, est. cost | PaperSim fills, not exchange matching |
| Blotter: positions / orders / fills | Virtual book |
| Session clock + last quote time | Educational context |

---

## 4. Target layout

### Desktop (locked)

```
┌─────────────────────────────────────────────────────────────┐
│  PAPER ONLY · Net liq · Cash · BP · Day P&L · as-of time    │
├──────────────┬────────────────────────────┬─────────────────┤
│  Watchlist   │  Selected: AAPL  last  %   │                 │
│  Sym Last %  │  ┌──────────────────────┐  │                 │
│  ...         │  │  RED / GREEN CHART   │  │                 │
│              │  └──────────────────────┘  │                 │
│              │  Order ticket              │                 │
│              │  [Buy/Sell] qty limit TIF  │                 │
│              │  [Review paper order]      │                 │
├──────────────┴────────────────────────────┴─────────────────┤
│  Tabs: Positions | Orders (working) | Fills                   │
└─────────────────────────────────────────────────────────────┘
```

Chart sits **above the ticket** in the center column (not full-width under header).

### Mobile (already partly there)

1. Bottom nav: AI Desk · **Trade** · Plans  
2. Account chips  
3. **Selected symbol + chart** (height capped)  
4. **Ticket** (primary)  
5. Compact watchlist (chips or list)  
6. Positions / fills  

---

## 5. Phased delivery

### Phase 0 — Done (baseline)

- Trade floor with watchlist, limit ticket, policy preflight, paper fill  
- Positions, day P&L, reset $100k, quote refresh  
- Mobile bottom nav, ticket-first order on small screens  
- Brand: practice before real money; Grok research optional  

### Phase 1 — Broker chrome (high impact)

**Goal:** Looks like a desk even before the chart is perfect.

- [x] Denser account header (real vocabulary: Net liq / Cash / BP / Day P&L / Open P&L)  
- [x] **As-of** / last quote refresh timestamp  
- [x] US session indicator (RTH open/closed) — align with existing policy hours  
- [x] Watchlist columns: Symbol · Last · Chg% (Chg optional later; flash optional)  
- [x] Ticket: TIF Day (UI even if sim is simple at first); clear **Review paper order**  
- [x] Blotter tabs: **Positions | Orders | Fills** with broker-like row labels  
- [x] Keep preflight modal (policy + TTL + confirm)  

### Phase 2 — Red/green chart on symbol pick ⭐ team favorite

**Goal:** Tap AAPL → chart paints market path in green/red.

**v1 choice (locked):**

| Priority | Option | Rule |
|----------|--------|------|
| **1st try** | **B. Candles** | Use if daily OHLC from market cascade is solid |
| **Fallback** | **A. Line / area** | Same layout; green/red stroke by day direction |
| **Not v1** | **C. Embed** | TradingView only if own chart blocked later |

**Chart scope for v1:**

- [x] Renders when user selects a symbol from watchlist  
- [x] Timeframes: **1D primary + 1M toggle** day one  
- [x] Large last price + day change % above chart  
- [x] Data from existing market cascade (FMP / etc.; Yahoo unofficial fallback)  
- [x] Loading / empty / error states (don’t show a fake chart)  
- [x] Source + age badge: e.g. `FMP · 12s ago`  
- [x] Mobile: chart height capped; doesn’t push ticket off forever  
- [x] Up/down color: **pure green / pure red** for series; brand accent reserved for PAPER badge and chrome  
- [x] Always show +/− and % text (not color-only)  

**Out of Phase 2:** drawings, 50 indicators, multi-pane, Level 2, options chain.

### Phase 3 — Order lifecycle (process realism) — **after feel pass**

Today many paper fills are effectively **instant**. More real:

- [ ] Working limits when price not through  
- [ ] Statuses: working / filled / cancelled / policy rejected  
- [ ] Cancel working order  
- [ ] Optional: fill rules documented in UI (“paper fills vs last/mark…”)  

### Phase 4 — Later / optional

- Bid/ask if vendor supports  
- SL/TP fields  
- Hotkeys on desktop  
- TradingView embed only if own chart is too slow to ship  
- Paper challenges / leaderboard  

---

## 6. Data & API notes (for implementers)

| Need | Existing / likely | Notes |
|------|-------------------|--------|
| Quote last / change % | `/market/quote`, `/market/quotes` | Rate limited per user |
| OHLC bars | Marketdata cascade + broker `get_bars` | Prefer reliable **daily** OHLC first; badge source |
| Portfolio MTM | PaperSim marks + `set_mark` from quotes | Chart + positions should share mark when possible |
| Session hours | Policy engine RTH logic | Surface as UI clock, don’t reimplement randomly |

**Risk:** Chart looks “dead” if bars fail — always pair chart with refresh + honest empty state. **No fake bars.**

---

## 7. Success criteria

Someone who used Webull/TradingView paper for five minutes should think:

> “Same *kind* of screen — chart, ticket, blotter — but paper + Grok + confirm.”

Not:

> “Cute chatbot with a form.”

**Metrics (soft):**

- Time-to-first-paper-fill on mobile stays low  
- Users pick a symbol and interact with chart before ticket (engagement)  
- No support confusion “did I trade live?” (PAPER still obvious)  

---

## 8. Explicit non-goals

- Live multi-tenant brokerage  
- Guaranteed returns / “Grok prints money”  
- Replacing Webull as full charting terminal  
- Removing human confirm for speed  

---

## 9. First implementation sprint (locked scope)

1. **Phase 1 chrome** (blotter tabs, denser watchlist, session/as-of, TIF Day UI)  
2. **Phase 2 chart** on symbol select (candles if bars OK, else line)  
3. Keep control plane and mobile ticket priority  

**Stop and feel.** Do not start Phase 3 until chart + chrome feel right.

---

## 10. Open questions — resolved

See §12 Decision log.

---

## 11. Related product context

- Control plane and multi-user paper: `PROJECT_CONTEXT.md`, `docs/MULTI_USER_PAID.md`  
- Go-live (Clerk/Stripe): `docs/PRODUCTION_HARDINESS.md`  
- Positioning: practice before real money; Grok = research opinion, user confirms  

---

## 12. Decision log (Grok team bounce 2026-07-18)

| Date | Decision | Notes |
|------|----------|--------|
| 2026-07-18 | **Chart v1 = B candles, fallback A line** | Never C embed for v1. Own UI + PAPER badge. Try candles on daily OHLC; if sparse/slow, same-PR line fallback. |
| 2026-07-18 | **Default TF = 1D primary + 1M toggle day one** | 1D alone is thin for beginners; 1M context is cheap once bars path works. Skip extra TFs. |
| 2026-07-18 | **Desktop = chart above ticket (center column)** | Full-width under header risks ticket below fold. Matches “see price → act.” |
| 2026-07-18 | **Phase 3 strictly after feel pass** | Sprint = Phase 1 chrome + Phase 2 chart only. Working orders change mental model; don’t couple to chart risk. |
| 2026-07-18 | **Up/down = pure green / pure red** | Brand accent for PAPER badge + chrome only. Always pair with +/− and % text (a11y). |
| 2026-07-18 | **Bar source = existing cascade, badge honestly** | Prefer reliable daily OHLC; no fake volume/bars. Empty/error states required. |
| 2026-07-18 | **Sprint scope locked** | Phase 1 + Phase 2 → stop and feel → then Phase 3. |

**Voters:** Grok (lead), Harper, Lucas — aligned. Benjamin: no dissent recorded in window.

---

**Status:** Phase 1 + Phase 2 + any-ticker implemented.  
**Next:** Team bounce on Phase 3 fill model — see [`TRADE_FLOOR_TEAM_STATUS.md`](./TRADE_FLOOR_TEAM_STATUS.md).
