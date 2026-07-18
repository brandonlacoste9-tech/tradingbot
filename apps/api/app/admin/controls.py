"""Admin kill switch — global and per-user (PR4).

In-process state with optional env bootstrap via GLOBAL_KILL_SWITCH.
Survives within a single process; multi-instance deployments share via
ADMIN_API_KEY mutations on each instance (or set env + redeploy for hard off).
"""

from __future__ import annotations

import hmac
import threading
from datetime import datetime, timezone
from typing import Any

from fastapi import Header, HTTPException

from app.config import get_settings

_lock = threading.Lock()
_global_kill: bool = False
_user_kills: set[str] = set()
_reason: str = ""
_updated_at: str | None = None
_bootstrapped = False


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bootstrap() -> None:
    global _global_kill, _bootstrapped
    if _bootstrapped:
        return
    with _lock:
        if _bootstrapped:
            return
        settings = get_settings()
        if settings.global_kill_switch:
            _global_kill = True
        _bootstrapped = True


def reset_controls() -> None:
    """Test helper — clear all kill state."""
    global _global_kill, _reason, _updated_at, _bootstrapped
    with _lock:
        _global_kill = False
        _user_kills.clear()
        _reason = ""
        _updated_at = None
        _bootstrapped = False


def set_global_kill(enabled: bool, reason: str = "") -> dict[str, Any]:
    global _global_kill, _reason, _updated_at
    _bootstrap()
    with _lock:
        _global_kill = bool(enabled)
        _reason = (reason or "").strip()
        _updated_at = _now()
        return {
            "global_kill": _global_kill,
            "reason": _reason,
            "updated_at": _updated_at,
            "user_kills": sorted(_user_kills),
        }


def set_user_kill(user_id: str, enabled: bool, reason: str = "") -> dict[str, Any]:
    global _reason, _updated_at
    _bootstrap()
    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("user_id required")
    with _lock:
        if enabled:
            _user_kills.add(uid)
        else:
            _user_kills.discard(uid)
        if reason:
            _reason = reason.strip()
        _updated_at = _now()
        return {
            "user_id": uid,
            "killed": uid in _user_kills,
            "global_kill": _global_kill,
            "reason": _reason,
            "updated_at": _updated_at,
        }


def is_trading_blocked(user_id: str | None = None) -> tuple[bool, str]:
    """Return (blocked, reason) for proposals/confirm."""
    _bootstrap()
    with _lock:
        if _global_kill:
            return True, _reason or "global kill switch is active"
        if user_id and user_id in _user_kills:
            return True, _reason or f"user kill switch active for {user_id}"
    return False, ""


def is_chat_blocked(user_id: str | None = None) -> tuple[bool, str]:
    """Same as trading for v1 — one kill covers chat + propose + confirm."""
    return is_trading_blocked(user_id)


def get_controls_snapshot() -> dict[str, Any]:
    _bootstrap()
    with _lock:
        return {
            "global_kill": _global_kill,
            "user_kills": sorted(_user_kills),
            "user_kill_count": len(_user_kills),
            "reason": _reason,
            "updated_at": _updated_at,
        }


def assert_admin_key(
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
) -> None:
    """FastAPI dependency: require ADMIN_API_KEY when configured."""
    settings = get_settings()
    expected = (settings.admin_api_key or "").strip()
    if not expected:
        raise HTTPException(
            503,
            "Admin API disabled. Set ADMIN_API_KEY on the API service.",
        )
    if not x_admin_key or not hmac.compare_digest(
        x_admin_key.strip().encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(401, "Invalid or missing X-Admin-Key")
