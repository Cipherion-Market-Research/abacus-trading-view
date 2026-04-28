"use client";

import { useEffect, useRef, useState } from "react";

interface SpringCounterProps {
  from: number;
  to: number;
  decimals?: number;
  style?: React.CSSProperties;
  className?: string;
}

function springAnimate(
  from: number,
  to: number,
  decimals: number,
  onUpdate: (val: string) => void,
): () => void {
  const stiffness = 120;
  const damping = 2 * 0.7 * Math.sqrt(stiffness);
  const dt = 1 / 60;

  let x = from;
  let v = 0;
  let lastTime: number | null = null;
  let accumulator = 0;
  let rafId: number | null = null;

  function tick(now: number) {
    if (lastTime === null) lastTime = now;
    const elapsed = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accumulator += elapsed;

    while (accumulator >= dt) {
      const force = -stiffness * (x - to) - damping * v;
      v += force * dt;
      x += v * dt;
      accumulator -= dt;
    }

    onUpdate(x.toFixed(decimals));

    if (Math.abs(x - to) < 0.005 && Math.abs(v) < 0.005) {
      onUpdate(to.toFixed(decimals));
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}

export function SpringCounter({
  from,
  to,
  decimals = 1,
  style,
  className,
}: SpringCounterProps) {
  const [display, setDisplay] = useState(from.toFixed(decimals));
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          cancelRef.current = springAnimate(from, to, decimals, setDisplay);
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelRef.current?.();
    };
  }, [from, to, decimals]);

  return (
    <span ref={ref} style={style} className={className}>
      {display}
    </span>
  );
}
