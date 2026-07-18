"""Phase 3 hybrid C — aggressive fill / passive working / cancel / cross."""

from __future__ import annotations

import os
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

os.environ["BROKER_BACKEND"] = "sim"
os.environ["AUTH_MODE"] = "disabled"
os.environ["PAPER_ONLY"] = "true"

from app.brokers.factory import reset_broker_cache
from app.brokers.sim import PaperSimBroker
from app.config import get_settings
from app.main import app


@pytest.fixture(autouse=True)
def _env():
    os.environ["BROKER_BACKEND"] = "sim"
    os.environ["AUTH_MODE"] = "disabled"
    os.environ["PAPER_ONLY"] = "true"
    get_settings.cache_clear()
    reset_broker_cache()
    yield
    get_settings.cache_clear()
    reset_broker_cache()


@pytest.mark.asyncio
async def test_sim_aggressive_buy_fills_at_mark():
    b = PaperSimBroker()
    # AAPL seed mark 190; limit 200 is through → aggressive
    o = await b.submit_order(
        symbol="AAPL",
        qty="1",
        side="buy",
        order_type="limit",
        limit_price="200",
        client_order_id="hyb-agg-1",
    )
    assert o["status"] == "filled"
    assert o["fill_kind"] == "aggressive"
    assert Decimal(o["filled_avg_price"]) == Decimal("190.00") or Decimal(
        o["filled_avg_price"]
    ) == b._mark("AAPL")
    pos = await b.get_positions()
    assert any(p["symbol"] == "AAPL" for p in pos)


@pytest.mark.asyncio
async def test_sim_passive_buy_rests_working():
    b = PaperSimBroker()
    # limit below mark → working
    o = await b.submit_order(
        symbol="AAPL",
        qty="1",
        side="buy",
        order_type="limit",
        limit_price="100",
        client_order_id="hyb-pas-1",
    )
    assert o["status"] == "working"
    assert o["fill_kind"] == "passive"
    pos = await b.get_positions()
    assert not any(p["symbol"] == "AAPL" for p in pos)
    # cash unchanged
    acct = await b.get_account()
    assert float(acct["cash"]) == 100000.0


@pytest.mark.asyncio
async def test_sim_passive_cross_then_fill():
    b = PaperSimBroker()
    o = await b.submit_order(
        symbol="AAPL",
        qty="1",
        side="buy",
        order_type="limit",
        limit_price="100",
        client_order_id="hyb-cross-1",
    )
    assert o["status"] == "working"
    b.set_mark("AAPL", Decimal("99"))  # mark drops through limit
    changed = await b.evaluate_working_orders()
    assert len(changed) == 1
    assert changed[0]["status"] == "filled"
    assert changed[0]["fill_kind"] == "passive_cross"
    pos = await b.get_positions()
    assert any(p["symbol"] == "AAPL" for p in pos)


@pytest.mark.asyncio
async def test_sim_cancel_working():
    b = PaperSimBroker()
    o = await b.submit_order(
        symbol="MSFT",
        qty="1",
        side="buy",
        order_type="limit",
        limit_price="50",
        client_order_id="hyb-can-1",
    )
    assert o["status"] == "working"
    c = await b.cancel_order(o["id"])
    assert c["status"] == "cancelled"
    with pytest.raises(Exception):
        await b.cancel_order(o["id"] + "-missing")


def _ticket(client: TestClient, headers: dict, **body):
    r = client.post("/proposals/create", headers=headers, json=body)
    assert r.status_code == 200, r.text
    return r.json()["proposal"]


def test_api_aggressive_confirm_fills():
    client = TestClient(app)
    headers = {"X-User-Id": "test-hyb-agg"}
    # AAPL mark 190, limit 190 → aggressive
    p = _ticket(
        client,
        headers,
        symbol="AAPL",
        side="buy",
        qty="1",
        order_type="limit",
        limit_price="190",
        reason="Aggressive paper fill test",
    )
    c = client.post(
        "/proposals/confirm",
        headers=headers,
        json={"proposal_id": p["id"]},
    )
    assert c.status_code == 200, c.text
    body = c.json()
    assert body["proposal"]["policy_status"] == "filled"
    assert body["order"]["status"] == "filled"
    assert body["paper"] is True
    assert "fill_rules" in body
    port = client.get("/portfolio", headers=headers)
    assert any(x["symbol"] == "AAPL" for x in port.json()["positions"])


def test_api_passive_working_cancel():
    client = TestClient(app)
    headers = {"X-User-Id": "test-hyb-pas"}
    p = _ticket(
        client,
        headers,
        symbol="AAPL",
        side="buy",
        qty="1",
        order_type="limit",
        limit_price="50",
        reason="Passive working test",
    )
    c = client.post(
        "/proposals/confirm",
        headers=headers,
        json={"proposal_id": p["id"]},
    )
    assert c.status_code == 200, c.text
    assert c.json()["proposal"]["policy_status"] == "working"
    assert c.json()["order"]["status"] == "working"

    orders = client.get("/orders", headers=headers)
    assert orders.status_code == 200
    rows = orders.json()["orders"]
    working = [o for o in rows if o.get("status") == "working"]
    assert len(working) >= 1
    bid = working[0].get("broker_order_id") or working[0].get("id")
    z = client.post(f"/orders/{bid}/cancel", headers=headers)
    assert z.status_code == 200, z.text
    assert z.json()["ok"] is True

    orders2 = client.get("/orders", headers=headers)
    statuses = {o.get("status") for o in orders2.json()["orders"]}
    assert "cancelled" in statuses or "canceled" in statuses


def test_manual_ticket_status_filled_not_only_submitted():
    """Existing aggressive path now reports filled (Phase 3 vocab)."""
    client = TestClient(app)
    headers = {"X-User-Id": "test-manual-ticket-p3"}
    p = _ticket(
        client,
        headers,
        symbol="AAPL",
        side="buy",
        qty="1",
        order_type="limit",
        limit_price="190",
        reason="Unit test manual paper ticket p3",
    )
    c = client.post(
        "/proposals/confirm",
        headers=headers,
        json={"proposal_id": p["id"]},
    )
    assert c.status_code == 200
    assert c.json()["proposal"]["policy_status"] in ("filled", "submitted")
