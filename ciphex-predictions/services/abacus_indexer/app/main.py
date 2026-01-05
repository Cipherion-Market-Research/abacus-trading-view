"""
Abacus Indexer Service

Always-on ECS service that produces canonical 1-minute composite candles
for BTC and ETH across multiple venues.

API Endpoints:
- GET /health - Service health check
- GET /v0/candles - Historical composite candles
- GET /v0/latest - Current composite price and forming bar
- GET /v0/telemetry - Per-venue connection state and metrics
- GET /v0/stream - SSE real-time updates
- GET /metrics - Prometheus metrics endpoint
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routes import health, metrics, v0
from ..core.types import AssetId, Bar, CompositeBar, VenueId
from ..aggregator import CompositeAggregator, AggregatorConfig
from ..persistence import CompositeBarRepository, VenueBarRepository, DatabasePool
from ..core.metrics import record_db_write

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Global instances for app state
_db_pool: Optional[DatabasePool] = None
_repository: Optional[CompositeBarRepository] = None
_venue_repository: Optional[VenueBarRepository] = None
_aggregator: Optional[CompositeAggregator] = None
_retention_task: Optional[asyncio.Task] = None

# Retention enforcement interval (1 hour)
RETENTION_INTERVAL_SECONDS = 3600


def _parse_venues(venue_list: list[str]) -> list[VenueId]:
    """Parse venue strings to VenueId enums."""
    result = []
    for v in venue_list:
        try:
            result.append(VenueId(v.lower()))
        except ValueError:
            logger.warning(f"Unknown venue: {v}")
    return result


def _parse_assets(asset_list: list[str]) -> list[AssetId]:
    """Parse asset strings to AssetId enums."""
    result = []
    for a in asset_list:
        try:
            result.append(AssetId(a.upper()))
        except ValueError:
            logger.warning(f"Unknown asset: {a}")
    return result


async def _on_composite_bar(bar: CompositeBar) -> None:
    """Callback for composite bar completion - persists to database."""
    global _repository
    if _repository:
        start_time = time.time()
        try:
            await _repository.insert(bar)
            latency = time.time() - start_time
            record_db_write("composite_bars", success=True, latency_seconds=latency)
        except Exception as e:
            latency = time.time() - start_time
            record_db_write("composite_bars", success=False, latency_seconds=latency)
            logger.error(f"Failed to persist composite bar: {e}")


async def _on_venue_bars(bars: list[tuple[Bar, bool, Optional[str]]]) -> None:
    """Callback for venue bars - persists to database for forecasting traceability."""
    global _venue_repository
    if _venue_repository and bars:
        start_time = time.time()
        try:
            await _venue_repository.insert_batch(bars)
            latency = time.time() - start_time
            record_db_write("venue_bars", success=True, latency_seconds=latency)
        except Exception as e:
            latency = time.time() - start_time
            record_db_write("venue_bars", success=False, latency_seconds=latency)
            logger.error(f"Failed to persist venue bars: {e}")


async def _retention_enforcement_loop() -> None:
    """Background task that periodically enforces data retention."""
    global _repository, _venue_repository
    retention_days = settings.retention_days

    if retention_days <= 0:
        logger.info("Retention enforcement disabled (retention_days=0)")
        return

    logger.info(f"Retention enforcement enabled: {retention_days} days, interval={RETENTION_INTERVAL_SECONDS}s")

    while True:
        try:
            await asyncio.sleep(RETENTION_INTERVAL_SECONDS)

            # Enforce retention on composite bars
            if _repository:
                deleted = await _repository.enforce_retention(retention_days)
                if deleted > 0:
                    stats = await _repository.get_table_stats()
                    logger.info(f"Post-retention composite_bars: {stats.get('total_rows', 0)} rows remaining")

            # Enforce retention on venue bars
            if _venue_repository:
                venue_deleted = await _venue_repository.enforce_retention(retention_days)
                if venue_deleted > 0:
                    logger.info(f"Venue bars retention: deleted {venue_deleted} rows")

        except asyncio.CancelledError:
            logger.info("Retention enforcement task cancelled")
            break
        except Exception as e:
            logger.error(f"Retention enforcement error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.

    Handles startup and shutdown of:
    - Database connection pool
    - Venue WebSocket connectors
    - Composite aggregator background task
    - Retention enforcement background task
    """
    global _db_pool, _repository, _venue_repository, _aggregator, _retention_task

    logger.info(f"Starting {settings.service_name} v{settings.service_version}")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Assets: {settings.asset_list}")
    logger.info(f"Spot venues: {settings.spot_venue_list}")
    logger.info(f"Perp venues: {settings.perp_venue_list}")

    # Initialize database pool (if configured)
    if settings.database_url:
        try:
            _db_pool = DatabasePool()
            await _db_pool.connect(settings.database_url)
            logger.info("Database connection established")

            # Initialize schema (creates tables if they don't exist)
            schema_ok = await _db_pool.initialize_schema()
            if schema_ok:
                logger.info("Database schema verified")
            else:
                logger.warning("Schema initialization returned False - tables may not exist")

            _repository = CompositeBarRepository(_db_pool)
            _venue_repository = VenueBarRepository(_db_pool)
            logger.info("Repositories initialized (composite + venue bars)")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            _db_pool = None
            _repository = None
            _venue_repository = None
    else:
        logger.warning("No DATABASE_URL configured - persistence disabled")

    # Initialize aggregator
    config = AggregatorConfig(
        assets=_parse_assets(settings.asset_list),
        spot_venues=_parse_venues(settings.spot_venue_list),
        perp_venues=_parse_venues(settings.perp_venue_list),
    )

    _aggregator = CompositeAggregator(
        config=config,
        on_composite_bar=lambda bar: asyncio.create_task(_on_composite_bar(bar)),
        on_venue_bars=lambda bars: asyncio.create_task(_on_venue_bars(bars)) if _venue_repository else None,
    )

    # Start aggregator (connects to venues)
    await _aggregator.start()
    logger.info("Composite aggregator started")

    # Start retention enforcement background task
    if _repository and settings.retention_days > 0:
        _retention_task = asyncio.create_task(_retention_enforcement_loop())
        logger.info(f"Retention enforcement task started ({settings.retention_days} day retention)")

    logger.info("Service startup complete")

    # Store references on app.state for route access
    app.state.db_pool = _db_pool
    app.state.repository = _repository
    app.state.venue_repository = _venue_repository
    app.state.aggregator = _aggregator

    yield

    # Shutdown
    logger.info("Shutting down service...")

    # Stop retention task
    if _retention_task and not _retention_task.done():
        _retention_task.cancel()
        try:
            await _retention_task
        except asyncio.CancelledError:
            pass
        _retention_task = None

    # Stop aggregator
    if _aggregator:
        await _aggregator.stop()
        _aggregator = None

    # Close database pool
    if _db_pool:
        await _db_pool.close()
        _db_pool = None

    _repository = None
    _venue_repository = None

    logger.info("Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Abacus Indexer",
    description="Canonical 1-minute composite candle service for BTC/ETH",
    version=settings.service_version,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.environment == "local" else [],
    allow_origin_regex=None if settings.environment == "local" else r"https://.*\.(ciphex\.io|vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# Root health endpoints (for ECS health check)
app.include_router(health.router, tags=["health"])
# ALB path-based routing (/indexer/* -> service)
app.include_router(health.router, prefix="/indexer", tags=["health-alb"])

# V0 API endpoints
app.include_router(v0.router, tags=["v0-api"])
# ALB path-based routing for v0 (/indexer/v0/* -> service)
app.include_router(v0.router, prefix="/indexer", tags=["v0-api-alb"])

# Prometheus metrics endpoint
app.include_router(metrics.router, tags=["metrics"])
# ALB path-based routing for metrics (/indexer/metrics -> service)
app.include_router(metrics.router, prefix="/indexer", tags=["metrics-alb"])


@app.get("/")
async def root() -> dict:
    """Root endpoint - service info."""
    return {
        "service": settings.service_name,
        "version": settings.service_version,
        "environment": settings.environment,
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "services.abacus_indexer.app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.environment == "local",
    )
