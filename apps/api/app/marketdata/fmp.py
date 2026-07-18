"""Financial Modeling Prep (FMP) market data — stable API.

Docs: https://financialmodelingprep.com/developer/docs
Use /stable/* endpoints (legacy /api/v3 often 403 on newer keys).

Not a broker. Set FMP_API_KEY separately from ADMIN_API_KEY.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings

_TIMEOUT = 15.0


def is_fmp_configured() -> bool:
    return bool((get_settings().fmp_api_key or "").strip())


def fmp_status() -> dict[str, Any]:
    s = get_settings()
    key = (s.fmp_api_key or "").strip()
    return {
        "configured": bool(key),
        "base_url": (s.fmp_base_url or "https://financialmodelingprep.com").rstrip(
            "/"
        ),
        "provider": "fmp",
    }


def _base() -> str:
    return (
        get_settings().fmp_base_url or "https://financialmodelingprep.com"
    ).rstrip("/")


def _key() -> str:
    return (get_settings().fmp_api_key or "").strip()


async def _get(path: str, params: dict[str, Any] | None = None) -> Any:
    key = _key()
    if not key:
        raise RuntimeError("FMP_API_KEY not configured")
    q = dict(params or {})
    q["apikey"] = key
    url = f"{_base()}{path}"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.get(url, params=q)
        if r.status_code == 402:
            raise RuntimeError(f"FMP plan requires payment for {path} (402)")
        if r.status_code == 403:
            raise RuntimeError(f"FMP forbidden {path} (403)")
        if r.status_code == 429:
            raise RuntimeError("FMP rate limit (429)")
        if r.status_code >= 400:
            raise RuntimeError(f"FMP HTTP {r.status_code}: {r.text[:200]}")
        return r.json()


async def get_quote(symbol: str) -> dict[str, Any]:
    sym = symbol.upper().strip()
    data = await _get("/stable/quote", {"symbol": sym})
    if not isinstance(data, list) or not data:
        raise RuntimeError(f"No FMP quote for {sym}")
    row = data[0]
    px = row.get("price")
    return {
        "symbol": row.get("symbol") or sym,
        "name": row.get("name"),
        "trade": {"p": px, "price": px},
        "price": str(px) if px is not None else None,
        "open": row.get("open"),  # may be absent on stable quote
        "high": row.get("dayHigh"),
        "low": row.get("dayLow"),
        "close": px,
        "volume": row.get("volume"),
        "change": row.get("change"),
        "change_percent": row.get("changePercentage"),
        "year_high": row.get("yearHigh"),
        "year_low": row.get("yearLow"),
        "market_cap": row.get("marketCap"),
        "exchange": row.get("exchange"),
        "source": "fmp",
        "delayed": False,
        "note": "FMP stable quote (may be delayed on free plans)",
    }


async def get_bars(
    symbol: str, timeframe: str = "1Day", limit: int = 60
) -> dict[str, Any]:
    """Daily EOD bars from FMP historical (full)."""
    sym = symbol.upper().strip()
    lim = max(1, min(int(limit), 200))
    # full history then slice — free keys return multi-year; cap client-side
    data = await _get("/stable/historical-price-eod/full", {"symbol": sym})
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected FMP history for {sym}")
    rows = data[:lim]
    bars = []
    for row in rows:
        bars.append(
            {
                "t": row.get("date"),
                "o": row.get("open"),
                "h": row.get("high"),
                "l": row.get("low"),
                "c": row.get("close"),
                "v": row.get("volume"),
                "vw": row.get("vwap"),
            }
        )
    return {
        "symbol": sym,
        "timeframe": timeframe,
        "bars": bars,
        "source": "fmp",
        "count": len(bars),
        "note": "FMP EOD history (newest first)",
    }


async def get_news(symbol: str, limit: int = 5) -> dict[str, Any]:
    """Stock news — often paid (402) on free keys; raise so router can fall back."""
    sym = symbol.upper().strip()
    lim = max(1, min(int(limit), 20))
    data = await _get("/stable/news/stock", {"symbols": sym, "limit": lim})
    if not isinstance(data, list):
        return {"symbol": sym, "news": [], "source": "fmp"}
    items = []
    for n in data[:lim]:
        items.append(
            {
                "title": n.get("title"),
                "published_utc": n.get("publishedDate") or n.get("published_utc"),
                "article_url": n.get("url") or n.get("article_url"),
                "site": n.get("site") or n.get("publisher"),
                "text": (n.get("text") or n.get("description") or "")[:400],
                "tickers": n.get("symbol") or n.get("tickers") or [sym],
            }
        )
    return {"symbol": sym, "news": items, "source": "fmp", "count": len(items)}


async def get_ticker(symbol: str) -> dict[str, Any]:
    sym = symbol.upper().strip()
    data = await _get("/stable/profile", {"symbol": sym})
    if not isinstance(data, list) or not data:
        raise RuntimeError(f"No FMP profile for {sym}")
    r = data[0]
    return {
        "symbol": r.get("symbol") or sym,
        "name": r.get("companyName") or r.get("name"),
        "price": r.get("price"),
        "market_cap": r.get("marketCap"),
        "exchange": r.get("exchange"),
        "industry": r.get("industry"),
        "sector": r.get("sector"),
        "description": (r.get("description") or "")[:500],
        "website": r.get("website"),
        "ceo": r.get("ceo"),
        "country": r.get("country"),
        "source": "fmp",
    }


async def get_market_status() -> dict[str, Any]:
    """FMP has no single exchange-status twin; return provider ok probe via AAPL quote."""
    q = await get_quote("AAPL")
    return {
        "ok": True,
        "provider": "fmp",
        "probe_symbol": "AAPL",
        "probe_price": q.get("price"),
        "source": "fmp",
    }
