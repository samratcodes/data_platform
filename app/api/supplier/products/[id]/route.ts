import { rateLimited } from "@/lib/auth/rate-limit";
import { query } from "@/lib/db/client";
import { parseDeviceProduct } from "@/lib/devices";
import { ownerProduct } from "@/lib/data/products";
import { deleteCompanyAsset } from "@/lib/integrations/cloud-storage";
import { requireDeviceSupplier } from "@/lib/supplier/device-store";
import { readJsonObject } from "@/lib/security";

const notFound = () => Response.json({ error: "Product not found." }, { status: 404 });

/** Saves the whole product, or only its visibility when the body is `{ published }`. */
export async function PATCH(request: Request, context: RouteContext<"/api/supplier/products/[id]">) {
  const guard = await requireDeviceSupplier();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const parsed = await readJsonObject(request, 24_576);
  if (parsed.response) return parsed.response;
  if (await rateLimited(`products:${guard.user.id}`, 60, 60 * 60_000)) return Response.json({ error: "Update limit reached. Try again later." }, { status: 429 });
  const existing = await ownerProduct(guard.user.id, id);
  if (!existing) return notFound();
  const body = parsed.body;
  if (Object.keys(body).length === 1 && typeof body.published === "boolean") {
    await query("UPDATE device_products SET published = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3", [body.published, id, guard.user.id]);
    return Response.json({ ok: true, published: body.published });
  }
  const { product, issues } = parseDeviceProduct(body);
  const problem = Object.values(issues)[0];
  if (problem) return Response.json({ error: problem, issues }, { status: 400 });
  await query(`
    UPDATE device_products
    SET name = $1, category = $2, category_other = $3, description = $4, use_cases = $5::jsonb, data_outputs = $6::jsonb,
        specs = $7::jsonb, price = $8, availability = $9, published = $10, updated_at = NOW()
    WHERE id = $11 AND user_id = $12
  `, [product.name, product.category, product.categoryOther, product.description, JSON.stringify(product.useCases), JSON.stringify(product.dataOutputs), JSON.stringify(product.specs), product.price, product.availability, product.published, id, guard.user.id]);
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/supplier/products/[id]">) {
  const guard = await requireDeviceSupplier();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const existing = await ownerProduct(guard.user.id, id);
  if (!existing) return notFound();
  await query("DELETE FROM device_products WHERE id = $1 AND user_id = $2", [id, guard.user.id]);
  // Storage cleanup is best-effort: the deleted row already hides the images.
  await Promise.all(existing.images.map((image) => deleteCompanyAsset(image.key).catch((error) => console.warn("Could not delete product image:", image.key, error))));
  return Response.json({ ok: true });
}
