# Ciphex Price Predictions TradingView Overlay

Automated pipeline that fetches price predictions from the Ciphex API and displays them as overlays on TradingView charts.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │     │                 │
│  Ciphex API     │────▶│  GitHub Actions │────▶│  GitHub Repo    │────▶│  TradingView    │
│  (predictions)  │     │  (every 30 min) │     │  (CSV storage)  │     │  Pine Script    │
│                 │     │                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Supported Assets

### Crypto (11)
ADA, ATOM, BNB, BTC, DOT, ETH, SOL, TON, TRX, XRP, ZEC

### DEX Tokens (2)
TRUMP, FARTCOIN

### Stocks & ETFs (18)
AAPL, AMZN, DIA, GOOG, GOOGL, IWM, META, MSFT, NVDA, QQQ, SPY, TSLA, XLE, XLF, XLI, XLK, XLP, XLV

## Setup

### 1. Fork/Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/abacus-trading-view.git
cd abacus-trading-view
```

### 2. Configure GitHub Secrets

Go to **Repository → Settings → Secrets and variables → Actions** and add:

| Secret Name | Description |
|-------------|-------------|
| `API_URL` | `https://api.ciphex.io` |
| `API_KEY` | Your Ciphex API key |

### 3. Enable GitHub Actions

The workflow runs automatically every 30 minutes. You can also trigger it manually:
- Go to **Actions → Fetch Price Predictions → Run workflow**

### 4. Add TradingView Indicator

1. Open TradingView and go to **Pine Editor**
2. Copy contents of `pinescript/predictions_overlay.pine`
3. Update `GITHUB_USER` to your GitHub username
4. Click **Add to Chart**

## Local Development

### Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r scripts/requirements.txt
```

### Configure Environment

```bash
cp .env.example .env
# Edit .env with your API credentials
```

### Run Locally

```bash
python scripts/fetch_predictions.py
```

## Data Format

Each asset generates a CSV file with the following structure:

```csv
time,low,mid,high,probability,signal,direction,status,block,horizon_index
1733443200000,97500.00,98000.00,98500.00,0.68,Favorable,Up,settled,1,0
1733448960000,97600.00,98100.00,98600.00,0.72,Certain,Up,pending,1,1
...
```

### Columns

| Column | Description |
|--------|-------------|
| `time` | Unix timestamp in milliseconds |
| `low` | Low price prediction |
| `mid` | Mid price prediction |
| `high` | High price prediction |
| `probability` | Prediction confidence (0-1) |
| `signal` | Signal strength (Favorable, Certain, etc.) |
| `direction` | Predicted direction (Up, Down, Neutral) |
| `status` | `settled` (past) or `pending` (future) |
| `block` | Block number (1=Outlook, 2=Continuation, 3=Persistence) |
| `horizon_index` | Index within block (0-4) |

## Prediction Cycle

- **15 horizons** per asset covering a 24-hour cycle
- **3 blocks**: Outlook (near-term), Continuation (mid-term), Persistence (long-term)
- **5 horizons per block**
- Predictions reforecast every 5-45 minutes
- After the 15th horizon settles, a new cycle begins

## Troubleshooting

### TradingView shows "No data"

1. Ensure repository is **public**
2. Check `GITHUB_USER` in Pine Script matches your username
3. Verify CSV files exist in `data/` directory
4. TradingView caches data - may take time to refresh

### GitHub Actions failing

1. Check secrets are configured correctly
2. Review Actions logs for API errors
3. Verify API key has access to required endpoints

### Symbol not found

The indicator maps TradingView symbols to CSV files:
- `BINANCE:BTCUSDT` → `data/crypto/btcusdt_predictions.csv`
- `NASDAQ:AAPL` → `data/stock/aapl_predictions.csv`

If your exchange uses different symbol formats, you may need to adjust the `getDataPath()` function in the Pine Script.
