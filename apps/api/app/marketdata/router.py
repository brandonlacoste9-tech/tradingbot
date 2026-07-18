"""Unified market data cascade.

Order:
  quotes/bars:  FMP → Alpha Vantage → Massive
  news:         Alpha Vantage (sentiment) → Massive → FMP
  status:       FMP → Alpha Vantage → Massive

FMP stays primary for volume (AV free limits are tight).
"""

from __future__ import annotations

from typing import Any

from app.marketdata import alphavantage as av
from app.marketdata import fmp, massive


def any_md_configured() -> bool:
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
    return {
        "fmp": fmp.fmp_status(),
        "alphavantage": av.alphavantage_status(),
        "massive": massive.massive_status(),
        "primary": primary,
    }


async def get_quote(symbol: str) -> dict[str, Any]:
    errors: list[str] = []
    for name, configured, fn in (
        ("fmp", fmp.is_fmp_configured(), fmp.get_quote),
        ("alphavantage", av.is_alphavantage_configured(), av.get_quote),
        ("massive", massive.is_massive_configured(), massive.get_quote),
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
    ):
        if not configured:
            continue
        try:
            bars = await fn(symbol, timeframe=timeframe, limit=limit)
            if bars.get("bars"):
                if errors:
                    bars["fallback_errors"] = errors
                return bars
            errors.append(f"{name}: empty bars")
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
