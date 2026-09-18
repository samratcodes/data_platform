import { query } from "@/lib/db/client";
import { adminRequired, adminUser, privateJson } from "@/lib/admin/queries";
import type { Lead } from "@/types/admin";

export async function GET() {
  if (!await adminUser()) return adminRequired();
  const result = await query<Lead>(`
    SELECT leads.id, users.name, users.email, leads.brief, leads.budget, leads.timeline, leads.status, leads.created_at, leads.updated_at
    FROM concierge_requests leads JOIN users ON users.id = leads.user_id
    ORDER BY leads.created_at DESC
  `);
  return privateJson({ leads: result.rows });
}
