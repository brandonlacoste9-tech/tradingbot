"""Broker factory — default sim (Canada-safe demo)."""

from __future__ import annotations

from functools import lru_cache

from app.brokers.errors import BrokerError
from app.config import Settings, get_settings


@lru_cache
def get_broker():
    settings = get_settings()
    backend = (settings.broker_backend or "sim").lower().strip()

    if backend == "sim":
        from app.brokers.sim import PaperSimBroker

        return PaperSimBroker()

    if backend == "ibkr":
        from app.brokers.ibkr import IBKRPaperClient

        return IBKRPaperClient(settings)

    if backend == "alpaca":
        from app.brokers.alpaca import AlpacaClient

        return AlpacaClient(settings)

    raise BrokerError(f"Unknown BROKER_BACKEND={backend!r}; use sim|ibkr|alpaca")


def reset_broker_cache() -> None:
    get_broker.cache_clear()
