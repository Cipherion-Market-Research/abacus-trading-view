"use client";

import { useState, useEffect } from "react";
import { C } from "./colors";
import { Eyebrow, Mono, Pill, Dot, BigNum, Spark } from "./primitives";
import type { TapeRow } from "./data";

export function DashboardPreview({
  accent,
  accentBg,
  tape,
}: {
  accent: string;
  accentBg: string;
  tape: TapeRow[];
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, []);
  const sliding = tape.slice(tick % 30, (tick % 30) + 8);

  return (
    <div className="pred-card" style={{ overflow: "hidden" }}>
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: `1px solid ${C.border}`,
          background: C.s2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Dot color={accent} pulse />
          <Mono size={11} color={C.fg} weight={500}>
            btc-sniper-prod · ECS Fargate
          </Mono>
          <Pill tone="neutral">eu-west-1</Pill>
        </div>
        <Mono size={11} color={C.muted}>
          uptime 99.5% · 64d 03h
        </Mono>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ padding: 16, borderRight: `1px solid ${C.border}` }}>
          <Eyebrow style={{ marginBottom: 10 }}>Cumulative WR · last 24h</Eyebrow>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <BigNum value="88.4" suffix="%" size={32} color={accent} />
            <Mono size={11} color={C.muted}>
              176 / 199 · +0.2 vs prior 24h
            </Mono>
          </div>
          <Spark
            data={[88.0, 88.1, 88.0, 88.3, 88.2, 88.4, 88.4, 88.5, 88.3, 88.4]}
            w={400}
            h={50}
            stroke={accent}
            fill={accentBg}
          />
        </div>
        <div style={{ padding: 16 }}>
          <Eyebrow style={{ marginBottom: 10 }}>T3 streak</Eyebrow>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <BigNum value="14" size={32} color={C.fg} />
            <Mono size={12} color={C.muted}>
              wins · 4d 8h since last loss
            </Mono>
          </div>
          <div style={{ display: "flex", gap: 3, marginTop: 14 }}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 24,
                  background: i < 14 ? accent : C.s2,
                  borderRadius: 2,
                  opacity: i < 14 ? 1 - i * 0.02 : 1,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Live tape */}
      <div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "70px 36px 56px 60px 60px 1fr 60px",
            padding: "8px 16px",
            background: C.bgDeep,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {["Time", "Tier", "Dir", "Margin", "Entry", "BTC", "Result"].map((h) => (
            <Eyebrow key={h} style={{ fontSize: 9 }}>
              {h}
            </Eyebrow>
          ))}
        </div>
        {sliding.map((r, i) => (
          <div
            key={`${r.ts}-${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 36px 56px 60px 60px 1fr 60px",
              padding: "7px 16px",
              borderBottom: i === sliding.length - 1 ? "none" : `1px solid ${C.border}`,
              opacity: 1 - i * 0.05,
              alignItems: "center",
            }}
          >
            <Mono size={11} color={C.subtle}>
              {r.ts}
            </Mono>
            <Mono size={11} color={r.tier === "T3" ? accent : C.muted} weight={500}>
              {r.tier}
            </Mono>
            <Mono size={11} color={r.dir === "UP" ? C.greenF : C.amber}>
              {r.dir}
            </Mono>
            <Mono size={11} color={C.muted}>
              {r.margin}
            </Mono>
            <Mono size={11} color={C.muted}>
              {r.px}
            </Mono>
            <Mono size={11} color={C.fgEmph}>
              ${r.btc}
            </Mono>
            <Mono size={11} color={r.result === "WIN" ? C.greenF : C.red} weight={500}>
              {r.result}
            </Mono>
          </div>
        ))}
      </div>
    </div>
  );
}
