"""Verify Clerk session JWTs via JWKS."""

from __future__ import annotations

import time
from typing import Any

import httpx
from jose import jwt
from jose.exceptions import JWTError

from app.config import get_settings

_jwks_cache: dict[str, Any] | None = None
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 3600.0


async def _get_jwks() -> dict[str, Any]:
    global _jwks_cache, _jwks_fetched_at
    settings = get_settings()
    now = time.time()
    if _jwks_cache and (now - _jwks_fetched_at) < _JWKS_TTL:
        return _jwks_cache

    # Clerk JWKS: https://<frontend-api>/.well-known/jwks.json
    # Or https://clerk.<domain>/.well-known/jwks.json
    jwks_url = settings.clerk_jwks_url
    if not jwks_url and settings.clerk_issuer:
        jwks_url = settings.clerk_issuer.rstrip("/") + "/.well-known/jwks.json"
    if not jwks_url:
        raise RuntimeError(
            "CLERK_JWKS_URL or CLERK_ISSUER required when AUTH_MODE=clerk"
        )

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(jwks_url)
        r.raise_for_status()
        _jwks_cache = r.json()
        _jwks_fetched_at = now
        return _jwks_cache


async def verify_clerk_token(token: str) -> dict[str, Any]:
    """Validate Clerk JWT and return claims."""
    settings = get_settings()
    jwks = await _get_jwks()

    try:
        header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise ValueError(f"bad token header: {e}") from e

    kid = header.get("kid")
    key = None
    for jwk in jwks.get("keys") or []:
        if jwk.get("kid") == kid:
            key = jwk
            break
    if key is None and jwks.get("keys"):
        key = jwks["keys"][0]
    if key is None:
        raise ValueError("no matching JWK")

    options = {"verify_aud": bool(settings.clerk_audience)}
    decode_kwargs: dict[str, Any] = {
        "algorithms": [header.get("alg") or "RS256"],
        "options": options,
    }
    if settings.clerk_issuer:
        decode_kwargs["issuer"] = settings.clerk_issuer
    if settings.clerk_audience:
        decode_kwargs["audience"] = settings.clerk_audience

    try:
        claims = jwt.decode(token, key, **decode_kwargs)
    except JWTError as e:
        raise ValueError(str(e)) from e
    return claims
