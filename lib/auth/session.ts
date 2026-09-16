import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { query } from "@/lib/db/client";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./cookie";
import type { UserRole } from "./roles";

export type SessionUser = { id: string; name: string; email: string; role: UserRole; emailVerifiedAt: string | null };

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** The signed-in user, or null. Cached so one request never looks the session up twice. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await query<SessionUser>(`SELECT users.id, users.name, users.email, users.role, users.email_verified_at AS "emailVerifiedAt" FROM sessions
    JOIN users ON users.id = sessions.user_id WHERE token_hash = $1 AND expires_at > $2`, [digest(token), Date.now()]);
  return result.rows[0] ?? null;
});

export function isEmailVerified(user: SessionUser) {
  return user.role === "admin" || Boolean(user.emailVerifiedAt);
}

export function emailVerificationRequired() {
  return Response.json({ error: "Verify your email before using this feature." }, { status: 403 });
}

export async function createSession(userId: string) {
  const store = await cookies();
  const previous = store.get(SESSION_COOKIE)?.value;
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await query(`
    WITH expired AS (
      DELETE FROM sessions WHERE expires_at < $1
    ), previous_session AS (
      DELETE FROM sessions WHERE token_hash = $4
    )
    INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($2, $3, $5)
  `, [now, digest(token), userId, previous ? digest(previous) : "no-previous-session", now + SESSION_MAX_AGE_SECONDS * 1000]);
  store.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_SECONDS });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [digest(token)]);
  store.delete(SESSION_COOKIE);
}
