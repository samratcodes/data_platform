import { getUser } from "@/lib/auth/session";
import { query } from "@/lib/db/client";
import { readCompanyAsset } from "@/lib/integrations/cloud-storage";

export const runtime = "nodejs";

/**
 * Serves a product photo. Photos of published products on a live store are public;
 * everything else is only visible to the device company that owns it and administrators.
 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key.startsWith("device-products/")) return Response.json({ error: "Image not found." }, { status: 404 });
  const row = (await query<{ content_type: string; user_id: string; live: boolean }>(`
    SELECT entry->>'contentType' AS content_type, products.user_id,
           (products.published AND EXISTS (
             SELECT 1 FROM providers WHERE providers.owner_id = products.user_id AND providers.provider_type = 'Device Supplier'
               AND providers.status = 'approved' AND providers.is_demo = FALSE
           )) AS live
    FROM device_products products CROSS JOIN LATERAL jsonb_array_elements(products.images) entry
    WHERE entry->>'key' = $1 LIMIT 1
  `, [key])).rows[0];
  if (!row) return Response.json({ error: "Image not found." }, { status: 404 });
  if (!row.live) {
    const user = await getUser();
    if (!user || (user.id !== row.user_id && user.role !== "admin")) return Response.json({ error: "Image not found." }, { status: 404 });
  }
  const data = await readCompanyAsset(key);
  return new Response(new Uint8Array(data), { headers: { "Content-Type": row.content_type || "image/jpeg", "Cache-Control": row.live ? "public, max-age=3600" : "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
