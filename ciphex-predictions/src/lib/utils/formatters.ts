export function formatPrice(price: number): string {
  if (price >= 10000) {
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((ms % (1000 * 60)) / 1000);

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatVariance(variance: number): string {
  const sign = variance >= 0 ? '+' : '';
  return `${sign}${variance.toFixed(2)}%`;
}

// Returns Tailwind color class based on variance direction and in_range status
export function getVarianceColor(variance: number, inRange?: boolean): string {
  // Positive variance (actual > predicted) or in_range → green
  if (variance >= 0 || inRange) return 'text-[#3fb950]';
  // Negative variance within -2% of lower band → amber
  if (variance >= -2) return 'text-[#d29922]';
  // Negative variance below -2% → red
  return 'text-[#f85149]';
}
