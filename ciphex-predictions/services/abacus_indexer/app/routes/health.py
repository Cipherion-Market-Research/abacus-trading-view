"""
Health Check Endpoint

Provides service health status for ECS health checks and monitoring.
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings


router = APIRouter()


class ComponentHealth(BaseModel):
    """Health status of a component."""
    status: str  # "healthy", "degraded", "unhealthy"
    message: Optional[str] = None
    last_check: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str  # "healthy", "degraded", "unhealthy"
    service: str
    version: str
    environment: str
    timestamp: str
    components: dict[str, ComponentHealth]


# Placeholder for component health checks (will be populated by service)
_component_checks: dict[str, callable] = {}


def register_health_check(name: str, check_fn: callable) -> None:
    """Register a component health check function."""
    _component_checks[name] = check_fn


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Service health check endpoint.

    Returns overall health status and per-component breakdown.
    Used by ECS health checks and load balancers.
    """
    now = datetime.now(timezone.utc).isoformat()
    components: dict[str, ComponentHealth] = {}

    # Run registered health checks
    overall_status = "healthy"

    for name, check_fn in _component_checks.items():
        try:
            result = await check_fn() if callable(check_fn) else check_fn
            components[name] = ComponentHealth(
                status=result.get("status", "healthy"),
                message=result.get("message"),
                last_check=now,
            )
            if result.get("status") == "unhealthy":
                overall_status = "unhealthy"
            elif result.get("status") == "degraded" and overall_status == "healthy":
                overall_status = "degraded"
        except Exception as e:
            components[name] = ComponentHealth(
                status="unhealthy",
                message=str(e),
                last_check=now,
            )
            overall_status = "unhealthy"

    # If no checks registered, report as healthy (scaffold mode)
    if not components:
        components["scaffold"] = ComponentHealth(
            status="healthy",
            message="Service scaffold running, no components registered yet",
            last_check=now,
        )

    return HealthResponse(
        status=overall_status,
        service=settings.service_name,
        version=settings.service_version,
        environment=settings.environment,
        timestamp=now,
        components=components,
    )


@router.get("/health/live")
async def liveness_check() -> dict:
    """
    Kubernetes/ECS liveness probe.

    Simple check that the service is running.
    """
    return {"status": "ok"}


@router.get("/health/ready")
async def readiness_check() -> dict:
    """
    Kubernetes/ECS readiness probe.

    Check that the service is ready to accept traffic.
    In scaffold mode, always returns ready.
    """
    # TODO: Add actual readiness checks (DB connection, venue connections, etc.)
    return {"status": "ready"}
