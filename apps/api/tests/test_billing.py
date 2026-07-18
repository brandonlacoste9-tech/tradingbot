"""PR3 billing plans + usage caps (no live Stripe)."""

import pytest
from fastapi.testclient import TestClient

from app.billing.plans import normalize_plan, plan_allows_chat
from app.billing.usage import record_chat_and_check, reset_usage_memory
from app.brokers.factory import reset_broker_cache
from app.config import get_settings
from app.main import app


@pytest.fixture(autouse=True)
def _reset():
    reset_usage_memory()
    reset_broker_cache()
    get_settings.cache_clear()
    yield
    reset_usage_memory()
    reset_broker_cache()
    get_settings.cache_clear()


def test_normalize_plan():
    assert normalize_plan("PRO") == "pro"
    assert normalize_plan("pro+") == "pro_plus"
    assert normalize_plan(None) == "free"


def test_plan_allows_chat():
    ok, used, limit = plan_allows_chat("free", 0)
    assert ok and used == 0 and limit >= 1
    ok2, _, limit2 = plan_allows_chat("free", limit)
    assert ok2 is False


@pytest.mark.asyncio
async def test_usage_cap_memory(monkeypatch):
    monkeypatch.setenv("FREE_CHAT_PER_DAY", "3")
    get_settings.cache_clear()
    for i in range(3):
        r = await record_chat_and_check("cap-user", "free")
        assert r["allowed"] is True
    r = await record_chat_and_check("cap-user", "free")
    assert r["allowed"] is False


def test_billing_status_endpoint():
    client = TestClient(app)
    r = client.get("/billing/status", headers={"X-User-Id": "bill-user"})
    assert r.status_code == 200
    body = r.json()
    assert body["plan"] == "free"
    assert "stripe_configured" in body
    assert "plans" in body


def test_dev_set_plan_blocked_by_default():
    client = TestClient(app)
    r = client.post(
        "/billing/dev-set-plan",
        json={"plan": "pro"},
        headers={"X-User-Id": "bill-user"},
    )
    assert r.status_code == 403


def test_dev_set_plan_when_enabled(monkeypatch):
    monkeypatch.setenv("STRIPE_DEV_MODE", "true")
    get_settings.cache_clear()
    client = TestClient(app)
    r = client.post(
        "/billing/dev-set-plan",
        json={"plan": "pro"},
        headers={"X-User-Id": "bill-user-2"},
    )
    assert r.status_code == 200
    assert r.json()["plan"] == "pro"
    me = client.get("/me", headers={"X-User-Id": "bill-user-2"})
    assert me.json()["plan"] == "pro"
