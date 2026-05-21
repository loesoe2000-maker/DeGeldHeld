import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RelayConsentPrompt from "../components/RelayConsentPrompt";

/**
 * v25 DEEL 2 — the consent UI completes the missing link: it resolves/asks for
 * the provider address and posts it so sendFirstRelayMail can fire. It also
 * enforces the card-first gate (GUARDRAIL 4) in the UI.
 */
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...a: unknown[]) => track(...a) }));

const baseProps = {
  negotiationId: "neg_1",
  provider: "Greenchoice",
  hasFeeCard: true,
  resolvedProviderEmail: "vragen@greenchoice.nl",
  mandateText: "Ik machtig DeGeldHeld om namens mij te onderhandelen.",
  returnTo: "/onderhandel/email?bill=bill_1",
};

beforeEach(() => {
  refresh.mockReset();
  track.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })));
});

describe("RelayConsentPrompt — card gate", () => {
  it("no fee-card → shows the card-link step, not the start button", () => {
    render(<RelayConsentPrompt {...baseProps} hasFeeCard={false} />);
    expect(screen.getByTestId("relay-card-required")).toBeInTheDocument();
    expect(screen.getByTestId("fee-mandate-prompt")).toBeInTheDocument();
    expect(screen.queryByTestId("relay-consent-start")).not.toBeInTheDocument();
  });
});

describe("RelayConsentPrompt — registry hit", () => {
  it("hides the manual input + authorize sends the verified address", async () => {
    render(<RelayConsentPrompt {...baseProps} />);
    expect(screen.queryByTestId("relay-provider-email")).not.toBeInTheDocument();
    expect(screen.getByTestId("relay-provider-known")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("relay-consent-agree"));
    fireEvent.click(screen.getByTestId("relay-consent-start"));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(url).toBe("/api/negotiations/neg_1/relay-authorize");
    expect(JSON.parse((init as { body: string }).body)).toEqual({ providerEmail: "vragen@greenchoice.nl" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(track).toHaveBeenCalledWith("relay_authorized");
  });
});

describe("RelayConsentPrompt — registry miss (manual entry)", () => {
  const missProps = { ...baseProps, provider: "KPN", resolvedProviderEmail: null };

  it("shows the manual email input", () => {
    render(<RelayConsentPrompt {...missProps} />);
    expect(screen.getByTestId("relay-provider-email")).toBeInTheDocument();
  });

  it("blocks an empty/invalid address with a friendly error, no POST", async () => {
    render(<RelayConsentPrompt {...missProps} />);
    fireEvent.click(screen.getByTestId("relay-consent-agree"));
    fireEvent.change(screen.getByTestId("relay-provider-email"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByTestId("relay-consent-start"));
    await waitFor(() => expect(screen.getByText(/geldig e-mailadres/i)).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the typed address when valid", async () => {
    render(<RelayConsentPrompt {...missProps} />);
    fireEvent.click(screen.getByTestId("relay-consent-agree"));
    fireEvent.change(screen.getByTestId("relay-provider-email"), { target: { value: "Klantenservice@KPN.com" } });
    fireEvent.click(screen.getByTestId("relay-consent-start"));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(JSON.parse((init as { body: string }).body)).toEqual({ providerEmail: "klantenservice@kpn.com" });
  });
});

describe("RelayConsentPrompt — requires consent checkbox", () => {
  it("does not POST until the checkbox is ticked", () => {
    render(<RelayConsentPrompt {...baseProps} />);
    fireEvent.click(screen.getByTestId("relay-consent-start"));
    expect(fetch).not.toHaveBeenCalled();
  });
});
