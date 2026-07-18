"""Unified market data cascade.

Order:
  quotes/bars:  FMP → Alpha Vantage → Massive → Yahoo (free, no key)
  news:         Alpha Vantage (sentiment) → Massive → FMP
  status:       FMP → Alpha Vantage → Massive → Yahoo

Yahoo is always available as a free real-price backstop (no API key).
FMP stays preferred when the key works (volume + fields).
"""

from __future__ import annotations

from typing import Any

from app.marketdata import alphavantage as av
from app.marketdata import fmp, massive, yahoo


def any_md_configured() -> bool:
    """True when a keyed market-data provider is configured.

    Yahoo is intentionally excluded: it is an unofficial free backstop, not a
    reliable configured provider. When only Yahoo is available, callers should
    treat market data as unavailable and use broker/sim quotes instead.
    """
    return (
        fmp.is_fmp_configured()
        or av.is_alphavantage_configured()
        or massive.is_massive_configured()
    )


def providers_status() -> dict[str, Any]:
    primary = None
    if fmp.is_fmp_configured():
        primary = "fmp"
    elif av.is_alphavantage_configured():
        primary = "alphavantage"
    elif massive.is_massive_configured():
        primary = "massive"
    else:
        primary = "yahoo"
    return {
        "fmp": fmp.fmp_status(),
        "alphavantage": av.alphavantage_status(),
        "massive": massive.massive_status(),
        "yahoo": {**yahoo.yahoo_status(), "role": "fallback_unofficial"},
        "primary": primary,
        "keyed_provider_configured": any_md_configured(),
    }


async def get_quote(symbol: str) -> dict[str, Any]:
    errors: list[str] = []
    for name, configured, fn in (
        ("fmp", fmp.is_fmp_configured(), fmp.get_quote),
        ("alphavantage", av.is_alphavantage_configured(), av.get_quote),
        ("massive", massive.is_massive_configured(), massive.get_quote),
        ("yahoo", yahoo.is_yahoo_configured(), yahoo.get_quote),
    ):
        if not configured:
            continue
        try:
            q = await fn(symbol)
            if errors:
                q["fallback_errors"] = errors
            return q
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: {e}")
    raise RuntimeError("; ".join(errors) or "No market data provider configured")


async def get_bars(
    symbol: str, timeframe: str = "1Day", limit: int = 60
) -> dict[str, Any]:
    errors: list[str] = []
    for name, configured, fn in (
        ("fmp", fmp.is_fmp_configured(), fmp.get_bars),
        ("alphavantage", av.is_alphavantage_configured(), av.get_bars),
        ("massive", massive.is_massive_configured(), massive.get_bars),
        ("yahoo", yahoo.is_yahoo_configured(), yahoo.get_bars),
    ):
        if not configured:
            continue
        try:
            bars = await fn(symbol, timeframe=timeframe, limit=limit)
            got = list(bars.get("bars") or [])
            # Chart + multi-day views need real series; single prev-close is not enough
            # when the caller asked for a lookback (limit > 1). Fall through to next
            # provider (e.g. Yahoo free daily history) instead of a one-bar dead end.
            min_needed = 1 if limit <= 1 else 2
            if len(got) >= min_needed:
                if errors:
                    bars["fallback_errors"] = errors
                return bars
            errors.append(f"{name}: insufficient bars ({len(got)})")
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: {e}")
    raise RuntimeError("; ".join(errors) or "No market data provider configured")


async def get_news(symbol: str, limit: int = 5) -> dict[str, Any]:
    errors: list[str] = []
    # AV first: free NEWS_SENTIMENT works; FMP often 402
    for name, configured, fn in (
        ("alphavantage", av.is_alphavantage_configured(), av.get_news),
        ("massive", massive.is_massive_configured(), massive.get_news),
        ("fmp", fmp.is_fmp_configured(), fmp.get_news),
    ):
        if not configured:
            continue
        try:
            n = await fn(symbol, limit=limit)
            if errors:
                n["fallback_errors"] = errors
            return n
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: {e}")
    raise RuntimeError("; ".join(errors) or "No market data provider configured")


async def get_market_status() -> dict[str, Any]:
    errors: list[str] = []
    for name, configured, fn in (
        ("fmp", fmp.is_fmp_configured(), fmp.get_market_status),
        ("alphavantage", av.is_alphavantage_configured(), av.get_market_status),
        ("massive", massive.is_massive_configured(), massive.get_market_status),
        ("yahoo", yahoo.is_yahoo_configured(), yahoo.get_market_status),
    ):
        if not configured:
            continue
        try:
            st = await fn()
            if errors:
                st["fallback_errors"] = errors
            return st
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: {e}")
    raise RuntimeError("; ".join(errors) or "No market data provider configured")
