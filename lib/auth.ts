import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { database } from "./database";

export type SessionUser = { id: string; name: string; email: string };
const derive = promisify(scrypt);
const cookieName = "filemarket_session";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  const hash = await derive(password, salt, 64) as Buffer;
  const buffer = Buffer.from(expected, "hex");
  return buffer.length === hash.length && timingSafeEqual(buffer, hash);
}

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const user = database().prepare(`SELECT users.id, users.name, users.email FROM sessions
    JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?`)
    .get(digest(token), Date.now()) as SessionUser | undefined;
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

export async function createSession(userId: string) {
  const store = await cookies();
  const previous = store.get(cookieName)?.value;
  if (previous) database().prepare("DELETE FROM sessions WHERE token_hash = ?").run(digest(previous));
  database().prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  const token = randomBytes(32).toString("hex");
  database().prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(digest(token), userId, Date.now() + 604800000);
  store.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800 });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (token) database().prepare("DELETE FROM sessions WHERE token_hash = ?").run(digest(token));
  store.delete(cookieName);
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

export function rateLimited(key: string) {
  const db = database();
  const now = Date.now();
  db.prepare("DELETE FROM auth_attempts WHERE reset_at < ?").run(now);
  db.prepare("INSERT INTO auth_attempts VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1").run(digest(key), now + 900000);
  const row = db.prepare("SELECT attempts FROM auth_attempts WHERE key = ?").get(digest(key)) as { attempts: number };
  return row.attempts > 12;
}
