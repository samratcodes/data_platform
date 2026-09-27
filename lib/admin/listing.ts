import "server-only";

import type { PoolClient } from "pg";
import { database } from "@/lib/db/client";
import { resolveGoogleMapsPlace } from "@/lib/integrations/google-maps";
import { enqueueUserSheetSync } from "@/lib/integrations/sheet-sync-queue";
import { facilityCapacity, factoryCategoryLabel, parseFacilityDetails, publicFacilityDetails } from "@/lib/facility";
import type { StoredAsset } from "@/types/admin";

export type ListingApplication = {
  id: string; user_id: string; application_kind: "company" | "facility"; business_name: string; maps_url: string | null; city: string | null; country: string | null;
  longitude: number | null; latitude: number | null; provider_type: string; modalities: string[];
  hardware_pictures: string[]; linkedin_url: string | null; twitter_url: string | null;
  huggingface_url: string | null; website_url: string | null; profile_description: string;
  capacity: string; capture_environments: string[]; provider_slug: string | null;
  office_images: StoredAsset[]; company_logo: StoredAsset | null; cover_image: string | null; facility_details: unknown;
  status: string; verification_level: string;
};

const publicAssetUrl = (key: string) => `/api/company-assets?public=1&key=${encodeURIComponent(key)}`;
export const listingSlug = (application: Pick<ListingApplication, "id" | "business_name" | "provider_slug">) => {
  const base = application.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "provider";
  return application.provider_slug || `${base}-${application.id.slice(0, 6)}`;
};

/**
 * Publishes (or refreshes) the public map listing built from an application.
 * Returns an error message when the application cannot be published; the caller rolls back.
 */
export async function publishListing(client: PoolClient, application: ListingApplication, level: string): Promise<string | null> {
  const slug = listingSlug(application);
  const isFacility = application.application_kind === "facility";
  if (!application.maps_url || application.city === null || application.country === null || application.longitude === null || application.latitude === null) {
    return "This submission is missing its required Google Maps location.";
  }
  const companyApproved = await client.query("SELECT 1 FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company' AND status = 'approved' LIMIT 1", [application.user_id]);
  if (isFacility && !companyApproved.rowCount) return "Approve the data company before approving one of its facilities.";
  if (!isFacility && !application.company_logo?.key) return "This company has not uploaded its required logo. Ask the supplier to add one before approving.";
  const uploadedPhotos = application.office_images.map((asset) => publicAssetUrl(asset.key));
  if (isFacility && !uploadedPhotos.length && !application.hardware_pictures.length) return "This facility submission is missing its required photo evidence.";
  // Companies show uploaded office images when present; facilities show uploads alongside linked photos.
  let mapPhotos = isFacility
    ? [...uploadedPhotos, ...application.hardware_pictures]
    : uploadedPhotos.length ? uploadedPhotos : application.hardware_pictures;
  if (!isFacility && !mapPhotos.length) {
    mapPhotos = (await resolveGoogleMapsPlace(application.maps_url)).photos;
    if (!mapPhotos.length) return "Google Maps did not expose a public location image for this company. Ask the supplier to upload office images or use a Google Maps place link with a public photo.";
    await client.query("UPDATE supplier_applications SET hardware_pictures = $1::jsonb WHERE id = $2", [JSON.stringify(mapPhotos), application.id]);
  }
  // The chosen background leads the gallery, so it becomes the profile hero and map card image.
  const cover = application.cover_image && application.office_images.some((asset) => asset.key === application.cover_image)
    ? publicAssetUrl(application.cover_image)
    : application.cover_image && application.hardware_pictures.includes(application.cover_image) ? application.cover_image : null;
  if (cover) mapPhotos = [cover, ...mapPhotos.filter((photo) => photo !== cover)];
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
  return null;
}

/**
 * Refreshes the live listing after an administrator edits an approved application, so the
 * change shows on the map right away. Unapproved applications only need their sheet row synced.
 * Returns an error message when the edited application can no longer be published.
 */
export async function refreshListingAfterAdminEdit(applicationId: string): Promise<string | null> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const application = (await client.query<ListingApplication>("SELECT * FROM supplier_applications WHERE id = $1 FOR UPDATE", [applicationId])).rows[0];
    if (!application) { await client.query("ROLLBACK"); return null; }
    if (application.status === "approved") {
      const problem = await publishListing(client, application, application.verification_level);
      if (problem) { await client.query("ROLLBACK"); return problem; }
    }
    await enqueueUserSheetSync(application.user_id, client);
    await client.query("COMMIT");
    return null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
