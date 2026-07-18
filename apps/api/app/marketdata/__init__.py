"""External market data providers (FMP + Massive/Polygon)."""

from app.marketdata.fmp import fmp_status, is_fmp_configured
from app.marketdata.massive import is_massive_configured, massive_status
from app.marketdata.router import (
    any_md_configured,
    get_bars,
    get_market_status,
    get_news,
    get_quote,
    providers_status,
)

__all__ = [
    "any_md_configured",
    "providers_status",
    "is_fmp_configured",
    "is_massive_configured",
    "fmp_status",
    "massive_status",
    "get_quote",
    "get_bars",
    "get_news",
    "get_market_status",
]
