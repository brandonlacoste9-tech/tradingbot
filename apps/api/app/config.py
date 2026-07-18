from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://trading:trading@localhost:5432/ai_trading"
    confirm_ttl_seconds: int = 180

    # sim = Canada-safe in-memory paper (default for Render)
    # ibkr = local IB Gateway paper (port 4002)
    # alpaca = US-eligible accounts only (not for Canadian residents)
    broker_backend: str = "sim"

    alpaca_api_key_id: str = ""
    alpaca_api_secret_key: str = ""
    alpaca_base_url: str = "https://paper-api.alpaca.markets"
    alpaca_data_url: str = "https://data.alpaca.markets"

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

    # Comma-separated. Include Netlify + local dev. Override via CORS_ORIGINS env.
    cors_origins: str = (
        "http://localhost:3000,"
        "https://hilarious-piroshki-08d173.netlify.app"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
