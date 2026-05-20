import { describe, it, expect } from "vitest";
import { jwtCallback, sessionCallback, authorizedCallback, PROTECTED_PATHS } from "../lib/auth-callbacks";

describe("auth/jwtCallback", () => {
  it("copies user.id onto token on signin", () => {
    const result = jwtCallback({ token: {}, user: { id: "u1" } });
    expect(result.id).toBe("u1");
  });

  it("preserves existing token on subsequent requests", () => {
    const result = jwtCallback({ token: { id: "u1", sub: "u1" } });
    expect(result.id).toBe("u1");
    expect(result.sub).toBe("u1");
  });

  it("does not mutate token when user.id is missing", () => {
    const result = jwtCallback({ token: { sub: "fromsub" }, user: null });
    expect(result.id).toBeUndefined();
    expect(result.sub).toBe("fromsub");
  });

  it("ignores user without id field", () => {
    const result = jwtCallback({ token: {}, user: {} });
    expect(result.id).toBeUndefined();
  });
});

describe("auth/sessionCallback (JWT mode)", () => {
  it("populates session.user.id from token.id", () => {
    const r = sessionCallback({
      session: { user: { email: "u@nl" }, expires: "2099-01-01" },
      token: { id: "u1" },
    });
    expect(r.user!.id).toBe("u1");
  });

  it("falls back to token.sub when token.id absent", () => {
    const r = sessionCallback({
      session: { user: { email: "u@nl" }, expires: "2099-01-01" },
      token: { sub: "subid" },
    });
    expect(r.user!.id).toBe("subid");
  });

  it("prefers token.id over token.sub", () => {
    const r = sessionCallback({
      session: { user: { email: "u@nl" }, expires: "2099-01-01" },
      token: { id: "real", sub: "subid" },
    });
    expect(r.user!.id).toBe("real");
  });

  it("leaves session unchanged when token is empty", () => {
    const r = sessionCallback({
      session: { user: { email: "u@nl" }, expires: "2099-01-01" },
      token: {},
    });
    expect(r.user!.id).toBeUndefined();
  });

  it("returns session as-is when no token", () => {
    const r = sessionCallback({
      session: { user: { email: "u@nl" }, expires: "2099-01-01" },
      token: null,
    });
    expect(r.user!.id).toBeUndefined();
  });
});

describe("auth/authorizedCallback", () => {
  it("allows public routes regardless of auth state", () => {
    expect(authorizedCallback({ auth: null, request: { nextUrl: { pathname: "/" } } })).toBe(true);
    expect(authorizedCallback({ auth: null, request: { nextUrl: { pathname: "/faq" } } })).toBe(true);
    expect(authorizedCallback({ auth: null, request: { nextUrl: { pathname: "/login" } } })).toBe(true);
  });

  it("blocks protected routes when not authed", () => {
    expect(authorizedCallback({ auth: null, request: { nextUrl: { pathname: "/dashboard" } } })).toBe(false);
    expect(authorizedCallback({ auth: null, request: { nextUrl: { pathname: "/pay/abc" } } })).toBe(false);
  });

  it("v15 anonymous flow: /onderhandel + /onderhandel/analyse are PUBLIC", () => {
    // First-time visitors must reach the upload form + analysis page
    // without signing up. Both return true (allowed) even with no auth.
    expect(authorizedCallback({ auth: null, request: { nextUrl: { pathname: "/onderhandel" } } })).toBe(true);
    expect(
      authorizedCallback({ auth: null, request: { nextUrl: { pathname: "/onderhandel/analyse" } } }),
    ).toBe(true);
  });

  it("allows protected routes when authed", () => {
    const auth = { user: { email: "x@y" } };
    expect(authorizedCallback({ auth, request: { nextUrl: { pathname: "/dashboard" } } })).toBe(true);
    expect(authorizedCallback({ auth, request: { nextUrl: { pathname: "/onderhandel/email" } } })).toBe(true);
  });

  it("blocks /onderhandel/* DEEP paths (not the public exacts) when not authed", () => {
    // /onderhandel/email touches real user data → still protected.
    expect(
      authorizedCallback({
        auth: null,
        request: { nextUrl: { pathname: "/onderhandel/email" } },
      }),
    ).toBe(false);
  });

  it("PROTECTED_PATHS contains expected entries", () => {
    expect(PROTECTED_PATHS).toContain("/dashboard");
    expect(PROTECTED_PATHS).toContain("/onderhandel");
    expect(PROTECTED_PATHS).toContain("/pay");
  });
});
