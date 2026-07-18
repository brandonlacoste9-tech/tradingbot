"""Massive market data client + tool wiring (mocked HTTP)."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.brokers.factory import reset_broker_cache
from app.brokers.sim import PaperSimBroker
from app.config import get_settings
from app.main import app
from app.marketdata.massive import get_quote, is_massive_configured


@pytest.fixture(autouse=True)
def _reset():
    reset_broker_cache()
    get_settings.cache_clear()
    yield
    reset_broker_cache()
    get_settings.cache_clear()


def test_not_configured_by_default():
    assert is_massive_configured() is False


def test_configured_when_key_set(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "test-key-123")
    get_settings.cache_clear()
    assert is_massive_configured() is True


@pytest.mark.asyncio
async def test_get_quote_from_prev(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "test-key")
    get_settings.cache_clear()
    fake = {
        "results": [
            {
                "T": "AAPL",
                "o": 100.0,
                "h": 105.0,
                "l": 99.0,
                "c": 103.5,
                "v": 1e6,
                "vw": 102.0,
                "t": 1,
                "n": 10,
            }
        ],
        "status": "OK",
    }
    with patch("app.marketdata.massive._get", new=AsyncMock(return_value=fake)):
        q = await get_quote("aapl")
    assert q["symbol"] == "AAPL"
    assert q["close"] == 103.5
    assert q["source"] == "massive"
    assert q["delayed"] is True


@pytest.mark.asyncio
async def test_sim_set_mark():
    b = PaperSimBroker()
    b.set_mark("AAPL", "333.74")
    t = await b.get_latest_trade("AAPL")
    assert float(t["price"]) == 333.74


def test_health_exposes_massive_flag(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "k")
    get_settings.cache_clear()
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["massive_configured"] is True
    assert body["market_data"]["provider"] == "massive"


def test_market_status_without_key():
    client = TestClient(app)
    r = client.get("/market/status", headers={"X-User-Id": "md-user"})
    assert r.status_code == 200
    assert r.json()["ok"] is False
