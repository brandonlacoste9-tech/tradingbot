# Stripe end-to-end runbook

PR3 code is shipped. This is env + Dashboard + **one successful Checkout loop**.

Full go-live checklist (Clerk + Stripe): **[PRODUCTION_HARDINESS.md](./PRODUCTION_HARDINESS.md)**

---

## 1. Stripe Dashboard

**Live products (set 2026-07-18):**

| Plan | Product | Price ID | Env |
|------|---------|----------|-----|
| Pro $29/mo | `prod_UuOr5XTY4bkMWP` | `price_1Tua3nCzqBvMqSYFpymfph1u` | **`STRIPE_PRICE_ID_PRO`** |
| Pro+ $59/mo | `prod_UuOrg6uejcujT8` | `price_1Tua3oCzqBvMqSYFgbmKQo5G` | **`STRIPE_PRICE_ID_PRO_PLUS`** |

1. **Developers → API keys** → `STRIPE_SECRET_KEY` on Render (`sk_test_` first, then `sk_live_`).
2. **Developers → Webhooks → endpoint**
   - ✅ `https://tradingbot-api-0990.onrender.com/billing/webhook`
   - ❌ Not the Next.js site
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Signing secret → `STRIPE_WEBHOOK_SECRET`
3. **Settings → Billing → Customer portal** → enable cancel / update payment.

---

## 2. Render env (`tradingbot-api`)

```env
STRIPE_SECRET_KEY=sk_test_...   # or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_1Tua3nCzqBvMqSYFpymfph1u
STRIPE_PRICE_ID_PRO_PLUS=price_1Tua3oCzqBvMqSYFgbmKQo5G
STRIPE_SUCCESS_URL=https://indietrades.com/plans?billing=success
STRIPE_CANCEL_URL=https://indietrades.com/plans?billing=cancel
# STRIPE_DEV_MODE=  (unset/false in production)
```

UI Checkout also passes `window.location.origin` success/cancel so local/dev stays correct.

Confirm via signed-in:

```bash
curl -s -H "Authorization: Bearer $CLERK_JWT" \
  https://tradingbot-api-0990.onrender.com/billing/status
# stripe_configured: true
```

---

## 3. One E2E run

1. Sign in on https://indietrades.com  
2. https://indietrades.com/plans → plan **FREE**  
3. Upgrade to **Indie Pro** (or Pro+)  
4. Pay with test card `4242…` (test mode) or real card (live)  
5. Return `?billing=success` → plan chip **PRO** / **PRO_PLUS**  
6. **Manage billing** → Customer Portal  
7. Stripe webhook delivery **200** for `checkout.session.completed`

If plan stays free: re-sync **webhook signing secret** for the Render URL.

---

## 4. Hard rules

- Never commit Stripe secrets  
- Test mode first; live keys only when ready to charge  
- Control plane unchanged (policy + confirm still required)  
- Webhook hits **API**, not Netlify  
