"""
Abacus Indexer Configuration

Pydantic Settings for the Abacus Indexer service.
Loads from environment variables with sensible defaults.
"""

from typing import Literal
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Abacus Indexer service configuration."""

    # Service identity
    service_name: str = Field(default="abacus-indexer", description="Service name for logging/metrics")
    environment: Literal["local", "staging", "production"] = Field(default="local")
    service_version: str = Field(default="0.1.0")
    log_level: str = Field(default="INFO")

    # Assets and venues (frozen contract)
    assets: str = Field(default="BTC,ETH", description="Comma-separated asset list")
    spot_venues: str = Field(default="binance,coinbase,okx,kraken", description="Comma-separated spot venues")
    perp_venues: str = Field(default="binance,okx,bybit", description="Comma-separated perp venues")

    # Quorum settings (frozen contract)
    min_quorum: int = Field(default=2, description="Minimum venues for composite to be connected")
    preferred_quorum: int = Field(default=3, description="Target for non-degraded status")

    # Thresholds (frozen contract)
    outlier_threshold_bps: int = Field(default=100, description="Max deviation from median before exclusion")

    # Stale thresholds per venue (ms) - defaults from constants.ts
    stale_threshold_binance_spot: int = Field(default=10_000)
    stale_threshold_binance_perp: int = Field(default=10_000)
    stale_threshold_coinbase_spot: int = Field(default=30_000)
    stale_threshold_kraken_spot: int = Field(default=30_000)
    stale_threshold_okx_spot: int = Field(default=15_000)
    stale_threshold_okx_perp: int = Field(default=15_000)
    stale_threshold_bybit_perp: int = Field(default=10_000)

    # SSE settings
    sse_price_cadence_ms: int = Field(default=500, description="SSE price event cadence")
    sse_telemetry_cadence_ms: int = Field(default=5_000, description="SSE telemetry event cadence")

    # Database
    database_url: str = Field(default="", description="PostgreSQL connection string")
    retention_days: int = Field(default=14, description="Days to retain composite bars (0 = no retention)")

    # Redis (optional, for caching)
    redis_url: str = Field(default="", description="Redis connection string")

    # Server
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)

    # Admin authentication (required for mutation endpoints)
    admin_api_key: str = Field(
        default="",
        description="API key for admin/mutation endpoints (e.g., backfill). Required in production."
    )

    class Config:
        env_prefix = ""
        case_sensitive = False
        env_file = ".env"
        extra = "ignore"

    @property
    def asset_list(self) -> list[str]:
        """Parse assets string to list."""
        return [a.strip().upper() for a in self.assets.split(",") if a.strip()]

    @property
    def spot_venue_list(self) -> list[str]:
        """Parse spot venues string to list."""
        return [v.strip().lower() for v in self.spot_venues.split(",") if v.strip()]

    @property
    def perp_venue_list(self) -> list[str]:
        """Parse perp venues string to list."""
        return [v.strip().lower() for v in self.perp_venues.split(",") if v.strip()]

    def get_stale_threshold(self, venue: str, market_type: str) -> int:
        """Get stale threshold for venue/market_type combination."""
        key = f"stale_threshold_{venue}_{market_type}"
        return getattr(self, key, 30_000)  # Default 30s if not configured


# Global settings instance
settings = Settings()
