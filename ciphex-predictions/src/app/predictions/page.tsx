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

export default function PredictionsPage() {
  const { mode, staleSince, D, tape, dashboard, wrSeries } = usePredStats();

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
              <span>m={r.margin}</span>
              <span>${r.btc}</span>
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
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: 128,
                  fontWeight: 600,
                  color: A,
                  letterSpacing: "-0.04em",
                  lineHeight: 0.9,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                96.3
              </span>
              <span
                style={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: 64,
                  fontWeight: 500,
                  color: A,
                  letterSpacing: "-0.02em",
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
              Full tier · |margin| ≥ 100 · 109 signals
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
              Capital deploys in three tranches at T-60s, T-45s, T-30s. Higher-conviction
              signals receive 90% of capital — and post 90.3% accuracy across 3,112 instances.
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
            <Eyebrow style={{ color: A, marginBottom: 10 }}>§02 · Margin</Eyebrow>
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
              &quot;Margin&quot; = BTC distance from strike at entry. The further from strike,
              the stronger the directional signal — accuracy rises monotonically through every
              band.
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
              90% of capital only deploys when all 15 independent gates agree. Each gate was
              developed from specific loss forensics and walk-forward validated before
              deployment.
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

            {/* Gates table */}
            <div
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                overflow: "hidden",
                background: C.s1,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr 60px 1fr 90px",
                  padding: ROW_PAD,
                  background: C.s2,
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                {["#", "Gate", "Ver", "Condition", "Fired"].map((h) => (
                  <Eyebrow key={h} style={{ fontSize: 9, color: C.muted }}>
                    {h}
                  </Eyebrow>
                ))}
              </div>
              {D.gates.map((g) => (
                <div
                  key={g.n}
                  className="pred-tape-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px 1fr 60px 1fr 90px",
                    padding: ROW_PAD,
                    borderBottom: `1px solid ${C.border}`,
                    alignItems: "center",
                  }}
                >
                  <Mono size={11} color={C.subtle}>
                    {String(g.n).padStart(2, "0")}
                  </Mono>
                  <span style={{ color: C.fg, fontSize: 12.5, fontWeight: 500 }}>{g.name}</span>
                  <Mono size={11} color={g.v === "v30" ? A : C.muted}>
                    {g.v}
                  </Mono>
                  <Mono size={11} color={C.muted}>
                    {g.blurb}
                  </Mono>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      justifyContent: "flex-end",
                    }}
                  >
                    <MiniBar
                      pct={Math.min(100, Math.log10(g.fired + 1) * 25)}
                      color={C.fgEmph}
                      w={48}
                    />
                    <Mono
                      size={11}
                      color={C.muted}
                      style={{ minWidth: 40, textAlign: "right" }}
                    >
                      {g.fired.toLocaleString()}
                    </Mono>
                  </div>
                </div>
              ))}
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
                const isLatest = i === 2;
                return (
                  <div
                    key={e.era}
                    style={{ background: isLatest ? C.s3 : C.s1, padding: 22 }}
                  >
                    <Eyebrow style={{ marginBottom: 6 }}>{e.era}</Eyebrow>
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
                        <Eyebrow style={{ fontSize: 9 }}>Gates</Eyebrow>
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
              Every position is logged to S3 JSONL with 60+ fields. The dashboard polls the
              bucket and surfaces gate fires, T3 entries, and PnL — all auditable.
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
              The only known 1-second Polymarket dataset
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
              Grows ~190 positions/day automatically. Backtesting ground truth.
            </div>
          </div>

          <div className="pred-card" style={{ padding: 24 }}>
            <Eyebrow style={{ color: A, marginBottom: 4 }}>§07 · Feeds</Eyebrow>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, marginBottom: 18 }}>
              Six independent data sources
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
              The same 88.2% directional signal applies wherever a 5-minute BTC window can be
              expressed. Polymarket pays binary; CEX perp futures pay proportional — the
              economics differ fundamentally.
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
              We&apos;ll walk through the live console, the gate logic, and the 11K-position
              dataset. 30 minutes, no slides.
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
      <footer className="border-t border-[#30363d] px-5 py-4 max-w-[1280px] mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          <AbacusWordmark size={18} text="Abacus Predictions" showCipheX compact />
        </div>
        <Mono size={11} color={C.subtle}>
          v30 · build 2026.04.27 · eu-west-1
        </Mono>
      </footer>
    </div>
  );
}
