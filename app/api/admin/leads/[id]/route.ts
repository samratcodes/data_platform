import { randomUUID } from "node:crypto";
import { database } from "@/lib/db/client";
import { adminRequired, adminUser } from "@/lib/admin/queries";
import { cleanSingleLine, isUuid, readJsonObject } from "@/lib/security";

const statuses = new Set(["new", "contacted", "qualified", "closed"]);

export async function PATCH(request: Request, context: RouteContext<"/api/admin/leads/[id]">) {
  const user = await adminUser();
  if (!user) return adminRequired();
  const { id } = await context.params;
  const parsed = await readJsonObject(request, 2_048);
  if (parsed.response) return parsed.response;
  const status = cleanSingleLine(parsed.body.status, 20);
  if (!isUuid(id) || !statuses.has(status)) return Response.json({ error: "Choose a valid lead status." }, { status: 400 });
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE concierge_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status, updated_at", [status, id]);
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Procurement brief not found." }, { status: 404 });
    }
    await client.query(`
      INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, metadata)
      VALUES ($1, $2, $3, 'concierge_request', $4, $5::jsonb)
    `, [randomUUID(), user.id, `concierge.${status}`, id, JSON.stringify({ status })]);
    await client.query("COMMIT");
    return Response.json({ lead: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
