"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Product = "ams" | "predictions";

interface AbacusSwitcherProps {
  current: Product;
  homeHref?: string;
  siblingHref?: string;
  showLogo?: boolean;
  showCipheX?: boolean;
  size?: number;
  compact?: boolean;
  className?: string;
}

const DWELL_MS = 650;
const CLOSE_GRACE_MS = 140;

const LABEL: Record<Product, string> = {
  ams: "AMS",
  predictions: "Predictions",
};

function siblingOf(current: Product): Product {
  return current === "ams" ? "predictions" : "ams";
}

/**
 * Production layout:
 *   AMS at         charts.ciphex.io/         (treated as the homepage)
 *   Predictions at charts.ciphex.io/predictions
 *
 * Both apps read the same two env vars so the component can resolve
 * BOTH home and sibling URLs from the current product.
 */
function urlFor(product: Product): string {
  if (product === "ams") {
    return process.env.NEXT_PUBLIC_ABACUS_AMS_URL ?? "/";
  }
  return process.env.NEXT_PUBLIC_ABACUS_PREDICTIONS_URL ?? "/predictions";
}

function AbacusMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
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
      <path d="M8 28 Q28 20 48 28" stroke="#3fb950" strokeWidth="2" fill="none" />
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

export function AbacusSwitcher({
  current,
  homeHref,
  siblingHref,
  showLogo = true,
  showCipheX = true,
  size = 24,
  compact = false,
  className,
}: AbacusSwitcherProps) {
  const [armed, setArmed] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentText = LABEL[current];
  const sibling = siblingOf(current);
  const siblingText = LABEL[sibling];
  const resolvedHome = homeHref ?? urlFor(current);
  const resolvedSibling = siblingHref ?? urlFor(sibling);
  const liveHref = armed ? resolvedSibling : resolvedHome;

  function clearOpen() {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }
  function clearClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function scheduleOpen() {
    clearClose();
    if (openTimer.current || armed) return;
    openTimer.current = setTimeout(() => {
      setArmed(true);
      openTimer.current = null;
    }, DWELL_MS);
  }
  function scheduleClose() {
    clearOpen();
    closeTimer.current = setTimeout(() => {
      setArmed(false);
      closeTimer.current = null;
    }, CLOSE_GRACE_MS);
  }

  useEffect(() => {
    return () => {
      clearOpen();
      clearClose();
    };
  }, []);

  const textSize = compact ? "text-[15px]" : "text-base";
  const cpxSize = compact ? "text-[9px]" : "text-[10px]";

  return (
    <a
      href={liveHref}
      className={cn(
        "abacus-switcher group inline-flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#3fb950]/50",
        className,
      )}
      data-armed={armed ? "1" : "0"}
      aria-label={
        armed
          ? `Switch to Abacus ${siblingText}`
          : `Abacus ${currentText} home`
      }
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onFocus={() => setArmed(true)}
      onBlur={() => setArmed(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setArmed(false);
      }}
    >
      {showLogo && <AbacusMark size={size} />}
      <span
        className={cn(
          "inline-flex items-baseline font-semibold tracking-tight text-[#f0f6fc] leading-none",
          textSize,
        )}
      >
        Abacus&nbsp;
        <span className="abacus-switcher__morph relative inline-block overflow-hidden align-bottom">
          <span className="abacus-switcher__a">{currentText}</span>
          <span className="abacus-switcher__b">{siblingText} →</span>
        </span>
        <span className="abacus-switcher__hint" aria-hidden="true">
          switch
        </span>
        {showCipheX && (
          <span
            className={cn(
              "font-mono font-medium tracking-[0.12em] text-[#8b949e] uppercase pl-2 ml-2 border-l border-[#30363d]",
              cpxSize,
            )}
          >
            by CipheX
          </span>
        )}
      </span>
    </a>
  );
}
