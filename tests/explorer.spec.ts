import { test, expect, type APIRequestContext } from "@playwright/test";
import { query } from "../lib/database";

const headers = { Origin: "http://localhost:3000", "Sec-Fetch-Site": "same-origin" };

async function latestEmailToken(email: string, purpose: "email_verification" | "password_reset") {
  const result = await query<{ body_text: string }>(
    "SELECT body_text FROM email_outbox WHERE recipient_email = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1",
    [email, purpose],
  );
  const link = result.rows[0]?.body_text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`No ${purpose} email found for ${email}`);
  const token = new URL(link).searchParams.get("token");
  if (!token) throw new Error(`No token found in ${purpose} email for ${email}`);
  return token;
}

async function verifyApiEmail(request: APIRequestContext, email: string) {
  const token = await latestEmailToken(email, "email_verification");
  const verified = await request.post("/api/auth/verify-email", { headers, data: { token } });
  expect(verified.status()).toBe(200);
}

test("public landing leads with the map and opens provider profiles", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".map-loading")).toHaveCount(0, { timeout: 30000 });
  await expect(page.locator(".map-sidebar input")).toHaveCount(0);
  await expect(page.locator(".world-map")).toHaveAttribute("data-projection", "globe");
  await expect(page.locator(".globe-video-preview.is-visible")).toHaveCount(1);
  const landingRail = page.locator(".public-navigation-rail");
  await expect(landingRail.getByRole("link", { name: "Register data company" })).toHaveAttribute("href", "/signup/data-company");
  await expect(landingRail.getByRole("link", { name: "About map.filemarket" })).toHaveCount(0);
  await expect(landingRail.getByRole("link", { name: "map.filemarket insights" })).toBeVisible();
  await expect(page.locator(".metrics-hud .metric-icon")).toHaveCount(3);
  for (const icon of await page.locator(".metrics-hud .metric-icon").all()) await expect(icon).toBeVisible();
  const canvasBox = await page.locator(".world-map canvas").boundingBox();
  expect(canvasBox!.y).toBe(0);
  expect(canvasBox!.height).toBe(900);
  await page.mouse.move(canvasBox!.x + 100, canvasBox!.y + 100);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + 160, canvasBox!.y + 100, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".world-map")).toHaveAttribute("data-projection", "mercator");
  const flatMapBox = await page.locator(".world-map-wrap").boundingBox();
  expect(flatMapBox!.y).toBe(0);
  expect(flatMapBox!.height).toBe(900);
  const mapBox = await page.locator(".landing-map-section").boundingBox();
  const textBox = await page.locator(".landing-intro").boundingBox();
  expect(textBox!.y).toBeGreaterThanOrEqual(mapBox!.y + mapBox!.height);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Reset map", exact: true }).click();
  await page.getByRole("button", { name: "Search and filter providers" }).click();
  await page.getByLabel("Country", { exact: true }).selectOption("Nepal");
  const matchingLocations = await page.locator(".map-company-list-scroll button").count();
  await expect(page.locator(".landing-match-count")).toHaveText(`${matchingLocations} ${matchingLocations === 1 ? "location" : "locations"}`);
  await expect(page.locator(".geo-media-pin")).toHaveCount(0);
  await expect(page.getByLabel("Map marker legend")).toBeVisible();
  await page.getByRole("button", { name: "Search and filter providers" }).click();
  await expect(page.locator(".landing-scroll-button")).toHaveCount(0);
  await page.locator("#trust-and-transparency").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: /Know who is behind every dataset/ })).toBeInViewport();
  await expect(page.getByText("Escrow-ready milestones", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/desktop-light-map.png" });
  expect(errors).toEqual([]);
});

