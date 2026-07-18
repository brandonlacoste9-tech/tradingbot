# Plaid (optional bank linking)

[Plaid](https://plaid.com/) connects **bank accounts** (balances, transactions, identity).  
It is **not** market data and **not** a broker.

| Concern | Provider |
|---------|----------|
| Quotes / bars / news | FMP, Alpha Vantage, Massive |
| Paper trading | PaperSim / IBKR paper |
| Bank link (optional) | **Plaid** |
| Ops kill switch | `ADMIN_API_KEY` |

## Env (Render API only)

| Variable | Required | Notes |
|----------|----------|--------|
| `PLAID_CLIENT_ID` | yes | Dashboard → team settings |
| `PLAID_SECRET` | yes for Link | Sandbox / Development / Production secret |
| `PLAID_ENV` | no | `sandbox` (default), `development`, `production` |

Never put these on Netlify as `NEXT_PUBLIC_*`.

## API

```http
GET  /plaid/status          # readiness flags
POST /plaid/link-token      # Link token for Plaid Link UI (auth required)
GET  /health                # includes plaid block
```

`POST /plaid/link-token` returns 503 until **both** client id and secret are set.

## Canada note

Plaid supports Canadian institutions in some products; coverage varies.  
Paper desk works fully **without** Plaid.

## Next steps to finish Link

1. Paste **sandbox secret** from Plaid dashboard  
2. Keep `PLAID_ENV=sandbox` until verified  
3. Add Plaid Link JS/React on the web app (call `/plaid/link-token`)  
4. Exchange `public_token` → `access_token` (backend endpoint still to add)  
