import { randomUUID } from "node:crypto";
import { emailVerificationRequired, getUser, isEmailVerified } from "@/lib/auth/session";
import { rateLimited } from "@/lib/auth/rate-limit";
import { query } from "@/lib/db/client";
import { cleanMultiline, cleanSingleLine, readJsonObject } from "@/lib/security";

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
