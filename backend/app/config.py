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


settings = Settings()
