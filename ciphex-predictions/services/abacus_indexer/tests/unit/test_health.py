"""
Unit tests for health endpoint.
"""

import pytest
from httpx import AsyncClient, ASGITransport

from services.abacus_indexer.app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    """Test that health endpoint returns expected structure."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()

    assert "status" in data
    assert "service" in data
    assert "version" in data
    assert "environment" in data
    assert "timestamp" in data
    assert "components" in data

    assert data["service"] == "abacus-indexer"


@pytest.mark.asyncio
async def test_liveness_endpoint():
    """Test that liveness probe returns ok."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_readiness_endpoint():
    """Test that readiness probe returns ready."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


@pytest.mark.asyncio
async def test_root_endpoint():
    """Test that root endpoint returns service info."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")

    assert response.status_code == 200
    data = response.json()

    assert data["service"] == "abacus-indexer"
    assert "version" in data
    assert "docs" in data
    assert "health" in data
