"""Per-user tenant store — memory + optional Postgres hydrate/flush (PR2)."""

from __future__ import annotations

import logging
import threading
from typing import Any

from app.store import MemoryStore, TradeProposal

logger = logging.getLogger(__name__)


class TenantStore:
    """One MemoryStore per user_id; hydrated from Postgres when available."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._users: dict[str, MemoryStore] = {}

    def for_user(self, user_id: str) -> MemoryStore:
        if not user_id:
            raise ValueError("user_id required")
        with self._lock:
            if user_id not in self._users:
                self._users[user_id] = MemoryStore(user_id=user_id)
            return self._users[user_id]

    async def for_user_async(self, user_id: str) -> MemoryStore:
        """Return store, hydrating once from Postgres if configured."""
        store = self.for_user(user_id)
        if store._hydrated:
            return store
        await self._hydrate(user_id, store)
        store._hydrated = True
        return store

    async def _hydrate(self, user_id: str, store: MemoryStore) -> None:
        try:
            from app.db.pool import is_db_available
            from app.db import repo
        except Exception:  # noqa: BLE001
            return
        if not is_db_available():
            return
        try:
            profile = await repo.load_profile(user_id)
            if profile:
                store.profile = {
                    "id": profile["id"],
                    "email": profile.get("email"),
                    "plan": profile.get("plan") or "free",
                    "created_via": "postgres",
                }
            proposals = await repo.load_proposals(user_id)
            for p in proposals:
                store.proposals[p.id] = p
            store.journals = await repo.load_journals(user_id)
            store.orders = await repo.load_orders(user_id)
            store.audit = await repo.load_audit(user_id)
            logger.debug("Hydrated tenant %s from Postgres", user_id)
        except Exception as e:  # noqa: BLE001
            logger.warning("Hydrate failed for %s: %s", user_id, e)

    def ensure_user_record(self, user_id: str, email: str | None = None) -> dict[str, Any]:
        store = self.for_user(user_id)
        if store.profile is None:
            store.profile = {
                "id": user_id,
                "email": email,
                "plan": "free",
                "created_via": "tenant_store",
            }
        elif email and not store.profile.get("email"):
            store.profile["email"] = email
        return store.profile

    async def ensure_user_async(
        self, user_id: str, email: str | None = None
    ) -> dict[str, Any]:
        profile = self.ensure_user_record(user_id, email=email)
        try:
            from app.db.pool import is_db_available
            from app.db.repo import load_profile, upsert_user

            if is_db_available():
                await upsert_user(user_id, email=email)
                dbp = await load_profile(user_id)
                if dbp:
                    profile = {
                        "id": dbp["id"],
                        "email": dbp.get("email") or email,
                        "plan": dbp.get("plan") or "free",
                        "created_via": "postgres",
                    }
                    self.for_user(user_id).profile = profile
        except Exception as e:  # noqa: BLE001
            logger.warning("ensure_user_async: %s", e)
        return profile

    async def persist_proposal(self, user_id: str, p: TradeProposal) -> None:
        try:
            from app.db.pool import is_db_available
            from app.db.repo import save_proposal, upsert_user

            if is_db_available():
                await upsert_user(user_id)
                await save_proposal(user_id, p)
        except Exception as e:  # noqa: BLE001
            logger.warning("persist_proposal: %s", e)

    async def persist_journal(self, user_id: str, entry: dict[str, Any]) -> None:
        try:
            from app.db.pool import is_db_available
            from app.db.repo import save_journal, upsert_user

            if is_db_available():
                await upsert_user(user_id)
                await save_journal(user_id, entry)
        except Exception as e:  # noqa: BLE001
            logger.warning("persist_journal: %s", e)

    async def persist_order(self, user_id: str, order: dict[str, Any]) -> None:
        try:
            from app.db.pool import is_db_available
            from app.db.repo import save_order, upsert_user

            if is_db_available():
                await upsert_user(user_id)
                await save_order(user_id, order)
        except Exception as e:  # noqa: BLE001
            logger.warning("persist_order: %s", e)

    async def persist_audit(
        self, user_id: str, actor: str, action: str, details: dict | None
    ) -> None:
        try:
            from app.db.pool import is_db_available
            from app.db.repo import save_audit

            if is_db_available():
                await save_audit(user_id, actor, action, details)
        except Exception as e:  # noqa: BLE001
            logger.warning("persist_audit: %s", e)

    def stats(self) -> dict[str, Any]:
        from app.db.pool import is_db_available

        with self._lock:
            return {
                "tenant_count": len(self._users),
                "backend": "postgres" if is_db_available() else "memory",
            }


_tenant_store: TenantStore | None = None
_tenant_lock = threading.Lock()


def get_tenant_store() -> TenantStore:
    global _tenant_store
    with _tenant_lock:
        if _tenant_store is None:
            _tenant_store = TenantStore()
        return _tenant_store
