'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/utils';

export type SheetState = 'collapsed' | 'half' | 'full';

interface BottomSheetProps {
  children: React.ReactNode;
  state: SheetState;
  onStateChange: (state: SheetState) => void;
  className?: string;
}

export function BottomSheet({ children, state, onStateChange, className }: BottomSheetProps) {
  const cycleState = useCallback(() => {
    const nextState: Record<SheetState, SheetState> = {
      collapsed: 'half',
      half: 'full',
      full: 'collapsed',
    };
    onStateChange(nextState[state]);
  }, [state, onStateChange]);

  // Height classes for each state
  const heightClasses: Record<SheetState, string> = {
    collapsed: 'h-20',
    half: 'h-[50dvh]',
    full: 'h-[85dvh]',
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-[#161b22] border-t border-[#30363d]',
        'rounded-t-2xl',
        'transition-all duration-300 ease-out',
        'flex flex-col',
        'pb-safe',
        heightClasses[state],
        className
      )}
    >
      {/* Drag handle / tap target */}
      <button
        onClick={cycleState}
        className="w-full py-3 flex flex-col items-center gap-1.5 cursor-pointer shrink-0"
      >
        <div className="w-10 h-1 bg-[#484f58] rounded-full" />
        <span className="text-[10px] text-[#8b949e] uppercase tracking-wider">
          {state === 'collapsed' ? 'Tap to expand' : state === 'half' ? 'Tap for full' : 'Tap to collapse'}
        </span>
      </button>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
}
