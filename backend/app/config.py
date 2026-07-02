"""
Application configuration loaded from environment variables.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All app configuration, loaded from .env file or environment."""

    # Database
    DATABASE_URL: str = "postgresql://user:pass@localhost:5432/hmp"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Frontend URL (for CORS)
    FRONTEND_URL: str = "http://localhost:3000"

    # SMTP (optional — console backend used when these are empty)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = "noreply@hall12.iitk.ac.in"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
