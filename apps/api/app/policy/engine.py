"""Deterministic policy engine — LLM never has final say on quantities/orders."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from enum import Enum
from typing import Literal

try:
    from zoneinfo import ZoneInfo

    try:
        ET = ZoneInfo("America/New_York")
    except Exception:  # Windows without tzdata package
        ET = timezone(timedelta(hours=-5))  # EST approx; market_open usually injected
except Exception:  # pragma: no cover
    ET = timezone(timedelta(hours=-5))


class PolicyStatus(str, Enum):
    PROPOSED = "proposed"
    POLICY_REJECTED = "policy_rejected"
    AWAITING_CONFIRM = "awaiting_confirm"
    CONFIRMED = "confirmed"
    SUBMITTED = "submitted"
    FILLED = "filled"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


@dataclass(frozen=True)
class RiskLimits:
    max_position_pct: float = 5.0
    max_daily_loss_pct: float = 3.0
    max_open_positions: int = 10
    allowed_order_types: tuple[str, ...] = ("limit",)
    blacklisted_symbols: tuple[str, ...] = ()
    kill_switch: bool = False
    paper_only: bool = True
    allow_market_orders: bool = False
    # Paper desks often trade evenings; still compute real session for honesty.
    allow_outside_rth: bool = True


@dataclass(frozen=True)
class PolicyContext:
    equity: Decimal
    cash: Decimal
    open_position_count: int
    current_position_qty: Decimal  # existing qty in symbol (signed: long > 0)
    daily_pnl_pct: float
    is_paper_connection: bool
    market_open: bool | None = None  # None → compute from clock
    now: datetime | None = None


@dataclass(frozen=True)
class TradeIntent:
    symbol: str
    side: Literal["buy", "sell"]
    qty: Decimal
    order_type: Literal["market", "limit", "stop", "stop_limit"]
    limit_price: Decimal | None
    reason: str
    notional_estimate: Decimal | None = None


@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    status: PolicyStatus
    reasons: list[str] = field(default_factory=list)
    impact: dict | None = None

    @property
    def rejection_reason(self) -> str | None:
        if self.allowed:
            return None
        return "; ".join(self.reasons) if self.reasons else "rejected by policy"


def _is_us_equity_regular_session(now: datetime) -> bool:
    local = now.astimezone(ET)
    if local.weekday() >= 5:
        return False
    open_t = time(9, 30)
    close_t = time(16, 0)
    return open_t <= local.time() <= close_t


def evaluate_proposal(
    intent: TradeIntent,
    ctx: PolicyContext,
    limits: RiskLimits,
) -> PolicyDecision:
    """
    Pure function: given a trade intent + account snapshot + risk limits,
    return allow/deny with machine-readable reasons and preflight impact.
    """
    reasons: list[str] = []
    symbol = intent.symbol.strip().upper()
    now = ctx.now or datetime.now(timezone.utc)

    if not intent.reason or not intent.reason.strip():
        reasons.append("reason/thesis is required")

    if intent.qty <= 0:
        reasons.append("qty must be positive")

    if limits.kill_switch:
        reasons.append("kill switch is active")

    if limits.paper_only and not ctx.is_paper_connection:
        reasons.append("paper_only policy: live connections are blocked")

    if symbol in {s.upper() for s in limits.blacklisted_symbols}:
        reasons.append(f"{symbol} is blacklisted")

    if intent.order_type not in limits.allowed_order_types:
        reasons.append(
            f"order_type '{intent.order_type}' not allowed "
            f"(allowed: {', '.join(limits.allowed_order_types)})"
        )

    if intent.order_type == "market" and not limits.allow_market_orders:
        reasons.append("market orders require explicit allow_market_orders friction")

    if intent.order_type == "limit" and (intent.limit_price is None or intent.limit_price <= 0):
        reasons.append("limit orders require a positive limit_price")

    market_open = ctx.market_open
    if market_open is None:
        market_open = _is_us_equity_regular_session(now)
    outside_rth = not market_open
    if outside_rth and not (
        limits.allow_outside_rth and ctx.is_paper_connection
    ):
        reasons.append("US equity regular session is closed (policy gate)")

    if ctx.open_position_count >= limits.max_open_positions and intent.side == "buy":
        # Allow sells that reduce positions
        if ctx.current_position_qty <= 0:
            reasons.append(
                f"max open positions reached ({limits.max_open_positions})"
            )

    if ctx.daily_pnl_pct <= -abs(limits.max_daily_loss_pct):
        reasons.append(
            f"daily loss circuit breaker: {ctx.daily_pnl_pct:.2f}% "
            f"<= -{limits.max_daily_loss_pct}%"
        )

    # Notional / position size
    price = intent.limit_price
    if price is None and intent.notional_estimate is not None and intent.qty > 0:
        price = intent.notional_estimate / intent.qty
    notional = intent.notional_estimate
    if notional is None and price is not None:
        notional = intent.qty * price

    max_notional = (ctx.equity * Decimal(str(limits.max_position_pct))) / Decimal("100")
    if notional is not None and intent.side == "buy" and notional > max_notional:
        reasons.append(
            f"position size ${notional:.2f} exceeds max "
            f"{limits.max_position_pct}% of equity (${max_notional:.2f})"
        )

    if intent.side == "buy" and notional is not None and notional > ctx.cash:
        reasons.append(f"insufficient cash: need ${notional:.2f}, have ${ctx.cash:.2f}")

    if intent.side == "sell" and intent.qty > ctx.current_position_qty:
        reasons.append(
            f"cannot sell {intent.qty}: only hold {ctx.current_position_qty}"
        )

    impact = {
        "symbol": symbol,
        "side": intent.side,
        "qty": str(intent.qty),
        "order_type": intent.order_type,
        "limit_price": str(intent.limit_price) if intent.limit_price is not None else None,
        "estimated_notional": str(notional) if notional is not None else None,
        "estimated_bp_impact": str(notional) if notional is not None else None,
        "max_position_notional": str(max_notional),
        "equity": str(ctx.equity),
        "cash": str(ctx.cash),
        "open_positions": ctx.open_position_count,
        "daily_pnl_pct": ctx.daily_pnl_pct,
        "market_open": market_open,
        "outside_rth": outside_rth,
        "max_loss_scenario": (
            f"Full loss of estimated notional ${notional:.2f}"
            if notional is not None
            else "Unknown without price"
        ),
        "risk_utilization_pct": (
            float((notional / max_notional) * 100)
            if notional is not None and max_notional > 0
            else None
        ),
    }

    if reasons:
        return PolicyDecision(
            allowed=False,
            status=PolicyStatus.POLICY_REJECTED,
            reasons=reasons,
            impact=impact,
        )

    return PolicyDecision(
        allowed=True,
        status=PolicyStatus.AWAITING_CONFIRM,
        reasons=[],
        impact=impact,
    )


def is_proposal_expired(expires_at: datetime, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return now >= expires_at
