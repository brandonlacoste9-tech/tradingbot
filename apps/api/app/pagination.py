"""Offset/limit pagination helpers for list endpoints."""

from __future__ import annotations

from typing import Any, Sequence, TypeVar

T = TypeVar("T")


def clamp_limit(limit: int | None, *, default: int = 50, max_limit: int = 200) -> int:
    if limit is None:
        return default
    try:
        n = int(limit)
    except (TypeError, ValueError):
        return default
    return max(1, min(n, max_limit))


def clamp_offset(offset: int | None) -> int:
    if offset is None:
        return 0
    try:
        n = int(offset)
    except (TypeError, ValueError):
        return 0
    return max(0, n)


def page_slice(
    items: Sequence[T],
    *,
    limit: int | None = None,
    offset: int | None = None,
    default_limit: int = 50,
    max_limit: int = 200,
    reverse: bool = False,
) -> dict[str, Any]:
    """
    Return {items, total, limit, offset, has_more}.
    If reverse=True, newest-first for lists that append chronologically.
    """
    lim = clamp_limit(limit, default=default_limit, max_limit=max_limit)
    off = clamp_offset(offset)
    seq: list[T] = list(items)
    if reverse:
        seq = list(reversed(seq))
    total = len(seq)
    chunk = seq[off : off + lim]
    return {
        "items": chunk,
        "total": total,
        "limit": lim,
        "offset": off,
        "has_more": off + lim < total,
    }
