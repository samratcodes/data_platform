import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { loginPath, protectedRouteFor } from "@/lib/auth/routes";

/**
 * Optimistic route protection: signed-out visitors never reach protected pages.
 * This only checks that a session cookie exists (no database call, so it stays
 * fast on every navigation and prefetch). Pages then validate the session and
 * role with `requireAccess`, and API routes authorize each request themselves.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (protectedRouteFor(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    const response = NextResponse.redirect(new URL(loginPath(`${pathname}${search}`), request.url));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes (they return JSON 401s), framework assets, and static files.
  matcher: ["/((?!api/|_next/static|_next/image|vendor/|fonts/|favicon|icon|apple-icon|.*\\.[a-z0-9]+$).*)"],
};
