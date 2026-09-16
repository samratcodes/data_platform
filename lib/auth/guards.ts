import "server-only";

import { redirect } from "next/navigation";
import { homePathFor } from "./roles";
import { canAccess, loginPath, safeNextPath } from "./routes";
import { getUser } from "./session";

/**
 * Page-level authorization. `proxy.ts` only checks that a session cookie exists;
 * these guards validate the session against the database and enforce roles.
 */
export async function requireAccess(pathname: string) {
  const user = await getUser();
  if (!user) redirect(loginPath(pathname));
  if (!canAccess(pathname, user.role)) redirect(homePathFor(user.role));
  return user;
}

/** Sends signed-in users away from login/signup pages. */
export async function redirectSignedInUser(next?: string | string[]) {
  const user = await getUser();
  if (!user) return;
  const target = safeNextPath(typeof next === "string" ? next : undefined);
  redirect(target && canAccess(target.split(/[?#]/)[0], user.role) ? target : homePathFor(user.role));
}
