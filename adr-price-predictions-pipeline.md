# ADR: Price Predictions TradingView Overlay Pipeline

## Status
**Proposed** | Date: 2025-12-06

## Context

We have a proprietary API that generates price predictions for 33 assets (13 crypto, 20 equities). The API produces 15 timestamped predictions over rolling 24-hour periods, with each prediction containing low, mid, and high price targets. We need to visualize these predictions as an overlay on TradingView charts.

### Current State
- Prediction API exists and returns JSON with price forecasts
- No visualization layer exists
- Traders must manually reference predictions outside of their charting workflow

### Desired State
- Predictions automatically overlay on TradingView charts
- Visual displays low/mid/high price bands connected across timestamps
- Updates automatically every 30 minutes
- Works across all 33 supported assets with automatic symbol detection

## Decision

Implement a GitHub-based data pipeline using GitHub Actions for scheduled fetching, CSV storage in a public repository, and TradingView's `request.seed()` function to pull data into Pine Script indicators.

### Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │     │                 │
│  Prediction     │────▶│  GitHub Actions │────▶│  GitHub Repo    │────▶│  TradingView    │
│  API            │     │  (every 30 min) │     │  (CSV storage)  │     │  Pine Script    │
│                 │     │                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Why This Approach

| Alternative | Reason Not Chosen |
|-------------|-------------------|
| TradingView Webhooks | Requires Premium subscription, more complex |
| Direct API from Pine | Pine Script cannot make arbitrary HTTP requests |
| Manual CSV upload | Not scalable, human error prone |
| Database + custom frontend | Over-engineered for this use case |

## Technical Specification

### 1. Repository Structure

```
price-predictions/
├── .github/
│   └── workflows/
│       └── fetch-predictions.yml
├── scripts/
│   ├── fetch_predictions.py
│   ├── requirements.txt
│   └── config.py
├── data/
│   ├── crypto/
│   │   ├── btcusd_predictions.csv
│   │   ├── ethusd_predictions.csv
│   │   └── ... (13 files)
│   ├── equities/
│   │   ├── spy_predictions.csv
│   │   ├── nvda_predictions.csv
│   │   └── ... (20 files)
│   └── metadata.csv
├── pinescript/
│   └── predictions_overlay.pine
└── README.md
```

### 2. API Contract

#### Expected API Request
```http
GET {API_URL}/predictions
Authorization: Bearer {API_KEY}
```

#### Expected API Response Schema
```json
{
  "cycle_id": "uuid",
  "cycle_start": "2025-12-06T00:00:00Z",
  "cycle_end": "2025-12-07T00:00:00Z",
  "generated_at": "2025-12-06T12:00:00Z",
  "assets": [
    {
      "uuid": "asset-uuid-here",
      "symbol": "BTC",
      "asset_type": "crypto",
      "predictions": [
        {
          "index": 0,
          "timestamp": "2025-12-06T00:00:00Z",
          "low": 97500.00,
          "mid": 98000.00,
          "high": 98500.00
        },
        {
          "index": 1,
          "timestamp": "2025-12-06T01:36:00Z",
          "low": 97600.00,
          "mid": 98100.00,
          "high": 98600.00
        }
        // ... 15 total predictions per asset
      ]
    }
    // ... 33 total assets
  ]
}
```

**Note to implementer**: If the actual API response differs from this schema, adapt the Python parsing logic accordingly. The critical requirement is extracting: asset identifier, timestamp, low, mid, high for each prediction.

### 3. Asset Mapping Configuration

