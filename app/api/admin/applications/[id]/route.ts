import { randomUUID } from "node:crypto";
import { rateLimited } from "@/lib/auth/rate-limit";
import { database, query } from "@/lib/db/client";
import { enqueueUserSheetSync } from "@/lib/integrations/sheet-sync-queue";
import { resolveGoogleMapsPlace } from "@/lib/integrations/google-maps";
import { adminRequired, adminUser, listAuditEntries, privateJson } from "@/lib/admin/queries";
import { cleanMultiline, cleanSingleLine, isUuid, readJsonObject } from "@/lib/security";
import type { ApplicationDetail, StoredAsset } from "@/types/admin";
import { facilityCapacity, factoryCategoryLabel, parseFacilityDetails, publicFacilityDetails } from "@/lib/facility";

const levels = new Set(["unverified", "online", "physical"]);
const statuses = new Set(["pending", "approved", "rejected"]);
const publicAssetUrl = (key: string) => `/api/company-assets?public=1&key=${encodeURIComponent(key)}`;
const notFound = () => Response.json({ error: "Application not found." }, { status: 404 });

export async function GET(_request: Request, context: RouteContext<"/api/admin/applications/[id]">) {
  if (!await adminUser()) return adminRequired();
  const { id } = await context.params;
  if (!isUuid(id)) return notFound();
  const row = (await query<{ application: Omit<ApplicationDetail, "company" | "facilities">; company: ApplicationDetail["company"]; facilities: ApplicationDetail["facilities"] }>(`
    SELECT (to_jsonb(applications) - 'sample_data')
             || jsonb_build_object(
               'has_sample', applications.sample_data IS NOT NULL,
               'applicant_name', users.name,
               'applicant_email', users.email,
               'applicant_email_verified_at', users.email_verified_at,
               'applicant_joined_at', users.created_at
             ) AS application,
           (SELECT jsonb_build_object('id', company.id, 'business_name', company.business_name, 'status', company.status)
              FROM supplier_applications company
              WHERE company.user_id = applications.user_id AND company.application_kind = 'company' AND company.id <> applications.id
              ORDER BY company.submitted_at DESC LIMIT 1) AS company,
           COALESCE((SELECT jsonb_agg(jsonb_build_object('id', facility.id, 'business_name', facility.business_name, 'city', facility.city, 'country', facility.country, 'status', facility.status) ORDER BY facility.submitted_at DESC)
              FROM supplier_applications facility
              WHERE facility.user_id = applications.user_id AND facility.application_kind = 'facility' AND facility.id <> applications.id), '[]'::jsonb) AS facilities
    FROM supplier_applications applications
    JOIN users ON users.id = applications.user_id
    WHERE applications.id = $1 AND users.email_verified_at IS NOT NULL
  `, [id])).rows[0];
  if (!row) return notFound();
  const history = await listAuditEntries({ targetId: id, limit: 100 });
  return privateJson({ application: { ...row.application, company: row.company, facilities: row.facilities }, history });
}

