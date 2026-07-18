# PR3 — Stripe billing

## What shipped

| Endpoint | Purpose |
|----------|---------|
| `GET /billing/status` | Plan, limits, stripe ready |
| `POST /billing/checkout` | Stripe Checkout session (Pro) |
| `POST /billing/portal` | Customer Portal |
| `POST /billing/webhook` | Subscription lifecycle |
| `POST /billing/dev-set-plan` | Local plan flip when `STRIPE_DEV_MODE=true` |

| UI | Billing panel with Upgrade / Manage |

| Gating | Free plan daily chat cap (default 25) on `/agent/chat` |

## Env vars (Render API)

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_SUCCESS_URL=https://hilarious-piroshki-08d173.netlify.app/?billing=success
STRIPE_CANCEL_URL=https://hilarious-piroshki-08d173.netlify.app/?billing=cancel
# optional local:
# STRIPE_DEV_MODE=true
# FREE_CHAT_PER_DAY=25
```

## Stripe Dashboard setup

1. Create Product **Pro** (recurring monthly, e.g. $29 CAD).
2. Copy **Price ID** → `STRIPE_PRICE_ID_PRO`.
3. Developers → Webhooks → Add endpoint:
   - URL: `https://tradingbot-api-0990.onrender.com/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.created`
4. Copy signing secret → `STRIPE_WEBHOOK_SECRET`.
5. Customer Portal: Settings → enable cancel/update.

## Without Stripe keys

- API still runs; `stripe_configured: false`.
- UI shows **Dev: set Pro** (only works if `STRIPE_DEV_MODE=true` on API).
- Free chat caps still apply in memory (and Postgres if available).

## Plans

| Plan | Default chats/day |
|------|-------------------|
| free | 25 |
| pro | 10_000 |
| pro_plus | 50_000 |

## Postgres

PR3 schema adds Stripe columns + `usage_daily`. Applied automatically when DB is connected.

## Not legal advice

Selling software access to a paper desk — keep disclaimers; no real-money management.