```python
# scripts/config.py

ASSET_MAP = {
    # Crypto - Map API identifiers to TradingView symbols
    "uuid-btc": {"tv_symbol": "btcusd", "type": "crypto"},
    "uuid-eth": {"tv_symbol": "ethusd", "type": "crypto"},
    "uuid-sol": {"tv_symbol": "solusd", "type": "crypto"},
    "uuid-xrp": {"tv_symbol": "xrpusd", "type": "crypto"},
    "uuid-ada": {"tv_symbol": "adausd", "type": "crypto"},
    "uuid-avax": {"tv_symbol": "avaxusd", "type": "crypto"},
    "uuid-doge": {"tv_symbol": "dogeusd", "type": "crypto"},
    "uuid-dot": {"tv_symbol": "dotusd", "type": "crypto"},
    "uuid-matic": {"tv_symbol": "maticusd", "type": "crypto"},
    "uuid-link": {"tv_symbol": "linkusd", "type": "crypto"},
    "uuid-ltc": {"tv_symbol": "ltcusd", "type": "crypto"},
    "uuid-uni": {"tv_symbol": "uniusd", "type": "crypto"},
    "uuid-atom": {"tv_symbol": "atomusd", "type": "crypto"},
    
    # Equities - Map API identifiers to TradingView symbols
    "uuid-spy": {"tv_symbol": "spy", "type": "equity"},
    "uuid-qqq": {"tv_symbol": "qqq", "type": "equity"},
    "uuid-nvda": {"tv_symbol": "nvda", "type": "equity"},
    "uuid-aapl": {"tv_symbol": "aapl", "type": "equity"},
    "uuid-msft": {"tv_symbol": "msft", "type": "equity"},
    "uuid-googl": {"tv_symbol": "googl", "type": "equity"},
    "uuid-amzn": {"tv_symbol": "amzn", "type": "equity"},
    "uuid-meta": {"tv_symbol": "meta", "type": "equity"},
    "uuid-tsla": {"tv_symbol": "tsla", "type": "equity"},
    "uuid-amd": {"tv_symbol": "amd", "type": "equity"},
    "uuid-intc": {"tv_symbol": "intc", "type": "equity"},
    "uuid-crm": {"tv_symbol": "crm", "type": "equity"},
    "uuid-nflx": {"tv_symbol": "nflx", "type": "equity"},
    "uuid-dis": {"tv_symbol": "dis", "type": "equity"},
    "uuid-v": {"tv_symbol": "v", "type": "equity"},
    "uuid-jpm": {"tv_symbol": "jpm", "type": "equity"},
    "uuid-wmt": {"tv_symbol": "wmt", "type": "equity"},
    "uuid-ko": {"tv_symbol": "ko", "type": "equity"},
    "uuid-pfe": {"tv_symbol": "pfe", "type": "equity"},
    "uuid-xom": {"tv_symbol": "xom", "type": "equity"},
}

# Reverse lookup: TradingView symbol -> API UUID
TV_TO_UUID = {v["tv_symbol"]: k for k, v in ASSET_MAP.items()}
```

**Note to implementer**: Replace placeholder UUIDs with actual API identifiers once known.

### 4. GitHub Actions Workflow

```yaml
# .github/workflows/fetch-predictions.yml

name: Fetch Price Predictions

on:
  schedule:
    # Run every 30 minutes
    - cron: '0,30 * * * *'
  workflow_dispatch:
    # Allow manual trigger for testing

jobs:
  fetch-and-commit:
    runs-on: ubuntu-latest
    
    permissions:
      contents: write
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Cache pip dependencies
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('scripts/requirements.txt') }}
          restore-keys: |
            ${{ runner.os }}-pip-
      
      - name: Install dependencies
        run: pip install -r scripts/requirements.txt
      
      - name: Fetch predictions from API
        env:
          API_URL: ${{ secrets.PREDICTIONS_API_URL }}
          API_KEY: ${{ secrets.PREDICTIONS_API_KEY }}
        run: python scripts/fetch_predictions.py
      
      - name: Commit and push changes
        run: |
          git config --local user.email "github-actions[bot]@users.noreply.github.com"
          git config --local user.name "github-actions[bot]"
          git add data/
          
          # Only commit if there are changes
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            git commit -m "Update predictions $(date -u +'%Y-%m-%d %H:%M UTC')"
            git push
          fi
```

### 5. Python Fetch Script

