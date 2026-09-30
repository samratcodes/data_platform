import "server-only";

import { getUser } from "@/lib/auth/session";
import { query } from "@/lib/db/client";
import type { ApplicationSummary, AuditEntry } from "@/types/admin";

/** The signed-in administrator, or null for anyone else. */
export async function adminUser() {
  const user = await getUser();
  return user?.role === "admin" ? user : null;
}

export const adminRequired = () => Response.json({ error: "Admin access required." }, { status: 403 });
export const privateJson = (body: unknown, init?: ResponseInit) => Response.json(body, { ...init, headers: { "Cache-Control": "private, no-store", ...init?.headers } });

/**
 * Review-queue rows. Applications from unverified email addresses are not reviewable yet.
 * `focus` splits company applications into data-collection companies and device companies.
 */
export async function listApplications(filter: { kind?: string; status?: string; focus?: "collection" | "devices"; limit?: number } = {}) {
  const result = await query<ApplicationSummary>(`
    SELECT applications.id, applications.application_kind, applications.business_name,
           users.name AS applicant_name, users.email AS applicant_email,
           applications.city, applications.country, applications.status, applications.verification_level,
           COALESCE(applications.company_focus, company.company_focus, 'collection') AS company_focus,
           applications.submitted_at, applications.reviewed_at,
           COALESCE(applications.company_logo, company.company_logo)->>'key' AS logo_key,
           (jsonb_array_length(applications.office_images) + jsonb_array_length(applications.hardware_pictures))::int AS image_count,
           jsonb_array_length(applications.official_documents)::int AS document_count,
           CASE WHEN applications.application_kind = 'facility' THEN company.business_name END AS company_name,
           CASE WHEN applications.application_kind = 'facility' THEN company.status END AS company_status
    FROM supplier_applications applications
    JOIN users ON users.id = applications.user_id
    LEFT JOIN LATERAL (
      SELECT business_name, status, company_logo, company_focus FROM supplier_applications
      WHERE user_id = applications.user_id AND application_kind = 'company'
      ORDER BY submitted_at DESC LIMIT 1
    ) company ON TRUE
    WHERE users.email_verified_at IS NOT NULL
      AND ($1::text IS NULL OR applications.application_kind = $1)
      AND ($2::text IS NULL OR applications.status = $2)
      AND ($4::text IS NULL OR COALESCE(applications.company_focus, company.company_focus, 'collection') = $4)
    ORDER BY applications.submitted_at DESC
    LIMIT $3
  `, [filter.kind ?? null, filter.status ?? null, filter.limit ?? 1_000, filter.focus ?? null]);
  return result.rows;
}

/** Audit history, newest first, with a readable label for each target. */
export async function listAuditEntries(filter: { targetId?: string; limit?: number } = {}) {
  const result = await query<AuditEntry>(`
    SELECT logs.id, logs.action, logs.target_type, logs.target_id, logs.metadata, logs.created_at,
           admins.name AS admin_name,
           COALESCE(applications.business_name, lead_users.name, listings.name) AS target_label
    FROM admin_audit_logs logs
    JOIN users admins ON admins.id = logs.admin_user_id
    LEFT JOIN supplier_applications applications ON logs.target_type = 'supplier_application' AND applications.id::text = logs.target_id
    LEFT JOIN concierge_requests leads ON logs.target_type = 'concierge_request' AND leads.id::text = logs.target_id
    LEFT JOIN users lead_users ON lead_users.id = leads.user_id
    LEFT JOIN providers listings ON logs.target_type = 'provider' AND listings.slug = logs.target_id
    WHERE ($1::text IS NULL OR logs.target_id = $1)
    ORDER BY logs.created_at DESC
    LIMIT $2
  `, [filter.targetId ?? null, filter.limit ?? 50]);
  return result.rows;
}

export type AdminDevice = {
  id: string; name: string; category: string; category_other: string; price: string; published: boolean; image_key: string | null;
  created_at: string; store_name: string; store_email: string; store_slug: string | null; store_level: string | null; application_id: string | null; application_status: string | null;
};

/** Every device product with its store, including hidden products and stores still under review. */
export async function listDevices() {
  const result = await query<AdminDevice>(`
    SELECT products.id, products.name, products.category, products.category_other, products.price, products.published,
           products.images->0->>'key' AS image_key, products.created_at,
           COALESCE(store.name, company.business_name, users.name) AS store_name, users.email AS store_email,
           store.slug AS store_slug, store.verification_level AS store_level,
           company.id AS application_id, company.status AS application_status
    FROM device_products products
    JOIN users ON users.id = products.user_id
    LEFT JOIN LATERAL (
      SELECT slug, name, verification_level FROM providers
      WHERE owner_id = products.user_id AND provider_type = 'Device Supplier' ORDER BY created_at ASC LIMIT 1
    ) store ON TRUE
    LEFT JOIN LATERAL (
      SELECT id, business_name, status FROM supplier_applications
      WHERE user_id = products.user_id AND application_kind = 'company' ORDER BY submitted_at DESC LIMIT 1
    ) company ON TRUE
    ORDER BY products.created_at DESC
    LIMIT 1000
  `);
  return result.rows;
}
