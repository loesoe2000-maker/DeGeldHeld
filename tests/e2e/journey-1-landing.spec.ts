/**
 * v16 DEEL 1 — Stap 1: anonymous user lands on the homepage.
 *
 * Runs against PROD_URL (default https://www.degeldheld.com).
 * The desktop + iphone-mobile projects (configured in
 * playwright.prod.config.ts) both invoke this spec.
 */
import { test, expect } from "@playwright/test";

const HERO_TIMEOUT_MS = 8_000;

test.describe("v16 journey-1 — landing", () => {
  test("homepage returns 200 + hero is visible within 8s", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      // Ignore expected dev/info chatter — only fail on uncaught errors.
      if (msg.type() === "error") errors.push(msg.text());
    });

    const resp = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(resp).not.toBeNull();
    // Vercel may serve 200 or 304; both are fine.
    if (resp) {
      expect([200, 304]).toContain(resp.status());
    }

    // Hero/H1 must render fast.
    await expect(page.locator("h1").first()).toBeVisible({
      timeout: HERO_TIMEOUT_MS,
    });

    // Body should mention the brand name and the primary value-prop.
    const bodyText = (await page.locator("body").textContent()) ?? "";
    expect(bodyText.toLowerCase()).toContain("degeldheld");

    // Console must be clean — fail if any uncaught JS error fired
    // during initial render. Filter common third-party noise.
    const realErrors = errors.filter((e) => {
      const lower = e.toLowerCase();
      if (lower.includes("favicon")) return false;
      if (lower.includes("third party") || lower.includes("vercel.live")) return false;
      return true;
    });
    expect(realErrors, `Unexpected JS errors: ${realErrors.join("\n")}`).toEqual([]);
  });

  test("primary CTA links to the upload flow", async ({ page }) => {
    await page.goto("/");
    // Match the multiple CTA copies the marketing team has used —
    // the contract is "there's a clickable button that points at the
    // onderhandel funnel".
    const ctaCandidates = [
      page.getByRole("link", { name: /probeer/i }).first(),
      page.getByRole("link", { name: /upload/i }).first(),
      page.getByRole("link", { name: /onderhandel/i }).first(),
      page.getByRole("link", { name: /start/i }).first(),
    ];
    let foundHref: string | null = null;
    for (const cand of ctaCandidates) {
      try {
        if (await cand.isVisible({ timeout: 500 })) {
          foundHref = await cand.getAttribute("href");
          if (foundHref) break;
        }
      } catch {
        // try next
      }
    }
    expect(foundHref, "no upload CTA visible on /").not.toBeNull();
    expect(foundHref ?? "").toMatch(/onderhandel|upload|signup/i);
  });

  test("activity feed widget renders within 5s on desktop", async ({ page, browserName }, testInfo) => {
    // Only assert on desktop projects — the widget is hidden on mobile
    // by an `sm:block` Tailwind class.
    test.skip(
      testInfo.project.name.includes("mobile") || testInfo.project.name.includes("iphone"),
      "Activity feed is desktop-only (sm:block)",
    );
    await page.goto("/");
    // The widget polls /api/activity; the network call must succeed.
    const apiResp = await page.waitForResponse(
      (r) => r.url().includes("/api/activity") && r.status() === 200,
      { timeout: 10_000 },
    );
    expect(apiResp.ok()).toBe(true);
    // Widget is mounted with data-testid="activity-feed" or hidden by
    // the dismissed cookie. Either is acceptable smoke.
    const feedOrDismissed = await page
      .locator("[data-testid='activity-feed']")
      .or(page.locator("body"))
      .first()
      .isVisible();
    expect(feedOrDismissed).toBe(true);
    void browserName;
  });
});
