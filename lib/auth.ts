import NextAuth, { type NextAuthConfig, type Session } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/db";
import {
  jwtCallback,
  sessionCallback,
  authorizedCallback,
  PROTECTED_PATHS,
} from "@/lib/auth-callbacks";

export { PROTECTED_PATHS };

const apiKey = process.env.RESEND_API_KEY ?? "";
const from = process.env.EMAIL_FROM ?? "DeGeldHeld <hallo@degeldheld.com>";

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login", verifyRequest: "/login?check=email" },
  providers: [
    Resend({
      apiKey,
      from,
    }),
  ],
  callbacks: {
    jwt: jwtCallback as never,
    session: sessionCallback as never,
    authorized: authorizedCallback as never,
  },
  events: {
    async createUser({ user }) {
      // v7 referrals — link a new signup back to the inviter if a ref_code
      // cookie is set. Fail-soft: signup never blocks on referral errors.
      try {
        const { cookies } = await import("next/headers");
        const jar = await cookies();
        const code = jar.get("ref_code")?.value;
        if (code && user?.id) {
          const { consumeReferral } = await import("@/lib/referral");
          await consumeReferral(code, user.id);
          jar.set("ref_code", "", { maxAge: 0, path: "/" });
        }
      } catch {
        // swallow — referral is not critical for signup
      }
      // v15 claim-on-signup — reassign anonymous bills to this user.
      try {
        const { cookies } = await import("next/headers");
        const jar = await cookies();
        const { ANON_COOKIE_NAME } = await import("@/lib/anon-session");
        const sid = jar.get(ANON_COOKIE_NAME)?.value;
        if (!sid || !user?.id) return;
        const { claimAnonymousBills } = await import("@/lib/anon-claim");
        await claimAnonymousBills(user.id, sid);
        jar.set(ANON_COOKIE_NAME, "", { maxAge: 0, path: "/" });
      } catch {
        // swallow — claim is best-effort; cron cleans up stale bills
      }
    },
    async signIn({ user }) {
      // v15: existing users who are already logged in but still carry
      // an anonymous cookie (e.g. browsed anonymously after signing
      // out, then signed in again) get their bills claimed here too.
      try {
        const { cookies } = await import("next/headers");
        const jar = await cookies();
        const { ANON_COOKIE_NAME } = await import("@/lib/anon-session");
        const sid = jar.get(ANON_COOKIE_NAME)?.value;
        if (!sid || !user?.id) return;
        const { claimAnonymousBills } = await import("@/lib/anon-claim");
        await claimAnonymousBills(user.id, sid);
        jar.set(ANON_COOKIE_NAME, "", { maxAge: 0, path: "/" });
      } catch {
        // never block signin
      }
    },
  },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export type AppSession = Session & { user: { id: string; email: string; name?: string | null } };

export async function requireUser(): Promise<AppSession["user"]> {
  const session = (await auth()) as AppSession | null;
  if (!session?.user?.id) throw new Error("UNAUTHORIZED");
  return session.user;
}

export function isProtectedPath(pathname: string): boolean {
  return ["/dashboard", "/onderhandel", "/pay"].some((p) => pathname.startsWith(p));
}
