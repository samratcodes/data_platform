import "server-only";

import { randomUUID } from "node:crypto";
import { query } from "@/lib/db/client";
import { isCompanyFocus } from "@/lib/company-focus";
import { cleanMultiline, cleanSingleLine, safeHttpsUrl } from "@/lib/security";
import { businessEmailMessage, isBusinessEmail } from "@/lib/validation/email";

/*
 * Incomplete listings an administrator adds from the Data companies page: a logo, the company's
 * email, and a place on the map put a grey pin up. The email reserves the listing for the company,
 * which claims it by registering with that address and completes the rest of its profile.
 */

export const LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_LOGO_BYTES = 5_000_000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type ListingFields = {
  name: string; email: string; focus: "collection" | "devices"; city: string; country: string;
  longitude: number; latitude: number; description: string; website: string | null; mapsUrl: string | null;
};

/** Reads and checks the listing form; returns the first problem to show, or the clean fields. */
export function parseListingForm(form: FormData): { fields: ListingFields; error?: never } | { fields?: never; error: string } {
  const text = (name: string, max: number) => cleanSingleLine(form.get(name), max);
  const name = text("name", 120);
  const email = text("email", 200).toLowerCase();
  const city = text("city", 100);
  const country = text("country", 100);
  const longitude = Number(form.get("longitude"));
  const latitude = Number(form.get("latitude"));
  const websiteInput = text("websiteUrl", 400);
  const website = websiteInput ? safeHttpsUrl(websiteInput) : null;
  const mapsInput = text("mapsUrl", 1_000);
  if (!emailPattern.test(email)) return { error: "Enter the company's email address." };
  if (!isBusinessEmail(email)) return { error: `${businessEmailMessage} The company registers with this address to claim the listing.` };
  if (name.length < 2) return { error: "Enter a company name with at least 2 characters." };
  if (city.length < 2 || country.length < 2 || !form.get("longitude") || !form.get("latitude") || !Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return { error: "Place the company on the map and confirm its city and country." };
  if (websiteInput && !website) return { error: "Enter the website as a public https:// address, or leave it empty." };
  return { fields: {
    name, email, city, country, longitude, latitude, website,
    focus: isCompanyFocus(form.get("focus")) ? form.get("focus") as ListingFields["focus"] : "collection",
    description: cleanMultiline(form.get("description"), 3_000),
    mapsUrl: mapsInput ? safeHttpsUrl(mapsInput) : null,
  } };
}

/** A logo upload is valid when it is a small JPG, PNG, or WebP image. */
export const validLogo = (logo: FormDataEntryValue | null): logo is File => logo instanceof File && LOGO_TYPES.has(logo.type) && logo.size > 0 && logo.size <= MAX_LOGO_BYTES;

/**
 * Why this email cannot be reserved for a new listing, or null when it can: another grey listing
 * already waits for it, or the company behind it is already on the map.
 */
export async function claimEmailConflict(email: string, exceptSlug?: string) {
  const reserved = (await query<{ name: string }>(`
    SELECT name FROM providers WHERE owner_id IS NULL AND LOWER(claim_email) = $1 AND ($2::text IS NULL OR slug <> $2) LIMIT 1
  `, [email, exceptSlug ?? null])).rows[0];
  if (reserved) return `${reserved.name} is already waiting to be claimed by ${email}.`;
  const listed = (await query<{ name: string }>(`
    SELECT providers.name FROM users
    JOIN providers ON providers.owner_id = users.id AND providers.provider_type IN ('Data Company', 'Device Supplier')
    WHERE LOWER(users.email) = $1 LIMIT 1
  `, [email])).rows[0];
  if (listed) return `${email} already belongs to ${listed.name}, which is on the map. Edit that company from its review page instead.`;
  return null;
}

/**
 * When the company already registered and submitted its profile, hand the new pin to it now,
 * since claiming otherwise only happens when a company submits. Returns the owner's email if claimed.
 */
export async function claimForExistingCompany(slug: string, email: string) {
  const company = (await query<{ user_id: string; id: string }>(`
    SELECT applications.user_id, applications.id FROM supplier_applications applications
    JOIN users ON users.id = applications.user_id
    WHERE LOWER(users.email) = $1 AND applications.application_kind = 'company' AND applications.provider_slug IS NULL
    ORDER BY applications.submitted_at DESC LIMIT 1
  `, [email])).rows[0];
  if (!company) return null;
  await query("UPDATE providers SET owner_id = $1, updated_at = NOW() WHERE slug = $2 AND owner_id IS NULL", [company.user_id, slug]);
  await query("UPDATE supplier_applications SET provider_slug = $1 WHERE id = $2 AND provider_slug IS NULL", [slug, company.id]);
  return email;
}

/**
 * Stored instead of a password hash for accounts an admin's listing created. It never verifies,
 * so the company signs in by choosing a password through "Forgot password", which also proves the email.
 */
export const INVITED_PASSWORD = "!invited";

/**
 * Gives the listing an owner account for its email: the company's existing account (claiming its
 * submitted profile, if any), or a new supplier account it activates through "Forgot password".
 * An existing buyer account becomes the company account; an admin account is left alone and the email stays reserved.
 */
export async function attachCompanyAccount(slug: string, email: string, name: string): Promise<"claimed" | "linked" | "invited" | "reserved"> {
  if (await claimForExistingCompany(slug, email)) return "claimed";
  const existing = (await query<{ id: string; role: string; verified: boolean }>("SELECT id, role, email_verified_at IS NOT NULL AS verified FROM users WHERE LOWER(email) = $1", [email])).rows[0];
  if (existing) {
    // An unverified account might not belong to the company; it claims the listing once it verifies the email.
    if (existing.role === "admin" || !existing.verified) return "reserved";
    // The admin named this email as the company's, so a buyer account with it becomes the company account.
    if (existing.role === "buyer") await query("UPDATE users SET role = 'supplier' WHERE id = $1", [existing.id]);
    await query("UPDATE providers SET owner_id = $1, updated_at = NOW() WHERE slug = $2 AND owner_id IS NULL", [existing.id, slug]);
    return "linked";
  }
  const id = randomUUID();
  await query("INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'supplier')", [id, name.slice(0, 120), email, INVITED_PASSWORD]);
  await query("UPDATE providers SET owner_id = $1, updated_at = NOW() WHERE slug = $2 AND owner_id IS NULL", [id, slug]);
  return "invited";
}

/** Deletes an account an admin's listing created if the company never signed in to it. */
export async function removeInvitedAccount(userId: string | null) {
  if (userId) await query("DELETE FROM users WHERE id = $1 AND password_hash = $2", [userId, INVITED_PASSWORD]);
}

/**
 * When someone verifies, resets the password of, or logs in with an email an admin reserved for a grey listing, that account
 * becomes the company's: a buyer account turns into a company account, owns the listing, and any
 * company profile it already submitted is linked to the same pin. Returns the account's role afterwards.
 */
export async function claimReservedListing(user: { id: string; email: string; role: string }) {
  if (user.role === "admin") return user.role;
  // Only an inbox owner can claim: an account whose email is not verified yet waits until it is.
  const verified = (await query<{ verified: boolean }>("SELECT email_verified_at IS NOT NULL AS verified FROM users WHERE id = $1", [user.id])).rows[0]?.verified;
  if (!verified) return user.role;
  const listing = (await query<{ slug: string }>(`
    SELECT slug FROM providers
    WHERE owner_id IS NULL AND LOWER(claim_email) = LOWER($1) AND verification_level = 'incomplete'
      AND provider_type IN ('Data Company', 'Device Supplier')
      AND NOT EXISTS (SELECT 1 FROM supplier_applications WHERE provider_slug = providers.slug)
    ORDER BY created_at ASC LIMIT 1
  `, [user.email])).rows[0];
  if (!listing) return user.role;
  if (user.role !== "supplier") await query("UPDATE users SET role = 'supplier' WHERE id = $1 AND role = 'buyer'", [user.id]);
  await query("UPDATE providers SET owner_id = $1, updated_at = NOW() WHERE slug = $2 AND owner_id IS NULL", [user.id, listing.slug]);
  const application = (await query<{ id: string }>("SELECT id FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company' AND provider_slug IS NULL ORDER BY submitted_at DESC LIMIT 1", [user.id])).rows[0];
  if (application) await query("UPDATE supplier_applications SET provider_slug = $1 WHERE id = $2 AND provider_slug IS NULL", [listing.slug, application.id]);
  return "supplier";
}
