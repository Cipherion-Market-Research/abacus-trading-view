import * as React from "react";

interface AbacusLogoProps {
  size?: number;
  className?: string;
}

/**
 * Horizon mark — three layered prediction curves with a signal dot, framed in a squircle.
 * Sibling to Atlas's Polaris Crosshair: Atlas = navigation, Abacus = forecasting.
 * Geometry sourced from CipheX Atlas Design System / explorations / Concept 03.
 */
export function AbacusLogo({ size = 24, className }: AbacusLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="8"
        y="8"
        width="40"
        height="40"
        rx="10"
        fill="#161b22"
        stroke="#238636"
        strokeWidth="1.5"
      />
      <path
        d="M8 28 Q28 20 48 28"
        stroke="#3fb950"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M8 36 Q28 30 48 36"
        stroke="#3fb950"
        strokeWidth="2"
        strokeOpacity="0.6"
        fill="none"
      />
      <path
        d="M8 44 Q28 40 48 44"
        stroke="#3fb950"
        strokeWidth="2"
        strokeOpacity="0.3"
        fill="none"
      />
      <circle cx="28" cy="20" r="3" fill="#3fb950" />
    </svg>
  );
}

interface AbacusWordmarkProps {
  size?: number;
  text?: string;
  showLogo?: boolean;
  showCipheX?: boolean;
  compact?: boolean;
  className?: string;
}

export function AbacusWordmark({
  size = 24,
  text = "Abacus AMS",
  showLogo = true,
  showCipheX = true,
  compact = false,
  className,
}: AbacusWordmarkProps) {
  const textSize = compact ? "text-[20px]" : "text-base";
  const attributionSize = compact ? "text-[9px]" : "text-[10px]";
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {showLogo && <AbacusLogo size={size} />}
      <span
        className={`inline-flex items-baseline text-[#f0f6fc] font-semibold tracking-tight ${textSize} leading-none`}
      >
        {text}
        {showCipheX && (
          <span
            className={`font-mono ${attributionSize} font-medium tracking-[0.12em] text-[#8b949e] uppercase pl-2 ml-2 border-l border-[#30363d]`}
          >
            by CipheX
          </span>
        )}
      </span>
    </span>
  );
}
