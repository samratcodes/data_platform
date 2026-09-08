import { randomUUID } from "node:crypto";
import { createSession, destroySession, getUser, hashPassword, rateLimited, sameOrigin, verifyPassword } from "@/lib/auth";
import { database } from "@/lib/database";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ action: string }> }) {
  if ((await context.params).action !== "session") return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ user: await getUser() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const { action } = await context.params;
  if (action === "logout") { await destroySession(); return Response.json({ ok: true }); }
  if (!["login", "signup"].includes(action)) return Response.json({ error: "Not found" }, { status: 404 });
  if (Number(request.headers.get("content-length")) > 8192) return Response.json({ error: "Request too large" }, { status: 413 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 10 || password.length > 128 || (action === "signup" && (name.length < 2 || name.length > 80))) {
    return Response.json({ error: "Enter a valid email, a 10–128 character password, and your name when signing up." }, { status: 400 });
  }
  if (rateLimited(`account:${email}`)) return Response.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  const db = database();
  if (action === "signup") {
    const id = randomUUID();
    const hash = await hashPassword(password);
    const result = db.prepare("INSERT OR IGNORE INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)").run(id, name, email, hash);
    if (!result.changes) return Response.json({ error: "Unable to create this account. Try logging in." }, { status: 409 });
    await createSession(id);
    return Response.json({ user: { id, name, email } }, { status: 201 });
  }
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as { id: string; name: string; email: string; password_hash: string } | undefined;
  const valid = await verifyPassword(password, user?.password_hash ?? `${"0".repeat(32)}:${"0".repeat(128)}`);
  if (!user || !valid) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  await createSession(user.id);
  return Response.json({ user: { id: user.id, name: user.name, email: user.email } });
}
