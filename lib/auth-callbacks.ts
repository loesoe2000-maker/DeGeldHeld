// Pure callback functions — extracted so unit tests can import them
// without pulling NextAuth (which depends on next/server and breaks jsdom).

export const PROTECTED_PATHS = ["/dashboard", "/onderhandel", "/pay"];

/**
 * v15 anonymous flow: these /onderhandel paths are publicly accessible
 * so first-time visitors can upload + see analysis WITHOUT signing up.
 * Sub-routes that touch real user data still require auth.
 */
const ANON_ALLOWED_EXACT = new Set([
  "/onderhandel",
  "/onderhandel/analyse",
]);

export function isPathProtected(pathname: string): boolean {
  if (ANON_ALLOWED_EXACT.has(pathname)) return false;
  return PROTECTED_PATHS.some((p) => pathname.startsWith(p));
}

export function jwtCallback({
  token,
  user,
}: {
  token: Record<string, unknown>;
  user?: { id?: string } | null;
}) {
  if (user?.id) token.id = user.id;
  return token;
}

export function sessionCallback({
  session,
  token,
}: {
  session: { user?: { email?: string | null; id?: string } | null; expires?: string };
  token?: Record<string, unknown> | null;
}) {
  if (session.user && token) {
    const id = (token.id as string | undefined) ?? (token.sub as string | undefined);
    if (id) (session.user as { id?: string }).id = id;
  }
  return session;
}

export function authorizedCallback({
  auth,
  request,
}: {
  auth: { user?: unknown } | null;
  request: { nextUrl: { pathname: string } };
}) {
  const path = request.nextUrl.pathname;
  if (!isPathProtected(path)) return true;
  return !!auth?.user;
}
