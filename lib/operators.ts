import type { NodeData } from "@/components/Landing/types";
import { query } from "./database";

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

export async function verifiedOperators() {
  const result = await query<ProviderRow>(`
    SELECT id, slug, name, city, country, longitude, latitude, provider_type, modalities, media, profile, verification_level
    FROM providers
    WHERE status = 'approved' AND verification_level IN ('online', 'physical')
      AND is_demo = FALSE
    ORDER BY created_at ASC, id ASC
  `);
  return result.rows.map(fromRow);
}

export async function verifiedOperator(slug: string) {
  return (await verifiedOperators()).find((operator) => operator.slug === slug);
}

export async function recordProfileView(slug: string) {
  try {
    await query("UPDATE providers SET profile_views = profile_views + 1 WHERE slug = $1", [slug]);
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "42P01")) throw error;
  }
}
