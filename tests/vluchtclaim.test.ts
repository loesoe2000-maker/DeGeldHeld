import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createFlightLookup,
  isValidFlightDateISO,
  isValidFlightNumber,
  noopFlightLookup,
  aviationEdgeProvider,
  aviationStackProvider,
  type FlightLookupProvider,
} from "@/lib/flightdata";
import { eu261Compensation } from "@/lib/eu261";

// Flag gate is per-call, so we mutate a hoisted flag inside vi.mock.
const flagOn = vi.hoisted(() => ({ CLAIMS: true }));
vi.mock("@/lib/feature-flags", () => ({
  isEnabled: (f: string) => Boolean((flagOn as Record<string, boolean>)[f]),
}));

import { POST } from "@/app/api/vluchtclaim/check/route";
import { __setFlightLookupForTests } from "@/lib/flightdata-runtime";

function req(body: unknown) {
  return new Request("https://t/api/vluchtclaim/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  flagOn.CLAIMS = true;
  __setFlightLookupForTests(null);
});
afterEach(() => {
  __setFlightLookupForTests(null);
});

// ─── lib/flightdata ──────────────────────────────────────────────────────────

describe("flightdata — pure helpers", () => {
  it("isValidFlightNumber accepts realistic IATA + ICAO-ish patterns", () => {
    for (const ok of ["KL1234", "KL 1234", "U2 8505", "EZY8505", "AF1234A", "BA45"]) {
      expect(isValidFlightNumber(ok)).toBe(true);
    }
    for (const bad of ["", "1234", "TOOLONG12345", "@@@", "K-1234"]) {
      expect(isValidFlightNumber(bad)).toBe(false);
    }
  });

  it("isValidFlightDateISO rejects future + > 2-year-old dates", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(isValidFlightDateISO("2026-04-12", now)).toBe(true);
    expect(isValidFlightDateISO("2024-06-02", now)).toBe(true);
    expect(isValidFlightDateISO("2099-01-01", now)).toBe(false); // toekomst
    expect(isValidFlightDateISO("2020-01-01", now)).toBe(false); // > 2 jaar
    expect(isValidFlightDateISO("not-a-date", now)).toBe(false);
  });

  it("createFlightLookup: geen env-key → noop provider", () => {
    const p = createFlightLookup({} as NodeJS.ProcessEnv);
    expect(p.name).toBe("noop");
  });

  it("createFlightLookup: AVIATION_EDGE_KEY → aviation-edge provider", () => {
    const p = createFlightLookup({ AVIATION_EDGE_KEY: "x" } as unknown as NodeJS.ProcessEnv);
    expect(p.name).toBe("aviation-edge");
  });

  it("createFlightLookup: AVIATIONSTACK_KEY → aviation-stack provider", () => {
    const p = createFlightLookup({ AVIATIONSTACK_KEY: "x" } as unknown as NodeJS.ProcessEnv);
    expect(p.name).toBe("aviation-stack");
  });

  it("noop + stubs geven 'no-data' (geen verzonnen vluchtdata)", async () => {
    expect(await noopFlightLookup.lookup("KL1234", "2026-04-12")).toMatchObject({ kind: "no-data" });
    expect(await aviationEdgeProvider("x").lookup("KL1234", "2026-04-12")).toMatchObject({ kind: "no-data", reason: "needs-implementation" });
    expect(await aviationStackProvider("x").lookup("KL1234", "2026-04-12")).toMatchObject({ kind: "no-data", reason: "needs-implementation" });
  });
});

// ─── POST /api/vluchtclaim/check ────────────────────────────────────────────

describe("POST /api/vluchtclaim/check — gates + routing", () => {
  it("404 disabled wanneer FEATURE_CLAIMS uit staat", async () => {
    flagOn.CLAIMS = false;
    const res = await POST(req({ flightNumber: "KL1234", date: "2026-04-12" }));
    expect(res.status).toBe(404);
    expect((await res.json()).reason).toBe("disabled");
  });

  it("400 op een ongeldig vluchtnummer", async () => {
    const res = await POST(req({ flightNumber: "1234", date: "2026-04-12" }));
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("invalid-flight-number");
  });

  it("400 op een ongeldige datum", async () => {
    const res = await POST(req({ flightNumber: "KL1234", date: "no" }));
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("invalid-date");
  });

  it("no-data wanneer er geen flight-data-provider is geconfigureerd ('binnenkort'-staat)", async () => {
    // default: noopFlightLookup
    const res = await POST(req({ flightNumber: "KL1234", date: "2026-04-12" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kind: "no-data", reason: "no-provider" });
  });

  it("found → eu261-bedrag uit lib/eu261 (gesourcete grenzen/bedragen)", async () => {
    const mock: FlightLookupProvider = {
      name: "mock",
      async lookup() {
        // Amsterdam → New York ≈ 5.840 km, 5u vertraging → long-band € 600.
        return { kind: "found", distanceKm: 5840, delayMinutes: 300, withinEU: false };
      },
    };
    __setFlightLookupForTests(mock);
    const res = await POST(req({ flightNumber: "KL643", date: "2026-04-12" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    const expected = eu261Compensation({ distanceKm: 5840, delayMinutes: 300, withinEU: false });
    expect(data).toEqual({
      kind: "found",
      flight: { flightNumber: "KL643", date: "2026-04-12" },
      result: expected,
    });
    expect(data.result.eligible).toBe(true);
    expect(data.result.amountCents).toBe(60_000); // € 600
  });

  it("found maar ≥ 3 u op korte vlucht → € 250-band", async () => {
    const mock: FlightLookupProvider = {
      name: "mock",
      async lookup() {
        // Amsterdam → London ≈ 360 km, 200 min vertraging → short-band € 250.
        return { kind: "found", distanceKm: 360, delayMinutes: 200, withinEU: true };
      },
    };
    __setFlightLookupForTests(mock);
    const data = await (await POST(req({ flightNumber: "KL1003", date: "2026-04-12" }))).json();
    expect(data.kind).toBe("found");
    expect(data.result.amountCents).toBe(25_000);
  });

  it("buitengewone omstandigheid → eligible=false ondanks vertraging", async () => {
    const mock: FlightLookupProvider = {
      name: "mock",
      async lookup() {
        return {
          kind: "found",
          distanceKm: 1000,
          delayMinutes: 240,
          withinEU: true,
          extraordinaryCircumstances: true,
        };
      },
    };
    __setFlightLookupForTests(mock);
    const data = await (await POST(req({ flightNumber: "KL1003", date: "2026-04-12" }))).json();
    expect(data.result.eligible).toBe(false);
    expect(data.result.amountCents).toBe(0);
  });
});
