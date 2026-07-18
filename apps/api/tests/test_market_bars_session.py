"""Trade floor realism — /market/bars + /market/session."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("BROKER_BACKEND", "sim")
os.environ.setdefault("AUTH_MODE", "disabled")
os.environ.setdefault("PAPER_ONLY", "true")

from app.brokers.factory import reset_broker_cache
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


def _headers(uid: str = "test-bars-user") -> dict[str, str]:
    return {"X-User-Id": uid}


def test_market_session_returns_rth_flag():
    client = TestClient(app)
    r = client.get("/market/session", headers=_headers())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert "us_rth_open" in body
    assert isinstance(body["us_rth_open"], bool)
    assert body["label"] in ("US RTH open", "US RTH closed")
    assert body.get("paper") is True
    assert "now_utc" in body


def test_market_bars_invalid_symbol():
    client = TestClient(app)
    r = client.get("/market/bars?symbol=", headers=_headers())
    assert r.status_code == 400


def test_market_bars_sorts_ascending_and_never_fakes():
    client = TestClient(app)
    # Newest-first input (FMP style) must come out ascending for charts
    raw = {
        "symbol": "AAPL",
        "source": "test",
        "bars": [
            {"t": "2026-01-03", "o": 3, "h": 4, "l": 2, "c": 3.5, "v": 100},
            {"t": "2026-01-02", "o": 2, "h": 3, "l": 1, "c": 2.5, "v": 100},
            {"t": "2026-01-01", "o": 1, "h": 2, "l": 0.5, "c": 1.5, "v": 100},
        ],
    }
    with patch("app.main.md_get_bars", new_callable=AsyncMock, return_value=raw):
        r = client.get(
            "/market/bars?symbol=AAPL&timeframe=1Day&limit=60",
            headers=_headers("test-bars-sort"),
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["symbol"] == "AAPL"
    assert body["timeframe"] == "1Day"
    assert body["count"] == 3
    assert body["source"] == "test"
    assert body["paper"] is True
    closes = [b["c"] for b in body["bars"]]
    assert closes == [1.5, 2.5, 3.5]
    assert "fetched_at" in body


def test_market_bars_1month_alias_and_limit():
    client = TestClient(app)
    bars = [
        {
            "t": f"2026-01-{i:02d}",
            "o": float(i),
            "h": float(i) + 1,
            "l": float(i) - 0.5,
            "c": float(i) + 0.2,
            "v": 10,
        }
        for i in range(1, 31)
    ]
    raw = {"symbol": "SPY", "source": "test", "bars": bars}

    with patch("app.main.md_get_bars", new_callable=AsyncMock, return_value=raw) as mock:
        r = client.get(
            "/market/bars?symbol=spy&timeframe=1M&limit=22",
            headers=_headers("test-bars-1m"),
        )
        mock.assert_awaited()
        assert mock.await_args.kwargs.get("timeframe") == "1Month"
        assert mock.await_args.kwargs.get("limit") == 22

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["timeframe"] == "1Month"
    assert body["count"] <= 22
    assert body["count"] >= 1


def test_market_bars_provider_failure_returns_empty_not_fake():
    client = TestClient(app)
    with patch(
        "app.main.md_get_bars",
        new_callable=AsyncMock,
        side_effect=RuntimeError("all providers down"),
    ):
        r = client.get(
            "/market/bars?symbol=ZZZZ&timeframe=1Day",
            headers=_headers("test-bars-fail"),
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["bars"] == []
    assert body["count"] == 0
    assert "error" in body
    assert body["source"] is None


def test_market_bars_drops_rows_without_close():
    client = TestClient(app)
    raw = {
        "symbol": "MSFT",
        "source": "test",
        "bars": [
            {"t": "a", "o": 1, "h": 2, "l": 0.5, "c": None},
            {"t": "b", "o": 2, "h": 3, "l": 1, "c": 2.5},
        ],
    }
    with patch("app.main.md_get_bars", new_callable=AsyncMock, return_value=raw):
        r = client.get("/market/bars?symbol=MSFT", headers=_headers("test-bars-drop"))
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1
    assert body["bars"][0]["c"] == 2.5


def test_router_skips_single_bar_when_limit_gt_1():
    """Massive-style single prev bar must not block Yahoo multi-day history."""
    import asyncio

    from app.marketdata import router as md_router

    single = {"symbol": "X", "bars": [{"t": 1, "o": 1, "h": 1, "l": 1, "c": 1}]}
    multi = {
        "symbol": "X",
        "source": "yahoo",
        "bars": [
            {"t": 1, "o": 1, "h": 2, "l": 0.5, "c": 1.5},
            {"t": 2, "o": 1.5, "h": 2.5, "l": 1, "c": 2},
        ],
    }

    async def _run():
        with (
            patch.object(md_router.fmp, "is_fmp_configured", return_value=False),
            patch.object(md_router.av, "is_alphavantage_configured", return_value=False),
            patch.object(md_router.massive, "is_massive_configured", return_value=True),
            patch.object(md_router.yahoo, "is_yahoo_configured", return_value=True),
            patch.object(
                md_router.massive, "get_bars", new_callable=AsyncMock, return_value=single
            ),
            patch.object(
                md_router.yahoo, "get_bars", new_callable=AsyncMock, return_value=multi
            ),
        ):
            return await md_router.get_bars("X", timeframe="1Day", limit=60)

    out = asyncio.run(_run())
    assert out["source"] == "yahoo"
    assert len(out["bars"]) == 2
