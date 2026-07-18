"""PR4: kill switch, LLM circuit breaker, usage snapshot, admin API."""

import pytest
from fastapi.testclient import TestClient

from app.admin.controls import reset_controls, set_global_kill, set_user_kill
from app.admin.llm_breaker import LlmCircuitBreaker, reset_llm_breaker
from app.billing.usage import get_usage_snapshot, record_chat_and_check, reset_usage_memory
from app.brokers.factory import reset_broker_cache
from app.config import get_settings
from app.main import app


@pytest.fixture(autouse=True)
def _reset():
    reset_usage_memory()
    reset_controls()
    reset_llm_breaker()
    reset_broker_cache()
    get_settings.cache_clear()
    yield
    reset_usage_memory()
    reset_controls()
    reset_llm_breaker()
    reset_broker_cache()
    get_settings.cache_clear()


# ---------- circuit breaker unit ----------


def test_breaker_opens_after_threshold():
    b = LlmCircuitBreaker(failure_threshold=3, window_seconds=60, cooldown_seconds=30)
    assert b.allow_request()[0] is True
    b.record_failure("e1")
    b.record_failure("e2")
    assert b.allow_request()[0] is True
    b.record_failure("e3")
    ok, reason = b.allow_request()
    assert ok is False
    assert "circuit open" in reason.lower()
    assert b.snapshot()["state"] == "open"


def test_breaker_success_resets():
    b = LlmCircuitBreaker(failure_threshold=2, window_seconds=60, cooldown_seconds=30)
    b.record_failure("x")
    b.record_success()
    assert b.snapshot()["state"] == "closed"
    assert b.snapshot()["failures_in_window"] == 0


def test_breaker_half_open_after_cooldown():
    b = LlmCircuitBreaker(failure_threshold=1, window_seconds=60, cooldown_seconds=0)
    b.record_failure("boom")
    # cooldown 0 → immediately half_open on allow/snapshot
    snap = b.snapshot()
    assert snap["state"] in ("open", "half_open")
    # with cooldown 0, allow should pass (half_open)
    ok, _ = b.allow_request()
    assert ok is True
    b.record_success()
    assert b.snapshot()["state"] == "closed"


# ---------- usage snapshot ----------


@pytest.mark.asyncio
async def test_usage_snapshot_no_increment(monkeypatch):
    monkeypatch.setenv("FREE_CHAT_PER_DAY", "10")
    get_settings.cache_clear()
    await record_chat_and_check("snap-u", "free")
    snap = await get_usage_snapshot("snap-u", "free")
    assert snap["used"] == 1
    assert snap["limit"] == 10
    assert snap["remaining"] == 9
    snap2 = await get_usage_snapshot("snap-u", "free")
    assert snap2["used"] == 1  # unchanged


# ---------- kill switch on chat ----------


def test_global_kill_blocks_chat():
    set_global_kill(True, reason="maintenance")
    client = TestClient(app)
    r = client.post(
        "/agent/chat",
        json={"message": "hello"},
        headers={"X-User-Id": "kill-chat-user"},
    )
    assert r.status_code == 503
    assert "paused" in r.json()["detail"].lower() or "kill" in r.json()["detail"].lower()


def test_user_kill_blocks_only_that_user():
    set_user_kill("bad-user", True, reason="abuse")
    client = TestClient(app)
    r_bad = client.post(
        "/agent/chat",
        json={"message": "hello"},
        headers={"X-User-Id": "bad-user"},
    )
    assert r_bad.status_code == 503
    r_ok = client.post(
        "/agent/chat",
        json={"message": "hello"},
        headers={"X-User-Id": "good-user"},
    )
    assert r_ok.status_code == 200


def test_health_exposes_kill_and_circuit():
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert "global_kill" in body
    assert "llm_circuit" in body
    assert body.get("version", "").startswith("0.6")


def test_billing_status_includes_usage():
    client = TestClient(app)
    r = client.get("/billing/status", headers={"X-User-Id": "usage-ui"})
    assert r.status_code == 200
    body = r.json()
    assert "usage" in body
    assert body["usage"]["used"] == 0
    assert "service" in body


# ---------- admin API ----------


def test_admin_disabled_without_key():
    client = TestClient(app)
    r = client.get("/admin/status")
    assert r.status_code == 503


def test_admin_rejects_bad_key(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret-admin")
    get_settings.cache_clear()
    client = TestClient(app)
    r = client.get("/admin/status", headers={"X-Admin-Key": "wrong"})
    assert r.status_code == 401


def test_admin_kill_switch_and_status(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret-admin")
    get_settings.cache_clear()
    client = TestClient(app)
    headers = {"X-Admin-Key": "secret-admin"}

    st = client.get("/admin/status", headers=headers)
    assert st.status_code == 200
    assert st.json()["controls"]["global_kill"] is False

    kill = client.post(
        "/admin/kill-switch",
        json={"enabled": True, "reason": "ops drill"},
        headers=headers,
    )
    assert kill.status_code == 200
    assert kill.json()["global_kill"] is True

    chat = client.post(
        "/agent/chat",
        json={"message": "blocked?"},
        headers={"X-User-Id": "anyone"},
    )
    assert chat.status_code == 503

    unkill = client.post(
        "/admin/kill-switch",
        json={"enabled": False, "reason": "all clear"},
        headers=headers,
    )
    assert unkill.status_code == 200
    assert unkill.json()["global_kill"] is False


def test_admin_user_kill_and_usage(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "secret-admin")
    get_settings.cache_clear()
    client = TestClient(app)
    headers = {"X-Admin-Key": "secret-admin"}

    client.post(
        "/admin/kill-switch",
        json={"enabled": True, "user_id": "u-kill", "reason": "spam"},
        headers=headers,
    )
    usage = client.get("/admin/usage/u-kill", headers=headers)
    assert usage.status_code == 200
    assert usage.json()["chat_blocked"] is True

    reset = client.post("/admin/llm-breaker/reset", headers=headers)
    assert reset.status_code == 200
    assert reset.json()["llm_breaker"]["state"] == "closed"
