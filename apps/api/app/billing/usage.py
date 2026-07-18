"""In-process + Postgres usage counters for free-tier chat caps (PR3/PR4)."""

from __future__ import annotations

import threading
from datetime import date
from typing import Any

from app.billing.plans import PLAN_LIMITS, normalize_plan, plan_allows_chat
from app.config import get_settings

_lock = threading.Lock()
_mem_counts: dict[tuple[str, str], int] = {}


def _apply_free_limit() -> None:
    settings = get_settings()
    PLAN_LIMITS["free"]["chat_per_day"] = int(settings.free_chat_per_day)


def _mem_get(user_id: str) -> int:
    key = (user_id, date.today().isoformat())
    with _lock:
        return _mem_counts.get(key, 0)


def _mem_inc(user_id: str) -> int:
    key = (user_id, date.today().isoformat())
    with _lock:
        _mem_counts[key] = _mem_counts.get(key, 0) + 1
        return _mem_counts[key]


async def get_usage_snapshot(user_id: str, plan: str | None) -> dict[str, Any]:
    """
    Read-only usage for billing UI / admin (does not increment).
    Returns {used, limit, plan, remaining, allowed}.
    """
    _apply_free_limit()
    p = normalize_plan(plan)
    used = _mem_get(user_id)
    try:
        from app.db.pool import is_db_available
        from app.db.repo import get_chat_usage_today

        if is_db_available():
            used = await get_chat_usage_today(user_id)
    except Exception:  # noqa: BLE001
        pass

    allowed, used0, limit = plan_allows_chat(p, used)
    remaining = max(0, limit - used0)
    return {
        "used": used0,
        "limit": limit,
        "remaining": remaining,
        "allowed": allowed,
        "plan": p,
    }


async def record_chat_and_check(user_id: str, plan: str | None) -> dict[str, Any]:
    """
    Check free-tier cap then increment.
    Returns {allowed, used, limit, remaining, plan}.
    """
    _apply_free_limit()
    p = normalize_plan(plan)
    used = _mem_get(user_id)
    try:
        from app.db.pool import is_db_available
        from app.db.repo import get_chat_usage_today, increment_chat_usage

        if is_db_available():
            used = await get_chat_usage_today(user_id)
            allowed, _, limit = plan_allows_chat(p, used)
            if not allowed:
                return {
                    "allowed": False,
                    "used": used,
                    "limit": limit,
                    "remaining": 0,
                    "plan": p,
                }
            used = await increment_chat_usage(user_id)
            return {
                "allowed": True,
                "used": used,
                "limit": limit,
                "remaining": max(0, limit - used),
                "plan": p,
            }
    except Exception:  # noqa: BLE001
        pass

    allowed, used0, limit = plan_allows_chat(p, used)
    if not allowed:
        return {
            "allowed": False,
            "used": used0,
            "limit": limit,
            "remaining": 0,
            "plan": p,
        }
    used_n = _mem_inc(user_id)
    return {
        "allowed": True,
        "used": used_n,
        "limit": limit,
        "remaining": max(0, limit - used_n),
        "plan": p,
    }


def reset_usage_memory() -> None:
    with _lock:
        _mem_counts.clear()
