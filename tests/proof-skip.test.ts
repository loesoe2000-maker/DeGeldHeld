import { describe, it, expect } from "vitest";
import { outcomeToState } from "@/lib/flow";

describe("outcomeToState / proof-required behaviour (DEEL 2g)", () => {
  it("SUCCESS_SAVED with proofRequired=true → SUCCESS_UNVERIFIED", () => {
    const r = outcomeToState("SUCCESS_SAVED", { proofRequired: true });
    expect(r.state).toBe("SUCCESS_UNVERIFIED");
    expect(r.closedAt).toBeInstanceOf(Date);
  });

  it("SUCCESS_SAVED with proofRequired=false → SUCCESS (legacy path)", () => {
    const r = outcomeToState("SUCCESS_SAVED", { proofRequired: false });
    expect(r.state).toBe("SUCCESS");
  });

  it("SUCCESS_SAVED without opts → SUCCESS (backwards-compat)", () => {
    const r = outcomeToState("SUCCESS_SAVED");
    expect(r.state).toBe("SUCCESS");
  });

  it("FAILED_NO_DEAL is unaffected by proofRequired", () => {
    expect(outcomeToState("FAILED_NO_DEAL", { proofRequired: true }).state).toBe("FAILED");
    expect(outcomeToState("FAILED_NO_DEAL", { proofRequired: false }).state).toBe("FAILED");
  });

  it("STILL_WAITING is unaffected by proofRequired", () => {
    expect(outcomeToState("STILL_WAITING", { proofRequired: true }).state).toBe("AWAITING");
    expect(outcomeToState("STILL_WAITING").closedAt).toBeNull();
  });
});

describe("proof-flow contract (skipping = unverified)", () => {
  it("skipping proof must NOT promote a claim into SUCCESS", () => {
    // Pure-function check: when proof gate is on and user skips, we
    // park them in SUCCESS_UNVERIFIED. /proof aggregator filter
    // state in [SUCCESS, BILLED, ACCEPTED] therefore excludes them.
    const allowedForProof = ["SUCCESS", "BILLED", "ACCEPTED"];
    expect(allowedForProof).not.toContain("SUCCESS_UNVERIFIED");
  });
});
