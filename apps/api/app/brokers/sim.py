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
    def __init__(self, starting_cash: Decimal = Decimal("100000")):
        self._lock = threading.Lock()
        self._cash = starting_cash
        self._equity_start = starting_cash
        self._positions: dict[str, dict[str, Decimal]] = {}  # symbol -> qty, avg
        self._orders_by_client: dict[str, dict[str, Any]] = {}
        self._orders_by_id: dict[str, dict[str, Any]] = {}
        self._marks = dict(_SEED_MARKS)

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

    def _equity(self) -> Decimal:
        eq = self._cash
        for sym, pos in self._positions.items():
            eq += pos["qty"] * self._mark(sym)
        return eq

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
            "last_validated": datetime.now(timezone.utc).isoformat(),
            "backend": self.backend_name,
            "base_url": "sim://paper",
        }

    async def get_account(self) -> dict[str, Any]:
        with self._lock:
            eq = self._equity()
            return {
                "id": "SIM-PAPER-001",
                "account_number": "SIM-PAPER-001",
                "status": "ACTIVE",
                "equity": str(eq.quantize(Decimal("0.01"))),
                "cash": str(self._cash.quantize(Decimal("0.01"))),
                "buying_power": str(self._cash.quantize(Decimal("0.01"))),
                "portfolio_value": str(eq.quantize(Decimal("0.01"))),
                "currency": "USD",
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
        if not client_order_id:
            raise BrokerError("client_order_id is required")

        with self._lock:
            if client_order_id in self._orders_by_client:
                return self._orders_by_client[client_order_id]

            sym = symbol.upper()
            q = Decimal(str(qty))
            if q <= 0:
                raise BrokerError("qty must be positive")

            if limit_price is not None:
                px = Decimal(str(limit_price))
            else:
                px = self._mark(sym)

            notional = q * px
            side_l = side.lower()

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
                raise BrokerError(f"unknown side: {side}")

            # Update mark toward limit for continuity
            self._marks[sym] = px

            oid = f"sim-{uuid.uuid4().hex[:16]}"
            order = {
                "id": oid,
                "client_order_id": client_order_id,
                "symbol": sym,
                "qty": str(q),
                "side": side_l,
                "type": order_type,
                "limit_price": str(limit_price) if limit_price else None,
                "status": "filled",
                "filled_qty": str(q),
                "filled_avg_price": str(px),
                "time_in_force": time_in_force,
            }
            self._orders_by_client[client_order_id] = order
            self._orders_by_id[oid] = order
            return order

    async def cancel_order(self, broker_order_id: str) -> Any:
        with self._lock:
            o = self._orders_by_id.get(broker_order_id)
            if not o:
                raise BrokerError("order not found", status_code=404)
            if o["status"] == "filled":
                raise BrokerError("cannot cancel filled sim order")
            o["status"] = "canceled"
            return o
