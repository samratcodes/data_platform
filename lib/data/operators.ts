import "server-only";

import { cache } from "react";
import type { PublicOperator } from "@/types/app";
import type { NodeData } from "@/types/provider";
import { query } from "@/lib/db/client";

type StoredProfile = NodeData["profile"] & {
  area?: string;
  company?: NodeData["company"];
};

type ProviderRow = {
  verification_level: "online" | "physical" | "incomplete";
  id: number;
  slug: string;
  name: string;
  city: string;
  country: string;
  longitude: number;
  latitude: number;
  provider_type: NodeData["type"];
  modalities: NodeData["modalities"];
  media: NodeData["media"];
  profile: StoredProfile;
  company_name: string | null;
  company_slug: string | null;
  product_count: number;
};

/** Facilities approved before `logoIsPhoto` existed: their own profile photo is stored under `facility-logo/`. */
const isFacilityPhoto = (row: ProviderRow) => row.provider_type === "Facility" && Boolean(row.profile.logo && decodeURIComponent(row.profile.logo).includes("/facility-logo/"));

function fromRow(row: ProviderRow): NodeData {
  const coordinates: [number, number] = row.profile.publicExactLocation
    ? [row.longitude, row.latitude]
    : [Math.round(row.longitude * 10) / 10, Math.round(row.latitude * 10) / 10];
  return {
    id: 100_000 + row.id,
    verificationLevel: row.verification_level,
    slug: row.slug,
    name: row.name,
    city: row.city,
    country: row.country,
    area: row.profile.area ?? row.city,
    coordinates,
    type: row.provider_type,
    isFacility: row.provider_type === "Facility",
    company: row.company_slug && row.company_name ? { name: row.company_name, slug: row.company_slug } : row.profile.company,
    modalities: row.modalities,
    ...(row.provider_type === "Device Supplier" ? { productCount: row.product_count } : {}),
    media: row.media,
    profile: { ...row.profile, logoIsPhoto: row.profile.logoIsPhoto ?? isFacilityPhoto(row) },
  };
}

/** Strips a provider down to the fields the browser needs. */
export function toPublicOperator({ id, slug, name, city, country, coordinates, type, verificationLevel, modalities, profile, media, company, facilityCount, productCount }: NodeData): PublicOperator {
  return { id, slug, name, city, country, coordinates, type, verificationLevel, modalities, profile, media, ...(company ? { company } : {}), ...(facilityCount ? { facilityCount } : {}), ...(productCount !== undefined ? { productCount } : {}) };
}

const providerColumns = `providers.id, providers.slug, providers.name, providers.city, providers.country, providers.longitude, providers.latitude,
  providers.provider_type, providers.modalities, providers.media, providers.profile, providers.verification_level,
  company.name AS company_name, company.slug AS company_slug,
  CASE WHEN providers.provider_type = 'Device Supplier' AND providers.owner_id IS NOT NULL
    THEN (SELECT COUNT(*)::int FROM device_products WHERE device_products.user_id = providers.owner_id AND device_products.published)
    ELSE 0 END AS product_count`;
const publicProvider = "providers.status = 'approved' AND providers.verification_level IN ('online', 'physical', 'incomplete') AND providers.is_demo = FALSE";
// Incomplete listings always come after every verified one.
const incompleteLast = "(providers.verification_level = 'incomplete')";
// Facilities are listed under the approved data company that owns them.
const withCompany = `providers
  LEFT JOIN LATERAL (
    SELECT owner.name, owner.slug FROM providers owner
    WHERE owner.owner_id = providers.owner_id AND owner.provider_type = 'Data Company' AND owner.status = 'approved' AND owner.slug <> providers.slug
    ORDER BY owner.created_at ASC LIMIT 1
  ) company ON providers.provider_type = 'Facility'`;

// React cache() dedupes these within one request, so generateMetadata and the page share a query.
export const verifiedOperators = cache(async () => {
  const result = await query<ProviderRow>(`
    SELECT ${providerColumns}
    FROM ${withCompany}
    WHERE ${publicProvider}
    ORDER BY ${incompleteLast}, providers.created_at ASC, providers.id ASC
  `);
  const operators = result.rows.map(fromRow);
  // Each data company carries how many of its facilities are listed, so the map can hint at them before they are revealed.
  const facilities = new Map<string, number>();
  operators.forEach((operator) => { if (operator.type === "Facility" && operator.company) facilities.set(operator.company.slug, (facilities.get(operator.company.slug) ?? 0) + 1); });
  return operators.map((operator) => facilities.has(operator.slug) ? { ...operator, facilityCount: facilities.get(operator.slug) } : operator);
});

export const verifiedOperator = cache(async (slug: string) => {
  const result = await query<ProviderRow>(`SELECT ${providerColumns} FROM ${withCompany} WHERE providers.slug = $1 AND ${publicProvider} LIMIT 1`, [slug]);
  return result.rows[0] ? fromRow(result.rows[0]) : undefined;
});

/** The approved facilities listed under a data company, shown once a signed-in viewer opens the company. */
export async function companyFacilities(companySlug: string) {
  return (await verifiedOperators()).filter((operator) => operator.type === "Facility" && operator.company?.slug === companySlug);
}

export async function relatedOperators(operator: NodeData, limit = 3) {
  const result = await query<ProviderRow>(`
    SELECT ${providerColumns}
    FROM ${withCompany}
    WHERE ${publicProvider} AND providers.slug <> $1
    ORDER BY ${incompleteLast}, (providers.country = $2) DESC, (providers.provider_type = $3) DESC, providers.created_at ASC, providers.id ASC
    LIMIT $4
  `, [operator.slug, operator.country, operator.type, limit]);
  return result.rows.map(fromRow);
}

export async function recordProfileView(slug: string) {
  try {
    await query("UPDATE providers SET profile_views = profile_views + 1 WHERE slug = $1", [slug]);
  } catch (error) {
    // View counts are best-effort analytics and must never take the profile page down.
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "42P01")) console.warn("Could not record profile view:", error);
  }
}

/** True when the signed-in user owns the listing, e.g. a device company viewing its own store. */
export async function ownsListing(slug: string, userId: string) {
  return Boolean((await query("SELECT 1 FROM providers WHERE slug = $1 AND owner_id = $2 LIMIT 1", [slug, userId])).rowCount);
}