```python
# scripts/fetch_predictions.py

"""
Fetch price predictions from API and convert to TradingView-compatible CSVs.

CSV Format Requirements for TradingView request.seed():
- First column MUST be 'time' as Unix timestamp in milliseconds
- Subsequent columns are data fields
- File must be in repo root or subdirectory
- Filename (without .csv) is used as the symbol parameter
"""

import os
import sys
import json
import requests
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Import asset mapping
from config import ASSET_MAP


def get_env_var(name: str) -> str:
    """Get required environment variable or exit."""
    value = os.environ.get(name)
    if not value:
        print(f"ERROR: Missing required environment variable: {name}")
        sys.exit(1)
    return value


def fetch_predictions(api_url: str, api_key: str) -> dict:
    """
    Fetch predictions from the API.
    
    Args:
        api_url: Base URL for the predictions API
        api_key: API authentication key
        
    Returns:
        dict: Parsed JSON response
        
    Raises:
        requests.RequestException: On API errors
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "PredictionsPipeline/1.0"
    }
    
    print(f"Fetching predictions from API...")
    response = requests.get(api_url, headers=headers, timeout=30)
    response.raise_for_status()
    
    data = response.json()
    print(f"Received data for {len(data.get('assets', []))} assets")
    
    return data


def parse_timestamp(ts) -> int:
    """
    Convert various timestamp formats to Unix milliseconds.
    
    Args:
        ts: Timestamp as ISO string, Unix seconds, or Unix milliseconds
        
    Returns:
        int: Unix timestamp in milliseconds
    """
    if isinstance(ts, str):
        # ISO 8601 string
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        return int(dt.timestamp() * 1000)
    elif isinstance(ts, (int, float)):
        # Already numeric - check if seconds or milliseconds
        if ts < 1e12:
            # Unix seconds
            return int(ts * 1000)
        else:
            # Unix milliseconds
            return int(ts)
    else:
        raise ValueError(f"Unknown timestamp format: {ts}")


def transform_asset_predictions(asset: dict) -> Optional[pd.DataFrame]:
    """
    Transform a single asset's predictions to DataFrame.
    
    Args:
        asset: Asset dict from API response
        
    Returns:
        DataFrame with columns: time, low, mid, high, prediction_index
        None if asset not in mapping
    """
    asset_id = asset.get("uuid") or asset.get("id") or asset.get("asset_id")
    
    if asset_id not in ASSET_MAP:
        print(f"  Skipping unknown asset: {asset_id}")
        return None
    
    asset_config = ASSET_MAP[asset_id]
    predictions = asset.get("predictions", [])
    
    if not predictions:
        print(f"  No predictions for {asset_config['tv_symbol']}")
        return None
    
    rows = []
    for pred in predictions:
        rows.append({
            "time": parse_timestamp(pred["timestamp"]),
            "low": float(pred["low"]),
            "mid": float(pred["mid"]),
            "high": float(pred["high"]),
            "prediction_index": int(pred.get("index", 0))
        })
    
    df = pd.DataFrame(rows)
    df = df.sort_values("time").reset_index(drop=True)
    
    return df


def save_csv(df: pd.DataFrame, filepath: Path) -> None:
    """
    Save DataFrame to CSV in TradingView-compatible format.
    
    Args:
        df: DataFrame with prediction data
        filepath: Output path for CSV
    """
    # Ensure directory exists
    filepath.parent.mkdir(parents=True, exist_ok=True)
    
    # Column order matters - time must be first
    columns = ["time", "low", "mid", "high", "prediction_index"]
    df = df[columns]
    
    # Save without index
    df.to_csv(filepath, index=False)
    print(f"  Saved: {filepath}")


def save_metadata(data: dict, output_dir: Path) -> None:
    """
    Save metadata about the current prediction cycle.
    
    Args:
        data: Full API response
        output_dir: Base output directory
    """
    metadata = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "cycle_id": data.get("cycle_id", ""),
        "cycle_start": data.get("cycle_start", ""),
        "cycle_end": data.get("cycle_end", ""),
        "generated_at": data.get("generated_at", ""),
        "num_assets": len(data.get("assets", [])),
        "predictions_per_asset": 15
    }
    
    filepath = output_dir / "metadata.csv"
    pd.DataFrame([metadata]).to_csv(filepath, index=False)
    print(f"  Saved: {filepath}")


def main():
    """Main entry point."""
    print(f"=" * 60)
    print(f"Prediction Fetch Started: {datetime.now(timezone.utc).isoformat()}")
    print(f"=" * 60)
    
    # Get configuration from environment
    api_url = get_env_var("API_URL")
    api_key = get_env_var("API_KEY")
    
    # Output directory (relative to repo root)
    output_dir = Path(__file__).parent.parent / "data"
    
    try:
        # Fetch from API
        data = fetch_predictions(api_url, api_key)
        
        # Process each asset
        assets_processed = 0
        for asset in data.get("assets", []):
            asset_id = asset.get("uuid") or asset.get("id") or asset.get("asset_id")
            
            if asset_id not in ASSET_MAP:
                continue
                
            asset_config = ASSET_MAP[asset_id]
            tv_symbol = asset_config["tv_symbol"]
            asset_type = asset_config["type"]
            
            print(f"Processing {tv_symbol}...")
            
            df = transform_asset_predictions(asset)
            if df is not None:
                # Save to type-specific subdirectory
                subdir = "crypto" if asset_type == "crypto" else "equities"
                filepath = output_dir / subdir / f"{tv_symbol}_predictions.csv"
                save_csv(df, filepath)
                assets_processed += 1
        
        # Save metadata
        save_metadata(data, output_dir)
        
        print(f"=" * 60)
        print(f"Completed: {assets_processed} assets processed")
        print(f"=" * 60)
        
    except requests.RequestException as e:
        print(f"API Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        raise


if __name__ == "__main__":
    main()
```

