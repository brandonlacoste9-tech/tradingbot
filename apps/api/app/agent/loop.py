"""
Agent loop.

- Demo path: keyword intent extraction (no LLM key required).
- Real path: Anthropic Messages API tool-calling using tools/schemas.py.

Hard rule: this module may CREATE proposals and HOLD journals.
It never submits orders. Submission only happens after human confirm + policy re-check.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal
from typing import Any, Awaitable, Callable

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
- After tool results, synthesize a short clear answer for the user.
- When proposing, include a real thesis in the reason field (not placeholder text).
"""

# Max tool-use rounds per user turn (prevents runaway loops)
MAX_TOOL_ROUNDS = 6

ToolExecutor = Callable[[str, dict[str, Any]], Awaitable[Any]]


async def run_agent_turn_llm(
    user_message: str,
    tool_executor: ToolExecutor,
    *,
    api_key: str | None = None,
    model: str = "claude-sonnet-4-20250514",
) -> dict[str, Any]:
    """
    Real LLM path: Anthropic Messages API with tool use.

    tool_executor(tool_name, args) must run the same path as /agent/chat demo tools
    (propose_order → policy gate only; never broker submit).
    """
    try:
        import anthropic
    except ImportError as e:
        raise RuntimeError(
            "anthropic package not installed. pip install anthropic "
            "(or use demo path without ANTHROPIC_API_KEY)"
        ) from e

    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    client = anthropic.AsyncAnthropic(api_key=api_key)
    tools = as_anthropic_tools()
    messages: list[dict[str, Any]] = [
        {"role": "user", "content": user_message},
    ]

    collected_actions: list[dict[str, Any]] = []
    collected_results: list[dict[str, Any]] = []
    final_text_parts: list[str] = []

    for _round in range(MAX_TOOL_ROUNDS):
        resp = await client.messages.create(
            model=model,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=tools,
            messages=messages,
        )

        # Collect assistant content blocks
        assistant_content = resp.content
        messages.append(
            {
                "role": "assistant",
                "content": [
                    block.model_dump(exclude_none=True)
                    if hasattr(block, "model_dump")
                    else _block_to_dict(block)
                    for block in assistant_content
                ],
            }
        )

        tool_uses = [b for b in assistant_content if getattr(b, "type", None) == "tool_use"]
        text_blocks = [
            getattr(b, "text", "")
            for b in assistant_content
            if getattr(b, "type", None) == "text"
        ]
        if text_blocks:
            final_text_parts.extend(t for t in text_blocks if t)

        if resp.stop_reason == "end_turn" or not tool_uses:
            break

        # Execute tools and feed results back
        tool_result_content: list[dict[str, Any]] = []
        for tu in tool_uses:
            name = tu.name
            args = tu.input if isinstance(tu.input, dict) else {}
            tool_id = tu.id

            collected_actions.append({"tool": name, "args": args})
            try:
                result = await tool_executor(name, args)
                collected_results.append({"tool": name, "ok": True, "result": result})
                result_payload = result
            except Exception as e:  # noqa: BLE001
                collected_results.append({"tool": name, "ok": False, "error": str(e)})
                result_payload = {"error": str(e)}

            tool_result_content.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": _safe_json(result_payload),
                }
            )

        messages.append({"role": "user", "content": tool_result_content})

    assistant_text = "\n".join(final_text_parts).strip() or (
        "Done. See tool results for details."
    )

    return {
        "mode": "llm",
        "assistant_text": assistant_text,
        "actions": collected_actions,
        "tool_results": collected_results,
        "model": model,
    }


def _block_to_dict(block: Any) -> dict[str, Any]:
    """Fallback serializer for content blocks without model_dump."""
    t = getattr(block, "type", None)
    if t == "text":
        return {"type": "text", "text": getattr(block, "text", "")}
    if t == "tool_use":
        return {
            "type": "tool_use",
            "id": getattr(block, "id", ""),
            "name": getattr(block, "name", ""),
            "input": getattr(block, "input", {}) or {},
        }
    return {"type": str(t), "raw": str(block)}


def _safe_json(obj: Any) -> str:
    try:
        return json.dumps(obj, default=str)[:12000]  # cap size for context
    except Exception:  # noqa: BLE001
        return json.dumps({"repr": str(obj)[:4000]})


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
