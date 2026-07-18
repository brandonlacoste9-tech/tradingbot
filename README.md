# tradingbot

**L2 paper-trading AI dashboard** — Claude-style agent orchestration: **AI researches the web**, policy gates risk, human confirms, broker executes (paper-first).

> **Agents / Grok:** read [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) for full product context, Canada/IBKR constraints, deploy URLs, and next steps.

Repo: [brandonlacoste9-tech/tradingbot](https://github.com/brandonlacoste9-tech/tradingbot)

**Owner constraint:** Canadian residents cannot use Alpaca. Execution path is pivoting to **Interactive Brokers Canada (paper)**.

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

### IBKR paper (Canada — local)

Production Netlify/Render stays on **PaperSim**. For real IBKR paper fills on your PC:

1. Read **[docs/IBKR_SETUP.md](./docs/IBKR_SETUP.md)**  
2. IB Gateway → **Paper** → API port **4002**  
3. `.\scripts\run-api-ibkr.ps1`  
4. `.\scripts\check-ibkr.ps1`  
5. Web UI with `NEXT_PUBLIC_API_URL=http://localhost:8000`

### Backend (Render)

This repo includes a **Render Blueprint** at `render.yaml` for the FastAPI API.

1. [Render Dashboard → New → Blueprint](https://dashboard.render.com/select-repo?type=blueprint)
2. Connect `brandonlacoste9-tech/tradingbot`
3. Apply the blueprint → service **`tradingbot-api`**
4. In the service → **Environment**, set secrets:
   - `ALPACA_API_KEY_ID` (paper)
   - `ALPACA_API_SECRET_KEY` (paper)
5. After deploy, note the service URL, e.g. `https://tradingbot-api.onrender.com`
6. On **Netlify** → Site env:
   - `NEXT_PUBLIC_API_URL=https://tradingbot-api.onrender.com`
7. Trigger a Netlify redeploy so the frontend picks up the API URL

Health check: `GET /health`

Local API still works: `uvicorn app.main:app --reload --port 8000` from `apps/api`.

## Next moves

- Wire real LLM tool-calling into `agent/loop.py` using `tools/schemas.py`
- Encrypted per-user connections + Clerk
- Journal history + equity curve
- BYO-keys vs Broker API compliance matrix

---

**Not investment advice.** Educational paper-trading tooling only. Past performance does not predict future results. Always use paper keys until you understand the system end-to-end.
