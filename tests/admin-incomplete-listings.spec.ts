import { test, expect, type Page } from "@playwright/test";
import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { query } from "../lib/db/client";

const headers = { Origin: "http://localhost:3000", "Sec-Fetch-Site": "same-origin" };
// A 1×1 PNG, enough to pass the logo checks.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

async function signIn(page: Page, role: "admin" | "supplier", email: string) {
  const id = randomUUID();
  const token = randomBytes(32).toString("hex");
  await query("INSERT INTO users (id, name, email, password_hash, role, email_verified_at) VALUES ($1, 'Listing Tester', $2, 'test-only', $3, NOW())", [id, email, role]);
  await query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [createHash("sha256").update(token).digest("hex"), id, Date.now() + 3_600_000]);
  await page.context().addCookies([{ name: "filemarket_session", value: token, url: "http://localhost:3000" }]);
  return id;
}

/** The app's password hash format (lib/auth/password-hash.ts is server-only). */
const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$32768$8$1$${salt}$${scryptSync(password, salt, 64, { cost: 32_768, blockSize: 8, parallelization: 1, maxmem: 64 * 1024 * 1024 }).toString("hex")}`;
};

const brandImage = (name: string) => ({ name, mimeType: "image/png", buffer: readFileSync("public/brand-logo.png") });

const listingForm = (fields: Record<string, string>, logo = true) => ({
  ...(logo ? { logo: { name: "logo.png", mimeType: "image/png", buffer: png } } : {}),
  name: "Acme Capture", focus: "collection", city: "Kathmandu", country: "Nepal", longitude: "85.32", latitude: "27.71", description: "", websiteUrl: "", mapsUrl: "",
  ...fields,
});

test("admins add, edit, and remove grey company listings from the Data companies page", async ({ page }) => {
  // The first visit compiles several admin routes in development.
  test.setTimeout(300000);
  const stamp = Date.now();
  const adminId = await signIn(page, "admin", `admin-${stamp}@filemarket-test.dev`);
  const email = `founder@acme-${stamp}.dev`;
  const slugs: string[] = [];
  try {
    // Logo, email, and location are required; personal mailboxes can never claim, so they are refused.
    expect((await page.request.post("/api/admin/listings", { headers, multipart: listingForm({ email }, false) })).status()).toBe(400);
    expect((await page.request.post("/api/admin/listings", { headers, multipart: listingForm({ email: "" }) })).status()).toBe(400);
    expect((await page.request.post("/api/admin/listings", { headers, multipart: listingForm({ email: "someone@gmail.com" }) })).status()).toBe(400);
    expect((await page.request.post("/api/admin/listings", { headers, multipart: listingForm({ email, longitude: "" }) })).status()).toBe(400);

    const created = await page.request.post("/api/admin/listings", { headers, multipart: listingForm({ email }) });
    expect(created.status()).toBe(201);
    const { slug } = await created.json() as { slug: string };
    slugs.push(slug);
    const row = (await query<{ verification_level: string; claim_email: string; owner_role: string; password_hash: string }>("SELECT providers.verification_level, providers.claim_email, users.role AS owner_role, users.password_hash FROM providers JOIN users ON users.id = providers.owner_id WHERE providers.slug = $1", [slug])).rows[0];
    // The listing gets a company account the company activates through "Forgot password".
    expect(row).toMatchObject({ verification_level: "incomplete", claim_email: email, owner_role: "supplier", password_hash: "!invited" });

    // One email reserves one listing.
    expect((await page.request.post("/api/admin/listings", { headers, multipart: listingForm({ email, name: "Acme Again" }) })).status()).toBe(409);

    // Admins can add the other details later, without re-uploading the logo.
    const edited = await page.request.patch("/api/admin/listings", { headers, multipart: listingForm({ slug, email, name: "Acme Capture Labs", description: "Egocentric capture in Kathmandu.", websiteUrl: "https://acme.example.com", focus: "devices" }, false) });
    expect(edited.status()).toBe(200);
    const after = (await query<{ name: string; provider_type: string; description: string; logo: string }>("SELECT name, provider_type, profile->>'description' AS description, profile->>'logo' AS logo FROM providers WHERE slug = $1", [slug])).rows[0];
    expect(after).toMatchObject({ name: "Acme Capture Labs", provider_type: "Device Supplier", description: "Egocentric capture in Kathmandu." });
    expect(after.logo).toContain("admin-listings");

    // Switching the focus to devices moved it to the Device companies section.
    await page.goto("/admin/device-companies");
    await expect(page.getByRole("heading", { name: "Device companies", level: 1 })).toBeVisible({ timeout: 60000 });
    await expect(page.locator(".admin-sections").getByRole("link", { name: "Incomplete" })).toHaveCount(0);
    await page.getByRole("link", { name: "Incomplete on map" }).click();
    await expect(page).toHaveURL(/view=incomplete/, { timeout: 60000 });
    const listed = page.locator(".incomplete-list > li", { hasText: "Acme Capture Labs" });
    await expect(listed).toContainText("Not signed in yet", { timeout: 60000 });
    await expect(listed).toContainText(email);
    await page.screenshot({ path: "test-results/admin-incomplete-list.png", fullPage: true });

    await listed.getByRole("link", { name: "Edit Acme Capture Labs" }).click();
    await expect(page.getByLabel("Company email")).toHaveValue(email, { timeout: 90000 });
    await expect(page.locator(".listing-preview-card")).toContainText("Acme Capture Labs");
    await page.screenshot({ path: "test-results/admin-incomplete-edit.png", fullPage: true });

    await page.goto("/admin/companies/new");
    await page.getByLabel("Company email").fill(`ops@bright-sensors-${stamp}.dev`);
    await expect(page.getByLabel("Company name")).toHaveValue("Bright Sensors " + stamp);
    await page.getByRole("button", { name: "Add to map as incomplete" }).click();
    await expect(page.getByText("Upload the company logo.")).toBeVisible();
    await page.screenshot({ path: "test-results/admin-incomplete-new.png", fullPage: true });

    await page.goto("/admin/incomplete");
    await expect(page).toHaveURL(/\/admin\/companies\?view=incomplete/);

    expect((await page.request.delete(`/api/admin/listings?slug=${slug}`, { headers })).status()).toBe(200);
    slugs.pop();
    // Removing the listing also removes the account nobody used.
    expect((await query("SELECT 1 FROM users WHERE email = $1", [email])).rowCount).toBe(0);
  } finally {
    for (const slug of slugs) await query("DELETE FROM providers WHERE slug = $1", [slug]);
    await query("DELETE FROM users WHERE email = $1", [email]);
    await query("DELETE FROM admin_audit_logs WHERE admin_user_id = $1", [adminId]);
    await query("DELETE FROM users WHERE id = $1", [adminId]);
  }
});

test("a company that already registered owns a listing the moment an admin adds it", async ({ page, browser }) => {
  const stamp = Date.now();
  const email = `owner@early-${stamp}.dev`;
  const companyPage = await (await browser.newContext()).newPage();
  const ownerId = await signIn(companyPage, "supplier", email);
  const applicationId = randomUUID();
  await query("INSERT INTO supplier_applications (id, user_id, application_kind, business_name, provider_type, modalities, hardware_pictures, profile_description) VALUES ($1, $2, 'company', 'Early Co', 'Data Company', '[]'::jsonb, '[]'::jsonb, '')", [applicationId, ownerId]);
  const adminId = await signIn(page, "admin", `admin2-${stamp}@filemarket-test.dev`);
  let slug = "";
  try {
    const created = await page.request.post("/api/admin/listings", { headers, multipart: listingForm({ email, name: "Early Co" }) });
    expect(created.status()).toBe(201);
    const body = await created.json() as { slug: string; account: string };
    slug = body.slug;
    expect(body).toMatchObject({ account: "claimed" });
    expect((await query<{ owner_id: string }>("SELECT owner_id FROM providers WHERE slug = $1", [slug])).rows[0].owner_id).toBe(ownerId);
    expect((await query<{ provider_slug: string }>("SELECT provider_slug FROM supplier_applications WHERE id = $1", [applicationId])).rows[0].provider_slug).toBe(slug);
  } finally {
    await query("UPDATE supplier_applications SET provider_slug = NULL WHERE id = $1", [applicationId]);
    if (slug) await query("DELETE FROM providers WHERE slug = $1", [slug]);
    await query("DELETE FROM supplier_applications WHERE id = $1", [applicationId]);
    await query("DELETE FROM admin_audit_logs WHERE admin_user_id = $1", [adminId]);
    await query("DELETE FROM users WHERE id = ANY($1)", [[adminId, ownerId]]);
  }
});

test("an admin-added company signs in, sees it is unverified, and completes a prefilled profile", async ({ page, browser }) => {
  test.setTimeout(300000);
  const stamp = Date.now();
  const email = `hello@northwind-${stamp}.dev`;
  const password = "Northwind!Capture2026";
  const adminId = await signIn(page, "admin", `admin3-${stamp}@filemarket-test.dev`);
  let slug = "";
  const context = await browser.newContext();
  const company = await context.newPage();
  try {
    const created = await page.request.post("/api/admin/listings", { headers, multipart: listingForm({ email, name: "Northwind Capture", websiteUrl: "https://northwind.example.com" }) });
    expect(created.status()).toBe(201);
    ({ slug } = await created.json() as { slug: string });

    // Invited accounts cannot sign in until the company sets a password.
    expect((await company.request.post("/api/auth/login", { headers, data: { email, password } })).status()).toBe(401);
    // What a completed "Forgot password" reset stores (the reset itself sends real email, so it is not called here).
    await query("UPDATE users SET password_hash = $1, email_verified_at = NOW() WHERE email = $2", [hashPassword(password), email]);
    expect((await company.request.post("/api/auth/login", { headers, data: { email, password } })).status()).toBe(200);

    await company.goto("/supplier");
    const bar = company.locator(".verification-bar");
    await expect(bar).toContainText("Clients see you as an unverified company", { timeout: 90000 });
    await company.screenshot({ path: "test-results/company-unverified-bar.png" });
    await bar.getByRole("link", { name: "Complete profile" }).click();
    await expect(company).toHaveURL(/\/onboarding/, { timeout: 60000 });
    await expect(company.locator(".listing-prefill-note")).toBeVisible({ timeout: 60000 });
    await expect(company.locator("input[value='Northwind Capture']").first()).toBeVisible();
    await company.screenshot({ path: "test-results/company-prefilled-profile.png" });

    // After submitting, the bar says the review is pending; once verified, it goes away.
    const owner = (await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email])).rows[0];
    await query("INSERT INTO supplier_applications (id, user_id, application_kind, business_name, provider_type, modalities, hardware_pictures, profile_description, provider_slug, status) VALUES ($1, $2, 'company', 'Northwind Capture', 'Data Company', '[]'::jsonb, '[]'::jsonb, '', $3, 'pending')", [randomUUID(), owner.id, slug]);
    await company.goto("/supplier");
    await expect(company.locator(".verification-bar")).toContainText("pending review", { timeout: 60000 });
    await query("UPDATE providers SET verification_level = 'online' WHERE slug = $1", [slug]);
    await company.reload();
    await expect(company.locator(".desk-header")).toBeVisible({ timeout: 60000 });
    await expect(company.locator(".verification-bar")).toHaveCount(0);
  } finally {
    await context.close();
    const owner = (await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email])).rows[0];
    if (owner) {
      await query("UPDATE supplier_applications SET provider_slug = NULL WHERE user_id = $1", [owner.id]);
      await query("DELETE FROM supplier_applications WHERE user_id = $1", [owner.id]);
    }
    if (slug) await query("DELETE FROM providers WHERE slug = $1", [slug]);
    if (owner) await query("DELETE FROM users WHERE id = $1", [owner.id]);
    await query("DELETE FROM admin_audit_logs WHERE admin_user_id = $1", [adminId]);
    await query("DELETE FROM users WHERE id = $1", [adminId]);
  }
});

test("device companies have their own admin section with applications, grey listings, and devices", async ({ page }) => {
  test.setTimeout(300000);
  const stamp = Date.now();
  const adminId = await signIn(page, "admin", `admin4-${stamp}@filemarket-test.dev`);
  const email = `sales@lensworks-${stamp}.dev`;
  let slug = "";
  try {
    const created = await page.request.post("/api/admin/listings", { headers, multipart: listingForm({ email, name: "Lensworks", focus: "devices" }) });
    expect(created.status()).toBe(201);
    ({ slug } = await created.json() as { slug: string });

    await page.goto("/admin/device-companies");
    await expect(page.getByRole("heading", { name: "Device companies", level: 1 })).toBeVisible({ timeout: 90000 });
    await expect(page.locator(".admin-sections").getByRole("link", { name: /Device companies/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Add device company" })).toHaveAttribute("href", "/admin/device-companies/new");
    await page.screenshot({ path: "test-results/admin-device-companies.png", fullPage: true });

    // Grey device listings show here, not under data companies.
    await page.getByRole("link", { name: "Incomplete on map" }).click();
    await expect(page.locator(".incomplete-list > li", { hasText: "Lensworks" })).toBeVisible({ timeout: 60000 });
    await page.goto("/admin/companies?view=incomplete");
    await expect(page.locator(".incomplete-card")).toBeVisible({ timeout: 60000 });
    await expect(page.locator(".incomplete-list > li", { hasText: "Lensworks" })).toHaveCount(0);

    await page.goto("/admin/device-companies?view=devices");
    await expect(page.locator(".admin-devices, .empty-state").first()).toBeVisible({ timeout: 60000 });
    await page.screenshot({ path: "test-results/admin-devices.png", fullPage: true });

    await page.goto("/admin/device-companies/new");
    await expect(page.getByRole("heading", { name: "Put a device company on the map" })).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole("button", { name: /Devices for data collection/ })).toHaveAttribute("aria-pressed", "true");
  } finally {
    if (slug) await page.request.delete(`/api/admin/listings?slug=${slug}`, { headers }).catch(() => undefined);
    await query("DELETE FROM providers WHERE slug = $1", [slug]);
    await query("DELETE FROM users WHERE email = $1", [email]);
    await query("DELETE FROM admin_audit_logs WHERE admin_user_id = $1", [adminId]);
    await query("DELETE FROM users WHERE id = $1", [adminId]);
  }
});

test("a buyer account with a reserved company email becomes that company's account at login", async ({ browser }) => {
  test.setTimeout(300000);
  const stamp = Date.now();
  const email = `info@reserved-${stamp}.dev`;
  const password = "Reserved!Company2026";
  const slug = `reserved-co-${stamp}`;
  const userId = randomUUID();
  // A listing an admin added before accounts were created for it: no owner, only a reserved email.
  await query(`INSERT INTO providers (owner_id, slug, name, city, country, longitude, latitude, provider_type, modalities, media, profile, verification_level, status, is_demo, claim_email)
    VALUES (NULL, $1, 'Reserved Co', 'Bharatpur', 'India', 77.49, 27.21, 'Data Company', '[]'::jsonb, '{}'::jsonb, '{"description":"","links":{}}'::jsonb, 'incomplete', 'approved', FALSE, $2)`, [slug, email]);
  await query("INSERT INTO users (id, name, email, password_hash, role, email_verified_at) VALUES ($1, 'Reserved Owner', $2, $3, 'buyer', NOW())", [userId, email, hashPassword(password)]);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const login = await page.request.post("/api/auth/login", { headers, data: { email, password } });
    expect(login.status()).toBe(200);
    expect((await login.json() as { user: { role: string } }).user.role).toBe("supplier");
    expect((await query<{ owner_id: string }>("SELECT owner_id FROM providers WHERE slug = $1", [slug])).rows[0].owner_id).toBe(userId);

    await page.goto("/supplier");
    await expect(page.locator(".verification-bar")).toContainText("Clients see you as an unverified company", { timeout: 90000 });
    const card = page.locator(".company-profile-card");
    await expect(card).toContainText("Reserved Co");
    await expect(card.getByRole("link", { name: "Complete profile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit profile" })).toBeVisible();
    await page.screenshot({ path: "test-results/company-dashboard-profile.png" });

    await page.goto("/settings");
    await expect(page.locator(".verification-bar")).toBeVisible({ timeout: 60000 });
    await expect(page.locator(".settings-company .listing-prefill-note")).toBeVisible({ timeout: 60000 });
    await expect(page.locator(".settings-company input[value='Reserved Co']").first()).toBeVisible();
    await page.screenshot({ path: "test-results/settings-company-profile.png", fullPage: true });

    // Submit the registration form from settings, the way a company completes its grey listing.
    const form = page.locator(".settings-company");
    await form.getByPlaceholder("What data do you provide, and how is it collected?").fill("We capture egocentric video of household and factory tasks for robotics teams.");
    await form.getByRole("button", { name: "Continue" }).click();
    await form.locator(".company-logo-picker input[type=file]").setInputFiles(brandImage("logo.png"));
    await form.locator(".office-image-picker input[type=file]").setInputFiles(brandImage("office.png"));
    await page.getByRole("button", { name: /OK.*keep 1 new image/ }).click();
    await form.locator(".official-document-picker input[type=file]").setInputFiles(brandImage("certificate.png"));
    await page.locator(".official-document-preview footer input").fill("Certificate of incorporation");
    await page.getByRole("button", { name: "Done" }).click();
    await form.getByRole("button", { name: "Continue" }).click();
    await form.getByRole("button", { name: /Egocentric video/ }).click();
    await form.getByRole("button", { name: "Continue" }).click();
    await form.getByPlaceholder("https://company.com").fill("https://reserved.example.com");
    await form.getByPlaceholder("Legal address on your registration document").fill("12 Market Road, Bharatpur");
    await form.getByPlaceholder("Added when you search or pin a location").fill("https://www.google.com/maps/search/?api=1&query=27.21,77.49");
    await form.getByRole("button", { name: "Continue" }).click();
    await form.getByRole("button", { name: "Request company verification" }).click();
    await expect(page.locator(".verification-bar")).toContainText("pending review", { timeout: 90000 });
    const application = (await query<{ status: string; provider_slug: string; logo: string | null; documents: number }>("SELECT status, provider_slug, company_logo->>'key' AS logo, jsonb_array_length(official_documents)::int AS documents FROM supplier_applications WHERE user_id = $1 AND application_kind = 'company'", [userId])).rows[0];
    expect(application).toMatchObject({ status: "pending", provider_slug: slug, documents: 1 });
    expect(application.logo).toBeTruthy();
    await page.screenshot({ path: "test-results/settings-company-submitted.png" });
  } finally {
    await context.close();
    await query("UPDATE supplier_applications SET provider_slug = NULL WHERE user_id = $1", [userId]);
    await query("DELETE FROM supplier_applications WHERE user_id = $1", [userId]);
    await query("DELETE FROM providers WHERE slug = $1", [slug]);
    await query("DELETE FROM users WHERE id = $1", [userId]);
  }
});

test("an unverified account cannot take over a reserved listing until it verifies the email", async ({ browser }) => {
  const stamp = Date.now();
  const email = `info@squat-${stamp}.dev`;
  const password = "Squatter!Account2026";
  const slug = `squat-co-${stamp}`;
  const userId = randomUUID();
  await query(`INSERT INTO providers (owner_id, slug, name, city, country, longitude, latitude, provider_type, modalities, media, profile, verification_level, status, is_demo, claim_email)
    VALUES (NULL, $1, 'Squat Co', 'Pune', 'India', 73.85, 18.52, 'Data Company', '[]'::jsonb, '{}'::jsonb, '{"description":"","links":{}}'::jsonb, 'incomplete', 'approved', FALSE, $2)`, [slug, email]);
  await query("INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, 'Unverified', $2, $3, 'buyer')", [userId, email, hashPassword(password)]);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const login = await page.request.post("/api/auth/login", { headers, data: { email, password } });
    expect((await login.json() as { user: { role: string } }).user.role).toBe("buyer");
    expect((await query<{ owner_id: string | null }>("SELECT owner_id FROM providers WHERE slug = $1", [slug])).rows[0].owner_id).toBeNull();
    // Verifying the inbox (here: the verified flag the email link sets) lets the next login claim it.
    await query("UPDATE users SET email_verified_at = NOW() WHERE id = $1", [userId]);
    const again = await page.request.post("/api/auth/login", { headers, data: { email, password } });
    expect((await again.json() as { user: { role: string } }).user.role).toBe("supplier");
    expect((await query<{ owner_id: string }>("SELECT owner_id FROM providers WHERE slug = $1", [slug])).rows[0].owner_id).toBe(userId);
  } finally {
    await context.close();
    await query("DELETE FROM providers WHERE slug = $1", [slug]);
    await query("DELETE FROM users WHERE id = $1", [userId]);
  }
});
