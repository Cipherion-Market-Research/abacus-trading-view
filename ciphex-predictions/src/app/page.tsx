'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Header } from '@/components/header/Header';
import { PriceChart } from '@/components/chart/PriceChart';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { usePredictions, usePriceData } from '@/hooks';
import { DEFAULT_ASSET_ID, getAssetById } from '@/config/assets';
import { Interval } from '@/types';

export default function Dashboard() {
  const [selectedAssetId, setSelectedAssetId] = useState(DEFAULT_ASSET_ID);
  const [selectedInterval, setSelectedInterval] = useState<Interval>('15m');
  // Key to trigger chart visible range recalculation on refresh/interval change
  const [chartRefreshKey, setChartRefreshKey] = useState(0);

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
    enableStreaming: true, // Enable realtime WebSocket for crypto, SSE for stocks
  });

  // Manual refresh - resets chart view to default position
  const handleRefresh = useCallback(() => {
    refreshPredictions();
    if (!streaming) {
      refreshPrices();
    }
    // Trigger chart to recalculate visible range and center on current candle
    setChartRefreshKey((prev) => prev + 1);
  }, [refreshPredictions, refreshPrices, streaming]);

  // Auto-refresh - only refreshes data, preserves user's chart pan/zoom position
  const handleAutoRefresh = useCallback(() => {
    refreshPredictions();
    if (!streaming) {
      refreshPrices();
    }
    // Do NOT reset chart view - preserve user's pan/zoom position
  }, [refreshPredictions, refreshPrices, streaming]);

  const handleAssetChange = useCallback((assetId: string) => {
    setSelectedAssetId(assetId);
  }, []);

  const handleIntervalChange = useCallback((interval: Interval) => {
    setSelectedInterval(interval);
    // Refresh predictions when changing intervals
    // NOTE: usePriceData automatically re-fetches prices when interval changes
    refreshPredictions();
    // Trigger chart to recalculate visible range after new data loads
    setChartRefreshKey((prev) => prev + 1);
  }, [refreshPredictions]);

  // Get current price from the most recent candle
  const currentPrice = useMemo(() => {
    if (candles.length === 0) return undefined;
    return candles[candles.length - 1].close;
  }, [candles]);

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
    <div className="flex flex-col h-screen bg-[#0d1117] text-[#c9d1d9]">
      <Header
        selectedAsset={selectedAsset || null}
        selectedInterval={selectedInterval}
        onAssetChange={handleAssetChange}
        onIntervalChange={handleIntervalChange}
        onRefresh={handleRefresh}
        streaming={streaming}
        currentPrice={currentPrice}
        nextPrediction={nextPrediction}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 min-w-0 relative">
          <PriceChart
            candles={candles}
            dailyCandles={dailyCandles}
            predictions={predictions?.allPredictions || []}
            blocks={predictions?.blocks}
            className="w-full h-full"
            assetType={selectedAsset?.type}
            interval={selectedInterval}
            refreshKey={chartRefreshKey}
          />
        </div>

        <Sidebar
          predictions={predictions}
          loading={predictionsLoading}
          error={predictionsError}
          onRefresh={handleRefresh}
          onAutoRefresh={handleAutoRefresh}
        />
      </div>
    </div>
  );
}
