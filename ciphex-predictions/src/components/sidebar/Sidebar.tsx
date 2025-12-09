'use client';

import { useState, useEffect, useCallback } from 'react';
import { PredictionData } from '@/types';
import { CycleProgress } from './CycleProgress';
import { PredictionCard } from './PredictionCard';
import { HorizonsList } from './HorizonsList';

const AUTO_REFRESH_INTERVAL = 30; // seconds

interface SidebarProps {
  predictions: PredictionData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function Sidebar({ predictions, loading, error, onRefresh }: SidebarProps) {
  const [lastUpdated, setLastUpdated] = useState<string>('--:--:--');
  const [countdown, setCountdown] = useState<number>(AUTO_REFRESH_INTERVAL);

  // Update timestamp only on client to avoid hydration mismatch
  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString());
    setCountdown(AUTO_REFRESH_INTERVAL); // Reset countdown on data update
  }, [predictions]);

  // Auto-refresh countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRefresh();
          return AUTO_REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onRefresh]);

  // Find next pending prediction
  const nextPred = predictions?.allPredictions.find(
    (p) => p.time > Date.now() / 1000 && p.status === 'pending'
  );
  const currentPred =
    nextPred ||
    (predictions?.allPredictions.length
      ? predictions.allPredictions[predictions.allPredictions.length - 1]
      : null);

  const pendingCount =
    predictions?.allPredictions.filter((p) => p.status === 'pending').length || 0;

  return (
    <div className="w-[300px] bg-[#161b22] border-l border-[#30363d] flex flex-col h-full">
      <div className="px-4 py-3.5 border-b border-[#30363d] flex justify-between items-center">
        <h2 className="text-sm font-semibold text-[#f0f6fc]">Predictions</h2>
        <span
          className={`px-2 py-0.5 rounded-xl text-[11px] font-medium ${
            loading
              ? 'bg-[rgba(210,153,34,0.15)] text-[#d29922]'
              : pendingCount > 0
                ? 'bg-[rgba(210,153,34,0.15)] text-[#d29922]'
                : 'bg-[rgba(63,185,80,0.15)] text-[#3fb950]'
          }`}
        >
          {loading ? 'Loading' : `${pendingCount} Pending`}
        </span>
      </div>

      <div className="flex-1 overflow-hidden p-3 flex flex-col min-h-0">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : predictions ? (
          <div className="flex flex-col h-full min-h-0 gap-3">
            <CycleProgress
              predictions={predictions.allPredictions}
              cycle={predictions.cycle}
            />
            {currentPred && (
              <PredictionCard
                prediction={currentPred}
                isNext={currentPred.status === 'pending'}
              />
            )}
            <HorizonsList
              blocks={predictions.blocks}
              currentHorizonIndex={predictions.cycle.currentHorizonIndex}
            />
          </div>
        ) : (
          <ErrorState message="No predictions available" />
        )}
      </div>

      <div className="px-4 py-3 border-t border-[#30363d] text-[11px] text-[#8b949e] flex justify-between">
        <span>Updated: {lastUpdated}</span>
        <button
          onClick={onRefresh}
          className="hover:text-[#f0f6fc] transition-colors font-mono"
        >
          Refresh: {countdown}s
        </button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] text-[#8b949e] gap-3">
      <div className="w-6 h-6 border-2 border-[#30363d] border-t-[#238636] rounded-full animate-spin" />
      <span>Loading predictions...</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-[rgba(248,81,73,0.1)] border border-[rgba(248,81,73,0.4)] text-[#f85149] p-3 rounded-md text-[13px]">
      {message}
    </div>
  );
}
