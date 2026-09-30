import { randomUUID } from "node:crypto";
import { rateLimited } from "@/lib/auth/rate-limit";
import { database } from "@/lib/db/client";
import { enqueueUserSheetSync } from "@/lib/integrations/sheet-sync-queue";
import { isGoogleMapsUrl } from "@/lib/integrations/google-maps";
import { adminRequired, adminUser } from "@/lib/admin/queries";
import { publishListing, type ListingApplication } from "@/lib/admin/listing";
import { cleanMultiline, cleanSingleLine, isUuid, readJsonObject, safeHttpsUrl } from "@/lib/security";
import { facilityCapacity, parseFacilityDetails } from "@/lib/facility";
import { isCompanyFocus } from "@/lib/company-focus";

const modalities = new Set(["Egocentric video", "Exocentric video", "Speech", "Images"]);
const notFound = () => Response.json({ error: "Application not found." }, { status: 404 });
const strings = (value: unknown, allowed: ReadonlySet<string>) => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string" && allowed.has(item)))]
  : [];
const optionalUrl = (value: unknown) => typeof value === "string" && value.trim() ? safeHttpsUrl(value) : null;

/**
 * Lets an administrator correct a company or facility directly. The review status is kept,
 * and an approved listing is republished right away so the correction is live on the map.
 */
export async function PATCH(request: Request, context: RouteContext<"/api/admin/applications/[id]/profile">) {
  const user = await adminUser();
  if (!user) return adminRequired();
  const { id } = await context.params;
  if (!isUuid(id)) return notFound();
  const parsed = await readJsonObject(request, 32_768);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (await rateLimited(`admin-edit:${user.id}`, 120, 15 * 60_000)) return Response.json({ error: "Edit limit reached. Try again shortly." }, { status: 429 });

  const businessName = cleanSingleLine(body.businessName, 120);
  const description = cleanMultiline(body.description, 3_000);
  const selectedModalities = strings(body.modalities, modalities);
  if (businessName.length < 2 || description.length < 20 || !selectedModalities.length) {
    return Response.json({ error: "Provide a name, a description of at least 20 characters, and at least one data capability." }, { status: 400 });
  }
  const address = cleanSingleLine(body.physicalAddress, 240);
  const city = cleanSingleLine(body.city, 100);
  const country = cleanSingleLine(body.country, 100);
  const longitude = Number(body.longitude);
  const latitude = Number(body.latitude);
  const mapsUrl = safeHttpsUrl(body.mapsUrl);
  if (!mapsUrl || !isGoogleMapsUrl(mapsUrl) || address.length < 5 || city.length < 2 || country.length < 2 || !Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    return Response.json({ error: "Complete the location: a Google Maps link, coordinates, address, city, and country." }, { status: 400 });
  }
  const links = { website: optionalUrl(body.websiteUrl), linkedin: optionalUrl(body.linkedinUrl), twitter: optionalUrl(body.twitterUrl), huggingFace: optionalUrl(body.huggingFaceUrl) };
  if (Object.entries(links).some(([field, url]) => url === null && typeof body[`${field}Url`] === "string" && String(body[`${field}Url`]).trim())) {
    return Response.json({ error: "Links must be public HTTPS URLs." }, { status: 400 });
  }

  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const application = (await client.query<ListingApplication>("SELECT * FROM supplier_applications WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!application) {
      await client.query("ROLLBACK");
      return notFound();
    }
    const isFacility = application.application_kind === "facility";
    if (!isFacility && !links.website) {
      await client.query("ROLLBACK");
      return Response.json({ error: "A data company needs a public HTTPS website." }, { status: 400 });
    }
    const facility = isFacility ? parseFacilityDetails(body.facility) : null;
    if (isFacility && !facility) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Choose the facility category and enter a valid workforce: total workers, seated hand-task workers, and movement-task workers." }, { status: 400 });
    }
    const focus = isCompanyFocus(body.focus) ? body.focus : null;
    // Older facilities may carry free-text areas, so any short label is kept.
    const environments = Array.isArray(body.captureEnvironments) ? [...new Set(body.captureEnvironments.map((item) => cleanSingleLine(item, 120)).filter(Boolean))].slice(0, 20) : [];

    const updated = (await client.query<ListingApplication>(`
      UPDATE supplier_applications
      SET business_name = $1, profile_description = $2, modalities = $3::jsonb,
          maps_url = $4, physical_address = $5, city = $6, country = $7, longitude = $8, latitude = $9,
          website_url = $10, linkedin_url = $11, twitter_url = $12, huggingface_url = $13,
          company_focus = CASE WHEN application_kind = 'company' THEN COALESCE($14, company_focus) ELSE company_focus END,
          facility_details = CASE WHEN application_kind = 'facility' THEN $15::jsonb ELSE facility_details END,
          capacity = CASE WHEN application_kind = 'facility' THEN $16 ELSE capacity END,
          capture_environments = CASE WHEN application_kind = 'facility' THEN $17::jsonb ELSE capture_environments END
      WHERE id = $18
      RETURNING *
    `, [businessName, description, JSON.stringify(selectedModalities), mapsUrl, address, city, country, longitude, latitude,
      links.website, links.linkedin, links.twitter, links.huggingFace, focus,
      facility ? JSON.stringify(facility) : null, facility ? facilityCapacity(facility) : null, JSON.stringify(environments), id])).rows[0];

    if (updated.status === "approved") {
      const problem = await publishListing(client, updated, updated.verification_level);
      if (problem) {
        await client.query("ROLLBACK");
        return Response.json({ error: problem }, { status: 422 });
      }
    }
    await enqueueUserSheetSync(application.user_id, client);
    await client.query(`
      INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, metadata)
      VALUES ($1, $2, 'application.edited', 'supplier_application', $3, $4::jsonb)
    `, [randomUUID(), user.id, id, JSON.stringify({ applicationKind: application.application_kind, status: application.status })]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return Response.json({ ok: true });
}
