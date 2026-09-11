import { emailVerificationRequired, getUser, isEmailVerified, rateLimited } from "@/lib/auth";
import { database, query } from "@/lib/database";
import { cleanMultiline, cleanSingleLine, isSlug, isUuid, readJsonObject, safeHttpsUrl } from "@/lib/security";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  if (user.role !== "supplier" && user.role !== "admin") return Response.json({ error: "Supplier access required." }, { status: 403 });
  const [providers, applications, conversations, accessRequests] = await Promise.all([
    query(`
      SELECT providers.slug, providers.name, providers.status, providers.verification_level,
             providers.profile_views, providers.modalities, providers.media, providers.profile,
             providers.updated_at,
             (SELECT COUNT(*)::int FROM saved_operators WHERE operator_slug = providers.slug) AS saves,
             (SELECT COUNT(*)::int FROM access_requests WHERE operator_slug = providers.slug) AS access_requests,
             (SELECT COUNT(*)::int FROM conversations WHERE operator_slug = providers.slug) AS conversations
      FROM providers
      WHERE owner_id = $1
      ORDER BY updated_at DESC
    `, [user.id]),
    query("SELECT id, application_kind, business_name, provider_slug, status, verification_level, submitted_at, admin_notes FROM supplier_applications WHERE user_id = $1 ORDER BY submitted_at DESC", [user.id]),
    query("SELECT id, operator_slug, created_at FROM conversations WHERE supplier_id = $1 ORDER BY created_at DESC", [user.id]),
    query(`
      SELECT requests.id, requests.operator_slug, requests.purpose, requests.status,
             requests.created_at, requests.updated_at, users.name AS buyer_name,
             users.email AS buyer_email, providers.name AS provider_name
      FROM access_requests requests
      JOIN providers ON providers.slug = requests.operator_slug
      JOIN users ON users.id = requests.user_id
      WHERE providers.owner_id = $1
      ORDER BY requests.created_at DESC
    `, [user.id]),
  ]);
  return Response.json({ providers: providers.rows, applications: applications.rows, conversations: conversations.rows, accessRequests: accessRequests.rows }, { headers: { "Cache-Control": "private, no-store" } });
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
  const slug = isSlug(body.slug) ? body.slug : "";
  const description = cleanMultiline(body.description, 3_000);
  const capacity = cleanSingleLine(body.capacity, 120);
  const modalities = Array.isArray(body.modalities) ? body.modalities.filter((item: unknown) => ["Egocentric video", "Exocentric video", "Speech", "Images"].includes(String(item))) : [];
  const rawPhotos = Array.isArray(body.photos) ? body.photos.slice(0, 8) : [];
  const photos = rawPhotos.map(safeHttpsUrl).filter((item): item is string => !!item);
  if (photos.length !== rawPhotos.length) return Response.json({ error: "Photos must use public HTTPS URLs." }, { status: 400 });
  const environments = Array.isArray(body.environments) ? body.environments.filter((item): item is string => typeof item === "string" && item.length <= 100).map((item) => cleanSingleLine(item, 100)).filter(Boolean).slice(0, 20) : [];
  if (!slug || typeof body.description !== "string" || body.description.length > 3_000 || description.length < 20 || typeof body.capacity !== "string" || body.capacity.length > 120 || !capacity) return Response.json({ error: "Provide a description of 20–3,000 characters and a valid capacity." }, { status: 400 });
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const application = await client.query<{ id: string }>(`
      SELECT applications.id
      FROM supplier_applications applications
      JOIN providers ON providers.slug = applications.provider_slug
      WHERE applications.provider_slug = $1 AND applications.application_kind = 'facility'
        AND (providers.owner_id = $2 OR $3::boolean)
      FOR UPDATE
    `, [slug, user.id, user.role === "admin"]);
    if (!application.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "The facility review record could not be found." }, { status: 404 });
    }
    await client.query(`
      UPDATE supplier_applications
      SET profile_description = $1, capacity = $2, capture_environments = $3::jsonb,
          hardware_pictures = CASE WHEN jsonb_array_length($4::jsonb) > 0 THEN $4::jsonb ELSE hardware_pictures END,
          modalities = CASE WHEN jsonb_array_length($5::jsonb) > 0 THEN $5::jsonb ELSE modalities END,
          status = 'pending', verification_level = 'unverified', admin_notes = NULL,
          reviewed_at = NULL, submitted_at = NOW()
      WHERE id = $6
    `, [description, capacity, JSON.stringify(environments), JSON.stringify(photos), JSON.stringify(modalities), application.rows[0].id]);
    await client.query("UPDATE providers SET status = 'pending', verification_level = 'unverified', updated_at = NOW() WHERE slug = $1", [slug]);
    await client.query("COMMIT");
    return Response.json({ ok: true, status: "pending" });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
