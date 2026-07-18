# IndieTrades

**Product:** [indietrades.com](https://indietrades.com)  
**Repo:** [brandonlacoste9-tech/tradingbot](https://github.com/brandonlacoste9-tech/tradingbot)

Claude-style **paper trading desk**: Grok researches → **pure policy engine** → **human confirm (TTL)** → **per-user PaperSim**.

> **Agents / Grok:** read [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) and [`docs/TEAM_HANDOFF.md`](./docs/TEAM_HANDOFF.md).

## Control plane (enforced)

```
User message
  → agent (Grok or demo tools) propose / hold only
  → policy engine (pure Python — never the LLM)
  → awaiting_confirm + TTL
  → Preflight UI → human Confirm
  → re-check policy + TTL
  → PaperSim submit (client_order_id)
  → journal + audit (per tenant)
```

**Hard rules:** LLM never submits. Policy never skipped. Paper default.  
**Canada:** no Alpaca for the owner. SaaS default broker is **sim**. IBKR is owner-local only (never multi-tenant on one Render service).

## Live

| Surface | URL |
|---------|-----|
| Web | Netlify / indietrades.com |
| API | https://tradingbot-api-0990.onrender.com |
| Health | `GET /health` |

Stack: Clerk JWT · Postgres · Stripe Checkout · xAI Grok · FMP/AV/Massive data.

## Local API

```powershell
cd apps\api
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# optional: docker compose up -d db
$env:AUTH_MODE="disabled"
$env:BROKER_BACKEND="sim"
uvicorn app.main:app --reload --port 8000
```

## Local web

```powershell
cd apps\web
copy .env.local.example .env.local   # set NEXT_PUBLIC_API_URL + Clerk keys
npm install
npm run dev
```

## Production posture (Render)

```env
AUTH_MODE=clerk
BROKER_BACKEND=sim
PAPER_ONLY=true
REQUIRE_CLERK_AUTH=true
REQUIRE_SIM_BROKER=true
EXPOSE_OPENAPI_DOCS=false
PUBLIC_HEALTH_VERBOSE=false
```

## Docs

| Doc | Topic |
|-----|--------|
| `docs/TEAM_HANDOFF.md` | What’s shipped |
| `docs/PR1_AUTH_TENANCY.md` | Auth |
| `docs/PR2_POSTGRES.md` | Persistence |
| `docs/PR3_STRIPE.md` / `STRIPE_RUNBOOK.md` | Billing |
| `docs/PR4_QUOTAS_KILL_SWITCH.md` | Quotas / admin |
| `docs/MASSIVE_MARKET_DATA.md` | Market data |
| `docs/IBKR_SETUP.md` | Owner IBKR paper |

## Legal

Educational paper trading. Not investment advice. Not a broker.
