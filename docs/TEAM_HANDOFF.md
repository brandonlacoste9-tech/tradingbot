# Grok team handoff — AI Trading Desk (L2-Paid)

**Date:** 2026-07-18  
**Repo:** https://github.com/brandonlacoste9-tech/tradingbot  
**Owner:** Brandon (Canada)  
**Status:** Multi-user paper desk is **live** with **Clerk auth**, Grok research, market data cascade, billing/quotas hooks.

Read **[PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)** first. This file is the “what we shipped” brief.

---

## One-line for the team

We built a **Claude-style paper trading desk**: Grok researches → deterministic policy → human confirm (TTL) → per-user PaperSim. **Not** autonomous live money. **Not** Alpaca for the owner (Canada). SaaS path is multi-user + Clerk + Stripe + quotas.

---

## Live surfaces

| Surface | URL |
|---------|-----|
| Web | https://hilarious-piroshki-08d173.netlify.app |
| API | https://tradingbot-api-0990.onrender.com |
| Health | https://tradingbot-api-0990.onrender.com/health |
| GitHub | https://github.com/brandonlacoste9-tech/tradingbot |
| Local web | `apps/web` → `npm run dev` → http://localhost:3000 |
| Local API | `apps/api` → uvicorn `app.main:app` |

---

## Control plane (do not break)

```
chat → agent tools (research / quote / propose / hold)
     → policy engine (pure code)
     → awaiting_confirm + TTL
     → human Confirm/Reject
     → paper broker submit (client_order_id)
     → journal + audit
```

**Hard rules for any Grok session:**

1. LLM never submits orders.  
2. Policy never skipped.  
3. Paper-only by default.  
4. No Alpaca assumption for Canadian owner.  
5. Never commit secrets.

---

## What shipped (chronological PRs / workstreams)

### Platform & brokers
- Monorepo: FastAPI (`apps/api`) + Next.js App Router (`apps/web`)
- Broker backends: **`sim`** (default SaaS) | `ibkr` (local Gateway paper) | `alpaca` (US-only code path)
- IBKR paper docs + `/broker/status` (owner optional local Gateway)
- Policy engine unit-tested (kill switch, position %, daily loss, etc.)

### PR1 — Tenancy
- Per-user store: proposals, journal, orders, audit
- Per-user PaperSim ($100k)
- Auth: `AUTH_MODE=disabled` (demo `X-User-Id`) or **`clerk`** (Bearer JWT)

### PR2 — Postgres
- asyncpg hydrate/flush for tenants/sim when `DATABASE_URL` set
- Graceful fallback to memory if Postgres missing

### PR3 — Stripe
- Checkout / portal / webhook
- Free vs Pro plans + free daily chat cap
- Dev plan flip when `STRIPE_DEV_MODE=true`

### PR4 — Cost / ops
- Usage snapshot on `/billing/status`
- LLM circuit breaker (open after provider failure spike)
- Admin kill switch (global / per-user) via `X-Admin-Key`
- Docs: `docs/PR4_QUOTAS_KILL_SWITCH.md`

### Market data (not brokers)
Cascade: **FMP → Alpha Vantage → Massive → sim**
- Quotes / bars prefer FMP
- News prefers Alpha Vantage (sentiment)
- PaperSim marks update from live-ish quotes
- Docs: `docs/MASSIVE_MARKET_DATA.md`

### Plaid (optional bank link)
- Scaffold only: `GET /plaid/status`, `POST /plaid/link-token`
- Sandbox keys on Render — **not** wired into main UX yet
- Docs: `docs/PLAID.md`

### Desk UX v1
- Paper disclaimer banner
- Status strip + usage meter
- How-it-works (research → propose → policy → confirm)
- Chat quick prompts + compact tool chips
- Preflight modal with TTL progress bar
- Empty states / loading skeletons

