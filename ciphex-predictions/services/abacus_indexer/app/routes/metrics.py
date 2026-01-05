"""
Prometheus Metrics Endpoint

Exposes /metrics endpoint in Prometheus text format.
"""

import logging
from fastapi import APIRouter, Request, Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from ...core.metrics import (
    REGISTRY,
    update_venue_status,
    set_service_info,
)
from ..config import settings


logger = logging.getLogger(__name__)
router = APIRouter()


def _update_live_metrics(request: Request) -> None:
    """
    Update metrics with current live values from aggregator.

    This is called on each /metrics scrape to ensure venue connection
    status and uptime are current.
    """
    aggregator = getattr(request.app.state, "aggregator", None)
    if not aggregator:
        return

    # Update venue connection metrics from live telemetry
    for key, connector in aggregator._connectors.items():
        venue_id, asset_id, market_type = key
        telemetry = connector.get_telemetry()

        update_venue_status(
            venue=venue_id.value,
            asset=asset_id.value,
            market_type=market_type.value,
            connected=(telemetry.connection_state.value == "connected"),
            uptime_percent=telemetry.uptime_percent,
        )


@router.get("/metrics")
async def prometheus_metrics(request: Request) -> Response:
    """
    Prometheus metrics endpoint.

    Returns metrics in Prometheus text exposition format.
    Designed for Prometheus scraping at /metrics or /indexer/metrics.

    Metrics exposed:
    - abacus_composite_bars_total{asset, market_type}
    - abacus_gap_bars_total{asset, market_type}
    - abacus_degraded_bars_total{asset, market_type}
    - abacus_venues_included{asset, market_type}
    - abacus_venue_connected{venue, asset, market_type}
    - abacus_venue_uptime_percent{venue, asset, market_type}
    - abacus_venue_reconnects_total{venue, asset, market_type}
    - abacus_venue_messages_total{venue, asset, market_type}
    - abacus_venue_trades_total{venue, asset, market_type}
    - abacus_db_writes_total{table, status}
    - abacus_db_write_latency_seconds{table}
    - abacus_service_info{version, environment}
    """
    # Set service info on each scrape (idempotent)
    set_service_info(settings.service_version, settings.environment)

    # Update live metrics from aggregator state
    _update_live_metrics(request)

    # Generate Prometheus format output
    metrics_output = generate_latest(REGISTRY)

    return Response(
        content=metrics_output,
        media_type=CONTENT_TYPE_LATEST,
    )
