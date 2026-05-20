import { describe, it, expect } from "vitest";
import {
  EMAIL_FROM,
  fromAddress,
  fromDomain,
  isTestSender,
} from "@/lib/email-from";

describe("v20 single verified from-address", () => {
  it("default from-address is on the verified degeldheld.com domain", () => {
    // The runtime constant must never default to a resend.dev test sender.
    expect(fromDomain(EMAIL_FROM)).toBe("degeldheld.com");
    expect(isTestSender(EMAIL_FROM)).toBe(false);
  });

  it("extracts the bare address from a 'Name <addr>' string", () => {
    expect(fromAddress("DeGeldHeld <hallo@degeldheld.com>")).toBe(
      "hallo@degeldheld.com",
    );
    expect(fromAddress("plain@degeldheld.com")).toBe("plain@degeldheld.com");
  });

  it("extracts the domain (lowercased)", () => {
    expect(fromDomain("X <Hallo@DeGeldHeld.com>")).toBe("degeldheld.com");
  });

  it("flags a resend.dev test sender as unverified", () => {
    expect(isTestSender("Test <onboarding@resend.dev>")).toBe(true);
    expect(isTestSender("DeGeldHeld <hallo@degeldheld.com>")).toBe(false);
  });

  it("lib/email.ts and lib/auth.ts share the same EMAIL_FROM constant", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const email = readFileSync(resolve(__dirname, "../lib/email.ts"), "utf8");
    const auth = readFileSync(resolve(__dirname, "../lib/auth.ts"), "utf8");
    expect(email).toMatch(/from\s*=\s*EMAIL_FROM/);
    expect(auth).toMatch(/from\s*=\s*EMAIL_FROM/);
    expect(email).toMatch(/@\/lib\/email-from/);
    expect(auth).toMatch(/@\/lib\/email-from/);
  });
});
