"""Shared broker errors — catch these in main, not vendor-specific types only."""

from __future__ import annotations

from typing import Any


class BrokerError(Exception):
    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        body: Any = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.body = body