export async function PATCH(request: Request, context: RouteContext<"/api/admin/applications/[id]">) {
  const user = await adminUser();
  if (!user) return adminRequired();
  const { id } = await context.params;
  if (!isUuid(id)) return notFound();
  const parsed = await readJsonObject(request, 8_192);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (await rateLimited(`admin-review:${user.id}`, 120, 15 * 60_000)) return Response.json({ error: "Review update limit reached. Try again shortly." }, { status: 429 });
  const status = cleanSingleLine(body.status, 20);
  const level = cleanSingleLine(body.verificationLevel, 20);
  const notes = cleanMultiline(body.notes, 4_000);
  if (!statuses.has(status) || !levels.has(level) || String(body.notes || "").length > 4_000) return Response.json({ error: "Invalid review decision." }, { status: 400 });
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
      office_images: StoredAsset[]; company_logo: StoredAsset | null; facility_details: unknown;
    }>("SELECT * FROM supplier_applications WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!application) {
      await client.query("ROLLBACK");
      return notFound();
    }
    const verifiedEmail = await client.query("SELECT 1 FROM users WHERE id = $1 AND email_verified_at IS NOT NULL", [application.user_id]);
    if (!verifiedEmail.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "This supplier must verify their email before their application can be reviewed." }, { status: 422 });
    }
    await client.query("UPDATE supplier_applications SET status = $1, verification_level = $2, admin_notes = $3, reviewed_at = NOW() WHERE id = $4", [status, level, notes, id]);
    const base = application.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "provider";
    const slug = application.provider_slug || `${base}-${application.id.slice(0, 6)}`;
    const isFacility = application.application_kind === "facility";
    if (status === "approved") {
      if (!application.maps_url || application.city === null || application.country === null || application.longitude === null || application.latitude === null) {
        await client.query("ROLLBACK");
        return Response.json({ error: "This submission is missing its required Google Maps location." }, { status: 422 });
      }
      const companyApproved = await client.query("SELECT 1 FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company' AND status = 'approved' LIMIT 1", [application.user_id]);
      if (isFacility && !companyApproved.rowCount) {
        await client.query("ROLLBACK");
        return Response.json({ error: "Approve the data company before approving one of its facilities." }, { status: 422 });
      }
      if (!isFacility && !application.company_logo?.key) {
        await client.query("ROLLBACK");
        return Response.json({ error: "This company has not uploaded its required logo. Ask the supplier to add one before approving." }, { status: 422 });
      }
      const uploadedPhotos = application.office_images.map((asset) => publicAssetUrl(asset.key));
      if (isFacility && !uploadedPhotos.length && !application.hardware_pictures.length) {
        await client.query("ROLLBACK");
        return Response.json({ error: "This facility submission is missing its required photo evidence." }, { status: 422 });
      }
      // Companies show uploaded office images when present; facilities show uploads alongside linked photos.
      let mapPhotos = isFacility
        ? [...uploadedPhotos, ...application.hardware_pictures]
        : uploadedPhotos.length ? uploadedPhotos : application.hardware_pictures;
      if (!isFacility && !mapPhotos.length) {
        mapPhotos = (await resolveGoogleMapsPlace(application.maps_url)).photos;
        if (!mapPhotos.length) {
          await client.query("ROLLBACK");
          return Response.json({ error: "Google Maps did not expose a public location image for this company. Ask the supplier to upload office images or use a Google Maps place link with a public photo." }, { status: 422 });
        }
        await client.query("UPDATE supplier_applications SET hardware_pictures = $1::jsonb WHERE id = $2", [JSON.stringify(mapPhotos), application.id]);
      }
      // Facilities show their own optional logo, falling back to their company's logo.
      const logo = application.company_logo ?? (isFacility
        ? (await client.query<{ company_logo: StoredAsset | null }>("SELECT company_logo FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company' ORDER BY submitted_at DESC LIMIT 1", [application.user_id])).rows[0]?.company_logo
        : null);
      const factory = isFacility ? parseFacilityDetails(application.facility_details) : null;
      const media = { src: mapPhotos[0], alt: `${application.business_name} ${isFacility ? "facility" : "company"}`, kind: "image", label: factory ? `${factoryCategoryLabel(factory)} facility` : isFacility ? "Supplier facility" : "Company image" };
      const profile = {
        description: application.profile_description,
        dataStreams: application.modalities,
        established: "",
        capacity: factory ? facilityCapacity(factory) : application.capacity || "Contact provider",
        ...(factory ? { facility: publicFacilityDetails(factory) } : {}),
        captureEnvironments: application.capture_environments,
        photos: mapPhotos,
        logo: logo ? publicAssetUrl(logo.key) : null,
        // A facility's own profile photo fills its badge; the company logo fallback keeps its logo fit.
        logoIsPhoto: Boolean(isFacility && application.company_logo?.key),
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
