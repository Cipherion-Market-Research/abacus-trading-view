#!/usr/bin/env python3
"""
Fetch price predictions from Ciphex API and convert to TradingView-compatible CSVs.

This script:
1. Fetches all assets from /v1/assets
2. For each asset, fetches the dashboard from /v2/assets/{id}/dashboard
3. Extracts predictions from blocks[].horizons[].prediction
4. Saves to CSV format compatible with TradingView's request.seed()

CSV Format Requirements for TradingView request.seed():
- First column MUST be 'time' as Unix timestamp in milliseconds
- Subsequent columns are data fields
- Filename (without .csv) is used as the symbol parameter

Prediction Structure:
- 3 blocks per asset (outlook, continuation, persistence)
- 5 horizons per block
- 15 total horizons covering a 24-hour cycle
- Horizons are either 'settled' (past) or 'pending' (future)
"""

import os
import sys
import json
import requests
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import asset mapping
from config import ASSET_MAP


def get_env_var(name: str) -> str:
    """Get required environment variable or exit."""
    value = os.environ.get(name)
    if not value:
        print(f"ERROR: Missing required environment variable: {name}")
        sys.exit(1)
    return value


def make_request(url: str, api_key: str) -> Optional[dict]:
    """
    Make an authenticated request to the Ciphex API.

    Args:
        url: Full URL to request
        api_key: API authentication key

    Returns:
        dict: Parsed JSON response or None on error
    """
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"  Request failed: {e}")
        return None


def parse_timestamp(ts: str) -> int:
    """
    Convert ISO timestamp to Unix milliseconds.

    Args:
        ts: ISO 8601 timestamp string

    Returns:
        int: Unix timestamp in milliseconds
    """
    # Handle various ISO formats
    ts = ts.replace('Z', '+00:00')
    dt = datetime.fromisoformat(ts)
    return int(dt.timestamp() * 1000)


def extract_predictions(dashboard: dict) -> list[dict]:
    """
    Extract all 15 horizon predictions from a dashboard response.

    Args:
        dashboard: Full dashboard API response

    Returns:
        list: List of prediction dicts with time, low, mid, high, status, block, horizon_index
    """
    predictions = []

    blocks = dashboard.get("blocks", [])

    for block in blocks:
        block_number = block.get("block_number", 0)
        block_type = block.get("block_type", "unknown")

        for horizon in block.get("horizons", []):
            pred = horizon.get("prediction", {})

            if not pred:
                continue

            predictions.append({
                "time": parse_timestamp(horizon["horizon_end_ts"]),
                "low": float(pred.get("low_range", 0)),
                "close": float(pred.get("mid_range", 0)),  # 'close' maps to TradingView's built-in
                "high": float(pred.get("high_range", 0)),
                "probability": float(pred.get("probability", 0)),
                "signal": pred.get("signal", ""),
                "direction": pred.get("direction", ""),
                "status": horizon.get("status", "unknown"),
                "block": block_number,
                "horizon_index": horizon.get("horizon_index", 0)
            })

    # Sort by time to ensure correct order
    predictions.sort(key=lambda x: x["time"])

    return predictions


def save_csv(predictions: list[dict], filepath: Path) -> None:
    """
    Save predictions to CSV in TradingView-compatible format.

    Args:
        predictions: List of prediction dicts
        filepath: Output path for CSV
    """
    filepath.parent.mkdir(parents=True, exist_ok=True)

    df = pd.DataFrame(predictions)

    # Column order - time must be first for TradingView
    # Using 'close' instead of 'mid' to match TradingView's built-in series name
    columns = ["time", "low", "close", "high", "probability", "signal", "direction", "status", "block", "horizon_index"]
    df = df[columns]

    df.to_csv(filepath, index=False)
    print(f"    Saved: {filepath}")


def save_metadata(output_dir: Path, assets_processed: int, cycle_info: dict) -> None:
    """
    Save metadata about the current fetch cycle.

    Args:
        output_dir: Base output directory
        assets_processed: Number of assets successfully processed
        cycle_info: Sample cycle info from one of the assets
    """
    metadata = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "assets_processed": assets_processed,
        "cycle_id": cycle_info.get("cycle_id", ""),
        "cycle_start": cycle_info.get("cycle_start", ""),
        "cycle_end": cycle_info.get("cycle_end", ""),
    }

    filepath = output_dir / "metadata.json"
    with open(filepath, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"    Saved: {filepath}")


def process_asset(asset_id: str, asset_config: dict, api_url: str, api_key: str, output_dir: Path) -> Optional[dict]:
    """
    Fetch and process predictions for a single asset.

    Args:
        asset_id: UUID of the asset
        asset_config: Config dict with tv_symbol and asset_type
        api_url: Base API URL
        api_key: API authentication key
        output_dir: Base output directory

    Returns:
        dict: Cycle info if successful, None otherwise
    """
    tv_symbol = asset_config["tv_symbol"]
    asset_type = asset_config["asset_type"]
    symbol = asset_config["symbol"]

    print(f"  Processing {symbol} -> {tv_symbol}...")

    # Fetch dashboard
    dashboard_url = f"{api_url}/v2/assets/{asset_id}/dashboard"
    dashboard = make_request(dashboard_url, api_key)

    if not dashboard:
        print(f"    Failed to fetch dashboard for {symbol}")
        return None

    # Extract predictions
    predictions = extract_predictions(dashboard)

    if not predictions:
        print(f"    No predictions found for {symbol}")
        return None

    print(f"    Found {len(predictions)} predictions")

    # Determine subdirectory based on asset type
    subdir = asset_type  # crypto, dex, or stock
    filepath = output_dir / subdir / f"{tv_symbol}_predictions.csv"

    # Save CSV
    save_csv(predictions, filepath)

    # Return cycle info
    return dashboard.get("cycle", {})


def main():
    """Main entry point."""
    print("=" * 60)
    print(f"Ciphex Prediction Fetch")
    print(f"Started: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    # Get configuration from environment
    api_url = get_env_var("API_URL").rstrip("/")
    api_key = get_env_var("API_KEY")

    # Output directory (relative to repo root)
    output_dir = Path(__file__).parent.parent / "data"

    print(f"\nAPI URL: {api_url}")
    print(f"Output: {output_dir}")
    print(f"Assets configured: {len(ASSET_MAP)}")

    # Process each asset from config
    assets_processed = 0
    last_cycle_info = {}

    print("\n" + "-" * 60)
    print("Fetching predictions for all assets...")
    print("-" * 60)

    for asset_id, asset_config in ASSET_MAP.items():
        cycle_info = process_asset(asset_id, asset_config, api_url, api_key, output_dir)

        if cycle_info:
            assets_processed += 1
            last_cycle_info = cycle_info

    # Save metadata
    print("\n" + "-" * 60)
    print("Saving metadata...")
    print("-" * 60)
    save_metadata(output_dir, assets_processed, last_cycle_info)

    print("\n" + "=" * 60)
    print(f"Completed: {assets_processed}/{len(ASSET_MAP)} assets processed")
    print(f"Finished: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    # Exit with error if no assets processed
    if assets_processed == 0:
        print("\nERROR: No assets were processed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
