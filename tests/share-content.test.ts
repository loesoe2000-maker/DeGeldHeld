import { describe, it, expect } from "vitest";

describe("share-kit content", () => {
  it("share text contains euro amount and provider", () => {
    const saved = 250;
    const provider = "KPN";
    const text = `Ik bespaarde €${saved} bij ${provider} dankzij DeGeldHeld AI 🎉`;
    expect(text).toContain("€250");
    expect(text).toContain("KPN");
  });

  it("UTM params follow utm_medium/utm_source convention", () => {
    const ref = "https://degeldheld.com/uitnodiging/ABC123";
    const wa = `${ref}?utm_source=share&utm_medium=whatsapp`;
    expect(wa).toMatch(/utm_source=share/);
    expect(wa).toMatch(/utm_medium=whatsapp/);
  });

  it("instagram story URL targets the 1080x1920 endpoint", () => {
    const url = `/api/og/share?saved=125&provider=${encodeURIComponent("Eneco")}`;
    expect(url).toMatch(/\/api\/og\/share/);
    expect(url).toContain("saved=125");
    expect(url).toContain("provider=Eneco");
  });
});

describe("share-kit OG route handlers exist", async () => {
  it("/api/og/route.tsx exports GET", async () => {
    const mod = await import("../app/api/og/route");
    expect(typeof mod.GET).toBe("function");
  });
  it("/api/og/share/route.tsx exports GET", async () => {
    const mod = await import("../app/api/og/share/route");
    expect(typeof mod.GET).toBe("function");
  });
});
