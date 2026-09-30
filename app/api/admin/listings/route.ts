import { randomUUID } from "node:crypto";
import { rateLimited } from "@/lib/auth/rate-limit";
import { query } from "@/lib/db/client";
import { deleteCompanyAsset, uploadCompanyAsset } from "@/lib/integrations/cloud-storage";
import { adminRequired, adminUser, privateJson } from "@/lib/admin/queries";
import { attachCompanyAccount, claimEmailConflict, INVITED_PASSWORD, parseListingForm, removeInvitedAccount, validLogo, type ListingFields } from "@/lib/admin/incomplete";
import { isSlug } from "@/lib/security";
import type { IncompleteListing, IncompleteListingDetail } from "@/types/admin";

export const runtime = "nodejs";

const safeName = (value: string) => value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "logo";
const publicAssetUrl = (key: string) => `/api/company-assets?public=1&key=${encodeURIComponent(key)}`;
const assetKey = (url: string | null) => url ? new URL(url, "http://local").searchParams.get("key") : null;
const audit = (adminId: string, action: string, slug: string, metadata: Record<string, unknown>) => query(`
  INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, metadata)
  VALUES ($1, $2, $3, 'provider', $4, $5::jsonb)
`, [randomUUID(), adminId, action, slug, JSON.stringify(metadata)]);
const outcomeNote: Record<Awaited<ReturnType<typeof attachCompanyAccount>>, string> = {
  invited: "created an account the company activates with Forgot password",
  linked: "linked it to the company's existing account",
  claimed: "the company had already submitted its profile and now owns it",
  reserved: "the email belongs to an admin or unverified account, so it stays reserved until that email is verified",
};

// A grey listing an admin manages: added here, and the company has not submitted its own profile for it yet.
const managed = `providers.verification_level = 'incomplete' AND providers.provider_type IN ('Data Company', 'Device Supplier')
  AND NOT EXISTS (SELECT 1 FROM supplier_applications WHERE provider_slug = providers.slug)`;
// Whether the owner account has set a password and signed in; its email is then theirs, not the admin's.
const activated = `COALESCE(owner.password_hash <> '${INVITED_PASSWORD}', FALSE)`;

type Current = { owner_id: string | null; owner_activated: boolean; claim_email: string | null; logo: string | null; profile: Record<string, unknown> };
const currentListing = async (slug: string) => (await query<Current>(`
  SELECT providers.owner_id, ${activated} AS owner_activated, providers.claim_email, providers.profile->>'logo' AS logo, providers.profile
  FROM providers LEFT JOIN users owner ON owner.id = providers.owner_id
  WHERE providers.slug = $1 AND ${managed}
`, [slug])).rows[0];
const gone = () => Response.json({ error: "This company has submitted its own profile. Edit it from its review page instead." }, { status: 404 });

async function storeLogo(listingId: string, logo: File) {
  const key = `company-submissions/admin-listings/${listingId}/logo/${randomUUID()}-${safeName(logo.name)}`;
  await uploadCompanyAsset(key, Buffer.from(await logo.arrayBuffer()), logo.type);
  return key;
}

/** The provider columns built from the form; the profile keeps anything else already stored. */
const listingValues = (fields: ListingFields, logoUrl: string) => {
  const isStore = fields.focus === "devices";
  return {
    providerType: isStore ? "Device Supplier" : "Data Company",
    media: { src: logoUrl, alt: `${fields.name} logo`, kind: "image", label: isStore ? "Device store" : "Company logo" },
    profile: { description: fields.description, logo: logoUrl, logoIsPhoto: false, publicExactLocation: true, links: { website: fields.website, maps: fields.mapsUrl } },
  };
};

/**
 * Every incomplete company listing: ones an admin added and self-registered ones published as incomplete.
 * With `?slug=`, one listing an admin manages, with everything its edit form needs.
 */
