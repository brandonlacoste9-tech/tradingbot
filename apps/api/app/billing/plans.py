"""Plan limits for free vs pro (PR3/PR4)."""

from __future__ import annotations

from typing import Any

# Daily chat limits (LLM or demo). Pro is effectively unlimited for v1.
PLAN_LIMITS: dict[str, dict[str, Any]] = {
    "free": {
        "label": "Free",
        "chat_per_day": 25,
        "price_cad": 0,
    },
    "pro": {
        "label": "Indie Pro",
        "chat_per_day": 10_000,
        "price_cad": 29,
    },
    "pro_plus": {
        "label": "Indie Pro+",
        "chat_per_day": 50_000,
        "price_cad": 59,
    },
}


def normalize_plan(plan: str | None) -> str:
    p = (plan or "free").lower().strip()
    if p in ("pro+", "proplus", "pro_plus"):
        return "pro_plus"
    if p in PLAN_LIMITS:
        return p
    if p in ("active", "paid", "premium"):
        return "pro"
    return "free"


def plan_allows_chat(plan: str | None, used_today: int) -> tuple[bool, int, int]:
    """Return (allowed, used, limit)."""
    p = normalize_plan(plan)
    limit = int(PLAN_LIMITS[p]["chat_per_day"])
    return used_today < limit, used_today, limit
