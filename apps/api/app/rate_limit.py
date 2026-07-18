"""Simple in-process sliding-window rate limiter (per key).

Fine for single-instance Render free tier. Multi-instance would need Redis.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, *, limit: int, window_seconds: float) -> bool:
        """Return True if under limit; record this hit when allowed."""
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            q = self._hits[key]
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True

    def remaining(self, key: str, *, limit: int, window_seconds: float) -> int:
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            q = self._hits[key]
            while q and q[0] < cutoff:
                q.popleft()
            return max(0, limit - len(q))


# Shared process limiter
market_quote_limiter = RateLimiter()

# Defaults: generous for a paper desk UI (watchlist refresh)
MARKET_QUOTE_LIMIT = 60  # requests
MARKET_QUOTE_WINDOW = 60.0  # seconds
