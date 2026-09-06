from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "NetOpsWatch"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "netopswatch-super-secret-key-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "sqlite:///./netopswatch.db"

    # Monitoring Engine Defaults
    DEFAULT_PING_COUNT: int = 4
    DEFAULT_PING_TIMEOUT_MS: int = 1000
    DEFAULT_MONITORING_INTERVAL_SECONDS: int = 30
    LATENCY_WARNING_THRESHOLD_MS: float = 150.0
    LATENCY_CRITICAL_THRESHOLD_MS: float = 300.0
    PACKET_LOSS_WARNING_THRESHOLD: float = 15.0
    PACKET_LOSS_CRITICAL_THRESHOLD: float = 50.0
    CONSECUTIVE_FAILURES_BEFORE_DOWN: int = 3

    # SNMP Defaults
    DEFAULT_SNMP_PORT: int = 161
    DEFAULT_SNMP_TIMEOUT: float = 2.0
    DEFAULT_SNMP_RETRIES: int = 1

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
