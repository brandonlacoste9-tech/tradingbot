"""Auth dependency — Clerk JWT or demo mode for multi-user PR1.

AUTH_MODE:
  disabled — accept X-User-Id or default demo user (dev / pre-Clerk deploy)
  clerk    — require Authorization: Bearer <Clerk session JWT>
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException

from app.config import get_settings


@dataclass(frozen=True)
class CurrentUser:
    """Authenticated principal for tenancy."""

    id: str  # stable tenant key (clerk_id or demo id)
    clerk_id: str | None = None
    email: str | None = None
    auth_mode: str = "disabled"


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
) -> CurrentUser:
    settings = get_settings()
    mode = (settings.auth_mode or "disabled").lower().strip()

    if mode in ("disabled", "demo", "off"):
        uid = (x_user_id or settings.demo_user_id or "demo").strip()
        if not uid:
            uid = "demo"
        # Basic sanitization for tenant key
        if len(uid) > 128 or any(c in uid for c in ("/", "\\", " ", "\n")):
            raise HTTPException(400, "Invalid X-User-Id")
        return CurrentUser(id=uid, email=None, auth_mode="disabled")

    if mode == "clerk":
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(401, "Missing Bearer token")
        token = authorization.split(" ", 1)[1].strip()
        if not token:
            raise HTTPException(401, "Empty Bearer token")
        from app.auth.clerk import verify_clerk_token

        try:
            claims = await verify_clerk_token(token)
        except Exception as e:  # noqa: BLE001
            raise HTTPException(401, f"Invalid token: {e}") from e

        sub = claims.get("sub")
        if not sub:
            raise HTTPException(401, "Token missing sub")
        email = claims.get("email") or claims.get("primary_email")
        return CurrentUser(id=str(sub), clerk_id=str(sub), email=email, auth_mode="clerk")

    raise HTTPException(500, f"Unknown AUTH_MODE={mode}")
