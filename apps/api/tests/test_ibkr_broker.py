"""IBKR backend wiring tests — no live Gateway required."""

import pytest

from app.brokers.errors import BrokerError
from app.brokers.factory import get_broker, reset_broker_cache
from app.brokers.ibkr import IBKRPaperClient
from app.config import Settings


def test_factory_selects_ibkr(monkeypatch):
    """BROKER_BACKEND=ibkr must instantiate the local Gateway client."""
    reset_broker_cache()
    from app.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("BROKER_BACKEND", "ibkr")
    monkeypatch.setenv("IBKR_PORT", "4002")
    monkeypatch.setenv("PAPER_ONLY", "true")
    get_settings.cache_clear()

    client = get_broker("test-user")
    assert isinstance(client, IBKRPaperClient)
    assert client.backend_name == "ibkr"
    assert client.is_paper_url is True


def test_ibkr_paper_port_detection():
    """Gateway paper (4002) and TWS paper (7497) are recognised as paper."""
    paper = IBKRPaperClient(
        Settings(broker_backend="ibkr", ibkr_port=4002, paper_only=True)
    )
    assert paper.is_paper_url is True

    tws_paper = IBKRPaperClient(
        Settings(broker_backend="ibkr", ibkr_port=7497, paper_only=True)
    )
    assert tws_paper.is_paper_url is True


def test_ibkr_blocks_live_when_paper_only():
    """Live ports are rejected when PAPER_ONLY=true."""
    live = IBKRPaperClient(
        Settings(broker_backend="ibkr", ibkr_port=4001, paper_only=True)
    )
    with pytest.raises(BrokerError, match="PAPER_ONLY"):
        live._guard_paper_only()


@pytest.mark.asyncio
async def test_ibkr_status_report_offline():
    """status_report must return diagnostic info even with no Gateway running."""
    client = IBKRPaperClient(
        Settings(broker_backend="ibkr", ibkr_port=4002, paper_only=True)
    )
    report = await client.status_report()
    assert report["backend"] == "ibkr"
    assert report["paper_port"] is True
    assert report["paper_only_setting"] is True
    assert "ib_async_installed" in report
    # Without a live Gateway we will not be connected.
    assert report.get("connected") is False or "error" in report


def test_ibkr_client_order_id_required():
    """submit_order must refuse empty client_order_id."""
    client = IBKRPaperClient(
        Settings(broker_backend="ibkr", ibkr_port=4002, paper_only=True)
    )
    with pytest.raises(BrokerError, match="client_order_id"):
        # Use a coroutine helper so pytest-asyncio isn't needed for this sync fail-fast path.
        import asyncio

        asyncio.run(
            client.submit_order(
                symbol="SPY",
                qty="1",
                side="buy",
                order_type="limit",
                limit_price="500",
                client_order_id="",
            )
        )
