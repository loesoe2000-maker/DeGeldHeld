import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { isProtectedPath } from "@/lib/auth";

export default auth((req) => {
  const path = req.nextUrl.pathname;
  if (!isProtectedPath(path)) return NextResponse.next();
  if (req.auth?.user) return NextResponse.next();

  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("from", path);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/dashboard/:path*", "/onderhandel/:path*", "/pay/:path*"],
};
