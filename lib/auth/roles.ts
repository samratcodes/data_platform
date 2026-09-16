export type UserRole = "buyer" | "supplier" | "admin";

/** Where each role lands after signing in or when it opens a page it cannot use. */
export function homePathFor(role: UserRole) {
  return role === "admin" ? "/admin" : role === "supplier" ? "/supplier" : "/map";
}
