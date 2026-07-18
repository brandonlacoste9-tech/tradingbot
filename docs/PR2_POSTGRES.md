# PR2 — Postgres persistence

## What shipped

| Piece | Detail |
|-------|--------|
| **schema_pr2.sql** | `app_users`, `paper_accounts`, `paper_positions`, `trade_proposals`, `paper_orders`, `journals`, `audit_events` |
| **asyncpg pool** | Optional; auto-init on API startup |
| **Hydrate** | Tenant store + PaperSim load from DB on first use |
| **Flush** | Proposals, journals, orders, audit, paper state after writes |
| **Fallback** | If no DB, memory-only (same as PR1) |

## Health

```json
{ "postgres": true, "tenancy": { "backend": "postgres", "tenant_count": N } }
```

If `postgres: false`, API still works in memory (data lost on restart).

## Local setup

```powershell
cd C:\Users\north\tradingbot
docker compose up -d db
# DATABASE_URL=postgresql://trading:trading@localhost:5432/ai_trading
cd apps\api
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Schema is applied automatically via `init_pool()` on startup.

## Render / production

1. Create **Render Postgres** (or Neon) and copy **Internal/External DATABASE_URL**
2. Set on `tradingbot-api`:
   ```env
   DATABASE_URL=postgresql://...
   ```
3. Redeploy API  
4. Confirm `GET /health` → `"postgres": true`

Do **not** set `DATABASE_URL_DISABLED=true` unless debugging memory-only mode.

## Isolation + durability

| Layer | Behavior |
|-------|----------|
| User A vs B | Separate sim books + journals (PR1) |
| Restart | With Postgres: books/journals reload (PR2) |
| Free Render spin-down | Memory cleared; Postgres keeps data |

## Not in PR2

- Stripe (PR3)
- Quotas (PR4)
- Clerk SignIn UI
