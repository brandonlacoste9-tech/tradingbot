# Paid multi-user product plan

**Audience:** paying multi-user (not just a public demo, not owner-only IBKR).  
**Constraint:** owner + many CA users → **Alpaca is not a viable default broker**.  
**Date:** 2026-07-18

---

## Product definition (v1)

**Name:** IndieTrades — [indietrades.com](https://indietrades.com) (paper desk)

**What users pay for**

- Personal **paper** portfolio (isolated)
- **Grok** research agent (web search + thesis)
- **Policy engine** + preflight confirm (not blind auto-trade)
- Journal / audit history
- Optional strategy presets later

**What v1 is not**

- Not real-money brokerage for other people’s cash (that’s RIA / BD territory)
- Not shared “one sim for everyone”
- Not Alpaca-for-Canadians
- Not hosted IBKR Gateway for every user on free Render (unworkable as-is)

**Positioning**

> Educational AI research + paper trading desk. Not investment advice.  
> Paper only until a licensed brokerage path exists per user.

---

## Canada-safe execution model

| Mode | v1 | Later |
|------|----|--------|
| **Cloud PaperSim (per user)** | **Default product** | Keep forever for free tier / trial |
| **BYO IBKR** (user runs Gateway + API keys / connection) | Optional pro add-on | Power users only |
| **Alpaca** | US-only if ever | Do not market to CA |
| **Embedded brokerage (Broker API / IIROC partner)** | No | L3 + counsel + capital |

**v1 money is for software access, not for holding client securities.**

---

## Pricing sketch (adjust later)

| Plan | Price (CAD/mo) | Includes |
|------|----------------|----------|
| **Free trial** | $0 / 7–14 days | Limited Grok messages/day, 1 paper book |
| **Pro** | $19–39 | Higher message caps, history, export journal |
| **Pro+** | $49–79 | Higher caps, priority models, BYO IBKR docs/support |

**Metering that matters**

- LLM tokens / chat turns (your main cost)
- Optional: web search volume

**Billing:** Stripe (Checkout + Customer Portal + webhooks).  
**Auth:** Clerk (or Auth0) — email + Google.

---

## Architecture (target)

```
User (browser)
  → Netlify (Next.js)
  → Clerk session
  → Render / Fly API (FastAPI)
       ├─ Stripe webhooks (subscription status)
       ├─ Postgres (users, plans, journals, proposals, sim state)
       ├─ Per-user PaperSim state (or tables, not process memory)
       ├─ Grok (xAI) with per-user quotas
       └─ Policy engine (unchanged control plane)
```

### Data model additions (high level)

- `users` — clerk_id, email, plan, stripe_customer_id  
- `subscriptions` — status, price_id, current_period_end  
- `usage_counters` — user_id, day, chat_count, token_estimate  
- `paper_accounts` — user_id, cash, equity snapshot  
- `paper_positions` / `paper_orders` / `trade_proposals` / `journals` / `audit_events` — **all scoped by user_id**

### Hard multi-tenant rules

1. Every query filters `user_id` (never trust client-supplied id alone).  
2. JWT from Clerk verified on API.  
3. Sim state **not** global singleton `MemoryStore` forever — migrate to DB.  
4. Rate limit: IP + user_id.  
5. Soft delete / export for account closure (privacy).

---

## Control plane (unchanged product law)

```
research → propose | hold → policy → confirm (TTL) → paper submit → journal
```

LLM never submits. Policy never skipped for paid users either.

---

## MVP build order (paid multi-user)

### PR1 — Auth + tenancy foundation
- Clerk on Next.js  
- FastAPI verifies Clerk JWT  
- `user_id` on all new writes  
- Postgres on Render (or Neon)  
- Replace process-global store for proposals/journal/orders with DB rows  

### PR2 — Per-user PaperSim in DB
- Cash, positions, orders per user  
- Idempotent `client_order_id` unique per user  
- Restart-safe portfolio  

### PR3 — Stripe
- Checkout for Pro  
- Webhook → `subscriptions.status`  
- Gating: free tier message cap vs Pro  
- Customer portal (cancel/upgrade)  

### PR4 — Quotas + cost protection ✅
- Daily chat limit free vs paid + usage snapshot in billing UI  
- Circuit breaker if xAI errors/spend spike  
- Admin kill switch (`docs/PR4_QUOTAS_KILL_SWITCH.md`)  


### PR5 — Product polish
- Onboarding (risk persona, disclaimer accept)  
- Billing page  
- “Paper / educational” banners everywhere  
- Basic email (receipts via Stripe)  

### PR6 — Optional Pro feature
- BYO IBKR connection guide + local bridge (advanced; not required for launch)

---

## Legal / compliance (non-negotiable for paid)

Not legal advice — talk to a Canadian fintech-aware lawyer before charging.

| Topic | v1 posture |
|-------|------------|
| Advice | Explicitly **not** investment advice |
| Discretion | No auto-live; human confirm; paper default |
| Securities | You’re selling **software**, not managing money |
| Marketing | No “guaranteed returns”, no “AI will make you rich” |
| Privacy | Privacy policy + data retention |
| Tax | GST/HST if applicable (Stripe Tax / accountant) |

If you later execute **live** trades for users or manage accounts → registration questions get real (IIROC / registration exemptions). Stay paper + BYO for v1.

---

## What you already have (reuse)

| Asset | Reuse |
|-------|--------|
| Control plane | Keep |
| Grok tool loop | Keep |
| Netlify + Render | Keep |
| PaperSim logic | Promote to **per-user DB** |
| Desk UI | Keep; add login + billing pages |
| IBKR client | Pro/advanced later, not launch blocker |

---

## Launch criteria (paid multi-user v1)

- [ ] Login works  
- [ ] User A cannot see User B data  
- [ ] Portfolio survives API restart  
- [ ] Stripe test → live subscription gates Pro  
- [ ] Free tier cannot burn unlimited Grok  
- [ ] Disclaimers accepted on signup  
- [ ] Status page / support email  
- [ ] Lawyer skim of terms  

---

## Recommended first implementation

**Start PR1: Clerk + Postgres + user-scoped store.**  
Without that, “paying multi-user” is not real.

Cloud broker stays **sim** for all paying users in v1.  
IBKR remains a **power-user local** path, not the SaaS default.
