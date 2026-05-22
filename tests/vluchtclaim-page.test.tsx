import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VluchtclaimClient from "@/app/vluchtclaim/VluchtclaimClient";

/**
 * v28 DEEL 4 — vluchtclaim UI. We mocken /api/vluchtclaim/check vanaf de
 * client; de pure calc + gates zijn al gedekt in tests/vluchtclaim.test.ts.
 */
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("VluchtclaimClient", () => {
  it("toont 'binnenkort'-staat bij no-data van de server", async () => {
    (fetch as unknown as { mockResolvedValue: Function }).mockResolvedValue({
      ok: true,
      json: async () => ({ kind: "no-data", reason: "no-provider" }),
    });
    render(<VluchtclaimClient />);
    fireEvent.change(screen.getByTestId("vluchtclaim-flightnumber"), { target: { value: "KL1234" } });
    fireEvent.change(screen.getByTestId("vluchtclaim-date"), { target: { value: "2026-04-12" } });
    fireEvent.click(screen.getByTestId("vluchtclaim-submit"));
    await waitFor(() => expect(screen.getByTestId("vluchtclaim-no-data")).toBeInTheDocument());
    // Waitlist mailto aanwezig — eerlijk over wat er nu wel/niet kan.
    const wl = screen.getByTestId("vluchtclaim-waitlist") as HTMLAnchorElement;
    expect(wl.getAttribute("href")).toMatch(/^mailto:hallo@degeldheld\.com/);
  });

  it("toont een eligible resultaat met een 'Start claim'-CTA bij een found-respons", async () => {
    (fetch as unknown as { mockResolvedValue: Function }).mockResolvedValue({
      ok: true,
      json: async () => ({
        kind: "found",
        flight: { flightNumber: "KL643", date: "2026-04-12" },
        result: { eligible: true, band: "long", amountCents: 60_000, reden: "> 3.500 km en ≥ 4 u vertraging." },
      }),
    });
    render(<VluchtclaimClient />);
    fireEvent.change(screen.getByTestId("vluchtclaim-flightnumber"), { target: { value: "KL643" } });
    fireEvent.change(screen.getByTestId("vluchtclaim-date"), { target: { value: "2026-04-12" } });
    fireEvent.click(screen.getByTestId("vluchtclaim-submit"));
    const r = await screen.findByTestId("vluchtclaim-result");
    expect(r).toHaveTextContent(/Mogelijk €/);
    expect(r).toHaveTextContent(/600/);
    expect(screen.getByTestId("vluchtclaim-start-claim")).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:hallo@degeldheld\.com\?subject=.*KL643/),
    );
  });

  it("validatie: lege inputs → error, geen fetch", async () => {
    render(<VluchtclaimClient />);
    fireEvent.click(screen.getByTestId("vluchtclaim-submit"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });
});
