import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { query } from "@/lib/db/client";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./cookie";
import type { UserRole } from "./roles";
import { isCompanyFocus, type CompanyFocus } from "@/lib/company-focus";
import type { CompanyStanding } from "@/types/app";

/**
 * `companyFocus` is set for suppliers with a company application or a listing an admin added for them:
 * it decides facilities versus a device store. `companyStanding` is null for everyone but suppliers.
 */
export type SessionUser = { id: string; name: string; email: string; role: UserRole; emailVerifiedAt: string | null; companyLogo: string | null; companyFocus: CompanyFocus | null; companyStanding: CompanyStanding | null; companyName: string | null };

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** The signed-in user, or null. Cached so one request never looks the session up twice. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await query<Omit<SessionUser, "companyLogo" | "companyFocus" | "companyStanding" | "companyName"> & { logoKey: string | null; logoPublic: boolean | null; focus: string | null; status: string | null; level: string | null; listingType: string | null; businessName: string | null; listingName: string | null; listingLogo: string | null }>(`
    SELECT users.id, users.name, users.email, users.role, users.email_verified_at AS "emailVerifiedAt", company.logo_key AS "logoKey", company.approved AS "logoPublic",
           company.company_focus AS focus, company.status, company.business_name AS "businessName", listing.verification_level AS level, listing.provider_type AS "listingType",
           listing.name AS "listingName", listing.logo AS "listingLogo"
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    LEFT JOIN LATERAL (
      SELECT company_logo->>'key' AS logo_key, status = 'approved' AS approved, company_focus, status, business_name FROM supplier_applications
      WHERE user_id = users.id AND application_kind = 'company'
      ORDER BY submitted_at DESC LIMIT 1
    ) company ON users.role = 'supplier'
    LEFT JOIN LATERAL (
      SELECT verification_level, provider_type, name, profile->>'logo' AS logo FROM providers
      WHERE owner_id = users.id AND provider_type IN ('Data Company', 'Device Supplier')
      ORDER BY created_at ASC LIMIT 1
    ) listing ON users.role = 'supplier'
    WHERE token_hash = $1 AND expires_at > $2`, [digest(token), Date.now()]);
  const row = result.rows[0];
  if (!row) return null;
  const { logoKey, logoPublic, focus, status, level, listingType, businessName, listingName, listingLogo, ...user } = row;
  // A listing an admin added decides the focus until the company submits its own profile.
  const companyFocus = isCompanyFocus(focus) ? focus : listingType === "Device Supplier" ? "devices" : listingType ? "collection" : null;
  // Clients see the live listing: once it is verified online or physically, later edits under review do not undo that.
  // An approved profile published as "incomplete" is still unverified.
  const companyStanding: CompanyStanding | null = user.role !== "supplier" ? null
    : level === "online" || level === "physical" ? "verified"
      : status === "pending" ? "pending" : status === "rejected" ? "rejected" : "unverified";
  // An approved logo is public, so it can be resized and cached instead of re-downloading the original.
  // Until the company submits its own profile, the grey listing an admin added supplies its name and logo.
  const companyLogo = logoKey ? `/api/company-assets?${logoPublic ? "public=1&" : ""}key=${encodeURIComponent(logoKey)}` : listingLogo?.startsWith("/api/company-assets?public=1&") ? listingLogo : null;
  return { ...user, companyLogo, companyFocus, companyStanding, companyName: businessName || listingName || null };
});

export function isEmailVerified(user: SessionUser) {
  return user.role === "admin" || Boolean(user.emailVerifiedAt);
}

export function emailVerificationRequired() {
  return Response.json({ error: "Verify your email before using this feature." }, { status: 403 });
}

export async function createSession(userId: string) {
  const store = await cookies();
  const previous = store.get(SESSION_COOKIE)?.value;
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await query(`
    WITH expired AS (
      DELETE FROM sessions WHERE expires_at < $1
    ), previous_session AS (
      DELETE FROM sessions WHERE token_hash = $4
    )
    INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($2, $3, $5)
  `, [now, digest(token), userId, previous ? digest(previous) : "no-previous-session", now + SESSION_MAX_AGE_SECONDS * 1000]);
  store.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_SECONDS });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [digest(token)]);
  store.delete(SESSION_COOKIE);
}
