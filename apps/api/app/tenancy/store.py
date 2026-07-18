"""Per-user tenant store — isolates proposals/journals/orders by user_id.

PR1: in-memory multi-tenant buckets (works without Postgres).
Postgres persistence can wrap the same interface in PR2.
"""

from __future__ import annotations

import threading
from typing import Any

from app.store import MemoryStore, TradeProposal, new_id


class TenantStore:
    """One MemoryStore per user_id (process-local)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._users: dict[str, MemoryStore] = {}

    def for_user(self, user_id: str) -> MemoryStore:
        if not user_id:
            raise ValueError("user_id required")
        with self._lock:
            if user_id not in self._users:
                self._users[user_id] = MemoryStore()
            return self._users[user_id]

    def ensure_user_record(self, user_id: str, email: str | None = None) -> dict[str, Any]:
        """Lightweight user registry for /me (memory)."""
        store = self.for_user(user_id)
        if not hasattr(store, "profile") or store.profile is None:  # type: ignore[attr-defined]
            store.profile = {  # type: ignore[attr-defined]
                "id": user_id,
                "email": email,
                "plan": "free",
                "created_via": "tenant_store",
            }
        elif email and not store.profile.get("email"):  # type: ignore[attr-defined]
            store.profile["email"] = email  # type: ignore[attr-defined]
        return store.profile  # type: ignore[attr-defined]

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {
                "tenant_count": len(self._users),
                "backend": "memory",
            }


_tenant_store: TenantStore | None = None
_tenant_lock = threading.Lock()


def get_tenant_store() -> TenantStore:
    global _tenant_store
    with _tenant_lock:
        if _tenant_store is None:
            _tenant_store = TenantStore()
        return _tenant_store
