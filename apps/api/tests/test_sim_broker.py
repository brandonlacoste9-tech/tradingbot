"""PaperSim broker unit tests."""

import pytest

from app.brokers.sim import PaperSimBroker


@pytest.mark.asyncio
async def test_sim_validate_and_account():
    b = PaperSimBroker()
    v = await b.validate_connection()
    assert v["ok"] is True
    assert v["is_paper"] is True
    assert v["backend"] == "sim"
    acct = await b.get_account()
    assert float(acct["cash"]) == 100000.0


@pytest.mark.asyncio
async def test_sim_idempotent_order():
    b = PaperSimBroker()
    oid = "atb-test-client-001"
    o1 = await b.submit_order(
        symbol="SPY",
        qty="1",
        side="buy",
        order_type="limit",
        limit_price="520",
        client_order_id=oid,
    )
    o2 = await b.submit_order(
        symbol="SPY",
        qty="1",
        side="buy",
        order_type="limit",
        limit_price="520",
        client_order_id=oid,
    )
    assert o1["id"] == o2["id"]
    assert o1["status"] == "filled"
    positions = await b.get_positions()
    assert any(p["symbol"] == "SPY" for p in positions)


@pytest.mark.asyncio
async def test_sim_quote():
    b = PaperSimBroker()
    t = await b.get_latest_trade("AAPL")
    assert "trade" in t
    assert t["trade"]["p"] > 0
