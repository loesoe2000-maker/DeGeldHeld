import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { activeHubTiles, HUB_TILES, SPOOK_TILE } from "@/lib/moneyfinder-hub";
import type { FeatureFlag } from "@/lib/feature-flags";

/**
 * v29 DEEL 4 — "vind al je geld"-hub. Tegels verschijnen ALLEEN als hun eigen
 * feature-flag aan staat (regression-guard: geen lege/dode UI).
 */

const flagOn = vi.hoisted(
  () => ({}) as Partial<Record<FeatureFlag, boolean>>,
);
vi.mock("@/lib/feature-flags", () => ({
  isEnabled: (f: FeatureFlag) => Boolean(flagOn[f]),
}));

beforeEach(() => {
  for (const k of Object.keys(flagOn) as FeatureFlag[]) delete flagOn[k];
});

describe("activeHubTiles — pure flag-filter", () => {
  it("geen flags → geen tegels", () => {
    expect(activeHubTiles(() => false)).toEqual([]);
  });

  it("élke tegel verschijnt zodra zijn eigen flag aan staat", () => {
    for (const t of HUB_TILES) {
      const active = activeHubTiles((f) => f === t.flag);
      expect(active.map((x) => x.id)).toEqual([t.id]);
    }
  });

  it("alle flags aan → alle tegels", () => {
    const all = activeHubTiles(() => true);
    expect(all.map((t) => t.id).sort()).toEqual(HUB_TILES.map((t) => t.id).sort());
  });

  it("HUB_TILES bevat de v29 + v28 routes", () => {
    const ids = HUB_TILES.map((t) => t.id);
    expect(ids).toContain("geld-check");
    expect(ids).toContain("box3-check");
    expect(ids).toContain("zorgkosten-check");
    expect(ids).toContain("vluchtclaim");
    expect(ids).toContain("ns-check");
  });

  it("HUB_TILES bevat de v35 claim-hub routes met hun eigen flag", () => {
    const ids = HUB_TILES.map((t) => t.id);
    expect(ids).toContain("huurcommissie-check");
    expect(ids).toContain("energie-claim-check");
    const huur = HUB_TILES.find((t) => t.id === "huurcommissie-check");
    const energie = HUB_TILES.find((t) => t.id === "energie-claim-check");
    expect(huur?.flag).toBe("HUURCOMMISSIE_CHECK_ENABLED");
    expect(huur?.href).toBe("/huurcommissie-check");
    expect(energie?.flag).toBe("ENERGIE_CLAIM_CHECK_ENABLED");
    expect(energie?.href).toBe("/energie-claim-check");
  });

  it("SPOOK_TILE is geen flag-gated tegel (owner-scoped)", () => {
    expect(SPOOK_TILE.id).toBe("spookabonnementen");
    expect(SPOOK_TILE.href).toBe("/spookabonnementen");
    expect("flag" in SPOOK_TILE).toBe(false);
  });
});

// Server-component import via dynamic import zodat we de mock kunnen toggelen.
async function renderHubWith(flags: Partial<Record<FeatureFlag, boolean>>) {
  for (const [k, v] of Object.entries(flags) as Array<[FeatureFlag, boolean]>) {
    flagOn[k] = v;
  }
  // De page is een server-component, maar zonder async data fetching →
  // we kunnen 'm direct als RSC renderen via dynamische import.
  const { default: Page } = await import("@/app/vind-al-je-geld/page");
  // We mocken redirect uit next/navigation om de page niet te laten throwen
  // wanneer de hub-flag aan staat (default off).
  return render(Page() as React.ReactElement);
}

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

vi.mock("@/components/TrackEvent", () => ({
  default: () => null,
}));

describe("/vind-al-je-geld — page render", () => {
  it("hub-flag UIT → page redirect (gated)", async () => {
    await expect(renderHubWith({})).rejects.toThrow(/REDIRECT/);
  });

  it("hub-flag AAN + geen sub-flags → 'nog niets actief'-state + Plus-pitch", async () => {
    await renderHubWith({ MONEYFINDER_HUB_ENABLED: true });
    expect(screen.getByTestId("hub-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("hub-grid")).not.toBeInTheDocument();
    // Spook-tegel staat altijd in de hub (owner-scoped, geen flag).
    expect(screen.getByTestId("hub-tile-spookabonnementen")).toHaveAttribute("href", "/spookabonnementen");
  });

  it("hub-flag AAN + GELD_CHECK aan → toeslagen-tegel verschijnt, andere NIET", async () => {
    await renderHubWith({ MONEYFINDER_HUB_ENABLED: true, GELD_CHECK_ENABLED: true });
    expect(screen.getByTestId("hub-tile-geld-check")).toHaveAttribute("href", "/geld-check");
    expect(screen.queryByTestId("hub-tile-box3-check")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hub-tile-vluchtclaim")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hub-tile-ns-check")).not.toBeInTheDocument();
  });

  it("hub-flag AAN + alle V29-checks aan → 5 grid-tegels (excl. spook)", async () => {
    await renderHubWith({
      MONEYFINDER_HUB_ENABLED: true,
      GELD_CHECK_ENABLED: true,
      BOX3_CHECK_ENABLED: true,
      ZORGKOSTEN_CHECK_ENABLED: true,
      CLAIMS: true,
      NS_CHECK_ENABLED: true,
    });
    for (const id of ["geld-check", "box3-check", "zorgkosten-check", "vluchtclaim", "ns-check"]) {
      expect(screen.getByTestId(`hub-tile-${id}`)).toBeInTheDocument();
    }
    // Plus-pitch onderaan.
    expect(screen.getByText(/Bekijk Plus/i)).toBeInTheDocument();
  });

  it("v35: HUURCOMMISSIE flag UIT → géén tegel (geen lege/dode UI)", async () => {
    await renderHubWith({ MONEYFINDER_HUB_ENABLED: true });
    expect(screen.queryByTestId("hub-tile-huurcommissie-check")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hub-tile-energie-claim-check")).not.toBeInTheDocument();
  });

  it("v35: HUURCOMMISSIE + ENERGIE flags AAN → beide tegels verschijnen met juiste href", async () => {
    await renderHubWith({
      MONEYFINDER_HUB_ENABLED: true,
      HUURCOMMISSIE_CHECK_ENABLED: true,
      ENERGIE_CLAIM_CHECK_ENABLED: true,
    });
    expect(screen.getByTestId("hub-tile-huurcommissie-check")).toHaveAttribute(
      "href",
      "/huurcommissie-check",
    );
    expect(screen.getByTestId("hub-tile-energie-claim-check")).toHaveAttribute(
      "href",
      "/energie-claim-check",
    );
  });
});
