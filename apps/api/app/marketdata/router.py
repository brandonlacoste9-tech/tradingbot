"""Unified market data: FMP → Massive → (caller falls back to broker/sim).

Priority favors FMP for live-ish quotes + multi-day history on free/stable keys.
Massive fills news / prev-close when FMP lacks access.
"""

from __future__ import annotations

from typing import Any

from app.marketdata import fmp, massive


def any_md_configured() -> bool:
    return fmp.is_fmp_configured() or massive.is_massive_configured()


def providers_status() -> dict[str, Any]:
    return {
        "fmp": fmp.fmp_status(),
        "massive": massive.massive_status(),
        "primary": (
            "fmp"
            if fmp.is_fmp_configured()
            else ("massive" if massive.is_massive_configured() else None)
        ),
    }


async def get_quote(symbol: str) -> dict[str, Any]:
    errors: list[str] = []
    if fmp.is_fmp_configured():
        try:
            return await fmp.get_quote(symbol)
        except Exception as e:  # noqa: BLE001
            errors.append(f"fmp: {e}")
    if massive.is_massive_configured():
        try:
            q = await massive.get_quote(symbol)
            if errors:
                q["fallback_errors"] = errors
            return q
        except Exception as e:  # noqa: BLE001
            errors.append(f"massive: {e}")
    raise RuntimeError("; ".join(errors) or "No market data provider configured")


async def get_bars(
    symbol: str, timeframe: str = "1Day", limit: int = 60
) -> dict[str, Any]:
    errors: list[str] = []
    if fmp.is_fmp_configured():
        try:
            bars = await fmp.get_bars(symbol, timeframe=timeframe, limit=limit)
            if bars.get("bars"):
                return bars
            errors.append("fmp: empty bars")
        except Exception as e:  # noqa: BLE001
            errors.append(f"fmp: {e}")
    if massive.is_massive_configured():
        try:
            bars = await massive.get_bars(symbol, timeframe=timeframe, limit=limit)
            if errors:
                bars["fallback_errors"] = errors
            return bars
        except Exception as e:  # noqa: BLE001
            errors.append(f"massive: {e}")
    raise RuntimeError("; ".join(errors) or "No market data provider configured")


async def get_news(symbol: str, limit: int = 5) -> dict[str, Any]:
    errors: list[str] = []
    # Massive news often works on free; FMP news may be paid
    if massive.is_massive_configured():
        try:
            return await massive.get_news(symbol, limit=limit)
        except Exception as e:  # noqa: BLE001
            errors.append(f"massive: {e}")
    if fmp.is_fmp_configured():
        try:
            n = await fmp.get_news(symbol, limit=limit)
            if errors:
                n["fallback_errors"] = errors
            return n
        except Exception as e:  # noqa: BLE001
            errors.append(f"fmp: {e}")
    raise RuntimeError("; ".join(errors) or "No market data provider configured")


async def get_market_status() -> dict[str, Any]:
    errors: list[str] = []
    if fmp.is_fmp_configured():
        try:
            return await fmp.get_market_status()
        except Exception as e:  # noqa: BLE001
            errors.append(f"fmp: {e}")
    if massive.is_massive_configured():
        try:
            st = await massive.get_market_status()
            if errors:
                st["fallback_errors"] = errors
            return st
        except Exception as e:  # noqa: BLE001
            errors.append(f"massive: {e}")
    raise RuntimeError("; ".join(errors) or "No market data provider configured")
