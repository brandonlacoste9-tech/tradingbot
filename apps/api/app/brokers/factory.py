"""Broker factory — default sim (Canada-safe demo), per-user for multi-tenant."""

from __future__ import annotations

import logging
import threading
from typing import Any

from app.brokers.errors import BrokerError
from app.config import get_settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_sim_by_user: dict[str, Any] = {}
_shared_ibkr: Any | None = None
_shared_alpaca: Any | None = None


def get_broker(user_id: str | None = None):
    """
    Resolve broker for a tenant (sync). Prefer get_broker_async for sim hydrate.
    """
    settings = get_settings()
    backend = (settings.broker_backend or "sim").lower().strip()
    uid = (user_id or "demo").strip() or "demo"

    if backend == "sim":
        with _lock:
            if uid not in _sim_by_user:
                from app.brokers.sim import PaperSimBroker

                _sim_by_user[uid] = PaperSimBroker(user_id=uid)
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


async def get_broker_async(user_id: str | None = None):
    """Resolve broker; hydrate PaperSim from Postgres when available."""
    broker = get_broker(user_id)
    backend = (get_settings().broker_backend or "sim").lower().strip()
    if backend != "sim":
        return broker
    if getattr(broker, "_hydrated", False):
        return broker
    uid = (user_id or "demo").strip() or "demo"
    try:
        from app.db.pool import is_db_available
        from app.db.repo import load_paper_state

        if is_db_available():
            state = await load_paper_state(uid)
            if state:
                broker.import_state(state)
                logger.debug("Hydrated paper sim for %s from Postgres", uid)
            else:
                broker._hydrated = True
        else:
            broker._hydrated = True
    except Exception as e:  # noqa: BLE001
        logger.warning("sim hydrate failed: %s", e)
        broker._hydrated = True
    return broker


def reset_broker_cache() -> None:
    global _shared_ibkr, _shared_alpaca
    with _lock:
        _sim_by_user.clear()
        _shared_ibkr = None
        _shared_alpaca = None


def sim_tenant_count() -> int:
    with _lock:
        return len(_sim_by_user)
