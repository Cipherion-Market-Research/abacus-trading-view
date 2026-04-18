import * as React from "react";

interface AtlasLogoProps {
  size?: number;
  className?: string;
}

export function AtlasLogo({ size = 24, className }: AtlasLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="28" cy="28" r="22" stroke="#30363d" strokeWidth="1" />
      <circle cx="28" cy="28" r="14" stroke="#30363d" strokeWidth="1" />
      <g transform="rotate(45 28 28)">
        <path d="M28 6 L32 28 L28 50 L24 28 Z" fill="#3fb950" />
        <path d="M6 28 L28 24 L50 28 L28 32 Z" fill="#238636" />
      </g>
      <circle cx="28" cy="28" r="3" fill="#f0f6fc" />
    </svg>
  );
}

interface AtlasWordmarkProps {
  size?: number;
  showCpx?: boolean;
  className?: string;
}

export function AtlasWordmark({
  size = 24,
  showCpx = true,
  className,
}: AtlasWordmarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <AtlasLogo size={size} />
      <span className="inline-flex items-baseline text-[#f0f6fc] font-semibold tracking-tight text-base">
        {showCpx && (
          <span className="font-mono text-[10px] font-medium tracking-[0.12em] text-[#8b949e] uppercase pr-2 mr-2 border-r border-[#30363d]">
            CPX
          </span>
        )}
        Atlas
      </span>
    </span>
  );
}
