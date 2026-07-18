"""IBKR paper client via ib_async.

Canada-legal path: IB Gateway Paper on port 4002 (or TWS paper 7497)
on the same machine as the API. Render cannot host the Gateway.

  pip install ib_async
"""

from __future__ import annotations

import asyncio
import math
from datetime import datetime, timezone
from typing import Any

from app.brokers.errors import BrokerError
from app.config import Settings, get_settings

# Live sockets — blocked when PAPER_ONLY=true
_LIVE_PORTS = frozenset({4001, 7496})
_PAPER_PORTS = frozenset({4002, 7497})


class IBKRPaperClient:
    """Connects to local IB Gateway / TWS paper socket."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.host = self.settings.ibkr_host
        self.port = int(self.settings.ibkr_port)
        self.client_id = int(self.settings.ibkr_client_id)
        self._ib = None
        self._lock = asyncio.Lock()
        self._orders_by_client: dict[str, dict[str, Any]] = {}

    @property
    def is_paper_url(self) -> bool:
        if self.port in _PAPER_PORTS:
            return True
        if self.port in _LIVE_PORTS:
            return False
        return bool(self.settings.paper_only)

    @property
    def backend_name(self) -> str:
        return "ibkr"

    def _require_ib(self):
        try:
            from ib_async import IB  # type: ignore
        except ImportError as e:
            raise BrokerError(
                "ib_async not installed. Run: pip install ib_async "
                "and start IB Gateway paper on port 4002. "
                "See docs/IBKR_SETUP.md"
            ) from e
        return IB

    def _guard_paper_only(self) -> None:
        if self.settings.paper_only and self.port in _LIVE_PORTS:
            raise BrokerError(
                f"PAPER_ONLY=true but IBKR_PORT={self.port} is a LIVE socket "
                f"(use 4002 Gateway paper or 7497 TWS paper). "
                f"See docs/IBKR_SETUP.md"
            )

    async def _connect(self):
        self._guard_paper_only()
        async with self._lock:
            if self._ib is not None and self._ib.isConnected():
                return self._ib

            IB = self._require_ib()
            ib = IB()
            try:
                # prefer async API; fall back to thread if needed
                if hasattr(ib, "connectAsync"):
                    await ib.connectAsync(
                        self.host,
                        self.port,
                        clientId=self.client_id,
                        readonly=False,
                        timeout=15,
                    )
                else:
                    await asyncio.to_thread(
                        ib.connect,
                        self.host,
                        self.port,
                        clientId=self.client_id,
                        readonly=False,
                        timeout=15,
                    )
            except BrokerError:
                raise
            except Exception as e:  # noqa: BLE001
                raise BrokerError(
                    f"IBKR connect failed {self.host}:{self.port} — "
                    f"is IB Gateway running in Paper mode with API enabled? "
                    f"({e}) See docs/IBKR_SETUP.md"
                ) from e

            self._ib = ib
            return ib

    async def validate_connection(self) -> dict[str, Any]:
        account = await self.get_account()
        return {
            "ok": True,
            "account_id": account.get("id"),
            "status": account.get("status"),
            "equity": account.get("equity"),
            "cash": account.get("cash"),
            "buying_power": account.get("buying_power"),
            "is_paper": self.is_paper_url,
            "last_validated": datetime.now(timezone.utc).isoformat(),
            "backend": self.backend_name,
            "host": self.host,
            "port": self.port,
            "client_id": self.client_id,
        }

    def _account_values_map(self, ib) -> dict[str, str]:
        accounts = list(ib.managedAccounts() or [])
        primary = accounts[0] if accounts else None
        vals: dict[str, str] = {}
        for v in ib.accountValues():
            if not v.tag:
                continue
            # Prefer primary account currency rows
            if primary and v.account and v.account != primary:
                continue
            # Prefer base currency summaries when duplicate tags exist
            if v.tag in vals and v.currency and v.currency not in ("", "BASE"):
                continue
            vals[v.tag] = str(v.value)
        return vals

    async def get_account(self) -> dict[str, Any]:
        ib = await self._connect()
        # Allow summaries to populate
        await ib.sleep(0.5)
        vals = self._account_values_map(ib)
        equity = (
            vals.get("NetLiquidation")
            or vals.get("EquityWithLoanValue")
            or vals.get("GrossPositionValue")
            or "0"
        )
        cash = vals.get("TotalCashValue") or vals.get("CashBalance") or "0"
        bp = vals.get("BuyingPower") or vals.get("AvailableFunds") or cash
        acct = (ib.managedAccounts() or ["IBKR"])[0]
        return {
            "id": acct,
            "account_number": acct,
            "status": "ACTIVE",
            "equity": str(equity),
            "cash": str(cash),
            "buying_power": str(bp),
            "portfolio_value": str(equity),
            "currency": vals.get("Currency") or "USD",
        }

    async def get_positions(self) -> list[dict[str, Any]]:
        ib = await self._connect()
        out = []
        for p in ib.positions():
            qty = float(p.position)
            if abs(qty) < 1e-12:
                continue
            out.append(
                {
                    "symbol": p.contract.symbol,
                    "qty": str(p.position),
                    "avg_entry_price": str(p.avgCost),
                    "unrealized_pl": None,
                    "market_value": None,
                }
            )
        return out

    async def get_position(self, symbol: str) -> dict[str, Any] | None:
        for p in await self.get_positions():
            if p["symbol"].upper() == symbol.upper():
                return p
        return None

    def _price_from_ticker(self, t) -> float | None:
        for attr in ("marketPrice",):
            fn = getattr(t, attr, None)
            if callable(fn):
                try:
                    px = fn()
                    if px is not None and not (isinstance(px, float) and math.isnan(px)):
                        if px > 0:
                            return float(px)
                except Exception:  # noqa: BLE001
                    pass
        for attr in ("last", "close", "bid", "ask"):
            px = getattr(t, attr, None)
            if px is not None and not (isinstance(px, float) and math.isnan(px)):
                if float(px) > 0:
                    return float(px)
        return None

    async def get_latest_trade(self, symbol: str) -> dict[str, Any]:
        ib = await self._connect()
        from ib_async import Stock  # type: ignore

        contract = Stock(symbol.upper(), "SMART", "USD")
        await ib.qualifyContractsAsync(contract)
        tickers = await ib.reqTickersAsync(contract)
        if not tickers:
            raise BrokerError(f"no ticker data for {symbol}")
        px = self._price_from_ticker(tickers[0])
        if px is None:
            raise BrokerError(
                f"no usable price for {symbol} (check paper market data subscription)"
            )
        return {
            "symbol": symbol.upper(),
            "trade": {"p": px, "price": px},
            "price": str(px),
            "source": "ibkr",
        }

    async def get_bars(
        self, symbol: str, timeframe: str = "1Day", limit: int = 60
    ) -> dict[str, Any]:
        ib = await self._connect()
        from ib_async import Stock, util  # type: ignore

        contract = Stock(symbol.upper(), "SMART", "USD")
        await ib.qualifyContractsAsync(contract)
        bar_size = {
            "1Min": "1 min",
            "5Min": "5 mins",
            "15Min": "15 mins",
            "1Hour": "1 hour",
            "1Day": "1 day",
        }.get(timeframe, "1 day")
        duration = "1 M" if timeframe == "1Day" else "5 D"
        try:
            bars = await ib.reqHistoricalDataAsync(
                contract,
                endDateTime="",
                durationStr=duration,
                barSizeSetting=bar_size,
                whatToShow="TRADES",
                useRTH=True,
                formatDate=1,
            )
        except Exception as e:  # noqa: BLE001
            return {
                "bars": [],
                "symbol": symbol.upper(),
                "error": str(e),
                "note": "Historical data failed; use quote + web_search.",
            }
        out = []
        for b in (bars or [])[-limit:]:
            out.append(
                {
                    "t": str(getattr(b, "date", "")),
                    "o": float(b.open),
                    "h": float(b.high),
                    "l": float(b.low),
                    "c": float(b.close),
                    "v": float(getattr(b, "volume", 0) or 0),
                }
            )
        return {"bars": out, "symbol": symbol.upper(), "timeframe": timeframe}

    async def get_news(self, symbol: str, limit: int = 5) -> dict[str, Any]:
        return {
            "news": [],
            "note": "Use web_search for research on IBKR backend.",
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
        self._guard_paper_only()

        if client_order_id in self._orders_by_client:
            return self._orders_by_client[client_order_id]

        ib = await self._connect()
        from ib_async import LimitOrder, MarketOrder, Stock  # type: ignore

        contract = Stock(symbol.upper(), "SMART", "USD")
        await ib.qualifyContractsAsync(contract)

        action = "BUY" if side.lower() == "buy" else "SELL"
        if order_type == "limit":
            if not limit_price:
                raise BrokerError("limit_price required for limit orders")
            order = LimitOrder(action, float(qty), float(limit_price))
        else:
            if self.settings.paper_only:
                # Prefer limits even if market requested under paper_only friction
                raise BrokerError(
                    "market orders blocked under paper policy friction; use limit"
                )
            order = MarketOrder(action, float(qty))

        order.orderRef = client_order_id[:48]
        order.tif = "DAY" if time_in_force == "day" else time_in_force.upper()
        order.transmit = True

        trade = ib.placeOrder(contract, order)
        await ib.sleep(1.5)

        oid = str(trade.order.orderId) if trade.order else client_order_id
        status = (
            trade.orderStatus.status
            if trade.orderStatus and trade.orderStatus.status
            else "Submitted"
        )
        result = {
            "id": oid,
            "client_order_id": client_order_id,
            "status": status,
            "symbol": symbol.upper(),
            "qty": qty,
            "side": side,
            "type": order_type,
            "limit_price": limit_price,
        }
        self._orders_by_client[client_order_id] = result
        return result

    async def cancel_order(self, broker_order_id: str) -> Any:
        ib = await self._connect()
        for trade in ib.openTrades():
            if str(trade.order.orderId) == str(broker_order_id):
                ib.cancelOrder(trade.order)
                await ib.sleep(0.5)
                return {"ok": True, "id": broker_order_id}
        raise BrokerError("order not found among open trades", status_code=404)

    async def status_report(self) -> dict[str, Any]:
        """Diagnostics for /broker/status — does not place orders."""
        try:
            import ib_async  # noqa: F401

            ib_async_ok = True
        except ImportError:
            ib_async_ok = False

        report: dict[str, Any] = {
            "backend": "ibkr",
            "host": self.host,
            "port": self.port,
            "client_id": self.client_id,
            "paper_port": self.port in _PAPER_PORTS,
            "paper_only_setting": self.settings.paper_only,
            "ib_async_installed": ib_async_ok,
            "connected": False,
            "docs": "docs/IBKR_SETUP.md",
        }
        if not ib_async_ok:
            report["hint"] = "pip install ib_async"
            return report

        try:
            ib = await self._connect()
            report["connected"] = ib.isConnected()
            report["accounts"] = list(ib.managedAccounts() or [])
            acct = await self.get_account()
            report["equity"] = acct.get("equity")
            report["cash"] = acct.get("cash")
            report["is_paper"] = self.is_paper_url
        except BrokerError as e:
            report["error"] = str(e)
            report["hint"] = (
                "Start IB Gateway → Paper → API Settings → port 4002, "
                "Enable Socket Clients, Trusted 127.0.0.1"
            )
        return report
