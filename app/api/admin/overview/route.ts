import { query } from "@/lib/db/client";
import { adminRequired, adminUser, listApplications, listAuditEntries, privateJson } from "@/lib/admin/queries";
import type { AdminOverview, LeadStatus } from "@/types/admin";

export async function GET() {
  if (!await adminUser()) return adminRequired();
  const [applicationCounts, leadCounts, listings, pending, activity, sync, devices] = await Promise.all([
    query<{ application_kind: "company" | "facility" | "device"; status: "pending" | "approved" | "rejected"; count: number }>(`
      SELECT CASE WHEN applications.application_kind = 'company' AND applications.company_focus = 'devices' THEN 'device' ELSE applications.application_kind END AS application_kind,
             applications.status, COUNT(*)::int AS count
      FROM supplier_applications applications JOIN users ON users.id = applications.user_id
      WHERE users.email_verified_at IS NOT NULL
      GROUP BY 1, applications.status
    `),
    query<{ status: LeadStatus; count: number }>("SELECT status, COUNT(*)::int AS count FROM concierge_requests GROUP BY status"),
    query<{ count: number }>("SELECT COUNT(*)::int AS count FROM providers WHERE status = 'approved' AND is_demo = FALSE"),
    listApplications({ status: "pending", limit: 8 }),
    listAuditEntries({ limit: 8 }),
    query<{ status: string; count: number }>("SELECT status, COUNT(*)::int AS count FROM integration_outbox WHERE event_type = 'user.sheet.upsert' GROUP BY status"),
    query<{ stores: number; products: number; enquiries: number }>(`
      SELECT (SELECT COUNT(*)::int FROM providers WHERE provider_type = 'Device Supplier' AND status = 'approved' AND is_demo = FALSE) AS stores,
             (SELECT COUNT(*)::int FROM device_products products WHERE products.published AND EXISTS (
               SELECT 1 FROM providers WHERE providers.owner_id = products.user_id AND providers.provider_type = 'Device Supplier' AND providers.status = 'approved' AND providers.is_demo = FALSE
             )) AS products,
             (SELECT COUNT(*)::int FROM product_enquiries) AS enquiries
    `),
  ]);
  const empty = () => ({ pending: 0, approved: 0, rejected: 0 });
  const overview: AdminOverview = {
    applications: { company: empty(), facility: empty(), device: empty() },
    leads: { new: 0, contacted: 0, qualified: 0, closed: 0 },
    liveListings: listings.rows[0]?.count ?? 0,
    devices: devices.rows[0] ?? { stores: 0, products: 0, enquiries: 0 },
    pending,
    activity,
    sheetSync: {
      configured: Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
      counts: Object.fromEntries(sync.rows.map((row) => [row.status, row.count])),
    },
  };
  for (const row of applicationCounts.rows) overview.applications[row.application_kind][row.status] = row.count;
  for (const row of leadCounts.rows) if (row.status in overview.leads) overview.leads[row.status] = row.count;
  return privateJson(overview);
}
