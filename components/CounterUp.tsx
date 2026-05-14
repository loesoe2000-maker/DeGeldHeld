"use client";

import { useEffect, useState } from "react";

/**
 * Animates a number from 0 to `value` over `durationMs`.
 * Uses requestAnimationFrame with ease-out cubic.
 */
export default function CounterUp({
  value,
  durationMs = 1200,
  format,
  className = "",
}: {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    function step(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrent(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{format ? format(current) : current}</span>;
}
