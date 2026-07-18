"""Postgres repository for multi-tenant paper desk state."""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from app.db.pool import get_pool, is_db_available
from app.store import TradeProposal


def _json(obj: Any) -> str:
    return json.dumps(obj, default=str)


async def upsert_user(
    user_id: str, email: str | None = None, plan: str | None = None
) -> None:
    if not is_db_available():
        return
    pool = get_pool()
    async with pool.acquire() as conn:
        if plan is not None:
            await conn.execute(
                """
                INSERT INTO app_users (id, email, plan)
                VALUES ($1, $2, $3)
                ON CONFLICT (id) DO UPDATE SET
                  email = COALESCE(EXCLUDED.email, app_users.email),
                  plan = EXCLUDED.plan,
                  updated_at = now()
                """,
                user_id,
                email,
                plan,
            )
        else:
            await conn.execute(
                """
                INSERT INTO app_users (id, email, plan)
                VALUES ($1, $2, 'free')
                ON CONFLICT (id) DO UPDATE SET
                  email = COALESCE(EXCLUDED.email, app_users.email),
                  updated_at = now()
                """,
                user_id,
                email,
            )


async def load_profile(user_id: str) -> dict[str, Any] | None:
    if not is_db_available():
        return None
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, email, plan, created_at,
                   stripe_customer_id, stripe_subscription_id, subscription_status
            FROM app_users WHERE id = $1
            """,
            user_id,
        )
    if not row:
        return None
    return {
        "id": row["id"],
        "email": row["email"],
        "plan": row["plan"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "stripe_customer_id": row.get("stripe_customer_id"),
        "stripe_subscription_id": row.get("stripe_subscription_id"),
        "subscription_status": row.get("subscription_status"),
    }


async def set_user_plan(
    user_id: str,
    plan: str,
    *,
    stripe_customer_id: str | None = None,
    stripe_subscription_id: str | None = None,
    subscription_status: str | None = None,
    email: str | None = None,
) -> None:
    if not is_db_available():
        return
    await upsert_user(user_id, email=email)
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE app_users SET
              plan = $2,
              stripe_customer_id = COALESCE($3, stripe_customer_id),
              stripe_subscription_id = COALESCE($4, stripe_subscription_id),
              subscription_status = COALESCE($5, subscription_status),
              email = COALESCE($6, email),
              updated_at = now()
            WHERE id = $1
            """,
            user_id,
            plan,
            stripe_customer_id,
            stripe_subscription_id,
            subscription_status,
            email,
        )


async def find_user_id_by_customer(customer_id: str) -> str | None:
    if not is_db_available():
        return None
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM app_users WHERE stripe_customer_id = $1",
            customer_id,
        )
    return row["id"] if row else None


async def increment_chat_usage(user_id: str) -> int:
    """Return new chat_count for today."""
    if not is_db_available():
        return -1  # caller uses memory fallback
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO usage_daily (user_id, day, chat_count)
            VALUES ($1, CURRENT_DATE, 1)
            ON CONFLICT (user_id, day) DO UPDATE SET
              chat_count = usage_daily.chat_count + 1
            RETURNING chat_count
            """,
            user_id,
        )
    return int(row["chat_count"]) if row else 0


async def get_chat_usage_today(user_id: str) -> int:
    if not is_db_available():
        return 0
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT chat_count FROM usage_daily
            WHERE user_id = $1 AND day = CURRENT_DATE
            """,
            user_id,
        )
    return int(row["chat_count"]) if row else 0


