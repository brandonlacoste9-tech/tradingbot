# Trade floor Phase 3 — hybrid order lifecycle

**Product:** IndieTrades · https://indietrades.com/trade  
**Status:** **Shipped** — owner locked C hybrid + freeze  
**Date:** 2026-07-18  
**Team vote:** https://github.com/brandonlacoste9-tech/tradingbot/issues/1  
**Depends on:** Phase 1 chrome + Phase 2 chart shipped (`9ae7e4e`, `cb9370c`)  

**Related:** [`TRADE_FLOOR_REALISM_PLAN.md`](./TRADE_FLOOR_REALISM_PLAN.md) · [`TRADE_FLOOR_TEAM_STATUS.md`](./TRADE_FLOOR_TEAM_STATUS.md)  

---

## 1. Owner vote (locked lean)

| # | Question | Decision |
|---|----------|----------|
| 1 | Feel pass | **Ship** Phase 1–2 as baseline. Polish only honesty/clarity (as-of, PAPER, source age). Do **not** rethink product map. |
| 2 | Fill model | **C — Hybrid** (simple, documented rules). Not pure A; not pure B first. |
| 3 | Scope freeze | Yes — working limits, cancel, statuses, documented fill rules, Day TIF only. |
| 4 | “Real money” risks | Audit LIVE wording, paper account line, PaperSim confirm copy, status path for resting orders, Clerk prod keys (ops), chart source/age. |

**Spirit:** B’s working blotter + A’s speed for aggressive fills. Document always. No fake tape. Human confirm stays sacred.

---

## 2. Why hybrid (C)

| Why not pure A | Why not pure B first |
|----------------|----------------------|
| Instant-only makes Orders theater | Full working-book complexity before users understand the loop |
| “Instant form → position” undercuts the desk story | Harder to ship, more support surface |

Chart + any-ticker + blotter chrome already look like a desk **if Orders starts meaning something**. That is Phase 3’s job — not more chrome.

---

## 3. Hybrid fill rules (locked for implementers)

All paths: **policy → human confirm (TTL) → PaperSim**. Never LLM submit. Never invent prints, Level 2, or hidden matching.

| After confirm | Condition | Result |
|---------------|-----------|--------|
| **Aggressive** | Buy limit **≥** last/mark, or sell limit **≤** last/mark (or market if ever allowed) | **Instant paper fill** at last/mark — keep first-win **&lt;30s** |
| **Passive** | Buy limit **&lt;** last, or sell limit **&gt;** last | Status **`working`** until last/mark trades through, **Day TIF** cancel/expire, or **user cancel** |
| **Always** | Document in UI + short “How fills work” note | Users must not assume exchange matching |

**Mark source:** same cascade/quote path used by desk; badge honesty unchanged.

**Polling:** evaluate working orders on quote refresh / short server tick (implementation detail) — no fake tape.

---

## 4. Status table (one vocabulary)

Use these names in API + UI (map existing `policy_status` / order records as needed):

| Status | Meaning |
|--------|---------|
| `awaiting_confirm` | Proposal passed policy; waiting human confirm (TTL) |
| `policy_rejected` | Policy denied before submit |
| `working` | Confirmed passive limit resting (paper book) |
| `filled` | PaperSim filled (aggressive at confirm, or passive after cross) |
| `cancelled` | User cancelled working order |
| `expired` | Day TIF / session end (or TTL on proposal — label clearly) |

**Blotter mapping**

| Tab | Shows |
|-----|--------|
| **Orders** | `working` (+ optional recent cancelled/expired) |
| **Fills** | `filled` history |
| **Positions** | Open paper positions after fills |

Preflight modal stays for `awaiting_confirm` only.

---

## 5. Phase 3 freeze — in scope

- [x] Working passive limits after confirm  
- [x] Cancel working order  
- [x] Statuses per §4 table  
- [x] Documented fill rules (ticket copy + “How fills work” tip/FAQ)  
- [x] **Day TIF only** (UI already shows Day; enforce expire/cancel rule)  
- [x] Orders tab real data (not Phase 3 placeholder)  
- [x] Loud **PAPER** on working banner / confirm success  

### Out of Phase 3

- SL/TP  
- Level 2 / bid-ask  
- Partials (unless trivial same PR)  
- Multi-leg  
- Live routing / multi-tenant brokerage  
- Extra TIFs (GTC, IOC, …)  

---

## 6. Honesty polish (parallel, small — not chrome redesign)

Only where clarity slips:

- Prefer **Quotes · delayed / market data** over any **LIVE** without PAPER adjacent  
- One line under account strip: **Simulated paper account — not a broker**  
- Fill success: **PaperSim fill · not a live broker confirmation**  
- Keep chart **source · age**  

Ops (not UX): Clerk **live** keys + Stripe E2E before ads — see `PRODUCTION_HARDINESS.md`.

---

## 7. Success criteria (Phase 3)

Someone should think:

> “I can get a fast paper fill when I’m aggressive, and my limit sits in Orders until it works or I cancel — still obviously paper.”

Not:

> “Orders tab is empty theater”  
> or  
> “This matched on a real exchange.”

---

## 8. Implementation notes (sketch — not a full design yet)

1. On confirm: classify aggressive vs passive using last/mark at confirm time.  
2. Aggressive → existing fill path; journal `filled`.  
3. Passive → persist working order; skip immediate cash/position change.  
4. On quote/mark update: if buy limit ≥ last or sell ≤ last → fill once; else leave working.  
5. Cancel endpoint for working only.  
6. Day TIF: cancel/expire open working at US RTH close (or documented simpler daily job).  
7. Tests: aggressive fill, passive rest, cross-then-fill, cancel, no fill invent.

**Control plane remains sacred.**  

---

## 9. Team confirm

**Issue #1:** https://github.com/brandonlacoste9-tech/tradingbot/issues/1  

(Repo Discussions are not enabled — Issue is the vote thread.)

Comment **`C`** (or dissent **`A`/`B`** + reason).  

When no material dissent: **implement Phase 3 only — no scope creep.**
