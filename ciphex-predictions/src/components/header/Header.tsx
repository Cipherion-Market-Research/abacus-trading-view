'use client';

import { useState, useEffect, useRef } from 'react';
import { Asset, Interval, Horizon } from '@/types';
import { ASSET_GROUPS } from '@/config/assets';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HeaderProps {
  selectedAsset: Asset | null;
  selectedInterval: Interval;
  onAssetChange: (assetId: string) => void;
  onIntervalChange: (interval: Interval) => void;
  onRefresh: () => void;
  streaming?: boolean;
  currentPrice?: number;
  nextPrediction?: Horizon | null;
  priceDirection?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function Header({
  selectedAsset,
  selectedInterval,
  onAssetChange,
  onIntervalChange,
  onRefresh,
  streaming = false,
  currentPrice,
  nextPrediction,
  priceDirection = 'neutral',
  className,
}: HeaderProps) {
  // Calculate percentage deviation from prediction mid price
  const predictionMid = nextPrediction ? (nextPrediction.high + nextPrediction.low) / 2 : null;
  const deviation = currentPrice && predictionMid
    ? ((currentPrice - predictionMid) / predictionMid) * 100
    : null;

  // Displayed deviation (updates every 5 seconds)
  // Initialize to current deviation, then throttle updates via interval
  const [displayedDeviation, setDisplayedDeviation] = useState<number | null>(deviation);
  const deviationRef = useRef<number | null>(deviation);

  // Keep ref in sync with latest deviation value
  useEffect(() => {
    deviationRef.current = deviation;
  }, [deviation]);

  // Update displayed deviation every 5 seconds from ref
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayedDeviation(deviationRef.current);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Price color based on movement direction
  const priceColorClass = priceDirection === 'up'
    ? 'text-[#3fb950]'  // Green
    : priceDirection === 'down'
      ? 'text-[#f85149]'  // Red
      : 'text-[#f0f6fc]'; // Neutral/white

  return (
    <header className={cn("bg-[#161b22] px-5 py-3 items-center justify-between border-b border-[#30363d]", className)}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-semibold text-[#f0f6fc]">Abacus Charts</h1>
          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
              streaming
                ? 'bg-linear-to-br from-[#238636] to-[#2ea043]'
                : 'bg-[#30363d] text-[#8b949e]'
            }`}
          >
            {streaming && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
            )}
            {streaming ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Price vs Prediction Display */}
        {currentPrice && predictionMid && displayedDeviation !== null && (
          <div className="flex items-center gap-3 pl-3 border-l border-[#30363d]">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8b949e] uppercase">Price</span>
              <span className={`text-sm font-semibold font-mono transition-colors ${priceColorClass}`}>
                ${formatPrice(currentPrice)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8b949e] uppercase">Pred</span>
              <span className="text-sm font-semibold text-[#f0f6fc] font-mono">
                ${formatPrice(predictionMid)}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold font-mono ${
                displayedDeviation >= 0
                  ? 'bg-[rgba(63,185,80,0.15)] text-[#3fb950]'
                  : 'bg-[rgba(248,81,73,0.15)] text-[#f85149]'
              }`}
            >
              {displayedDeviation >= 0 ? '+' : ''}{displayedDeviation.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={selectedAsset?.id}
          onValueChange={onAssetChange}
        >
          <SelectTrigger className="w-[180px] bg-[#21262d] border-[#30363d] text-[#c9d1d9]">
            <SelectValue placeholder="Select asset" />
          </SelectTrigger>
          <SelectContent className="bg-[#21262d] border-[#30363d]">
            {ASSET_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel className="text-[#8b949e]">{group.label}</SelectLabel>
                {group.assets.map((asset) => (
                  <SelectItem
                    key={asset.id}
                    value={asset.id}
                    className="text-[#c9d1d9] focus:bg-[#30363d] focus:text-[#f0f6fc]"
                  >
                    {asset.symbol}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedInterval}
          onValueChange={(value) => onIntervalChange(value as Interval)}
        >
          <SelectTrigger className="w-20 bg-[#21262d] border-[#30363d] text-[#c9d1d9]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#21262d] border-[#30363d]">
            <SelectItem value="15s" className="text-[#c9d1d9] focus:bg-[#30363d]">
              15s
            </SelectItem>
            <SelectItem value="1m" className="text-[#c9d1d9] focus:bg-[#30363d]">
              1m
            </SelectItem>
            <SelectItem value="15m" className="text-[#c9d1d9] focus:bg-[#30363d]">
              15m
            </SelectItem>
            <SelectItem value="1h" className="text-[#c9d1d9] focus:bg-[#30363d]">
              1H
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={onRefresh}
          className="bg-[#238636] border-[#238636] hover:bg-[#2ea043] text-white"
        >
          ↻ Refresh
        </Button>
      </div>
    </header>
  );
}
