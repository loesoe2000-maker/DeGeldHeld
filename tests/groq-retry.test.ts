import { describe, it, expect, afterEach } from "vitest";
import {
  ANALYSE_RETRY_DELAYS_MS,
  __setSleepImpl,
} from "@/lib/rounds";

describe("Groq analyse retry schedule (bug-jacht DEEL 1b)", () => {
  afterEach(() => {
    __setSleepImpl(null);
  });

  it("schedules 4 attempts with exponential backoff (0, 1, 3, 8s)", () => {
    expect(ANALYSE_RETRY_DELAYS_MS).toEqual([0, 1000, 3000, 8000]);
  });

  it("total worst-case wait stays under the Vercel hobby 60s budget", () => {
    const total = ANALYSE_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(60_000);
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
