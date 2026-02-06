'use client';

import { Horizon } from '@/types';
import { formatPrice } from '@/lib/utils/formatters';

interface PredictionCardProps {
  prediction: Horizon;
  isNext: boolean;
}

export function PredictionCard({ prediction, isNext }: PredictionCardProps) {
  const predTime = new Date(prediction.time * 1000);

  return (
    <div
      className={`bg-[#21262d] border rounded-lg p-3 md:p-3.5 mb-2 md:mb-2.5 ${
        isNext
          ? 'border-[#238636] bg-gradient-to-br from-[rgba(35,134,54,0.1)] to-transparent'
          : 'border-[#30363d]'
      }`}
    >
      <h3 className="text-[11px] text-[#8b949e] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
        {isNext ? 'Next Validation' : 'Latest Validation'}
        <span className="bg-[#238636] text-white px-1.5 py-0.5 rounded text-[9px]">
          {prediction.signal}
        </span>
      </h3>

      <div className="space-y-1.5">
        <PriceRow label="High" color="high" value={prediction.high} />
        <PriceRow label="Mid" color="mid" value={prediction.close} />
        <PriceRow label="Low" color="low" value={prediction.low} />
      </div>

      <div className="flex justify-between text-xs text-[#8b949e] pt-2.5 mt-2.5 border-t border-[#30363d]">
        <span>{predTime.toLocaleTimeString()}</span>
        <span
          className={`px-2 py-0.5 rounded-xl text-[11px] font-medium ${
            prediction.status === 'settled'
              ? 'bg-[rgba(63,185,80,0.15)] text-[#3fb950]'
              : 'bg-[rgba(210,153,34,0.15)] text-[#d29922]'
          }`}
        >
          {prediction.status}
        </span>
      </div>

      <div className="mt-2">
        <div className="h-1 bg-[#30363d] rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#238636] to-[#3fb950] rounded transition-all"
            style={{ width: `${prediction.probability * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-[#8b949e] mt-1">
          <span>Confidence</span>
          <span>
            {(prediction.probability * 100).toFixed(1)}% • {prediction.signal}
          </span>
        </div>
      </div>
    </div>
  );
}

function PriceRow({
  label,
  color,
  value,
}: {
  label: string;
  color: 'high' | 'mid' | 'low';
  value: number;
}) {
  const colors = {
    high: '#58a6ff',
    mid: '#a371f7',
    low: '#58a6ff',
  };

  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="flex items-center gap-1.5 text-[13px] text-[#8b949e]">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: colors[color] }}
        />
        {label}
      </span>
      <span className="text-[14px] font-semibold font-mono text-[#f0f6fc]">
        {formatPrice(value)}
      </span>
    </div>
  );
}
