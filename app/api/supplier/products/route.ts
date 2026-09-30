import { randomUUID } from "node:crypto";
import { rateLimited } from "@/lib/auth/rate-limit";
import { query } from "@/lib/db/client";
import { parseDeviceProduct } from "@/lib/devices";
import { ownerProducts, receivedEnquiries } from "@/lib/data/products";
import { requireDeviceSupplier, storeSummary } from "@/lib/supplier/device-store";
import { readJsonObject } from "@/lib/security";

const MAX_PRODUCTS = 200;

/** Everything the device store manager shows: products, enquiries, and the store's review state. */
export async function GET() {
  const guard = await requireDeviceSupplier({ verified: false });
  if (guard.response) return guard.response;
  const [products, enquiries, summary] = await Promise.all([ownerProducts(guard.user.id), receivedEnquiries(guard.user.id), storeSummary(guard.user.id)]);
  return Response.json({ products, enquiries, ...summary }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const guard = await requireDeviceSupplier();
  if (guard.response) return guard.response;
  const parsed = await readJsonObject(request, 24_576);
  if (parsed.response) return parsed.response;
  if (await rateLimited(`products:${guard.user.id}`, 60, 60 * 60_000)) return Response.json({ error: "Product limit reached. Try again later." }, { status: 429 });
  const { product, issues } = parseDeviceProduct(parsed.body);
  const problem = Object.values(issues)[0];
  if (problem) return Response.json({ error: problem, issues }, { status: 400 });
  const count = (await query<{ count: number }>("SELECT COUNT(*)::int AS count FROM device_products WHERE user_id = $1", [guard.user.id])).rows[0]?.count ?? 0;
  if (count >= MAX_PRODUCTS) return Response.json({ error: `A store can list up to ${MAX_PRODUCTS} products.` }, { status: 409 });
  const id = randomUUID();
  await query(`
    INSERT INTO device_products (id, user_id, name, category, category_other, description, use_cases, data_outputs, specs, price, availability, published)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12)
  `, [id, guard.user.id, product.name, product.category, product.categoryOther, product.description, JSON.stringify(product.useCases), JSON.stringify(product.dataOutputs), JSON.stringify(product.specs), product.price, product.availability, product.published]);
  return Response.json({ id }, { status: 201 });
}
