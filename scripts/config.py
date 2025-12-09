"""
Asset configuration mapping Ciphex API UUIDs to TradingView symbols.

Each asset is identified by its UUID in the API and must be mapped to:
- tv_symbol: The symbol used in TradingView (lowercase, no special chars)
- asset_type: Category for organizing CSV output (crypto, stock, dex)
"""

# Map API UUIDs to TradingView symbols and asset types
ASSET_MAP = {
    # CEX Crypto (11 assets)
    "6eaaf1e9-079e-452f-a193-5d08347276b1": {"tv_symbol": "adausdt", "asset_type": "crypto", "symbol": "ADA/USDT"},
    "b1bfc010-94aa-46ab-970a-474eacfb3cca": {"tv_symbol": "atomusdt", "asset_type": "crypto", "symbol": "ATOM/USDT"},
    "ec972bb7-7912-4808-929a-d2d1356fc65e": {"tv_symbol": "bnbusdt", "asset_type": "crypto", "symbol": "BNB/USDT"},
    "5d9a8088-6bcc-4956-9535-1175091fa9e2": {"tv_symbol": "btcusdt", "asset_type": "crypto", "symbol": "BTC/USDT"},
    "df3fdfb1-5522-4569-a437-d4a03f81fa3d": {"tv_symbol": "dotusdt", "asset_type": "crypto", "symbol": "DOT/USDT"},
    "f7114ef2-077d-450d-be53-e45d2b7abb38": {"tv_symbol": "ethusdt", "asset_type": "crypto", "symbol": "ETH/USDT"},
    "b957624a-b741-491a-8843-d3fb066116a4": {"tv_symbol": "solusdt", "asset_type": "crypto", "symbol": "SOL/USDT"},
    "f2362093-b5f6-45a1-96ad-f7953711369e": {"tv_symbol": "tonusdt", "asset_type": "crypto", "symbol": "TON/USDT"},
    "0fc7ccce-d076-434c-ad90-94952eba437d": {"tv_symbol": "trxusdt", "asset_type": "crypto", "symbol": "TRX/USDT"},
    "feb17d4e-a8d5-4e8f-8ec7-1c90e66989c3": {"tv_symbol": "xrpusdt", "asset_type": "crypto", "symbol": "XRP/USDT"},
    "6db93b59-9dad-463c-9300-504b7e502f4a": {"tv_symbol": "zecusdt", "asset_type": "crypto", "symbol": "ZEC/USDT"},

    # DEX Tokens (2 assets)
    "422a0e5a-cc7f-4394-b7c9-dcdc9947df95": {"tv_symbol": "trumpusd", "asset_type": "dex", "symbol": "TRUMP"},
    "310d32b6-8e25-44f8-996f-bf0b1192fe16": {"tv_symbol": "fabortusd", "asset_type": "dex", "symbol": "FARTCOIN"},

    # Stocks & ETFs (18 assets)
    "bc0c573c-976e-45d9-b6e8-b2e2c04fadc2": {"tv_symbol": "aapl", "asset_type": "stock", "symbol": "AAPL"},
    "42c21c74-b7d6-410f-a3e1-8b2e1ab3ab07": {"tv_symbol": "amzn", "asset_type": "stock", "symbol": "AMZN"},
    "4abab537-d868-4dba-90af-1af3d17b174d": {"tv_symbol": "dia", "asset_type": "stock", "symbol": "DIA"},
    "9d860abf-b4d7-49a3-86f9-2ca1c08bd225": {"tv_symbol": "goog", "asset_type": "stock", "symbol": "GOOG"},
    "e21ccaf5-c182-4b05-9c46-dd0d1ad5fa2e": {"tv_symbol": "googl", "asset_type": "stock", "symbol": "GOOGL"},
    "18c90ae6-48a8-499c-a27a-71c57e8f48ca": {"tv_symbol": "iwm", "asset_type": "stock", "symbol": "IWM"},
    "2ead698c-9469-4d5d-9a37-4a6bb40e14cf": {"tv_symbol": "meta", "asset_type": "stock", "symbol": "META"},
    "3bce27cf-1bc6-4fd2-8941-ce93ae2c1d8c": {"tv_symbol": "msft", "asset_type": "stock", "symbol": "MSFT"},
    "bfa3477f-2e55-4708-a050-935f97ba8732": {"tv_symbol": "nvda", "asset_type": "stock", "symbol": "NVDA"},
    "f1383a5b-ca43-4000-8981-ce514ebd1372": {"tv_symbol": "qqq", "asset_type": "stock", "symbol": "QQQ"},
    "f5bd9c14-eedb-47bd-9a7c-b6c4fce0c323": {"tv_symbol": "spy", "asset_type": "stock", "symbol": "SPY"},
    "06d0eb31-c195-4694-b1b7-62bb1b2e6853": {"tv_symbol": "tsla", "asset_type": "stock", "symbol": "TSLA"},
    "02daafa0-52af-4cca-9838-dddb0f7a8258": {"tv_symbol": "xle", "asset_type": "stock", "symbol": "XLE"},
    "c2425baf-6cbd-457a-b190-67260ed85408": {"tv_symbol": "xlf", "asset_type": "stock", "symbol": "XLF"},
    "a7ba8921-98a5-4594-960e-3b1d963171ae": {"tv_symbol": "xli", "asset_type": "stock", "symbol": "XLI"},
    "c0288a4b-cef3-41c7-b1ce-d79de9ee579b": {"tv_symbol": "xlk", "asset_type": "stock", "symbol": "XLK"},
    "ccb3f930-1fb1-4e4e-bc20-7e9022837148": {"tv_symbol": "xlp", "asset_type": "stock", "symbol": "XLP"},
    "44c9ac4a-2822-4399-8039-05b84a478919": {"tv_symbol": "xlv", "asset_type": "stock", "symbol": "XLV"},
}

# Reverse lookup: TradingView symbol -> API UUID
TV_TO_UUID = {v["tv_symbol"]: k for k, v in ASSET_MAP.items()}

# Group assets by type for easier iteration
CRYPTO_ASSETS = {k: v for k, v in ASSET_MAP.items() if v["asset_type"] == "crypto"}
DEX_ASSETS = {k: v for k, v in ASSET_MAP.items() if v["asset_type"] == "dex"}
STOCK_ASSETS = {k: v for k, v in ASSET_MAP.items() if v["asset_type"] == "stock"}
