import { query } from "@/lib/db/client";
import { adminRequired, adminUser } from "@/lib/admin/queries";
import { isUuid } from "@/lib/security";

export async function GET(_request: Request, context: RouteContext<"/api/admin/applications/[id]/sample">) {
  if (!await adminUser()) return adminRequired();
  const { id } = await context.params;
  const missing = () => Response.json({ error: "Sample not found." }, { status: 404 });
  if (!isUuid(id)) return missing();
  const sample = (await query<{ sample_file_name: string; sample_mime_type: string; sample_data: Buffer }>(`
    SELECT sample_file_name, sample_mime_type, sample_data
    FROM supplier_applications applications
    JOIN users ON users.id = applications.user_id
    WHERE applications.id = $1 AND applications.application_kind = 'company' AND applications.sample_data IS NOT NULL AND users.email_verified_at IS NOT NULL
  `, [id])).rows[0];
  if (!sample) return missing();
  const safeName = sample.sample_file_name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 160) || "supplier-sample";
  return new Response(new Uint8Array(sample.sample_data), { headers: { "Content-Type": sample.sample_mime_type || "application/octet-stream", "Content-Disposition": `attachment; filename="${safeName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
