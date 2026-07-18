# Market data (FMP + Massive)

External **quotes / bars / news** for research and PaperSim marks.  
Not brokers — orders still go through PaperSim / IBKR paper only.

## Providers

| Env | Provider | Best for |
|-----|----------|----------|
| `FMP_API_KEY` | [Financial Modeling Prep](https://financialmodelingprep.com/) | Quotes + multi-day EOD history (`/stable/*`) |
| `MASSIVE_API_KEY` | [Massive](https://massive.com/) (Polygon host) | News, prev-close fallback |
| `MASSIVE_BASE_URL` | default `https://api.polygon.io` | Compatible REST base |
| `FMP_BASE_URL` | default `https://financialmodelingprep.com` | FMP base |

**Cascade:** FMP → Massive → PaperSim/broker seed.

**Never** reuse these keys as `ADMIN_API_KEY`.

## What free tiers typically unlock

### FMP (`/stable`)

| Feature | This desk |
|---------|-----------|
| Quote | Yes |
| Profile | Yes |
| EOD history (full/light) | Yes |
| Stock news | Often paid (402) |
| Batch quote | Often paid (402) |
| Legacy `/api/v3/*` | Often 403 on new keys — we use `/stable` only |

### Massive / Polygon

| Feature | Free/basic |
|---------|------------|
| Prev-day OHLC | Yes |
| News | Yes |
| Real-time last trade / NBBO | No (403) |
| Multi-day range | Often no (403) |
| Rate limit | ~5/min |

## Desk integration

- Tools: `get_quote`, `get_bars`, `get_news`
- Proposal limit prices use market-data last when available
- PaperSim `set_mark` updates portfolio marks from real quotes
- Failures fall back to sim seeds

## Endpoints

```http
GET /health          → fmp_configured, massive_configured, market_data
GET /market/status   → provider probe (auth)
```

## Ops

1. Set `FMP_API_KEY` and/or `MASSIVE_API_KEY` on **Render only**  
2. Keep a separate random `ADMIN_API_KEY` for kill switch  
3. Confirm `GET /health` → `"fmp_configured": true`  
4. Chat “quote AAPL” → `source: fmp` when FMP is set  
