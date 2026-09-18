import { randomUUID } from "node:crypto";
import { getUser } from "@/lib/auth/session";
import { query } from "@/lib/db/client";
import { deleteCompanyAsset, readCompanyAsset, uploadCompanyAsset } from "@/lib/integrations/cloud-storage";
import { isUuid } from "@/lib/security";

export const runtime = "nodejs";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const documentTypes = new Set([...imageTypes, "application/pdf"]);
const MAX_LOGO_BYTES = 5_000_000;
type Asset = { key: string; name: string; contentType: string; size?: number; type?: string };
type Application = { id: string; application_kind: "company" | "facility"; office_images: Asset[]; official_documents: Asset[]; company_logo: Asset | null; hardware_pictures: string[]; status: string };
type Kind = "office" | "document" | "logo";
const safeName = (value: string) => value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "upload";
const assetUrl = (key: string, isPublic = false) => `/api/company-assets?${isPublic ? "public=1&" : ""}key=${encodeURIComponent(key)}`;
const uploadError = (kind: Kind) => kind === "office"
  ? "Upload up to 10 JPG, PNG, or WebP images with a combined size of 50 MB or less."
  : kind === "logo" ? "Upload one JPG, PNG, or WebP logo no larger than 5 MB."
    : "Choose up to 5 supported documents, no larger than 10 MB each, and provide a document type.";
// Facilities store their optional logo and agreement documents beside their images.
const folderFor = (application: Application, kind: Kind) => application.application_kind === "company" ? kind : kind === "office" ? "facility" : `facility-${kind}`;

/** The supplier's company application, or one of their facility applications when an id is given. */
async function applicationFor(userId: string, applicationId?: string | null) {
  const columns = "id, application_kind, office_images, official_documents, company_logo, hardware_pictures, status";
  if (applicationId) {
    if (!isUuid(applicationId)) return undefined;
    return (await query<Application>(`SELECT ${columns} FROM supplier_applications WHERE id = $1 AND user_id = $2`, [applicationId, userId])).rows[0];
  }
  return (await query<Application>(`SELECT ${columns} FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company' ORDER BY submitted_at DESC LIMIT 1`, [userId])).rows[0];
}

/** Approved listings keep showing their last approved media while a revision is under review. */
async function usedByLiveListing(key: string) {
  const url = assetUrl(key, true);
  return Boolean((await query("SELECT 1 FROM providers WHERE status = 'approved' AND (profile->'photos' ? $1 OR profile->>'logo' = $1 OR media->>'src' = $1) LIMIT 1", [url])).rowCount);
}

