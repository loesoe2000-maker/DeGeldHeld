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
        if (!code || !user?.id) return;
        const { consumeReferral } = await import("@/lib/referral");
        await consumeReferral(code, user.id);
        // Clear the cookie so a refresh doesn't double-fire (harmless but tidy).
        jar.set("ref_code", "", { maxAge: 0, path: "/" });
      } catch {
        // swallow — referral is not critical for signup
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
