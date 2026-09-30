import "server-only";

import { emailVerificationRequired, getUser, isEmailVerified, type SessionUser } from "@/lib/auth/session";
import { query } from "@/lib/db/client";

type Guard = { user: SessionUser; response?: never } | { user?: never; response: Response };

/** The signed-in device company, or the response that explains why the store is unavailable. */
export async function requireDeviceSupplier({ verified = true } = {}): Promise<Guard> {
  const user = await getUser();
  if (!user) return { response: Response.json({ error: "Please log in." }, { status: 401 }) };
  if (user.role !== "supplier") return { response: Response.json({ error: "Supplier access required." }, { status: 403 }) };
  if (verified && !isEmailVerified(user)) return { response: emailVerificationRequired() };
  if (user.companyFocus !== "devices") return { response: Response.json({ error: "Only device companies can manage a product store." }, { status: 403 }) };
  return { user };
}

export type StoreSummary = {
  company: { id: string; business_name: string; city: string | null; country: string | null; status: "pending" | "approved" | "rejected"; verification_level: string; admin_notes: string | null; submitted_at: string; reviewed_at: string | null } | null;
  listing: { slug: string; status: string; verification_level: string; profile_views: number; saves: number; conversations: number } | null;
};

/** The device company's application and, once approved, its live store listing with analytics. */
export async function storeSummary(userId: string): Promise<StoreSummary> {
  const [company, listing] = await Promise.all([
    query<NonNullable<StoreSummary["company"]>>(`
      SELECT id, business_name, city, country, status, verification_level, admin_notes, submitted_at, reviewed_at
      FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company'
      ORDER BY submitted_at DESC LIMIT 1
    `, [userId]),
    query<NonNullable<StoreSummary["listing"]>>(`
      SELECT providers.slug, providers.status, providers.verification_level, COALESCE(providers.profile_views, 0)::int AS profile_views,
             (SELECT COUNT(*)::int FROM saved_operators WHERE operator_slug = providers.slug) AS saves,
             (SELECT COUNT(*)::int FROM conversations WHERE operator_slug = providers.slug) AS conversations
      FROM providers WHERE owner_id = $1 AND provider_type = 'Device Supplier'
      ORDER BY created_at ASC LIMIT 1
    `, [userId]),
  ]);
  return { company: company.rows[0] ?? null, listing: listing.rows[0] ?? null };
}
