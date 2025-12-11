'use client';

import { Asset, Interval } from '@/types';
import { ASSET_GROUPS } from '@/config/assets';
import { Button } from '@/components/ui/button';
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
}

export function Header({
  selectedAsset,
  selectedInterval,
  onAssetChange,
  onIntervalChange,
  onRefresh,
  streaming = false,
}: HeaderProps) {
  return (
    <header className="bg-[#161b22] px-5 py-3 flex items-center justify-between border-b border-[#30363d]">
      <div className="flex items-center gap-2.5">
        <h1 className="text-lg font-semibold text-[#f0f6fc]">Ciphex Predictions</h1>
        <span
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
            streaming
              ? 'bg-gradient-to-br from-[#238636] to-[#2ea043]'
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
          <SelectTrigger className="w-[80px] bg-[#21262d] border-[#30363d] text-[#c9d1d9]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#21262d] border-[#30363d]">
            <SelectItem value="1m" className="text-[#c9d1d9] focus:bg-[#30363d]">
              1m
            </SelectItem>
            <SelectItem value="15m" className="text-[#c9d1d9] focus:bg-[#30363d]">
              15m
            </SelectItem>
            <SelectItem value="1h" className="text-[#c9d1d9] focus:bg-[#30363d]">
              1H
            </SelectItem>
            <SelectItem value="4h" className="text-[#c9d1d9] focus:bg-[#30363d]">
              4H
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
