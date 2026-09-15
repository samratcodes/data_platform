import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const assertFits = async (page: import("@playwright/test").Page) => {
  const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(widths.document, `horizontal overflow: ${JSON.stringify(widths)}`).toBeLessThanOrEqual(widths.viewport + 1);
};

test("company registration shows errors beside fields and fits every wizard stage", async ({ page }) => {
  // The public OSM tile service can be blocked or unavailable; the wizard
  // should still allow choosing coordinates from its bundled fallback map.
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/signup/data-company");
  await assertFits(page);
  await expect(page.locator(".company-wizard-banner")).toBeInViewport();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".company-wizard-alert")).toContainText("Check the highlighted fields");
  await expect(page.locator(".wizard-input-card").filter({ hasText: "Company name" }).locator(".wizard-field-error")).toContainText("company name");
  await expect(page.locator(".wizard-input-card").filter({ hasText: "Company profile" }).locator(".wizard-field-error")).toContainText("20 characters");
  await expect(page.getByPlaceholder("Your company name")).toBeFocused();
  await page.screenshot({ path: "test-results/company-errors-mobile.png" });
  await page.getByPlaceholder("Your company name").fill("Northstar QA Data");
  await page.getByPlaceholder("What data do you provide, and how is it collected?").fill("We collect quality real-world images and video for AI research teams.");
  await expect(page.locator(".wizard-field-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".official-document-picker")).toBeVisible();
  await assertFits(page);

  await page.locator(".official-document-picker input[type=file]").setInputFiles({ name: "certificate.png", mimeType: "image/png", buffer: readFileSync("public/brand-logo.png") });
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".official-document-details .wizard-field-error")).toContainText("document type");
  await expect(page.locator(".official-document-details input")).toHaveAttribute("aria-invalid", "true");
  await page.locator(".official-document-details input").fill("Certificate of incorporation");
  await expect(page.locator(".official-document-details .wizard-field-error")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "What data can you provide?" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".wizard-section-error")).toContainText("data capability");
  await page.getByRole("button", { name: /Egocentric video/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Where is your company located?" })).toBeVisible();
  await assertFits(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".wizard-input-card").filter({ hasText: "Company website" }).locator(".wizard-field-error")).toContainText("website URL");
  await expect(page.locator(".wizard-input-card").filter({ hasText: "Physical address" }).locator(".wizard-field-error")).toContainText("physical address");
  await expect(page.locator(".wizard-location-picker .wizard-section-error")).toContainText("pin on the map");
  await expect(page.locator(".facility-picker-map-warning")).toContainText("Search and pin placement still work");
  await page.getByRole("button", { name: "Retry street map" }).click();
  await expect(page.locator(".facility-picker-map-warning")).toBeVisible();

  await page.getByPlaceholder("https://company.com").fill("https://northstar.example");
  await page.getByPlaceholder("Street address").fill("1 Data Street");
  await page.getByPlaceholder("Kathmandu").fill("Kathmandu");
  await page.getByPlaceholder("Nepal").fill("Nepal");
  await expect(page.locator(".facility-picker-map canvas")).toBeVisible();
  await page.locator(".facility-picker-map").click({ position: { x: 80, y: 80 } });
  await expect(page.getByPlaceholder("85.3240")).not.toHaveValue("");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Create your secure account" })).toBeVisible();
  await assertFits(page);

  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.locator(".wizard-input-card").filter({ hasText: "Business email" }).locator(".wizard-field-error")).toContainText("email address");
  await expect(page.locator(".wizard-input-card").filter({ hasText: /^Password/ }).locator(".wizard-field-error")).toContainText("12 and 128 characters");
  await page.screenshot({ path: "test-results/company-account-errors-mobile.png" });
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await assertFits(page);
    await expect(page.locator(".company-wizard-alert")).toBeVisible();
  }
  await page.screenshot({ path: "test-results/company-account-errors-desktop.png" });
});
