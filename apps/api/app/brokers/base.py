"""Broker abstraction — Alpaca, IBKR paper, PaperSim all implement this.

Hard rule: main.py and the agent tool executor talk only to BrokerClient.
Never let the LLM submit orders; that path stays policy + human confirm only.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class BrokerClient(Protocol):
    """Minimal surface used by main.py policy context + tool executor + confirm path."""

    @property
    def is_paper_url(self) -> bool:
        """True when connected to a paper environment (policy paper_only gate)."""
        ...

    @property
    def backend_name(self) -> str:
        """Short backend id: sim | ibkr | alpaca."""
        ...

    async def validate_connection(self) -> dict[str, Any]:
        """Return {ok, account_id, equity, cash, is_paper, last_validated, ...}."""
        ...

    async def get_account(self) -> dict[str, Any]:
        """Normalized: id, status, equity, cash, buying_power."""
        ...

    async def get_positions(self) -> list[dict[str, Any]]:
        """List of {symbol, qty, avg_entry_price, unrealized_pl, ...}."""
        ...

    async def get_position(self, symbol: str) -> dict[str, Any] | None:
        ...

    async def get_latest_trade(self, symbol: str) -> dict[str, Any]:
        """Latest price info; shape flexible (trade.p or price)."""
        ...

    async def get_bars(
        self, symbol: str, timeframe: str = "1Day", limit: int = 60
    ) -> dict[str, Any]:
        ...

    async def get_news(self, symbol: str, limit: int = 5) -> dict[str, Any]:
        """Optional; IBKR/Sim may return empty list — prefer web_search for research."""
        ...

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
        """Must honor client_order_id for idempotency. Return {id, status, ...}."""
        ...

    async def cancel_order(self, broker_order_id: str) -> Any:
        ...
