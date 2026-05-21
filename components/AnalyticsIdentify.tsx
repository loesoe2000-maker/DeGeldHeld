"use client";

import { useEffect } from "react";
import { identify } from "@/lib/analytics";

/**
 * Associates the anonymous PostHog session with the logged-in user id
 * (NEVER the email). Rendered on authenticated pages. No-op without PostHog.
 */
export default function AnalyticsIdentify({ userId }: { userId: string }) {
  useEffect(() => {
    identify(userId);
  }, [userId]);
  return null;
}
