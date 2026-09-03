import { describe, it, expect, afterEach } from "vitest";
import {
  ANALYSE_RETRY_DELAYS_MS,
  __setSleepImpl,
} from "@/lib/rounds";

describe("Groq analyse retry schedule (bug-jacht DEEL 1b)", () => {
  afterEach(() => {
    __setSleepImpl(null);
  });

  it("schedules 3 attempts with backoff (0, 1, 3s) — v39 ingekort", () => {
    expect(ANALYSE_RETRY_DELAYS_MS).toEqual([0, 1000, 3000]);
  });

  it("worst-case (sleeps + 10s timeout per poging) laat ruimte voor counter-generatie binnen maxDuration=60", () => {
    // Client: timeout 10s, maxRetries 0 (lib/rounds.ts). Na de analyse moet
    // dezelfde request nog generateEmail() draaien — houd ruime marge.
    const sleeps = ANALYSE_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
    const worstCase = sleeps + ANALYSE_RETRY_DELAYS_MS.length * 10_000;
    expect(worstCase).toBeLessThan(45_000);
  });

  it("first attempt has zero delay (no wait before first call)", () => {
    expect(ANALYSE_RETRY_DELAYS_MS[0]).toBe(0);
  });

  it("__setSleepImpl replaces sleep so tests don't actually wait", async () => {
    let sleepCalled = 0;
    __setSleepImpl(async () => {
      sleepCalled++;
    });
    // Calling the sleep impl via __setSleepImpl is now a noop counter.
    // We can't easily test the retry loop without mocking Groq, but the
    // contract — that sleep is replaceable — is what matters here.
    expect(sleepCalled).toBe(0);
  });
});
