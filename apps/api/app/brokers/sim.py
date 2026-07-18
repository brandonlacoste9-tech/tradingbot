"""In-memory paper broker — Canada-safe default for Render/Netlify demos.

No external keys. Seeded cash $100k. Idempotent submit via client_order_id.
"""

from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from app.brokers.errors import BrokerError

# Rough seed marks for demo quotes (not live market data).
_SEED_MARKS: dict[str, Decimal] = {
    "SPY": Decimal("520.00"),
    "QQQ": Decimal("450.00"),
    "AAPL": Decimal("190.00"),
    "MSFT": Decimal("420.00"),
    "NVDA": Decimal("120.00"),
    "TSLA": Decimal("250.00"),
    "AMZN": Decimal("185.00"),
    "GOOGL": Decimal("175.00"),
    "META": Decimal("500.00"),
    "IWM": Decimal("210.00"),
}


class PaperSimBroker:
    def __init__(
        self,
        starting_cash: Decimal = Decimal("100000"),
        user_id: str | None = None,
    ):
        self.user_id = user_id
        self._lock = threading.Lock()
        self._cash = starting_cash
        self._equity_start = starting_cash
        self._positions: dict[str, dict[str, Decimal]] = {}  # symbol -> qty, avg
        self._orders_by_client: dict[str, dict[str, Any]] = {}
        self._orders_by_id: dict[str, dict[str, Any]] = {}
        self._marks = dict(_SEED_MARKS)
        self._hydrated = False

    def export_state(self) -> dict[str, Any]:
        with self._lock:
            return {
                "cash": self._cash,
                "starting_cash": self._equity_start,
                "positions": {
                    s: {"qty": p["qty"], "avg": p["avg"]}
                    for s, p in self._positions.items()
                },
                "marks": dict(self._marks),
                "client_orders": dict(self._orders_by_client),
            }

    def import_state(self, state: dict[str, Any]) -> None:
        with self._lock:
            self._cash = Decimal(str(state["cash"]))
            self._equity_start = Decimal(
                str(state.get("starting_cash") or state["cash"])
            )
            self._positions = {
                s: {
                    "qty": Decimal(str(p["qty"])),
                    "avg": Decimal(str(p["avg"])),
                }
                for s, p in (state.get("positions") or {}).items()
            }
            marks = state.get("marks") or {}
            self._marks = {**_SEED_MARKS, **{k: Decimal(str(v)) for k, v in marks.items()}}
            self._orders_by_client = dict(state.get("client_orders") or {})
            self._orders_by_id = {
                o["id"]: o
                for o in self._orders_by_client.values()
                if isinstance(o, dict) and o.get("id")
            }
            self._hydrated = True

    @property
    def is_paper_url(self) -> bool:
        return True

    @property
    def backend_name(self) -> str:
        return "sim"

    def _mark(self, symbol: str) -> Decimal:
        s = symbol.upper()
        if s not in self._marks:
            # Stable pseudo-price for unknown symbols
            self._marks[s] = Decimal("100.00") + Decimal(len(s) % 20)
        return self._marks[s]

    def set_mark(self, symbol: str, price: Decimal | float | str) -> None:
        """Update mark from external market data (e.g. Massive prev close)."""
        s = symbol.upper()
        with self._lock:
            self._marks[s] = Decimal(str(price))

    def _equity(self) -> Decimal:
        eq = self._cash
        for sym, pos in self._positions.items():
            eq += pos["qty"] * self._mark(sym)
        return eq

    def daily_pnl(self) -> Decimal:
        """Dollar PnL vs session start equity (starting cash for this paper book)."""
        with self._lock:
            return self._equity() - self._equity_start

    def daily_pnl_pct(self) -> float:
        """PnL % vs session start equity (starting cash for this paper book)."""
        with self._lock:
            start = self._equity_start
            if start <= 0:
                return 0.0
            eq = self._equity()
            return float(((eq - start) / start) * Decimal("100"))

    def reset(self, starting_cash: Decimal | None = None) -> None:
        """Wipe paper book — fresh virtual cash (Webull-style reset anytime)."""
        cash = starting_cash if starting_cash is not None else Decimal("100000")
        if cash <= 0:
            cash = Decimal("100000")
        with self._lock:
            self._cash = cash
            self._equity_start = cash
            self._positions.clear()
            self._orders_by_client.clear()
            self._orders_by_id.clear()
            self._marks = dict(_SEED_MARKS)
            self._hydrated = True

    async def validate_connection(self) -> dict[str, Any]:
        account = await self.get_account()
        return {
            "ok": True,
            "account_id": account["id"],
            "status": account["status"],
            "equity": account["equity"],
            "cash": account["cash"],
            "buying_power": account["buying_power"],
            "is_paper": True,
            "day_pnl": account.get("day_pnl"),
            "day_pnl_pct": account.get("day_pnl_pct"),
            "last_validated": datetime.now(timezone.utc).isoformat(),
            "backend": self.backend_name,
            "base_url": "sim://paper",
        }

    async def get_account(self) -> dict[str, Any]:
        with self._lock:
            eq = self._equity()
            start = self._equity_start
            day = eq - start
            pct = (
                float((day / start) * Decimal("100")) if start > 0 else 0.0
            )
            return {
                "id": f"SIM-{self.user_id or 'demo'}"[:32],
                "account_number": f"SIM-{self.user_id or 'demo'}"[:32],
                "status": "ACTIVE",
                "equity": str(eq.quantize(Decimal("0.01"))),
                "cash": str(self._cash.quantize(Decimal("0.01"))),
                "buying_power": str(self._cash.quantize(Decimal("0.01"))),
                "portfolio_value": str(eq.quantize(Decimal("0.01"))),
                "starting_cash": str(start.quantize(Decimal("0.01"))),
                "day_pnl": str(day.quantize(Decimal("0.01"))),
                "day_pnl_pct": f"{pct:.2f}",
                "currency": "USD",
                "is_paper": True,
            }

    async def get_positions(self) -> list[dict[str, Any]]:
        with self._lock:
            out = []
            for sym, pos in self._positions.items():
                if pos["qty"] == 0:
                    continue
                mark = self._mark(sym)
                avg = pos["avg"]
                qty = pos["qty"]
                upl = (mark - avg) * qty
                out.append(
                    {
                        "symbol": sym,
                        "qty": str(qty),
                        "avg_entry_price": str(avg),
                        "current_price": str(mark),
                        "unrealized_pl": str(upl.quantize(Decimal("0.01"))),
                        "market_value": str((mark * qty).quantize(Decimal("0.01"))),
                    }
                )
            return out

    async def get_position(self, symbol: str) -> dict[str, Any] | None:
        positions = await self.get_positions()
        for p in positions:
            if p["symbol"] == symbol.upper():
                return p
        return None

    async def get_latest_trade(self, symbol: str) -> dict[str, Any]:
        px = self._mark(symbol)
        return {
            "symbol": symbol.upper(),
            "trade": {"p": float(px), "price": float(px)},
            "price": str(px),
            "source": "sim_seed",
        }

    async def get_bars(
        self, symbol: str, timeframe: str = "1Day", limit: int = 60
    ) -> dict[str, Any]:
        px = float(self._mark(symbol))
        bars = []
        for i in range(min(limit, 60)):
            bars.append(
                {
                    "t": f"sim-{i}",
                    "o": px * 0.99,
                    "h": px * 1.01,
                    "l": px * 0.98,
                    "c": px,
                    "v": 1_000_000,
                }
            )
        return {"bars": bars, "symbol": symbol.upper(), "timeframe": timeframe}

    async def get_news(self, symbol: str, limit: int = 5) -> dict[str, Any]:
        return {
            "news": [],
            "symbol": symbol.upper(),
            "note": "PaperSim has no news feed — use web_search for research.",
        }

    @staticmethod
    def _is_aggressive(
        side: str, order_type: str, limit_price: Decimal | None, mark: Decimal
    ) -> bool:
        """Hybrid C: aggressive = market or limit through last/mark."""
        ot = (order_type or "limit").lower()
        if ot == "market" or limit_price is None:
            return True
        side_l = side.lower()
        if side_l == "buy":
            return limit_price >= mark
        if side_l == "sell":
            return limit_price <= mark
        return False

    def _apply_fill_unlocked(
        self, sym: str, q: Decimal, side_l: str, px: Decimal
    ) -> None:
        """Mutate cash/positions for a paper fill at px. Caller holds lock."""
        notional = q * px
        if side_l == "buy":
            if notional > self._cash:
                raise BrokerError(
                    f"insufficient sim cash: need {notional}, have {self._cash}"
                )
            self._cash -= notional
            pos = self._positions.get(sym, {"qty": Decimal("0"), "avg": Decimal("0")})
            new_qty = pos["qty"] + q
            if new_qty > 0:
                pos["avg"] = (
                    (pos["avg"] * pos["qty"] + px * q) / new_qty
                    if pos["qty"] > 0
                    else px
                )
            pos["qty"] = new_qty
            self._positions[sym] = pos
        elif side_l == "sell":
            pos = self._positions.get(sym, {"qty": Decimal("0"), "avg": Decimal("0")})
            if q > pos["qty"]:
                raise BrokerError(f"cannot sell {q}: hold {pos['qty']}")
            self._cash += notional
            pos["qty"] -= q
            if pos["qty"] == 0:
                pos["avg"] = Decimal("0")
            self._positions[sym] = pos
        else:
            raise BrokerError(f"unknown side: {side_l}")

    def _day_tif_should_expire(self, order: dict[str, Any], now: datetime) -> bool:
        """Day TIF (paper): expire when America/New_York calendar day rolls past create day.

        v1 keeps rules simple — not a full exchange session calendar. Documented in UI.
        """
        try:
            from zoneinfo import ZoneInfo

            et = ZoneInfo("America/New_York")
        except Exception:  # noqa: BLE001
            et = timezone.utc
        created_raw = order.get("created_at") or order.get("submitted_at")
        if not created_raw:
            return False
        try:
            created = datetime.fromisoformat(str(created_raw).replace("Z", "+00:00"))
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
        except Exception:  # noqa: BLE001
            return False
        now_et = now.astimezone(et)
        created_et = created.astimezone(et)
        return now_et.date() > created_et.date()

    async def submit_order(
        self,
        *,
        symbol: str,
        qty: str,
        side: str,
        order_type: str,
        limit_price: str | None,
        client_order_id: str,
        time_in_force: str = "day",
    ) -> dict[str, Any]:
        """
        Phase 3 hybrid C:
        - Aggressive (market or limit through mark): instant paper fill at last/mark
        - Passive (buy < mark / sell > mark): status=working until cross, cancel, or Day TIF
        Never invents exchange matching — simple mark rules only.
        """
        if not client_order_id:
            raise BrokerError("client_order_id is required")

        with self._lock:
            if client_order_id in self._orders_by_client:
                return self._orders_by_client[client_order_id]

            sym = symbol.upper()
            q = Decimal(str(qty))
            if q <= 0:
                raise BrokerError("qty must be positive")

            side_l = side.lower()
            if side_l not in ("buy", "sell"):
                raise BrokerError(f"unknown side: {side}")

            lim: Decimal | None = (
                Decimal(str(limit_price)) if limit_price is not None else None
            )
            mark = self._mark(sym)
            ot = (order_type or "limit").lower()
            tif = (time_in_force or "day").lower()
            if tif not in ("day", "DAY"):
                tif = "day"

            aggressive = self._is_aggressive(side_l, ot, lim, mark)
            # Affordability check at limit (or mark for market)
            check_px = lim if lim is not None else mark
            if side_l == "buy" and (q * check_px) > self._cash:
                raise BrokerError(
                    f"insufficient sim cash: need {q * check_px}, have {self._cash}"
                )
            if side_l == "sell":
                pos = self._positions.get(sym, {"qty": Decimal("0"), "avg": Decimal("0")})
                if q > pos["qty"]:
                    raise BrokerError(f"cannot sell {q}: hold {pos['qty']}")

            now_iso = datetime.now(timezone.utc).isoformat()
            oid = f"sim-{uuid.uuid4().hex[:16]}"

            if aggressive:
                fill_px = mark
                self._apply_fill_unlocked(sym, q, side_l, fill_px)
                order: dict[str, Any] = {
                    "id": oid,
                    "client_order_id": client_order_id,
                    "symbol": sym,
                    "qty": str(q),
                    "side": side_l,
                    "type": ot,
                    "limit_price": str(lim) if lim is not None else None,
                    "status": "filled",
                    "filled_qty": str(q),
                    "filled_avg_price": str(fill_px),
                    "time_in_force": tif,
                    "fill_kind": "aggressive",
                    "paper": True,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                    "note": (
                        "PaperSim aggressive fill at last/mark after confirm. "
                        "Not exchange matching."
                    ),
                }
            else:
                order = {
                    "id": oid,
                    "client_order_id": client_order_id,
                    "symbol": sym,
                    "qty": str(q),
                    "side": side_l,
                    "type": ot,
                    "limit_price": str(lim) if lim is not None else None,
                    "status": "working",
                    "filled_qty": "0",
                    "filled_avg_price": None,
                    "time_in_force": tif,
                    "fill_kind": "passive",
                    "paper": True,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                    "note": (
                        "PaperSim working limit (passive). Fills when last/mark "
                        "crosses limit, or Day TIF expire / cancel. Not a live broker."
                    ),
                }

            self._orders_by_client[client_order_id] = order
            self._orders_by_id[oid] = order

        await self._persist()
        return order

    async def evaluate_working_orders(self) -> list[dict[str, Any]]:
        """
        Fill passive working orders when mark crosses limit; Day TIF expire.
        Returns list of orders that changed status.
        """
        now = datetime.now(timezone.utc)
        changed: list[dict[str, Any]] = []
        with self._lock:
            for o in list(self._orders_by_id.values()):
                if o.get("status") != "working":
                    continue
                if self._day_tif_should_expire(o, now):
                    o["status"] = "expired"
                    o["updated_at"] = now.isoformat()
                    o["note"] = "Day TIF expired (paper). Not exchange cancelled."
                    changed.append(dict(o))
                    continue
                lim_s = o.get("limit_price")
                if lim_s is None:
                    continue
                lim = Decimal(str(lim_s))
                sym = o["symbol"]
                mark = self._mark(sym)
                side_l = o["side"]
                crosses = (side_l == "buy" and lim >= mark) or (
                    side_l == "sell" and lim <= mark
                )
                if not crosses:
                    continue
                q = Decimal(str(o["qty"]))
                try:
                    self._apply_fill_unlocked(sym, q, side_l, mark)
                except BrokerError:
                    # Leave working if can't fill (e.g. cash spent elsewhere)
                    continue
                o["status"] = "filled"
                o["filled_qty"] = str(q)
                o["filled_avg_price"] = str(mark)
                o["fill_kind"] = "passive_cross"
                o["updated_at"] = now.isoformat()
                o["note"] = (
                    "PaperSim fill — last/mark crossed limit. Not exchange matching."
                )
                changed.append(dict(o))

        if changed:
            await self._persist()
        return changed

    def list_orders_snapshot(self) -> list[dict[str, Any]]:
        with self._lock:
            return [dict(o) for o in self._orders_by_id.values()]

    async def persist(self) -> None:
        """Public flush for reset / admin paths."""
        await self._persist()

    async def _persist(self) -> None:
        """
        Flush paper book to Postgres when available.
        - No user_id / DB down: memory-only (local/dev)
        - DB up but write fails: raise BrokerError so the API can 502
        """
        if not self.user_id:
            return
        from app.db.pool import is_db_available
        from app.db.repo import save_paper_state

        if not is_db_available():
            return
        st = self.export_state()
        try:
            await save_paper_state(
                self.user_id,
                cash=st["cash"],
                starting_cash=st["starting_cash"],
                positions=st["positions"],
                marks=st["marks"],
                client_orders=st["client_orders"],
            )
        except Exception as e:  # noqa: BLE001
            raise BrokerError(f"Failed to persist paper book: {e}") from e

    async def cancel_order(self, broker_order_id: str) -> Any:
        with self._lock:
            o = self._orders_by_id.get(broker_order_id)
            if not o:
                # Also allow cancel by client_order_id
                o = self._orders_by_client.get(broker_order_id)
            if not o:
                raise BrokerError("order not found", status_code=404)
            st = o.get("status")
            if st == "filled":
                raise BrokerError("cannot cancel filled paper order")
            if st in ("cancelled", "canceled", "expired"):
                return o
            if st != "working":
                raise BrokerError(f"cannot cancel order status={st}")
            o["status"] = "cancelled"
            o["updated_at"] = datetime.now(timezone.utc).isoformat()
            o["note"] = "Cancelled by user (paper working order)."
        await self._persist()
        return o
