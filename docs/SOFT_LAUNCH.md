# Soft launch — operate IndieTrades (friends / organic)

**Product:** https://indietrades.com  
**Status:** Ready for friends & soft launch (feel-check greenlit 2026-07-18)  
**Not yet:** paid ads, hard paid traffic (needs Clerk prod + Stripe E2E + support)  

**Related:** [`TEAM_STATUS.md`](./TEAM_STATUS.md) · [`PRODUCTION_HARDINESS.md`](./PRODUCTION_HARDINESS.md)

---

## 1. What soft launch means

| In | Out |
|----|-----|
| Friends, colleagues, small organic invites | Paid ads / big influencer blasts |
| Free paper practice | Promising live brokerage |
| Feedback on desk feel + bugs | Guaranteed uptime / SLA |
| Clerk Development keys OK | “Production auth hard” claims |

**Promise you can make:**  
> Practice stock trading here before real money. Virtual cash. Real symbols. You confirm every paper trade. Not a live broker.

**Promise you must not make:**  
> Live trading · guaranteed returns · Grok prints money · this is your broker.

---

## 2. Operator pre-flight (you, 10 minutes)

Run once before first invites:

- [ ] https://indietrades.com loads (marketing home)  
- [ ] https://tradingbot-api-0990.onrender.com/health → `ok`, `paper_only`, `sim`, `clerk`  
- [ ] Sign out → sign in (email or Google) works  
- [ ] `/trade` → **Paper budget** → e.g. $50k → Book P&L ~ $0  
- [ ] Aggressive limit through last → **Fills**  
- [ ] Passiveive limit below last → **Orders** shows symbol + limit + Cancel  
- [ ] `/desk` loads (Grok optional; chat caps on free OK)  
- [ ] `/plans` loads  
- [ ] PAPER / “not a broker” language still obvious  

**Optional cleanup:** cancel any leftover test working orders on your book.

---

## 3. Invite copy (paste-ready)

### Short (SMS / iMessage / X DM)

```text
Trying something new — IndieTrades is a paper trading desk (fake money, real stock symbols). Chart, ticket, blotter. You confirm every order. Not a real broker.

https://indietrades.com

Takes 5 min: sign in → Trade → set paper budget → pick a symbol → review paper order. Tell me what feels confusing.
```

### Email / longer

**Subject:** Practice trading before real money (paper only)

```text
Hey —

I built IndieTrades: a paper trading floor so you can practice the process before real money is on the line.

• Real tickers (AAPL, SPY, …)
• Virtual cash (you pick a paper budget)
• Chart + ticket + orders/fills
• Optional Grok research on AI Desk
• You confirm every paper trade — not a live broker

Start: https://indietrades.com
Then: Trade floor → Paper budget → pick a symbol → Review paper order

If something breaks or confuses you, reply with a screenshot. Paper only — no real money.

Thanks
```

### Group chat (Discord / Slack / WhatsApp)

```text
Soft launch: IndieTrades.com — paper trading desk (practice before real money).
Not Webull live. Not financial advice. Virtual cash + real symbols + you confirm.
Feedback welcome: /trade flow, anything that looks “too live,” mobile ticket.
```

---

## 4. What to tell people in the first minute

1. **Paper only** — virtual cash; not a deposit; not a broker.  
2. Start on **Trade** (`/trade`), not necessarily the AI chat.  
3. Set **Paper budget** if they want $20k / $50k practice size.  
4. **Aggressive** limit (through last) fills after confirm; **passive** sits in Orders.  
5. **Book P&L** is vs book start (budget reset rebases it).  
6. Free tier has **chat limits** on AI Desk; Trade floor is the hero.

---

## 5. Day-of operator loop

| Cadence | Action |
|---------|--------|
| Before invites | Pre-flight §2 |
| After first 3 users | Ask: “Did Trade feel like a desk or a form?” |
| Daily while soft | Check Render health; skim for “is this real money?” confusion |
| Weekly | Note bugs / wording slips; only fix honesty/UX (no Phase 4) |

**Feedback questions (3 max):**

1. What did you try first — home, Trade, or Desk?  
2. Anything that made you think money was real?  
3. One thing to fix before you’d invite a friend?

---

## 6. Known quirks (don’t panic)

| Quirk | Notes |
|-------|--------|
| Clerk Development keys | Fine for soft launch; not for paid ads |
| Quotes as-of brief `—` | Cosmetic load flicker |
| Some Chg% blank | Cosmetic; last price still shows |
| Free chat caps | Expected; point them at Trade floor |
| Render cold start | First API call after idle can be slow |
| Working orders from *your* tests | Cancel if blotter looks dirty |

---

## 7. Success criteria (soft launch)

**Good enough to keep inviting:**

- [ ] ≥3 people complete one paper fill or working order  
- [ ] Zero “I thought this was real money” after you restate paper  
- [ ] No P0 outage (login dead, trade 500s for hours)  
- [ ] At least one useful wording or bug note from users  

**Pause invites if:**

- Login broken for everyone  
- Fills/orders wrong in a way that confuses paper vs live  
- You start promising live trading or returns  

---

## 8. After soft launch (next plan phase)

Only when you want **paid traffic**:

1. Clerk Production DNS + `pk_live_` ([`PRODUCTION_HARDINESS.md`](./PRODUCTION_HARDINESS.md))  
2. Stripe one real checkout + webhook plan flip  
3. Support email/form  

Until then: **operate** (invites + listen), don’t unfreeze Phase 4.

---

## 9. Quick links

| Link | Use |
|------|-----|
| https://indietrades.com | Share this |
| https://indietrades.com/trade | Primary product |
| https://indietrades.com/desk | Optional Grok |
| https://indietrades.com/plans | Plans (free default) |
| https://tradingbot-api-0990.onrender.com/health | Operator health |

---

**Owner lean:** Soft launch = invites + feedback. Eng only for honesty/UX slips. Protect paper line.
