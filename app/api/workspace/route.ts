import { randomUUID } from "node:crypto";
import { emailVerificationRequired, getUser, isEmailVerified, rateLimited } from "@/lib/auth";
import { query } from "@/lib/database";
import { verifiedOperator } from "@/lib/operators";
import { cleanMultiline, isSlug, readJsonObject } from "@/lib/security";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  const [savedResult, requestResult] = await Promise.all([
    query<{ operator_slug: string }>(`
      SELECT saved.operator_slug FROM saved_operators saved
      JOIN providers ON providers.slug = saved.operator_slug
      WHERE saved.user_id = $1 AND providers.status = 'approved' AND providers.is_demo = FALSE
    `, [user.id]),
    query(`
      SELECT requests.id, requests.operator_slug, requests.purpose, requests.status, requests.created_at
      FROM access_requests requests JOIN providers ON providers.slug = requests.operator_slug
      WHERE requests.user_id = $1 AND providers.status = 'approved' AND providers.is_demo = FALSE
      ORDER BY requests.created_at DESC
    `, [user.id]),
  ]);
  const saved = savedResult.rows.map((row) => row.operator_slug);
  const requests = requestResult.rows;
  return Response.json({ saved, requests }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  if (!isEmailVerified(user)) return emailVerificationRequired();
  const parsed = await readJsonObject(request, 4_096);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (await rateLimited(`workspace:${user.id}`, 80, 15 * 60_000)) return Response.json({ error: "Too many workspace updates. Try again shortly." }, { status: 429 });
  if (!isSlug(body.slug) || !await verifiedOperator(body.slug)) return Response.json({ error: "Operator not found" }, { status: 404 });
  if (body.action === "save") await query("INSERT INTO saved_operators (user_id, operator_slug) VALUES ($1, $2) ON CONFLICT DO NOTHING", [user.id, body.slug]);
  else if (body.action === "unsave") await query("DELETE FROM saved_operators WHERE user_id = $1 AND operator_slug = $2", [user.id, body.slug]);
  else if (body.action === "request") {
    const purpose = cleanMultiline(body.purpose, 2_000);
    if (typeof body.purpose !== "string" || body.purpose.length > 2_000 || purpose.length < 10) return Response.json({ error: "Describe your use case in 10–2,000 characters." }, { status: 400 });
    await query(`
      INSERT INTO access_requests (id, user_id, operator_slug, purpose) VALUES ($1, $2, $3, $4)
      ON CONFLICT(user_id, operator_slug) DO UPDATE
      SET purpose = EXCLUDED.purpose, status = 'pending', updated_at = NOW()
    `, [randomUUID(), user.id, body.slug, purpose]);
  } else return Response.json({ error: "Unknown action" }, { status: 400 });
  return GET();
}
