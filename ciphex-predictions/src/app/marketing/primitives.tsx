"use client";

import React from "react";
import { Calendar, FileText, ArrowDown, Terminal } from "lucide-react";
import { C } from "./colors";

export function Eyebrow({
  children,
  color = C.muted,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 500,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Mono({
  children,
  size = 12,
  color = C.fg,
  weight = 400,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  weight?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: size,
        color,
        fontWeight: weight,
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
  style,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "blue" | "yellow" | "red" | "purple" | "amber" | "cyan";
  style?: React.CSSProperties;
}) {
  const tones: Record<string, { bg: string; fg: string; b: string }> = {
    neutral: { bg: C.s2, fg: C.muted, b: C.border },
    green: { bg: "rgba(63,185,80,0.15)", fg: C.greenF, b: "transparent" },
    blue: { bg: "rgba(88,166,255,0.10)", fg: C.blue, b: "transparent" },
    yellow: { bg: "rgba(210,153,34,0.15)", fg: C.yellow, b: "transparent" },
    red: { bg: "rgba(248,81,73,0.15)", fg: C.red, b: "transparent" },
    purple: { bg: "rgba(163,113,247,0.10)", fg: C.purple, b: "transparent" },
    amber: { bg: "rgba(251,191,36,0.15)", fg: C.amber, b: "transparent" },
    cyan: { bg: "rgba(34,211,238,0.15)", fg: C.cyan, b: "transparent" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 500,
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.b}`,
        fontFamily: "inherit",
        letterSpacing: "0.02em",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function Dot({
  color = C.greenF,
  size = 6,
  pulse = false,
}: {
  color?: string;
  size?: number;
  pulse?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: pulse ? `0 0 0 0 ${color}66` : "none",
        animation: pulse ? "pred-pulse 1.6s ease-out infinite" : "none",
      }}
    />
  );
}

export function CXMark({ size = 22, accent = C.greenF }: { size?: number; accent?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: accent,
          color: "#000",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.55,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          fontFamily: 'var(--font-geist-mono), monospace',
        }}
      >
        X
      </span>
      <span style={{ fontWeight: 600, letterSpacing: "-0.01em", fontSize: 13 }}>CipheX</span>
    </span>
  );
}

export function Spark({
  data,
  w = 80,
  h = 24,
  stroke = C.greenF,
  fill,
  baseline = false,
}: {
  data: number[];
  w?: number;
  h?: number;
  stroke?: string;
  fill?: string;
  baseline?: boolean;
}) {
  if (!data || !data.length) return null;
  const min = Math.min(...data),
    max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, h - ((v - min) / range) * (h - 2) - 1]);
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = fill ? d + ` L ${w},${h} L 0,${h} Z` : null;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {fill && area && <path d={area} fill={fill} />}
      {baseline && <line x1="0" y1={h - 1} x2={w} y2={h - 1} stroke={C.border} strokeWidth="1" />}
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MiniBar({
  pct,
  max = 100,
  color = C.greenF,
  w = 120,
  h = 4,
  bg = C.s2,
}: {
  pct: number;
  max?: number;
  color?: string;
  w?: number;
  h?: number;
  bg?: string;
}) {
  return (
    <div style={{ width: w, height: h, background: bg, borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${(pct / max) * 100}%`, height: "100%", background: color }} />
    </div>
  );
}

export function BigNum({
  value,
  suffix,
  color = C.fg,
  size = 56,
  weight = 600,
}: {
  value: string;
  suffix?: string;
  color?: string;
  size?: number;
  weight?: number;
}) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-geist-mono), monospace',
        fontSize: size,
        fontWeight: weight,
        color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}
    >
      {value}
      {suffix && (
        <span style={{ fontSize: size * 0.42, color: C.muted, marginLeft: 4 }}>{suffix}</span>
      )}
    </span>
  );
}

export { Calendar, FileText, ArrowDown, Terminal };

export function SharedStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      @keyframes pred-pulse {
        0% { box-shadow: 0 0 0 0 rgba(63,185,80,0.45); }
        70% { box-shadow: 0 0 0 6px rgba(63,185,80,0); }
        100% { box-shadow: 0 0 0 0 rgba(63,185,80,0); }
      }
      @keyframes pred-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
      .pred-cursor::after { content: "▍"; color: currentColor; margin-left: 2px; animation: pred-blink 1s steps(1) infinite; }
      .pred-tape-row:hover { background: ${C.s3}; }
      .pred-card { border: 1px solid ${C.border}; background: ${C.s1}; border-radius: 10px; }
      .pred-card-flat { border-top: 1px solid ${C.border}; border-bottom: 1px solid ${C.border}; background: ${C.s1}; }
      .pred-divider { border-top: 1px solid ${C.border}; }
      .pred-link { color: ${C.blue}; text-decoration: none; }
      .pred-link:hover { text-decoration: underline; }
      @keyframes pred-tape-scroll { from { transform: translateX(0) } to { transform: translateX(-50%) } }
    `,
      }}
    />
  );
}
