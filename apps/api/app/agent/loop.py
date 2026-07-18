"""
Agent loop.

- Demo path: keyword intent extraction (no LLM key required).
- LLM path: Anthropic Messages API OR xAI/OpenAI-compatible Chat Completions.

Hard rule: this module may CREATE proposals and HOLD journals.
It never submits orders. Submission only happens after human confirm + policy re-check.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal
from typing import Any, Awaitable, Callable

from app.tools.schemas import as_anthropic_tools, as_openai_tools


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
    provider: str = "xai",
    api_key: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
) -> dict[str, Any]:
    """
    Real LLM path with tool use.

    provider:
      - xai / openai → OpenAI-compatible Chat Completions (default for cost)
      - anthropic → Anthropic Messages API

    tool_executor(tool_name, args) must run the same path as /agent/chat demo tools
    (propose_order → policy gate only; never broker submit).
    """
    provider = (provider or "xai").lower().strip()
    if provider in ("xai", "openai", "grok"):
        return await _run_openai_compatible(
            user_message,
            tool_executor,
            provider=provider,
            api_key=api_key,
            model=model,
            base_url=base_url,
        )
    if provider == "anthropic":
        return await _run_anthropic(
            user_message,
            tool_executor,
            api_key=api_key,
            model=model,
        )
    raise RuntimeError(f"Unknown LLM_PROVIDER={provider!r}; use xai|openai|anthropic")


async def _run_openai_compatible(
    user_message: str,
    tool_executor: ToolExecutor,
    *,
    provider: str,
    api_key: str | None,
    model: str | None,
    base_url: str | None,
) -> dict[str, Any]:
    try:
        from openai import AsyncOpenAI
    except ImportError as e:
        raise RuntimeError(
            "openai package not installed. pip install openai "
            "(used for xAI / OpenAI-compatible providers)"
        ) from e

    if not api_key:
        raise RuntimeError(f"{provider.upper()} API key is not configured")

    if provider in ("xai", "grok"):
        resolved_base = (base_url or "https://api.x.ai/v1").rstrip("/")
        # Fast/cheap default for agent tool loops; override with LLM_MODEL
        resolved_model = model or "grok-4-1-fast-non-reasoning"
    else:
        resolved_base = (base_url or "https://api.openai.com/v1").rstrip("/")
        resolved_model = model or "gpt-4o-mini"

    client = AsyncOpenAI(api_key=api_key, base_url=resolved_base)
    tools = as_openai_tools()
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]

    collected_actions: list[dict[str, Any]] = []
    collected_results: list[dict[str, Any]] = []
    final_text_parts: list[str] = []

    for _round in range(MAX_TOOL_ROUNDS):
        resp = await client.chat.completions.create(
            model=resolved_model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.2,
        )
        choice = resp.choices[0]
        msg = choice.message
        messages.append(msg.model_dump(exclude_none=True))

        if msg.content:
            final_text_parts.append(msg.content)

        tool_calls = msg.tool_calls or []
        if choice.finish_reason == "stop" or not tool_calls:
            break

        for tc in tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            if not isinstance(args, dict):
                args = {}

            collected_actions.append({"tool": name, "args": args})
            try:
                result = await tool_executor(name, args)
                collected_results.append({"tool": name, "ok": True, "result": result})
                result_payload = result
            except Exception as e:  # noqa: BLE001
                collected_results.append({"tool": name, "ok": False, "error": str(e)})
                result_payload = {"error": str(e)}

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": _safe_json(result_payload),
                }
            )

    assistant_text = "\n".join(final_text_parts).strip() or (
        "Done. See tool results for details."
    )

    return {
        "mode": "llm",
        "assistant_text": assistant_text,
        "actions": collected_actions,
        "tool_results": collected_results,
        "model": resolved_model,
        "provider": provider,
    }


async def _run_anthropic(
    user_message: str,
    tool_executor: ToolExecutor,
    *,
    api_key: str | None,
    model: str | None,
) -> dict[str, Any]:
    try:
        import anthropic
    except ImportError as e:
        raise RuntimeError(
            "anthropic package not installed. pip install anthropic "
            "(or use xai/openai provider)"
        ) from e

    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    resolved_model = model or "claude-sonnet-4-20250514"
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
            model=resolved_model,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=tools,
            messages=messages,
        )

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
        "model": resolved_model,
        "provider": "anthropic",
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
        return json.dumps(obj, default=str)[:12000]
    except Exception:  # noqa: BLE001
        return json.dumps({"repr": str(obj)[:4000]})


_TICKER_RE = re.compile(
    r"\b(?:quote|price|of|for|on|ticker|symbol|about|research|news|bars?|chart)\s+"
    r"([A-Za-z]{1,5})\b",
    re.I,
)
_BARE_TICKER_RE = re.compile(r"^\s*([A-Za-z]{1,5})\s*$")
# Common liquid names for bare demos
_KNOWN = {
    "spy",
    "qqq",
    "iwm",
    "aapl",
    "msft",
    "nvda",
    "tsla",
    "amzn",
    "googl",
    "meta",
    "amd",
    "nflx",
}


def _extract_ticker(text: str, lower: str) -> str | None:
    m = _TICKER_RE.search(text)
    if m:
        return m.group(1).upper().rstrip(".")
    m2 = _BARE_TICKER_RE.match(text)
    if m2 and m2.group(1).lower() in _KNOWN:
        return m2.group(1).upper()
    for t in _KNOWN:
        if re.search(rf"\b{t}\b", lower):
            return t.upper()
    # $AAPL style
    m3 = re.search(r"\$([A-Za-z]{1,5})\b", text)
    if m3:
        return m3.group(1).upper()
    return None


def run_agent_turn_demo(user_message: str) -> dict[str, Any]:
    """
    Keyword + ticker demo path so the desk stays useful without an LLM key.
    Still never submits orders — only proposes / holds / research tools.
    """
    text = user_message.strip()
    lower = text.lower()
    ticker = _extract_ticker(text, lower)

    if any(
        k in lower
        for k in ("hold", "do nothing", "do not trade", "don't trade", "no trade", "no edge")
    ):
        reason = text if len(text) >= 8 else "Conditions do not justify a new trade today."
        return {
            "mode": "demo",
            "assistant_text": "Logging a hold / do-nothing decision.",
            "actions": [{"tool": "decide_hold", "args": {"reason": reason}}],
        }

    # Quote / price first (before generic research)
    if any(k in lower for k in ("quote", "price", "how much is", "trading at", "last trade")):
        symbol = ticker or "SPY"
        return {
            "mode": "demo",
            "assistant_text": f"Pulling latest available quote for {symbol}…",
            "actions": [{"tool": "get_quote", "args": {"symbol": symbol}}],
        }

    if any(k in lower for k in ("bar", "chart", "ohlc", "candles", "history")):
        symbol = ticker or "SPY"
        return {
            "mode": "demo",
            "assistant_text": f"Fetching daily bars for {symbol}…",
            "actions": [
                {
                    "tool": "get_bars",
                    "args": {"symbol": symbol, "timeframe": "1Day", "limit": 30},
                }
            ],
        }

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
            "news",
            "why is",
            "catalyst",
        )
    ):
        q = text
        for prefix in (
            "search for",
            "search",
            "research",
            "look up",
            "lookup",
            "news on",
            "news for",
            "news about",
            "news",
        ):
            if lower.startswith(prefix):
                q = text[len(prefix) :].strip(" :,-") or text
                break
        if ticker and ticker.lower() not in q.lower():
            q = f"{ticker} {q}"
        actions: list[dict[str, Any]] = [
            {"tool": "web_search", "args": {"query": q[:200], "max_results": 5}}
        ]
        if ticker:
            actions.insert(0, {"tool": "get_quote", "args": {"symbol": ticker}})
            actions.append(
                {"tool": "get_news", "args": {"symbol": ticker, "limit": 5}}
            )
        return {
            "mode": "demo",
            "assistant_text": (
                f"Researching{f' {ticker}' if ticker else ''}… "
                "pulling market data + web context."
            ),
            "actions": actions,
        }

    if any(
        k in lower
        for k in ("buying power", "account", "equity", "cash balance", "portfolio", "how much cash")
    ):
        return {
            "mode": "demo",
            "assistant_text": "Fetching paper account details…",
            "actions": [{"tool": "get_account", "args": {}}],
        }

    if "position" in lower:
        return {
            "mode": "demo",
            "assistant_text": "Fetching open positions…",
            "actions": [{"tool": "get_positions", "args": {}}],
        }

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
        assert m is not None
        side = "buy" if buy_m else "sell"
        qty = Decimal(m.group(1) or "1")
        symbol = m.group(2).upper().rstrip(".")
        limit = Decimal(m.group(3)) if m.group(3) else None
        reason = f"Desk proposal from chat: {text[:200]}"
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
            "actions": [
                {"tool": "get_quote", "args": {"symbol": symbol}},
                {"tool": "propose_order", "args": args},
            ],
        }

    # Bare / short ticker → quote + light research
    if ticker and len(text) < 40:
        return {
            "mode": "demo",
            "assistant_text": f"Looking up {ticker} (quote + context)…",
            "actions": [
                {"tool": "get_quote", "args": {"symbol": ticker}},
                {
                    "tool": "web_search",
                    "args": {"query": f"{ticker} stock", "max_results": 4},
                },
            ],
        }

    return {
        "mode": "demo",
        "assistant_text": (
            "Demo mode (Grok LLM offline). I can still run tools:\n"
            "· Quote AAPL / NVDA\n"
            "· Research NVDA AI chips\n"
            "· What is my buying power?\n"
            "· Propose a limit buy of 1 share of SPY\n"
            "· Hold — no edge today\n"
            "Set XAI_API_KEY on the API for full Grok research."
        ),
        "actions": [],
    }


def summarize_demo_tools(
    assistant_text: str, tool_results: list[dict[str, Any]]
) -> str:
    """Turn raw tool results into a readable reply for demo mode."""
    if not tool_results:
        return assistant_text
    bits: list[str] = []
    for tr in tool_results:
        if not tr.get("ok"):
            bits.append(f"· {tr.get('tool')}: failed — {tr.get('error') or 'error'}")
            continue
        tool = tr.get("tool")
        result = tr.get("result")
        if not isinstance(result, dict):
            bits.append(f"· {tool}: ok")
            continue
        if tool == "get_quote":
            px = result.get("close") or result.get("price")
            src = result.get("source") or "market"
            bits.append(f"· Quote {result.get('symbol', '')}: **{px}** ({src})")
        elif tool == "get_account":
            bits.append(
                f"· Account equity **{result.get('equity')}** · "
                f"cash **{result.get('cash')}** · "
                f"BP **{result.get('buying_power')}**"
            )
        elif tool == "get_positions":
            # positions may be list at top level or nested
            pos = result if isinstance(result, list) else result.get("positions")
            if isinstance(pos, list):
                if not pos:
                    bits.append("· Positions: none open")
                else:
                    syms = ", ".join(
                        f"{p.get('symbol')}×{p.get('qty')}" for p in pos[:8] if isinstance(p, dict)
                    )
                    bits.append(f"· Positions: {syms}")
            else:
                bits.append("· Positions fetched")
        elif tool == "web_search":
            results = result.get("results") or result.get("organic") or []
            if isinstance(results, list) and results:
                lines = []
                for r in results[:4]:
                    if isinstance(r, dict):
                        title = r.get("title") or r.get("text") or ""
                        lines.append(f"  – {str(title)[:100]}")
                bits.append("· Web:\n" + "\n".join(lines) if lines else "· Web search ok")
            else:
                bits.append("· Web search completed")
        elif tool == "get_news":
            news = result.get("news") or []
            if isinstance(news, list) and news:
                titles = []
                for n in news[:3]:
                    if isinstance(n, dict):
                        titles.append(f"  – {str(n.get('title') or '')[:100]}")
                bits.append("· News:\n" + "\n".join(titles) if titles else "· News ok")
            else:
                note = result.get("note") or result.get("massive_error") or "no headlines"
                bits.append(f"· News: {note}")
        elif tool == "get_bars":
            bars = result.get("bars") or []
            n = len(bars) if isinstance(bars, list) else 0
            bits.append(f"· Bars: {n} ({result.get('source') or 'ok'})")
        elif tool == "propose_order":
            st = result.get("policy_status")
            bits.append(
                f"· Proposal **{result.get('side')} {result.get('qty')} "
                f"{result.get('symbol')}** · status `{st}`"
                + (
                    f" · {result.get('rejection_reason')}"
                    if st == "policy_rejected"
                    else " · confirm in preflight"
                )
            )
        elif tool == "decide_hold":
            bits.append(f"· Hold logged: {result.get('reason') or 'ok'}")
        else:
            bits.append(f"· {tool}: ok")

    body = "\n".join(bits)
    return f"{assistant_text}\n\n{body}"
