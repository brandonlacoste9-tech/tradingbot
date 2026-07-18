"""In-memory store for single-user local MVP. Schema in schema.sql for Postgres later."""

from __future__ import annotations

import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timezone
from typing import Any


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


@dataclass
class TradeProposal:
    id: str
    symbol: str
    side: str
    qty: str
    order_type: str
    limit_price: str | None
    reason: str
    policy_status: str
    client_order_id: str
    rejection_reason: str | None = None
    expires_at: str | None = None
    impact: dict[str, Any] | None = None
    broker_order_id: str | None = None
    created_at: str = field(default_factory=lambda: _utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: _utcnow().isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class MemoryStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.proposals: dict[str, TradeProposal] = {}
        self.orders: list[dict[str, Any]] = []
        self.journals: list[dict[str, Any]] = []
        self.audit: list[dict[str, Any]] = []
        self.connection: dict[str, Any] | None = None
        self.profile: dict[str, Any] | None = None
        # Per-tenant paper sim can be attached later (PR2)

    def audit_event(self, actor: str, action: str, details: dict[str, Any] | None = None) -> None:
        with self._lock:
            self.audit.append(
                {
                    "id": len(self.audit) + 1,
                    "created_at": _utcnow().isoformat(),
                    "actor": actor,
                    "action": action,
                    "details": details or {},
                }
            )

    def add_proposal(self, p: TradeProposal) -> TradeProposal:
        with self._lock:
            self.proposals[p.id] = p
        return p

    def get_proposal(self, proposal_id: str) -> TradeProposal | None:
        return self.proposals.get(proposal_id)

    def update_proposal(self, p: TradeProposal) -> TradeProposal:
        p.updated_at = _utcnow().isoformat()
        with self._lock:
            self.proposals[p.id] = p
        return p

    def list_proposals(self) -> list[dict[str, Any]]:
        return [p.to_dict() for p in sorted(
            self.proposals.values(), key=lambda x: x.created_at, reverse=True
        )]

    def add_journal(self, summary_md: str, decisions: list[dict] | None = None) -> dict:
        entry = {
            "id": new_id(),
            "entry_date": date.today().isoformat(),
            "summary_md": summary_md,
            "decisions": decisions or [],
            "created_at": _utcnow().isoformat(),
        }
        with self._lock:
            self.journals.insert(0, entry)
        return entry

    def add_order(self, order: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.orders.insert(0, order)
        return order


store = MemoryStore()
