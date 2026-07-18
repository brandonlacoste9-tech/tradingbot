# PR4 — Quotas, LLM circuit breaker, admin kill switch

Cost protection and ops controls for the multi-user paper desk.

## What shipped

| Piece | Behavior |
|-------|----------|
| **Usage snapshot** | `GET /billing/status` → `usage.used / limit / remaining` (no increment) |
| **Chat quota** | Free-tier daily cap still enforced on `POST /agent/chat` (429) |
| **LLM circuit breaker** | After N provider failures in a window → open; demo fallback (or 503) until cooldown |
| **Global kill switch** | Blocks chat + confirm + policy kill on proposes |
| **Per-user kill** | Same, scoped to one `user_id` |
| **Admin API** | `X-Admin-Key: $ADMIN_API_KEY` |

## Config (Render env)

| Variable | Default | Purpose |
|----------|---------|---------|
| `ADMIN_API_KEY` | empty | Enables `/admin/*`; set a long random secret |
| `GLOBAL_KILL_SWITCH` | `false` | Bootstrap kill on process start (hard off) |
| `FREE_CHAT_PER_DAY` | `25` | Free plan daily chat cap |
| `LLM_BREAKER_FAILURE_THRESHOLD` | `5` | Failures before open |
| `LLM_BREAKER_WINDOW_SECONDS` | `60` | Failure window |
| `LLM_BREAKER_COOLDOWN_SECONDS` | `120` | Time open before half-open probe |
| `LLM_BREAKER_OPEN_MODE` | `demo` | `demo` = fall back to demo agent; `block` = HTTP 503 |

## Admin endpoints

All require header `X-Admin-Key: <ADMIN_API_KEY>`.

```http
GET  /admin/status
POST /admin/kill-switch
     {"enabled": true, "reason": "incident"}           # global
     {"enabled": true, "user_id": "uid", "reason": ""} # one user
POST /admin/llm-breaker/reset
GET  /admin/usage/{user_id}
```

### Examples

```bash
# Status
curl -s -H "X-Admin-Key: $ADMIN_API_KEY" \
  https://tradingbot-api-0990.onrender.com/admin/status

# Global pause
curl -s -X POST -H "X-Admin-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"reason":"xAI spend spike"}' \
  https://tradingbot-api-0990.onrender.com/admin/kill-switch

# Resume
curl -s -X POST -H "X-Admin-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"enabled":false,"reason":"all clear"}' \
  https://tradingbot-api-0990.onrender.com/admin/kill-switch

# Reset LLM circuit
curl -s -X POST -H "X-Admin-Key: $ADMIN_API_KEY" \
  https://tradingbot-api-0990.onrender.com/admin/llm-breaker/reset
```

## User-visible

- **Billing panel**: used / limit / remaining; paused banner if kill active; LLM circuit warning.
- **`GET /health`**: `global_kill`, `llm_circuit`, `admin_api_configured`, `version`.
- **Chat 503**: kill switch or (optional) open circuit in `block` mode.
- **Chat 429**: daily quota exhausted.

## Notes

- Kill switch and breaker are **in-process**. On multi-instance Render, set `GLOBAL_KILL_SWITCH=true` + redeploy for a hard global off, or call admin on each instance. Single web service is the current deploy shape.
- Policy engine `kill_switch` is wired from admin controls on propose + confirm re-check.
- Admin API is **not** Clerk — it is a separate ops secret. Do not put `ADMIN_API_KEY` on Netlify.

## Tests

```bash
cd apps/api
pytest tests/test_pr4_controls.py tests/test_billing.py -q
```
