# Abacus Indexer Aggregator
# Composite calculation and persistence

"""
Aggregator module for computing composite bars.

Components:
- CompositeAggregator: Coordinates connectors, computes composites
- Persistence: Stores composite bars to TimescaleDB (TODO)
"""

from .composite_aggregator import CompositeAggregator, AggregatorConfig

__all__ = [
    "CompositeAggregator",
    "AggregatorConfig",
]
