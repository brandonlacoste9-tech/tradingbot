"""Manual paper ticket API — /proposals/create + control plane."""

import os

import pytest
from fastapi.testclient import TestClient

# Force Canada-safe paper sim for this module (ignore local IBKR .env)
os.environ["BROKER_BACKEND"] = "sim"
os.environ["AUTH_MODE"] = "disabled"
os.environ["PAPER_ONLY"] = "true"

from app.brokers.factory import reset_broker_cache
from app.config import get_settings
from app.main import app


@pytest.fixture(autouse=True)
def _paper_sim_env():
    os.environ["BROKER_BACKEND"] = "sim"
    os.environ["AUTH_MODE"] = "disabled"
    os.environ["PAPER_ONLY"] = "true"
    get_settings.cache_clear()
    reset_broker_cache()
    yield
    get_settings.cache_clear()
    reset_broker_cache()


def test_manual_ticket_awaits_confirm_then_fills():
    client = TestClient(app)
    headers = {"X-User-Id": "test-manual-ticket"}

    r = client.post(
        "/proposals/create",
        headers=headers,
        json={
            "symbol": "AAPL",
            "side": "buy",
            "qty": "1",
            "order_type": "limit",
            "limit_price": "190",
            "reason": "Unit test manual paper ticket",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    prop = body["proposal"]
    assert prop["policy_status"] == "awaiting_confirm"
    assert prop["symbol"] == "AAPL"
    pid = prop["id"]

    # Confirm → paper fill
    c = client.post(
        "/proposals/confirm",
        headers=headers,
        json={"proposal_id": pid},
    )
    assert c.status_code == 200, c.text
    assert c.json()["proposal"]["policy_status"] == "submitted"

    port = client.get("/portfolio", headers=headers)
    assert port.status_code == 200
    positions = port.json()["positions"]
    assert any(p["symbol"] == "AAPL" for p in positions)


def test_manual_ticket_no_submit_without_confirm():
    client = TestClient(app)
    headers = {"X-User-Id": "test-manual-no-fill"}
    r = client.post(
        "/proposals/create",
        headers=headers,
        json={
            "symbol": "SPY",
            "side": "buy",
            "qty": "1",
            "order_type": "limit",
            "limit_price": "520",
            "reason": "Should not fill until confirm",
        },
    )
    assert r.status_code == 200
    assert r.json()["proposal"]["policy_status"] == "awaiting_confirm"
    port = client.get("/portfolio", headers=headers)
    # Fresh paper book — no SPY position until confirm
    positions = port.json()["positions"]
    assert not any(p["symbol"] == "SPY" for p in positions)
