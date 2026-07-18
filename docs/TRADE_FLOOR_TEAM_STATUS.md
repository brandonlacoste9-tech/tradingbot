# Trade floor — team status bounce

**Product:** IndieTrades · https://indietrades.com/trade  
**Audience:** Grok product/eng team (Harper, Lucas, Benjamin + lead)  
**Date:** 2026-07-18  
**Status:** Phase 1–2 **shipped** · Owner **locked Phase 3 = C hybrid + freeze** · team confirm on GitHub  

**Related plan:** [`TRADE_FLOOR_REALISM_PLAN.md`](./TRADE_FLOOR_REALISM_PLAN.md)  
**Phase 3 spec:** [`TRADE_FLOOR_PHASE3.md`](./TRADE_FLOOR_PHASE3.md)  

---

## 1. What we shipped

| Commit | What |
|--------|------|
| `9ae7e4e` | Phase 1 chrome + Phase 2 chart |
| `cb9370c` | Any ticker — watchlist Open + ticket auto-watch |

- Desk chrome: Net liq · RTH · as-of · watchlist · blotter tabs · TIF Day · PAPER  
- Chart: candles → line fallback · 1D+1M · pure green/red · source/age · no fake bars  
- Any US ticker via Open / ticket symbol · localStorage watch · × remove  

**Control plane unchanged:** research (optional) → policy → human confirm → PaperSim.

---

## 2. Real paper desk vs fake live broker

| Real (good) | Wrong (bad) |
|-------------|-------------|
| Desk look + process | Looks like live brokerage |
| Honest data badges | Fake Level 2 / invented bars |
| You confirm every order | LLM auto-submit |
| Loud PAPER + PaperSim | Silent “live” language |

---

## 3. Phase 3 vote — owner lock (team: confirm or dissent)

### 1. Feel pass → **Ship**

Ship Phase 1–2 as baseline. Polish only honesty/clarity (as-of, PAPER, source age). Don’t rethink product map — Trade floor is the right **act** surface.

**Notes:** Chart + any-ticker + blotter chrome are enough to look like a desk **if Orders starts meaning something**. That’s the Phase 3 job, not more chrome.

### 2. Fill model → **C Hybrid**

| Why not pure A | Why not pure B first |
|----------------|----------------------|
| Instant-only makes Orders theater | Full working-book complexity before users understand the loop |
| “Instant form → position” undercuts the desk story | Harder to ship, more support surface |

**Hybrid rules:**

- **Aggressive** (limit through last, or market if ever allowed): instant paper fill at last/mark after confirm — first-win **&lt;30s**  
- **Passive** (buy &lt; last, sell &gt; last): **working** until last trades through, Day TIF expire, or user cancel  
- Never invent prints, Level 2, or hidden matching  

### 3. Freeze Phase 3 → **Yes**

**In:** working limits · cancel · statuses · documented fill rules · Day TIF only  

**Out:** SL/TP · Level 2 · bid/ask · partials (unless trivial) · multi-leg · live routing  

Statuses table: see [`TRADE_FLOOR_PHASE3.md`](./TRADE_FLOOR_PHASE3.md) §4  
(`awaiting_confirm` → `working` / `filled` / `cancelled` / `expired` + `policy_rejected`)

### 4. What still risks “this is real money”

- Any **LIVE** wording without PAPER adjacent (prefer **Quotes · delayed** / market data)  
- Net liq / BP without **simulated paper account** line  
- Fill success that looks like broker confirm without **PaperSim / not a broker**  
- Instant-only with no resting path → users assume exchange matching  
- Clerk **dev** keys + polished desk (ops trust)  
- Pro charts without **source/age** (already required — keep it)  

### Lean (locked for implement)

**C, not A.** B’s spirit (working + cancel + statuses), A’s speed for aggressive fills. Document always. No fake tape. Human confirm stays sacred.

---

## 4. How to vote on GitHub

**Issue #1:** https://github.com/brandonlacoste9-tech/tradingbot/issues/1  

(Discussions not enabled on repo — Issue is the vote thread.)

Comment:

- **`C`** — agree with hybrid + freeze  
- **`A` / `B`** — dissent + one sentence why  
- Optional polish notes (honesty only)

When team locks **C + freeze**, eng implements **Phase 3 only** — no scope creep.

---

**Previous status:** Awaiting Phase 3 bounce.  
**Now:** Owner vote recorded; awaiting in-thread confirm.
