export const C = {
  bg: "#0d1117",
  bgDeep: "#010409",
  s1: "#161b22",
  s2: "#21262d",
  s3: "#1c2129",
  border: "#30363d",
  borderS: "#484f58",
  fg: "#f0f6fc",
  fgEmph: "#c9d1d9",
  muted: "#8b949e",
  subtle: "#6e7681",
  green: "#238636",
  greenH: "#2ea043",
  greenF: "#3fb950",
  blue: "#58a6ff",
  purple: "#a371f7",
  yellow: "#d29922",
  red: "#f85149",
  amber: "#fbbf24",
  cyan: "#22d3ee",
} as const;

export type Accent = "green" | "blue";
export type Density = "compact" | "roomy";
export type HeadlineMode = "accuracy" | "positions" | "extreme" | "triple";

export function accentColor(accent: Accent) {
  return accent === "blue" ? C.blue : C.greenF;
}
export function accentBg(accent: Accent) {
  return accent === "blue" ? "rgba(88,166,255,0.10)" : "rgba(63,185,80,0.15)";
}
