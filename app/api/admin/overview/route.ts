import { query } from "@/lib/db/client";
import { adminRequired, adminUser, listApplications, listAuditEntries, privateJson } from "@/lib/admin/queries";
import type { AdminOverview, LeadStatus } from "@/types/admin";

export async function GET() {
  if (!await adminUser()) return adminRequired();
  const [applicationCounts, leadCounts, listings, pending, activity, sync] = await Promise.all([
    query<{ application_kind: "company" | "facility"; status: "pending" | "approved" | "rejected"; count: number }>(`
      SELECT applications.application_kind, applications.status, COUNT(*)::int AS count
      FROM supplier_applications applications JOIN users ON users.id = applications.user_id
      WHERE users.email_verified_at IS NOT NULL
      GROUP BY applications.application_kind, applications.status
    `),
    query<{ status: LeadStatus; count: number }>("SELECT status, COUNT(*)::int AS count FROM concierge_requests GROUP BY status"),
    query<{ count: number }>("SELECT COUNT(*)::int AS count FROM providers WHERE status = 'approved' AND is_demo = FALSE"),
    listApplications({ status: "pending", limit: 8 }),
    listAuditEntries({ limit: 8 }),
    query<{ status: string; count: number }>("SELECT status, COUNT(*)::int AS count FROM integration_outbox WHERE event_type = 'user.sheet.upsert' GROUP BY status"),
  ]);
  const empty = () => ({ pending: 0, approved: 0, rejected: 0 });
  const overview: AdminOverview = {
    applications: { company: empty(), facility: empty() },
    leads: { new: 0, contacted: 0, qualified: 0, closed: 0 },
    liveListings: listings.rows[0]?.count ?? 0,
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
