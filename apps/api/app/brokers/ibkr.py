"""IBKR paper skeleton via ib_async (optional dependency).

Canada-legal path: run IB Gateway in Paper mode on port 4002 (or TWS 7497)
on the same machine as the API. Render cannot host the Gateway.

Install: pip install ib_async
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.brokers.errors import BrokerError
from app.config import Settings, get_settings


class IBKRPaperClient:
    """Connects to local IB Gateway / TWS paper socket."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.host = self.settings.ibkr_host
        self.port = self.settings.ibkr_port
        self.client_id = self.settings.ibkr_client_id
        self._ib = None

    @property
    def is_paper_url(self) -> bool:
        # Paper ports: Gateway 4002, TWS 7497
        return self.port in (4002, 7497) or self.settings.paper_only

    @property
    def backend_name(self) -> str:
        return "ibkr"

    def _require_ib(self):
        try:
            from ib_async import IB  # type: ignore
        except ImportError as e:
            raise BrokerError(
                "ib_async not installed. Run: pip install ib_async "
                "and start IB Gateway paper on port 4002."
            ) from e
        return IB

    async def _connect(self):
        if self._ib is not None and self._ib.isConnected():
            return self._ib
        IB = self._require_ib()
        ib = IB()
        try:
            await ib.connectAsync(
                self.host,
                self.port,
                clientId=self.client_id,
                readonly=False,
            )
        except Exception as e:  # noqa: BLE001
            raise BrokerError(
                f"IBKR connect failed {self.host}:{self.port} — "
                f"is Gateway paper running? ({e})"
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
        }

    async def get_account(self) -> dict[str, Any]:
        ib = await self._connect()
        # Summary tags vary; best-effort normalize
        vals = {v.tag: v.value for v in ib.accountValues() if v.tag}
        equity = vals.get("NetLiquidation") or vals.get("EquityWithLoanValue") or "0"
        cash = vals.get("TotalCashValue") or vals.get("CashBalance") or "0"
        bp = vals.get("BuyingPower") or cash
        acct = ib.managedAccounts()[0] if ib.managedAccounts() else "IBKR"
        return {
            "id": acct,
            "account_number": acct,
            "status": "ACTIVE",
            "equity": str(equity),
            "cash": str(cash),
            "buying_power": str(bp),
            "portfolio_value": str(equity),
        }

    async def get_positions(self) -> list[dict[str, Any]]:
        ib = await self._connect()
        out = []
        for p in ib.positions():
            out.append(
                {
                    "symbol": p.contract.symbol,
                    "qty": str(p.position),
                    "avg_entry_price": str(p.avgCost),
                    "unrealized_pl": None,
                }
            )
        return out

    async def get_position(self, symbol: str) -> dict[str, Any] | None:
        for p in await self.get_positions():
            if p["symbol"].upper() == symbol.upper():
                return p
        return None

    async def get_latest_trade(self, symbol: str) -> dict[str, Any]:
        ib = await self._connect()
        from ib_async import Stock  # type: ignore

        contract = Stock(symbol.upper(), "SMART", "USD")
        await ib.qualifyContractsAsync(contract)
        tickers = await ib.reqTickersAsync(contract)
        if not tickers:
            raise BrokerError(f"no ticker data for {symbol}")
        t = tickers[0]
        px = t.marketPrice() if t.marketPrice() == t.marketPrice() else t.last
        return {
            "symbol": symbol.upper(),
            "trade": {"p": float(px or 0), "price": float(px or 0)},
            "price": str(px or 0),
            "source": "ibkr",
        }

    async def get_bars(
        self, symbol: str, timeframe: str = "1Day", limit: int = 60
    ) -> dict[str, Any]:
        # Minimal stub — expand with reqHistoricalData later
        return {
            "bars": [],
            "symbol": symbol.upper(),
            "note": "IBKR historical bars not fully wired; use quote + web_search.",
        }

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
            order = MarketOrder(action, float(qty))
        order.orderRef = client_order_id
        order.tif = "DAY" if time_in_force == "day" else time_in_force.upper()

        trade = ib.placeOrder(contract, order)
        # Wait briefly for order id
        await ib.sleep(1)
        oid = str(trade.order.orderId) if trade.order else client_order_id
        status = trade.orderStatus.status if trade.orderStatus else "Submitted"
        return {
            "id": oid,
            "client_order_id": client_order_id,
            "status": status,
            "symbol": symbol.upper(),
            "qty": qty,
            "side": side,
        }

    async def cancel_order(self, broker_order_id: str) -> Any:
        ib = await self._connect()
        for trade in ib.openTrades():
            if str(trade.order.orderId) == str(broker_order_id):
                ib.cancelOrder(trade.order)
                return {"ok": True, "id": broker_order_id}
        raise BrokerError("order not found", status_code=404)
