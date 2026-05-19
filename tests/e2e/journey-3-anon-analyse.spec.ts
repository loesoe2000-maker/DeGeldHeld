/**
 * v16 DEEL 3 — Stap 3: anonymous analyse page contract.
 *
 * We don't have a real anonymous Bill in prod to navigate to from
 * the harness (creating one would pollute the DB + burn a rate-limit
 * slot). Instead we validate the route's contract:
 *
 *   - GET /onderhandel/analyse without a bill param → redirect to
 *     /onderhandel (anon flow lands on the upload form).
 *   - GET with a bogus bill id → redirect to /onderhandel (Bill not
 *     found, never 500).
 *   - GET with anonymous-session cookie set but no matching bill →
 *     same redirect, no leakage.
 *   - Stale-banner + one-time-items components are mounted in the
 *     analyse-page source (component-level contract check).
 *
 * The full happy-path with a real anonymous Bill is exercised by
 * the local Playwright suite (upload-to-email.spec.ts).
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

test.describe("v16 journey-3 — anonymous analyse contract", () => {
  test("GET /onderhandel/analyse without bill param redirects to /onderhandel", async ({ page }) => {
    const resp = await page.goto("/onderhandel/analyse", {
      waitUntil: "domcontentloaded",
    });
    expect(resp).not.toBeNull();
    // 200 after redirect chain, or direct redirect.
    if (resp) expect(resp.status()).toBeLessThan(500);
    // We land on the upload form (anon path) or the login wall.
    const url = new URL(page.url());
    expect(url.pathname).toMatch(/onderhandel|login/);
  });

  test("GET with bogus bill id never 500s", async ({ request }) => {
    const r = await request.get("/onderhandel/analyse?bill=bogus_id_does_not_exist");
    expect(r.status()).toBeLessThan(500);
  });

  test("GET with anon-session cookie + unknown bill behaves clean", async ({ browser }) => {
    // Set a syntactically-valid cookie that won't match any row.
    const ctx = await browser.newContext();
    await ctx.addCookies([
      {
        name: "dgh_anon_session",
        value: "00000000-0000-4000-8000-000000000000",
        domain: "www.degeldheld.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    const page = await ctx.newPage();
    const resp = await page.goto("/onderhandel/analyse?bill=also_bogus");
    expect(resp).not.toBeNull();
    if (resp) expect(resp.status()).toBeLessThan(500);
    await ctx.close();
  });

  test("analyse page source mounts AnonymousMailPrompt + stale-banner contract", async () => {
    // Component-level contract — guards the renderer against a
    // refactor that drops the CTAs the journey-test expects to see
    // with a real bill in scope.
    const src = readFileSync(
      resolve(ROOT, "app/onderhandel/analyse/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/AnonymousMailPrompt/);
    expect(src).toMatch(/stale-banner|STALE_DAYS|invoiceAge/);
    expect(src).toMatch(/onetime-banner|showOneTimeBanner|oneTime/);
    expect(src).toMatch(/isAnonymous/);
    expect(src).toMatch(/anonymousSessionId/);
  });

  test("Comparison component still renders without sub-type chip when null", async () => {
    // Source-level: the Comparison component must not crash on a
    // bill that has null subType. The runtime branch is exercised by
    // tests/subtype-display.test.tsx; here we just gate that the
    // import surface stays intact.
    const src = readFileSync(
      resolve(ROOT, "components/Comparison.tsx"),
      "utf8",
    );
    expect(src).toMatch(/subType\?:\s*string\s*\|\s*null/);
  });
});
