# Production hardiness — Clerk + Stripe

**Product:** IndieTrades · https://indietrades.com  
**Goal:** Ready for real customers (not just friends/beta).  
**Sacred path unchanged:** research → policy → confirm → paper.

---

## Status snapshot (as of last ship)

| Item | Status |
|------|--------|
| Multi-user paper desk | Live |
| `AUTH_MODE=clerk` on API | Live |
| Postgres + PaperSim | Live |
| Stripe keys + prices on API | Configured (verify live E2E) |
| Frontend Clerk | Often still **`pk_test_`** — **swap before paid ads** |
| Control plane | Live |

---

## Part A — Clerk production (do this first)

### Why

`pk_test_` / `sk_test_` are **development**. Fine for beta; not for hard paid traffic, production sessions, or production OAuth branding.

### A1. Clerk Dashboard

1. Open [dashboard.clerk.com](https://dashboard.clerk.com) → **IndieTrades** (or create **Production** instance if you only have Development).
2. Prefer a **Production** instance (not `*.clerk.accounts.dev` only).
3. **Domains**
   - Application domain: `indietrades.com` (and `www` if used)
   - Satellite / allowed origins as Clerk UI requires
4. **Paths** (App Router)
   - Sign-in / sign-up: modal or hosted — match what the app uses today (modal is fine)
5. **API keys** (Production)
   - Publishable: `pk_live_...`
   - Secret: `sk_live_...`
6. **JWT / Backend API**
   - Issuer will look like `https://clerk.indietrades.com` or `https://xxxx.clerk.accounts.dev` depending on setup
   - JWKS: `{ISSUER}/.well-known/jwks.json`

### A2. Netlify (`apps/web` / monorepo base)

Set **production** env (Site → Environment variables → Production):

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_API_URL=https://tradingbot-api-0990.onrender.com
NEXT_PUBLIC_APP_URL=https://indietrades.com
```

Optional:

```env
GOOGLE_SITE_VERIFICATION=0yPwOioMKL-oZJEJdUwjUJLqfDO6qKvDKjsQ_o7PPao
```

**Redeploy** Netlify after changing `NEXT_PUBLIC_*` (must rebuild).

### A3. Render API (`tradingbot-api`)

```env
AUTH_MODE=clerk
REQUIRE_CLERK_AUTH=true
CLERK_ISSUER=https://YOUR_PRODUCTION_ISSUER
CLERK_JWKS_URL=https://YOUR_PRODUCTION_ISSUER/.well-known/jwks.json
CORS_ORIGINS=https://indietrades.com,https://www.indietrades.com,http://localhost:3000
```

Keep:

```env
BROKER_BACKEND=sim
REQUIRE_SIM_BROKER=true
PAPER_ONLY=true
```

### A4. Verify Clerk prod

| Check | Expect |
|--------|--------|
| View source / Network on indietrades.com | Scripts load **`pk_live_`** (not `pk_test_`) |
| Sign out → Sign in | Works on production domain |
| Sign in → AI Desk chat | No 401 spam |
| Sign in → Trade floor ticket | Works |
| Sign in → `/plans` upgrade | Opens Checkout when Stripe ready |
| Incognito new account | Sign-up works |

### A5. Security

- Never commit `sk_live_` / `sk_test_`
- Rotate any key that was pasted into chat or committed by mistake
- After switching to live, re-test OAuth redirects if you enable Google/GitHub social

---

## Part B — Stripe E2E (one real customer path)

Code is shipped (Checkout, Portal, webhook, Pro / Pro+ prices). This is **Dashboard + one successful loop**.

### B1. Stripe Dashboard

| Item | Value |
|------|--------|
| Pro price | `price_1Tua3nCzqBvMqSYFpymfph1u` → `STRIPE_PRICE_ID_PRO` |
| Pro+ price | `price_1Tua3oCzqBvMqSYFgbmKQo5G` → `STRIPE_PRICE_ID_PRO_PLUS` |
| Webhook URL | `https://tradingbot-api-0990.onrender.com/billing/webhook` |
| Events | `checkout.session.completed`, `customer.subscription.created/updated/deleted` |
| Portal | Enable cancel / update payment method |

### B2. Render Stripe env

```env
STRIPE_SECRET_KEY=sk_live_...   # or sk_test_ for a dry run first
STRIPE_WEBHOOK_SECRET=whsec_... # from THIS endpoint’s signing secret
STRIPE_PRICE_ID_PRO=price_1Tua3nCzqBvMqSYFpymfph1u
STRIPE_PRICE_ID_PRO_PLUS=price_1Tua3oCzqBvMqSYFgbmKQo5G
STRIPE_SUCCESS_URL=https://indietrades.com/plans?billing=success
STRIPE_CANCEL_URL=https://indietrades.com/plans?billing=cancel
# STRIPE_DEV_MODE must be unset or false in production
```

**Important:** If Checkout succeeds but plan stays free, the **webhook signing secret** does not match — re-copy `whsec_` from Stripe for the Render URL only.

### B3. One E2E run (test mode first recommended)

1. Sign in on https://indietrades.com  
2. Open https://indietrades.com/plans  
3. Confirm plan chip shows **FREE**  
4. Click **Upgrade to Indie Pro** (or Pro+)  
5. Complete Checkout  
   - **Test mode:** card `4242 4242 4242 4242`, any future expiry, any CVC  
   - **Live mode:** real card (charges real money)  
6. Land on `/plans?billing=success`  
7. Refresh plan chip → **PRO** or **PRO_PLUS**  
8. Confirm usage limit increased (e.g. free 25 → Pro ~10k chats/day)  
9. **Manage billing** → Stripe Customer Portal opens  
10. Optional: cancel in portal → webhook → plan back to free  

### B4. Webhook debug

Stripe → Developers → Webhooks → endpoint → recent deliveries:

| Symptom | Fix |
|---------|-----|
| 401/400 signature | Wrong `STRIPE_WEBHOOK_SECRET` |
| 503 webhook not configured | Missing secret on Render |
| 200 but plan free | `user_id` metadata missing / wrong customer map — check checkout `client_reference_id` + subscription metadata |
| No events | Wrong URL (must be **API** host, not Netlify) |

### B5. API quick checks

```bash
# Slim health (public)
curl -s https://tradingbot-api-0990.onrender.com/health

# With Clerk session JWT from browser (Application → Cookies / Network Authorization):
curl -s -H "Authorization: Bearer $CLERK_JWT" \
  https://tradingbot-api-0990.onrender.com/billing/status
```

Expect: `stripe_configured: true`, `plan` matching subscription after checkout.

---

## Part C — Go-live gate (all green before ads)

- [ ] Clerk **pk_live_** on Netlify production  
- [ ] Clerk **sk_live_** on Netlify production  
- [ ] API `CLERK_ISSUER` + `CLERK_JWKS_URL` match production instance  
- [ ] Sign-in / sign-up on indietrades.com works  
- [ ] Stripe webhook **200** on checkout.session.completed  
- [ ] One user flipped free → pro via real Checkout  
- [ ] Portal manage works  
- [ ] `STRIPE_DEV_MODE` off  
- [ ] Paper still default (`BROKER_BACKEND=sim`, `PAPER_ONLY=true`)  
- [ ] No secrets in git  

---

## Order of operations

1. **Stripe test-mode E2E** (prove webhook) if not already done  
2. **Clerk production keys** + Netlify rebuild  
3. **Stripe live** only when ready to charge  
4. Then traffic  

Control plane stays sacred. No live multi-tenant brokerage in this pass.
