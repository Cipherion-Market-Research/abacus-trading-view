'use client';

import { PredictionData } from '@/types';
import { SidebarContent } from './SidebarContent';
import { cn } from '@/lib/utils';

interface SidebarProps {
  predictions: PredictionData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAutoRefresh: () => void;
  className?: string;
}

export function Sidebar({
  predictions,
  loading,
  error,
  onRefresh,
  onAutoRefresh,
  className,
}: SidebarProps) {
  return (
    <div
      className={cn(
        'w-[300px] shrink-0 bg-[#161b22] border-l border-[#30363d] flex-col h-full',
        'hidden md:flex', // Hide on mobile, show on desktop
        className
      )}
    >
      <SidebarContent
        predictions={predictions}
        loading={loading}
        error={error}
        onRefresh={onRefresh}
        onAutoRefresh={onAutoRefresh}
        showFooter={true}
      />
    </div>
  );
}
