# PROJECT CONTEXT — for Grok / agents (read this first)

**Last updated:** 2026-07-18  
**Owner:** Brandon (Canada)  
**Repo:** https://github.com/brandonlacoste9-tech/tradingbot  
**Local path:** `C:\Users\north\tradingbot`

---

## One-line pitch

We are building a **Claude-style AI trading desk**: the AI does most of the **research work** (web search, news, market context), then a **hard-coded policy engine** and **human confirm** gate every order. Execution is **paper-first**. Broker is **not Alpaca** for the owner (Canada).

---

## What we are NOT building

- Not a real stock exchange / matching engine  
- Not “guaranteed alpha” black-box YouTube bots  
- Not fully autonomous live trading without caps  
- Not Alpaca-for-Canadians (Alpaca **does not accept Canadian residents**)  
- Not discretionary portfolio management for other people’s money (v1)

---

## Product levels

| Level | Description | Status |
|-------|-------------|--------|
| **L1** | Personal agent (CLI / chat + broker) | Partial |
| **L2** | Web app: chat, policy, preflight, journal, paper default | **Live (single shared sim demo)** |
| **L2-Paid** | Multi-user SaaS: auth, per-user paper, Stripe, quotas | **Current product target** |
| **L3** | Embedded real brokerage / live multi-tenant | Later + counsel |

**Current focus: paid multi-user (per-user PaperSim + Grok + billing).**  
See **[docs/MULTI_USER_PAID.md](./docs/MULTI_USER_PAID.md)**.

---

## Core control plane (non-negotiable)

```
User message
  → AI researches (web + data tools) and may propose trade OR decide_hold
  → Deterministic policy engine (pure code — NEVER the LLM)
  → if rejected → journal + return
  → if allowed → status = awaiting_confirm + expires_at (TTL, default 180s)
  → Preflight UI (impact, thesis, countdown)
  → User Confirm within TTL
  → Re-check policy + TTL
  → Broker submit (client_order_id / idempotency)
  → Journal + immutable audit
```

**Hard rules:**

1. LLM **proposes**; policy **decides**; human **confirms**; broker **executes**.  
2. `decide_hold` / do-nothing is first-class (always journal).  
3. `policy_status` enum:  
   `proposed | policy_rejected | awaiting_confirm | confirmed | submitted | filled | cancelled | expired`  
4. Paper-only by default forever for new users/bots.  
5. Market as **educational research + order-routing tool**, not investment advice.

---

## Product thesis (user-confirmed)

> **The AI can do most of the work by searching the web.**

Value is:

- Research / synthesis / thesis writing  
- Structured propose vs hold  
- Risk gates + audit  

Not: proprietary secret neural net that “prints money.”

### Agent tools (target)

- `web_search` / news / filings context  
- `get_account`, `get_positions`, `get_quote`, `get_bars`  
- `propose_order` (limit preferred)  
- `decide_hold`  
- `journal_entry`  
- `compute_impact` / preflight  

---

## Canada / broker constraint (critical)

| Broker | For this owner |
|--------|----------------|
| **Alpaca** | **Cannot use** — Canadian residents not eligible |
| **Interactive Brokers Canada** | **Intended replacement** for execution |
| Questrade | Weak for DIY order API (often partner-only) |
| Wealthsimple | No real algo API |

**IBKR note:** Retail IBKR usually has **no Alpaca-style API key pair**. Access is via:

- **TWS / IB Gateway** (socket ports: TWS paper **7497**, Gateway paper **4002**)  
- **Client Portal Gateway** (login + 2FA, paper has separate username)  
- OAuth/Web API keys mainly for institutions  

Pivot: `brokers/alpaca.py` → **IBKR paper adapter** (host/port/clientId or CP gateway).

---

## Current stack (what exists in repo)

```
tradingbot/
├── apps/web/          # Next.js 15, static export for Netlify
│   ├── Chat, PreflightModal (TTL countdown)
│   └── NEXT_PUBLIC_API_URL → backend
├── apps/api/          # FastAPI
│   ├── policy/engine.py   # pure, unit-tested
│   ├── brokers/alpaca.py  # paper client (BLOCKED for CA owner)
│   ├── agent/loop.py      # demo keyword path; LLM stub
│   ├── tools/schemas.py   # Claude-style tool schemas
│   └── schema.sql         # Postgres model (in-memory store in MVP)
├── netlify.toml
├── render.yaml
└── PROJECT_CONTEXT.md     # this file
```

