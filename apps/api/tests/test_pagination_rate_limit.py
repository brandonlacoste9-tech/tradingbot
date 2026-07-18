"""Pagination + quote rate limit unit tests."""

import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("BROKER_BACKEND", "sim")
os.environ.setdefault("AUTH_MODE", "disabled")
os.environ.setdefault("PAPER_ONLY", "true")

from app.brokers.factory import reset_broker_cache
from app.config import get_settings
from app.main import app
from app.pagination import page_slice
from app.rate_limit import RateLimiter


@pytest.fixture(autouse=True)
def _env():
    os.environ["BROKER_BACKEND"] = "sim"
    os.environ["AUTH_MODE"] = "disabled"
    get_settings.cache_clear()
    reset_broker_cache()
    yield
    get_settings.cache_clear()
    reset_broker_cache()


def test_page_slice_reverse_and_has_more():
    items = list(range(10))
    p0 = page_slice(items, limit=3, offset=0, reverse=True)
    assert p0["items"] == [9, 8, 7]
    assert p0["total"] == 10
    assert p0["has_more"] is True
    p1 = page_slice(items, limit=3, offset=9, reverse=True)
    assert p1["items"] == [0]
    assert p1["has_more"] is False


def test_rate_limiter_blocks_after_limit():
    lim = RateLimiter()
    key = "t1"
    for _ in range(5):
        assert lim.allow(key, limit=5, window_seconds=60.0) is True
    assert lim.allow(key, limit=5, window_seconds=60.0) is False


def test_journal_orders_pagination_params():
    client = TestClient(app)
    headers = {"X-User-Id": "test-page-user"}
    # seed a few journals via chat-less path: paper reset writes a journal
    client.post("/paper/reset", headers=headers, json={"starting_cash": 100000})
    r = client.get("/journal?limit=1&offset=0", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "entries" in body
    assert body["limit"] == 1
    assert body["offset"] == 0
    assert "total" in body
    assert "has_more" in body

    o = client.get("/orders?limit=5&offset=0", headers=headers)
    assert o.status_code == 200
    assert "orders" in o.json()
    assert o.json()["limit"] == 5
