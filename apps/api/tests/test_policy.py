"""Unit tests for the pure policy engine."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.policy.engine import (
    PolicyContext,
    PolicyStatus,
    RiskLimits,
    TradeIntent,
    evaluate_proposal,
    is_proposal_expired,
)


def _ctx(**kwargs) -> PolicyContext:
    base = dict(
        equity=Decimal("100000"),
        cash=Decimal("50000"),
        open_position_count=1,
        current_position_qty=Decimal("0"),
        daily_pnl_pct=0.0,
        is_paper_connection=True,
        market_open=True,
        now=datetime(2026, 7, 15, 15, 0, tzinfo=timezone.utc),  # mid-week approx
    )
    base.update(kwargs)
    return PolicyContext(**base)


def _intent(**kwargs) -> TradeIntent:
    base = dict(
        symbol="SPY",
        side="buy",
        qty=Decimal("1"),
        order_type="limit",
        limit_price=Decimal("500"),
        reason="Unit test starter position within risk limits",
        notional_estimate=Decimal("500"),
    )
    base.update(kwargs)
    return TradeIntent(**base)


def test_allows_reasonable_limit_buy():
    d = evaluate_proposal(_intent(), _ctx(), RiskLimits())
    assert d.allowed is True
    assert d.status == PolicyStatus.AWAITING_CONFIRM
    assert d.impact is not None
    assert d.impact["symbol"] == "SPY"


def test_rejects_missing_reason():
    d = evaluate_proposal(_intent(reason=""), _ctx(), RiskLimits())
    assert d.allowed is False
    assert d.status == PolicyStatus.POLICY_REJECTED
    assert "reason" in (d.rejection_reason or "").lower()


def test_rejects_kill_switch():
    d = evaluate_proposal(_intent(), _ctx(), RiskLimits(kill_switch=True))
    assert d.allowed is False
    assert "kill switch" in (d.rejection_reason or "").lower()


def test_outside_rth_allowed_for_paper_when_flag_set():
    d = evaluate_proposal(
        _intent(),
        _ctx(market_open=False),
        RiskLimits(allow_outside_rth=True),
    )
    assert d.allowed is True
    assert d.impact and d.impact.get("outside_rth") is True


def test_outside_rth_rejected_when_not_allowed():
    d = evaluate_proposal(
        _intent(),
        _ctx(market_open=False),
        RiskLimits(allow_outside_rth=False),
    )
    assert d.allowed is False
    assert "session is closed" in (d.rejection_reason or "").lower()


def test_daily_loss_breaker():
    d = evaluate_proposal(
        _intent(),
        _ctx(daily_pnl_pct=-5.0),
        RiskLimits(max_daily_loss_pct=3.0),
    )
    assert d.allowed is False
    assert "daily loss" in (d.rejection_reason or "").lower()


def test_rejects_oversized_position():
    # 5% of 100k = 5000; notional 10000 should fail
    d = evaluate_proposal(
        _intent(qty=Decimal("20"), limit_price=Decimal("500"), notional_estimate=Decimal("10000")),
        _ctx(),
        RiskLimits(max_position_pct=5.0),
    )
    assert d.allowed is False
    assert "position size" in (d.rejection_reason or "").lower()


def test_rejects_blacklist():
    d = evaluate_proposal(
        _intent(symbol="GME"),
        _ctx(),
        RiskLimits(blacklisted_symbols=("GME",)),
    )
    assert d.allowed is False
    assert "blacklist" in (d.rejection_reason or "").lower()


def test_rejects_market_by_default():
    d = evaluate_proposal(
        _intent(order_type="market", limit_price=None, notional_estimate=Decimal("500")),
        _ctx(),
        RiskLimits(allowed_order_types=("limit", "market"), allow_market_orders=False),
    )
    assert d.allowed is False


def test_rejects_live_when_paper_only():
    d = evaluate_proposal(
        _intent(),
        _ctx(is_paper_connection=False),
        RiskLimits(paper_only=True),
    )
    assert d.allowed is False
    assert "paper" in (d.rejection_reason or "").lower()


def test_rejects_daily_loss_breaker():
    d = evaluate_proposal(
        _intent(),
        _ctx(daily_pnl_pct=-3.5),
        RiskLimits(max_daily_loss_pct=3.0),
    )
    assert d.allowed is False
    assert "daily loss" in (d.rejection_reason or "").lower()


def test_rejects_insufficient_cash():
    d = evaluate_proposal(
        _intent(qty=Decimal("10"), limit_price=Decimal("500"), notional_estimate=Decimal("5000")),
        _ctx(cash=Decimal("100")),
        RiskLimits(max_position_pct=50.0),
    )
    assert d.allowed is False
    assert "cash" in (d.rejection_reason or "").lower()


def test_rejects_oversell():
    d = evaluate_proposal(
        _intent(side="sell", qty=Decimal("5"), notional_estimate=Decimal("2500")),
        _ctx(current_position_qty=Decimal("1")),
        RiskLimits(),
    )
    assert d.allowed is False
    assert "cannot sell" in (d.rejection_reason or "").lower()


def test_proposal_ttl_expiry():
    now = datetime.now(timezone.utc)
    expires = now - timedelta(seconds=1)
    assert is_proposal_expired(expires, now) is True
    assert is_proposal_expired(now + timedelta(seconds=180), now) is False


def test_rejects_closed_market_when_flagged():
    # Default allow_outside_rth=True for paper; force strict RTH for this case.
    d = evaluate_proposal(
        _intent(),
        _ctx(market_open=False),
        RiskLimits(allow_outside_rth=False),
    )
    assert d.allowed is False
    assert "session" in (d.rejection_reason or "").lower()
