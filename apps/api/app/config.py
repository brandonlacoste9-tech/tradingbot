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

    alpaca_api_key_id: str = ""
    alpaca_api_secret_key: str = ""
    alpaca_base_url: str = "https://paper-api.alpaca.markets"
    alpaca_data_url: str = "https://data.alpaca.markets"

    anthropic_api_key: str = ""

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
