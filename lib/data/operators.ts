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
  verification_level: "online" | "physical";
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
    isFacility: row.provider_type !== "Data Company",
    company: row.company_slug && row.company_name ? { name: row.company_name, slug: row.company_slug } : row.profile.company,
    modalities: row.modalities,
    media: row.media,
    profile: { ...row.profile, logoIsPhoto: row.profile.logoIsPhoto ?? isFacilityPhoto(row) },
  };
}

/** Strips a provider down to the fields the browser needs. */
export function toPublicOperator({ id, slug, name, city, country, coordinates, type, verificationLevel, modalities, profile, media, company }: NodeData): PublicOperator {
  return { id, slug, name, city, country, coordinates, type, verificationLevel, modalities, profile, media, ...(company ? { company } : {}) };
}

const providerColumns = `providers.id, providers.slug, providers.name, providers.city, providers.country, providers.longitude, providers.latitude,
  providers.provider_type, providers.modalities, providers.media, providers.profile, providers.verification_level,
  company.name AS company_name, company.slug AS company_slug`;
const publicProvider = "providers.status = 'approved' AND providers.verification_level IN ('online', 'physical') AND providers.is_demo = FALSE";
// Facilities are listed under the approved data company that owns them.
const withCompany = `providers
  LEFT JOIN LATERAL (
    SELECT owner.name, owner.slug FROM providers owner
    WHERE owner.owner_id = providers.owner_id AND owner.provider_type = 'Data Company' AND owner.status = 'approved' AND owner.slug <> providers.slug
    ORDER BY owner.created_at ASC LIMIT 1
  ) company ON providers.provider_type <> 'Data Company'`;

// React cache() dedupes these within one request, so generateMetadata and the page share a query.
export const verifiedOperators = cache(async () => {
  const result = await query<ProviderRow>(`
    SELECT ${providerColumns}
    FROM ${withCompany}
    WHERE ${publicProvider}
    ORDER BY providers.created_at ASC, providers.id ASC
  `);
  return result.rows.map(fromRow);
});

export const verifiedOperator = cache(async (slug: string) => {
  const result = await query<ProviderRow>(`SELECT ${providerColumns} FROM ${withCompany} WHERE providers.slug = $1 AND ${publicProvider} LIMIT 1`, [slug]);
  return result.rows[0] ? fromRow(result.rows[0]) : undefined;
});

export async function relatedOperators(operator: NodeData, limit = 3) {
  const result = await query<ProviderRow>(`
    SELECT ${providerColumns}
    FROM ${withCompany}
    WHERE ${publicProvider} AND providers.slug <> $1
    ORDER BY (providers.country = $2) DESC, (providers.provider_type = $3) DESC, providers.created_at ASC, providers.id ASC
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
