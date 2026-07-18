"""Broker factory — default sim (Canada-safe demo), per-user for multi-tenant."""

from __future__ import annotations

import threading
from typing import Any

from app.brokers.errors import BrokerError
from app.config import get_settings

_lock = threading.Lock()
_sim_by_user: dict[str, Any] = {}
_shared_ibkr: Any | None = None
_shared_alpaca: Any | None = None


def get_broker(user_id: str | None = None):
    """
    Resolve broker for a tenant.

    PaperSim is **per user_id** so multi-user books stay isolated.
    IBKR/Alpaca remain process-shared (single connection) until BYO keys (later).
    """
    settings = get_settings()
    backend = (settings.broker_backend or "sim").lower().strip()
    uid = (user_id or "demo").strip() or "demo"

    if backend == "sim":
        with _lock:
            if uid not in _sim_by_user:
                from app.brokers.sim import PaperSimBroker

                _sim_by_user[uid] = PaperSimBroker()
            return _sim_by_user[uid]

    if backend == "ibkr":
        global _shared_ibkr
        with _lock:
            if _shared_ibkr is None:
                from app.brokers.ibkr import IBKRPaperClient

                _shared_ibkr = IBKRPaperClient(settings)
            return _shared_ibkr

    if backend == "alpaca":
        global _shared_alpaca
        with _lock:
            if _shared_alpaca is None:
                from app.brokers.alpaca import AlpacaClient

                _shared_alpaca = AlpacaClient(settings)
            return _shared_alpaca

    raise BrokerError(f"Unknown BROKER_BACKEND={backend!r}; use sim|ibkr|alpaca")


def reset_broker_cache() -> None:
    global _shared_ibkr, _shared_alpaca
    with _lock:
        _sim_by_user.clear()
        _shared_ibkr = None
        _shared_alpaca = None


def sim_tenant_count() -> int:
    with _lock:
        return len(_sim_by_user)
