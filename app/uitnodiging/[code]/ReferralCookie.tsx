"use client";

import { useEffect } from "react";

/**
 * Set ref_code cookie client-side. Server components can't set cookies in
 * Next.js (only Route Handlers, Server Actions, middleware can) — doing so
 * crashes the render with a 500. So we attach this no-render component to
 * the referral landing page; the cookie still makes it back to the server
 * on the next request (e.g. when the user clicks the CTA to /login).
 *
 * Trade-off: cookie is not httpOnly. For referral-tracking that's acceptable.
 */
export default function ReferralCookie({ code }: { code: string }) {
  useEffect(() => {
    const upper = code.toUpperCase();
    const maxAge = 30 * 24 * 60 * 60;
    const isProd = typeof window !== "undefined" && window.location.protocol === "https:";
    document.cookie = `ref_code=${encodeURIComponent(upper)}; path=/; max-age=${maxAge}; samesite=lax${isProd ? "; secure" : ""}`;
  }, [code]);

  return null;
}