async def save_proposal(user_id: str, p: TradeProposal) -> None:
    if not is_db_available():
        return
    pool = get_pool()
    expires = None
    if p.expires_at:
        try:
            expires = datetime.fromisoformat(p.expires_at)
        except ValueError:
            expires = None
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO trade_proposals (
              id, user_id, symbol, side, qty, order_type, limit_price, reason,
              policy_status, client_order_id, rejection_reason, expires_at,
              impact, broker_order_id, created_at, updated_at
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16
            )
            ON CONFLICT (id) DO UPDATE SET
              policy_status = EXCLUDED.policy_status,
              rejection_reason = EXCLUDED.rejection_reason,
              expires_at = EXCLUDED.expires_at,
              impact = EXCLUDED.impact,
              broker_order_id = EXCLUDED.broker_order_id,
              updated_at = EXCLUDED.updated_at
            """,
            p.id,
            user_id,
            p.symbol,
            p.side,
            p.qty,
            p.order_type,
            p.limit_price,
            p.reason,
            p.policy_status,
            p.client_order_id,
            p.rejection_reason,
            expires,
            _json(p.impact or {}),
            p.broker_order_id,
            datetime.fromisoformat(p.created_at) if p.created_at else datetime.utcnow(),
            datetime.fromisoformat(p.updated_at) if p.updated_at else datetime.utcnow(),
        )


async def load_proposals(user_id: str) -> list[TradeProposal]:
    if not is_db_available():
        return []
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM trade_proposals
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 200
            """,
            user_id,
        )
    out: list[TradeProposal] = []
    for r in rows:
        impact = r["impact"]
        if isinstance(impact, str):
            impact = json.loads(impact)
        out.append(
            TradeProposal(
                id=r["id"],
                symbol=r["symbol"],
                side=r["side"],
                qty=r["qty"],
                order_type=r["order_type"],
                limit_price=r["limit_price"],
                reason=r["reason"],
                policy_status=r["policy_status"],
                client_order_id=r["client_order_id"],
                rejection_reason=r["rejection_reason"],
                expires_at=r["expires_at"].isoformat() if r["expires_at"] else None,
                impact=impact,
                broker_order_id=r["broker_order_id"],
                created_at=r["created_at"].isoformat() if r["created_at"] else "",
                updated_at=r["updated_at"].isoformat() if r["updated_at"] else "",
            )
        )
    return out


async def save_journal(user_id: str, entry: dict[str, Any]) -> None:
    if not is_db_available():
        return
    pool = get_pool()
    entry_date = entry.get("entry_date") or date.today().isoformat()
    if isinstance(entry_date, str):
        entry_date = date.fromisoformat(entry_date)
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO journals (id, user_id, entry_date, summary_md, decisions, created_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6)
            ON CONFLICT (id) DO NOTHING
            """,
            entry["id"],
            user_id,
            entry_date,
            entry["summary_md"],
            _json(entry.get("decisions") or []),
            datetime.fromisoformat(entry["created_at"])
            if entry.get("created_at")
            else datetime.utcnow(),
        )


async def load_journals(user_id: str, limit: int = 100) -> list[dict[str, Any]]:
    if not is_db_available():
        return []
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM journals WHERE user_id = $1
            ORDER BY created_at DESC LIMIT $2
            """,
            user_id,
            limit,
        )
    out = []
    for r in rows:
        decisions = r["decisions"]
        if isinstance(decisions, str):
            decisions = json.loads(decisions)
        out.append(
            {
                "id": r["id"],
                "entry_date": r["entry_date"].isoformat() if r["entry_date"] else None,
                "summary_md": r["summary_md"],
                "decisions": decisions or [],
                "created_at": r["created_at"].isoformat() if r["created_at"] else "",
            }
        )
    return out


async def save_order(user_id: str, order: dict[str, Any]) -> None:
    if not is_db_available():
        return
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO paper_orders (
              id, user_id, proposal_id, client_order_id, broker_order_id, status, raw_response, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
            ON CONFLICT (id) DO NOTHING
            """,
            order["id"],
            user_id,
            order.get("proposal_id"),
            order.get("client_order_id"),
            order.get("broker_order_id"),
            order.get("status"),
            _json(order.get("raw_response") or order),
            datetime.fromisoformat(order["created_at"])
            if order.get("created_at")
            else datetime.utcnow(),
        )


async def load_orders(user_id: str, limit: int = 100) -> list[dict[str, Any]]:
    if not is_db_available():
        return []
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM paper_orders WHERE user_id = $1
            ORDER BY created_at DESC LIMIT $2
            """,
            user_id,
            limit,
        )
    out = []
    for r in rows:
        raw = r["raw_response"]
        if isinstance(raw, str):
            raw = json.loads(raw)
        raw = raw if isinstance(raw, dict) else {}
        # Flatten desk fields from raw_response so Orders tab never shows "—"
        out.append(
            {
                "id": r["id"],
                "proposal_id": r["proposal_id"],
                "client_order_id": r["client_order_id"],
                "broker_order_id": r["broker_order_id"] or raw.get("id"),
                "status": r["status"] or raw.get("status"),
                "symbol": raw.get("symbol"),
                "side": raw.get("side"),
                "qty": raw.get("qty"),
                "limit_price": raw.get("limit_price"),
                "order_type": raw.get("type") or raw.get("order_type"),
                "fill_kind": raw.get("fill_kind"),
                "filled_avg_price": raw.get("filled_avg_price"),
                "note": raw.get("note"),
                "paper": True,
                "time_in_force": raw.get("time_in_force") or "day",
                "raw_response": raw,
                "created_at": r["created_at"].isoformat() if r["created_at"] else "",
            }
        )
    return out