### 6. Requirements File

```text
# scripts/requirements.txt

requests>=2.31.0
pandas>=2.0.0
```

### 7. Pine Script Indicator

```pinescript
// pinescript/predictions_overlay.pine

//@version=5
indicator("Price Predictions Overlay", overlay=true, max_lines_count=500, max_labels_count=500)

// ============================================================================
// CONFIGURATION
// ============================================================================

// IMPORTANT: Update this to your GitHub username/repo
GITHUB_USER = "YOUR_GITHUB_USERNAME"
GITHUB_REPO = "price-predictions"
GITHUB_SOURCE = GITHUB_USER + "/" + GITHUB_REPO

// ============================================================================
// INPUTS
// ============================================================================

i_showBands      = input.bool(true, "Show Prediction Bands", group="Display")
i_showMidLine    = input.bool(true, "Show Mid Line", group="Display")
i_showLabels     = input.bool(true, "Show Price Labels", group="Display")
i_showInfoTable  = input.bool(true, "Show Info Table", group="Display")

i_highColor      = input.color(color.new(#00C853, 20), "High Prediction", group="Colors")
i_midColor       = input.color(color.new(#FFD600, 20), "Mid Prediction", group="Colors")
i_lowColor       = input.color(color.new(#FF5252, 20), "Low Prediction", group="Colors")
i_fillColor      = input.color(color.new(#2196F3, 85), "Band Fill", group="Colors")

i_lineWidth      = input.int(2, "Line Width", minval=1, maxval=4, group="Style")
i_labelSize      = input.string("small", "Label Size", options=["tiny", "small", "normal"], group="Style")

// ============================================================================
// SYMBOL DETECTION
// ============================================================================

// Determine which CSV file to load based on current chart symbol
getDataSymbol() =>
    // Get base ticker without exchange prefix
    sym = str.lower(syminfo.ticker)
    
    // Handle "EXCHANGE:SYMBOL" format
    if str.contains(sym, ":")
        parts = str.split(sym, ":")
        sym := array.get(parts, 1)
    
    // Normalize common variations
    // BTCUSDT -> btcusd, BTCUSD.P -> btcusd
    sym := str.replace_all(sym, "usdt", "usd")
    sym := str.replace_all(sym, ".p", "")
    sym := str.replace_all(sym, "perp", "")
    
    // Handle specific exchange symbol mappings
    if sym == "xbtusd"
        sym := "btcusd"
    
    // Determine subdirectory based on asset type
    // Crypto pairs typically end in "usd" and are longer
    isCrypto = str.endswith(sym, "usd") and str.length(sym) > 4
    
    subdir = isCrypto ? "crypto" : "equities"
    
    // Return full path: "crypto/btcusd_predictions" or "equities/spy_predictions"
    subdir + "/" + sym + "_predictions"

DATA_SYMBOL = getDataSymbol()

// ============================================================================
// DATA LOADING VIA request.seed()
// ============================================================================

// request.seed() parameters:
// - source: "github_user/repo_name"
// - symbol: path to CSV file (without .csv extension)
// - expression: tuple of column references matching CSV structure
//
// CSV columns: time, low, mid, high, prediction_index
// The 'time' column is handled automatically by TradingView

[predLow, predMid, predHigh, predIndex] = request.seed(
    GITHUB_SOURCE, 
    DATA_SYMBOL, 
    [low, mid, high, prediction_index]
)

// Check if we have valid data
hasData = not na(predLow) and not na(predMid) and not na(predHigh)

// ============================================================================
// STATE VARIABLES
// ============================================================================

var line[] highLines = array.new_line()
var line[] midLines = array.new_line()
var line[] lowLines = array.new_line()
var label[] predLabels = array.new_label()
var linefill[] bandFills = array.new_linefill()

// Previous values for drawing connecting lines
var float prevHigh = na
var float prevMid = na
var float prevLow = na
var int prevBarTime = na

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

getLabelSize() =>
    switch i_labelSize
        "tiny" => size.tiny
        "small" => size.small
        "normal" => size.normal

drawPredictionLines(int t1, float h1, float m1, float l1, int t2, float h2, float m2, float l2) =>
    // High line
    lineHigh = line.new(
        x1=t1, y1=h1, x2=t2, y2=h2,
        xloc=xloc.bar_time,
        color=i_highColor,
        width=i_lineWidth,
        style=line.style_solid
    )
    array.push(highLines, lineHigh)
    
    // Mid line
    if i_showMidLine
        lineMid = line.new(
            x1=t1, y1=m1, x2=t2, y2=m2,
            xloc=xloc.bar_time,
            color=i_midColor,
            width=i_lineWidth,
            style=line.style_dashed
        )
        array.push(midLines, lineMid)
    
    // Low line
    lineLow = line.new(
        x1=t1, y1=l1, x2=t2, y2=l2,
        xloc=xloc.bar_time,
        color=i_lowColor,
        width=i_lineWidth,
        style=line.style_solid
    )
    array.push(lowLines, lineLow)
    
    // Fill between high and low
    if i_showBands
        fill = linefill.new(lineHigh, lineLow, color=i_fillColor)
        array.push(bandFills, fill)

drawPriceLabel(int barTime, float price, color col, string txt) =>
    lbl = label.new(
        x=barTime, 
        y=price,
        text=txt + ": " + str.tostring(price, format.mintick),
        xloc=xloc.bar_time,
        color=color.new(col, 80),
        textcolor=col,
        style=label.style_label_left,
        size=getLabelSize()
    )
    array.push(predLabels, lbl)

// ============================================================================
// MAIN LOGIC
// ============================================================================

if hasData
    currentBarTime = time
    
    // Draw connecting lines from previous point
    if not na(prevHigh) and not na(prevBarTime)
        drawPredictionLines(
            prevBarTime, prevHigh, prevMid, prevLow,
            currentBarTime, predHigh, predMid, predLow
        )
    
    // Draw labels at current prediction point (only on last prediction)
    if i_showLabels and barstate.islast
        drawPriceLabel(currentBarTime, predHigh, i_highColor, "H")
        drawPriceLabel(currentBarTime, predMid, i_midColor, "M")
        drawPriceLabel(currentBarTime, predLow, i_lowColor, "L")
    
    // Update previous values
    prevHigh := predHigh
    prevMid := predMid
    prevLow := predLow
    prevBarTime := currentBarTime

// ============================================================================
// ARRAY CLEANUP (prevent memory issues)
// ============================================================================

maxElements = 100

if array.size(highLines) > maxElements
    line.delete(array.shift(highLines))
if array.size(midLines) > maxElements
    line.delete(array.shift(midLines))
if array.size(lowLines) > maxElements
    line.delete(array.shift(lowLines))
if array.size(predLabels) > maxElements
    label.delete(array.shift(predLabels))
if array.size(bandFills) > maxElements
    linefill.delete(array.shift(bandFills))

// ============================================================================
// INFO TABLE
// ============================================================================

if i_showInfoTable
    var table infoTable = table.new(
        position.top_right, 
        2, 5, 
        bgcolor=color.new(color.black, 70),
        border_width=1,
        border_color=color.gray
    )
    
    if barstate.islast
        // Header
        table.cell(infoTable, 0, 0, "Prediction", text_color=color.white, text_size=size.small)
        table.cell(infoTable, 1, 0, "Price", text_color=color.white, text_size=size.small)
        
        if hasData
            // High
            table.cell(infoTable, 0, 1, "High", text_color=i_highColor, text_size=size.small)
            table.cell(infoTable, 1, 1, str.tostring(predHigh, format.mintick), text_color=i_highColor, text_size=size.small)
            
            // Mid
            table.cell(infoTable, 0, 2, "Mid", text_color=i_midColor, text_size=size.small)
            table.cell(infoTable, 1, 2, str.tostring(predMid, format.mintick), text_color=i_midColor, text_size=size.small)
            
            // Low
            table.cell(infoTable, 0, 3, "Low", text_color=i_lowColor, text_size=size.small)
            table.cell(infoTable, 1, 3, str.tostring(predLow, format.mintick), text_color=i_lowColor, text_size=size.small)
            
            // Index
            table.cell(infoTable, 0, 4, "Index", text_color=color.gray, text_size=size.tiny)
            table.cell(infoTable, 1, 4, str.tostring(predIndex) + "/15", text_color=color.gray, text_size=size.tiny)
        else
            table.cell(infoTable, 0, 1, "No data", text_color=color.gray, text_size=size.small)
            table.cell(infoTable, 1, 1, syminfo.ticker, text_color=color.gray, text_size=size.small)

// ============================================================================
// NO DATA WARNING
// ============================================================================

if barstate.islast and not hasData
    label.new(
        x=bar_index,
        y=close,
        text="⚠ No predictions for " + syminfo.ticker,
        color=color.new(color.orange, 20),
        textcolor=color.white,
        style=label.style_label_left,
        size=size.normal
    )
```

