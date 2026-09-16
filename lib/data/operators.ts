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
};

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
    company: row.profile.company,
    modalities: row.modalities,
    media: row.media,
    profile: row.profile,
  };
}

/** Strips a provider down to the fields the browser needs. */
export function toPublicOperator({ id, slug, name, city, country, coordinates, type, verificationLevel, modalities, profile, media }: NodeData): PublicOperator {
  return { id, slug, name, city, country, coordinates, type, verificationLevel, modalities, profile, media };
}

const providerColumns = "id, slug, name, city, country, longitude, latitude, provider_type, modalities, media, profile, verification_level";
const publicProvider = "status = 'approved' AND verification_level IN ('online', 'physical') AND is_demo = FALSE";

// React cache() dedupes these within one request, so generateMetadata and the page share a query.
export const verifiedOperators = cache(async () => {
  const result = await query<ProviderRow>(`
    SELECT ${providerColumns}
    FROM providers
    WHERE ${publicProvider}
    ORDER BY created_at ASC, id ASC
  `);
  return result.rows.map(fromRow);
});

export const verifiedOperator = cache(async (slug: string) => {
  const result = await query<ProviderRow>(`SELECT ${providerColumns} FROM providers WHERE slug = $1 AND ${publicProvider} LIMIT 1`, [slug]);
  return result.rows[0] ? fromRow(result.rows[0]) : undefined;
});

export async function relatedOperators(operator: NodeData, limit = 3) {
  const result = await query<ProviderRow>(`
    SELECT ${providerColumns}
    FROM providers
    WHERE ${publicProvider} AND slug <> $1
    ORDER BY (country = $2) DESC, (provider_type = $3) DESC, created_at ASC, id ASC
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
