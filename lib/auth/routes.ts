import type { UserRole } from "./roles";

/**
 * Single source of truth for page access. Imported by `proxy.ts` (cookie-only
 * check), by server page guards (real session check), and by the login form
 * (safe post-login redirects). Keep this file free of server-only imports.
 */
type RouteRule = { prefix: string; roles?: readonly UserRole[] };

const protectedRoutes: readonly RouteRule[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/supplier", roles: ["supplier", "admin"] },
  { prefix: "/onboarding", roles: ["supplier", "admin"] },
  { prefix: "/dashboard" },
  { prefix: "/settings" },
  { prefix: "/operators" },
];

/** Pages that only make sense for signed-out visitors. */
const guestOnlyRoutes = ["/login", "/signup", "/forgot-password"];

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export function protectedRouteFor(pathname: string) {
  return protectedRoutes.find((rule) => matches(pathname, rule.prefix));
}

export function isGuestOnlyRoute(pathname: string) {
  return guestOnlyRoutes.some((prefix) => matches(pathname, prefix));
}

export function canAccess(pathname: string, role: UserRole) {
  const roles = protectedRouteFor(pathname)?.roles;
  return !roles || roles.includes(role);
}

/** Accepts only same-site, in-app paths so `?next=` can never become an open redirect. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const pathname = value.split(/[?#]/)[0];
  if (isGuestOnlyRoute(pathname) || pathname.startsWith("/api/")) return null;
  return value;
}

export function loginPath(next?: string) {
  const safe = safeNextPath(next);
  return safe ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}
