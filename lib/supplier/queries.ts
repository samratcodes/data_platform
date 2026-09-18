import "server-only";

import { query } from "@/lib/db/client";
import { isUuid } from "@/lib/security";
import type { SupplierAccessRequest } from "@/components/supplier/SupplierRequests";
import type { FacilityDashboardData, FacilityRecord, SupplierCompany, SupplierListing } from "@/types/supplier";

/** The supplier's latest data-company application, which gates facility applications. */
export async function supplierCompany(userId: string) {
  const result = await query<SupplierCompany>(`
    SELECT id, business_name, status, admin_notes, submitted_at, reviewed_at
    FROM supplier_applications
    WHERE user_id = $1 AND application_kind = 'company'
    ORDER BY submitted_at DESC LIMIT 1
  `, [userId]);
  return result.rows[0] ?? null;
}

const facilityColumns = `
  applications.id, applications.business_name, applications.profile_description, applications.maps_url,
  applications.physical_address, applications.city, applications.country, applications.longitude, applications.latitude,
  applications.modalities, applications.capture_environments, applications.hardware_pictures, applications.office_images,
  applications.official_documents, applications.company_logo, applications.facility_details, applications.provider_slug,
  applications.status, applications.admin_notes`;

const listingStats = `
  providers.status AS listing_status,
  COALESCE(providers.profile_views, 0)::int AS profile_views,
  (SELECT COUNT(*)::int FROM saved_operators WHERE operator_slug = providers.slug) AS saves,
  (SELECT COUNT(*)::int FROM access_requests WHERE operator_slug = providers.slug) AS access_requests,
  (SELECT COUNT(*)::int FROM conversations WHERE operator_slug = providers.slug) AS conversations`;

/** One row per company or facility application, with its live listing's analytics when approved. */
export async function supplierListings(userId: string) {
  const result = await query<SupplierListing>(`
    SELECT applications.id, applications.application_kind, applications.business_name, applications.city, applications.country,
           applications.status, applications.verification_level, applications.admin_notes, applications.submitted_at,
           applications.facility_details, applications.modalities, applications.office_images, applications.hardware_pictures,
           applications.company_logo, applications.provider_slug, ${listingStats}
    FROM supplier_applications applications
    LEFT JOIN providers ON providers.slug = applications.provider_slug AND providers.owner_id = applications.user_id
    WHERE applications.user_id = $1
    ORDER BY applications.application_kind = 'company' DESC, applications.submitted_at DESC
  `, [userId]);
  return result.rows;
}

/** Buyer requests for the supplier's approved listings, optionally for a single listing. */
export async function supplierAccessRequests(userId: string, operatorSlug?: string | null) {
  const result = await query<SupplierAccessRequest>(`
    SELECT requests.id, requests.operator_slug, requests.purpose, requests.status,
           requests.created_at, requests.updated_at, users.name AS buyer_name,
           users.email AS buyer_email, providers.name AS provider_name
    FROM access_requests requests
    JOIN providers ON providers.slug = requests.operator_slug
    JOIN users ON users.id = requests.user_id
    WHERE providers.owner_id = $1 AND ($2::text IS NULL OR requests.operator_slug = $2)
    ORDER BY requests.created_at DESC
  `, [userId, operatorSlug ?? null]);
  return result.rows;
}

/** One of the supplier's own facility applications, for the edit form. */
export async function supplierFacility(userId: string, id: string) {
  if (!isUuid(id)) return null;
  const result = await query<FacilityRecord>(`
    SELECT ${facilityColumns}
    FROM supplier_applications applications
    WHERE applications.id = $1 AND applications.user_id = $2 AND applications.application_kind = 'facility'
  `, [id, userId]);
  return result.rows[0] ?? null;
}

/** Everything the facility dashboard shows: the application, its review state, and its live listing's analytics. */
export async function supplierFacilityDashboard(userId: string, id: string) {
  if (!isUuid(id)) return null;
  const result = await query<FacilityDashboardData>(`
    SELECT ${facilityColumns}, applications.verification_level, applications.submitted_at, applications.reviewed_at, ${listingStats}
    FROM supplier_applications applications
    LEFT JOIN providers ON providers.slug = applications.provider_slug AND providers.owner_id = applications.user_id
    WHERE applications.id = $1 AND applications.user_id = $2 AND applications.application_kind = 'facility'
  `, [id, userId]);
  const facility = result.rows[0];
  if (!facility) return null;
  const requests = facility.provider_slug ? await supplierAccessRequests(userId, facility.provider_slug) : [];
  return { facility, requests };
}
