import { randomUUID } from "node:crypto";
import { emailVerificationRequired, getUser, isEmailVerified } from "@/lib/auth/session";
import { rateLimited } from "@/lib/auth/rate-limit";
import { database, query } from "@/lib/db/client";
import { cleanMultiline, cleanSingleLine, isUuid, readJsonObject } from "@/lib/security";

export async function GET() {
  const user = await getUser();
  if (user?.role !== "admin") return Response.json({ error: "Admin access required." }, { status: 403 });
  const result = await query("SELECT concierge_requests.*, users.name, users.email FROM concierge_requests JOIN users ON users.id = concierge_requests.user_id ORDER BY created_at DESC");
  return Response.json({ leads: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  if (!isEmailVerified(user)) return emailVerificationRequired();
  const parsed = await readJsonObject(request, 8_192);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (await rateLimited(`concierge:${user.id}`, 10, 60 * 60_000)) return Response.json({ error: "You have reached the brief limit. Try again later." }, { status: 429 });
  const brief = cleanMultiline(body.brief, 4_000);
  const budget = cleanSingleLine(body.budget, 120);
  const timeline = cleanSingleLine(body.timeline, 120);
  if (typeof body.brief !== "string" || body.brief.length > 4_000 || brief.length < 20 || String(body.budget || "").length > 120 || String(body.timeline || "").length > 120) return Response.json({ error: "Describe your project in 20–4,000 characters." }, { status: 400 });
  const id = randomUUID();
  await query("INSERT INTO concierge_requests (id, user_id, brief, budget, timeline) VALUES ($1,$2,$3,$4,$5)", [id, user.id, brief, budget, timeline]);
  return Response.json({ id, status: "new" }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (user?.role !== "admin") return Response.json({ error: "Admin access required." }, { status: 403 });
  const parsed = await readJsonObject(request, 2_048);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  const id = isUuid(body.id) ? body.id : "";
  const status = cleanSingleLine(body.status, 20);
  if (!id || !["new", "contacted", "qualified", "closed"].includes(status)) return Response.json({ error: "Choose a valid lead status." }, { status: 400 });
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE concierge_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status", [status, id]);
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Procurement brief not found." }, { status: 404 });
    }
    await client.query(`
      INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, metadata)
      VALUES ($1, $2, $3, 'concierge_request', $4, $5::jsonb)
    `, [randomUUID(), user.id, `concierge.${status}`, id, JSON.stringify({ status })]);
    await client.query("COMMIT");
    return Response.json({ lead: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
