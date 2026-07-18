"""Market data: Massive + FMP + router (mocked HTTP)."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.brokers.factory import reset_broker_cache
from app.brokers.sim import PaperSimBroker
from app.config import get_settings
from app.main import app
from app.marketdata.fmp import get_quote as fmp_get_quote
from app.marketdata.fmp import is_fmp_configured
from app.marketdata.massive import get_quote as massive_get_quote
from app.marketdata.massive import is_massive_configured
from app.marketdata.router import get_quote as md_get_quote


@pytest.fixture(autouse=True)
def _reset():
    reset_broker_cache()
    get_settings.cache_clear()
    yield
    reset_broker_cache()
    get_settings.cache_clear()


def test_not_configured_by_default():
    assert is_massive_configured() is False
    assert is_fmp_configured() is False


def test_configured_when_keys_set(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "test-key-123")
    monkeypatch.setenv("FMP_API_KEY", "fmp-key-456")
    monkeypatch.setenv("ALPHA_VANTAGE_API_KEY", "av-key")
    get_settings.cache_clear()
    assert is_massive_configured() is True
    assert is_fmp_configured() is True
    from app.marketdata import is_alphavantage_configured

    assert is_alphavantage_configured() is True


@pytest.mark.asyncio
async def test_massive_get_quote_from_prev(monkeypatch):
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
        q = await massive_get_quote("aapl")
    assert q["symbol"] == "AAPL"
    assert q["close"] == 103.5
    assert q["source"] == "massive"


@pytest.mark.asyncio
async def test_fmp_get_quote(monkeypatch):
    monkeypatch.setenv("FMP_API_KEY", "fmp-test")
    get_settings.cache_clear()
    fake = [
        {
            "symbol": "AAPL",
            "name": "Apple Inc.",
            "price": 333.74,
            "changePercentage": 0.14,
            "change": 0.48,
            "volume": 1e6,
            "dayLow": 329.0,
            "dayHigh": 335.0,
            "yearHigh": 335.0,
            "yearLow": 200.0,
            "marketCap": 4e12,
        }
    ]
    with patch("app.marketdata.fmp._get", new=AsyncMock(return_value=fake)):
        q = await fmp_get_quote("aapl")
    assert q["symbol"] == "AAPL"
    assert q["close"] == 333.74
    assert q["source"] == "fmp"


@pytest.mark.asyncio
async def test_router_prefers_fmp(monkeypatch):
    monkeypatch.setenv("FMP_API_KEY", "fmp")
    monkeypatch.setenv("MASSIVE_API_KEY", "mass")
    get_settings.cache_clear()
    fmp_q = {
        "symbol": "AAPL",
        "close": 10.0,
        "price": "10.0",
        "source": "fmp",
    }
    with patch("app.marketdata.fmp.get_quote", new=AsyncMock(return_value=fmp_q)):
        with patch(
            "app.marketdata.massive.get_quote",
            new=AsyncMock(side_effect=AssertionError("should not call massive")),
        ):
            q = await md_get_quote("AAPL")
    assert q["source"] == "fmp"


@pytest.mark.asyncio
async def test_sim_set_mark():
    b = PaperSimBroker()
    b.set_mark("AAPL", "333.74")
    t = await b.get_latest_trade("AAPL")
    assert float(t["price"]) == 333.74


@pytest.mark.asyncio
async def test_alphavantage_quote(monkeypatch):
    monkeypatch.setenv("ALPHA_VANTAGE_API_KEY", "av-test")
    get_settings.cache_clear()
    from app.marketdata.alphavantage import get_quote as av_quote

    fake = {
        "Global Quote": {
            "01. symbol": "AAPL",
            "02. open": "100",
            "03. high": "110",
            "04. low": "99",
            "05. price": "105.5",
            "06. volume": "1000",
            "07. latest trading day": "2026-07-17",
            "08. previous close": "104",
            "09. change": "1.5",
            "10. change percent": "1.44%",
        }
    }
    with patch("app.marketdata.alphavantage._query", new=AsyncMock(return_value=fake)):
        q = await av_quote("aapl")
    assert q["source"] == "alphavantage"
    assert q["close"] == 105.5


def test_health_exposes_md_flags(monkeypatch):
    monkeypatch.setenv("FMP_API_KEY", "k")
    monkeypatch.setenv("MASSIVE_API_KEY", "m")
    monkeypatch.setenv("ALPHA_VANTAGE_API_KEY", "av")
    get_settings.cache_clear()
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["fmp_configured"] is True
    assert body["massive_configured"] is True
    assert body["alphavantage_configured"] is True
    assert body["market_data"]["primary"] == "fmp"


def test_market_status_without_keys():
    """Yahoo free provider is always on — status endpoint still works without API keys."""
    client = TestClient(app)
    r = client.get("/market/status", headers={"X-User-Id": "md-user"})
    assert r.status_code == 200
    body = r.json()
    assert body.get("yahoo", {}).get("configured") is True
    # May be ok True (Yahoo probe) or False if network blocked in CI
    assert "ok" in body