### Clerk (live)
- `@clerk/nextjs` App Router
- `src/proxy.ts` + `src/middleware.ts` with `clerkMiddleware()` (matcher includes `/__clerk/:path*`)
- `ClerkProvider` + header `<Show>` / SignIn / SignUp / UserButton
- Geist fonts; JWT sync via `ClerkTokenSync` → API `Authorization: Bearer`
- Netlify: Next runtime (`@netlify/plugin-nextjs`) — **no longer pure static `out/`**
- Render: `AUTH_MODE=clerk`, `CLERK_ISSUER`, `CLERK_JWKS_URL` for instance `creative-rodent-96.clerk.accounts.dev`
- **Owner confirmed: Clerk is live**

---

## Env map (where secrets go)

| Secret / config | Host | Notes |
|-----------------|------|--------|
| `XAI_API_KEY`, `LLM_PROVIDER=xai` | Render | Grok research |
| `FMP_API_KEY`, `MASSIVE_API_KEY`, `ALPHA_VANTAGE_API_KEY` | Render | Market data |
| `ADMIN_API_KEY` | Render | Kill switch / breaker reset only |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | Render | Bank link scaffold |
| Stripe keys | Render | Checkout (test/live) |
| `DATABASE_URL` | Render | Optional Postgres |
| `AUTH_MODE`, `CLERK_ISSUER`, `CLERK_JWKS_URL` | Render | JWT verify |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Netlify + local `.env.local` | Frontend auth |
| `NEXT_PUBLIC_API_URL` | Netlify / local | Points at Render API |

**Never** put secrets in git or Netlify as `NEXT_PUBLIC_*` except the publishable Clerk key.

---

## Architecture snapshot

```
[Browser Netlify Next.js + Clerk]
        │  Bearer JWT + API calls
        ▼
[Render FastAPI]
  ├── auth (Clerk JWKS)
  ├── billing/usage + Stripe
  ├── admin kill + LLM breaker
  ├── marketdata (FMP/AV/Massive)
  ├── agent loop (xAI Grok tool use)
  ├── policy engine
  ├── tenancy + PaperSim (mem or Postgres)
  └── plaid scaffold
```

---

## Known gaps / next for the team

| Priority | Item |
|----------|------|
| P0 | ~~Enable Render **Postgres**~~ **DONE 2026-07-18** (`tradingbot-db`, `postgres: true`) |
| P1 | Stripe **test/live** fully wired end-to-end for paying Pro |
| P1 | Clerk allowed origins / production polish if any edge 401s |
| P2 | Onboarding (disclaimer accept, risk persona) |
| P2 | Plaid Link UI (keys already on API) |
| P3 | Owner IBKR Gateway (local only — not multi-tenant SaaS default) |
| P3 | OpenBB / deeper research tools |

---

## How to verify in 2 minutes

```bash
# API
curl -s https://tradingbot-api-0990.onrender.com/health

# Expect roughly: ok, paper_only, llm_provider=xai, fmp_configured,
# alphavantage_configured, massive_configured, auth_mode=clerk (or similar)
```

Web: open Netlify or localhost:3000 → **Sign in** → UserButton → chat “Quote AAPL” → expect market data source `fmp` (or cascade). Propose → preflight → confirm paper.

---

## Docs index

| Doc | Topic |
|-----|--------|
| `PROJECT_CONTEXT.md` | Agent bible |
| `docs/MULTI_USER_PAID.md` | Product model |
| `docs/PR1_AUTH_TENANCY.md` | Auth/tenancy |
| `docs/PR2_POSTGRES.md` | Persistence |
| `docs/PR3_STRIPE.md` | Billing |
| `docs/PR4_QUOTAS_KILL_SWITCH.md` | Quotas / admin |
| `docs/MASSIVE_MARKET_DATA.md` | FMP / AV / Massive |
| `docs/PLAID.md` | Bank link scaffold |
| `docs/IBKR_SETUP.md` | Owner IBKR paper |

---

## Message for the next Grok session

> Desk is live with Clerk. Continue L2-Paid: prefer Postgres + Stripe hardening and product polish. Do not enable live multi-tenant brokerage. Keep policy + confirm sacred. Canada → PaperSim default; IBKR is owner-local only.

**Owner note (2026-07-18):** “Clerk is live.” Treat auth as production-path, not aspirational.
