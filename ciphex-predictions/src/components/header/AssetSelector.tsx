'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Asset } from '@/types';
import { ASSET_GROUPS, STOCK_SUB_GROUPS } from '@/config/assets';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { MarketStatus } from '@/hooks/useMarketStatus';

type Tab = 'crypto' | 'stocks';

interface AssetSelectorProps {
  selectedAsset: Asset | null;
  onAssetChange: (assetId: string) => void;
  marketStatus?: MarketStatus | null;
}

// Persist last active tab across sessions
function getInitialTab(): Tab {
  if (typeof window === 'undefined') return 'crypto';
  return (localStorage.getItem('asset-selector-tab') as Tab) || 'crypto';
}

function formatMarketStatusLabel(status: MarketStatus): string {
  const closeTime = status.sessionCloseUTC
    ? new Date(status.sessionCloseUTC).toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null;

  const nextOpen = status.nextOpenUTC
    ? new Date(status.nextOpenUTC).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null;

  switch (status.status) {
    case 'OPEN':
      return closeTime ? `Market Open \u00b7 Closes ${closeTime} ET` : 'Market Open';
    case 'CLOSED':
      if (status.holidayName) return `Closed \u00b7 ${status.holidayName}`;
      return nextOpen ? `Market Closed \u00b7 Opens ${nextOpen} ET` : 'Market Closed';
    case 'PRE_OPEN':
      return 'Pre-Market';
    case 'POST_CLOSE':
      return nextOpen ? `After Hours \u00b7 Opens ${nextOpen} ET` : 'After Hours';
    default:
      return '';
  }
}

function getMarketDotColor(status: MarketStatus['status']): string {
  switch (status) {
    case 'OPEN': return 'bg-[#3fb950]';
    case 'CLOSED': return 'bg-[#f85149]';
    case 'PRE_OPEN':
    case 'POST_CLOSE': return 'bg-[#d29922]';
    default: return 'bg-[#8b949e]';
  }
}

