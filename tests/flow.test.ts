import { describe, it, expect } from "vitest";
import {
  canTransition,
  nextState,
  isTerminal,
  terminalStates,
  transition,
  computeFollowUpAt,
  shouldFollowUp,
  outcomeToState,
  FOLLOW_UP_DAYS,
} from "../lib/flow";

describe("flow/canTransition — happy path", () => {
  it.each([
    ["NIEUW", "BILL_UPLOAD"],
    ["BILL_UPLOAD", "ANALYSE"],
    ["ANALYSE", "EMAIL_GEN"],
    ["EMAIL_GEN", "AWAITING"],
    ["AWAITING", "SUCCESS"],
    ["SUCCESS", "BILLED"],
  ])("allows %s → %s", (a, b) => {
    expect(canTransition(a as never, b as never)).toBe(true);
  });
});

describe("flow/canTransition — failure transitions", () => {
  it.each(["NIEUW", "BILL_UPLOAD", "ANALYSE", "EMAIL_GEN", "AWAITING"])(
    "allows %s → FAILED",
    (s) => {
      expect(canTransition(s as never, "FAILED" as never)).toBe(true);
    },
  );

  it("disallows SUCCESS → FAILED", () => {
    expect(canTransition("SUCCESS" as never, "FAILED" as never)).toBe(false);
  });

  it("disallows BILLED → FAILED", () => {
    expect(canTransition("BILLED" as never, "FAILED" as never)).toBe(false);
  });
});

describe("flow/canTransition — invalid", () => {
  it("disallows skipping states", () => {
    expect(canTransition("NIEUW" as never, "ANALYSE" as never)).toBe(false);
    expect(canTransition("BILL_UPLOAD" as never, "EMAIL_GEN" as never)).toBe(false);
  });

  it("disallows backward transitions", () => {
    expect(canTransition("AWAITING" as never, "ANALYSE" as never)).toBe(false);
    expect(canTransition("SUCCESS" as never, "AWAITING" as never)).toBe(false);
  });

  it("disallows terminal exits", () => {
    expect(canTransition("BILLED" as never, "AWAITING" as never)).toBe(false);
    expect(canTransition("FAILED" as never, "SUCCESS" as never)).toBe(false);
  });
});

describe("flow/transition", () => {
  it("returns target state on valid", () => {
    expect(transition("NIEUW" as never, "BILL_UPLOAD" as never)).toBe("BILL_UPLOAD");
  });
  it("throws on invalid", () => {
    expect(() => transition("NIEUW" as never, "SUCCESS" as never)).toThrow(/Invalid/);
  });
});

describe("flow/nextState", () => {
  it("NIEUW → BILL_UPLOAD", () => {
    expect(nextState("NIEUW" as never)).toBe("BILL_UPLOAD");
  });
  it("AWAITING → SUCCESS", () => {
    expect(nextState("AWAITING" as never)).toBe("SUCCESS");
  });
  it("BILLED → null", () => {
    expect(nextState("BILLED" as never)).toBeNull();
  });
  it("FAILED → null", () => {
    expect(nextState("FAILED" as never)).toBeNull();
  });
});

describe("flow/isTerminal + terminalStates", () => {
  it("terminalStates contains BILLED + FAILED", () => {
    expect(terminalStates()).toContain("BILLED");
    expect(terminalStates()).toContain("FAILED");
    expect(terminalStates()).toHaveLength(2);
  });

  it.each(["BILLED", "FAILED"])("terminal: %s", (s) => {
    expect(isTerminal(s as never)).toBe(true);
  });

  it.each(["NIEUW", "BILL_UPLOAD", "ANALYSE", "EMAIL_GEN", "AWAITING", "SUCCESS"])(
    "non-terminal: %s",
    (s) => {
      expect(isTerminal(s as never)).toBe(false);
    },
  );
});

describe("flow/computeFollowUpAt", () => {
  it("is exactly FOLLOW_UP_DAYS later", () => {
    const start = new Date("2026-05-14T10:00:00Z");
    const fu = computeFollowUpAt(start);
    const diffDays = (fu.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(FOLLOW_UP_DAYS);
  });
});

describe("flow/shouldFollowUp", () => {
  it("false when state is not AWAITING", () => {
    expect(
      shouldFollowUp({ state: "EMAIL_GEN" as never, followUpAt: new Date(0) }),
    ).toBe(false);
  });

  it("false when followUpAt is null", () => {
    expect(shouldFollowUp({ state: "AWAITING" as never, followUpAt: null })).toBe(false);
  });

  it("false when followUpAt is in future", () => {
    const future = new Date(Date.now() + 60_000);
    expect(shouldFollowUp({ state: "AWAITING" as never, followUpAt: future })).toBe(false);
  });

  it("true when followUpAt is past and state AWAITING", () => {
    const past = new Date(Date.now() - 60_000);
    expect(shouldFollowUp({ state: "AWAITING" as never, followUpAt: past })).toBe(true);
  });
});

describe("flow/outcomeToState", () => {
  it("SUCCESS_SAVED → SUCCESS + closedAt set", () => {
    const r = outcomeToState("SUCCESS_SAVED");
    expect(r.state).toBe("SUCCESS");
    expect(r.closedAt).toBeInstanceOf(Date);
  });

  it("FAILED_NO_DEAL → FAILED + closedAt set", () => {
    const r = outcomeToState("FAILED_NO_DEAL");
    expect(r.state).toBe("FAILED");
    expect(r.closedAt).toBeInstanceOf(Date);
  });

  it("STILL_WAITING → AWAITING + closedAt null", () => {
    const r = outcomeToState("STILL_WAITING");
    expect(r.state).toBe("AWAITING");
    expect(r.closedAt).toBeNull();
  });
});
