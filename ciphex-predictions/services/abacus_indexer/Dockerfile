# Abacus Indexer Service Dockerfile
# Multi-stage build for production deployment
#
# Build command (from repo root):
#   docker build --platform linux/amd64 -f services/abacus_indexer/Dockerfile -t abacus-indexer:v0.1.0 .

# ============================================================================
# Stage 1: Builder
# ============================================================================
FROM --platform=linux/amd64 python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY services/abacus_indexer/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --user -r requirements.txt

# ============================================================================
# Stage 2: Production
# ============================================================================
FROM --platform=linux/amd64 python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy service code
COPY services/abacus_indexer/ ./services/abacus_indexer/

# Set Python path
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the service
CMD ["python", "-m", "uvicorn", "services.abacus_indexer.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
