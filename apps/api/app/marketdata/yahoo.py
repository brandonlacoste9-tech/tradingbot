"""Yahoo Finance public chart API — free, no API key.

Uses the unofficial public chart endpoint (same data retail charts use).
Not a broker. Free / no signup. May rate-limit if hammered; fine for desk quotes.

Note: delays/terms can change; keep FMP/AV/Massive as primary when keys exist.
"""

from __future__ import annotations

from typing import Any

import httpx

_TIMEOUT = 12.0
_UA = (
    "Mozilla/5.0 (compatible; IndieTrades/0.7; +https://indietrades.com)"
)


def is_yahoo_configured() -> bool:
    """Always on — no key required."""
    return True


def yahoo_status() -> dict[str, Any]:
    return {
        "configured": True,
        "provider": "yahoo",
        "base_url": "https://query1.finance.yahoo.com",
        "note": "Free public chart API — no key",
    }


async def get_quote(symbol: str) -> dict[str, Any]:
    sym = symbol.upper().strip()
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
    params = {"interval": "1d", "range": "5d"}
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers={"User-Agent": _UA}) as client:
        r = await client.get(url, params=params)
        if r.status_code == 404:
            raise RuntimeError(f"Yahoo: unknown symbol {sym}")
        if r.status_code == 429:
            raise RuntimeError("Yahoo rate limit (429)")
        if r.status_code >= 400:
            raise RuntimeError(f"Yahoo HTTP {r.status_code}: {r.text[:160]}")
        data = r.json()

    err = (data.get("chart") or {}).get("error")
    if err:
        raise RuntimeError(f"Yahoo error: {err}")
    results = (data.get("chart") or {}).get("result") or []
    if not results:
        raise RuntimeError(f"No Yahoo quote for {sym}")

    meta = results[0].get("meta") or {}
    indicators = (results[0].get("indicators") or {}).get("quote") or [{}]
    q0 = indicators[0] if indicators else {}

    def _last(arr: list | None) -> Any:
        if not arr:
            return None
        for v in reversed(arr):
            if v is not None:
                return v
        return None

    px = meta.get("regularMarketPrice")
    if px is None:
        px = _last(q0.get("close"))
    if px is None:
        raise RuntimeError(f"Yahoo: no price for {sym}")

    prev = meta.get("chartPreviousClose") or meta.get("previousClose")
    change = None
    change_pct = None
    if prev is not None:
        try:
            change = float(px) - float(prev)
            change_pct = (change / float(prev)) * 100.0 if float(prev) else None
        except (TypeError, ValueError):
            pass

    return {
        "symbol": meta.get("symbol") or sym,
        "name": meta.get("longName") or meta.get("shortName"),
        "trade": {"p": px, "price": px},
        "price": str(px),
        "open": _last(q0.get("open")) or meta.get("regularMarketOpen"),
        "high": _last(q0.get("high")) or meta.get("regularMarketDayHigh"),
        "low": _last(q0.get("low")) or meta.get("regularMarketDayLow"),
        "close": px,
        "volume": _last(q0.get("volume")) or meta.get("regularMarketVolume"),
        "change": change,
        "change_percent": change_pct,
        "previous_close": prev,
        "currency": meta.get("currency"),
        "exchange": meta.get("exchangeName") or meta.get("fullExchangeName"),
        "market_state": meta.get("marketState"),
        "source": "yahoo",
        "delayed": True,
        "note": "Yahoo public chart (free, no key; may be delayed vs exchange)",
    }


async def get_bars(
    symbol: str, timeframe: str = "1Day", limit: int = 60
) -> dict[str, Any]:
    """Daily bars from Yahoo chart."""
    sym = symbol.upper().strip()
    lim = max(1, min(int(limit), 200))
    # map roughly: 1Day -> enough calendar days
    range_map = {
        "1Day": "1y" if lim > 60 else "6mo",
        "1Hour": "5d",
        "5Min": "1d",
    }
    interval_map = {
        "1Day": "1d",
        "1Hour": "1h",
        "5Min": "5m",
    }
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
    params = {
        "interval": interval_map.get(timeframe, "1d"),
        "range": range_map.get(timeframe, "6mo"),
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers={"User-Agent": _UA}) as client:
        r = await client.get(url, params=params)
        if r.status_code >= 400:
            raise RuntimeError(f"Yahoo bars HTTP {r.status_code}")
        data = r.json()

    results = (data.get("chart") or {}).get("result") or []
    if not results:
        return {"symbol": sym, "bars": [], "source": "yahoo"}

    ts = results[0].get("timestamp") or []
    q0 = ((results[0].get("indicators") or {}).get("quote") or [{}])[0]
    opens = q0.get("open") or []
    highs = q0.get("high") or []
    lows = q0.get("low") or []
    closes = q0.get("close") or []
    vols = q0.get("volume") or []

    bars: list[dict[str, Any]] = []
    for i, t in enumerate(ts):
        c = closes[i] if i < len(closes) else None
        if c is None:
            continue
        bars.append(
            {
                "t": t,
                "o": opens[i] if i < len(opens) else None,
                "h": highs[i] if i < len(highs) else None,
                "l": lows[i] if i < len(lows) else None,
                "c": c,
                "v": vols[i] if i < len(vols) else None,
            }
        )
    bars = bars[-lim:]
    return {"symbol": sym, "bars": bars, "source": "yahoo", "timeframe": timeframe}


async def get_market_status() -> dict[str, Any]:
    """Infer US session from SPY meta marketState."""
    q = await get_quote("SPY")
    state = (q.get("market_state") or "").upper()
    open_like = state in ("REGULAR", "OPEN", "PRE", "POST", "PREPRE", "POSTPOST")
    return {
        "ok": True,
        "source": "yahoo",
        "market_state": state or None,
        "is_open": state == "REGULAR",
        "session_hint": state,
        "note": "Derived from Yahoo SPY marketState",
        "probe_symbol": "SPY",
        "probe_price": q.get("price"),
    }
