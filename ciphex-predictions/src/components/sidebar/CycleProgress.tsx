'use client';

import { useEffect, useState } from 'react';
import { Horizon, CycleInfo } from '@/types';

interface CycleProgressProps {
  predictions: Horizon[];
  cycle: CycleInfo;
}

export function CycleProgress({ predictions, cycle }: CycleProgressProps) {
  const [timeRemaining, setTimeRemaining] = useState('--:--:--');

  const settledCount = predictions.filter((p) => p.status === 'settled').length;
  const totalHorizons = predictions.length;

  // Find current horizon (first pending)
  let currentHorizonIndex = predictions.findIndex((p) => p.status === 'pending');
  if (currentHorizonIndex === -1) currentHorizonIndex = totalHorizons - 1;

  // Find next pending prediction
  const nextPendingPrediction = predictions.find((p) => p.status === 'pending');

  // Update countdown to next prediction
  useEffect(() => {
    const updateCountdown = () => {
      if (!nextPendingPrediction) {
        setTimeRemaining('All Settled');
        return;
      }

      const predictionTime = nextPendingPrediction.time * 1000;
      const remaining = predictionTime - Date.now();

      if (remaining > 0) {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((remaining % (1000 * 60)) / 1000);
        setTimeRemaining(
          `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        );
      } else {
        setTimeRemaining('Settling...');
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextPendingPrediction]);

  return (
    <div className="bg-[#21262d] border border-[#30363d] rounded-lg p-3.5 mb-3">
      <div className="mb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] text-[#8b949e] uppercase tracking-wider">
            Cycle Progress
          </span>
          <span className="text-[13px] font-semibold text-[#f0f6fc]">
            {settledCount} / {totalHorizons} Settled
          </span>
        </div>
        <div className="flex gap-[3px] h-2">
          {predictions.map((pred, i) => {
            let className = 'flex-1 rounded-sm transition-all ';
            if (i === currentHorizonIndex) {
              className += 'bg-[#d29922] animate-pulse';
            } else if (pred.status === 'settled') {
              className += 'bg-[#3fb950]';
            } else {
              className += 'bg-[#30363d] border border-[#484f58]';
            }
            return (
              <div
                key={i}
                className={className}
                title={`Horizon ${i + 1}: ${pred.status}`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-[#8b949e]">
          <span>Outlook</span>
          <span>Continuation</span>
          <span>Persistence</span>
        </div>
      </div>
      <div className="text-center p-2.5 bg-[#161b22] rounded-md">
        <div className="text-xl font-semibold text-[#f0f6fc] font-mono">
          {timeRemaining}
        </div>
        <div className="text-[10px] text-[#8b949e] uppercase mt-0.5">
          Until Next Prediction
        </div>
      </div>
    </div>
  );
}
