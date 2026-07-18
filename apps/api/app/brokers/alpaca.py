"""Alpaca paper/live REST client. MVP uses paper base URL."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.brokers.errors import BrokerError
from app.config import Settings, get_settings


class AlpacaError(BrokerError):
    """Alpaca-specific broker error (also a BrokerError)."""


class AlpacaClient:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.base = self.settings.alpaca_base_url.rstrip("/")
        self.data = self.settings.alpaca_data_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "APCA-API-KEY-ID": self.settings.alpaca_api_key_id,
            "APCA-API-SECRET-KEY": self.settings.alpaca_api_secret_key,
            "Content-Type": "application/json",
        }

    def _configured(self) -> bool:
        return bool(
            self.settings.alpaca_api_key_id and self.settings.alpaca_api_secret_key
        )

    @property
    def is_paper_url(self) -> bool:
        return "paper" in self.base.lower()

    @property
    def backend_name(self) -> str:
        return "alpaca"

    async def validate_connection(self) -> dict[str, Any]:
        """
        Refinement #4: validate keys on connect.
        Returns account snapshot + last_validated + is_paper.
        """
        if not self._configured():
            raise AlpacaError("Alpaca API keys are not configured in environment")

        account = await self.get_account()
        return {
            "ok": True,
            "account_id": account.get("id") or account.get("account_number"),
            "status": account.get("status"),
            "equity": account.get("equity"),
            "cash": account.get("cash"),
            "buying_power": account.get("buying_power"),
            "is_paper": self.is_paper_url,
            "last_validated": datetime.now(timezone.utc).isoformat(),
            "base_url": self.base,
            "backend": self.backend_name,
        }

    async def _get(self, url: str, params: dict | None = None) -> Any:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(url, headers=self._headers(), params=params)
            if r.status_code >= 400:
                raise AlpacaError(
                    f"Alpaca GET failed: {r.status_code}",
                    status_code=r.status_code,
                    body=r.text,
                )
            return r.json()

    async def _post(self, url: str, json: dict) -> Any:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, headers=self._headers(), json=json)
            if r.status_code >= 400:
                raise AlpacaError(
                    f"Alpaca POST failed: {r.status_code} {r.text}",
                    status_code=r.status_code,
                    body=r.text,
                )
            return r.json()

    async def _delete(self, url: str) -> Any:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.delete(url, headers=self._headers())
            if r.status_code >= 400:
                raise AlpacaError(
                    f"Alpaca DELETE failed: {r.status_code}",
                    status_code=r.status_code,
                    body=r.text,
                )
            if r.status_code == 204 or not r.content:
                return {"ok": True}
            return r.json()

    async def get_account(self) -> dict[str, Any]:
        return await self._get(f"{self.base}/v2/account")

    async def get_positions(self) -> list[dict[str, Any]]:
        return await self._get(f"{self.base}/v2/positions")

    async def get_position(self, symbol: str) -> dict[str, Any] | None:
        try:
            return await self._get(f"{self.base}/v2/positions/{symbol.upper()}")
        except AlpacaError as e:
            if e.status_code == 404:
                return None
            raise

    async def get_latest_trade(self, symbol: str) -> dict[str, Any]:
        return await self._get(
            f"{self.data}/v2/stocks/{symbol.upper()}/trades/latest"
        )

    async def get_bars(
        self, symbol: str, timeframe: str = "1Day", limit: int = 60
    ) -> dict[str, Any]:
        return await self._get(
            f"{self.data}/v2/stocks/{symbol.upper()}/bars",
            params={"timeframe": timeframe, "limit": limit, "adjustment": "raw"},
        )

    async def get_news(self, symbol: str, limit: int = 5) -> dict[str, Any]:
        return await self._get(
            f"{self.data}/v1beta1/news",
            params={"symbols": symbol.upper(), "limit": limit, "sort": "desc"},
        )

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
        """Submit order with required client_order_id for idempotency."""
        if not client_order_id:
            raise AlpacaError("client_order_id is required")

        body: dict[str, Any] = {
            "symbol": symbol.upper(),
            "qty": qty,
            "side": side,
            "type": order_type,
            "time_in_force": time_in_force,
            "client_order_id": client_order_id,
        }
        if order_type == "limit":
            if not limit_price:
                raise AlpacaError("limit_price required for limit orders")
            body["limit_price"] = limit_price

        return await self._post(f"{self.base}/v2/orders", body)

    async def cancel_order(self, broker_order_id: str) -> Any:
        return await self._delete(f"{self.base}/v2/orders/{broker_order_id}")
