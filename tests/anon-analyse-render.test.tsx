import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AnonymousMailPrompt from "@/components/AnonymousMailPrompt";

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(async () => ({ ok: true })),
}));

describe("AnonymousMailPrompt — v15 DEEL 2", () => {
  it("shows the projected yearly savings + provider headline", () => {
    render(
      <AnonymousMailPrompt
        billId="bill_abc"
        provider="KPN"
        yearlySavingsCents={27200}
      />,
    );
    expect(screen.getByTestId("anon-mail-prompt")).toBeTruthy();
    expect(screen.getByText(/€272\/jaar/)).toBeTruthy();
    expect(screen.getByText(/KPN/)).toBeTruthy();
  });

  it("renders email-input + submit button", () => {
    render(
      <AnonymousMailPrompt billId="b" provider="KPN" yearlySavingsCents={1000} />,
    );
    expect(screen.getByTestId("anon-email-input")).toBeTruthy();
    expect(screen.getByTestId("anon-submit")).toBeTruthy();
  });

  it("clamps negative savings to 0 (defensive)", () => {
    render(
      <AnonymousMailPrompt
        billId="b"
        provider="KPN"
        yearlySavingsCents={-500}
      />,
    );
    expect(screen.getByText(/€0\/jaar/)).toBeTruthy();
  });

  it("the email-prompt section sits in the page (data-testid present)", () => {
    render(
      <AnonymousMailPrompt billId="b" provider="Eneco" yearlySavingsCents={10000} />,
    );
    const section = screen.getByTestId("anon-mail-prompt");
    expect(section).toBeTruthy();
  });
});

describe("Analyse page anonymous detection — source-level", () => {
  const { readFileSync } = require("node:fs");
  const { resolve } = require("node:path");
  const src = readFileSync(
    resolve(__dirname, "../app/onderhandel/analyse/page.tsx"),
    "utf8",
  );

  it("page reads the anonymous cookie when no session", () => {
    expect(src).toMatch(/ANON_COOKIE_NAME/);
    expect(src).toMatch(/anonymousSessionId/);
  });

  it("page renders AnonymousMailPrompt when isAnonymous", () => {
    expect(src).toMatch(/AnonymousMailPrompt/);
    expect(src).toMatch(/isAnonymous\s*\?/);
  });

  it("paywall is skipped for anonymous (no userId)", () => {
    expect(src).toMatch(/userId && \(await requiresPayment/);
  });
});
