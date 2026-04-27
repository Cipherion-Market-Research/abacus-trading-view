"use client";

import { Calendar, FileText } from "lucide-react";
import { C } from "./colors";
import {
  Eyebrow,
  Mono,
  Pill,
  Dot,
  Spark,
  MiniBar,
  BigNum,
  SharedStyles,
} from "./primitives";
import { DashboardPreview } from "./dashboard-preview";
import { AbacusWordmark } from "@/components/shared/abacus-logo";
import { usePredStats } from "./use-pred-stats";

const A = C.blue;
const ABg = "rgba(88,166,255,0.10)";
const ROW_PAD = "7px 14px";

const GATE_LAYERS = [
  { cat: "Signal", tone: "blue" as const, title: "Signal Quality", gateNums: [1, 2, 3, 5, 9, 11], pitch: "Validates directional confidence, conviction levels, and historical signal integrity before position initiation." },
  { cat: "Microstructure", tone: "amber" as const, title: "Market Microstructure", gateNums: [6, 7, 13], pitch: "The highest-volume layer — filters adverse market structure, thin liquidity, and order book concentration risk." },
  { cat: "Execution", tone: "neutral" as const, title: "Execution Quality", gateNums: [4, 8, 12, 14], pitch: "Enforces operational entry quality: price levels, timing windows, momentum integrity, and directional ceiling." },
  { cat: "Regime", tone: "cyan" as const, title: "Market Regime", gateNums: [10, 15], pitch: "Market environment validation — cross-venue flow consistency and activity regime before directional commitment." },
];

