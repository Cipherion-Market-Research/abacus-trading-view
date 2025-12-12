'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/header/Header';
import { PriceChart } from '@/components/chart/PriceChart';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { usePredictions, usePriceData } from '@/hooks';
import { DEFAULT_ASSET_ID, getAssetById } from '@/config/assets';
import { Interval } from '@/types';

export default function Dashboard() {
  const [selectedAssetId, setSelectedAssetId] = useState(DEFAULT_ASSET_ID);
  const [selectedInterval, setSelectedInterval] = useState<Interval>('1m');

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

  const handleRefresh = useCallback(() => {
    refreshPredictions();
    // Only refresh prices if not streaming (WebSocket provides realtime updates)
    if (!streaming) {
      refreshPrices();
    }
  }, [refreshPredictions, refreshPrices, streaming]);

  const handleAssetChange = useCallback((assetId: string) => {
    setSelectedAssetId(assetId);
  }, []);

  const handleIntervalChange = useCallback((interval: Interval) => {
    setSelectedInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-[#c9d1d9]">
      <Header
        selectedAsset={selectedAsset || null}
        selectedInterval={selectedInterval}
        onAssetChange={handleAssetChange}
        onIntervalChange={handleIntervalChange}
        onRefresh={handleRefresh}
        streaming={streaming}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <PriceChart
            candles={candles}
            dailyCandles={dailyCandles}
            predictions={predictions?.allPredictions || []}
            blocks={predictions?.blocks}
            className="w-full h-full"
            assetType={selectedAsset?.type}
            interval={selectedInterval}
          />
        </div>

        <Sidebar
          predictions={predictions}
          loading={predictionsLoading}
          error={predictionsError}
          onRefresh={handleRefresh}
        />
      </div>
    </div>
  );
}
