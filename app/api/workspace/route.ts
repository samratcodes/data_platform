import { randomUUID } from "node:crypto";
import { getUser, sameOrigin } from "@/lib/auth";
import { database } from "@/lib/database";
import { nodes } from "@/components/Landing/nodes";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  const db = database();
  const saved = db.prepare("SELECT operator_slug FROM saved_operators WHERE user_id = ?").all(user.id).map((row) => row.operator_slug);
  const requests = db.prepare("SELECT id, operator_slug, purpose, status, created_at FROM access_requests WHERE user_id = ? ORDER BY created_at DESC").all(user.id);
  return Response.json({ saved, requests }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!nodes.some((node) => node.slug === body?.slug)) return Response.json({ error: "Operator not found" }, { status: 404 });
  const db = database();
  if (body.action === "save") db.prepare("INSERT OR IGNORE INTO saved_operators VALUES (?, ?)").run(user.id, body.slug);
  else if (body.action === "unsave") db.prepare("DELETE FROM saved_operators WHERE user_id = ? AND operator_slug = ?").run(user.id, body.slug);
  else if (body.action === "request") {
    const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";
    if (purpose.length < 10 || purpose.length > 2000) return Response.json({ error: "Describe your use case in 10–2,000 characters." }, { status: 400 });
    db.prepare("INSERT OR IGNORE INTO access_requests (id, user_id, operator_slug, purpose) VALUES (?, ?, ?, ?)").run(randomUUID(), user.id, body.slug, purpose);
  } else return Response.json({ error: "Unknown action" }, { status: 400 });
  return GET();
}
