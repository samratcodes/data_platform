import { randomUUID } from "node:crypto";
import { getUser } from "@/lib/auth/session";
import { query } from "@/lib/db/client";
import { readCompanyAsset, uploadCompanyAsset } from "@/lib/integrations/cloud-storage";

export const runtime = "nodejs";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const documentTypes = new Set([...imageTypes, "application/pdf"]);
type Asset = { key: string; name: string; contentType: string; size?: number; type?: string };
const safeName = (value: string) => value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "upload";
const assetUrl = (key: string, isPublic = false) => `/api/company-assets?${isPublic ? "public=1&" : ""}key=${encodeURIComponent(key)}`;

async function applicationFor(userId: string) {
  return (await query<{ id: string; office_images: Asset[]; official_documents: Asset[]; status: string }>("SELECT id, office_images, official_documents, status FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company' ORDER BY submitted_at DESC LIMIT 1", [userId])).rows[0];
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user || user.role !== "supplier") return Response.json({ error: "Create your supplier account before uploading company evidence." }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 51_000_000) return Response.json({ error: "The upload exceeds the 50 MB image limit." }, { status: 413 });
  const application = await applicationFor(user.id);
  if (!application) return Response.json({ error: "Company application not found." }, { status: 404 });
  const form = await request.formData();
  const kind = form.get("kind") === "document" ? "document" : form.get("kind") === "office" ? "office" : "";
  const documentType = typeof form.get("documentType") === "string" ? String(form.get("documentType")).trim().slice(0, 120) : "";
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  const allowed = kind === "office" ? imageTypes : documentTypes;
  const limit = kind === "office" ? 10 : 5;
  const max = kind === "office" ? 50_000_000 : 10_000_000;
  const existing = kind === "office" ? application.office_images : application.official_documents;
  const existingSize = existing.reduce((sum, asset) => sum + (asset.size || 0), 0);
  const newSize = files.reduce((sum, file) => sum + file.size, 0);
  if (!kind || !files.length || existing.length + files.length > limit || files.some((file) => !allowed.has(file.type) || file.size > max) || (kind === "office" && existingSize + newSize > 50_000_000) || (kind === "document" && documentType.length < 2)) return Response.json({ error: kind === "office" ? "Upload up to 10 JPG, PNG, or WebP office images with a combined size of 50 MB or less." : "Choose up to 5 supported documents, no larger than 10 MB each, and provide a document type." }, { status: 400 });
  const assets = await Promise.all(files.map(async (file) => {
    const key = `company-submissions/${application.id}/${kind}/${randomUUID()}-${safeName(file.name)}`;
    await uploadCompanyAsset(key, Buffer.from(await file.arrayBuffer()), file.type);
    return { key, name: safeName(file.name), contentType: file.type, size: file.size, ...(kind === "document" ? { type: documentType } : {}) };
  }));
  const column = kind === "office" ? "office_images" : "official_documents";
  await query(`UPDATE supplier_applications SET ${column} = COALESCE(${column}, '[]'::jsonb) || $1::jsonb, status = 'pending', reviewed_at = NULL WHERE id = $2`, [JSON.stringify(assets), application.id]);
  return Response.json({ assets: assets.map((asset) => ({ ...asset, url: assetUrl(asset.key) })) }, { status: 201 });
}

export async function GET(request: Request) {
  const url = new URL(request.url); const key = url.searchParams.get("key") || ""; const publicView = url.searchParams.get("public") === "1";
  if (!key.startsWith("company-submissions/")) return Response.json({ error: "Asset not found." }, { status: 404 });
  const source = publicView
    ? `SELECT entry->>'contentType' AS content_type, applications.status, applications.user_id FROM supplier_applications applications CROSS JOIN LATERAL jsonb_array_elements(applications.office_images) entry WHERE entry->>'key' = $1 LIMIT 1`
    : `SELECT entry->>'contentType' AS content_type, applications.status, applications.user_id FROM supplier_applications applications CROSS JOIN LATERAL jsonb_array_elements(applications.office_images) entry WHERE entry->>'key' = $1 UNION ALL SELECT entry->>'contentType', applications.status, applications.user_id FROM supplier_applications applications CROSS JOIN LATERAL jsonb_array_elements(applications.official_documents) entry WHERE entry->>'key' = $1 LIMIT 1`;
  const owner = (await query<{ content_type: string; status: string; user_id: string }>(source, [key])).rows[0];
  if (!owner) return Response.json({ error: "Asset not found." }, { status: 404 });
  if (publicView) { if (owner.status !== "approved") return Response.json({ error: "Asset not found." }, { status: 404 }); }
  else { const user = await getUser(); if (!user || (user.id !== owner.user_id && user.role !== "admin")) return Response.json({ error: "Access denied." }, { status: 403 }); }
  const data = await readCompanyAsset(key);
  return new Response(new Uint8Array(data), { headers: { "Content-Type": owner.content_type || "application/octet-stream", "Cache-Control": publicView ? "public, max-age=3600" : "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
