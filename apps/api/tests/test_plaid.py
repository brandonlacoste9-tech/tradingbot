"""Plaid scaffolding — status + link-token gate."""

import pytest
from fastapi.testclient import TestClient

from app.brokers.factory import reset_broker_cache
from app.config import get_settings
from app.integrations.plaid_svc import is_plaid_ready, plaid_status
from app.main import app


@pytest.fixture(autouse=True)
def _reset():
    reset_broker_cache()
    get_settings.cache_clear()
    yield
    reset_broker_cache()
    get_settings.cache_clear()


def test_plaid_not_ready_by_default():
    assert is_plaid_ready() is False
    st = plaid_status()
    assert st["client_id_configured"] is False
    assert st["ready"] is False


def test_plaid_ready_with_both(monkeypatch):
    monkeypatch.setenv("PLAID_CLIENT_ID", "cid")
    monkeypatch.setenv("PLAID_SECRET", "sec")
    monkeypatch.setenv("PLAID_ENV", "sandbox")
    get_settings.cache_clear()
    assert is_plaid_ready() is True
    assert plaid_status()["env"] == "sandbox"


def test_health_includes_plaid(monkeypatch):
    monkeypatch.setenv("PLAID_CLIENT_ID", "6a5b8c43110e0b000c932352")
    get_settings.cache_clear()
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert "plaid" in body
    assert body["plaid"]["client_id_configured"] is True
    assert body["plaid"]["ready"] is False  # no secret


def test_link_token_503_without_secret(monkeypatch):
    monkeypatch.setenv("PLAID_CLIENT_ID", "cid-only")
    get_settings.cache_clear()
    client = TestClient(app)
    r = client.post("/plaid/link-token", headers={"X-User-Id": "u1"})
    assert r.status_code == 503
