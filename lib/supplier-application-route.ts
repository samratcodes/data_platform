import { randomUUID } from "node:crypto";
import { emailVerificationRequired, getUser, isEmailVerified, rateLimited } from "./auth";
import { database, query } from "./database";
import { enqueueUserSheetSync } from "./integrations";
import { isGoogleMapsUrl } from "./google-maps-place";
import { cleanMultiline, cleanSingleLine, readJsonObject, safeHttpsUrl } from "./security";

const modalities = new Set(["Egocentric video", "Exocentric video", "Speech", "Images"]);
const sampleTypes = new Set(["application/json", "text/csv", "text/plain", "application/zip", "application/x-zip-compressed", "application/pdf", "image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/wav", "video/mp4", "application/octet-stream"]);
const strings = (value: unknown, limit = 12) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string" && item.length <= 120).map((item) => cleanSingleLine(item, 120)).filter(Boolean).slice(0, limit)
  : [];

type ExistingCompany = { id: string; has_sample: boolean };

export async function supplierApplicationGET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  if (user.role !== "supplier" && user.role !== "admin") return Response.json({ error: "Supplier access required." }, { status: 403 });
  const result = await query(`
    SELECT id, application_kind, business_name, maps_url, physical_address, city, country,
           longitude, latitude, hardware_pictures, linkedin_url, twitter_url, huggingface_url,
           website_url, provider_type, modalities, robotics_types, profile_description, capacity,
           capture_environments, provider_slug, sample_file_name, sample_mime_type,
           sample_size_bytes, (sample_data IS NOT NULL) AS has_sample, status,
           verification_level, admin_notes, submitted_at, reviewed_at
    FROM supplier_applications
    WHERE user_id = $1
    ORDER BY submitted_at DESC
  `, [user.id]);
  return Response.json({ applications: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function supplierApplicationPOST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  if (user.role !== "supplier") return Response.json({ error: "Supplier access required." }, { status: 403 });
  if (!isEmailVerified(user)) return emailVerificationRequired();
  const parsed = await readJsonObject(request, 2_500_000);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  const kind = body.kind === "facility" ? "facility" : "company";
  if (await rateLimited(`supplier-application:${kind}:${user.id}`, 20, 24 * 60 * 60_000)) return Response.json({ error: "Submission limit reached. Try again tomorrow." }, { status: 429 });

  const businessName = cleanSingleLine(body.businessName, 120);
  const description = cleanMultiline(body.description, 3_000);
  const selectedModalities = strings(body.modalities).filter((item) => modalities.has(item));
  if (String(body.businessName || "").length > 120 || businessName.length < 2 || typeof body.description !== "string" || body.description.length > 3_000 || description.length < 20 || selectedModalities.length === 0) {
    return Response.json({ error: "Provide a name, a description of at least 20 characters, and at least one data capability." }, { status: 400 });
  }

  const client = await database().connect();
  try {
    await client.query("BEGIN");

    if (kind === "company") {
      const existing = (await client.query<ExistingCompany>(`
        SELECT id, (sample_data IS NOT NULL) AS has_sample
        FROM supplier_applications
        WHERE user_id = $1 AND application_kind = 'company'
        ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE
      `, [user.id])).rows[0];
      const sample = body.sample && typeof body.sample === "object" && !Array.isArray(body.sample) ? body.sample as Record<string, unknown> : null;
      const sampleName = cleanSingleLine(sample?.name, 160);
      const sampleType = cleanSingleLine(sample?.type, 100).toLowerCase() || "application/octet-stream";
      const sampleBase64 = typeof sample?.data === "string" ? sample.data : "";
      const sampleBuffer = sampleBase64 ? Buffer.from(sampleBase64, "base64") : null;
      const validSample = Boolean(sampleBuffer && sampleBuffer.length > 0 && sampleBuffer.length <= 1_500_000 && sampleName && sampleTypes.has(sampleType));
      const website = safeHttpsUrl(body.websiteUrl);
      if (!website) {
        await client.query("ROLLBACK");
        return Response.json({ error: "Add your company website using a public HTTPS URL." }, { status: 400 });
      }
      const address = cleanSingleLine(body.physicalAddress, 240);
      const city = cleanSingleLine(body.city, 100);
      const country = cleanSingleLine(body.country, 100);
      const longitude = Number(body.longitude);
      const latitude = Number(body.latitude);
      const mapsUrl = safeHttpsUrl(body.mapsUrl);
      const companyPictures = Array.isArray(body.hardwarePictures) ? body.hardwarePictures.slice(0, 8).map(safeHttpsUrl).filter((item): item is string => !!item) : [];
      if (!mapsUrl || !isGoogleMapsUrl(mapsUrl) || address.length < 5 || city.length < 2 || country.length < 2 || !Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        await client.query("ROLLBACK");
        return Response.json({ error: "Add a Google Maps location for your data company, then confirm its address, city, and country." }, { status: 400 });
      }

      const id = existing?.id || randomUUID();
      if (existing) {
        await client.query(`
          UPDATE supplier_applications
          SET business_name = $1, profile_description = $2, website_url = $3,
              linkedin_url = $4, twitter_url = $5, huggingface_url = $6,
              maps_url = $7, physical_address = $8, city = $9, country = $10,
              longitude = $11, latitude = $12, modalities = $13::jsonb, hardware_pictures = $14::jsonb, provider_type = 'Data Company', status = 'pending',
              verification_level = 'unverified', admin_notes = NULL, reviewed_at = NULL,
              submitted_at = NOW(),
              sample_file_name = CASE WHEN $15::boolean THEN $16 ELSE sample_file_name END,
              sample_mime_type = CASE WHEN $15::boolean THEN $17 ELSE sample_mime_type END,
              sample_size_bytes = CASE WHEN $15::boolean THEN $18 ELSE sample_size_bytes END,
              sample_data = CASE WHEN $15::boolean THEN $19 ELSE sample_data END
          WHERE id = $20 AND user_id = $21
        `, [businessName, description, website, safeHttpsUrl(body.linkedinUrl), safeHttpsUrl(body.twitterUrl), safeHttpsUrl(body.huggingFaceUrl), mapsUrl, address, city, country, longitude, latitude, JSON.stringify(selectedModalities), JSON.stringify(companyPictures), validSample, sampleName || null, validSample ? sampleType : null, validSample ? sampleBuffer?.length : null, validSample ? sampleBuffer : null, id, user.id]);
      } else {
        await client.query(`
          INSERT INTO supplier_applications (
            id, user_id, application_kind, business_name, maps_url, physical_address, city, country,
            longitude, latitude, hardware_pictures, provider_type, modalities, profile_description, website_url,
            linkedin_url, twitter_url, huggingface_url, sample_file_name, sample_mime_type,
            sample_size_bytes, sample_data
          ) VALUES ($1,$2,'company',$3,$4,$5,$6,$7,$8,$9,$10::jsonb,'Data Company',$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        `, [id, user.id, businessName, mapsUrl, address, city, country, longitude, latitude, JSON.stringify(companyPictures), JSON.stringify(selectedModalities), description, website, safeHttpsUrl(body.linkedinUrl), safeHttpsUrl(body.twitterUrl), safeHttpsUrl(body.huggingFaceUrl), validSample ? sampleName : null, validSample ? sampleType : null, validSample ? sampleBuffer?.length : null, validSample ? sampleBuffer : null]);
      }
      await enqueueUserSheetSync(user.id, client);
      await client.query("COMMIT");
      return Response.json({ id, kind, status: "pending" }, { status: existing ? 200 : 201 });
    }

    const companyApproved = await client.query("SELECT 1 FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company' AND status = 'approved' LIMIT 1", [user.id]);
    if (!companyApproved.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Your data company must be approved before you can add a facility." }, { status: 403 });
    }
    const address = cleanSingleLine(body.physicalAddress, 240);
    const city = cleanSingleLine(body.city, 100);
    const country = cleanSingleLine(body.country, 100);
    const capacity = cleanSingleLine(body.capacity, 120);
    const longitude = Number(body.longitude);
    const latitude = Number(body.latitude);
    const mapsUrl = safeHttpsUrl(body.mapsUrl);
    const pictures = Array.isArray(body.hardwarePictures) ? body.hardwarePictures.slice(0, 8).map(safeHttpsUrl).filter((item): item is string => !!item) : [];
    const environments = strings(body.captureEnvironments, 20);
    if (address.length < 5 || city.length < 2 || country.length < 2 || !capacity || !mapsUrl || !isGoogleMapsUrl(mapsUrl) || !Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90 || pictures.length === 0) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Complete the facility location, capacity, and public facility-picture fields." }, { status: 400 });
    }

    const id = randomUUID();
    const base = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "facility";
    const providerSlug = `${base}-${id.slice(0, 6)}`;
    await client.query(`
      INSERT INTO supplier_applications (
        id, user_id, application_kind, business_name, maps_url, physical_address, city, country,
        longitude, latitude, hardware_pictures, provider_type, modalities, profile_description,
        capacity, capture_environments, provider_slug
      ) VALUES ($1,$2,'facility',$3,$4,$5,$6,$7,$8,$9,$10::jsonb,'Facility',$11::jsonb,$12,$13,$14::jsonb,$15)
    `, [id, user.id, businessName, mapsUrl, address, city, country, longitude, latitude, JSON.stringify(pictures), JSON.stringify(selectedModalities), description, capacity, JSON.stringify(environments), providerSlug]);
    await enqueueUserSheetSync(user.id, client);
    await client.query("COMMIT");
    return Response.json({ id, kind, status: "pending" }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
