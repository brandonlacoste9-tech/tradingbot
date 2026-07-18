# Stripe end-to-end runbook (P1)

PR3 code is shipped. This is env + Dashboard + verification only.

## 1. Stripe Dashboard

**Live products (set 2026-07-18):**

| Plan | Product | Price ID | Env |
|------|---------|----------|-----|
| Pro $29/mo | `prod_UuOr5XTY4bkMWP` | `price_1Tua3nCzqBvMqSYFpymfph1u` | **`STRIPE_PRICE_ID_PRO`** (Checkout uses this) |
| Pro+ $59/mo | `prod_UuOrg6uejcujT8` | `price_1Tua3oCzqBvMqSYFgbmKQo5G` | `STRIPE_PRICE_ID_PRO_PLUS` (stored for later; not in Checkout yet) |

1. ~~Create Pro price~~ done — use Pro price above.
2. **Developers → API keys** → Secret key on Render (`sk_live_...` set).
3. **Developers → Webhooks → Add endpoint**
   - URL: `https://tradingbot-api-0990.onrender.com/billing/webhook`
   - Events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` (`whsec_...`)
4. **Settings → Billing → Customer portal** → enable cancel / update payment method.

## 2. Render env (`tradingbot-api`)

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_SUCCESS_URL=https://hilarious-piroshki-08d173.netlify.app/?billing=success
STRIPE_CANCEL_URL=https://hilarious-piroshki-08d173.netlify.app/?billing=cancel
# leave STRIPE_DEV_MODE unset/false in prod
```

Redeploy API. Confirm `GET /health` includes `"stripe_configured": true` (if exposed) or `/billing/status` → `stripe_configured: true`.

## 3. Verify

```bash
# As a signed-in Clerk user (Bearer token) or temporarily AUTH_MODE=disabled + X-User-Id:

curl -s -H "Authorization: Bearer $TOKEN" \
  https://tradingbot-api-0990.onrender.com/billing/status

# Expect plan=free, limits.chat_per_day, stripe_configured=true

# From UI: Billing panel → Upgrade to Pro → complete Checkout test card 4242...
# Webhook should set plan=pro

# Portal: Manage subscription opens Stripe portal
```

Chat cap: free hits 429 after free daily limit; Pro after webhook should allow more.

## 4. Hard rules

- Never commit Stripe secrets.
- Test mode first; swap to live keys only when ready to charge.
- Control plane unchanged (policy + confirm still required).
