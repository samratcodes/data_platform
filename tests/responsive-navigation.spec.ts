import { expect, test, type Page } from "@playwright/test";

const assertNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth, `horizontal overflow: ${JSON.stringify(overflow)}`).toBeLessThanOrEqual(overflow.clientWidth + 1);
};

test.describe("responsive navigation QA", () => {
  test("public rail expands over the map without reflowing it", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".map-loading")).toHaveCount(0, { timeout: 30_000 });

    const rail = page.locator(".public-navigation-rail");
    const map = page.locator(".landing-map-fixed");
    await expect(rail).toBeVisible();
    await expect(rail).toHaveCSS("width", "48px");
    const [railBox, logoBox, directoryBox, controlsBox, metricsBox] = await Promise.all([
      rail.boundingBox(),
      rail.locator(".brand img").boundingBox(),
      page.locator(".map-company-list").boundingBox(),
      page.locator(".landing-map-controls").boundingBox(),
      page.locator(".metrics-hud").boundingBox(),
    ]);
    expect(railBox).not.toBeNull();
    expect(logoBox).not.toBeNull();
    expect(directoryBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    expect(metricsBox).not.toBeNull();
    expect(logoBox!.x).toBeGreaterThanOrEqual(railBox!.x);
    expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(railBox!.x + railBox!.width);
    expect(controlsBox!.y).toBeGreaterThanOrEqual(directoryBox!.y + directoryBox!.height + 12);
    expect(Math.abs((controlsBox!.x + controlsBox!.width) - (directoryBox!.x + directoryBox!.width))).toBeLessThanOrEqual(2);
    expect(metricsBox!.x + metricsBox!.width).toBeLessThan(directoryBox!.x);

    const directoryToggle = page.getByRole("button", { name: "Minimize provider directory" });
    const toggleBoxOpen = await directoryToggle.boundingBox();
    await directoryToggle.click();
    await expect(page.locator(".map-company-list")).toHaveCount(0);
    const toggleBoxClosed = await page.getByRole("button", { name: "Open provider directory" }).boundingBox();
    const metricsBoxClosed = await page.locator(".metrics-hud").boundingBox();
    expect(toggleBoxClosed).toEqual(toggleBoxOpen);
    expect(metricsBoxClosed).toEqual(metricsBox);
    await page.getByRole("button", { name: "Open provider directory" }).click();
    await expect(page.locator(".map-company-list")).toBeVisible();

    const mapBoxBefore = await map.boundingBox();

    await rail.hover();
    await expect(rail).toHaveCSS("width", "216px");
    await expect(rail.getByText("Explore map", { exact: true })).toBeVisible();

    const mapBoxAfter = await map.boundingBox();
    expect(mapBoxBefore).not.toBeNull();
    expect(mapBoxAfter).not.toBeNull();
    expect(mapBoxAfter!.x).toBe(mapBoxBefore!.x);
    expect(mapBoxAfter!.width).toBe(mapBoxBefore!.width);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/qa-public-desktop.png", fullPage: true });
  });

  test("public mobile layout stays compact and overflow-free", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator(".map-loading")).toHaveCount(0, { timeout: 30_000 });

    const rail = page.locator(".public-navigation-rail");
    await expect(rail).toBeVisible();
    const railBox = await rail.boundingBox();
    expect(railBox).not.toBeNull();
    expect(railBox!.x).toBeGreaterThanOrEqual(8);
    expect(railBox!.x + railBox!.width).toBeLessThanOrEqual(382);
    await expect(rail.getByText("Explore map", { exact: true })).toBeHidden();
    const directoryBox = await page.locator(".map-company-list").boundingBox();
    const controlsBox = await page.locator(".landing-map-controls").boundingBox();
    expect(directoryBox).not.toBeNull();
    expect(controlsBox).not.toBeNull();
    expect(directoryBox!.height).toBeLessThanOrEqual(230);
    expect(directoryBox!.y).toBeGreaterThan(500);
    expect(controlsBox!.y + controlsBox!.height).toBeLessThanOrEqual(directoryBox!.y - 8);
    await expect(page.locator(".metrics-hud")).toHaveCSS("opacity", "1");
    await expect(page.locator(".metrics-hud .metric-card")).toHaveCount(3);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/qa-public-mobile.png", fullPage: true });
  });

  test("public supporting pages fit a narrow mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    for (const path of ["/login", "/signup/data-buyer", "/signup/data-company", "/forgot-password", "/blog"]) {
      await page.goto(path);
      await expect(page.locator("main:not(.system-loading)")).toBeVisible();
      await expect(page.locator(".public-navigation-rail").getByRole("link", { name: "Register data company" })).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }
  });

  test("public account links open the appropriate registration path", async ({ page }) => {
    await page.goto("/signup/data-company");
    await expect(page.getByRole("heading", { name: "Register your data company." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tell us about your company" })).toBeVisible();
    await expect(page.locator(".company-wizard-progress")).toBeVisible();
    await page.getByPlaceholder("Your company name").fill("Northstar Data");
    await page.getByPlaceholder("What data do you provide, and how is it collected?").fill("We collect high-quality real-world video and speech data for AI teams.");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Add office images and official documents" })).toBeVisible();
    await expect(page.locator(".office-image-picker")).toBeVisible();
    await expect(page.locator(".official-document-picker")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "What data can you provide?" })).toBeVisible();
    await page.getByRole("button", { name: /Egocentric video/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Where is your company located?" })).toBeVisible();

    await page.goto("/signup/data-buyer");
    await expect(page.getByRole("heading", { name: "Create your buyer account." })).toBeVisible();
    await expect(page.getByText("Data buyer account", { exact: true })).toBeVisible();
    await expect(page.locator('input[name="role"]')).toHaveValue("buyer");
  });

  test("admin rail expands and both approval pages remain responsive", async ({ page }) => {
    const email = process.env.ADMIN_SEED_EMAIL;
    const password = process.env.ADMIN_SEED_PASSWORD;
    test.skip(!email || !password, "Admin seed credentials are not configured.");

    await page.goto("/login");
    await page.getByLabel("Work email").fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Log in to your workspace" }).click();
    await page.waitForURL(/\/admin(?:\/companies)?$/, { timeout: 20_000 });
    await page.goto("/admin/companies");
    await expect(page.getByRole("heading", { name: "Data company approvals" })).toBeVisible();

    const rail = page.locator(".buyer-navigation-rail");
    const shell = page.locator(".admin-shell");
    await expect(rail).toHaveCSS("width", "48px");
    const shellBoxBefore = await shell.boundingBox();
    await rail.hover();
    await expect(rail).toHaveCSS("width", "216px");
    await expect(rail.getByText("Verification queue", { exact: true })).toBeVisible();
    const shellBoxAfter = await shell.boundingBox();
    expect(shellBoxBefore).not.toBeNull();
    expect(shellBoxAfter).not.toBeNull();
    expect(shellBoxAfter!.x).toBe(shellBoxBefore!.x);
    expect(shellBoxAfter!.width).toBe(shellBoxBefore!.width);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/qa-admin-desktop.png", fullPage: true });

    await page.getByRole("link", { name: "Facilities" }).click();
    await expect(page.getByRole("heading", { name: "Facility approvals" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Facility approvals" })).toBeVisible();
    await expect(page.locator(".buyer-navigation-rail")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/qa-admin-mobile.png", fullPage: true });

    await page.goto("/map");
    await expect(page.locator(".map-loading")).toHaveCount(0, { timeout: 30_000 });
    const mapDirectory = page.locator(".buyer-map .directory-panel");
    await expect(mapDirectory).toBeVisible();
    const mapDirectoryBox = await mapDirectory.boundingBox();
    expect(mapDirectoryBox).not.toBeNull();
    expect(mapDirectoryBox!.y).toBeGreaterThan(300);
    const mapDirectoryToggle = page.getByRole("button", { name: "Minimize provider directory" });
    const mapToggleBoxOpen = await mapDirectoryToggle.boundingBox();
    await mapDirectoryToggle.click();
    await expect(mapDirectory).toHaveCount(0);
    const mapToggleBoxClosed = await page.getByRole("button", { name: "Open provider directory" }).boundingBox();
    expect(mapToggleBoxClosed).toEqual(mapToggleBoxOpen);
    await page.getByRole("button", { name: "Open provider directory" }).click();
    await expect(mapDirectory).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/qa-authenticated-map-mobile.png", fullPage: true });
  });
});
