"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { setAnalyticsEnabled, sanitizeAnalyticsProperties } from "@/lib/analytics";

/**
 * Initialises PostHog client-side, privacy-first:
 *  - No key → complete no-op (dev/preview never error).
 *  - EU host by default (AVG).
 *  - Cookieless ("memory" persistence) so no tracking cookie is set without a
 *    consent banner; anonymous within a session.
 *  - Autocapture + heatmaps ON, but every element marked .ph-no-capture is
 *    masked, all inputs masked, and URL query strings are stripped — so no
 *    invoice/financial PII is ever captured.
 */
export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return; // no key → no analytics, no errors
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

    const ph = posthog as unknown as { __loaded?: boolean };
    if (!ph.__loaded) {
      posthog.init(key, {
        api_host: host,
        person_profiles: "identified_only",
        persistence: "memory", // cookieless until a consent banner exists
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        // Privacy: mask anything marked .ph-no-capture + all input values.
        mask_all_text: false,
        sanitize_properties: sanitizeAnalyticsProperties,
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: ".ph-no-capture",
        },
      });
    }
    setAnalyticsEnabled(true);
  }, []);

  return <>{children}</>;
}
