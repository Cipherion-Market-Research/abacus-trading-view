'use client';

import { Asset, Interval } from '@/types';
import { ASSET_GROUPS } from '@/config/assets';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset: Asset | null;
  selectedInterval: Interval;
  onAssetChange: (assetId: string) => void;
  onIntervalChange: (interval: Interval) => void;
  onRefresh: () => void;
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
}: MobileMenuProps) {
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
    <div className="fixed inset-0 z-[60] bg-[#0d1117]/95 backdrop-blur-sm">
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
            <div className="space-y-3">
              {ASSET_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="text-xs text-[#8b949e] py-1 mb-1">{group.label}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.assets.map((asset) => (
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
