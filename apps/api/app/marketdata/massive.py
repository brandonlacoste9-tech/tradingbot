"""Massive.com market data client (Polygon-compatible REST API).

Free/basic plans: prev-day aggregates, reference, news, financials, indicators.
Real-time last trade / NBBO / snapshots typically require a paid plan.

Base URL defaults to api.polygon.io (Massive's compatible endpoint).
Override with MASSIVE_BASE_URL if needed.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings

# Short timeout — agent tools should fail fast and fall back to sim/web.
_TIMEOUT = 12.0


def is_massive_configured() -> bool:
    s = get_settings()
    return bool((s.massive_api_key or "").strip())


def massive_status() -> dict[str, Any]:
    s = get_settings()
    key = (s.massive_api_key or "").strip()
    return {
        "configured": bool(key),
        "base_url": (s.massive_base_url or "https://api.polygon.io").rstrip("/"),
        "provider": "massive",
    }


def _base() -> str:
    s = get_settings()
    return (s.massive_base_url or "https://api.polygon.io").rstrip("/")


def _key() -> str:
    return (get_settings().massive_api_key or "").strip()


async def _get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    key = _key()
    if not key:
        raise RuntimeError("MASSIVE_API_KEY not configured")
    q = dict(params or {})
    q["apiKey"] = key
    url = f"{_base()}{path}"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.get(url, params=q)
        if r.status_code == 429:
            raise RuntimeError("Massive rate limit (429) — free tier ~5 calls/min")
        if r.status_code == 403:
            raise RuntimeError(
                f"Massive plan forbids this endpoint (403): {path}"
            )
        if r.status_code >= 400:
            raise RuntimeError(f"Massive HTTP {r.status_code}: {r.text[:200]}")
        return r.json()


async def get_prev_close(symbol: str) -> dict[str, Any]:
    """Previous session OHLC for a stock ticker (works on free plan)."""
    sym = symbol.upper().strip()
    data = await _get(f"/v2/aggs/ticker/{sym}/prev", {"adjusted": "true"})
    results = data.get("results") or []
    if not results:
        raise RuntimeError(f"No prev bar for {sym}")
    bar = results[0]
    # Polygon returns mixed-case keys T/t — prefer lowercase when present
    close = bar.get("c")
    return {
        "symbol": sym,
        "open": bar.get("o"),
        "high": bar.get("h"),
        "low": bar.get("l"),
        "close": close,
        "volume": bar.get("v"),
        "vwap": bar.get("vw"),
        "timestamp": bar.get("t"),
        "transactions": bar.get("n"),
        "source": "massive_prev",
        "delayed": True,
        "note": "Previous session aggregate (free/basic plan — not live tape)",
    }


async def get_quote(symbol: str) -> dict[str, Any]:
    """
    Best available quote for research / PaperSim marks.
    Free plan: prev close as last. Paid: could extend to last trade later.
    """
    prev = await get_prev_close(symbol)
    px = prev["close"]
    return {
        "symbol": prev["symbol"],
        "trade": {"p": px, "price": px},
        "price": str(px),
        "open": prev.get("open"),
        "high": prev.get("high"),
        "low": prev.get("low"),
        "close": px,
        "volume": prev.get("volume"),
        "source": "massive",
        "delayed": True,
        "note": prev.get("note"),
    }


async def get_bars(
    symbol: str, timeframe: str = "1Day", limit: int = 60
) -> dict[str, Any]:
    """
    Daily bars when plan allows; otherwise single prev bar series.
    Free plan often 403s range history — we fall back to prev close.
    """
    sym = symbol.upper().strip()
    # Free tier: prev only is reliable
    try:
        prev = await get_prev_close(sym)
        bar = {
            "t": prev.get("timestamp"),
            "o": prev.get("open"),
            "h": prev.get("high"),
            "l": prev.get("low"),
            "c": prev.get("close"),
            "v": prev.get("volume"),
        }
        return {
            "symbol": sym,
            "timeframe": timeframe,
            "bars": [bar],
            "source": "massive_prev",
            "delayed": True,
            "note": (
                "Free/basic Massive plan: previous session only. "
                "Upgrade Massive for multi-day history / realtime."
            ),
            "limit_requested": limit,
        }
    except Exception as e:  # noqa: BLE001
        return {
            "symbol": sym,
            "timeframe": timeframe,
            "bars": [],
            "source": "massive_error",
            "error": str(e),
        }


async def get_news(symbol: str, limit: int = 5) -> dict[str, Any]:
    sym = symbol.upper().strip()
    lim = max(1, min(int(limit), 20))
    data = await _get(
        "/v2/reference/news",
        {"ticker": sym, "limit": lim, "order": "desc", "sort": "published_utc"},
    )
    items = []
    for n in data.get("results") or []:
        items.append(
            {
                "id": n.get("id"),
                "title": n.get("title"),
                "author": n.get("author"),
                "published_utc": n.get("published_utc"),
                "article_url": n.get("article_url"),
                "tickers": n.get("tickers") or [],
                "description": (n.get("description") or "")[:400],
            }
        )
    return {
        "symbol": sym,
        "news": items,
        "source": "massive",
        "count": len(items),
    }


async def get_ticker(symbol: str) -> dict[str, Any]:
    sym = symbol.upper().strip()
    data = await _get(f"/v3/reference/tickers/{sym}")
    r = data.get("results") or {}
    return {
        "symbol": r.get("ticker") or sym,
        "name": r.get("name"),
        "market": r.get("market"),
        "locale": r.get("locale"),
        "primary_exchange": r.get("primary_exchange"),
        "type": r.get("type"),
        "active": r.get("active"),
        "currency_name": r.get("currency_name"),
        "description": (r.get("description") or "")[:500],
        "homepage_url": r.get("homepage_url"),
        "sic_description": r.get("sic_description"),
        "source": "massive",
    }


async def get_market_status() -> dict[str, Any]:
    data = await _get("/v1/marketstatus/now")
    data["source"] = "massive"
    return data