### 8. CSV Output Format

Each asset CSV must follow this exact structure for `request.seed()` compatibility:

```csv
time,low,mid,high,prediction_index
1733443200000,97500.00,98000.00,98500.00,0
1733448960000,97600.00,98100.00,98600.00,1
1733454720000,97700.00,98200.00,98700.00,2
...
```

**Critical requirements:**
- `time` column MUST be first
- `time` values MUST be Unix timestamps in milliseconds
- No index column
- No extra whitespace
- UTF-8 encoding

### 9. Environment Variables / GitHub Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `PREDICTIONS_API_URL` | Full URL to predictions endpoint | `https://api.example.com/v1/predictions` |
| `PREDICTIONS_API_KEY` | API authentication token | `sk_live_abc123...` |

Setup location: Repository → Settings → Secrets and variables → Actions → New repository secret

## Implementation Checklist

### Phase 1: Repository Setup
- [ ] Create new public GitHub repository
- [ ] Create directory structure as specified
- [ ] Add `.gitignore` for Python artifacts
- [ ] Configure GitHub Secrets

### Phase 2: Python Pipeline
- [ ] Implement `config.py` with actual asset UUIDs
- [ ] Implement `fetch_predictions.py`
- [ ] Add `requirements.txt`
- [ ] Test locally with API credentials
- [ ] Verify CSV output format

