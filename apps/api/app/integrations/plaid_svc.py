"""Plaid bank-link scaffolding (not market data, not a broker).

Plaid connects user bank accounts (balances, transactions, auth).
For the paper desk this is optional future funding / net-worth UX —
it does NOT place trades or replace PaperSim / IBKR.

Requires:
  PLAID_CLIENT_ID
  PLAID_SECRET
  PLAID_ENV = sandbox | development | production
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings

_HOSTS = {
    "sandbox": "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production": "https://production.plaid.com",
}


def plaid_status() -> dict[str, Any]:
    s = get_settings()
    client_id = (s.plaid_client_id or "").strip()
    secret = (s.plaid_secret or "").strip()
    env = (s.plaid_env or "sandbox").lower().strip()
    if env not in _HOSTS:
        env = "sandbox"
    return {
        "provider": "plaid",
        "client_id_configured": bool(client_id),
        "secret_configured": bool(secret),
        "ready": bool(client_id and secret),
        "env": env,
        "host": _HOSTS[env],
        "note": (
            "Bank linking only — not market data or order routing. "
            "Set PLAID_SECRET to enable Link token creation."
        ),
    }


def is_plaid_ready() -> bool:
    return plaid_status()["ready"] is True


async def create_link_token(
    *,
    user_id: str,
    products: list[str] | None = None,
    country_codes: list[str] | None = None,
) -> dict[str, Any]:
    """
    Create a Plaid Link token for the frontend Link widget.
    Requires PLAID_CLIENT_ID + PLAID_SECRET.
    """
    s = get_settings()
    st = plaid_status()
    if not st["ready"]:
        raise RuntimeError(
            "Plaid not ready — set PLAID_CLIENT_ID and PLAID_SECRET"
        )
    body = {
        "client_id": s.plaid_client_id.strip(),
        "secret": s.plaid_secret.strip(),
        "client_name": "IndieTrades",
        "user": {"client_user_id": user_id},
        "products": products or ["transactions"],
        "country_codes": country_codes or ["US", "CA"],
        "language": "en",
    }
    url = f"{st['host']}/link/token/create"
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(url, json=body)
        data = r.json()
        if r.status_code >= 400:
            raise RuntimeError(
                f"Plaid link/token/create {r.status_code}: "
                f"{data.get('error_message') or data}"
            )
        return {
            "link_token": data.get("link_token"),
            "expiration": data.get("expiration"),
            "request_id": data.get("request_id"),
            "env": st["env"],
            "source": "plaid",
        }
