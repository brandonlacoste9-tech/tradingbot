from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://trading:trading@localhost:5432/ai_trading"
    # Set true to force memory-only (skip Postgres even if URL set)
    database_url_disabled: bool = False
    confirm_ttl_seconds: int = 180

    # Auth: disabled (demo multi-tenant via X-User-Id) | clerk
    auth_mode: str = "disabled"
    demo_user_id: str = "demo"
    clerk_issuer: str = ""
    clerk_jwks_url: str = ""
    clerk_audience: str = ""
    # Optional: publishable key only needed on frontend

    # sim = Canada-safe in-memory paper (default for Render)
    # ibkr = local IB Gateway paper (port 4002)
    # alpaca = US-eligible accounts only (not for Canadian residents)
    broker_backend: str = "sim"

    alpaca_api_key_id: str = ""
    alpaca_api_secret_key: str = ""
    alpaca_base_url: str = "https://paper-api.alpaca.markets"
    alpaca_data_url: str = "https://data.alpaca.markets"

    # Market data (NOT brokers; separate from ADMIN_API_KEY)
    # FMP = Financial Modeling Prep (preferred for quotes + EOD history)
    fmp_api_key: str = ""
    fmp_base_url: str = "https://financialmodelingprep.com"
    # Alpha Vantage — news sentiment + quote/bars fallback (tight free limits)
    alpha_vantage_api_key: str = ""
    # Massive.com (Polygon-compatible) — news / prev close fallback
    massive_api_key: str = ""
    massive_base_url: str = "https://api.polygon.io"

    # Plaid — bank account linking (optional; not market data / not broker)
    plaid_client_id: str = ""
    plaid_secret: str = ""
    plaid_env: str = "sandbox"  # sandbox | development | production

    ibkr_host: str = "127.0.0.1"
    ibkr_port: int = 4002
    ibkr_client_id: int = 1

    # LLM: xai (default, cheaper) | openai | anthropic | demo (empty keys)
    llm_provider: str = "xai"
    llm_model: str = ""  # empty → provider default
    xai_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    # Optional override base URL (OpenAI-compatible only)
    llm_base_url: str = ""

    default_max_position_pct: float = 5.0
    default_max_daily_loss_pct: float = 3.0
    default_max_open_positions: int = 10
    paper_only: bool = True
    # Paper: allow proposals outside US RTH (still flagged in impact.outside_rth)
    paper_allow_outside_rth: bool = True
    # Production guards (log/assert on boot when true)
    require_clerk_auth: bool = False  # set true on Render when AUTH_MODE must be clerk
    require_sim_broker: bool = False  # set true to block ibkr/alpaca on shared SaaS
    expose_openapi_docs: bool = True  # set false in production
    public_health_verbose: bool = True  # set false to slim /health

    # Stripe (PR3) — leave empty to disable paid checkout
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id_pro: str = ""  # price_... for Pro monthly
    # Prefer production domain when DNS points at Netlify; Netlify subdomain still works.
    stripe_success_url: str = "https://indietrades.com/?billing=success"
    stripe_cancel_url: str = "https://indietrades.com/?billing=cancel"
    # Allow POST /billing/dev-set-plan without Stripe (local/demo only)
    stripe_dev_mode: bool = False

    # Free-tier daily chat cap (enforced when plan=free)
    free_chat_per_day: int = 25

    # PR4 — admin kill switch + LLM circuit breaker
    admin_api_key: str = ""  # X-Admin-Key header; empty disables /admin/*
    global_kill_switch: bool = False  # env bootstrap at process start
    llm_breaker_failure_threshold: int = 5  # open after N failures in window
    llm_breaker_window_seconds: int = 60
    llm_breaker_cooldown_seconds: int = 120  # stay open then half-open probe
    # When circuit is open: "demo" falls back to demo agent; "block" returns 503
    llm_breaker_open_mode: str = "demo"

    # Comma-separated. Include Netlify + local dev. Override via CORS_ORIGINS env.
    cors_origins: str = (
        "http://localhost:3000,"
        "https://indietrades.com,"
        "https://www.indietrades.com,"
        "https://hilarious-piroshki-08d173.netlify.app"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
