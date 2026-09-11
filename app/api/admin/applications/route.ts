import { randomUUID } from "node:crypto";
import { getUser, rateLimited } from "@/lib/auth";
import { database, query } from "@/lib/database";
import { enqueueUserSheetSync } from "@/lib/integrations";
import { resolveGoogleMapsPlace } from "@/lib/google-maps-place";
import { cleanMultiline, cleanSingleLine, isUuid, readJsonObject } from "@/lib/security";

const levels = new Set(["unverified", "online", "physical"]);
const statuses = new Set(["pending", "approved", "rejected"]);
const admin = async () => (await getUser())?.role === "admin";

export async function GET(request: Request) {
  if (!await admin()) return Response.json({ error: "Admin access required." }, { status: 403 });
  const sampleId = new URL(request.url).searchParams.get("sample");
  if (sampleId) {
    if (!isUuid(sampleId)) return Response.json({ error: "Sample not found." }, { status: 404 });
    const sample = (await query<{ sample_file_name: string; sample_mime_type: string; sample_data: Buffer }>(`
      SELECT sample_file_name, sample_mime_type, sample_data
      FROM supplier_applications
      WHERE id = $1 AND application_kind = 'company' AND sample_data IS NOT NULL
    `, [sampleId])).rows[0];
    if (!sample) return Response.json({ error: "Sample not found." }, { status: 404 });
    const safeName = sample.sample_file_name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 160) || "supplier-sample";
    return new Response(new Uint8Array(sample.sample_data), { headers: { "Content-Type": sample.sample_mime_type || "application/octet-stream", "Content-Disposition": `attachment; filename="${safeName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }
  const [result, audit, sync] = await Promise.all([
    query(`
      SELECT (to_jsonb(applications) - 'sample_data') || jsonb_build_object('has_sample', applications.sample_data IS NOT NULL) AS application,
             users.name AS applicant_name, users.email AS applicant_email,
             EXISTS (
               SELECT 1 FROM supplier_applications company
               WHERE company.user_id = applications.user_id
                 AND company.application_kind = 'company' AND company.status = 'approved'
             ) AS company_approved
      FROM supplier_applications applications
      JOIN users ON users.id = applications.user_id
      ORDER BY applications.submitted_at DESC
    `),
    query(`
      SELECT logs.id, logs.action, logs.target_type, logs.target_id, logs.metadata,
             logs.created_at, users.name AS admin_name
      FROM admin_audit_logs logs JOIN users ON users.id = logs.admin_user_id
      ORDER BY logs.created_at DESC LIMIT 50
    `),
    query(`
      SELECT status, COUNT(*)::int AS count
      FROM integration_outbox
      WHERE event_type = 'user.sheet.upsert'
      GROUP BY status
    `),
  ]);
  return Response.json({
    applications: result.rows.map((row) => ({ ...row.application, applicant_name: row.applicant_name, applicant_email: row.applicant_email, company_approved: row.company_approved })),
    audit: audit.rows,
    sheetSync: {
      configured: Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
      counts: Object.fromEntries(sync.rows.map((row) => [row.status, row.count])),
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (user?.role !== "admin") return Response.json({ error: "Admin access required." }, { status: 403 });
  const parsed = await readJsonObject(request, 8_192);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (await rateLimited(`admin-review:${user.id}`, 120, 15 * 60_000)) return Response.json({ error: "Review update limit reached. Try again shortly." }, { status: 429 });
  const id = isUuid(body.id) ? body.id : "";
  const status = cleanSingleLine(body.status, 20);
  const level = cleanSingleLine(body.verificationLevel, 20);
  const notes = cleanMultiline(body.notes, 4_000);
  if (!id || !statuses.has(status) || !levels.has(level) || String(body.notes || "").length > 4_000) return Response.json({ error: "Invalid review decision." }, { status: 400 });
  if (status === "approved" && level === "unverified") return Response.json({ error: "Approval requires online or physical verification." }, { status: 400 });

  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const application = (await client.query<{
      id: string; user_id: string; application_kind: "company" | "facility"; business_name: string; maps_url: string | null; city: string | null; country: string | null;
      longitude: number | null; latitude: number | null; provider_type: string; modalities: string[];
      hardware_pictures: string[]; linkedin_url: string | null; twitter_url: string | null;
      huggingface_url: string | null; website_url: string | null; profile_description: string;
      capacity: string; capture_environments: string[]; provider_slug: string | null;
      has_sample: boolean;
    }>("SELECT supplier_applications.*, (sample_data IS NOT NULL) AS has_sample FROM supplier_applications WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!application) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Application not found." }, { status: 404 });
    }
    await client.query("UPDATE supplier_applications SET status = $1, verification_level = $2, admin_notes = $3, reviewed_at = NOW() WHERE id = $4", [status, level, notes, id]);
    const base = application.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "provider";
    const slug = application.provider_slug || `${base}-${application.id.slice(0, 6)}`;
    if (status === "approved") {
      if (!application.maps_url || application.city === null || application.country === null || application.longitude === null || application.latitude === null) {
        await client.query("ROLLBACK");
        return Response.json({ error: "This submission is missing its required Google Maps location." }, { status: 422 });
      }
      const companyApproved = await client.query("SELECT 1 FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company' AND status = 'approved' LIMIT 1", [application.user_id]);
      if (application.application_kind === "facility" && !companyApproved.rowCount) {
        await client.query("ROLLBACK");
        return Response.json({ error: "Approve the data company before approving one of its facilities." }, { status: 422 });
      }
      if (application.application_kind === "facility" && !application.hardware_pictures.length) {
        await client.query("ROLLBACK");
        return Response.json({ error: "This facility submission is missing its required photo evidence." }, { status: 422 });
      }
      const isFacility = application.application_kind === "facility";
      let mapPhotos = application.hardware_pictures;
      if (!isFacility && !mapPhotos.length) {
        mapPhotos = (await resolveGoogleMapsPlace(application.maps_url)).photos;
        if (!mapPhotos.length) {
          await client.query("ROLLBACK");
          return Response.json({ error: "Google Maps did not expose a public location image for this company. Ask the supplier to use a Google Maps place link with a public photo." }, { status: 422 });
        }
        await client.query("UPDATE supplier_applications SET hardware_pictures = $1::jsonb WHERE id = $2", [JSON.stringify(mapPhotos), application.id]);
      }
      const media = { src: mapPhotos[0], alt: `${application.business_name} ${isFacility ? "facility" : "company"}`, kind: "image", label: isFacility ? "Supplier facility" : "Google Maps company image" };
      const profile = {
        description: application.profile_description,
        dataStreams: application.modalities,
        established: "",
        capacity: application.capacity || "Contact provider",
        captureEnvironments: application.capture_environments,
        photos: mapPhotos,
        links: { linkedin: application.linkedin_url, twitter: application.twitter_url, huggingFace: application.huggingface_url, website: application.website_url, maps: application.maps_url },
      };
      await client.query(`
      INSERT INTO providers (owner_id, slug, name, city, country, longitude, latitude, provider_type, modalities, media, profile, verification_level, status, is_demo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,'approved',FALSE)
      ON CONFLICT(slug) DO UPDATE SET owner_id = EXCLUDED.owner_id, name = EXCLUDED.name,
        city = EXCLUDED.city, country = EXCLUDED.country, longitude = EXCLUDED.longitude,
        latitude = EXCLUDED.latitude, provider_type = EXCLUDED.provider_type,
        modalities = EXCLUDED.modalities, media = EXCLUDED.media, profile = EXCLUDED.profile,
        verification_level = EXCLUDED.verification_level, status = 'approved', is_demo = FALSE, updated_at = NOW()
    `, [application.user_id, slug, application.business_name, application.city, application.country, application.longitude, application.latitude, application.provider_type, JSON.stringify(application.modalities), JSON.stringify(media), JSON.stringify(profile), level]);
      await client.query("UPDATE supplier_applications SET provider_slug = $1 WHERE id = $2", [slug, application.id]);
    }
    if (status !== "approved") await client.query("UPDATE providers SET status = $1, verification_level = $2, updated_at = NOW() WHERE slug = $3", [status, level, slug]);
    await enqueueUserSheetSync(application.user_id, client);
    await client.query(`
      INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, metadata)
      VALUES ($1, $2, $3, 'supplier_application', $4, $5::jsonb)
    `, [randomUUID(), user.id, `application.${status}`, id, JSON.stringify({ applicationKind: application.application_kind, verificationLevel: level, notes })]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return Response.json({ ok: true });
}
