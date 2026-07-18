"""Async Postgres pool (asyncpg). Optional — falls back to memory if unavailable."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

_pool: Any = None
_init_attempted = False
_db_ok = False


async def init_pool() -> bool:
    """Create pool and ensure PR2 schema. Returns True if DB ready."""
    global _pool, _init_attempted, _db_ok
    if _init_attempted and _pool is not None:
        return _db_ok
    _init_attempted = True
    settings = get_settings()
    url = (settings.database_url or "").strip()
    if not url or settings.database_url_disabled:
        logger.info("Postgres disabled or DATABASE_URL empty — memory tenancy only")
        _db_ok = False
        return False
    try:
        import asyncpg
    except ImportError:
        logger.warning("asyncpg not installed — memory tenancy only")
        _db_ok = False
        return False

    # asyncpg wants postgresql:// not postgres:// sometimes both work
    dsn = url.replace("postgres://", "postgresql://", 1)
    # Render / Neon external hosts require TLS; asyncpg ignores libpq sslmode=
    # in the URL — pass ssl explicitly when the host is remote.
    ssl_ctx: Any = None
    lower = dsn.lower()
    if (
        "sslmode=require" in lower
        or "ssl=true" in lower
        or "render.com" in lower
        or "neon.tech" in lower
        or "amazonaws.com" in lower
    ):
        import ssl as _ssl

        ssl_ctx = _ssl.create_default_context()
    # Strip query params asyncpg may not understand
    if "?" in dsn:
        dsn = dsn.split("?", 1)[0]
    try:
        _pool = await asyncpg.create_pool(
            dsn,
            min_size=1,
            max_size=5,
            command_timeout=30,
            ssl=ssl_ctx,
        )
        base = Path(__file__).resolve().parents[2]
        async with _pool.acquire() as conn:
            for name in ("schema_pr2.sql", "schema_pr3.sql"):
                schema_path = base / name
                if schema_path.exists():
                    await conn.execute(schema_path.read_text(encoding="utf-8"))
        _db_ok = True
        logger.info("Postgres pool ready (PR2+PR3 schema applied)")
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning("Postgres unavailable (%s) — memory tenancy only", e)
        _pool = None
        _db_ok = False
        return False


def is_db_available() -> bool:
    return _db_ok and _pool is not None


def get_pool():
    if not is_db_available():
        raise RuntimeError("Postgres pool not available")
    return _pool


async def close_pool() -> None:
    global _pool, _db_ok, _init_attempted
    if _pool is not None:
        await _pool.close()
    _pool = None
    _db_ok = False
    _init_attempted = False
