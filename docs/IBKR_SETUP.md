# IBKR paper setup (Canada)

Canada-legal paper trading for **tradingbot**.  
**Render keeps `BROKER_BACKEND=sim`.** IBKR runs **on your PC** with the API local.

## Architecture

```
Browser (Netlify)  →  still hits Render for demo (sim)

Your PC:
  IB Gateway (paper, port 4002)
       ↑
  FastAPI apps/api  BROKER_BACKEND=ibkr
       ↑
  Browser localhost:3000  →  localhost:8000
```

Netlify cannot talk to your home Gateway unless you expose it (don’t).  
Use **local API + local UI** (or local API only + point UI at localhost).

---

## 1. IBKR Canada account

1. Open [Interactive Brokers Canada](https://www.interactivebrokers.ca) → **IBKR Pro** account.  
2. Complete application and wait until the account is **open**.  
3. Paper trading is usually available after approval (funding rules can apply for full features).

### Paper username

1. Log in to [Client Portal](https://www.interactivebrokers.com/sso/Login).  
2. Profile / **Settings**.  
3. **Paper Trading Account**.  
4. Note **Paper Trading Username** (often different from live).  
5. **Reset Paper Trading Password** if needed.

There is **no Alpaca-style API key** for normal retail IBKR.  
Auth = Gateway login + socket.

---

## 2. Install IB Gateway (recommended over TWS)

1. Download **IB Gateway** (Stable):  
   https://www.interactivebrokers.com/en/trading/ibgateway-stable.php  
2. Install and launch.  
3. Choose **Paper Trading** (not Live).  
4. Log in with **paper username + password** (+ 2FA if prompted).

### API settings (critical)

In Gateway (or TWS):

1. **Configure → Settings** (gear).  
2. **API → Settings**.  
3. **Enable ActiveX and Socket Clients** = ON.  
4. **Socket port** = **4002** (Gateway paper).  
   - TWS paper uses **7497** instead — then set `IBKR_PORT=7497`.  
5. **Trusted IPs**: add `127.0.0.1`.  
6. Uncheck **Read-Only API** (needed for orders).  
7. Optional: check **Download open orders on connection**.  
8. Apply / OK.  
9. Leave Gateway **running** while you use the bot.

| App | Live port | Paper port |
|-----|-----------|------------|
| IB Gateway | 4001 | **4002** |
| TWS | 7496 | **7497** |

---

## 3. Local API with IBKR

```powershell
cd C:\Users\north\tradingbot
copy .env.example .env   # if needed
```

Edit `.env`:

```env
BROKER_BACKEND=ibkr
IBKR_HOST=127.0.0.1
IBKR_PORT=4002
IBKR_CLIENT_ID=1
PAPER_ONLY=true

# Keep Grok for research (optional local)
LLM_PROVIDER=xai
XAI_API_KEY=your-key-here

NEXT_PUBLIC_API_URL=http://localhost:8000
```

```powershell
cd C:\Users\north\tradingbot\apps\api
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install ib_async
uvicorn app.main:app --reload --port 8000
```

Or:

```powershell
.\scripts\run-api-ibkr.ps1
```

### Check connection

```powershell
.\scripts\check-ibkr.ps1
# or
curl http://localhost:8000/health
curl -X POST http://localhost:8000/connection/validate
curl http://localhost:8000/broker/status
```

Expect `broker_backend: ibkr`, `is_paper: true`, real paper equity.

---

## 4. Local UI

```powershell
cd C:\Users\north\tradingbot\apps\web
# .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000  
Do **not** use the Netlify site for IBKR — it still points at Render/sim.

---

## 5. Smoke test

1. Gateway paper running.  
2. API up with `BROKER_BACKEND=ibkr`.  
3. UI: **Refresh paper** / validate.  
4. Chat: “What is my buying power?”  
5. “Propose a limit buy of 1 share of SPY” → confirm within TTL.  
6. Check positions on desk + in Gateway.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `connect failed` | Gateway not running, wrong port, or API not enabled |
| `ib_async not installed` | `pip install ib_async` |
| Read-only / can’t order | Uncheck Read-Only API in Gateway |
| Wrong account | Logged into Live instead of Paper |
| 2FA timeout | Complete login in Gateway UI first |
| Client id in use | Change `IBKR_CLIENT_ID` (e.g. 2) |
| Market data empty | Paper market data subscription; use limit price from research |

---

## Security

- Never expose Gateway port to the public internet.  
- Keep `PAPER_ONLY=true` until you explicitly want live (live needs port 4001/7496 and a conscious config change).  
- Don’t put IBKR credentials in Netlify or git.

---

## What stays on the cloud

| Service | Backend |
|---------|---------|
| Netlify + Render production | **`sim`** (always-on demo) |
| Your laptop IBKR | **`ibkr`** paper |

This is intentional: IB Gateway is a local logged-in session; free Render cannot host it.