test("signup, saved provider, sample downloads, requests, session persistence, and logout", async ({ page, request }) => {
  test.setTimeout(120000);
  const email = `test-${Date.now()}@example.test`;
  const password = "FileMarketTest!2026";
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Test Explorer");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await page.goto(`/verify-email/confirm?token=${await latestEmailToken(email, "email_verification")}`);
  await expect(page).toHaveURL(/\/map/);
  await expect(page.locator(".world-map")).toHaveAttribute("data-projection", "mercator");
  await expect(page.getByRole("button", { name: /Switch to/ })).toHaveCount(0);
  await expect(page.locator(".directory-panel")).toBeVisible();
  await page.getByRole("button", { name: "Search and filter providers" }).click();
  await page.getByRole("textbox", { name: "Search geography, companies, or facilities" }).fill("FileMarket.ai");
  await expect(page.locator(".provider-card")).toHaveCount(1);
  await page.locator(".provider-card").first().click();
  await expect(page.getByRole("button", { name: "Request access", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Minimize profile details" }).click();
  await expect(page.locator(".profile-panel")).toHaveCount(0);
  await page.locator(".profile-restore-tab").click();
  await expect(page.locator(".profile-panel")).toBeVisible();
  await page.getByRole("button", { name: "Save provider", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unsave provider", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Motion sample/ }).click();
  await expect(page.getByRole("dialog", { name: "Motion data sample" })).toBeVisible();
  await expect(page.locator(".full-sample")).toHaveJSProperty("paused", false);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Point cloud PLY/ }).click();
  await expect(page.getByRole("dialog", { name: "Point cloud preview" })).toBeVisible();
  await page.locator(".pointcloud-viewer canvas").focus();
  await page.keyboard.press("ArrowRight");
  const plyDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PLY" }).click();
  expect((await plyDownload).suggestedFilename()).toMatch(/demo\.ply$/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Request access", exact: true }).click();
  await page.getByLabel("Your use case").fill("Testing robotics perception with synthetic demonstration samples.");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("button", { name: "Access requested" })).toBeDisabled();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download sample metadata" }).click();
  expect((await download).suggestedFilename()).toMatch(/demo\.json$/);
  await page.screenshot({ path: "test-results/desktop-profile.png" });
  await page.reload();
  await page.getByRole("link", { name: "My workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator(".saved-grid > a")).toHaveCount(1);
  await expect(page.locator(".request-row")).toHaveCount(1);
  await page.screenshot({ path: "test-results/workspace.png" });
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Log in", exact: true })).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in to your workspace" }).click();
  await expect(page).toHaveURL(/\/map/);
  const forbidden = await request.post("/api/auth/login", { headers: { Origin: "https://untrusted.example" }, data: { email, password } });
  expect(forbidden.status()).toBe(403);
});

test("mobile landing exposes map controls and keeps text below the map", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".map-loading")).toHaveCount(0, { timeout: 30000 });
  const mobileMapBox = await page.locator(".world-map-wrap").boundingBox();
  expect(mobileMapBox!.y).toBe(0);
  expect(mobileMapBox!.height).toBe(844);
  await expect(page.locator(".metrics-hud .metric-icon")).toHaveCount(3);
  for (const icon of await page.locator(".metrics-hud .metric-icon").all()) await expect(icon).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator(".landing-filter-bar select")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Zoom in", exact: true })).toBeInViewport();
  await expect(page.getByRole("heading", { name: /Source real-world data/ })).not.toBeInViewport();
  await page.getByRole("button", { name: "Search and filter providers" }).click();
  await page.getByLabel("Country", { exact: true }).selectOption("Nepal");
  await expect(page.getByLabel("Map marker legend")).not.toBeVisible();
  await expect(page.locator(".geo-media-pin")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.screenshot({ path: "test-results/mobile-landing.png" });
});

test("mobile profile expands and keeps workspaces isolated", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Mobile Explorer");
  const email = `mobile-${Date.now()}@example.test`;
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("MobileTest!2026");
  await page.getByLabel("Confirm password").fill("MobileTest!2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await page.goto(`/verify-email/confirm?token=${await latestEmailToken(email, "email_verification")}`);
  await expect(page).toHaveURL(/\/map/);
  await page.getByRole("button", { name: "Search and filter providers" }).click();
  await page.getByRole("textbox", { name: "Search geography, companies, or facilities" }).fill("FileMarket.ai");
  await page.locator(".provider-card").first().click();
  const before = await page.locator(".profile-panel").boundingBox();
  await page.getByRole("button", { name: "Expand profile" }).click();
  await expect(page.getByRole("button", { name: "Collapse profile" })).toBeVisible();
  const after = await page.locator(".profile-panel").boundingBox();
  expect(after!.height).toBeGreaterThan(before!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Save provider", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unsave provider", exact: true })).toBeVisible();
  const other = await request.post("/api/auth/signup", { headers: { Origin: "http://localhost:3000" }, data: { name: "Other Tester", email: `other-${Date.now()}@example.test`, password: "OtherTest!2026" } });
  expect(other.status()).toBe(201);
  const workspace = await (await request.get("/api/workspace")).json();
  expect(workspace.saved).toEqual([]);
  expect(workspace.requests).toEqual([]);
});