export default function PredictionsPage() {
  const { mode, staleSince, D, tape, dashboard, wrSeries } = usePredStats();

  const GATE_CATS: Record<number, string> = {
    1: "Signal", 2: "Signal", 3: "Signal", 4: "Execution", 5: "Signal",
    6: "Microstructure", 7: "Microstructure", 8: "Execution", 9: "Signal",
    10: "Regime", 11: "Signal", 12: "Execution", 13: "Microstructure",
    14: "Execution", 15: "Regime",
  };

  const layerCards = GATE_LAYERS.map(l => ({
    ...l,
    gates: D.gates.filter(g => l.gateNums.includes(g.n)),
    total: D.gates.filter(g => l.gateNums.includes(g.n)).reduce((s, g) => s + g.fired, 0),
  }));

  return (
    <div
      style={{
        width: "100%",
        background: C.bg,
        color: C.fg,
        fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: 13,
        minHeight: "100vh",
      }}
    >
      <SharedStyles />

      {mode !== "live" && (
        <div
          className="text-xs font-mono px-5 py-2 border-b border-[#30363d]"
          style={{
            background: mode === "stale" ? "rgba(210,153,34,0.15)" : "rgba(88,166,255,0.10)",
            color: mode === "stale" ? C.yellow : C.blue,
          }}
        >
          {mode === "stale"
            ? `Data stale since ${staleSince ?? "unknown"} — live feed interrupted`
            : "Displaying cached metrics — live feed not connected"}
        </div>
      )}

      {/* ─── HEADER — mirrors Abacus AMS main repo: bg #161b22, px-5 py-3 ─── */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[#161b22] px-5 py-3 border-b border-[#30363d]">
        <div className="flex items-center gap-2.5">
          <h1 className="m-0">
            <AbacusWordmark showLogo={false} text="Abacus Predictions" showCipheX />
          </h1>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-linear-to-br from-[#238636] to-[#2ea043] text-white">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            Live
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a href="#signal" className="text-[#8b949e] hover:text-[#c9d1d9] text-xs transition-colors">Signal</a>
          <a href="#execution" className="text-[#8b949e] hover:text-[#c9d1d9] text-xs transition-colors">Execution</a>
          <a href="#dataset" className="text-[#8b949e] hover:text-[#c9d1d9] text-xs transition-colors">Dataset</a>
          <a href="#expansion" className="text-[#8b949e] hover:text-[#c9d1d9] text-xs transition-colors">Expansion</a>
          <a href="#roadmap" className="text-[#8b949e] hover:text-[#c9d1d9] text-xs transition-colors">Roadmap</a>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#238636] hover:bg-[#2ea043] text-white border border-[#238636] transition-colors cursor-pointer">
            <Calendar size={12} /> Schedule a Call
          </button>
        </div>
      </header>

      {/* ─── TICKER TAPE ─── */}
      <div
        style={{
          borderBottom: `1px solid ${C.border}`,
          background: C.bgDeep,
          padding: "6px 0",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 32,
            animation: "pred-tape-scroll 90s linear infinite",
            whiteSpace: "nowrap",
          }}
        >
          {[...tape, ...tape].slice(0, 60).map((r, i) => (
            <span
              key={i}
              style={{
                fontFamily: "var(--font-geist-mono)",
                fontSize: 11,
                color: C.muted,
                display: "inline-flex",
                gap: 6,
              }}
            >
              <span style={{ color: C.subtle }}>{r.ts}</span>
              <span style={{ color: r.tier === "T3" ? A : C.muted }}>{r.tier}</span>
              <span style={{ color: r.dir === "UP" ? C.greenF : C.amber }}>{r.dir}</span>
              <span>cs={r.margin}</span>
              {r.btc && r.btc !== "—" && <span>${r.btc}</span>}
              <span style={{ color: r.result === "WIN" ? C.greenF : C.red }}>
                {r.result === "WIN" ? "✓" : "✗"}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ─── HERO: 96.3% extreme conviction ─── */}
      <section style={{ padding: "56px 32px 40px", maxWidth: 1280, margin: "0 auto" }}>
        <Eyebrow style={{ marginBottom: 24 }}>
          Abacus Predictions · Engine Performance Brief
        </Eyebrow>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
            gap: 56,
            alignItems: "end",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, filter: "drop-shadow(0 0 24px rgba(88,166,255,0.28))" }}>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: 128,
                  fontWeight: 600,
                  letterSpacing: "-0.04em",
                  lineHeight: 0.9,
                  fontVariantNumeric: "tabular-nums",
                  background: "linear-gradient(165deg, #e8f4ff 0%, #a8d4ff 30%, #58a6ff 60%, rgba(88,166,255,0.65) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                96.3
              </span>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: 64,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  background: "linear-gradient(165deg, #e8f4ff 0%, #a8d4ff 30%, #58a6ff 60%, rgba(88,166,255,0.65) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                %
              </span>
            </div>
            <h1
              style={{
                margin: "20px 0 8px",
                fontWeight: 500,
                fontSize: 24,
                color: C.fg,
                letterSpacing: "-0.01em",
                maxWidth: 580,
                lineHeight: 1.25,
              }}
            >
              accuracy at extreme conviction
            </h1>
            <div style={{ color: C.muted, fontSize: 14 }}>
              Extreme conviction tier · 109 signals
            </div>
          </div>
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 24 }}>
            <Eyebrow style={{ marginBottom: 12 }}>Run summary</Eyebrow>
            {(
              [
                ["Positions", D.hero.positions.toLocaleString()],
                ["Days continuous", String(D.hero.days)],
                ["Signals / day", String(D.hero.signalsPerDay)],
                ["Risk gates", String(D.hero.gates)],
                ["Uptime", "99.5%"],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "7px 0",
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <span style={{ color: C.muted, fontSize: 12 }}>{k}</span>
                <Mono size={12} color={C.fg} weight={500}>
                  {v}
                </Mono>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── §01 ACCURACY MATRIX ─── */}
      <section
        id="signal"
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "48px 32px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "240px 1fr",
            gap: 56,
            alignItems: "start",
          }}
        >
          <div>
            <Eyebrow style={{ color: A, marginBottom: 10 }}>§01 · Signal</Eyebrow>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                color: C.fg,
                letterSpacing: "-0.01em",
              }}
            >
              Accuracy by tier
            </h2>
            <p style={{ marginTop: 10, color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
              Capital deploys in staged tranches across a defined execution window.
              Higher-conviction signals receive 90% of capital — and post 90.3% accuracy
              across 3,112 instances.
            </p>
          </div>
          <div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Tier", "Win rate", "n", "Per day", "Profile"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i === 0 ? "left" : i === 4 ? "left" : "right",
                        padding: ROW_PAD,
                        fontSize: 10,
                        fontWeight: 500,
                        color: C.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {D.tiers.map((t, i) => (
                  <tr
                    key={t.id}
                    className="pred-tape-row"
                    style={{ borderBottom: `1px solid ${C.border}` }}
                  >
                    <td style={{ padding: ROW_PAD }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Mono size={11} color={C.subtle}>
                          {String(i + 1).padStart(2, "0")}
                        </Mono>
                        <span style={{ color: C.fg, fontWeight: 500 }}>{t.label}</span>
                      </div>
                    </td>
                    <td style={{ padding: ROW_PAD, textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 10,
                          justifyContent: "flex-end",
                        }}
                      >
                        <MiniBar
                          pct={t.wr}
                          color={t.wr >= 95 ? A : t.wr >= 90 ? C.greenF : C.fgEmph}
                          w={70}
                        />
                        <Mono size={13} color={C.fg} weight={500}>
                          {t.wr.toFixed(1)}%
                        </Mono>
                      </div>
                    </td>
                    <td style={{ padding: ROW_PAD, textAlign: "right" }}>
                      <Mono size={12} color={C.muted}>
                        {t.n.toLocaleString()}
                      </Mono>
                    </td>
                    <td style={{ padding: ROW_PAD, textAlign: "right" }}>
                      <Mono size={12} color={C.muted}>
                        {t.perDay}
                      </Mono>
                    </td>
                    <td style={{ padding: ROW_PAD, color: C.muted, fontSize: 12 }}>
                      {t.blurb}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── §02 MARGIN BANDS ─── */}
      <section
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "48px 32px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "240px 1fr",
            gap: 56,
            alignItems: "start",
          }}
        >
          <div>
            <Eyebrow style={{ color: A, marginBottom: 10 }}>§02 · Conviction</Eyebrow>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                color: C.fg,
                letterSpacing: "-0.01em",
              }}
            >
              Accuracy scales with conviction
            </h2>
            <p style={{ marginTop: 10, color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
              Our proprietary conviction score measures directional confidence at entry.
              Accuracy scales consistently — the validation stack is designed so that
              higher-conviction signals carry higher predictive power, band over band.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 1,
              background: C.border,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {D.marginBands.map((b, i) => {
              const high = b.wr >= 95;
              return (
                <div
                  key={i}
                  style={{
                    background: C.s1,
                    padding: "20px 14px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: 160,
                  }}
                >
                  <div>
                    <Mono size={10} color={C.subtle} weight={500}>
                      {b.range}
                    </Mono>
                  </div>
                  <div>
                    <BigNum
                      value={b.wr.toFixed(1)}
                      suffix="%"
                      size={28}
                      color={high ? A : C.fg}
                    />
                    <div
                      style={{
                        marginTop: 14,
                        height: 3,
                        background: C.s2,
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${((b.wr - 80) / 20) * 100}%`,
                          height: "100%",
                          background: high ? A : C.fgEmph,
                        }}
                      />
                    </div>
                    <Mono size={10} color={C.muted} style={{ marginTop: 8, display: "block" }}>
                      n={b.n.toLocaleString()}
                    </Mono>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── §03 TRANCHES + GATES ─── */}
      <section
        id="execution"
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "48px 32px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "240px 1fr",
            gap: 56,
            alignItems: "start",
          }}
        >
          <div>
            <Eyebrow style={{ color: A, marginBottom: 10 }}>§03 · Execution</Eyebrow>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                color: C.fg,
                letterSpacing: "-0.01em",
              }}
            >
              Tiered entry · 15-gate stack
            </h2>
            <p style={{ marginTop: 10, color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
              90% of capital only deploys when our complete validation suite independently
              confirms the opportunity. Each layer was derived from rigorous loss attribution
              and validated out-of-sample before production.
            </p>
          </div>
          <div>
            {/* Tranches */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {D.tranches.map((t, i) => (
                <div key={t.id} className="pred-card" style={{ padding: 18 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <Mono size={11} color={C.muted}>
                      {t.timing}
                    </Mono>
                    <Pill tone={i === 2 ? "blue" : "neutral"}>{t.id}</Pill>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.fg, marginBottom: 4 }}>
                    {t.label}
                  </div>
                  <div
                    style={{
                      color: C.muted,
                      fontSize: 12,
                      lineHeight: 1.5,
                      minHeight: 36,
                    }}
                  >
                    {t.blurb}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      marginTop: 16,
                      paddingTop: 12,
                      borderTop: `1px solid ${C.border}`,
                    }}
                  >
                    <div>
                      <Eyebrow style={{ fontSize: 9, marginBottom: 2 }}>Capital</Eyebrow>
                      <Mono size={16} color={C.fg} weight={500}>
                        {t.capital}%
                      </Mono>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Eyebrow style={{ fontSize: 9, marginBottom: 2 }}>Win rate</Eyebrow>
                      <Mono size={16} color={i === 2 ? A : C.fg} weight={500}>
                        {t.wr.toFixed(1)}%
                      </Mono>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ─── §03 Gate architecture ─── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {layerCards.map(layer => (
                <div key={layer.cat} className="pred-card" style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <Pill tone={layer.tone}>{layer.cat}</Pill>
                      <div style={{ marginTop: 8, fontSize: 13.5, fontWeight: 600, color: C.fg, letterSpacing: "-0.01em" }}>{layer.title}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Eyebrow style={{ fontSize: 9, marginBottom: 3 }}>{layer.gates.length} gates</Eyebrow>
                      <Mono size={11} color={C.subtle}>{layer.total.toLocaleString()} total fires</Mono>
                    </div>
                  </div>
                  <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.55, marginBottom: 12 }}>{layer.pitch}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {layer.gates.map(g => (
                      <Pill key={g.n} tone="neutral">{g.name}</Pill>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", background: C.s2, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <Mono size={11} color={C.muted}>15 independent conditions · sequential validation</Mono>
                <Mono size={11} color={C.subtle}>All must pass before capital deploys</Mono>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── §04 T3 ERAS ─── */}
      <section
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "48px 32px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "240px 1fr",
            gap: 56,
            alignItems: "start",
          }}
        >
          <div>
            <Eyebrow style={{ color: A, marginBottom: 10 }}>§04 · Stability</Eyebrow>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                color: C.fg,
                letterSpacing: "-0.01em",
              }}
            >
              No alpha decay across 64 days
            </h2>
            <p style={{ marginTop: 10, color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
              Win rate has improved over time, not degraded — consistent with continued R&D
              adding signal quality. T3 conviction tier is the cleanest readout.
            </p>
          </div>
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1,
                background: C.border,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {D.t3Eras.map((e, i) => {
                const isLatest = i === D.t3Eras.length - 1;
                const phase = ["Phase I", "Phase II", "Phase III", "Phase IV", "Phase V"][i] ?? `Phase ${i + 1}`;
                return (
                  <div
                    key={i}
                    style={{ background: isLatest ? C.s3 : C.s1, padding: 22 }}
                  >
                    <Eyebrow style={{ marginBottom: 6 }}>{phase}</Eyebrow>
                    <Mono size={11} color={C.subtle}>
                      {e.span}
                    </Mono>
                    <div style={{ marginTop: 24, marginBottom: 14 }}>
                      <BigNum
                        value={e.wr.toFixed(1)}
                        suffix="%"
                        size={36}
                        color={isLatest ? A : C.fg}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        paddingTop: 12,
                        borderTop: `1px solid ${C.border}`,
                      }}
                    >
                      <div>
                        <Eyebrow style={{ fontSize: 9 }}>W–L</Eyebrow>
                        <Mono size={13} color={C.fg} weight={500}>
                          {e.w}–{e.l}
                        </Mono>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Eyebrow style={{ fontSize: 9 }}>Gates active</Eyebrow>
                        <Mono size={13} color={C.fg} weight={500}>
                          {e.gates}
                        </Mono>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                marginTop: 16,
                padding: "14px 18px",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                background: C.s1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <Eyebrow style={{ marginBottom: 4 }}>
                  Rolling 14-day WR · all positions
                </Eyebrow>
                <Mono size={12} color={C.muted}>
                  min 87.6 · max 88.6 · σ ≈ 0.27
                </Mono>
              </div>
              <Spark data={D.wrSeries} w={240} h={36} stroke={A} fill={ABg} baseline />
            </div>
          </div>
        </div>
      </section>

      {/* ─── §05 DASHBOARD PREVIEW ─── */}
      <section
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "48px 32px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "240px 1fr",
            gap: 56,
            alignItems: "start",
          }}
        >
          <div>
            <Eyebrow style={{ color: A, marginBottom: 10 }}>§05 · Telemetry</Eyebrow>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                color: C.fg,
                letterSpacing: "-0.01em",
              }}
            >
              Live operations console
            </h2>
            <p style={{ marginTop: 10, color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
              Every position is logged to a structured event store with 60+ fields per record.
              The dashboard surfaces signal events, conviction-tier entries, and running
              performance — all auditable and available in the data room.
            </p>
          </div>
          <DashboardPreview accent={A} accentBg={ABg} tape={tape} stats={dashboard} />
        </div>
      </section>

      {/* ─── §06 + §07 DATASET + FEEDS ─── */}
      <section
        id="dataset"
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "48px 32px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div className="pred-card" style={{ padding: 24 }}>
            <Eyebrow style={{ color: A, marginBottom: 4 }}>§06 · Dataset</Eyebrow>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, marginBottom: 18 }}>
              The only known high-resolution prediction market dataset
            </h3>
            {D.dataset.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
                  gap: 12,
                  alignItems: "baseline",
                }}
              >
                <div>
                  <div style={{ color: C.fg, fontSize: 12.5, fontWeight: 500 }}>{r.what}</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{r.note}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Mono size={13} color={A} weight={600}>
                    {r.count}
                  </Mono>
                  <div style={{ color: C.subtle, fontSize: 10 }}>{r.fields}</div>
                </div>
              </div>
            ))}
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: `1px solid ${C.border}`,
                color: C.muted,
                fontSize: 11.5,
              }}
            >
              Grows continuously with every production cycle — the only known sub-second prediction market dataset of its kind.
            </div>
          </div>

          <div className="pred-card" style={{ padding: 24 }}>
            <Eyebrow style={{ color: A, marginBottom: 4 }}>§07 · Feeds</Eyebrow>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, marginBottom: 18 }}>
              A proprietary multi-source data stack
            </h3>
            {D.feeds.map((f, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.fg, fontSize: 12.5, fontWeight: 500 }}>
                      {f.name}
                    </span>
                    {f.propr && <Pill tone="blue">Proprietary</Pill>}
                  </div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{f.role}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Mono size={11} color={C.fgEmph}>
                    {f.proto}
                  </Mono>
                  <div style={{ color: C.subtle, fontSize: 10 }}>{f.rate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── §08 EXPANSION ─── */}
      <section
        id="expansion"
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "48px 32px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 56 }}>
          <div>
            <Eyebrow style={{ color: A, marginBottom: 10 }}>§08 · Surface</Eyebrow>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                color: C.fg,
                letterSpacing: "-0.01em",
              }}
            >
              Venue-agnostic signal engine
            </h2>
            <p style={{ marginTop: 10, color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
              The same directional signal framework applies across venue types wherever an
              equivalent short-window BTC market exists. Binary prediction markets and
              perpetual futures have fundamentally different payoff structures — both are
              addressable.
            </p>
          </div>
          <div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
              }}
            >
              <thead>
                <tr style={{ background: C.s2 }}>
                  {["Asset", "Venue", "Status", "Signals/day", "Note"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: ROW_PAD,
                        fontSize: 10,
                        fontWeight: 500,
                        color: C.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {D.expansion.map((e, i) => (
                  <tr
                    key={i}
                    className="pred-tape-row"
                    style={{
                      borderBottom:
                        i === D.expansion.length - 1
                          ? "none"
                          : `1px solid ${C.border}`,
                    }}
                  >
                    <td style={{ padding: ROW_PAD }}>
                      <Mono size={12} color={C.fg} weight={500}>
                        {e.asset}
                      </Mono>
                    </td>
                    <td style={{ padding: ROW_PAD, color: C.fg, fontSize: 12.5 }}>
                      {e.venue}
                    </td>
                    <td style={{ padding: ROW_PAD }}>
                      <Pill
                        tone={
                          e.status === "Production"
                            ? "blue"
                            : e.status === "Planned"
                              ? "neutral"
                              : "amber"
                        }
                      >
                        {e.status}
                      </Pill>
                    </td>
                    <td style={{ padding: ROW_PAD }}>
                      <Mono size={12} color={C.muted}>
                        {e.perDay}
                      </Mono>
                    </td>
                    <td style={{ padding: ROW_PAD, color: C.muted, fontSize: 12 }}>
                      {e.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── §09 ROADMAP ─── */}
      <section
        id="roadmap"
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "48px 32px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 56, alignItems: "start" }}>
          <div>
            <Eyebrow style={{ color: A, marginBottom: 10 }}>§09 · Roadmap</Eyebrow>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: C.fg, letterSpacing: "-0.01em" }}>
              Growth trajectory
            </h2>
            <p style={{ marginTop: 10, color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
              The signal engine is live and compounding. Expansion proceeds in three stages —
              asset coverage, venue diversification, and institutional distribution.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            {([
              {
                phase: "Now",
                tone: "blue" as const,
                title: "BTC/USD Live",
                points: [
                  "88.2% directional accuracy · 187 signals/day",
                  "15-layer validation stack · 11,000+ position dataset",
                  "Binary prediction market venue · continuous operation since Feb 2026",
                ],
              },
              {
                phase: "Near-term",
                tone: "neutral" as const,
                title: "Multi-Asset Expansion",
                points: [
                  "ETH/USD, SOL/USD, XRP/USD via standard asset port",
                  "~4× daily signal volume across the combined portfolio",
                  "Cross-asset signal correlation research underway",
                ],
              },
              {
                phase: "Mid-term",
                tone: "neutral" as const,
                title: "Venue Diversification",
                points: [
                  "Regulated event exchange — parallel to current venue",
                  "Derivatives exchange integration — symmetric payoff structure",
                  "Multi-venue position capture and reconciliation",
                ],
              },
              {
                phase: "Long-term",
                tone: "neutral" as const,
                title: "Institutional Signal Product",
                points: [
                  "Multi-asset signal ensemble with portfolio-level risk controls",
                  "Institutional API — signal access for qualified counterparties",
                  "Proprietary dataset licensing — the 11K+ position archive as a product",
                ],
              },
            ] as const).map((item) => (
              <div
                key={item.phase}
                style={{
                  background: item.tone === "blue" ? C.s3 : C.s1,
                  padding: "20px 24px",
                  display: "grid",
                  gridTemplateColumns: "120px 1fr",
                  gap: 24,
                  alignItems: "start",
                }}
              >
                <div>
                  <Pill tone={item.tone} style={{ marginBottom: 8 }}>{item.phase}</Pill>
                  <div style={{ color: C.fg, fontSize: 13, fontWeight: 600, marginTop: 6 }}>
                    {item.title}
                  </div>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                  {item.points.map((pt) => (
                    <li key={pt} style={{ display: "flex", alignItems: "baseline", gap: 8, color: C.muted, fontSize: 12 }}>
                      <span style={{ color: A, flexShrink: 0, fontSize: 10 }}>▸</span>
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "64px 32px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 40,
            alignItems: "end",
          }}
        >
          <div>
            <Eyebrow style={{ color: A, marginBottom: 12 }}>Engagement</Eyebrow>
            <h2
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                maxWidth: 700,
              }}
            >
              Schedule a working session with the operators.
            </h2>
            <p
              style={{
                marginTop: 16,
                color: C.muted,
                fontSize: 14,
                maxWidth: 540,
                lineHeight: 1.55,
              }}
            >
              We&apos;ll walk through the live console, the validation framework, and the
              full position dataset. 30 minutes, no slides.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-[#238636] hover:bg-[#2ea043] text-white border border-[#238636] transition-colors cursor-pointer">
              <Calendar size={14} /> Schedule a Call
            </button>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] transition-colors cursor-pointer">
              <FileText size={14} /> Data Room
            </button>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="w-full border-t border-[#21262d]">
        {/* Top: wordmark + nav */}
        <div className="mx-auto w-full max-w-[1280px] px-5 md:px-8 py-10 md:py-14">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10 lg:gap-0">
            <div className="shrink-0">
              <AbacusWordmark showLogo={false} text="Abacus Predictions" showCipheX />
            </div>
            <nav className="flex flex-row gap-12">
              <div className="flex flex-col gap-3">
                <h3 style={{ color: C.fg, fontWeight: 600, fontSize: 13, margin: 0 }}>Engine</h3>
                <div className="flex flex-col gap-2">
                  {[["Signal", "#signal"], ["Execution", "#execution"], ["Dataset", "#dataset"], ["Expansion", "#expansion"], ["Roadmap", "#roadmap"]].map(([label, href]) => (
                    <a key={href} href={href} className="text-[#8b949e] hover:text-[#3fb950] text-xs transition-colors">{label}</a>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <h3 style={{ color: C.fg, fontWeight: 600, fontSize: 13, margin: 0 }}>Engage</h3>
                <div className="flex flex-col gap-2">
                  <a href="https://ciphex.io/contact" className="text-[#8b949e] hover:text-[#3fb950] text-xs transition-colors">Schedule a Call</a>
                  <a href="https://ciphex.io/contact" className="text-[#8b949e] hover:text-[#3fb950] text-xs transition-colors">Data Room</a>
                </div>
              </div>
            </nav>
          </div>
        </div>

        {/* Methodology disclaimer */}
        <div className="border-t border-[#21262d]">
          <div className="mx-auto w-full max-w-[1280px] px-5 md:px-8 py-5">
            <Mono size={11} color={C.subtle} style={{ display: "block", lineHeight: 1.7 }}>
              Signal generation parameters, risk filter conditions, and data feed weightings are proprietary and are not disclosed publicly. Performance statistics reflect live production results.
            </Mono>
          </div>
        </div>

        {/* Important Notice */}
        <div className="border-t border-[#21262d]">
          <div className="mx-auto w-full max-w-[1280px] px-5 md:px-8 py-8 md:py-10">
            <p style={{ color: C.fg, fontWeight: 600, fontSize: 11, marginBottom: 10 }}>
              Important Notice to Reader
            </p>
            <p style={{ color: C.subtle, fontSize: 10, lineHeight: 1.7, textAlign: "justify" }}>
              The following information is strictly for presentation and illustrative purposes only. It does not constitute an offer to sell, a solicitation of an offer to buy, or a recommendation to invest in any securities, digital assets, investment products, or financial instruments associated with the Alpha Centurion Network (Alpha CPX) or CipheX Capital Ecosystem (collectively referred to as CipheX). No information contained herein should be construed as investment, legal, accounting, or tax advice. You should not rely on any information on this website as a substitute for professional advice from qualified advisors. Any descriptions of potential market strategies, financial models, or projected outcomes are provided solely for illustrative purposes. Participation in digital asset markets involves substantial risk, including the potential loss of your entire investment. Digital assets may be subject to extreme volatility, limited liquidity, and rapidly evolving legal and regulatory frameworks. No assurance can be given that any investment or trading activity will achieve favorable or expected outcomes. Any statements or representations not originating directly from CipheX, Cipherion Capital SA, or its authorized affiliates are unauthorized and expressly disclaimed. CipheX reserves the right to update or modify any information published on its website at any time without advanced notice.{" "}
              <strong style={{ color: C.muted }}>Past performance is not indicative of future results.</strong>
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#21262d]">
          <div className="mx-auto w-full max-w-[1280px] px-5 md:px-8 py-5 md:py-6 flex flex-col lg:flex-row items-center justify-between gap-4">
            <p style={{ color: C.subtle, fontSize: 11 }}>
              &copy; 2026{" "}
              <a
                href="https://www.cipherion.co/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.subtle }}
                className="hover:text-[#f0f6fc] transition-colors"
              >
                Cipherion Capital SA
              </a>
              {" · "}CipheX Capital Ecosystem
            </p>
            <div className="flex items-center gap-6">
              <a href="https://ciphex.io/terms-of-use" style={{ color: C.subtle, fontSize: 11 }} className="hover:text-[#3fb950] transition-colors">Terms of Use</a>
              <a href="https://ciphex.io/privacy-policy" style={{ color: C.subtle, fontSize: 11 }} className="hover:text-[#3fb950] transition-colors">Privacy Policy</a>
              <a href="https://ciphex.io/contact" style={{ color: C.subtle, fontSize: 11 }} className="hover:text-[#3fb950] transition-colors">Contact</a>
            </div>
            <a
              href="https://ciphex.io"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.subtle, fontSize: 11, fontWeight: 600 }}
              className="hover:text-[#3fb950] transition-colors"
            >
              Powered by Cipherion (CPX)
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
