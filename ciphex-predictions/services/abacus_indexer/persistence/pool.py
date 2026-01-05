"""
Database Connection Pool

Manages async PostgreSQL connections using asyncpg.
Supports automatic schema initialization on startup.
"""

import logging
from pathlib import Path
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)


class DatabasePool:
    """
    Async database connection pool for TimescaleDB.

    Usage:
        pool = DatabasePool()
        await pool.connect(database_url)
        async with pool.acquire() as conn:
            await conn.fetch("SELECT * FROM composite_bars")
        await pool.close()
    """

    def __init__(self):
        self._pool: Optional[asyncpg.Pool] = None
        self._database_url: Optional[str] = None

    async def connect(
        self,
        database_url: str,
        min_size: int = 2,
        max_size: int = 10,
    ) -> None:
        """
        Create connection pool.

        Args:
            database_url: PostgreSQL connection string
            min_size: Minimum pool connections
            max_size: Maximum pool connections
        """
        if self._pool is not None:
            logger.warning("Pool already connected")
            return

        self._database_url = database_url
        self._pool = await asyncpg.create_pool(
            database_url,
            min_size=min_size,
            max_size=max_size,
        )
        logger.info(f"Database pool created (min={min_size}, max={max_size})")

    async def close(self) -> None:
        """Close the connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Database pool closed")

    def acquire(self):
        """Acquire a connection from the pool."""
        if not self._pool:
            raise RuntimeError("Database pool not connected")
        return self._pool.acquire()

    async def execute(self, query: str, *args) -> str:
        """Execute a query that doesn't return rows."""
        if not self._pool:
            raise RuntimeError("Database pool not connected")
        return await self._pool.execute(query, *args)

    async def fetch(self, query: str, *args) -> list:
        """Execute a query and fetch all rows."""
        if not self._pool:
            raise RuntimeError("Database pool not connected")
        return await self._pool.fetch(query, *args)

    async def fetchrow(self, query: str, *args):
        """Execute a query and fetch one row."""
        if not self._pool:
            raise RuntimeError("Database pool not connected")
        return await self._pool.fetchrow(query, *args)

    async def fetchval(self, query: str, *args):
        """Execute a query and fetch a single value."""
        if not self._pool:
            raise RuntimeError("Database pool not connected")
        return await self._pool.fetchval(query, *args)

    @property
    def is_connected(self) -> bool:
        """Check if pool is connected."""
        return self._pool is not None

    async def check_health(self) -> bool:
        """Check database connectivity."""
        if not self._pool:
            return False
        try:
            await self._pool.fetchval("SELECT 1")
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    async def initialize_schema(self) -> bool:
        """
        Initialize database schema if tables don't exist.

        Uses schema_postgres.sql for standard PostgreSQL (no TimescaleDB).
        Safe to call multiple times - uses CREATE TABLE IF NOT EXISTS.

        Returns:
            True if schema initialized successfully, False otherwise
        """
        if not self._pool:
            raise RuntimeError("Database pool not connected")

        try:
            # Load schema from file
            schema_path = Path(__file__).parent / "schema_postgres.sql"
            if not schema_path.exists():
                logger.error(f"Schema file not found: {schema_path}")
                return False

            schema_sql = schema_path.read_text()

            # Remove SQL comments (both single-line and multi-line)
            import re
            # Remove single-line comments
            schema_sql = re.sub(r'--[^\n]*', '', schema_sql)
            # Remove multi-line comments
            schema_sql = re.sub(r'/\*.*?\*/', '', schema_sql, flags=re.DOTALL)

            # Execute schema statements
            async with self._pool.acquire() as conn:
                async with conn.transaction():
                    # Split by semicolon and execute each non-empty statement
                    for statement in schema_sql.split(";"):
                        statement = statement.strip()
                        if statement:
                            try:
                                logger.debug(f"Executing: {statement[:80]}...")
                                await conn.execute(statement)
                            except asyncpg.exceptions.DuplicateObjectError:
                                # Index already exists, that's fine
                                logger.debug("Object already exists, skipping")
                            except asyncpg.exceptions.DuplicateTableError:
                                # Table already exists
                                logger.debug("Table already exists, skipping")

            # Verify table was created
            table_exists = await self._pool.fetchval(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'composite_bars')"
            )
            if not table_exists:
                logger.error("Schema executed but composite_bars table not found!")
                return False

            logger.info("Database schema initialized successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize schema: {e}")
            return False
