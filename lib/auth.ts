import NextAuth, { type NextAuthConfig, type Session } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/db";

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
    session({ session, user }) {
      if (session.user && user?.id) {
        (session.user as { id?: string }).id = user.id;
      }
      return session;
    },
    authorized({ auth, request }) {
      const protectedPaths = ["/dashboard", "/onderhandel", "/pay"];
      const path = request.nextUrl.pathname;
      const isProtected = protectedPaths.some((p) => path.startsWith(p));
      if (!isProtected) return true;
      return !!auth?.user;
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
