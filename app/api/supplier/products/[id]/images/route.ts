import { randomUUID } from "node:crypto";
import { query } from "@/lib/db/client";
import { MAX_PRODUCT_IMAGE_BYTES, MAX_PRODUCT_IMAGES, productImageUrl, type ProductImage } from "@/lib/devices";
import { ownerProduct } from "@/lib/data/products";
import { deleteCompanyAsset, uploadCompanyAsset } from "@/lib/integrations/cloud-storage";
import { requireDeviceSupplier } from "@/lib/supplier/device-store";
import { readJsonObject } from "@/lib/security";

export const runtime = "nodejs";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const safeName = (value: string) => value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "image";
const notFound = () => Response.json({ error: "Product not found." }, { status: 404 });
const saveImages = (id: string, userId: string, images: ProductImage[]) => query("UPDATE device_products SET images = $1::jsonb, updated_at = NOW() WHERE id = $2 AND user_id = $3", [JSON.stringify(images), id, userId]);

/** Adds product photos; the first photo is the one shown on product cards. */
export async function POST(request: Request, context: RouteContext<"/api/supplier/products/[id]/images">) {
  const guard = await requireDeviceSupplier();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const product = await ownerProduct(guard.user.id, id);
  if (!product) return notFound();
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_PRODUCT_IMAGES * MAX_PRODUCT_IMAGE_BYTES + 1_000_000) return Response.json({ error: "The upload is too large." }, { status: 413 });
  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length || product.images.length + files.length > MAX_PRODUCT_IMAGES || files.some((file) => !imageTypes.has(file.type) || file.size > MAX_PRODUCT_IMAGE_BYTES)) {
    return Response.json({ error: `Add up to ${MAX_PRODUCT_IMAGES} JPG, PNG, or WebP photos, 10 MB each at most.` }, { status: 400 });
  }
  const added = await Promise.all(files.map(async (file) => {
    const key = `device-products/${id}/${randomUUID()}-${safeName(file.name)}`;
    await uploadCompanyAsset(key, Buffer.from(await file.arrayBuffer()), file.type);
    return { key, name: safeName(file.name), contentType: file.type, size: file.size };
  }));
  const images = [...product.images, ...added];
  await saveImages(id, guard.user.id, images);
  return Response.json({ images: images.map((image) => ({ ...image, url: productImageUrl(image.key) })) }, { status: 201 });
}

/** Makes one photo the cover by moving it to the front. */
export async function PATCH(request: Request, context: RouteContext<"/api/supplier/products/[id]/images">) {
  const guard = await requireDeviceSupplier();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const parsed = await readJsonObject(request, 2_048);
  if (parsed.response) return parsed.response;
  const product = await ownerProduct(guard.user.id, id);
  if (!product) return notFound();
  const cover = product.images.find((image) => image.key === parsed.body.cover);
  if (!cover) return Response.json({ error: "Photo not found." }, { status: 404 });
  await saveImages(id, guard.user.id, [cover, ...product.images.filter((image) => image !== cover)]);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, context: RouteContext<"/api/supplier/products/[id]/images">) {
  const guard = await requireDeviceSupplier();
  if (guard.response) return guard.response;
  const { id } = await context.params;
  const key = new URL(request.url).searchParams.get("key") || "";
  const product = await ownerProduct(guard.user.id, id);
  if (!product) return notFound();
  if (!product.images.some((image) => image.key === key)) return Response.json({ error: "Photo not found." }, { status: 404 });
  await saveImages(id, guard.user.id, product.images.filter((image) => image.key !== key));
  await deleteCompanyAsset(key).catch((error) => console.warn("Could not delete product image:", key, error));
  return Response.json({ ok: true });
}
