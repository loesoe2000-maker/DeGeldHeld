// Pure callback functions — extracted so unit tests can import them
// without pulling NextAuth (which depends on next/server and breaks jsdom).

export const PROTECTED_PATHS = ["/dashboard", "/onderhandel", "/pay"];

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
  const isProtected = PROTECTED_PATHS.some((p) => path.startsWith(p));
  if (!isProtected) return true;
  return !!auth?.user;
}
