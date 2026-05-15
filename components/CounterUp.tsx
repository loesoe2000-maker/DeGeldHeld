"use client";

import { useEffect, useState } from "react";
import { formatEurCents } from "@/lib/format";

/**
 * Animates a number from 0 to `value` over `durationMs`.
 * Uses requestAnimationFrame with ease-out cubic.
 *
 * NOTE: cannot accept a function prop because this is used from a Server
 * Component (app/proof/page.tsx) — functions aren't serializable across the
 * RSC boundary. Pass a string `formatType` instead.
 */
export default function CounterUp({
  value,
  durationMs = 1200,
  formatType,
  className = "",
}: {
  value: number;
  durationMs?: number;
  /** "eur" treats `value` as euros (no decimals), "plain" shows the raw integer */
  formatType?: "eur" | "plain";
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

  const rendered =
    formatType === "eur"
      ? formatEurCents(current * 100, { showDecimals: false })
      : current;

  return <span className={className}>{rendered}</span>;
}
