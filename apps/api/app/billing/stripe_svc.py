"""Stripe Checkout + Customer Portal + webhook helpers."""

from __future__ import annotations

import logging
from typing import Any

from app.billing.plans import normalize_plan
from app.config import get_settings

logger = logging.getLogger(__name__)


def stripe_configured() -> bool:
    s = get_settings()
    return bool(s.stripe_secret_key and s.stripe_price_id_pro)


def price_id_for_plan(plan: str) -> str:
    """Resolve Stripe price id for a paid plan."""
    s = get_settings()
    p = normalize_plan(plan)
    if p == "pro_plus":
        pid = (s.stripe_price_id_pro_plus or "").strip()
        if not pid:
            raise RuntimeError(
                "Pro+ not configured. Set STRIPE_PRICE_ID_PRO_PLUS on the API."
            )
        return pid
    if p == "pro":
        pid = (s.stripe_price_id_pro or "").strip()
        if not pid:
            raise RuntimeError("STRIPE_PRICE_ID_PRO is not set")
        return pid
    raise RuntimeError(f"No Stripe price for plan '{plan}'")


def plan_from_price_id(price_id: str | None) -> str | None:
    """Map a Stripe price id → app plan name."""
    if not price_id:
        return None
    s = get_settings()
    pro = (s.stripe_price_id_pro or "").strip()
    pro_plus = (s.stripe_price_id_pro_plus or "").strip()
    if pro_plus and price_id == pro_plus:
        return "pro_plus"
    if pro and price_id == pro:
        return "pro"
    return None


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
    plan: str = "pro",
) -> dict[str, Any]:
    if not stripe_configured():
        raise RuntimeError(
            "Stripe is not configured (STRIPE_SECRET_KEY + STRIPE_PRICE_ID_PRO)"
        )

    paid = normalize_plan(plan)
    if paid not in ("pro", "pro_plus"):
        raise RuntimeError("Checkout plan must be 'pro' or 'pro_plus'")

    price_id = price_id_for_plan(paid)
    stripe = _stripe()
    params: dict[str, Any] = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": user_id,
        "metadata": {"user_id": user_id, "plan": paid},
        "subscription_data": {
            "metadata": {"user_id": user_id, "plan": paid},
        },
        "allow_promotion_codes": True,
    }
    if customer_id:
        params["customer"] = customer_id
    elif email:
        params["customer_email"] = email

    session = stripe.checkout.Session.create(**params)
    return {"id": session.id, "url": session.url, "plan": paid}


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


def plan_from_subscription_object(data: dict[str, Any]) -> str:
    """
    Map Stripe subscription object → app plan.
    Prefer price id / metadata; fall back to active → pro.
    """
    status = (data.get("status") or "").lower()
    if status in ("canceled", "unpaid", "incomplete_expired"):
        return "free"
    if status not in ("active", "trialing", "past_due"):
        return "free"

    meta = data.get("metadata") or {}
    if isinstance(meta, dict) and meta.get("plan"):
        return normalize_plan(str(meta["plan"]))

    items = (data.get("items") or {}).get("data") or []
    for item in items:
        price = item.get("price") or {}
        pid = price.get("id") if isinstance(price, dict) else None
        mapped = plan_from_price_id(pid)
        if mapped:
            return mapped

    return "pro"


def plan_from_status(status: str | None) -> str:
    """Map Stripe subscription status → app plan (legacy; prefer plan_from_subscription_object)."""
    s = (status or "").lower()
    if s in ("active", "trialing"):
        return "pro"
    return "free"
