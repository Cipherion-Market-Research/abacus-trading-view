'use client';

import { Horizon } from '@/types';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  currentPrice?: number;
  nextPrediction?: Horizon | null;
  streaming: boolean;
  onMenuOpen: () => void;
  priceDirection: 'up' | 'down' | 'neutral';
  className?: string;
}

export function MobileHeader({
  currentPrice,
  nextPrediction,
  streaming,
  onMenuOpen,
  priceDirection,
  className,
}: MobileHeaderProps) {
  const predictionMid = nextPrediction ? (nextPrediction.high + nextPrediction.low) / 2 : null;
  const deviation = currentPrice && predictionMid
    ? ((currentPrice - predictionMid) / predictionMid) * 100
    : null;

  const priceColorClass = priceDirection === 'up'
    ? 'text-[#3fb950]'
    : priceDirection === 'down'
      ? 'text-[#f85149]'
      : 'text-[#f0f6fc]';

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className={cn('bg-[#161b22] pt-safe w-full', className)}>
      <header className="w-full px-4 py-3 flex items-center justify-between border-b border-[#30363d]">
        {/* Left: Logo and streaming indicator */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-[#f0f6fc]">Abacus</span>
          {streaming && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3fb950] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3fb950]" />
            </span>
          )}
        </div>

        {/* Center: Price and deviation */}
        <div className="flex items-center gap-2">
          {currentPrice && (
            <span className={cn('text-sm font-semibold font-mono transition-colors', priceColorClass)}>
              ${formatPrice(currentPrice)}
            </span>
          )}
          {deviation !== null && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[11px] font-semibold font-mono',
                deviation >= 0
                  ? 'bg-[rgba(63,185,80,0.15)] text-[#3fb950]'
                  : 'bg-[rgba(248,81,73,0.15)] text-[#f85149]'
              )}
            >
              {deviation >= 0 ? '+' : ''}{deviation.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Right: Menu button */}
        <button
          onClick={onMenuOpen}
          className="p-2 -mr-2 text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
          aria-label="Open menu"
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
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </header>
    </div>
  );
}
