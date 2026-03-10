// Signal-to-style mapping for prediction signal badges
// Covers both crypto signals (Favorable/Ideal/Certain) and stock signals (Up/Down/Unknown/Neutral)

export const SIGNAL_STYLES: Record<string, { bg: string; text: string }> = {
  Favorable: { bg: 'bg-[#238636]', text: 'text-white' },
  Ideal:     { bg: 'bg-[#238636]', text: 'text-white' },
  Certain:   { bg: 'bg-[#238636]', text: 'text-white' },
  Up:        { bg: 'bg-[rgba(63,185,80,0.15)]', text: 'text-[#3fb950]' },
  Down:      { bg: 'bg-[rgba(248,81,73,0.15)]', text: 'text-[#f85149]' },
  Neutral:   { bg: 'bg-[rgba(139,148,158,0.15)]', text: 'text-[#8b949e]' },
  Unknown:   { bg: 'bg-[rgba(210,153,34,0.15)]', text: 'text-[#d29922]' },
};

const DEFAULT_STYLE = { bg: 'bg-[#238636]', text: 'text-white' };

export function getSignalStyle(signal: string) {
  return SIGNAL_STYLES[signal] || DEFAULT_STYLE;
}
