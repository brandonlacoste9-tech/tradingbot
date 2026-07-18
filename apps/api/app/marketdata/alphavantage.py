"""Alpha Vantage market data client.

https://www.alphavantage.co/documentation/
Free keys: tight rate limits (~5/min or daily caps) — use as fallback / news,
not as the primary hammer for every chat turn.

Env: ALPHA_VANTAGE_API_KEY (aliases: ALPHAVANTAGE_API_KEY)
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings

_TIMEOUT = 20.0
_BASE = "https://www.alphavantage.co/query"


def is_alphavantage_configured() -> bool:
    s = get_settings()
    return bool((s.alpha_vantage_api_key or "").strip())


def alphavantage_status() -> dict[str, Any]:
    s = get_settings()
    key = (s.alpha_vantage_api_key or "").strip()
    return {
        "configured": bool(key),
        "base_url": "https://www.alphavantage.co",
        "provider": "alphavantage",
    }


def _key() -> str:
    return (get_settings().alpha_vantage_api_key or "").strip()


async def _query(**params: Any) -> dict[str, Any]:
    key = _key()
    if not key:
        raise RuntimeError("ALPHA_VANTAGE_API_KEY not configured")
    q = dict(params)
    q["apikey"] = key
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.get(_BASE, params=q)
        if r.status_code >= 400:
            raise RuntimeError(f"Alpha Vantage HTTP {r.status_code}: {r.text[:200]}")
        data = r.json()
    if not isinstance(data, dict):
        raise RuntimeError("Alpha Vantage: unexpected response")
    if data.get("Note"):
        raise RuntimeError(f"Alpha Vantage rate limit: {data['Note'][:160]}")
    if data.get("Information"):
        # Often premium / throttle messaging
        info = str(data["Information"])
        if "Thank you" in info or "API call frequency" in info or "premium" in info.lower():
            raise RuntimeError(f"Alpha Vantage limit: {info[:160]}")
    if data.get("Error Message"):
        raise RuntimeError(f"Alpha Vantage error: {data['Error Message']}")
    return data


async def get_quote(symbol: str) -> dict[str, Any]:
    sym = symbol.upper().strip()
    data = await _query(function="GLOBAL_QUOTE", symbol=sym)
    gq = data.get("Global Quote") or {}
    if not gq or not gq.get("05. price"):
        raise RuntimeError(f"No Alpha Vantage quote for {sym}")
    px = float(gq["05. price"])
    return {
        "symbol": gq.get("01. symbol") or sym,
        "trade": {"p": px, "price": px},
        "price": str(px),
        "open": _f(gq.get("02. open")),
        "high": _f(gq.get("03. high")),
        "low": _f(gq.get("04. low")),
        "close": px,
        "volume": _f(gq.get("06. volume")),
        "latest_trading_day": gq.get("07. latest trading day"),
        "previous_close": _f(gq.get("08. previous close")),
        "change": _f(gq.get("09. change")),
        "change_percent": gq.get("10. change percent"),
        "source": "alphavantage",
        "delayed": True,
        "note": "Alpha Vantage GLOBAL_QUOTE",
    }


def _f(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(str(v).replace("%", ""))
    except (TypeError, ValueError):
        return None


async def get_bars(
    symbol: str, timeframe: str = "1Day", limit: int = 60
) -> dict[str, Any]:
    sym = symbol.upper().strip()
    lim = max(1, min(int(limit), 100))
    data = await _query(
        function="TIME_SERIES_DAILY",
        symbol=sym,
        outputsize="compact",
    )
    series = data.get("Time Series (Daily)") or {}
    if not series:
        raise RuntimeError(f"No Alpha Vantage daily series for {sym}")
    bars = []
    for date in sorted(series.keys(), reverse=True)[:lim]:
        row = series[date]
        bars.append(
            {
                "t": date,
                "o": _f(row.get("1. open")),
                "h": _f(row.get("2. high")),
                "l": _f(row.get("3. low")),
                "c": _f(row.get("4. close")),
                "v": _f(row.get("5. volume")),
            }
        )
    return {
        "symbol": sym,
        "timeframe": timeframe,
        "bars": bars,
        "source": "alphavantage",
        "count": len(bars),
        "note": "Alpha Vantage TIME_SERIES_DAILY (compact)",
    }


async def get_news(symbol: str, limit: int = 5) -> dict[str, Any]:
    sym = symbol.upper().strip()
    lim = max(1, min(int(limit), 20))
    data = await _query(
        function="NEWS_SENTIMENT",
        tickers=sym,
        limit=str(lim),
        sort="LATEST",
    )
    feed = data.get("feed") or []
    items = []
    for n in feed[:lim]:
        items.append(
            {
                "title": n.get("title"),
                "published_utc": n.get("time_published"),
                "article_url": n.get("url"),
                "source": n.get("source"),
                "summary": (n.get("summary") or "")[:400],
                "overall_sentiment_score": n.get("overall_sentiment_score"),
                "overall_sentiment_label": n.get("overall_sentiment_label"),
                "tickers": [
                    t.get("ticker")
                    for t in (n.get("ticker_sentiment") or [])
                    if t.get("ticker")
                ],
            }
        )
    return {
        "symbol": sym,
        "news": items,
        "source": "alphavantage",
        "count": len(items),
        "note": "Alpha Vantage NEWS_SENTIMENT",
    }


async def get_fx(from_currency: str = "USD", to_currency: str = "CAD") -> dict[str, Any]:
    data = await _query(
        function="CURRENCY_EXCHANGE_RATE",
        from_currency=from_currency.upper(),
        to_currency=to_currency.upper(),
    )
    row = data.get("Realtime Currency Exchange Rate") or {}
    if not row:
        raise RuntimeError("No FX rate from Alpha Vantage")
    return {
        "from": row.get("1. From_Currency Code"),
        "to": row.get("3. To_Currency Code"),
        "rate": _f(row.get("5. Exchange Rate")),
        "last_refreshed": row.get("6. Last Refreshed"),
        "source": "alphavantage",
    }


async def get_market_status() -> dict[str, Any]:
    q = await get_quote("AAPL")
    return {
        "ok": True,
        "provider": "alphavantage",
        "probe_symbol": "AAPL",
        "probe_price": q.get("price"),
        "latest_trading_day": q.get("latest_trading_day"),
        "source": "alphavantage",
    }