### Phase 3: GitHub Actions
- [ ] Create workflow YAML
- [ ] Test manual trigger (workflow_dispatch)
- [ ] Verify scheduled runs work
- [ ] Confirm commits are being pushed

### Phase 4: Pine Script
- [ ] Update GITHUB_USER constant
- [ ] Add indicator to TradingView
- [ ] Test on crypto asset (e.g., BTCUSD)
- [ ] Test on equity asset (e.g., SPY)
- [ ] Verify automatic symbol detection

### Phase 5: Validation
- [ ] Confirm data refreshes every 30 minutes
- [ ] Test across multiple TradingView sessions
- [ ] Verify all 33 assets load correctly
- [ ] Document any symbol mapping issues

## Error Handling

### API Failures
- Script exits with non-zero code
- GitHub Actions marks run as failed
- Previous CSV data remains (not overwritten)
- Can set up GitHub notifications for failed runs

### Missing Assets
- Unknown asset UUIDs are logged and skipped
- Processing continues for known assets
- Metadata tracks number of assets processed

### TradingView Data Not Loading
- Check repository is public
- Verify CSV filename matches symbol
- Check `request.seed()` source path
- TradingView caches data - may take time to refresh

## Future Considerations

1. **Historical data**: Archive previous prediction cycles for backtesting
2. **Accuracy tracking**: Compare predictions vs actual prices
3. **Alerts**: Pine Script alerts when price approaches prediction levels
4. **Multi-timeframe**: Support different prediction windows (12h, 48h)
5. **Confidence intervals**: Add prediction confidence scores if available

## References

- [TradingView request.seed() Documentation](https://www.tradingview.com/pine-script-reference/v5/#fun_request.seed)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Pine Script Language Reference](https://www.tradingview.com/pine-script-reference/v5/)
