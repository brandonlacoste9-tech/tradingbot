"""
Agent loop.

- Demo path: keyword intent extraction (no LLM key required).
- Real path: outline for Claude/Anthropic tool-calling using tools/schemas.py.

Hard rule: this module may CREATE proposals and HOLD journals.
It never submits orders. Submission only happens after human confirm + policy re-check.
"""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

from app.tools.schemas import as_anthropic_tools


SYSTEM_PROMPT = """You are a paper-trading research and execution assistant.

Rules:
- Do most of the work by researching the web (web_search) before proposing trades.
- Prefer limit orders. Never invent fills.
- Always call propose_order for trades — never claim an order was submitted.
- Use decide_hold when no trade is justified; empty quiet days still need a reason.
- Respect risk limits; the policy engine will reject unsafe sizes.
- Paper trading only unless the user has explicitly enabled live mode (not available in MVP).
- Never claim live brokerage access for Canadian users on Alpaca — use sim or IBKR paper.
"""


async def run_agent_turn_llm(user_message: str, tool_executor) -> dict[str, Any]:
    """
    Outline for real LLM integration (Claude Messages API + tools).

    Pseudocode:
      client = anthropic.AsyncAnthropic()
      messages = [{"role": "user", "content": user_message}]
      while True:
          resp = await client.messages.create(
              model="claude-sonnet-4-...",
              max_tokens=2048,
              system=SYSTEM_PROMPT,
              tools=as_anthropic_tools(),
              messages=messages,
          )
          # append assistant content
          # for each tool_use: execute via tool_executor (propose → policy, never submit)
          # if end_turn: return text + side effects
    """
    _ = as_anthropic_tools()
    raise NotImplementedError(
        "Wire Anthropic/OpenAI/xAI tool-calling here. "
        "Demo path is run_agent_turn_demo()."
    )


def run_agent_turn_demo(user_message: str) -> dict[str, Any]:
    """
    Lightweight keyword demo so the full proposal → policy → confirm flow
    works without an LLM API key.
    """
    text = user_message.strip()
    lower = text.lower()

    # Hold / do nothing
    if any(
        k in lower
        for k in ("hold", "do nothing", "do not trade", "don't trade", "no trade")
    ):
        reason = text if len(text) >= 8 else "Conditions do not justify a new trade today."
        return {
            "mode": "demo",
            "assistant_text": "Logging a hold / do-nothing decision.",
            "actions": [
                {
                    "tool": "decide_hold",
                    "args": {"reason": reason},
                }
            ],
        }

    # Web research (primary AI job)
    if any(
        k in lower
        for k in (
            "search",
            "research",
            "look up",
            "lookup",
            "google",
            "what is happening",
            "headline",
        )
    ):
        # Prefer free-text after keyword, else full message
        q = text
        for prefix in ("search for", "search", "research", "look up", "lookup"):
            if lower.startswith(prefix):
                q = text[len(prefix) :].strip(" :,-") or text
                break
        return {
            "mode": "demo",
            "assistant_text": f"Searching the web for: {q[:120]}…",
            "actions": [
                {
                    "tool": "web_search",
                    "args": {"query": q[:200], "max_results": 5},
                }
            ],
        }

    # Buying power / account
    if any(k in lower for k in ("buying power", "account", "equity", "cash balance")):
        return {
            "mode": "demo",
            "assistant_text": "Fetching paper account details…",
            "actions": [{"tool": "get_account", "args": {}}],
        }

    # Positions
    if "position" in lower:
        return {
            "mode": "demo",
            "assistant_text": "Fetching open positions…",
            "actions": [{"tool": "get_positions", "args": {}}],
        }

    # News (broker feed if any; prefer web_search for research)
    news_m = re.search(r"news\s+(?:on|for|about)?\s*([A-Za-z.]{1,8})", text, re.I)
    if "news" in lower:
        symbol = (news_m.group(1) if news_m else "SPY").upper().rstrip(".")
        return {
            "mode": "demo",
            "assistant_text": f"Researching news for {symbol} via web search…",
            "actions": [
                {
                    "tool": "web_search",
                    "args": {
                        "query": f"{symbol} stock news",
                        "max_results": 5,
                    },
                }
            ],
        }

    # Propose order: "buy 1 share of SPY", "propose limit buy of 2 AAPL at 190"
    buy_m = re.search(
        r"(?:propose\s+)?(?:a\s+)?(?:limit\s+)?buy\s+(?:of\s+)?"
        r"(?:(\d+(?:\.\d+)?)\s+shares?\s+(?:of\s+)?)?"
        r"([A-Za-z.]{1,8})"
        r"(?:\s+at\s+(\d+(?:\.\d+)?))?",
        text,
        re.I,
    )
    sell_m = re.search(
        r"(?:propose\s+)?(?:a\s+)?(?:limit\s+)?sell\s+(?:of\s+)?"
        r"(?:(\d+(?:\.\d+)?)\s+shares?\s+(?:of\s+)?)?"
        r"([A-Za-z.]{1,8})"
        r"(?:\s+at\s+(\d+(?:\.\d+)?))?",
        text,
        re.I,
    )

    if buy_m or sell_m:
        m = buy_m or sell_m
        side = "buy" if buy_m else "sell"
        qty = Decimal(m.group(1) or "1")
        symbol = m.group(2).upper().rstrip(".")
        limit = Decimal(m.group(3)) if m.group(3) else None
        reason = f"Demo proposal from chat: {text[:200]}"
        args: dict[str, Any] = {
            "symbol": symbol,
            "side": side,
            "qty": float(qty),
            "order_type": "limit",
            "reason": reason,
        }
        if limit is not None:
            args["limit_price"] = float(limit)
        return {
            "mode": "demo",
            "assistant_text": (
                f"Creating a {side} proposal for {qty} {symbol}. "
                "Policy must pass, then you confirm in the preflight modal."
            ),
            "actions": [{"tool": "propose_order", "args": args}],
        }

    return {
        "mode": "demo",
        "assistant_text": (
            "I can: search/research the web, check buying power, list positions, "
            "propose a limit buy/sell (policy + confirm), or log a hold. "
            "Try: “Research NVDA AI chips” or “Propose a limit buy of 1 share of SPY”"
        ),
        "actions": [],
    }
