/**
 * Pure helpers around session shape — testable without NextAuth runtime.
 */

export type MinimalSession = {
  user?: { id?: string | null; email?: string | null; name?: string | null } | null;
  expires?: string;
};

export function isAuthenticated(session: MinimalSession | null | undefined): boolean {
  return !!session?.user?.id;
}

export function getUserId(session: MinimalSession | null | undefined): string | null {
  return session?.user?.id ?? null;
}

export function getUserEmail(session: MinimalSession | null | undefined): string | null {
  return session?.user?.email ?? null;
}

export function isSessionExpired(session: MinimalSession | null | undefined, now = new Date()): boolean {
  if (!session?.expires) return true;
  const exp = new Date(session.expires).getTime();
  if (Number.isNaN(exp)) return true;
  return exp < now.getTime();
}

const PROTECTED_PREFIXES = ["/dashboard", "/onderhandel", "/pay"];

export function isProtectedRoute(path: string): boolean {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function buildLoginRedirect(from: string, base = ""): string {
  const url = new URL("/login", base || "http://localhost");
  if (from && from !== "/login") url.searchParams.set("from", from);
  return base ? url.toString() : url.pathname + (url.search || "");
}
