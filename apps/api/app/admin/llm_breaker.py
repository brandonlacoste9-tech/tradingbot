"""LLM circuit breaker — open after consecutive provider failures (PR4).

Protects xAI/OpenAI spend and latency when the provider is degraded.
States: closed (normal) → open (block LLM) → half_open (probe) → closed.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Literal

from app.config import get_settings

State = Literal["closed", "open", "half_open"]


class LlmCircuitBreaker:
    def __init__(
        self,
        failure_threshold: int | None = None,
        window_seconds: float | None = None,
        cooldown_seconds: float | None = None,
    ) -> None:
        settings = get_settings()
        self.failure_threshold = int(
            failure_threshold
            if failure_threshold is not None
            else settings.llm_breaker_failure_threshold
        )
        self.window_seconds = float(
            window_seconds
            if window_seconds is not None
            else settings.llm_breaker_window_seconds
        )
        self.cooldown_seconds = float(
            cooldown_seconds
            if cooldown_seconds is not None
            else settings.llm_breaker_cooldown_seconds
        )
        self._lock = threading.Lock()
        self._failures: list[float] = []
        self._state: State = "closed"
        self._opened_at: float | None = None
        self._last_error: str = ""
        self._success_count: int = 0
        self._failure_count_total: int = 0

    def reset(self) -> dict[str, Any]:
        with self._lock:
            self._failures.clear()
            self._state = "closed"
            self._opened_at = None
            self._last_error = ""
            return self._snapshot_unlocked()

    def _prune(self, now: float) -> None:
        cutoff = now - self.window_seconds
        self._failures = [t for t in self._failures if t >= cutoff]

    def _maybe_transition(self, now: float) -> None:
        if self._state == "open" and self._opened_at is not None:
            if now - self._opened_at >= self.cooldown_seconds:
                self._state = "half_open"

    def allow_request(self) -> tuple[bool, str]:
        """Whether a live LLM call may proceed."""
        now = time.monotonic()
        with self._lock:
            self._maybe_transition(now)
            if self._state == "open":
                remaining = 0.0
                if self._opened_at is not None:
                    remaining = max(
                        0.0, self.cooldown_seconds - (now - self._opened_at)
                    )
                return (
                    False,
                    f"LLM circuit open (cooldown ~{int(remaining)}s). "
                    f"Last error: {self._last_error or 'provider failures'}",
                )
            # closed and half_open allow a probe / normal traffic
            return True, ""

    def record_success(self) -> None:
        with self._lock:
            self._failures.clear()
            self._state = "closed"
            self._opened_at = None
            self._success_count += 1

    def record_failure(self, error: str = "") -> None:
        now = time.monotonic()
        with self._lock:
            self._last_error = (error or "")[:500]
            self._failure_count_total += 1
            if self._state == "half_open":
                # Probe failed — re-open
                self._state = "open"
                self._opened_at = now
                self._failures.append(now)
                return
            self._failures.append(now)
            self._prune(now)
            if len(self._failures) >= self.failure_threshold:
                self._state = "open"
                self._opened_at = now

    def snapshot(self) -> dict[str, Any]:
        now = time.monotonic()
        with self._lock:
            self._maybe_transition(now)
            self._prune(now)
            return self._snapshot_unlocked()

    def _snapshot_unlocked(self) -> dict[str, Any]:
        remaining = None
        if self._state == "open" and self._opened_at is not None:
            remaining = max(
                0.0, self.cooldown_seconds - (time.monotonic() - self._opened_at)
            )
        return {
            "state": self._state,
            "failures_in_window": len(self._failures),
            "failure_threshold": self.failure_threshold,
            "window_seconds": self.window_seconds,
            "cooldown_seconds": self.cooldown_seconds,
            "cooldown_remaining_seconds": remaining,
            "last_error": self._last_error or None,
            "success_count": self._success_count,
            "failure_count_total": self._failure_count_total,
        }


_breaker: LlmCircuitBreaker | None = None
_breaker_lock = threading.Lock()


def get_llm_breaker() -> LlmCircuitBreaker:
    global _breaker
    with _breaker_lock:
        if _breaker is None:
            _breaker = LlmCircuitBreaker()
        return _breaker


def reset_llm_breaker() -> dict[str, Any]:
    """Reset singleton (admin + tests)."""
    global _breaker
    with _breaker_lock:
        _breaker = LlmCircuitBreaker()
        return _breaker.snapshot()
