"""Lightweight web search for research thesis — no API key required.

Uses DuckDuckGo Instant Answer API + optional HTML lite fallback.
Not a full SERP; good enough for demo research tool.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote_plus

import httpx


async def web_search(query: str, max_results: int = 5) -> dict[str, Any]:
    query = (query or "").strip()
    if not query:
        return {"query": query, "results": [], "error": "empty query"}

    results: list[dict[str, str]] = []
    abstract = None
    source = "duckduckgo_instant"

    try:
        url = "https://api.duckduckgo.com/"
        params = {
            "q": query,
            "format": "json",
            "no_html": "1",
            "skip_disambig": "1",
        }
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()

        if data.get("AbstractText"):
            abstract = data["AbstractText"]
            results.append(
                {
                    "title": data.get("Heading") or query,
                    "snippet": data["AbstractText"][:500],
                    "url": data.get("AbstractURL") or "",
                }
            )

        for topic in data.get("RelatedTopics") or []:
            if len(results) >= max_results:
                break
            if isinstance(topic, dict) and topic.get("Text"):
                results.append(
                    {
                        "title": (topic.get("Text") or "")[:80],
                        "snippet": topic.get("Text") or "",
                        "url": topic.get("FirstURL") or "",
                    }
                )
            elif isinstance(topic, dict) and "Topics" in topic:
                for t in topic["Topics"]:
                    if len(results) >= max_results:
                        break
                    if t.get("Text"):
                        results.append(
                            {
                                "title": (t.get("Text") or "")[:80],
                                "snippet": t.get("Text") or "",
                                "url": t.get("FirstURL") or "",
                            }
                        )

        # Fallback: DDG HTML lite if still empty
        if not results:
            source = "duckduckgo_html_lite"
            lite = f"https://lite.duckduckgo.com/lite/?q={quote_plus(query)}"
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                hr = await client.get(
                    lite,
                    headers={"User-Agent": "tradingbot-research/0.1"},
                )
            text = hr.text
            # Very light extraction of result-ish lines
            if "No results" not in text and len(text) > 200:
                results.append(
                    {
                        "title": f"Search: {query}",
                        "snippet": (
                            "Open DuckDuckGo results in a browser for full SERP. "
                            f"Lite URL: {lite}"
                        ),
                        "url": lite,
                    }
                )
    except Exception as e:  # noqa: BLE001
        return {
            "query": query,
            "results": [],
            "error": str(e),
            "source": source,
        }

    return {
        "query": query,
        "abstract": abstract,
        "results": results[:max_results],
        "source": source,
        "note": "Research only — not investment advice. Policy + confirm still required for orders.",
    }
