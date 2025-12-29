'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Header } from '@/components/header/Header';
import { MobileHeader } from '@/components/header/MobileHeader';
import { PriceChart } from '@/components/chart/PriceChart';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { SidebarContent } from '@/components/sidebar/SidebarContent';
import { BottomSheet, SheetState } from '@/components/mobile/BottomSheet';
import { MobileMenu } from '@/components/mobile/MobileMenu';
import { usePredictions, usePriceData, useHTXPrice, useCoinbasePrice, useGeminiPrice, useCryptoComPrice, useKrakenPrice, useBitstampPrice, useBitfinexPrice, useCompositeIndex } from '@/hooks';
import { DEFAULT_ASSET_ID, getAssetById } from '@/config/assets';
import { isExchangeSupported, isIndexAvailable, getKrakenSymbol } from '@/config/exchangeSupport';
import { Interval, extractBaseSymbol } from '@/types';

export default function Dashboard() {
  const [selectedAssetId, setSelectedAssetId] = useState(DEFAULT_ASSET_ID);
  const [selectedInterval, setSelectedInterval] = useState<Interval>('15m');
  const [chartRefreshKey, setChartRefreshKey] = useState(0);

  // Mobile UI state
  const [sheetState, setSheetState] = useState<SheetState>('collapsed');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const prevPriceRef = useRef<number | undefined>(undefined);

  const selectedAsset = getAssetById(selectedAssetId);

  const {
    predictions,
    loading: predictionsLoading,
    error: predictionsError,
    refresh: refreshPredictions,
  } = usePredictions({ assetId: selectedAssetId });

  const {
    candles,
    dailyCandles,
    loading: pricesLoading,
    error: pricesError,
    refresh: refreshPrices,
    streaming,
  } = usePriceData({
    symbol: selectedAsset?.binanceSymbol || selectedAsset?.databentoSymbol || '',
    interval: selectedInterval,
    assetType: selectedAsset?.type || 'crypto',
    enableStreaming: true,
  });

  // Extract base symbol for exchange lookups (e.g., 'BTC/USDT' -> 'BTC')
  const baseSymbol = useMemo(() => {
    if (!selectedAsset?.symbol) return '';
    return extractBaseSymbol(selectedAsset.symbol);
  }, [selectedAsset?.symbol]);

  // Exchange price data hooks (for comparison overlays)
  const isCrypto = selectedAsset?.type === 'crypto';

  // Compute exchange support flags for current asset
  const exchangeSupport = useMemo(() => ({
    htx: isCrypto && isExchangeSupported(baseSymbol, 'htx'),
    coinbase: isCrypto && isExchangeSupported(baseSymbol, 'coinbase'),
    gemini: isCrypto && isExchangeSupported(baseSymbol, 'gemini'),
    kraken: isCrypto && isExchangeSupported(baseSymbol, 'kraken'),
    bitstamp: isCrypto && isExchangeSupported(baseSymbol, 'bitstamp'),
    bitfinex: isCrypto && isExchangeSupported(baseSymbol, 'bitfinex'),
    crypto_com_usd: isCrypto && isExchangeSupported(baseSymbol, 'crypto_com_usd'),
    crypto_com_usdt: isCrypto && isExchangeSupported(baseSymbol, 'crypto_com_usdt'),
    index: isCrypto && isIndexAvailable(baseSymbol),
  }), [baseSymbol, isCrypto]);

  // Kraken uses XBT for Bitcoin
  const krakenSymbol = useMemo(() => getKrakenSymbol(baseSymbol), [baseSymbol]);

  const {
    priceHistory: htxPriceHistory,
    currentPrice: htxCurrentPrice,
    connected: htxConnected,
  } = useHTXPrice({
    symbol: baseSymbol,
    interval: selectedInterval,
    enabled: exchangeSupport.htx,
  });

  const {
    priceHistory: coinbasePriceHistory,
    currentPrice: coinbaseCurrentPrice,
    connected: coinbaseConnected,
  } = useCoinbasePrice({
    symbol: baseSymbol,
    interval: selectedInterval,
    enabled: exchangeSupport.coinbase,
  });

  const {
    priceHistory: geminiPriceHistory,
    currentPrice: geminiCurrentPrice,
    connected: geminiConnected,
  } = useGeminiPrice({
    symbol: baseSymbol,
    interval: selectedInterval,
    enabled: exchangeSupport.gemini,
  });

  const {
    priceHistory: cryptoComUsdPriceHistory,
    currentPrice: cryptoComUsdCurrentPrice,
    connected: cryptoComUsdConnected,
  } = useCryptoComPrice({
    symbol: baseSymbol,
    interval: selectedInterval,
    quoteCurrency: 'USD',
    enabled: exchangeSupport.crypto_com_usd,
  });

  const {
    priceHistory: cryptoComUsdtPriceHistory,
    currentPrice: cryptoComUsdtCurrentPrice,
    connected: cryptoComUsdtConnected,
  } = useCryptoComPrice({
    symbol: baseSymbol,
    interval: selectedInterval,
    quoteCurrency: 'USDT',
    enabled: exchangeSupport.crypto_com_usdt,
  });

  const {
    priceHistory: krakenPriceHistory,
    currentPrice: krakenCurrentPrice,
    connected: krakenConnected,
  } = useKrakenPrice({
    symbol: krakenSymbol, // Uses XBT for BTC
    interval: selectedInterval,
    enabled: exchangeSupport.kraken,
  });

  const {
    priceHistory: bitstampPriceHistory,
    currentPrice: bitstampCurrentPrice,
    connected: bitstampConnected,
  } = useBitstampPrice({
    symbol: baseSymbol,
    interval: selectedInterval,
    enabled: exchangeSupport.bitstamp,
  });

  const {
    priceHistory: bitfinexPriceHistory,
    currentPrice: bitfinexCurrentPrice,
    connected: bitfinexConnected,
  } = useBitfinexPrice({
    symbol: baseSymbol,
    interval: selectedInterval,
    enabled: exchangeSupport.bitfinex,
  });

  // Composite Index: TradingView INDEX:BTCUSD formula
  // (BITSTAMP:BTCUSD + COINBASE:BTCUSD + BITFINEX:BTCUSD + KRAKEN:BTCUSD) / 4
  const {
    priceHistory: compositeIndexHistory,
    currentPrice: compositeIndexPrice,
    connectedCount: compositeConnectedCount,
  } = useCompositeIndex({
    bitstamp: {
      priceHistory: bitstampPriceHistory,
      currentPrice: bitstampCurrentPrice,
      connected: bitstampConnected,
    },
    coinbase: {
      priceHistory: coinbasePriceHistory,
      currentPrice: coinbaseCurrentPrice,
      connected: coinbaseConnected,
    },
    bitfinex: {
      priceHistory: bitfinexPriceHistory,
      currentPrice: bitfinexCurrentPrice,
      connected: bitfinexConnected,
    },
    kraken: {
      priceHistory: krakenPriceHistory,
      currentPrice: krakenCurrentPrice,
      connected: krakenConnected,
    },
    enabled: exchangeSupport.index,
  });

  // Combine exchange data for chart
  const exchangeData = useMemo(() => ({
    // Exchange support flags for conditional rendering
    support: exchangeSupport,
    composite_index: {
      priceHistory: compositeIndexHistory,
      currentPrice: compositeIndexPrice,
      connected: compositeConnectedCount >= 2, // Consider connected if at least 2 sources
      connectedCount: compositeConnectedCount,
    },
    htx: {
      priceHistory: htxPriceHistory,
      currentPrice: htxCurrentPrice,
      connected: htxConnected,
    },
    coinbase: {
      priceHistory: coinbasePriceHistory,
      currentPrice: coinbaseCurrentPrice,
      connected: coinbaseConnected,
    },
    gemini: {
      priceHistory: geminiPriceHistory,
      currentPrice: geminiCurrentPrice,
      connected: geminiConnected,
    },
    kraken: {
      priceHistory: krakenPriceHistory,
      currentPrice: krakenCurrentPrice,
      connected: krakenConnected,
    },
    bitstamp: {
      priceHistory: bitstampPriceHistory,
      currentPrice: bitstampCurrentPrice,
      connected: bitstampConnected,
    },
    bitfinex: {
      priceHistory: bitfinexPriceHistory,
      currentPrice: bitfinexCurrentPrice,
      connected: bitfinexConnected,
    },
    crypto_com_usd: {
      priceHistory: cryptoComUsdPriceHistory,
      currentPrice: cryptoComUsdCurrentPrice,
      connected: cryptoComUsdConnected,
    },
    crypto_com_usdt: {
      priceHistory: cryptoComUsdtPriceHistory,
      currentPrice: cryptoComUsdtCurrentPrice,
      connected: cryptoComUsdtConnected,
    },
  }), [
    exchangeSupport,
    compositeIndexHistory, compositeIndexPrice, compositeConnectedCount,
    htxPriceHistory, htxCurrentPrice, htxConnected,
    coinbasePriceHistory, coinbaseCurrentPrice, coinbaseConnected,
    geminiPriceHistory, geminiCurrentPrice, geminiConnected,
    krakenPriceHistory, krakenCurrentPrice, krakenConnected,
    bitstampPriceHistory, bitstampCurrentPrice, bitstampConnected,
    bitfinexPriceHistory, bitfinexCurrentPrice, bitfinexConnected,
    cryptoComUsdPriceHistory, cryptoComUsdCurrentPrice, cryptoComUsdConnected,
    cryptoComUsdtPriceHistory, cryptoComUsdtCurrentPrice, cryptoComUsdtConnected,
  ]);

  // Manual refresh - resets chart view to default position
  const handleRefresh = useCallback(() => {
    refreshPredictions();
    if (!streaming) {
      refreshPrices();
    }
    setChartRefreshKey((prev) => prev + 1);
  }, [refreshPredictions, refreshPrices, streaming]);

  // Auto-refresh - only refreshes data, preserves user's chart pan/zoom position
  const handleAutoRefresh = useCallback(() => {
    refreshPredictions();
    if (!streaming) {
      refreshPrices();
    }
  }, [refreshPredictions, refreshPrices, streaming]);

  const handleAssetChange = useCallback((assetId: string) => {
    setSelectedAssetId(assetId);
  }, []);

  const handleIntervalChange = useCallback((interval: Interval) => {
    setSelectedInterval(interval);
    refreshPredictions();
    setChartRefreshKey((prev) => prev + 1);
  }, [refreshPredictions]);

  // Get current price from the most recent candle
  const currentPrice = useMemo(() => {
    if (candles.length === 0) return undefined;
    return candles[candles.length - 1].close;
  }, [candles]);

  // Track price direction
  useEffect(() => {
    if (currentPrice !== undefined && prevPriceRef.current !== undefined) {
      if (currentPrice > prevPriceRef.current) {
        setPriceDirection('up');
      } else if (currentPrice < prevPriceRef.current) {
        setPriceDirection('down');
      }
    }
    prevPriceRef.current = currentPrice;
  }, [currentPrice]);

  // Find the next pending prediction
  const nextPrediction = useMemo(() => {
    if (!predictions?.allPredictions) return null;
    const now = Date.now() / 1000;
    return predictions.allPredictions.find(
      (p) => p.time > now && p.status === 'pending'
    ) || null;
  }, [predictions]);

  // Update browser tab title with price vs prediction info
  useEffect(() => {
    if (!currentPrice || !nextPrediction) {
      document.title = 'Abacus';
      return;
    }

    const predictionMid = (nextPrediction.high + nextPrediction.low) / 2;
    const deviation = ((currentPrice - predictionMid) / predictionMid) * 100;
    const sign = deviation >= 0 ? '+' : '';
    const symbol = selectedAsset?.symbol || '';

    document.title = `${symbol} $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${sign}${deviation.toFixed(2)}%) | Abacus`;
  }, [currentPrice, nextPrediction, selectedAsset]);

  return (
    <div className="flex flex-col h-dvh md:h-screen bg-[#0d1117] text-[#c9d1d9]">
      {/* Desktop Header */}
      <Header
        selectedAsset={selectedAsset || null}
        selectedInterval={selectedInterval}
        onAssetChange={handleAssetChange}
        onIntervalChange={handleIntervalChange}
        onRefresh={handleRefresh}
        streaming={streaming}
        currentPrice={currentPrice}
        nextPrediction={nextPrediction}
        priceDirection={priceDirection}
        className="hidden md:flex"
      />

      {/* Mobile Header */}
      <MobileHeader
        currentPrice={currentPrice}
        nextPrediction={nextPrediction}
        streaming={streaming}
        onMenuOpen={() => setMobileMenuOpen(true)}
        priceDirection={priceDirection}
        className="flex md:hidden"
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chart Area - accounts for bottom sheet on mobile */}
        <div className="flex-1 min-w-0 relative pb-20 md:pb-0">
          <PriceChart
            candles={candles}
            dailyCandles={dailyCandles}
            predictions={predictions?.allPredictions || []}
            blocks={predictions?.blocks}
            className="w-full h-full"
            assetType={selectedAsset?.type}
            interval={selectedInterval}
            refreshKey={chartRefreshKey}
            exchangeData={exchangeData}
          />
        </div>

        {/* Desktop Sidebar */}
        <Sidebar
          predictions={predictions}
          loading={predictionsLoading}
          error={predictionsError}
          onRefresh={handleRefresh}
          onAutoRefresh={handleAutoRefresh}
        />
      </div>

      {/* Mobile Bottom Sheet */}
      <BottomSheet
        state={sheetState}
        onStateChange={setSheetState}
        className="md:hidden"
      >
        <SidebarContent
          predictions={predictions}
          loading={predictionsLoading}
          error={predictionsError}
          onRefresh={handleRefresh}
          onAutoRefresh={handleAutoRefresh}
          showFooter={true}
        />
      </BottomSheet>

      {/* Mobile Menu Overlay */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        selectedAsset={selectedAsset || null}
        selectedInterval={selectedInterval}
        onAssetChange={handleAssetChange}
        onIntervalChange={handleIntervalChange}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