test("account profile, password rotation, and global logout", async ({ request }) => {
  const email = `security-${Date.now()}@example.test`;
  const currentPassword = "AccountSecurity!2026";
  const nextPassword = "RotatedSecurity!2027";
  const signup = await request.post("/api/auth/signup", { headers, data: { name: "Security Tester", email, password: currentPassword, role: "buyer" } });
  expect(signup.status()).toBe(201);

  const profile = await request.patch("/api/account", { headers, data: { action: "profile", name: "Updated Security Tester" } });
  expect(profile.status()).toBe(200);
  expect((await profile.json()).user.name).toBe("Updated Security Tester");

  const password = await request.patch("/api/account", { headers, data: { action: "password", currentPassword, newPassword: nextPassword, confirmation: nextPassword } });
  expect(password.status()).toBe(200);

  const oldLogin = await request.post("/api/auth/login", { headers, data: { email, password: currentPassword } });
  expect(oldLogin.status()).toBe(401);
  const newLogin = await request.post("/api/auth/login", { headers, data: { email, password: nextPassword } });
  expect(newLogin.status()).toBe(200);

  const logoutAll = await request.patch("/api/account", { headers, data: { action: "logout-all" } });
  expect(logoutAll.status()).toBe(200);
  const session = await request.get("/api/auth/session");
  expect((await session.json()).user).toBeNull();
});

test("supplier application persists and buyer cannot access supplier APIs", async ({ request }) => {
  const supplierEmail = `supplier-${Date.now()}@filemarket-qa.test`;
  const supplierPassword = "SupplierWorkflow!2026";
  const signup = await request.post("/api/auth/signup", { headers, data: { name: "QA Supplier", email: supplierEmail, password: supplierPassword, role: "supplier" } });
  expect(signup.status()).toBe(201);
  await verifyApiEmail(request, supplierEmail);

  const application = await request.post("/api/supplier/application", { headers, data: {
    businessName: "QA Capture Facility",
    providerType: "Facility",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=27.7172,85.3240",
    physicalAddress: "Kathmandu Metropolitan City",
    city: "Kathmandu",
    country: "Nepal",
    longitude: 85.324,
    latitude: 27.7172,
    hardwarePictures: ["https://example.com/facility.jpg"],
    modalities: ["Images", "Egocentric video"],
    roboticsTypes: [],
  } });
  expect(application.status()).toBe(201);
  const dashboard = await request.get("/api/supplier/dashboard");
  expect(dashboard.status()).toBe(200);
  expect((await dashboard.json()).applications[0].business_name).toBe("QA Capture Facility");

  await request.post("/api/auth/logout", { headers, data: {} });
  const buyerSignup = await request.post("/api/auth/signup", { headers, data: { name: "Unauthorized Buyer", email: `buyer-${Date.now()}@example.test`, password: "BuyerBoundary!2026", role: "buyer" } });
  expect(buyerSignup.status()).toBe(201);
  const forbidden = await request.get("/api/supplier/dashboard");
  expect(forbidden.status()).toBe(403);
});

test("seeded administrator can access the verification workspace", async ({ request }) => {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  test.skip(!email || !password, "Administrator seed credentials are not configured.");
  const login = await request.post("/api/auth/login", { headers, data: { email, password } });
  expect(login.status()).toBe(200);
  const workspace = await request.get("/api/admin/applications");
  expect(workspace.status()).toBe(200);
  await request.post("/api/auth/logout", { headers, data: {} });
});
