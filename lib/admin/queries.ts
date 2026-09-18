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

/** Review-queue rows. Applications from unverified email addresses are not reviewable yet. */
export async function listApplications(filter: { kind?: string; status?: string; limit?: number } = {}) {
  const result = await query<ApplicationSummary>(`
    SELECT applications.id, applications.application_kind, applications.business_name,
           users.name AS applicant_name, users.email AS applicant_email,
           applications.city, applications.country, applications.status, applications.verification_level,
           applications.submitted_at, applications.reviewed_at,
           COALESCE(applications.company_logo, company.company_logo)->>'key' AS logo_key,
           (jsonb_array_length(applications.office_images) + jsonb_array_length(applications.hardware_pictures))::int AS image_count,
           jsonb_array_length(applications.official_documents)::int AS document_count,
           CASE WHEN applications.application_kind = 'facility' THEN company.business_name END AS company_name,
           CASE WHEN applications.application_kind = 'facility' THEN company.status END AS company_status
    FROM supplier_applications applications
    JOIN users ON users.id = applications.user_id
    LEFT JOIN LATERAL (
      SELECT business_name, status, company_logo FROM supplier_applications
      WHERE user_id = applications.user_id AND application_kind = 'company'
      ORDER BY submitted_at DESC LIMIT 1
    ) company ON TRUE
    WHERE users.email_verified_at IS NOT NULL
      AND ($1::text IS NULL OR applications.application_kind = $1)
      AND ($2::text IS NULL OR applications.status = $2)
    ORDER BY applications.submitted_at DESC
    LIMIT $3
  `, [filter.kind ?? null, filter.status ?? null, filter.limit ?? 1_000]);
  return result.rows;
}

/** Audit history, newest first, with a readable label for each target. */
export async function listAuditEntries(filter: { targetId?: string; limit?: number } = {}) {
  const result = await query<AuditEntry>(`
    SELECT logs.id, logs.action, logs.target_type, logs.target_id, logs.metadata, logs.created_at,
           admins.name AS admin_name,
           COALESCE(applications.business_name, lead_users.name) AS target_label
    FROM admin_audit_logs logs
    JOIN users admins ON admins.id = logs.admin_user_id
    LEFT JOIN supplier_applications applications ON logs.target_type = 'supplier_application' AND applications.id::text = logs.target_id
    LEFT JOIN concierge_requests leads ON logs.target_type = 'concierge_request' AND leads.id::text = logs.target_id
    LEFT JOIN users lead_users ON lead_users.id = leads.user_id
    WHERE ($1::text IS NULL OR logs.target_id = $1)
    ORDER BY logs.created_at DESC
    LIMIT $2
  `, [filter.targetId ?? null, filter.limit ?? 50]);
  return result.rows;
}
