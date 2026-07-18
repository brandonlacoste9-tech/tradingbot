# Massive market data

[Massive.com](https://massive.com/) provides US stocks/options/crypto/forex data via a Polygon-compatible REST API.

This is **market data only** — not a broker. Paper trading still uses PaperSim / IBKR paper. Canadians use sim or IBKR; Massive does not place orders.

## Env (Render API only)

| Variable | Purpose |
|----------|---------|
| `MASSIVE_API_KEY` | Your Massive dashboard API key |
| `MASSIVE_BASE_URL` | Default `https://api.polygon.io` (compatible host) |

**Do not** reuse this key as `ADMIN_API_KEY`. Keep admin ops and market data separate.

## What free/basic typically unlocks

| Feature | Free/basic |
|---------|------------|
| Prev-day OHLC | Yes |
| Ticker reference | Yes |
| News | Yes |
| Financials / indicators | Often yes |
| Real-time last trade / NBBO | No (403) |
| Multi-day historical range | Often no (403) |
| Rate limit | ~5 calls/min (429 if exceeded) |

## How the desk uses it

- Agent tools `get_quote`, `get_bars`, `get_news` prefer Massive when configured
- Proposal limit pricing uses Massive prev close when available
- PaperSim marks update via `set_mark` so portfolio marks track real prev close
- Falls back to sim seed prices on error / rate limit

## Endpoints

```http
GET /health                 → massive_configured, market_data
GET /market/status          → exchange open/closed (auth)
```

## Ops checklist

1. Set `MASSIVE_API_KEY` on Render  
2. Set a **different** random `ADMIN_API_KEY` for kill switch  
3. Confirm `GET /health` → `"massive_configured": true`  
4. Chat: “quote AAPL” should return `source: massive` (delayed prev session)
