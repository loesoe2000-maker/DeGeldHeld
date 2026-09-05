import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RelayConsentPrompt from "../components/RelayConsentPrompt";

/**
 * v25/v26 — the consent UI resolves/asks for the provider address and posts it
 * so sendFirstRelayMail can fire. v26 adds confirm-before-send (a verified
 * address must be confirmed), required manual entry on doubt, and an honest
 * note for no-email providers. Card-first gate (GUARDRAIL 4) stays.
 */
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ track: (...a: unknown[]) => track(...a) }));

const verifiedProps = {
  negotiationId: "neg_1",
  provider: "Greenchoice",
  resolvedProviderEmail: "vragen@greenchoice.nl",
  channel: "email" as const,
  noEmailNote: null,
  mandateText: "Ik machtig DeGeldHeld om namens mij te onderhandelen.",
  returnTo: "/onderhandel/email?bill=bill_1",
};

function lastPostedEmail(): string {
  const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
  const [, init] = calls[calls.length - 1];
  return JSON.parse((init as { body: string }).body).providerEmail;
}

beforeEach(() => {
  refresh.mockReset();
  track.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })));
});

describe("RelayConsentPrompt — v41: geen kaart meer nodig", () => {
  it("zonder betaalkaart is relay gewoon beschikbaar (kaart-gate is vervallen)", () => {
    render(<RelayConsentPrompt {...verifiedProps} />);
    // GUARDRAIL 4 (geen kaart → geen relay) bestond om de fee te kunnen innen.
    // Het platform is gratis, dus die drempel is weg.
    expect(screen.queryByTestId("relay-card-required")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fee-mandate-prompt")).not.toBeInTheDocument();
  });
});

describe("RelayConsentPrompt — verified address (confirm-before-send)", () => {
  it("shows the address with a confirm step; start is blocked until confirmed", async () => {
    render(<RelayConsentPrompt {...verifiedProps} />);
    expect(screen.getByTestId("relay-confirm-address")).toBeInTheDocument();
    expect(screen.getByTestId("relay-resolved-email")).toHaveTextContent("vragen@greenchoice.nl");
    expect(screen.queryByTestId("relay-provider-email")).not.toBeInTheDocument();

    // Agreeing alone is not enough — the address must be confirmed.
    fireEvent.click(screen.getByTestId("relay-consent-agree"));
    expect(screen.getByTestId("relay-consent-start")).toBeDisabled();

    fireEvent.click(screen.getByTestId("relay-confirm-yes"));
    expect(screen.getByTestId("relay-consent-start")).toBeEnabled();

    fireEvent.click(screen.getByTestId("relay-consent-start"));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(lastPostedEmail()).toBe("vragen@greenchoice.nl");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(track).toHaveBeenCalledWith("relay_authorized");
  });

  it("'Wijzig' reveals a prefilled input and posts the edited address", async () => {
    render(<RelayConsentPrompt {...verifiedProps} />);
    fireEvent.click(screen.getByTestId("relay-confirm-change"));
    const input = screen.getByTestId("relay-provider-email") as HTMLInputElement;
    expect(input.value).toBe("vragen@greenchoice.nl");
    fireEvent.change(input, { target: { value: "retentie@greenchoice.nl" } });
    fireEvent.click(screen.getByTestId("relay-consent-agree"));
    fireEvent.click(screen.getByTestId("relay-consent-start"));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(lastPostedEmail()).toBe("retentie@greenchoice.nl");
  });
});

describe("RelayConsentPrompt — unknown provider (manual entry required)", () => {
  const unknownProps = { ...verifiedProps, provider: "Ben", resolvedProviderEmail: null, channel: "unknown" as const };

  it("requires a manual address; empty/invalid → error, no POST", async () => {
    render(<RelayConsentPrompt {...unknownProps} />);
    expect(screen.getByTestId("relay-provider-email")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("relay-consent-agree"));
    // start disabled with no address
    expect(screen.getByTestId("relay-consent-start")).toBeDisabled();
    fireEvent.change(screen.getByTestId("relay-provider-email"), { target: { value: "not-an-email" } });
    expect(screen.getByTestId("relay-consent-start")).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the typed address (lowercased) when valid", async () => {
    render(<RelayConsentPrompt {...unknownProps} />);
    fireEvent.click(screen.getByTestId("relay-consent-agree"));
    fireEvent.change(screen.getByTestId("relay-provider-email"), { target: { value: "Klantenservice@Ben.nl" } });
    fireEvent.click(screen.getByTestId("relay-consent-start"));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(lastPostedEmail()).toBe("klantenservice@ben.nl");
  });
});

describe("RelayConsentPrompt — no-email provider (honest expectation)", () => {
  const noEmailProps = {
    ...verifiedProps, provider: "KPN", resolvedProviderEmail: null,
    channel: "no-email" as const,
    noEmailNote: "KPN behandelt service via telefoon en de app — geen publiek e-mailadres.",
  };

  it("shows the honest note and still requires a manual address", () => {
    render(<RelayConsentPrompt {...noEmailProps} />);
    expect(screen.getByTestId("relay-no-email-note")).toHaveTextContent(/geen publiek e-mailadres/i);
    expect(screen.getByTestId("relay-provider-email")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("relay-consent-agree"));
    expect(screen.getByTestId("relay-consent-start")).toBeDisabled(); // no address yet
  });
});
