"use client";

import { useEffect, useRef } from "react";
import { track, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics";

/**
 * Fires a single funnel event on mount — lets server components record a
 * step without becoming client components. Props must be PII-free
 * (category/provider/booleans/amounts only). No-op without PostHog.
 */
export default function TrackEvent({
  event,
  props,
}: {
  event: AnalyticsEvent;
  props?: AnalyticsProps;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, props);
  }, [event, props]);
  return null;
}
