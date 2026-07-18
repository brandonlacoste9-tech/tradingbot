"""Stripe Checkout + Customer Portal + webhook helpers."""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


def stripe_configured() -> bool:
    s = get_settings()
    return bool(s.stripe_secret_key and s.stripe_price_id_pro)


def _stripe():
    import stripe

    s = get_settings()
    stripe.api_key = s.stripe_secret_key
    return stripe


async def create_checkout_session(
    *,
    user_id: str,
    email: str | None,
    success_url: str,
    cancel_url: str,
    customer_id: str | None = None,
) -> dict[str, Any]:
    if not stripe_configured():
        raise RuntimeError("Stripe is not configured (STRIPE_SECRET_KEY + STRIPE_PRICE_ID_PRO)")

    stripe = _stripe()
    settings = get_settings()
    params: dict[str, Any] = {
        "mode": "subscription",
        "line_items": [{"price": settings.stripe_price_id_pro, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": user_id,
        "metadata": {"user_id": user_id},
        "subscription_data": {"metadata": {"user_id": user_id}},
        "allow_promotion_codes": True,
    }
    if customer_id:
        params["customer"] = customer_id
    elif email:
        params["customer_email"] = email

    session = stripe.checkout.Session.create(**params)
    return {"id": session.id, "url": session.url}


async def create_portal_session(*, customer_id: str, return_url: str) -> dict[str, Any]:
    if not stripe_configured():
        raise RuntimeError("Stripe is not configured")
    stripe = _stripe()
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return {"url": session.url}


def construct_webhook_event(payload: bytes, sig_header: str):
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET not set")
    stripe = _stripe()
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )


def user_id_from_subscription_obj(sub: Any) -> str | None:
    meta = getattr(sub, "metadata", None) or {}
    if isinstance(meta, dict) and meta.get("user_id"):
        return str(meta["user_id"])
    return None


def plan_from_status(status: str | None) -> str:
    """Map Stripe subscription status → app plan."""
    s = (status or "").lower()
    if s in ("active", "trialing"):
        return "pro"
    return "free"
