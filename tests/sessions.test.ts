import { describe, it, expect } from "vitest";
import {
  isAuthenticated,
  getUserId,
  getUserEmail,
  isSessionExpired,
  isProtectedRoute,
  buildLoginRedirect,
  type MinimalSession,
} from "../lib/sessions";

describe("sessions/isAuthenticated", () => {
  it("false for null", () => {
    expect(isAuthenticated(null)).toBe(false);
  });
  it("false for undefined", () => {
    expect(isAuthenticated(undefined)).toBe(false);
  });
  it("false for empty user", () => {
    expect(isAuthenticated({ user: null })).toBe(false);
  });
  it("false for user without id", () => {
    expect(isAuthenticated({ user: { email: "x@y.nl" } })).toBe(false);
  });
  it("true for user with id", () => {
    expect(isAuthenticated({ user: { id: "u1", email: "x@y.nl" } })).toBe(true);
  });
});

describe("sessions/getUserId", () => {
  it("null when no session", () => {
    expect(getUserId(null)).toBeNull();
  });
  it("returns id when present", () => {
    expect(getUserId({ user: { id: "u1" } })).toBe("u1");
  });
});

describe("sessions/getUserEmail", () => {
  it("null when no session", () => {
    expect(getUserEmail(undefined)).toBeNull();
  });
  it("returns email when present", () => {
    expect(getUserEmail({ user: { id: "u1", email: "a@b.nl" } })).toBe("a@b.nl");
  });
});

describe("sessions/isSessionExpired", () => {
  it("expired when no expires field", () => {
    expect(isSessionExpired({ user: { id: "u1" } })).toBe(true);
  });
  it("expired when null", () => {
    expect(isSessionExpired(null)).toBe(true);
  });
  it("expired when invalid date string", () => {
    expect(isSessionExpired({ expires: "not-a-date" })).toBe(true);
  });
  it("not expired when expires in future", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    expect(isSessionExpired({ expires: future })).toBe(false);
  });
  it("expired when expires in past", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isSessionExpired({ expires: past })).toBe(true);
  });
});

describe("sessions/isProtectedRoute", () => {
  it.each(["/dashboard", "/dashboard/foo", "/onderhandel", "/onderhandel/upload", "/pay/123"])(
    "true for protected: %s",
    (p) => {
      expect(isProtectedRoute(p)).toBe(true);
    },
  );
  it.each(["/", "/login", "/faq", "/api/health", "/api/proof"])(
    "false for public: %s",
    (p) => {
      expect(isProtectedRoute(p)).toBe(false);
    },
  );

  it("false for path that just contains prefix later in string", () => {
    expect(isProtectedRoute("/foo/dashboard")).toBe(false);
  });
});

describe("sessions/buildLoginRedirect", () => {
  it("appends from query param", () => {
    expect(buildLoginRedirect("/dashboard")).toBe("/login?from=%2Fdashboard");
  });

  it("does not append from when path is /login", () => {
    expect(buildLoginRedirect("/login")).toBe("/login");
  });

  it("returns absolute URL when base is provided", () => {
    expect(buildLoginRedirect("/dashboard", "https://degeldheld.com")).toContain(
      "https://degeldheld.com/login",
    );
  });
});

describe("sessions/integration scenarios", () => {
  it("happy path session", () => {
    const s: MinimalSession = {
      user: { id: "u1", email: "u1@nl", name: "User" },
      expires: new Date(Date.now() + 100000).toISOString(),
    };
    expect(isAuthenticated(s)).toBe(true);
    expect(isSessionExpired(s)).toBe(false);
    expect(getUserId(s)).toBe("u1");
  });

  it("logged-out scenarios all behave the same", () => {
    expect(isAuthenticated(null)).toBe(false);
    expect(isAuthenticated(undefined)).toBe(false);
    expect(isAuthenticated({})).toBe(false);
    expect(isAuthenticated({ user: null })).toBe(false);
  });
});
