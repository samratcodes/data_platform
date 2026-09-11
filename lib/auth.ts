import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { cookies } from "next/headers";
import { query } from "./database";
import { isSameOriginMutation } from "./security";

export type UserRole = "buyer" | "supplier" | "admin";
export type SessionUser = { id: string; name: string; email: string; role: UserRole; emailVerifiedAt: string | null };
const cookieName = process.env.NODE_ENV === "production" ? "__Host-filemarket_session" : "filemarket_session";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const scryptOptions = { cost: 32_768, blockSize: 8, parallelization: 1, maxmem: 64 * 1024 * 1024 };
const derive = (password: string, salt: string, options?: ScryptOptions) => new Promise<Buffer>((resolve, reject) => {
  const done = (error: Error | null, key: Buffer) => error ? reject(error) : resolve(key);
  if (options) scrypt(password, salt, 64, options, done);
  else scrypt(password, salt, 64, done);
});

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, scryptOptions);
  return `scrypt$${scryptOptions.cost}$${scryptOptions.blockSize}$${scryptOptions.parallelization}$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const modern = stored.split("$");
  const legacy = stored.split(":");
  const isModern = modern.length === 6 && modern[0] === "scrypt";
  const salt = isModern ? modern[4] : legacy[0];
  const expected = isModern ? modern[5] : legacy[1];
  if (!salt || !expected || !/^[a-f0-9]+$/i.test(expected)) return false;
  const options = isModern ? { cost: Number(modern[1]), blockSize: Number(modern[2]), parallelization: Number(modern[3]), maxmem: 64 * 1024 * 1024 } : undefined;
  const hash = await derive(password, salt, options);
  const buffer = Buffer.from(expected, "hex");
  return buffer.length === hash.length && timingSafeEqual(buffer, hash);
}

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const result = await query<SessionUser>(`SELECT users.id, users.name, users.email, users.role, users.email_verified_at AS "emailVerifiedAt" FROM sessions
    JOIN users ON users.id = sessions.user_id WHERE token_hash = $1 AND expires_at > $2`, [digest(token), Date.now()]);
  return result.rows[0] ?? null;
}

export function isEmailVerified(user: SessionUser) {
  return user.role === "admin" || Boolean(user.emailVerifiedAt);
}

export function emailVerificationRequired() {
  return Response.json({ error: "Verify your email before using this feature." }, { status: 403 });
}

export async function createSession(userId: string) {
  const store = await cookies();
  const previous = store.get(cookieName)?.value;
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await query(`
    WITH expired AS (
      DELETE FROM sessions WHERE expires_at < $1
    ), previous_session AS (
      DELETE FROM sessions WHERE token_hash = $4
    )
    INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($2, $3, $5)
  `, [now, digest(token), userId, previous ? digest(previous) : "no-previous-session", now + 604800000]);
  store.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800 });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [digest(token)]);
  store.delete(cookieName);
}

export function sameOrigin(request: Request) {
  return isSameOriginMutation(request);
}

export async function rateLimited(key: string, limit = 12, windowMs = 900_000) {
  const now = Date.now();
  const result = await query<{ attempts: number }>(`
    INSERT INTO auth_attempts (key, attempts, reset_at) VALUES ($1, 1, $2)
    ON CONFLICT(key) DO UPDATE SET
      attempts = CASE WHEN auth_attempts.reset_at < $3 THEN 1 ELSE auth_attempts.attempts + 1 END,
      reset_at = CASE WHEN auth_attempts.reset_at < $3 THEN $2 ELSE auth_attempts.reset_at END
    RETURNING attempts
  `, [digest(key), now + windowMs, now]);
  return result.rows[0].attempts > limit;
}

export async function clearRateLimit(key: string) {
  await query("DELETE FROM auth_attempts WHERE key = $1", [digest(key)]);
}
