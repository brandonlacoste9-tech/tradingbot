"""PaperSim export/import for PR2 persistence."""

from decimal import Decimal

import pytest

from app.brokers.factory import get_broker, reset_broker_cache
from app.brokers.sim import PaperSimBroker


@pytest.fixture(autouse=True)
def _reset():
    reset_broker_cache()
    yield
    reset_broker_cache()


def test_export_import_roundtrip():
    b = PaperSimBroker(user_id="u1")
    b._cash = Decimal("90000")
    b._positions["SPY"] = {"qty": Decimal("2"), "avg": Decimal("500")}
    state = b.export_state()
    b2 = PaperSimBroker(user_id="u1")
    b2.import_state(state)
    assert b2._cash == Decimal("90000")
    assert b2._positions["SPY"]["qty"] == Decimal("2")


@pytest.mark.asyncio
async def test_submit_then_export_has_position():
    b = PaperSimBroker(user_id="u2")
    await b.submit_order(
        symbol="AAPL",
        qty="1",
        side="buy",
        order_type="limit",
        limit_price="190",
        client_order_id="c1",
    )
    st = b.export_state()
    assert "AAPL" in st["positions"]
    assert st["cash"] < Decimal("100000")