export async function GET(request: Request) {
  if (!await adminUser()) return adminRequired();
  const slug = new URL(request.url).searchParams.get("slug");
  if (slug !== null) {
    if (!isSlug(slug)) return Response.json({ error: "Listing not found." }, { status: 404 });
    const listing = (await query<IncompleteListingDetail>(`
      SELECT providers.slug, providers.name, providers.city, providers.country, providers.longitude, providers.latitude, providers.provider_type,
             COALESCE(owner.email, providers.claim_email) AS claim_email, ${activated} AS owner_activated,
             providers.profile->>'logo' AS logo, COALESCE(providers.profile->>'description', '') AS description,
             COALESCE(providers.profile->'links'->>'website', '') AS website, COALESCE(providers.profile->'links'->>'maps', '') AS maps_url
      FROM providers LEFT JOIN users owner ON owner.id = providers.owner_id
      WHERE providers.slug = $1 AND ${managed}
    `, [slug])).rows[0];
    if (!listing) return gone();
    return privateJson({ listing });
  }
  // `?type=devices` or `?type=collection` keeps the list to device companies or data companies.
  const type = new URL(request.url).searchParams.get("type");
  const providerType = type === "devices" ? "Device Supplier" : type === "collection" ? "Data Company" : null;
  const result = await query<IncompleteListing>(`
    SELECT providers.slug, providers.name, providers.city, providers.country, providers.provider_type,
           providers.profile->>'logo' AS logo, providers.claim_email, providers.created_at,
           owner.email AS owner_email, ${activated} AS owner_activated,
           applications.id AS application_id, applications.status AS application_status
    FROM providers
    LEFT JOIN users owner ON owner.id = providers.owner_id
    LEFT JOIN LATERAL (
      SELECT id, status FROM supplier_applications
      WHERE supplier_applications.provider_slug = providers.slug
      ORDER BY submitted_at DESC LIMIT 1
    ) applications ON TRUE
    WHERE providers.verification_level = 'incomplete' AND providers.status = 'approved' AND providers.is_demo = FALSE
      AND providers.provider_type IN ('Data Company', 'Device Supplier') AND ($1::text IS NULL OR providers.provider_type = $1)
    ORDER BY providers.created_at DESC
  `, [providerType]);
  return privateJson({ listings: result.rows });
}

/**
 * Puts a company on the map as a grey, incomplete listing from its logo, email, and location,
 * and gives it an account for that email so the company can sign in and complete its profile.
 */
export async function POST(request: Request) {
  const admin = await adminUser();
  if (!admin) return adminRequired();
  if (await rateLimited(`admin-listings:${admin.id}`, 60, 60 * 60_000)) return Response.json({ error: "Listing limit reached. Try again shortly." }, { status: 429 });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 6_000_000) return Response.json({ error: "The logo must be 5 MB or smaller." }, { status: 413 });
  const form = await request.formData();
  const logo = form.get("logo");
  if (!validLogo(logo)) return Response.json({ error: "Upload a JPG, PNG, or WebP logo no larger than 5 MB." }, { status: 400 });
  const parsed = parseListingForm(form);
  if (!parsed.fields) return Response.json({ error: parsed.error }, { status: 400 });
  const { fields } = parsed;
  const conflict = await claimEmailConflict(fields.email);
  if (conflict) return Response.json({ error: conflict }, { status: 409 });

  const id = randomUUID();
  const base = fields.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "company";
  const slug = `${base}-${id.slice(0, 6)}`;
  const key = await storeLogo(id, logo);
  const values = listingValues(fields, publicAssetUrl(key));
  const profile = { dataStreams: [], established: "", capacity: "Contact provider", captureEnvironments: [], photos: [], ...values.profile };
  try {
    await query(`
      INSERT INTO providers (owner_id, slug, name, city, country, longitude, latitude, provider_type, modalities, media, profile, verification_level, status, is_demo, claim_email)
      VALUES (NULL,$1,$2,$3,$4,$5,$6,$7,'[]'::jsonb,$8::jsonb,$9::jsonb,'incomplete','approved',FALSE,$10)
    `, [slug, fields.name, fields.city, fields.country, fields.longitude, fields.latitude, values.providerType, JSON.stringify(values.media), JSON.stringify(profile), fields.email]);
  } catch (error) {
    await deleteCompanyAsset(key).catch(() => undefined);
    throw error;
  }
  const account = await attachCompanyAccount(slug, fields.email, fields.name);
  await audit(admin.id, "listing.created", slug, { name: fields.name, claimEmail: fields.email, notes: `Added ${fields.name} as an incomplete listing for ${fields.email}; ${outcomeNote[account]}.` });
  return Response.json({ slug, account }, { status: 201 });
}

