"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ProductId = "ams" | "predictions" | "atlas" | "markets";

interface Product {
  id: ProductId;
  name: string;
  desc: string;
  href: string | null;
  soon?: boolean;
}

const PRODUCTS: Product[] = [
  { id: "ams", name: "Abacus AMS", desc: "Real-time charting & multi-venue aggregation", href: process.env.NEXT_PUBLIC_ABACUS_AMS_URL ?? "/" },
  { id: "predictions", name: "Predictions", desc: "Forecasting engine & signal performance", href: process.env.NEXT_PUBLIC_ABACUS_PREDICTIONS_URL ?? "/predictions" },
  { id: "atlas", name: "Atlas", desc: "RWA tokenization & compliance", href: "https://ciphex-atlas.vercel.app" },
  { id: "markets", name: "Markets", desc: "Cross-venue order routing", href: "https://ams.ciphex.io/" },
];

function AbacusMark({ size = 18, color = "#3fb950" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="40" height="40" rx="10" fill="#161b22" stroke="#238636" strokeWidth="1.5" />
      <path d="M8 28 Q28 20 48 28" stroke={color} strokeWidth="2" fill="none" />
      <path d="M8 36 Q28 30 48 36" stroke={color} strokeWidth="2" strokeOpacity="0.6" fill="none" />
      <circle cx="28" cy="20" r="3" fill={color} />
    </svg>
  );
}

function AtlasMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="4 4 48 48" fill="none" aria-hidden="true">
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

function MarketsMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <circle cx="100" cy="100" r="100" fill="#161b22" />
      <path d="M100 30 L60 80 L100 130 L140 80 Z" stroke="#f0f6fc" strokeWidth="10" fill="none" strokeLinejoin="round" />
      <path d="M100 70 L60 120 L100 170 L140 120 Z" stroke="#f0f6fc" strokeWidth="10" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS: Record<ProductId, (s: number) => React.ReactNode> = {
  ams: (s) => <AbacusMark size={s} color="#3fb950" />,
  predictions: (s) => <AbacusMark size={s} color="#58a6ff" />,
  atlas: (s) => <AtlasMark size={s} />,
  markets: (s) => <MarketsMark size={s} />,
};

interface ProductSwitcherSheetProps {
  current: ProductId;
}

export function BentoTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="pss-bento-trigger"
      onClick={onClick}
      aria-label="Switch product"
      aria-haspopup="dialog"
      type="button"
    >
      <i /><i /><i /><i /><i /><i /><i /><i /><i />
    </button>
  );
}

export function ProductSwitcherSheet({ current }: ProductSwitcherSheetProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startY: 0, currentY: 0, dragging: false });

  useEffect(() => { setMounted(true); }, []);

  const close = useCallback(() => {
    setOpen(false);
    document.body.style.overflow = "";
  }, []);

  const openSheet = useCallback(() => {
    setOpen(true);
    document.body.style.overflow = "hidden";
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  function onTouchStart(e: React.TouchEvent) {
    dragRef.current.startY = e.touches[0].clientY;
    dragRef.current.currentY = dragRef.current.startY;
    dragRef.current.dragging = true;
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragRef.current.dragging) return;
    dragRef.current.currentY = e.touches[0].clientY;
    const dy = Math.max(0, dragRef.current.currentY - dragRef.current.startY);
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
  }

  function onTouchEnd() {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "";
      sheetRef.current.style.transform = "";
    }
    const dy = dragRef.current.currentY - dragRef.current.startY;
    if (dy > 80) close();
  }

  if (!mounted) return <BentoTrigger onClick={() => {}} />;

  return (
    <>
      <BentoTrigger onClick={openSheet} />
      {createPortal(
        <>
          <div
            className={`pss-backdrop ${open ? "pss-open" : ""}`}
            onClick={close}
            aria-hidden="true"
          />
          <div
            ref={sheetRef}
            className={`pss-sheet ${open ? "pss-open" : ""}`}
            role="dialog"
            aria-label="Abacus apps"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="pss-handle" />
            <div className="pss-header">
              <span className="pss-title">Abacus apps</span>
              <button className="pss-close" onClick={close} aria-label="Close" type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="pss-grid">
              {PRODUCTS.map((p) => {
                const isCurrent = p.id === current;
                if (p.soon) {
                  return (
                    <div key={p.id} className="pss-card pss-soon">
                      <span className="pss-card-icon">{ICONS[p.id](18)}</span>
                      <span className="pss-card-label">{p.name}</span>
                      <span className="pss-card-desc">{p.desc}</span>
                      <span className="pss-soon-badge">Coming soon</span>
                    </div>
                  );
                }
                return (
                  <a
                    key={p.id}
                    href={isCurrent ? undefined : (p.href ?? "/")}
                    className={`pss-card ${isCurrent ? "pss-current" : ""}`}
                    onClick={isCurrent ? (e) => { e.preventDefault(); close(); } : undefined}
                  >
                    {isCurrent && <span className="pss-current-badge">Current</span>}
                    <span className="pss-card-icon">{ICONS[p.id](18)}</span>
                    <span className="pss-card-label">{p.name}</span>
                    <span className="pss-card-desc">{p.desc}</span>
                  </a>
                );
              })}
            </div>
            <div className="pss-footer">
              <span className="pss-cpx">X</span>
              <span>CipheX Capital Ecosystem</span>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
