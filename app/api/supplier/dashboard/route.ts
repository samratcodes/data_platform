import { emailVerificationRequired, getUser, isEmailVerified } from "@/lib/auth/session";
import { rateLimited } from "@/lib/auth/rate-limit";
import { query } from "@/lib/db/client";
import { supplierAccessRequests, supplierListings } from "@/lib/supplier/queries";
import { cleanSingleLine, isUuid, readJsonObject } from "@/lib/security";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  if (user.role !== "supplier" && user.role !== "admin") return Response.json({ error: "Supplier access required." }, { status: 403 });
  const [listings, conversations, accessRequests] = await Promise.all([
    supplierListings(user.id),
    query("SELECT id, operator_slug, created_at FROM conversations WHERE supplier_id = $1 ORDER BY created_at DESC", [user.id]),
    supplierAccessRequests(user.id),
  ]);
  return Response.json({ listings, conversations: conversations.rows, accessRequests }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  if (user.role !== "supplier" && user.role !== "admin") return Response.json({ error: "Supplier access required." }, { status: 403 });
  if (!isEmailVerified(user)) return emailVerificationRequired();
  const parsed = await readJsonObject(request, 24_576);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (await rateLimited(`supplier-dashboard:${user.id}`, 120, 15 * 60_000)) return Response.json({ error: "Update limit reached. Try again shortly." }, { status: 429 });
  if (body.action === "request-status") {
    const requestId = isUuid(body.requestId) ? body.requestId : "";
    const status = cleanSingleLine(body.status, 20);
    if (!requestId || !["reviewing", "accepted", "declined"].includes(status)) return Response.json({ error: "Choose a valid request status." }, { status: 400 });
    const result = await query(`
      UPDATE access_requests requests
      SET status = $1, updated_at = NOW()
      FROM providers
      WHERE requests.id = $2 AND requests.operator_slug = providers.slug
        AND (providers.owner_id = $3 OR $4::boolean)
      RETURNING requests.id, requests.status
    `, [status, requestId, user.id, user.role === "admin"]);
    if (!result.rowCount) return Response.json({ error: "Request not found." }, { status: 404 });
    return Response.json({ request: result.rows[0] });
  }
  return Response.json({ error: "Unknown dashboard action." }, { status: 400 });
}
