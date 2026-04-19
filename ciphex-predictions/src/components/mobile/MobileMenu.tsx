'use client';

import { useState, useMemo } from 'react';
import { Asset, Interval } from '@/types';
import { ASSET_GROUPS, STOCK_SUB_GROUPS } from '@/config/assets';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MarketStatus } from '@/hooks/useMarketStatus';

type Tab = 'crypto' | 'stocks';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset: Asset | null;
  selectedInterval: Interval;
  onAssetChange: (assetId: string) => void;
  onIntervalChange: (interval: Interval) => void;
  onRefresh: () => void;
  marketStatus?: MarketStatus | null;
}

const intervals: Interval[] = ['15s', '1m', '15m', '1h'];

export function MobileMenu({
  isOpen,
  onClose,
  selectedAsset,
  selectedInterval,
  onAssetChange,
  onIntervalChange,
  onRefresh,
  marketStatus,
}: MobileMenuProps) {
  const [activeTab, setActiveTab] = useState<Tab>(
    selectedAsset?.type === 'stock' ? 'stocks' : 'crypto'
  );

  const cryptoAssets = useMemo(
    () => ASSET_GROUPS.find((g) => g.label === 'Crypto')?.assets || [],
    []
  );

  const stockAssets = useMemo(
    () => ASSET_GROUPS.find((g) => g.label === 'Stocks & ETFs')?.assets || [],
    []
  );

  const stockSubGroups = useMemo(() => {
    return STOCK_SUB_GROUPS.map((sg) => ({
      label: sg.label,
      assets: sg.symbols
        .map((sym) => stockAssets.find((a) => a.symbol === sym))
        .filter(Boolean) as Asset[],
    }));
  }, [stockAssets]);

  if (!isOpen) return null;

  const handleAssetSelect = (assetId: string) => {
    onAssetChange(assetId);
    onClose();
  };

  const handleIntervalSelect = (interval: Interval) => {
    onIntervalChange(interval);
    onClose();
  };

  const handleRefresh = () => {
    onRefresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#0a0e13]/95 backdrop-blur-sm">
      <div className="flex flex-col h-full pt-safe pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
          <span className="text-lg font-semibold text-[#f0f6fc]">Settings</span>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
            aria-label="Close menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Interval Selection */}
          <div>
            <label className="text-[11px] text-[#8b949e] uppercase tracking-wider mb-2 block">
              Interval
            </label>
            <div className="flex gap-2">
              {intervals.map((int) => (
                <button
                  key={int}
                  onClick={() => handleIntervalSelect(int)}
                  className={cn(
                    'flex-1 py-2.5 rounded-md text-sm font-medium transition-colors',
                    selectedInterval === int
                      ? 'bg-[#238636] text-white'
                      : 'bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d]'
                  )}
                >
                  {int}
                </button>
              ))}
            </div>
          </div>

          {/* Asset Selection */}
          <div>
            <label className="text-[11px] text-[#8b949e] uppercase tracking-wider mb-2 block">
              Asset
            </label>

            {/* Tab Bar */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setActiveTab('crypto')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors',
                  activeTab === 'crypto'
                    ? 'bg-[#30363d] text-[#f0f6fc]'
                    : 'bg-[#21262d] text-[#8b949e]'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff]" />
                Crypto
              </button>
              <button
                onClick={() => setActiveTab('stocks')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors',
                  activeTab === 'stocks'
                    ? 'bg-[#30363d] text-[#f0f6fc]'
                    : 'bg-[#21262d] text-[#8b949e]'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
                Stocks
              </button>
            </div>

            {/* Asset Grid */}
            <div className="space-y-3">
              {activeTab === 'crypto' ? (
                <div className="grid grid-cols-2 gap-2">
                  {cryptoAssets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => handleAssetSelect(asset.id)}
                      className={cn(
                        'py-2.5 px-3 rounded-md text-sm font-medium text-left transition-colors',
                        selectedAsset?.id === asset.id
                          ? 'bg-[#238636] text-white'
                          : 'bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d]'
                      )}
                    >
                      {asset.symbol}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {stockSubGroups.map((sg) => (
                    <div key={sg.label}>
                      <div className="text-xs text-[#8b949e] py-1 mb-1">{sg.label}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {sg.assets.map((asset) => (
                          <button
                            key={asset.id}
                            onClick={() => handleAssetSelect(asset.id)}
                            className={cn(
                              'py-2.5 px-3 rounded-md text-sm font-medium text-left transition-colors',
                              selectedAsset?.id === asset.id
                                ? 'bg-[#238636] text-white'
                                : 'bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d]'
                            )}
                          >
                            {asset.symbol}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Market Status Banner */}
                  {marketStatus && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#161b22] border border-[#30363d]">
                      <span className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        marketStatus.isTrading ? 'bg-[#3fb950]' : 'bg-[#f85149]'
                      )} />
                      <span className="text-[11px] text-[#8b949e]">
                        {marketStatus.isTrading ? 'Market Open' : 'Market Closed'}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Refresh Button */}
          <Button
            onClick={handleRefresh}
            className="w-full bg-[#238636] hover:bg-[#2ea043] text-white py-3"
          >
            Refresh Data
          </Button>
        </div>
      </div>
    </div>
  );
}
