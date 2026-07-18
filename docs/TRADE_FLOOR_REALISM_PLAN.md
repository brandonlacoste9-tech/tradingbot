# Trade floor realism plan — for Grok team review

**Product:** IndieTrades · https://indietrades.com  
**Surface:** `/trade` (paper trading floor)  
**Status:** Planning only — not implementation yet  
**Date:** 2026-07-18  

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

### Desktop

```
┌─────────────────────────────────────────────────────────────┐
│  PAPER ONLY · Net liq · Cash · BP · Day P&L · as-of time    │
├──────────────┬────────────────────────────┬─────────────────┤
│  Watchlist   │  Selected: AAPL  last  %   │  (or full width │
│  Sym Last %  │  ┌──────────────────────┐  │   chart under   │
│  ...         │  │  RED / GREEN CHART   │  │   ticket)       │
│              │  └──────────────────────┘  │                 │
│              │  Order ticket              │                 │
│              │  [Buy/Sell] qty limit TIF  │                 │
│              │  [Review paper order]      │                 │
├──────────────┴────────────────────────────┴─────────────────┤
│  Tabs: Positions | Orders (working) | Fills                   │
└─────────────────────────────────────────────────────────────┘
```

### Mobile (already partly there)

1. Bottom nav: AI Desk · **Trade** · Plans  
2. Account chips  
3. **Selected symbol + chart**  
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

- [ ] Denser account header (real vocabulary: Net liq / Cash / BP / Day P&L / Open P&L)  
- [ ] **As-of** / last quote refresh timestamp  
- [ ] US session indicator (RTH open/closed) — align with existing policy hours  
- [ ] Watchlist columns: Symbol · Last · Chg · Chg% (flash on update optional)  
- [ ] Ticket: TIF Day (UI even if sim is simple at first); clear **Review paper order**  
- [ ] Blotter tabs: **Positions | Orders | Fills** with broker-like row labels  
- [ ] Keep preflight modal (policy + TTL + confirm)  

### Phase 2 — Red/green chart on symbol pick ⭐ team favorite

**Goal:** Tap AAPL → chart paints market path in green/red.

**Preferred v1 options (choose in implementation):**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Line / area** | Close series; stroke green if day up else red | Fast, clean | Less “candles” |
| **B. Candles** | OHLC green/red bodies | Most “stock market” | Needs solid bars |
| **C. Embed** | TradingView lightweight widget | Instant pro look | Third-party, less brand control |

**Team leaning:** **B if bar quality is good, else A first** — own the UI, brand colors, PAPER badge stays.

**Chart scope for v1:**

- [ ] Renders when user selects a symbol from watchlist  
- [ ] Timeframes: start with **1D** (intraday if data allows) + **5D** or **1M**  
- [ ] Large last price + day change % above chart  
- [ ] Data from existing market cascade (FMP / etc.; Yahoo unofficial fallback)  
- [ ] Loading / empty / error states (don’t show a fake chart)  
- [ ] Source + age badge: e.g. `FMP · 12s ago`  
- [ ] Mobile: chart height capped; doesn’t push ticket off forever  

**Out of Phase 2:** drawings, 50 indicators, multi-pane, Level 2, options chain.

### Phase 3 — Order lifecycle (process realism)

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
| OHLC bars | Marketdata cascade + broker `get_bars` | Confirm which TF is reliable in prod |
| Portfolio MTM | PaperSim marks + `set_mark` from quotes | Chart + positions should share mark when possible |
| Session hours | Policy engine RTH logic | Surface as UI clock, don’t reimplement randomly |

**Risk:** Chart looks “dead” if bars fail — always pair chart with refresh + honest empty state.

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

## 9. Suggested first implementation sprint

When planning leaves “bounce” mode:

1. **Phase 1 chrome** (blotter tabs, denser watchlist, session/as-of)  
2. **Phase 2 chart** on symbol select (line or candles)  
3. Keep control plane and mobile ticket priority  

**Do not start Phase 3 until chart + chrome feel right.**

---

## 10. Open questions for the Grok team

1. **Chart type for v1:** line (A) vs candles (B) vs temporary embed (C)?  
2. **Default timeframe:** 1D only first, or 1D + 1M day-one?  
3. **Desktop layout:** chart above ticket (center column) vs chart full-width under header?  
4. **Bar source priority** in production (FMP daily vs intraday availability)?  
5. **Working orders (Phase 3)** same sprint as chart, or strictly after?  
6. Any brand constraint on pure green/red vs theme accent for up days?  

---

## 11. Related product context

- Control plane and multi-user paper: `PROJECT_CONTEXT.md`, `docs/MULTI_USER_PAID.md`  
- Go-live (Clerk/Stripe): `docs/PRODUCTION_HARDINESS.md`  
- Positioning: practice before real money; Grok = research opinion, user confirms  

---

## 12. Decision log (fill after team bounce)

| Date | Decision | Notes |
|------|----------|--------|
| | | |

---

**End of plan — for review, not a build ticket until approved.**