async def save_audit(
    user_id: str, actor: str, action: str, details: dict[str, Any] | None
) -> None:
    if not is_db_available():
        return
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO audit_events (user_id, actor, action, details)
            VALUES ($1, $2, $3, $4::jsonb)
            """,
            user_id,
            actor,
            action,
            _json(details or {}),
        )


async def load_audit(user_id: str, limit: int = 100) -> list[dict[str, Any]]:
    if not is_db_available():
        return []
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, created_at, actor, action, details FROM audit_events
            WHERE user_id = $1 ORDER BY id DESC LIMIT $2
            """,
            user_id,
            limit,
        )
    out = []
    for r in rows:
        details = r["details"]
        if isinstance(details, str):
            details = json.loads(details)
        out.append(
            {
                "id": r["id"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else "",
                "actor": r["actor"],
                "action": r["action"],
                "details": details or {},
            }
        )
    return out


async def save_paper_state(
    user_id: str,
    cash: Decimal,
    starting_cash: Decimal,
    positions: dict[str, dict[str, Decimal]],
    marks: dict[str, Decimal],
    client_orders: dict[str, Any],
) -> None:
    if not is_db_available():
        return
    await upsert_user(user_id)
    pool = get_pool()
    marks_j = {k: str(v) for k, v in marks.items()}
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO paper_accounts (user_id, cash, starting_cash, marks_json, client_orders_json, updated_at)
                VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, now())
                ON CONFLICT (user_id) DO UPDATE SET
                  cash = EXCLUDED.cash,
                  starting_cash = EXCLUDED.starting_cash,
                  marks_json = EXCLUDED.marks_json,
                  client_orders_json = EXCLUDED.client_orders_json,
                  updated_at = now()
                """,
                user_id,
                cash,
                starting_cash,
                _json(marks_j),
                _json(client_orders),
            )
            await conn.execute(
                "DELETE FROM paper_positions WHERE user_id = $1", user_id
            )
            for sym, pos in positions.items():
                if pos["qty"] == 0:
                    continue
                await conn.execute(
                    """
                    INSERT INTO paper_positions (user_id, symbol, qty, avg_entry)
                    VALUES ($1, $2, $3, $4)
                    """,
                    user_id,
                    sym,
                    pos["qty"],
                    pos["avg"],
                )


async def load_paper_state(user_id: str) -> dict[str, Any] | None:
    if not is_db_available():
        return None
    pool = get_pool()
    async with pool.acquire() as conn:
        acc = await conn.fetchrow(
            "SELECT * FROM paper_accounts WHERE user_id = $1", user_id
        )
        if not acc:
            return None
        pos_rows = await conn.fetch(
            "SELECT symbol, qty, avg_entry FROM paper_positions WHERE user_id = $1",
            user_id,
        )
    marks_raw = acc["marks_json"]
    if isinstance(marks_raw, str):
        marks_raw = json.loads(marks_raw)
    co = acc["client_orders_json"]
    if isinstance(co, str):
        co = json.loads(co)
    positions = {
        r["symbol"]: {
            "qty": Decimal(str(r["qty"])),
            "avg": Decimal(str(r["avg_entry"])),
        }
        for r in pos_rows
    }
    marks = {k: Decimal(str(v)) for k, v in (marks_raw or {}).items()}
    return {
        "cash": Decimal(str(acc["cash"])),
        "starting_cash": Decimal(str(acc["starting_cash"])),
        "positions": positions,
        "marks": marks,
        "client_orders": co or {},
    }