export function AssetSelector({ selectedAsset, onAssetChange, marketStatus }: AssetSelectorProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(-1);

  // Auto-switch tab when selecting an asset of a different type
  useEffect(() => {
    if (selectedAsset?.type === 'stock') {
      setActiveTab('stocks');
    } else if (selectedAsset?.type === 'crypto') {
      setActiveTab('crypto');
    }
  }, [selectedAsset?.type]);

  // Persist tab choice
  useEffect(() => {
    localStorage.setItem('asset-selector-tab', activeTab);
  }, [activeTab]);

  // Focus search when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
      setSearch('');
      setFocusIndex(-1);
    }
  }, [open]);

  // Get assets for each tab
  const cryptoAssets = useMemo(
    () => ASSET_GROUPS.find((g) => g.label === 'Crypto')?.assets || [],
    []
  );

  const stockAssets = useMemo(
    () => ASSET_GROUPS.find((g) => g.label === 'Stocks & ETFs')?.assets || [],
    []
  );

  // Build stock sub-groups with asset objects
  const stockSubGroups = useMemo(() => {
    return STOCK_SUB_GROUPS.map((sg) => ({
      label: sg.label,
      assets: sg.symbols
        .map((sym) => stockAssets.find((a) => a.symbol === sym))
        .filter(Boolean) as Asset[],
    }));
  }, [stockAssets]);

  // Filter by search
  const filteredCrypto = useMemo(() => {
    if (!search) return cryptoAssets;
    const q = search.toLowerCase();
    return cryptoAssets.filter(
      (a) => a.symbol.toLowerCase().includes(q) || a.displayName.toLowerCase().includes(q)
    );
  }, [cryptoAssets, search]);

  const filteredStockSubGroups = useMemo(() => {
    if (!search) return stockSubGroups;
    const q = search.toLowerCase();
    return stockSubGroups
      .map((sg) => ({
        ...sg,
        assets: sg.assets.filter(
          (a) => a.symbol.toLowerCase().includes(q) || a.displayName.toLowerCase().includes(q)
        ),
      }))
      .filter((sg) => sg.assets.length > 0);
  }, [stockSubGroups, search]);

  // Flat list of visible assets for keyboard navigation
  const flatVisibleAssets = useMemo(() => {
    if (activeTab === 'crypto') return filteredCrypto;
    return filteredStockSubGroups.flatMap((sg) => sg.assets);
  }, [activeTab, filteredCrypto, filteredStockSubGroups]);

  const handleSelect = useCallback((assetId: string) => {
    onAssetChange(assetId);
    setOpen(false);
  }, [onAssetChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex((prev) => Math.min(prev + 1, flatVisibleAssets.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < flatVisibleAssets.length) {
      e.preventDefault();
      handleSelect(flatVisibleAssets[focusIndex].id);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setActiveTab((prev) => (prev === 'crypto' ? 'stocks' : 'crypto'));
      setFocusIndex(-1);
    }
  }, [flatVisibleAssets, focusIndex, handleSelect]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-asset-item]');
    items[focusIndex]?.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

  // Asset type dot color
  const typeDotColor = selectedAsset?.type === 'stock' ? 'bg-[#3fb950]' : 'bg-[#58a6ff]';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm',
            'bg-[#21262d] border border-[#30363d] text-[#c9d1d9]',
            'hover:bg-[#30363d] hover:text-[#f0f6fc] transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#238636]',
            'min-w-[180px]'
          )}
        >
          <span className={cn('w-2 h-2 rounded-full shrink-0', typeDotColor)} />
          <span className="font-mono font-semibold text-[#f0f6fc]">
            {selectedAsset?.symbol || 'Select'}
          </span>
          <span className="text-[#8b949e] truncate text-xs">
            {selectedAsset?.displayName || ''}
          </span>
          <svg className="w-3 h-3 ml-auto shrink-0 text-[#8b949e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[280px] p-0 max-h-[460px] flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Search */}
        <div className="p-2 border-b border-[#30363d]">
          <input
            ref={searchRef}
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setFocusIndex(-1);
            }}
            className={cn(
              'w-full px-2.5 py-1.5 text-xs rounded-md',
              'bg-[#0d1117] border border-[#30363d] text-[#f0f6fc]',
              'placeholder:text-[#484f58]',
              'focus:outline-none focus:border-[#238636]'
            )}
          />
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 p-2 border-b border-[#30363d]">
          <TabButton
            active={activeTab === 'crypto'}
            onClick={() => { setActiveTab('crypto'); setFocusIndex(-1); }}
            dotColor="bg-[#58a6ff]"
            label="Crypto"
            count={cryptoAssets.length}
          />
          <TabButton
            active={activeTab === 'stocks'}
            onClick={() => { setActiveTab('stocks'); setFocusIndex(-1); }}
            dotColor="bg-[#3fb950]"
            label="Stocks"
            count={stockAssets.length}
          />
        </div>

        {/* Asset List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-1" style={{ maxHeight: 320 }}>
          {activeTab === 'crypto' ? (
            filteredCrypto.length > 0 ? (
              filteredCrypto.map((asset, i) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  selected={selectedAsset?.id === asset.id}
                  focused={focusIndex === i}
                  onSelect={handleSelect}
                />
              ))
            ) : (
              <EmptyState />
            )
          ) : (
            filteredStockSubGroups.length > 0 ? (
              <>
                {filteredStockSubGroups.map((sg) => (
                  <div key={sg.label}>
                    <div className="px-2 py-1.5 text-[10px] text-[#484f58] uppercase tracking-wider">
                      {sg.label}
                    </div>
                    {sg.assets.map((asset) => {
                      const flatIdx = flatVisibleAssets.findIndex((a) => a.id === asset.id);
                      return (
                        <AssetRow
                          key={asset.id}
                          asset={asset}
                          selected={selectedAsset?.id === asset.id}
                          focused={focusIndex === flatIdx}
                          onSelect={handleSelect}
                        />
                      );
                    })}
                  </div>
                ))}
              </>
            ) : (
              <EmptyState />
            )
          )}
        </div>

        {/* Market Status Footer (stocks tab only) */}
        {activeTab === 'stocks' && marketStatus && (
          <div className="px-3 py-2 border-t border-[#30363d] bg-[#0d1117]">
            <div className="flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full shrink-0', getMarketDotColor(marketStatus.status))} />
              <span className="text-[11px] text-[#8b949e]">
                {formatMarketStatusLabel(marketStatus)}
              </span>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function TabButton({
  active,
  onClick,
  dotColor,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  dotColor: string;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
        active
          ? 'bg-[#30363d] text-[#f0f6fc]'
          : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d]'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
      {label}
      <span className="text-[10px] text-[#484f58]">{count}</span>
    </button>
  );
}

function AssetRow({
  asset,
  selected,
  focused,
  onSelect,
}: {
  asset: Asset;
  selected: boolean;
  focused: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      data-asset-item
      onClick={() => onSelect(asset.id)}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
        selected
          ? 'bg-[rgba(35,134,54,0.15)] border-l-2 border-[#238636] pl-1.5'
          : 'border-l-2 border-transparent hover:bg-[#30363d]',
        focused && !selected && 'bg-[#30363d]'
      )}
    >
      <span className="font-mono font-semibold text-[#f0f6fc] w-[72px] text-left shrink-0">
        {asset.symbol}
      </span>
      <span className="text-[#8b949e] truncate text-[11px]">
        {asset.displayName}
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="px-3 py-6 text-center text-[11px] text-[#484f58]">
      No matching assets
    </div>
  );
}