// Storage cleanup is best-effort: the database row is the source of truth for what is visible.
async function removeStoredObject(key: string) {
  try {
    if (!await usedByLiveListing(key)) await deleteCompanyAsset(key);
  } catch (error) { console.warn("Could not delete company asset from storage:", key, error); }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user || user.role !== "supplier") return Response.json({ error: "Create your supplier account before uploading company evidence." }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 51_000_000) return Response.json({ error: "The upload exceeds the 50 MB image limit." }, { status: 413 });
  const form = await request.formData();
  const application = await applicationFor(user.id, typeof form.get("applicationId") === "string" ? String(form.get("applicationId")) : null);
  if (!application) return Response.json({ error: "Application not found." }, { status: 404 });
  const requested = form.get("kind");
  const kind: Kind | "" = requested === "document" || requested === "office" || requested === "logo" ? requested : "";
  if (!kind) return Response.json({ error: "Unknown upload type." }, { status: 400 });
  const documentType = typeof form.get("documentType") === "string" ? String(form.get("documentType")).trim().slice(0, 120) : "";
  const replaceKey = typeof form.get("replaceKey") === "string" ? String(form.get("replaceKey")) : "";
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  const allowed = kind === "document" ? documentTypes : imageTypes;
  const limit = kind === "office" ? 10 : kind === "logo" ? 1 : 5;
  const max = kind === "office" ? 50_000_000 : kind === "logo" ? MAX_LOGO_BYTES : 10_000_000;
  if (replaceKey && (kind !== "office" || files.length !== 1 || !application.office_images.some((asset) => asset.key === replaceKey))) return Response.json({ error: "The image to replace was not found." }, { status: 404 });
  // Logo and replacement uploads swap out an existing file, so it never counts against the current total.
  const existing = kind === "office" ? application.office_images.filter((asset) => asset.key !== replaceKey) : kind === "document" ? application.official_documents : [];
  const existingSize = existing.reduce((sum, asset) => sum + (asset.size || 0), 0);
  const newSize = files.reduce((sum, file) => sum + file.size, 0);
  if (!files.length || existing.length + files.length > limit || files.some((file) => !allowed.has(file.type) || file.size > max) || (kind === "office" && existingSize + newSize > 50_000_000) || (kind === "document" && documentType.length < 2)) return Response.json({ error: uploadError(kind) }, { status: 400 });
  const folder = folderFor(application, kind);
  const assets = await Promise.all(files.map(async (file) => {
    const key = `company-submissions/${application.id}/${folder}/${randomUUID()}-${safeName(file.name)}`;
    await uploadCompanyAsset(key, Buffer.from(await file.arrayBuffer()), file.type);
    return { key, name: safeName(file.name), contentType: file.type, size: file.size, ...(kind === "document" ? { type: documentType } : {}) };
  }));
  if (kind === "logo") {
    await query("UPDATE supplier_applications SET company_logo = $1::jsonb, status = 'pending', reviewed_at = NULL WHERE id = $2", [JSON.stringify(assets[0]), application.id]);
    if (application.company_logo?.key) await removeStoredObject(application.company_logo.key);
  } else if (replaceKey) {
    // Keep the replacement in the same gallery position as the image it replaces.
    const images = application.office_images.map((asset) => asset.key === replaceKey ? assets[0] : asset);
    await query("UPDATE supplier_applications SET office_images = $1::jsonb, status = 'pending', reviewed_at = NULL WHERE id = $2", [JSON.stringify(images), application.id]);
    await removeStoredObject(replaceKey);
  } else {
    const column = kind === "office" ? "office_images" : "official_documents";
    await query(`UPDATE supplier_applications SET ${column} = COALESCE(${column}, '[]'::jsonb) || $1::jsonb, status = 'pending', reviewed_at = NULL WHERE id = $2`, [JSON.stringify(assets), application.id]);
  }
  return Response.json({ assets: assets.map((asset) => ({ ...asset, url: assetUrl(asset.key) })) }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user || user.role !== "supplier") return Response.json({ error: "Supplier access required." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const key = params.get("key") || "";
  const photo = params.get("photo") || "";
  const application = await applicationFor(user.id, params.get("applicationId"));
  if (!application) return Response.json({ error: "Application not found." }, { status: 404 });
  if (photo) {
    // Linked photos (for example imported from Google Maps) are URLs, not stored files.
    if (!application.hardware_pictures.includes(photo)) return Response.json({ error: "Photo not found." }, { status: 404 });
    await query("UPDATE supplier_applications SET hardware_pictures = $1::jsonb, status = 'pending', reviewed_at = NULL WHERE id = $2", [JSON.stringify(application.hardware_pictures.filter((item) => item !== photo)), application.id]);
    return Response.json({ ok: true });
  }
  if (!key.startsWith(`company-submissions/${application.id}/`)) return Response.json({ error: "Asset not found." }, { status: 404 });
  if (application.company_logo?.key === key) {
    // The logo is required for companies (upload a replacement instead); it is optional for facilities.
    if (application.application_kind === "company") return Response.json({ error: "Your company logo is required. Upload a replacement instead of deleting it." }, { status: 409 });
    await query("UPDATE supplier_applications SET company_logo = NULL, status = 'pending', reviewed_at = NULL WHERE id = $1", [application.id]);
    await removeStoredObject(key);
    return Response.json({ ok: true });
  }
  const column = application.office_images.some((asset) => asset.key === key) ? "office_images" : application.official_documents.some((asset) => asset.key === key) ? "official_documents" : "";
  if (!column) return Response.json({ error: "Asset not found." }, { status: 404 });
  await query(`UPDATE supplier_applications SET ${column} = COALESCE((SELECT jsonb_agg(entry) FROM jsonb_array_elements(${column}) entry WHERE entry->>'key' <> $1), '[]'::jsonb), status = 'pending', reviewed_at = NULL WHERE id = $2`, [key, application.id]);
  await removeStoredObject(key);
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  const url = new URL(request.url); const key = url.searchParams.get("key") || ""; const publicView = url.searchParams.get("public") === "1";
  if (!key.startsWith("company-submissions/")) return Response.json({ error: "Asset not found." }, { status: 404 });
  const publicSource = `SELECT entry->>'contentType' AS content_type, applications.status, applications.user_id FROM supplier_applications applications CROSS JOIN LATERAL jsonb_array_elements(applications.office_images) entry WHERE entry->>'key' = $1 UNION ALL SELECT company_logo->>'contentType', status, user_id FROM supplier_applications WHERE company_logo->>'key' = $1`;
  const source = publicView
    ? `${publicSource} LIMIT 1`
    : `${publicSource} UNION ALL SELECT entry->>'contentType', applications.status, applications.user_id FROM supplier_applications applications CROSS JOIN LATERAL jsonb_array_elements(applications.official_documents) entry WHERE entry->>'key' = $1 LIMIT 1`;
  const owner = (await query<{ content_type: string; status: string; user_id: string }>(source, [key])).rows[0];
  const extension = key.split(".").pop()?.toLowerCase();
  const inferredType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  if (publicView) {
    // A file replaced during review is no longer on the application but may still back the approved listing.
    const visible = owner?.status === "approved" || await usedByLiveListing(key);
    if (!visible) return Response.json({ error: "Asset not found." }, { status: 404 });
  } else {
    if (!owner) return Response.json({ error: "Asset not found." }, { status: 404 });
    const user = await getUser(); if (!user || (user.id !== owner.user_id && user.role !== "admin")) return Response.json({ error: "Access denied." }, { status: 403 });
  }
  const data = await readCompanyAsset(key);
  return new Response(new Uint8Array(data), { headers: { "Content-Type": owner?.content_type || inferredType, "Cache-Control": publicView ? "public, max-age=3600" : "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
