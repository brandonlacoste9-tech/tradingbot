"""
FastAPI app — multi-user paper desk (PR1 tenancy).

LLM never submits orders. Confirm gate + TTL + policy re-check are mandatory.
Default broker: per-user PaperSim. Optional: ibkr | alpaca via BROKER_BACKEND.
Auth: AUTH_MODE=disabled (X-User-Id) or clerk (Bearer JWT).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agent.loop import run_agent_turn_demo, run_agent_turn_llm
from app.auth import CurrentUser, get_current_user
from contextlib import asynccontextmanager

from app.brokers import BrokerError, get_broker
from app.brokers.factory import get_broker_async, sim_tenant_count
from app.config import get_settings
from app.db.pool import close_pool, init_pool, is_db_available
from app.policy.engine import (
    PolicyContext,
    RiskLimits,
    TradeIntent,
    evaluate_proposal,
    is_proposal_expired,
)
from app.store import MemoryStore, TradeProposal, new_id
from app.tenancy import get_tenant_store
from app.tools.web_search import web_search

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    yield
    await close_pool()


app = FastAPI(
    title="AI Trading Bot API",
    description="L2 multi-user paper desk (policy + confirm + tenancy + Postgres PR2)",
    version="0.4.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- models ----------


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ConfirmRequest(BaseModel):
    proposal_id: str


class RejectRequest(BaseModel):
    proposal_id: str
    reason: str | None = None


# ---------- helpers ----------


def _ttl() -> int:
    return settings.confirm_ttl_seconds


def _risk_limits() -> RiskLimits:
    return RiskLimits(
        max_position_pct=settings.default_max_position_pct,
        max_daily_loss_pct=settings.default_max_daily_loss_pct,
        max_open_positions=settings.default_max_open_positions,
        allowed_order_types=("limit",),
        blacklisted_symbols=(),
        kill_switch=False,
        paper_only=settings.paper_only,
        allow_market_orders=False,
    )


def _client(user_id: str):
    return get_broker(user_id=user_id)


async def _client_async(user_id: str):
    return await get_broker_async(user_id=user_id)


async def _mem(user: CurrentUser) -> MemoryStore:
    ts = get_tenant_store()
    await ts.ensure_user_async(user.id, email=user.email)
    return await ts.for_user_async(user.id)


async def _build_policy_context(client, symbol: str) -> PolicyContext:
    account = await client.get_account()
    positions = await client.get_positions()
    pos = await client.get_position(symbol)
    qty = Decimal(str(pos["qty"])) if pos else Decimal("0")
    equity = Decimal(str(account.get("equity") or "0"))
    cash = Decimal(str(account.get("cash") or "0"))
    # Alpaca does not always expose simple daily pnl %; default 0 for MVP
    return PolicyContext(
        equity=equity,
        cash=cash,
        open_position_count=len(positions),
        current_position_qty=qty,
        daily_pnl_pct=0.0,
        is_paper_connection=client.is_paper_url,
        market_open=True,  # demo-friendly; policy can still reject other rules
        now=datetime.now(timezone.utc),
    )


async def _latest_price(client, symbol: str) -> Decimal | None:
    try:
        trade = await client.get_latest_trade(symbol)
        t = trade.get("trade") or trade
        if "p" in t:
            return Decimal(str(t["p"]))
        if "price" in t:
            return Decimal(str(t["price"]))
    except BrokerError:
        return None
    return None


async def _create_proposal_from_args(
    args: dict[str, Any],
    mem: MemoryStore,
    user_id: str,
) -> dict[str, Any]:
    client = await _client_async(user_id)
    symbol = str(args["symbol"]).upper()
    side = args["side"]
    qty = Decimal(str(args["qty"]))
    order_type = args.get("order_type") or "limit"
    limit_price = (
        Decimal(str(args["limit_price"]))
        if args.get("limit_price") is not None
        else None
    )
    reason = str(args.get("reason") or "").strip()

    if order_type == "limit" and limit_price is None:
        px = await _latest_price(client, symbol)
        if px is not None:
            # Slightly aggressive limit: buy near ask (~+0.1%), sell near bid (~-0.1%)
            if side == "buy":
                limit_price = (px * Decimal("1.001")).quantize(Decimal("0.01"))
            else:
                limit_price = (px * Decimal("0.999")).quantize(Decimal("0.01"))

    notional = (qty * limit_price) if limit_price is not None else None
    intent = TradeIntent(
        symbol=symbol,
        side=side,
        qty=qty,
        order_type=order_type,
        limit_price=limit_price,
        reason=reason,
        notional_estimate=notional,
    )

    try:
        ctx = await _build_policy_context(client, symbol)
    except BrokerError as e:
        # Offline / missing keys: synthetic context for local UX demos
        ctx = PolicyContext(
            equity=Decimal("100000"),
            cash=Decimal("100000"),
            open_position_count=0,
            current_position_qty=Decimal("0"),
            daily_pnl_pct=0.0,
            is_paper_connection=True,
            market_open=True,
            now=datetime.now(timezone.utc),
        )
        mem.audit_event(
            "system",
            "policy_context_fallback",
            {"error": str(e)},
        )

    decision = evaluate_proposal(intent, ctx, _risk_limits())
    client_order_id = f"atb-{uuid.uuid4().hex[:24]}"
    expires = datetime.now(timezone.utc) + timedelta(seconds=_ttl())

    status = decision.status.value
    proposal = TradeProposal(
        id=new_id(),
        symbol=symbol,
        side=side,
        qty=str(qty),
        order_type=order_type,
        limit_price=str(limit_price) if limit_price is not None else None,
        reason=reason,
        policy_status=status,
        client_order_id=client_order_id,
        rejection_reason=decision.rejection_reason,
        expires_at=expires.isoformat() if decision.allowed else None,
        impact=decision.impact,
    )
    mem.add_proposal(proposal)
    ts = get_tenant_store()
    await ts.persist_proposal(user_id, proposal)
    mem.audit_event(
        "policy",
        "evaluate_proposal",
        {
            "proposal_id": proposal.id,
            "allowed": decision.allowed,
            "status": status,
            "reasons": decision.reasons,
            "client_order_id": client_order_id,
        },
    )
    await ts.persist_audit(
        user_id,
        "policy",
        "evaluate_proposal",
        {
            "proposal_id": proposal.id,
            "allowed": decision.allowed,
            "status": status,
        },
    )

    if not decision.allowed:
        entry = mem.add_journal(
            summary_md=f"**Policy rejected** {side} {qty} {symbol}: {decision.rejection_reason}",
            decisions=[
                {
                    "type": "policy_rejected",
                    "symbol": symbol,
                    "reason": decision.rejection_reason,
                }
            ],
        )
        await ts.persist_journal(user_id, entry)
    else:
        entry = mem.add_journal(
            summary_md=(
                f"**Proposal awaiting confirm** ({_ttl()}s TTL): "
                f"{side} {qty} {symbol} limit={limit_price}. Thesis: {reason}"
            ),
            decisions=[
                {
                    "type": "awaiting_confirm",
                    "proposal_id": proposal.id,
                    "symbol": symbol,
                    "reason": reason,
                }
            ],
        )
        await ts.persist_journal(user_id, entry)

    return proposal.to_dict()


async def _execute_tool(
    tool: str, args: dict[str, Any], mem: MemoryStore, user_id: str
) -> Any:
    client = await _client_async(user_id)
    mem.audit_event("agent", f"tool:{tool}", {"args": args, "user_id": user_id})
    await get_tenant_store().persist_audit(
        user_id, "agent", f"tool:{tool}", {"args": args}
    )

    if tool == "get_account":
        return await client.get_account()

    if tool == "get_positions":
        return await client.get_positions()

    if tool == "get_quote":
        return await client.get_latest_trade(args["symbol"])

    if tool == "get_bars":
        return await client.get_bars(
            args["symbol"],
            timeframe=args.get("timeframe") or "1Day",
            limit=int(args.get("limit") or 60),
        )

    if tool == "get_news":
        return await client.get_news(args["symbol"], limit=int(args.get("limit") or 5))

    if tool == "web_search":
        return await web_search(
            args.get("query") or "",
            max_results=int(args.get("max_results") or 5),
        )

    if tool == "compute_impact":
        symbol = args["symbol"].upper()
        qty = Decimal(str(args["qty"]))
        limit = (
            Decimal(str(args["limit_price"]))
            if args.get("limit_price") is not None
            else await _latest_price(client, symbol)
        )
        notional = (qty * limit) if limit is not None else None
        return {
            "symbol": symbol,
            "side": args["side"],
            "qty": str(qty),
            "limit_price": str(limit) if limit is not None else None,
            "estimated_notional": str(notional) if notional is not None else None,
        }

    if tool == "propose_order":
        return await _create_proposal_from_args(args, mem, user_id)

    if tool == "decide_hold":
        reason = args.get("reason") or "Hold / do nothing"
        symbol = args.get("symbol")
        entry = mem.add_journal(
            summary_md=f"**Hold**{f' ({symbol})' if symbol else ''}: {reason}",
            decisions=[{"type": "hold", "symbol": symbol, "reason": reason}],
        )
        mem.audit_event("agent", "decide_hold", {"reason": reason, "symbol": symbol})
        ts = get_tenant_store()
        await ts.persist_journal(user_id, entry)
        await ts.persist_audit(
            user_id, "agent", "decide_hold", {"reason": reason, "symbol": symbol}
        )
        return {"ok": True, "journal_id": entry["id"], "reason": reason}

    if tool == "journal_entry":
        entry = mem.add_journal(
            summary_md=args["summary_md"],
            decisions=args.get("decisions") or [],
        )
        await get_tenant_store().persist_journal(user_id, entry)
        return entry

    if tool == "cancel_order":
        return await client.cancel_order(args["broker_order_id"])

    raise HTTPException(400, f"Unknown tool: {tool}")


# ---------- routes ----------


def _llm_ready() -> tuple[bool, str, str | None]:
    """Return (enabled, provider, api_key)."""
    provider = (settings.llm_provider or "xai").lower().strip()
    if provider in ("xai", "grok"):
        key = settings.xai_api_key
        return (bool(key), "xai", key or None)
    if provider == "openai":
        key = settings.openai_api_key
        return (bool(key), "openai", key or None)
    if provider == "anthropic":
        key = settings.anthropic_api_key
        return (bool(key), "anthropic", key or None)
    return (False, provider, None)


@app.get("/health")
async def health():
    client = _client("health")
    llm_on, provider, _ = _llm_ready()
    return {
        "ok": True,
        "paper_only": settings.paper_only,
        "confirm_ttl_seconds": _ttl(),
        "broker_backend": getattr(client, "backend_name", settings.broker_backend),
        "llm_enabled": llm_on,
        "llm_provider": provider if llm_on else "demo",
        "auth_mode": settings.auth_mode,
        "tenancy": get_tenant_store().stats(),
        "sim_tenants": sim_tenant_count(),
        "postgres": is_db_available(),
    }


@app.get("/me")
async def me(user: Annotated[CurrentUser, Depends(get_current_user)]):
    profile = await get_tenant_store().ensure_user_async(user.id, email=user.email)
    return {
        "user_id": user.id,
        "clerk_id": user.clerk_id,
        "email": user.email or profile.get("email"),
        "auth_mode": user.auth_mode,
        "plan": profile.get("plan", "free"),
        "postgres": is_db_available(),
    }


@app.get("/broker/status")
async def broker_status(user: Annotated[CurrentUser, Depends(get_current_user)]):
    """Diagnostics for sim/ibkr/alpaca — no orders placed."""
    client = await _client_async(user.id)
    base = {
        "broker_backend": getattr(client, "backend_name", settings.broker_backend),
        "paper_only": settings.paper_only,
        "user_id": user.id,
    }
    if hasattr(client, "status_report"):
        try:
            detail = await client.status_report()  # type: ignore[misc]
            return {**base, **detail}
        except Exception as e:  # noqa: BLE001
            return {**base, "error": str(e)}
    try:
        v = await client.validate_connection()
        return {**base, "connected": True, **v}
    except BrokerError as e:
        return {**base, "connected": False, "error": str(e)}


@app.post("/connection/validate")
async def validate_connection(user: Annotated[CurrentUser, Depends(get_current_user)]):
    """Validate broker connection; record last_validated + is_paper."""
    mem = await _mem(user)
    client = await _client_async(user.id)
    try:
        result = await client.validate_connection()
    except BrokerError as e:
        mem.audit_event("user", "validate_connection_failed", {"error": str(e)})
        raise HTTPException(400, str(e)) from e

    if settings.paper_only and not result.get("is_paper", True):
        mem.audit_event(
            "system",
            "reject_live_connection",
            {"backend": result.get("backend")},
        )
        raise HTTPException(
            400,
            "PAPER_ONLY is enabled; use BROKER_BACKEND=sim or IBKR/Alpaca paper.",
        )

    mem.connection = result
    mem.audit_event("user", "validate_connection", result)
    return {**result, "user_id": user.id}


@app.post("/agent/chat")
async def agent_chat(
    body: ChatRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """
    Chat → agent plan → tools via _execute_tool (propose → policy only).
    Scoped to authenticated user. Never submits orders here.
    """
    mem = await _mem(user)
    mem.audit_event(
        "user",
        "chat_message",
        {"message": body.message, "user_id": user.id},
    )
    await get_tenant_store().persist_audit(
        user.id, "user", "chat_message", {"message": body.message[:200]}
    )

    async def _tool_exec(name: str, args: dict[str, Any]) -> Any:
        return await _execute_tool(name, args or {}, mem, user.id)

    plan: dict[str, Any]
    llm_on, provider, api_key = _llm_ready()
    if llm_on and api_key:
        try:
            plan = await run_agent_turn_llm(
                body.message,
                _tool_exec,
                provider=provider,
                api_key=api_key,
                model=settings.llm_model or None,
                base_url=settings.llm_base_url or None,
            )
        except Exception as e:  # noqa: BLE001
            mem.audit_event(
                "system",
                "llm_fallback_demo",
                {"error": str(e), "provider": provider},
            )
            plan = run_agent_turn_demo(body.message)
            plan["fallback_from_llm"] = True
            plan["llm_error"] = str(e)
    else:
        plan = run_agent_turn_demo(body.message)

    tool_results: list[dict[str, Any]] = []
    proposal: dict[str, Any] | None = None

    if plan.get("mode") == "llm" and isinstance(plan.get("tool_results"), list):
        tool_results = plan["tool_results"]
        for tr in tool_results:
            if (
                tr.get("ok")
                and tr.get("tool") == "propose_order"
                and isinstance(tr.get("result"), dict)
            ):
                proposal = tr["result"]
    else:
        for action in plan.get("actions") or []:
            tool = action["tool"]
            args = action.get("args") or {}
            try:
                result = await _execute_tool(tool, args, mem, user.id)
                tool_results.append({"tool": tool, "ok": True, "result": result})
                if tool == "propose_order" and isinstance(result, dict):
                    proposal = result
            except BrokerError as e:
                tool_results.append(
                    {
                        "tool": tool,
                        "ok": False,
                        "error": str(e),
                        "body": getattr(e, "body", None),
                    }
                )
            except HTTPException:
                raise
            except Exception as e:  # noqa: BLE001
                tool_results.append({"tool": tool, "ok": False, "error": str(e)})

    return {
        "assistant_text": plan.get("assistant_text"),
        "mode": plan.get("mode"),
        "tool_results": tool_results,
        "proposal": proposal,
        "confirm_ttl_seconds": _ttl(),
        "model": plan.get("model"),
        "provider": plan.get("provider"),
        "llm_enabled": llm_on,
        "user_id": user.id,
    }


@app.get("/proposals")
async def list_proposals(user: Annotated[CurrentUser, Depends(get_current_user)]):
    mem = await _mem(user)
    return {"proposals": mem.list_proposals(), "user_id": user.id}


@app.get("/proposals/{proposal_id}")
async def get_proposal(
    proposal_id: str,
    user: Annotated[CurrentUser, Depends(get_current_user)],
):
    mem = await _mem(user)
    p = mem.get_proposal(proposal_id)
    if not p:
        raise HTTPException(404, "Proposal not found")
    if p.policy_status == "awaiting_confirm" and p.expires_at:
        exp = datetime.fromisoformat(p.expires_at)
        if is_proposal_expired(exp):
            p.policy_status = "expired"
            mem.update_proposal(p)
            mem.audit_event("system", "proposal_expired", {"proposal_id": p.id})
    return p.to_dict()


@app.post("/proposals/confirm")
async def confirm_proposal(
    body: ConfirmRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Human confirm gate — tenant-scoped."""
    mem = await _mem(user)
    p = mem.get_proposal(body.proposal_id)
    if not p:
        raise HTTPException(404, "Proposal not found")

    if p.policy_status == "awaiting_confirm" and p.expires_at:
        exp = datetime.fromisoformat(p.expires_at)
        if is_proposal_expired(exp):
            p.policy_status = "expired"
            mem.update_proposal(p)
            mem.audit_event(
                "system",
                "confirm_rejected_expired",
                {"proposal_id": p.id},
            )
            raise HTTPException(400, "Proposal expired — create a new one")

    if p.policy_status != "awaiting_confirm":
        raise HTTPException(
            400,
            f"Proposal not confirmable (status={p.policy_status})",
        )

    client = await _client_async(user.id)
    intent = TradeIntent(
        symbol=p.symbol,
        side=p.side,  # type: ignore[arg-type]
        qty=Decimal(p.qty),
        order_type=p.order_type,  # type: ignore[arg-type]
        limit_price=Decimal(p.limit_price) if p.limit_price else None,
        reason=p.reason,
        notional_estimate=(
            Decimal(p.qty) * Decimal(p.limit_price) if p.limit_price else None
        ),
    )
    try:
        ctx = await _build_policy_context(client, p.symbol)
    except BrokerError:
        ctx = PolicyContext(
            equity=Decimal("100000"),
            cash=Decimal("100000"),
            open_position_count=0,
            current_position_qty=Decimal("0"),
            daily_pnl_pct=0.0,
            is_paper_connection=True,
            market_open=True,
            now=datetime.now(timezone.utc),
        )

    decision = evaluate_proposal(intent, ctx, _risk_limits())
    ts = get_tenant_store()
    if not decision.allowed:
        p.policy_status = "policy_rejected"
        p.rejection_reason = decision.rejection_reason
        mem.update_proposal(p)
        await ts.persist_proposal(user.id, p)
        raise HTTPException(400, f"Policy re-check failed: {decision.rejection_reason}")

    p.policy_status = "confirmed"
    mem.update_proposal(p)
    await ts.persist_proposal(user.id, p)
    mem.audit_event("user", "proposal_confirmed", {"proposal_id": p.id})
    await ts.persist_audit(user.id, "user", "proposal_confirmed", {"proposal_id": p.id})

    try:
        broker_resp = await client.submit_order(
            symbol=p.symbol,
            qty=p.qty,
            side=p.side,
            order_type=p.order_type,
            limit_price=p.limit_price,
            client_order_id=p.client_order_id,
        )
    except BrokerError as e:
        mem.audit_event(
            "broker",
            "submit_failed",
            {
                "proposal_id": p.id,
                "error": str(e),
                "body": getattr(e, "body", None),
            },
        )
        await ts.persist_audit(
            user.id, "broker", "submit_failed", {"error": str(e)}
        )
        raise HTTPException(502, f"Broker submit failed: {e}") from e

    p.policy_status = "submitted"
    p.broker_order_id = broker_resp.get("id")
    mem.update_proposal(p)
    await ts.persist_proposal(user.id, p)

    order_row = {
        "id": new_id(),
        "proposal_id": p.id,
        "client_order_id": p.client_order_id,
        "broker_order_id": broker_resp.get("id"),
        "status": broker_resp.get("status"),
        "raw_response": broker_resp,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    mem.add_order(order_row)
    await ts.persist_order(user.id, order_row)
    jentry = mem.add_journal(
        summary_md=(
            f"**Submitted** {p.side} {p.qty} {p.symbol} "
            f"(client_order_id={p.client_order_id}, broker={p.broker_order_id})"
        ),
        decisions=[{"type": "submitted", "proposal_id": p.id, "order": order_row}],
    )
    await ts.persist_journal(user.id, jentry)
    mem.audit_event(
        "broker",
        "order_submitted",
        {
            "proposal_id": p.id,
            "client_order_id": p.client_order_id,
            "broker_order_id": p.broker_order_id,
        },
    )
    await ts.persist_audit(
        user.id,
        "broker",
        "order_submitted",
        {"proposal_id": p.id, "broker_order_id": p.broker_order_id},
    )

    return {
        "proposal": p.to_dict(),
        "order": order_row,
        "broker": broker_resp,
        "user_id": user.id,
    }


@app.post("/proposals/reject")
async def reject_proposal(
    body: RejectRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
):
    mem = await _mem(user)
    p = mem.get_proposal(body.proposal_id)
    if not p:
        raise HTTPException(404, "Proposal not found")
    if p.policy_status not in ("awaiting_confirm", "proposed"):
        raise HTTPException(400, f"Cannot reject status={p.policy_status}")

    p.policy_status = "cancelled"
    p.rejection_reason = body.reason or "Rejected by user"
    mem.update_proposal(p)
    ts = get_tenant_store()
    await ts.persist_proposal(user.id, p)
    jentry = mem.add_journal(
        summary_md=f"**User rejected** proposal {p.symbol}: {p.rejection_reason}",
        decisions=[{"type": "user_rejected", "proposal_id": p.id}],
    )
    await ts.persist_journal(user.id, jentry)
    mem.audit_event(
        "user",
        "proposal_rejected",
        {"proposal_id": p.id, "reason": p.rejection_reason},
    )
    await ts.persist_audit(
        user.id, "user", "proposal_rejected", {"proposal_id": p.id}
    )
    return p.to_dict()


@app.get("/journal")
async def get_journal(user: Annotated[CurrentUser, Depends(get_current_user)]):
    mem = await _mem(user)
    return {"entries": mem.journals, "user_id": user.id}


@app.get("/audit")
async def get_audit(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    limit: int = 100,
):
    mem = await _mem(user)
    return {
        "events": mem.audit[: max(1, min(limit, 500))],
        "user_id": user.id,
    }


@app.get("/orders")
async def get_orders(user: Annotated[CurrentUser, Depends(get_current_user)]):
    mem = await _mem(user)
    return {"orders": mem.orders, "user_id": user.id}


@app.get("/portfolio")
async def portfolio(user: Annotated[CurrentUser, Depends(get_current_user)]):
    client = await _client_async(user.id)
    try:
        account = await client.get_account()
        positions = await client.get_positions()
        return {
            "account": account,
            "positions": positions,
            "source": getattr(client, "backend_name", "broker"),
            "user_id": user.id,
        }
    except BrokerError as e:
        return {
            "account": None,
            "positions": [],
            "source": "unavailable",
            "error": str(e),
            "user_id": user.id,
        }
