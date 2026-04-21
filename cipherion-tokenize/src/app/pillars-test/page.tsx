"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  MarketingNav,
  MarketingFooter,
} from "@/components/landing/marketing-chrome";

/* ─── Shared pillar data ─── */
const PILLARS = [
  {
    num: "01",
    title: "Compliance as a token primitive",
    tag: "Reg D / S / A+",
    body: "Freeze, thaw, delegate, and transfer hooks — enforced by the protocol, not bolted-on contracts.",
    verb: "enforced",
  },
  {
    num: "02",
    title: "Institutional custody, preserved",
    tag: "Fireblocks · Squads · Safe",
    body: "Multisig and MPC custody supported out of the box. Authority rotation is a first-class flow.",
    verb: "supported",
  },
  {
    num: "03",
    title: "Wallet-visible investor protections",
    tag: "Phantom · Ledger · MetaMask",
    body: "Every powerful authority surfaces a warning in the holder's wallet. No hidden controls — protection is disclosed by default.",
    verb: "disclosed",
  },
  {
    num: "04",
    title: "Secondary-market ready",
    tag: "Securitize · tZERO",
    body: "Transfer Hooks whitelist compliant DEX pools. Permissionless venues simply reject the token — by design.",
    verb: "whitelist",
  },
  {
    num: "05",
    title: "Native yield distributions",
    tag: "pro-rata · equal-share",
    body: "Coupon payments, NAV distributions, and fund income executed on-chain — one confirmation, every holder, every chain.",
    verb: "executed",
  },
] as const;

function Verb({ children }: { children: React.ReactNode }) {
  return <span className="text-[#3fb950] font-medium">{children}</span>;
}

function RichBody({ body, verb }: { body: string; verb: string }) {
  const idx = body.indexOf(verb);
  if (idx === -1) return <>{body}</>;
  return (
    <>
      {body.slice(0, idx)}
      <Verb>{verb}</Verb>
      {body.slice(idx + verb.length)}
    </>
  );
}