### Deployed URLs

| Surface | URL |
|---------|-----|
| Frontend (Netlify) | https://hilarious-piroshki-08d173.netlify.app |
| Backend (Render) | https://tradingbot-api-0990.onrender.com |
| Health | https://tradingbot-api-0990.onrender.com/health |
| GitHub | https://github.com/brandonlacoste9-tech/tradingbot |

Netlify env: `NEXT_PUBLIC_API_URL=https://tradingbot-api-0990.onrender.com`  
Render: free tier (cold starts); was wired for Alpaca env vars — **re-point for IBKR**.

---

## Research foundation (earlier)

- Anthropic “Agents for financial services” (May 2026) = enterprise research/ops agents, **not** retail order routing.  
- Viral “Claude trading” = LLM + MCP/tools + broker (Alpaca/Public).  
- Marketplace peers (TraderGPT, TradeLab, Ensemble, etc.) — we differentiate with **policy + confirm + audit**.  
- YouTube “best AI bot” hype (e.g. DaviddTech) = inspiration only, not architecture.

---

## Related local paths

| Path | Notes |
|------|--------|
| `C:\Users\north\tradingbot` | **Canonical project** |
| `C:\Users\north\ai-trading-bot` | Early copy; prefer tradingbot |
| `C:\Users\north\cli` | Clone of `alpacahq/cli` (less relevant for CA) |
| `C:\Users\north\go\bin\alpaca.exe` | Alpaca CLI installed via Go (paper login timed out; blocked for CA use) |

---

## Done vs next

### Done

- [x] L2 product spec + control plane design  
- [x] Scaffold: FastAPI + Next.js + policy tests (12 passed)  
- [x] Preflight + TTL + client_order_id design  
- [x] Netlify static deploy live  
- [x] Render API deploy live  
- [x] Confirmed Canada cannot use Alpaca  

### Next (priority order)

1. [x] **Broker abstraction** — `sim` (default) | `ibkr` skeleton | `alpaca`  
2. [x] **Web research tools** — `web_search` tool + demo keywords  
3. [x] Grok/xAI LLM live on Render (`LLM_PROVIDER=xai`)  
4. [x] Desk UI: health chips, portfolio stats, positions, auto-validate  
5. [x] **IBKR paper path** — hardened client, `/broker/status`, `docs/IBKR_SETUP.md`, scripts  
6. [x] **PR1 tenancy** — user-scoped store + per-user PaperSim + auth modes (disabled/clerk)  
7. [x] **PR2** Postgres persistence (hydrate/flush; falls back to memory)  
8. [ ] **PR3** Stripe → **PR4** quotas  
9. [ ] Clerk SignIn UI when publishable key configured  
10. [ ] Owner optional: IBKR Gateway local; not SaaS default  

---

## How Grok should behave in this repo

1. Read this file at session start.  
2. Prefer **IBKR / Canada-legal** execution; do not assume Alpaca keys work for the owner.  
3. Never let LLM bypass policy or confirm.  
4. Prefer paper; never enable live without explicit user request.  
5. Don’t commit secrets; don’t paste API keys into the repo.  
6. Small focused diffs; keep monorepo structure.  
7. When unsure of product direction, default to: **web research agent + policy + confirm + paper IBKR**.

---

## Example user flows (ship these)

- “Search the web for NVDA news and say if a small paper buy is justified under 5% rules.”  
- “If research is weak, decide_hold and journal why.”  
- “Propose limit buy 1 share SPY — wait for my confirm.”  
- “Show today’s journal and any rejected proposals.”

---

## Legal posture (defaults)

- Educational research + execution helper  
- Paper default  
- User confirms trades  
- Full audit trail  
- Not investment advice  
- Fintech counsel before multi-user live money  

---

**End of context.** Continue the conversation from here; ask the user which next step (IBKR adapter vs web-research tools) if unclear.