/** Edits a listing an admin manages: any field and optionally a new logo; the email only until the company signs in. */
export async function PATCH(request: Request) {
  const admin = await adminUser();
  if (!admin) return adminRequired();
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 6_000_000) return Response.json({ error: "The logo must be 5 MB or smaller." }, { status: 413 });
  const form = await request.formData();
  const slug = form.get("slug");
  if (!isSlug(slug)) return Response.json({ error: "Listing not found." }, { status: 404 });
  const current = await currentListing(slug);
  if (!current) return gone();
  const logo = form.get("logo");
  if (logo !== null && !validLogo(logo)) return Response.json({ error: "Upload a JPG, PNG, or WebP logo no larger than 5 MB." }, { status: 400 });
  const parsed = parseListingForm(form);
  if (!parsed.fields) return Response.json({ error: parsed.error }, { status: 400 });
  const { fields } = parsed;
  const ownerEmail = current.owner_id ? (await query<{ email: string }>("SELECT email FROM users WHERE id = $1", [current.owner_id])).rows[0]?.email.toLowerCase() : null;
  const previousEmail = ownerEmail ?? current.claim_email?.toLowerCase() ?? "";
  const emailChanged = fields.email !== previousEmail;
  if (emailChanged && current.owner_activated) return Response.json({ error: `The company already signs in as ${previousEmail}, so its email can no longer be changed here.` }, { status: 409 });
  if (emailChanged) {
    const conflict = await claimEmailConflict(fields.email, slug);
    if (conflict) return Response.json({ error: conflict }, { status: 409 });
  }

  const newKey = logo ? await storeLogo(randomUUID(), logo) : null;
  const logoUrl = newKey ? publicAssetUrl(newKey) : current.logo ?? "/brand-logo.png";
  const values = listingValues(fields, logoUrl);
  const profile = { ...current.profile, ...values.profile, links: { ...(current.profile.links as object ?? {}), ...values.profile.links } };
  try {
    await query(`
      UPDATE providers SET name = $2, city = $3, country = $4, longitude = $5, latitude = $6, provider_type = $7,
        media = $8::jsonb, profile = $9::jsonb, claim_email = $10, owner_id = CASE WHEN $11::boolean THEN NULL ELSE owner_id END, updated_at = NOW()
      WHERE slug = $1 AND ${managed}
    `, [slug, fields.name, fields.city, fields.country, fields.longitude, fields.latitude, values.providerType, JSON.stringify(values.media), JSON.stringify(profile), fields.email, emailChanged]);
  } catch (error) {
    if (newKey) await deleteCompanyAsset(newKey).catch(() => undefined);
    throw error;
  }
  const oldKey = assetKey(current.logo);
  if (newKey && oldKey?.startsWith("company-submissions/admin-listings/")) await deleteCompanyAsset(oldKey).catch(() => undefined);
  // A new email moves the listing to that company's account; the unused invitation for the old one goes.
  let note = `Edited the incomplete listing ${fields.name}.`;
  if (emailChanged) {
    await removeInvitedAccount(current.owner_id);
    note = `Edited ${fields.name} and changed its email to ${fields.email}; ${outcomeNote[await attachCompanyAccount(slug, fields.email, fields.name)]}.`;
  }
  await audit(admin.id, "listing.edited", slug, { name: fields.name, claimEmail: fields.email, notes: note });
  return Response.json({ ok: true });
}

/** Removes a listing an admin added, with its account if the company never signed in. */
export async function DELETE(request: Request) {
  const admin = await adminUser();
  if (!admin) return adminRequired();
  const slug = new URL(request.url).searchParams.get("slug");
  if (!isSlug(slug)) return Response.json({ error: "Listing not found." }, { status: 404 });
  const current = await currentListing(slug);
  if (!current) return gone();
  if (current.owner_activated) return Response.json({ error: "The company has signed in to this listing, so it can't be removed here." }, { status: 409 });
  const removed = (await query<{ name: string; logo: string | null }>(`
    DELETE FROM providers WHERE slug = $1 AND ${managed}
    RETURNING name, profile->>'logo' AS logo
  `, [slug])).rows[0];
  if (!removed) return gone();
  await removeInvitedAccount(current.owner_id);
  const key = assetKey(removed.logo);
  if (key?.startsWith("company-submissions/admin-listings/")) await deleteCompanyAsset(key).catch(() => undefined);
  await audit(admin.id, "listing.removed", slug, { name: removed.name, notes: `Removed the incomplete listing ${removed.name}.` });
  return Response.json({ ok: true });
}