/* ─── Section wrapper ─── */
function DemoSection({
  id,
  number,
  title,
  subtitle,
  children,
}: {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mx-auto max-w-[1280px] px-5 md:px-8 py-16 md:py-24 border-b border-[#21262d]"
    >
      <div className="mb-10 md:mb-14">
        <div className="mb-2 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
          Option {number}
        </div>
        <h2 className="m-0 mb-3 text-[28px] md:text-[32px] xl:text-[40px] font-semibold leading-[1.05] tracking-[-0.03em]">
          {title}
        </h2>
        <p className="m-0 max-w-[600px] text-[14px] md:text-[15px] leading-[1.6] text-[#8b949e]">
          {subtitle}
        </p>
      </div>
      {children}
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1. ACCORDION EXPAND
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function AccordionPillars() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="border-b border-[#21262d]">
      {PILLARS.map((p, i) => (
        <div
          key={p.num}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          className="border-t border-[#21262d] cursor-default"
        >
          {/* Always-visible row */}
          <div className="flex items-center gap-4 md:gap-6 py-4 md:py-5">
            <div className="text-[24px] md:text-[28px] font-mono font-semibold text-[#3fb950] leading-none tracking-[-0.02em] w-[56px] shrink-0">
              {p.num}
            </div>
            <h3 className="m-0 text-[17px] md:text-[20px] font-semibold tracking-[-0.01em] text-[#f0f6fc] flex-1">
              {p.title}
            </h3>
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[#6e7681] whitespace-nowrap hidden md:block">
              {p.tag}
            </div>
          </div>
          {/* Expandable detail */}
          <div
            className="overflow-hidden transition-all duration-300 ease-out"
            style={{
              maxHeight: hovered === i ? "120px" : "0px",
              opacity: hovered === i ? 1 : 0,
            }}
          >
            <div className="pb-5 pl-[72px] md:pl-[80px] pr-4">
              <p className="m-0 max-w-[520px] text-[13px] md:text-[14px] leading-[1.6] text-[#8b949e]">
                <RichBody body={p.body} verb={p.verb} />
              </p>
              <div className="mt-2 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[#6e7681] md:hidden">
                {p.tag}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   2. SPOTLIGHT / FOCUS SHIFT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function SpotlightPillars() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="border-b border-[#21262d]">
      {PILLARS.map((p, i) => {
        const isActive = hovered === i;
        const isDimmed = hovered !== null && hovered !== i;

        return (
          <div
            key={p.num}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="border-t border-[#21262d] cursor-default transition-all duration-300"
            style={{
              opacity: isDimmed ? 0.35 : 1,
              transform: isActive ? "scale(1.015)" : "scale(1)",
              transformOrigin: "left center",
            }}
          >
            <div className="flex items-start gap-4 md:gap-6 py-4 md:py-5">
              <div className="text-[24px] md:text-[28px] font-mono font-semibold text-[#3fb950] leading-none tracking-[-0.02em] w-[56px] shrink-0 pt-0.5">
                {p.num}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="m-0 mb-0 text-[17px] md:text-[20px] font-semibold tracking-[-0.01em] text-[#f0f6fc]">
                  {p.title}
                </h3>
                {/* Description — collapses when not spotlit */}
                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{
                    maxHeight: isActive ? "80px" : "0px",
                    opacity: isActive ? 1 : 0,
                    marginTop: isActive ? "8px" : "0px",
                  }}
                >
                  <p className="m-0 max-w-[520px] text-[13px] md:text-[14px] leading-[1.6] text-[#8b949e]">
                    <RichBody body={p.body} verb={p.verb} />
                  </p>
                </div>
              </div>
              <div
                className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] whitespace-nowrap hidden md:block pt-1.5 transition-colors duration-300"
                style={{ color: isActive ? "#3fb950" : "#6e7681" }}
              >
                {p.tag}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   3. SLIDING DRAWER
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function DrawerPillars() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="border-b border-[#21262d]">
      {PILLARS.map((p, i) => {
        const isActive = hovered === i;

        return (
          <div
            key={p.num}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className="border-t border-[#21262d] cursor-default py-4 md:py-5"
          >
            <div className="flex items-center gap-4 md:gap-6">
              <div className="text-[24px] md:text-[28px] font-mono font-semibold text-[#3fb950] leading-none tracking-[-0.02em] w-[56px] shrink-0">
                {p.num}
              </div>
              <h3 className="m-0 text-[17px] md:text-[20px] font-semibold tracking-[-0.01em] text-[#f0f6fc] flex-1">
                {p.title}
              </h3>
            </div>
            {/* Drawer slides in from left */}
            <div
              className="overflow-hidden transition-all duration-350 ease-out"
              style={{
                maxHeight: isActive ? "100px" : "0px",
              }}
            >
              <div
                className="flex items-start justify-between gap-6 pt-3 pl-[72px] md:pl-[80px] pr-4 transition-all duration-350 ease-out"
                style={{
                  opacity: isActive ? 1 : 0,
                  transform: isActive
                    ? "translateX(0)"
                    : "translateX(-24px)",
                }}
              >
                <p className="m-0 max-w-[520px] text-[13px] md:text-[14px] leading-[1.6] text-[#8b949e]">
                  <RichBody body={p.body} verb={p.verb} />
                </p>
                <div className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[#6e7681] whitespace-nowrap hidden md:block pt-0.5">
                  {p.tag}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   4. FLOATING DETAIL CARD
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function FloatingCardPillars() {
  const [hovered, setHovered] = useState<number | null>(null);
  const [cardPos, setCardPos] = useState({ top: 0 });
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback((i: number) => {
    setHovered(i);
    const row = rowRefs.current[i];
    const container = containerRef.current;
    if (row && container) {
      const rowRect = row.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setCardPos({ top: rowRect.top - containerRect.top });
    }
  }, []);

  return (
    <div ref={containerRef} className="relative flex gap-8">
      {/* Left: compact list */}
      <div className="flex-1 border-b border-[#21262d]">
        {PILLARS.map((p, i) => (
          <div
            key={p.num}
            ref={(el) => { rowRefs.current[i] = el; }}
            onMouseEnter={() => handleEnter(i)}
            onMouseLeave={() => setHovered(null)}
            className="border-t border-[#21262d] cursor-default"
          >
            <div className="flex items-center gap-4 md:gap-6 py-4 md:py-5">
              <div
                className="text-[24px] md:text-[28px] font-mono font-semibold leading-none tracking-[-0.02em] w-[56px] shrink-0 transition-colors duration-200"
                style={{ color: hovered === i ? "#3fb950" : "#30363d" }}
              >
                {p.num}
              </div>
              <h3
                className="m-0 text-[17px] md:text-[20px] font-semibold tracking-[-0.01em] transition-colors duration-200"
                style={{
                  color: hovered === i ? "#f0f6fc" : "#8b949e",
                }}
              >
                {p.title}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* Right: floating card */}
      <div
        className="hidden md:block w-[320px] shrink-0 relative"
        style={{ minHeight: "280px" }}
      >
        <div
          className="absolute left-0 right-0 rounded-xl border border-[#21262d] bg-[#161b22] p-6 transition-all duration-300 ease-out"
          style={{
            top: `${cardPos.top}px`,
            opacity: hovered !== null ? 1 : 0,
            transform:
              hovered !== null
                ? "translateX(0) scale(1)"
                : "translateX(-12px) scale(0.97)",
            pointerEvents: hovered !== null ? "auto" : "none",
          }}
        >
          {hovered !== null && (
            <>
              <div className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[#3fb950]">
                {PILLARS[hovered].tag}
              </div>
              <h4 className="m-0 mb-3 text-[17px] font-semibold text-[#f0f6fc]">
                {PILLARS[hovered].title}
              </h4>
              <p className="m-0 text-[13px] leading-[1.6] text-[#8b949e]">
                <RichBody
                  body={PILLARS[hovered].body}
                  verb={PILLARS[hovered].verb}
                />
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   5. SPYGLASS / LENS EFFECT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function LensPillars() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [isInside, setIsInside] = useState(false);
  const LENS_RADIUS = 140;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    []
  );

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden cursor-none"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsInside(true)}
      onMouseLeave={() => setIsInside(false)}
    >
      {/* Base layer: blurred / condensed */}
      <div className="border-b border-[#21262d] select-none">
        {PILLARS.map((p) => (
          <div
            key={p.num}
            className="border-t border-[#21262d] py-4 md:py-5"
          >
            <div className="flex items-start gap-4 md:gap-6">
              <div className="text-[24px] md:text-[28px] font-mono font-semibold text-[#3fb950]/30 leading-none tracking-[-0.02em] w-[56px] shrink-0">
                {p.num}
              </div>
              <div className="flex-1">
                <h3 className="m-0 mb-2 text-[17px] md:text-[20px] font-semibold tracking-[-0.01em] text-[#f0f6fc]/25">
                  {p.title}
                </h3>
                <p className="m-0 max-w-[520px] text-[13px] md:text-[14px] leading-[1.6] text-[#8b949e]/15">
                  <RichBody body={p.body} verb={p.verb} />
                </p>
              </div>
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[#6e7681]/20 whitespace-nowrap hidden md:block pt-1.5">
                {p.tag}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lens layer: revealed content inside circular clip */}
      {isInside && (
        <div
          className="absolute inset-0 pointer-events-none border-b border-[#21262d]"
          style={{
            clipPath: `circle(${LENS_RADIUS}px at ${mouse.x}px ${mouse.y}px)`,
          }}
        >
          {/* Lens border glow */}
          <div
            className="absolute pointer-events-none rounded-full border border-[#3fb950]/40"
            style={{
              width: LENS_RADIUS * 2,
              height: LENS_RADIUS * 2,
              left: mouse.x - LENS_RADIUS,
              top: mouse.y - LENS_RADIUS,
              boxShadow:
                "0 0 30px rgba(63,185,80,0.12), inset 0 0 30px rgba(63,185,80,0.06)",
            }}
          />

          {/* Full-clarity duplicate */}
          <div className="bg-[#0a0e13]">
            {PILLARS.map((p) => (
              <div
                key={p.num}
                className="border-t border-[#21262d] py-4 md:py-5"
              >
                <div className="flex items-start gap-4 md:gap-6">
                  <div className="text-[24px] md:text-[28px] font-mono font-semibold text-[#3fb950] leading-none tracking-[-0.02em] w-[56px] shrink-0">
                    {p.num}
                  </div>
                  <div className="flex-1">
                    <h3 className="m-0 mb-2 text-[17px] md:text-[20px] font-semibold tracking-[-0.01em] text-[#f0f6fc]">
                      {p.title}
                    </h3>
                    <p className="m-0 max-w-[520px] text-[13px] md:text-[14px] leading-[1.6] text-[#8b949e]">
                      <RichBody body={p.body} verb={p.verb} />
                    </p>
                  </div>
                  <div className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[#6e7681] whitespace-nowrap hidden md:block pt-1.5">
                    {p.tag}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lens crosshair */}
      {isInside && (
        <div
          className="absolute pointer-events-none rounded-full border-2 border-[#3fb950]/50"
          style={{
            width: LENS_RADIUS * 2,
            height: LENS_RADIUS * 2,
            left: mouse.x - LENS_RADIUS,
            top: mouse.y - LENS_RADIUS,
            boxShadow:
              "0 0 40px rgba(63,185,80,0.15), 0 0 80px rgba(63,185,80,0.05)",
          }}
        />
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PAGE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function PillarsTestPage() {
  return (
    <div className="bg-[#0a0e13] text-[#f0f6fc] -mt-px">
      <MarketingNav />

      {/* Hero / table of contents */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 pt-12 md:pt-20 pb-12 md:pb-16 border-b border-[#21262d]">
        <div className="mb-4 md:mb-5 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
          / design lab
        </div>
        <h1 className="m-0 mb-5 md:mb-7 max-w-[900px] text-[40px] md:text-[56px] font-semibold leading-[0.98] tracking-[-0.035em]">
          Five Pillars —{" "}
          <span className="text-[#3fb950]">hover effect explorations</span>
        </h1>
        <p className="m-0 mb-8 max-w-[620px] text-[15px] md:text-[17px] leading-[1.55] text-[#8b949e]">
          Five interaction patterns for condensing the pillars section. Hover
          each to see the effect. Desktop only — these are mouse-driven
          interactions.
        </p>
        <nav className="flex flex-wrap gap-3">
          {[
            { href: "#accordion", label: "1 · Accordion" },
            { href: "#spotlight", label: "2 · Spotlight" },
            { href: "#drawer", label: "3 · Drawer" },
            { href: "#floating-card", label: "4 · Floating Card" },
            { href: "#lens", label: "5 · Spyglass Lens" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full border border-[#30363d] px-4 py-2 text-[12px] font-mono font-medium text-[#8b949e] hover:text-[#f0f6fc] hover:border-[#f0f6fc] transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </section>

      <DemoSection
        id="accordion"
        number="1"
        title="Accordion Expand"
        subtitle="Default state: each pillar shows only its number and title. On hover, the description slides open. Others stay collapsed. Cuts resting height by ~55%."
      >
        <AccordionPillars />
      </DemoSection>

      <DemoSection
        id="spotlight"
        number="2"
        title="Spotlight / Focus Shift"
        subtitle="All titles visible but muted. On hover the target pillar scales up, brightens, and reveals its description. Adjacent pillars dim and compress."
      >
        <SpotlightPillars />
      </DemoSection>

      <DemoSection
        id="drawer"
        number="3"
        title="Sliding Drawer"
        subtitle="Compact title rows by default. Hover slides the description in from the left with a translate + opacity transition. Clean and directional."
      >
        <DrawerPillars />
      </DemoSection>

      <DemoSection
        id="floating-card"
        number="4"
        title="Floating Detail Card"
        subtitle="Compact list on the left. Hover spawns a positioned card to the right that follows the active row. The list stays compact; detail appears adjacent."
      >
        <FloatingCardPillars />
      </DemoSection>

      <DemoSection
        id="lens"
        number="5"
        title="Spyglass / Lens Effect"
        subtitle="Content is dimmed by default. A circular lens follows your cursor, revealing the full-clarity content underneath — like looking through a magnifying glass."
      >
        <LensPillars />
      </DemoSection>

      <MarketingFooter />
    </div>
  );
}
