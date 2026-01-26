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

export function formatPercentCorrect(variance: number): string {
  const percentCorrect = 100 - Math.abs(variance);
  return `${percentCorrect.toFixed(2)}%`;
}

// Bright neon color constants for accuracy indicators
export const ACCURACY_COLORS = {
  green: '#00ff88',
  yellow: '#ffea00',
  red: '#ff2d55',
} as const;

// Returns the appropriate bright color based on variance direction and in_range status
// Green: within 3% or in range, Amber: within 5%, Red: outside 5%
export function getVarianceColor(variance: number, inRange?: boolean): string {
  if (variance >= -3 || inRange) return ACCURACY_COLORS.green;
  if (variance >= -5) return ACCURACY_COLORS.yellow;
  return ACCURACY_COLORS.red;
}
