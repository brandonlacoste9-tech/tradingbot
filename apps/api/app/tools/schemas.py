"""Strict Claude-compatible tool schemas for the agent loop."""

from __future__ import annotations

from typing import Any

# Anthropic Messages API style: name, description, input_schema
# Use with strict tool calling when wiring a real LLM.

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "get_account",
        "description": "Get brokerage account status, equity, cash, buying power.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
    {
        "name": "get_positions",
        "description": "List open positions with qty, avg entry, unrealized P/L.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
    {
        "name": "get_quote",
        "description": "Latest quote for a symbol (bid/ask/last when available).",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Ticker, e.g. SPY"},
            },
            "required": ["symbol"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_bars",
        "description": "Historical OHLCV bars for technical context.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string"},
                "timeframe": {
                    "type": "string",
                    "enum": ["1Min", "5Min", "15Min", "1Hour", "1Day"],
                    "default": "1Day",
                },
                "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 60},
            },
            "required": ["symbol"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_news",
        "description": "Recent news headlines for a symbol (broker feed if any).",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5},
            },
            "required": ["symbol"],
            "additionalProperties": False,
        },
    },
    {
        "name": "web_search",
        "description": (
            "Search the open web for research context (news, company, macro). "
            "Use before proposing trades. Returns snippets — not investment advice."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "minLength": 2,
                    "description": "Search query, e.g. NVDA earnings AI chips 2026",
                },
                "max_results": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 10,
                    "default": 5,
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
    {
        "name": "compute_impact",
        "description": "Estimate notional and buying-power impact before proposing an order.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string"},
                "side": {"type": "string", "enum": ["buy", "sell"]},
                "qty": {"type": "number", "exclusiveMinimum": 0},
                "limit_price": {"type": "number", "exclusiveMinimum": 0},
            },
            "required": ["symbol", "side", "qty"],
            "additionalProperties": False,
        },
    },
    {
        "name": "propose_order",
        "description": (
            "Propose a trade for policy review and human confirmation. "
            "Does NOT submit to the broker. Prefer limit orders. "
            "Always include a clear thesis in reason."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string"},
                "side": {"type": "string", "enum": ["buy", "sell"]},
                "qty": {"type": "number", "exclusiveMinimum": 0},
                "order_type": {
                    "type": "string",
                    "enum": ["limit", "market"],
                    "default": "limit",
                },
                "limit_price": {"type": "number", "exclusiveMinimum": 0},
                "reason": {
                    "type": "string",
                    "minLength": 8,
                    "description": "Human-readable thesis for the trade",
                },
            },
            "required": ["symbol", "side", "qty", "reason"],
            "additionalProperties": False,
        },
    },
    {
        "name": "cancel_order",
        "description": "Cancel an open broker order by broker order id.",
        "input_schema": {
            "type": "object",
            "properties": {
                "broker_order_id": {"type": "string"},
            },
            "required": ["broker_order_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "decide_hold",
        "description": (
            "First-class do-nothing decision. Always journals why no trade was taken. "
            "Use when research does not justify a new order."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {
                    "type": "string",
                    "description": "Optional focus symbol",
                },
                "reason": {
                    "type": "string",
                    "minLength": 8,
                    "description": "Why we hold / do nothing",
                },
            },
            "required": ["reason"],
            "additionalProperties": False,
        },
    },
    {
        "name": "journal_entry",
        "description": "Append a structured journal note for the day.",
        "input_schema": {
            "type": "object",
            "properties": {
                "summary_md": {"type": "string", "minLength": 1},
                "decisions": {
                    "type": "array",
                    "items": {"type": "object"},
                    "default": [],
                },
            },
            "required": ["summary_md"],
            "additionalProperties": False,
        },
    },
]

TOOL_NAMES = [t["name"] for t in TOOL_DEFINITIONS]


def as_anthropic_tools() -> list[dict[str, Any]]:
    """Format for Anthropic Messages API tools= parameter."""
    return [
        {
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["input_schema"],
        }
        for t in TOOL_DEFINITIONS
    ]
