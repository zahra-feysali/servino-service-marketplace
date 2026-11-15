import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Coarse route protection for dashboards (Next.js 16 `proxy`, Node.js runtime).
 *
 * It only checks that a session token exists. Role and account-status decisions are
 * made by the server-side guards in each dashboard layout/page and every server action
 * (src/lib/authz.ts), which read the current role/status from PostgreSQL. Doing role
 * routing here from the (possibly stale) JWT could cause redirect loops after an admin
 * suspends a user or changes their role.
 */
export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });

  if (!token?.sub) {
    const { pathname, search } = request.nextUrl;
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
