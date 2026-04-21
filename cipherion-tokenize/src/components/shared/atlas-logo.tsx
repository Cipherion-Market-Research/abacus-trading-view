import * as React from "react";

interface AtlasLogoProps {
  size?: number;
  className?: string;
}

export function AtlasLogo({ size = 24, className }: AtlasLogoProps) {
  return (
    <svg
      {...(className ? {} : { width: size, height: size })}
      viewBox="4 4 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="28" cy="28" r="22" stroke="#30363d" strokeWidth="1.2" />
      <circle cx="28" cy="28" r="14" stroke="#30363d" strokeWidth="1.2" />
      <g transform="rotate(45 28 28)">
        <path d="M28 6 L32 28 L28 50 L24 28 Z" fill="#3fb950" />
        <path d="M6 28 L28 24 L50 28 L28 32 Z" fill="#238636" />
      </g>
      <circle cx="28" cy="28" r="3.2" fill="#f0f6fc" />
    </svg>
  );
}

interface AtlasWordmarkProps {
  size?: number;
  showCpx?: boolean;
  compact?: boolean;
  className?: string;
}

export function AtlasWordmark({
  size = 24,
  showCpx = true,
  compact = false,
  className,
}: AtlasWordmarkProps) {
  const textSize = compact ? "text-[20px]" : "text-base";
  const attributionSize = compact ? "text-[9px]" : "text-[10px]";
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <AtlasLogo size={size} />
      <span
        className={`inline-flex items-baseline text-[#f0f6fc] font-semibold tracking-tight ${textSize} leading-none`}
      >
        Atlas
        {showCpx && (
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
