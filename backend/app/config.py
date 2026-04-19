"""App configuration loaded from environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./petbook.db"
    jwt_secret: str = "change-me"
    jwt_expire_hours: int = 168
    first_admin_email: str = "admin@petbook.local"

    subscription_price_cents: int = 1000
    subscription_period_days: int = 365

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""

    anthropic_api_key: str = ""

    # Ollama Cloud — hosted LLM, no local infra.
    ollama_api_key: str = ""
    ollama_host: str = "https://ollama.com"
    ollama_model: str = "gemma3:27b-cloud"

    # Deploy-time
    # Comma-separated list, or "*" to allow all (dev only).
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Directory for uploaded images. In prod, point at a persistent volume (e.g. /data/uploads).
    upload_dir: str = ""
    # Auto-seed the DB on startup if the animals table is empty.
    auto_seed: bool = True

    @property
    def normalized_database_url(self) -> str:
        """Railway & Heroku hand out `postgres://...` which SQLAlchemy 2 rejects."""
        url = self.database_url
        if url.startswith("postgres://"):
            return "postgresql+psycopg2://" + url[len("postgres://") :]
        if url.startswith("postgresql://") and "+" not in url.split("://", 1)[0]:
            return url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        raw = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return raw or ["*"]


settings = Settings()
