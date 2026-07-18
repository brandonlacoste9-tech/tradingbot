# tradingbot

**L2 paper-trading AI dashboard** — Claude-style agent orchestration over **Alpaca paper trading**.

Repo: [brandonlacoste9-tech/tradingbot](https://github.com/brandonlacoste9-tech/tradingbot)

Control plane (enforced):

```
User message
  → (LLM or demo path) creates TradeProposal
  → policy engine (pure Python, never LLM)
  → if rejected → journal + return
  → if allowed → status = awaiting_confirm + expires_at
  → PreflightModal (impact + countdown)
  → user Confirm (within TTL)
  → re-check status + TTL
  → Alpaca paper submit (with client_order_id)
  → journal + audit
```

`decide_hold` always succeeds and only journals.  
**No path** lets the LLM (or the demo) submit an order without the confirm gate.

---

## Quick start (&lt; 10 minutes, paper only)

### Prerequisites

- Docker Desktop
- Python 3.11+
- Node.js 20+
- Free [Alpaca](https://app.alpaca.markets) **paper** API keys

### 1. Env

```bash
cd tradingbot
cp .env.example .env
# Edit .env — set ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY (paper)
```

### 2. Database

```bash
docker compose up -d db
```

### 3. Backend

```bash
cd apps/api
python -m venv .venv

# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 4. Frontend

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000

### 5. Try it

1. “What is my buying power?”
2. “Propose a limit buy of 1 share of SPY”
3. Confirm in the preflight modal (countdown TTL)
4. Check journal / orders in the UI

---

## What’s included

| Area | Status |
|------|--------|
| Policy engine (pure + tests) | Yes |
| Preflight + Confirm TTL (default 180s) | Yes |
| `client_order_id` idempotency | Yes |
| `decide_hold` / do-nothing | Yes |
| Connection validate → `last_validated` + `is_paper` | Yes |
| Keyword demo chat (no LLM key required) | Yes |
| Real LLM tool loop | Stub in `agent/loop.py` |
| Live trading | **Not wired** |
| Clerk / multi-tenant encrypted vault | **Not wired** |
| Scheduled bots | **Not wired** |

## Safety

- Paper-only by construction (`PAPER_ONLY=true`, paper base URL)
- Secrets never leave the backend
- Policy is pure functions + unit tests
- Every order has a unique `client_order_id`
- Proposals expire server-side

## Tests

```bash
cd apps/api
pytest -q
```

## Deploy (Netlify — frontend only)

Netlify hosts the **web UI** (`apps/web`). It does **not** run the FastAPI backend.

### Netlify settings (or use root `netlify.toml`)

| Setting | Value |
|---------|--------|
| Base directory | `apps/web` |
| Build command | `npm run build` |
| Publish directory | `apps/web/out` (with base set, `out`) |
| Node | 20 |

### Environment variables (Netlify UI → Site config → Environment)

```
NEXT_PUBLIC_API_URL=https://YOUR-API-HOST
```

Without this, the UI loads but shows **API down** (it expects `http://localhost:8000` only in local dev).

### Why you saw “Page not found”

Deploying from the **repo root** publishes nothing useful (no `index.html`). The app must build from `apps/web` with publish dir `out` (static export).

### Backend

Run FastAPI separately (local, Railway, Render, Fly.io, etc.) and set `NEXT_PUBLIC_API_URL` + CORS on the API to your Netlify domain.

## Next moves

- Wire real LLM tool-calling into `agent/loop.py` using `tools/schemas.py`
- Encrypted per-user connections + Clerk
- Journal history + equity curve
- BYO-keys vs Broker API compliance matrix

---

**Not investment advice.** Educational paper-trading tooling only. Past performance does not predict future results. Always use paper keys until you understand the system end-to-end.
