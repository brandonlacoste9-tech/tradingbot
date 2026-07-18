"""PR1 multi-user tenancy — isolation without Postgres."""

import pytest
from fastapi.testclient import TestClient

from app.brokers.factory import get_broker, reset_broker_cache, sim_tenant_count
from app.config import get_settings
from app.main import app
from app.tenancy.store import TenantStore


@pytest.fixture(autouse=True)
def _reset():
    reset_broker_cache()
    get_settings.cache_clear()
    yield
    reset_broker_cache()
    get_settings.cache_clear()


def test_tenant_stores_isolated():
    ts = TenantStore()
    a = ts.for_user("user-a")
    b = ts.for_user("user-b")
    assert a is not b
    a.add_journal("hello a")
    assert len(a.journals) == 1
    assert len(b.journals) == 0


def test_sim_broker_per_user():
    reset_broker_cache()
    ba = get_broker("alice")
    bb = get_broker("bob")
    assert ba is not bb
    assert sim_tenant_count() >= 2


@pytest.mark.asyncio
async def test_sim_books_do_not_share_cash():
    reset_broker_cache()
    ba = get_broker("alice")
    bb = get_broker("bob")
    await ba.submit_order(
        symbol="SPY",
        qty="10",
        side="buy",
        order_type="limit",
        limit_price="100",
        client_order_id="alice-1",
    )
    acct_a = await ba.get_account()
    acct_b = await bb.get_account()
    assert float(acct_a["cash"]) < 100000
    assert float(acct_b["cash"]) == 100000.0


def test_api_x_user_id_isolation():
    client = TestClient(app)
    r1 = client.post(
        "/agent/chat",
        json={"message": "Propose a limit buy of 1 share of SPY"},
        headers={"X-User-Id": "tenant-one"},
    )
    assert r1.status_code == 200
    body1 = r1.json()
    assert body1.get("user_id") == "tenant-one"
    prop = body1.get("proposal")
    if prop and prop.get("policy_status") == "awaiting_confirm":
        conf = client.post(
            "/proposals/confirm",
            json={"proposal_id": prop["id"]},
            headers={"X-User-Id": "tenant-one"},
        )
        assert conf.status_code == 200

    j2 = client.get("/journal", headers={"X-User-Id": "tenant-two"})
    assert j2.status_code == 200
    # tenant-two should not see tenant-one journal
    assert j2.json()["user_id"] == "tenant-two"
    assert j2.json()["entries"] == []


def test_me_endpoint():
    client = TestClient(app)
    r = client.get("/me", headers={"X-User-Id": "me-user"})
    assert r.status_code == 200
    assert r.json()["user_id"] == "me-user"
