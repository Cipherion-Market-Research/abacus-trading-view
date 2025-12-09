'use client';

import { useEffect, useRef } from 'react';
import { Horizon, Block } from '@/types';
import { formatTime, formatPrice } from '@/lib/utils/formatters';

interface HorizonsListProps {
  blocks: Block[];
  currentHorizonIndex: number;
}

const BLOCK_NAMES = ['', 'Outlook', 'Continuation', 'Persistence'];

export function HorizonsList({ blocks, currentHorizonIndex }: HorizonsListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);
  let horizonIndex = 0;

  // Auto-scroll to current horizon on mount and when it changes
  useEffect(() => {
    if (activeRowRef.current && scrollContainerRef.current) {
      activeRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentHorizonIndex]);

  return (
    <div className="bg-[#21262d] border border-[#30363d] rounded-lg p-3.5 flex-1 flex flex-col min-h-0">
      <h3 className="text-[11px] text-[#8b949e] uppercase tracking-wider mb-2.5">
        All Horizons
      </h3>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto space-y-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {blocks.map((block, blockIdx) => (
          <div key={blockIdx}>
            <div className="text-[10px] text-[#8b949e] uppercase tracking-wider py-2 pt-3 first:pt-0">
              Block {blockIdx + 1}: {BLOCK_NAMES[blockIdx + 1]}
            </div>
            {block.horizons.map((horizon) => {
              const idx = horizonIndex++;
              const isActive = idx === currentHorizonIndex;
              const isPast = horizon.status === 'settled';

              return (
                <div
                  key={idx}
                  ref={isActive ? activeRowRef : null}
                  className={`flex justify-between items-center px-2.5 py-2 rounded-md mb-1 text-xs ${
                    isActive
                      ? 'bg-[rgba(35,134,54,0.2)] border border-[#238636]'
                      : 'bg-[#21262d]'
                  } ${isPast ? 'opacity-60' : ''}`}
                >
                  <span className="text-[#8b949e]">{formatTime(horizon.time)}</span>
                  <span className="font-mono text-[#f0f6fc]">
                    {formatPrice(horizon.close)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-xl text-[11px] font-medium ${
                      horizon.status === 'settled'
                        ? 'bg-[rgba(63,185,80,0.15)] text-[#3fb950]'
                        : 'bg-[rgba(210,153,34,0.15)] text-[#d29922]'
                    }`}
                  >
                    {horizon.status === 'settled' ? '✓' : '◯'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
